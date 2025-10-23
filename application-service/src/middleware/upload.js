/**
 * File Upload Middleware
 * Handles multipart/form-data file uploads using Multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sanitizeFilename } = require('../utils/validations');
const logger = require('../utils/logger');

// Ensure upload directory exists
// Railway: /app/uploads (mounted volume)
// Local: ./uploads (relative path)
const uploadDir = process.env.UPLOAD_DIR || (process.env.NODE_ENV === 'production' ? '/app/uploads' : './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info(`Created upload directory: ${uploadDir}`);
}
logger.info(`Using upload directory: ${uploadDir}`);

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = sanitizeFilename(file.originalname);
    const filename = `${timestamp}-${sanitized}`;
    cb(null, filename);
  }
});

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
