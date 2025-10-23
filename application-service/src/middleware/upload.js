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
// Railway: Use /tmp/uploads (always writable) since volume has permission issues
// Local: ./uploads (relative path)

const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? '/tmp/uploads'  // Railway: use /tmp which is always writable
  : (process.env.UPLOAD_DIR || './uploads');  // Local: use configured or default path

// Create directory with full write permissions
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o777 });
    logger.info(`Created upload directory: ${uploadDir} with permissions 777`);
  } catch (error) {
    logger.error(`Failed to create upload directory: ${error.message}`);
    throw error;
  }
}

// Verify write permissions
try {
  const testFile = path.join(uploadDir, '.write-test-' + Date.now());
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  logger.info(`Upload directory verified writable: ${uploadDir}`);
} catch (error) {
  logger.error(`Upload directory not writable: ${uploadDir} - ${error.message}`);
  logger.error(`This will cause file upload failures!`);
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
