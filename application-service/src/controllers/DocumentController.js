/**
 * Document Controller
 * HTTP request handlers for document endpoints
 */

const DocumentService = require('../services/DocumentService');
const { uploadFile, deleteFile } = require('../services/VercelBlobService');
const { ok, fail } = require('../utils/responseHelpers');
const { VALID_DOCUMENT_TYPES } = require('../middleware/upload');
const logger = require('../utils/logger');

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
   * Redirects to Vercel Blob URL for download
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

      // Vercel Blob URLs are already publicly accessible
      // Redirect to the blob URL with download disposition
      const blobUrl = document.filePath; // This is the Vercel Blob URL

      if (!blobUrl || !blobUrl.startsWith('http')) {
        return res.status(404).json(
          fail('DOC_007', 'Document file URL is invalid')
        );
      }

      // Add download parameter to force download instead of inline view
      const downloadUrl = `${blobUrl}${blobUrl.includes('?') ? '&' : '?'}download=1`;

      logger.info(`Redirecting to download URL for document ${id}: ${downloadUrl}`);
      res.redirect(downloadUrl);
    } catch (error) {
      logger.error(`Error downloading document ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_008', 'Failed to download document', error.message)
      );
    }
  }

  /**
   * GET /api/applications/documents/view/:id
   * Redirects to Vercel Blob URL for inline viewing
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

      // Vercel Blob URLs are already publicly accessible
      // Redirect directly to the blob URL for inline viewing
      const blobUrl = document.filePath; // This is the Vercel Blob URL

      if (!blobUrl || !blobUrl.startsWith('http')) {
        return res.status(404).json(
          fail('DOC_010', 'Document file URL is invalid')
        );
      }

      logger.info(`Redirecting to view URL for document ${id}: ${blobUrl}`);
      res.redirect(blobUrl);
    } catch (error) {
      logger.error(`Error viewing document ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_011', 'Failed to view document', error.message)
      );
    }
  }

  /**
   * PUT /api/documents/:id
   * Replace document file - uploads new file to Vercel Blob and deletes old one
   */
  async replaceDocument(req, res) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json(
          fail('DOC_017', 'No file uploaded')
        );
      }

      // Get existing document
      const existingDocument = await DocumentService.getDocumentById(id);

      if (!existingDocument) {
        return res.status(404).json(
          fail('DOC_018', `Document ${id} not found`)
        );
      }

      const oldBlobUrl = existingDocument.filePath;

      // Upload new file to Vercel Blob
      const blobResult = await uploadFile(file.buffer, file.originalname, {
        contentType: file.mimetype
      });

      // Update database with new file info
      const updatedDocument = await DocumentService.updateDocument(id, {
        fileName: file.originalname,
        filePath: blobResult.url,
        fileSize: blobResult.size,
        mimeType: blobResult.contentType
      });

      // Delete old file from Vercel Blob (if it was a blob URL)
      if (oldBlobUrl && oldBlobUrl.startsWith('http')) {
        try {
          await deleteFile(oldBlobUrl);
          logger.info(`Deleted old file from Vercel Blob: ${oldBlobUrl}`);
        } catch (blobError) {
          // Log error but don't fail the request since new file is already uploaded
          logger.error(`Failed to delete old file from Vercel Blob: ${oldBlobUrl}`, blobError);
          logger.warn('New document uploaded but old file may remain in blob storage');
        }
      }

      return res.json(
        ok({
          message: 'Document replaced successfully',
          document: updatedDocument.toJSON()
        })
      );
    } catch (error) {
      logger.error(`Error replacing document ${req.params.id}:`, error);
      return res.status(500).json(
        fail('DOC_019', 'Failed to replace document', error.message)
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
   * Deletes document from both database and Vercel Blob storage
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;

      // First get the document to retrieve the Vercel Blob URL
      const document = await DocumentService.getDocumentById(id);

      if (!document) {
        return res.status(404).json(
          fail('DOC_015', `Document ${id} not found`)
        );
      }

      const blobUrl = document.filePath;

      // Delete from database first
      const deletedDocument = await DocumentService.deleteDocument(id);

      // Then delete from Vercel Blob if URL exists
      if (blobUrl && blobUrl.startsWith('http')) {
        try {
          await deleteFile(blobUrl);
          logger.info(`Deleted file from Vercel Blob: ${blobUrl}`);
        } catch (blobError) {
          // Log error but don't fail the request since DB deletion succeeded
          logger.error(`Failed to delete file from Vercel Blob: ${blobUrl}`, blobError);
          logger.warn('Document deleted from database but file may remain in blob storage');
        }
      }

      return res.json(
        ok({
          message: 'Document deleted successfully',
          document: deletedDocument.toJSON()
        })
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
