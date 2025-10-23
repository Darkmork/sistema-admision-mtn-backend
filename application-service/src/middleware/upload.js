/**
 * File Upload Middleware
 * Handles multipart/form-data file uploads using Multer
 * Uses memory storage for Vercel Blob integration
 */

const multer = require('multer');
const logger = require('../utils/logger');

logger.info('Using Vercel Blob for file storage (memory storage)');

// Storage configuration - use memory storage for Vercel Blob
// Files are stored in memory as Buffer objects, then uploaded to Vercel Blob
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`File upload rejected: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PDF, JPG, PNG, GIF, DOC, DOCX`), false);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    files: parseInt(process.env.MAX_FILES || '5')
  }
});

// Valid document types (must match database CHECK constraint)
const VALID_DOCUMENT_TYPES = [
  'BIRTH_CERTIFICATE',
  'GRADES_2023',
  'GRADES_2024',
  'GRADES_2025_SEMESTER_1',
  'PERSONALITY_REPORT_2024',
  'PERSONALITY_REPORT_2025_SEMESTER_1',
  'STUDENT_PHOTO',
  'BAPTISM_CERTIFICATE',
  'PREVIOUS_SCHOOL_REPORT',
  'MEDICAL_CERTIFICATE',
  'PSYCHOLOGICAL_REPORT'
];

module.exports = {
  upload,
  VALID_DOCUMENT_TYPES
};
