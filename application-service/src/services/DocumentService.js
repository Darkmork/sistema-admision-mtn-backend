/**
 * Document Service
 * Business logic for document management
 */

const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Document = require('../models/Document');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class DocumentService {
  /**
   * Create new document records
   */
  async createDocuments(files, applicationId, documentType, uploadedBy) {
    return await writeOperationBreaker.fire(async () => {
      const documents = [];

      for (const file of files) {
        const result = await dbPool.query(
          `INSERT INTO documents (
            application_id, document_type, file_name, file_path,
            file_size, content_type, original_name, is_required, approval_status,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING *`,
          [
            applicationId,
            documentType,
            file.originalname,
            file.path,
            file.size,
            file.mimetype,
            file.originalname,
            false,
            'PENDING'
          ]
        );

        documents.push(Document.fromDatabaseRow(result.rows[0]));
      }

      logger.info(`Created ${documents.length} documents for application ${applicationId}`);
      return documents;
    });
  }

  /**
   * Get documents by application ID
   */
  async getDocumentsByApplicationId(applicationId) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM documents WHERE application_id = $1 ORDER BY created_at DESC',
        [applicationId]
      );

      logger.info(`Retrieved ${result.rows.length} documents for application ${applicationId}`);
      return Document.fromDatabaseRows(result.rows);
    });
  }

  /**
   * Get document by ID
   */
  async getDocumentById(id) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM documents WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved document ${id}`);
      return Document.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Update document approval status
   */
  async updateDocumentApproval(id, approvalStatus, rejectionReason, approvedBy) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query(
        `UPDATE documents
         SET approval_status = $1, rejection_reason = $2, approved_by = $3, approval_date = NOW()
         WHERE id = $4
         RETURNING *`,
        [approvalStatus, rejectionReason, approvedBy, id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated document ${id} approval status to ${approvalStatus}`);
      return Document.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Delete document
   */
  async deleteDocument(id) {
    return await writeOperationBreaker.fire(async () => {
      // Get document first to delete file
      const doc = await this.getDocumentById(id);
      if (!doc) {
        return null;
      }

      // Delete database record
      const result = await dbPool.query(
        'DELETE FROM documents WHERE id = $1 RETURNING *',
        [id]
      );

      // Delete file from disk
      try {
        await fs.unlink(doc.filePath);
        logger.info(`Deleted file: ${doc.filePath}`);
      } catch (error) {
        logger.error(`Failed to delete file ${doc.filePath}:`, error);
      }

      logger.info(`Deleted document ${id}`);
      return Document.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Check if file exists on disk
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new DocumentService();
