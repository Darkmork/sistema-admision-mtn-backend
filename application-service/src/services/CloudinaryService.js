/**
 * Cloudinary Storage Service
 * Handles file uploads to Cloudinary for persistent, scalable storage
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Verify configuration on startup
const verifyCloudinaryConfig = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();

  if (!cloud_name || !api_key || !api_secret) {
    logger.error('Cloudinary configuration incomplete. Missing credentials.');
    logger.warn('File uploads will fail without Cloudinary configuration.');
    return false;
  }

  logger.info(`Cloudinary configured: ${cloud_name}`);
  return true;
};

verifyCloudinaryConfig();

/**
 * Create Cloudinary storage for Multer
 * @param {string} folder - Cloudinary folder name (e.g., 'mtn_documents')
 * @returns {CloudinaryStorage} Configured storage
 */
const createCloudinaryStorage = (folder = 'mtn_documents') => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folder,
      allowed_formats: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'doc', 'docx'],
      resource_type: 'auto', // Automatically detect resource type
      public_id: (req, file) => {
        // Generate unique filename: timestamp-sanitized-original-name
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${timestamp}-${originalName}`;
      }
    }
  });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public_id of the file
 * @returns {Promise<Object>} Deletion result
 */
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw' // For non-image files
    });
    logger.info(`Deleted file from Cloudinary: ${publicId}`, result);
    return result;
  } catch (error) {
    logger.error(`Error deleting file from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

/**
 * Get file URL from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @param {Object} options - Transformation options (optional)
 * @returns {string} File URL
 */
const getFileUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    secure: true,
    ...options
  });
};

/**
 * Extract Cloudinary public_id from URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null
 */
const extractPublicId = (url) => {
  try {
    // Extract from URL pattern: https://res.cloudinary.com/{cloud}/raw/upload/v{version}/{folder}/{public_id}.{ext}
    const match = url.match(/\/v\d+\/(.+?)(\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch (error) {
    logger.error('Error extracting public_id from URL', { url, error });
    return null;
  }
};

module.exports = {
  cloudinary,
  createCloudinaryStorage,
  deleteFile,
  getFileUrl,
  extractPublicId,
  verifyCloudinaryConfig
};
