/**
 * Document Controller
 * HTTP request handlers for document endpoints
 */

const DocumentService = require('../services/DocumentService');
const { uploadFile } = require('../services/VercelBlobService');
const { ok, fail } = require('../utils/responseHelpers');
const { VALID_DOCUMENT_TYPES } = require('../middleware/upload');
const logger = require('../utils/logger');
const fs = require('fs');

class DocumentController {
  /**
   * POST /api/applications/documents
   */
  async uploadDocuments(req, res) {
    try {
      const { applicationId, documentType } = req.body;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json(
          fail('DOC_001', 'No files uploaded')
        );
      }

      if (!applicationId) {
        return res.status(400).json(
          fail('DOC_002', 'Application ID is required')
        );
      }

      if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
        return res.status(400).json(
          fail('DOC_003', `Invalid document type. Valid types: ${VALID_DOCUMENT_TYPES.join(', ')}`)
        );
      }

      const uploadedBy = req.user.userId;

      // Upload files to Vercel Blob and create database records
      const documents = [];
      for (const file of files) {
        // Upload to Vercel Blob
        const blobResult = await uploadFile(file.buffer, file.originalname, {
          contentType: file.mimetype
        });

        // Create database record with Vercel Blob URL
        const document = await DocumentService.createDocument({
          applicationId,
          documentType,
          fileName: file.originalname,
          filePath: blobResult.url,  // Vercel Blob URL
          fileSize: blobResult.size,
          mimeType: blobResult.contentType,
          uploadedBy
        });

        documents.push(document);
      }

      return res.status(201).json(
        ok({
          message: `${documents.length} document(s) uploaded successfully`,
          documents: documents.map(doc => doc.toJSON())
        })
      );
    } catch (error) {
      logger.error('Error uploading documents:', error);
      return res.status(500).json(
        fail('DOC_004', 'Failed to upload documents', error.message)
      );
    }
  }

  /**
   * GET /api/applications/:applicationId/documents
   */
  async getDocumentsByApplicationId(req, res) {
    try {
      const { applicationId } = req.params;
      const documents = await DocumentService.getDocumentsByApplicationId(applicationId);

      return res.json(
        ok(documents.map(doc => doc.toJSON()))
      );
    } catch (error) {
      logger.error(`Error getting documents for application ${req.params.applicationId}:`, error);
      return res.status(500).json(
        fail('DOC_005', 'Failed to retrieve documents', error.message)
      );
    }
  }

  /**
   * GET /api/documents/:id/download
   */
  async downloadDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await DocumentService.getDocumentById(id);

      if (!document) {
        return res.status(404).json(
          fail('DOC_006', `Document ${id} not found`)
        );
      }

      const fileExists = await DocumentService.fileExists(document.filePath);
      if (!fileExists) {
        return res.status(404).json(
          fail('DOC_007', 'Document file not found on disk')
        );
      }

      res.download(document.filePath, document.fileName);
    } catch (error) {
      logger.error(`Error downloading document ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_008', 'Failed to download document', error.message)
      );
    }
  }

  /**
   * GET /api/applications/documents/view/:id
   */
  async viewDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await DocumentService.getDocumentById(id);

      if (!document) {
        return res.status(404).json(
          fail('DOC_009', `Document ${id} not found`)
        );
      }

      const fileExists = await DocumentService.fileExists(document.filePath);
      if (!fileExists) {
        return res.status(404).json(
          fail('DOC_010', 'Document file not found on disk')
        );
      }

      // Set headers for inline viewing
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);

      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error(`Error viewing document ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_011', 'Failed to view document', error.message)
      );
    }
  }

  /**
   * PUT /api/applications/documents/:id/approval
   */
  async updateDocumentApproval(req, res) {
    try {
      const { id } = req.params;
      const { approvalStatus, rejectionReason } = req.body;
      const approvedBy = req.user.userId;

      if (!['APPROVED', 'REJECTED', 'PENDING'].includes(approvalStatus)) {
        return res.status(400).json(
          fail('DOC_012', 'Invalid approval status. Must be APPROVED, REJECTED, or PENDING')
        );
      }

      const document = await DocumentService.updateDocumentApproval(
        id,
        approvalStatus,
        rejectionReason || null,
        approvedBy
      );

      if (!document) {
        return res.status(404).json(
          fail('DOC_013', `Document ${id} not found`)
        );
      }

      return res.json(ok(document.toJSON()));
    } catch (error) {
      logger.error(`Error updating document approval ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_014', 'Failed to update document approval', error.message)
      );
    }
  }

  /**
   * DELETE /api/applications/documents/:id
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await DocumentService.deleteDocument(id);

      if (!document) {
        return res.status(404).json(
          fail('DOC_015', `Document ${id} not found`)
        );
      }

      return res.json(
        ok({ message: 'Document deleted successfully', document: document.toJSON() })
      );
    } catch (error) {
      logger.error(`Error deleting document ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_016', 'Failed to delete document', error.message)
      );
    }
  }
}

module.exports = new DocumentController();
