/**
 * Document Routes
 * Defines HTTP routes for document endpoints
 */

const express = require('express');
const router = express.Router();
const DocumentController = require('../controllers/DocumentController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { upload } = require('../middleware/upload');

// Upload documents (multipart/form-data)
router.post(
  '/',
  authenticate,
  validateCsrf,
  upload.array('files'),
  DocumentController.uploadDocuments.bind(DocumentController)
);

// Get documents by application ID
router.get(
  '/application/:applicationId',
  authenticate,
  DocumentController.getDocumentsByApplicationId.bind(DocumentController)
);

// Download document
router.get(
  '/:id/download',
  authenticate,
  DocumentController.downloadDocument.bind(DocumentController)
);

// View document inline
router.get(
  '/view/:id',
  authenticate,
  DocumentController.viewDocument.bind(DocumentController)
);

// Update document approval status
router.put(
  '/:id/approval',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'COORDINATOR'),
  DocumentController.updateDocumentApproval.bind(DocumentController)
);

// Delete document
router.delete(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN'),
  DocumentController.deleteDocument.bind(DocumentController)
);

module.exports = router;
