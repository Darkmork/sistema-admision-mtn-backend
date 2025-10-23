/**
 * Vercel Blob Storage Service
 * Handles file uploads to Vercel Blob for persistent, scalable storage
 */

const { put, del, head } = require('@vercel/blob');
const logger = require('../utils/logger');

/**
 * Upload file buffer to Vercel Blob
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} fileName - Original file name
 * @param {Object} options - Additional options (contentType, etc.)
 * @returns {Promise<Object>} - Blob metadata with URL
 */
const uploadFile = async (fileBuffer, fileName, options = {}) => {
  try {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobPath = `mtn_documents/${timestamp}-${sanitizedName}`;

    logger.info(`Uploading file to Vercel Blob: ${blobPath}`);

    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      contentType: options.contentType || 'application/octet-stream',
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    logger.info(`File uploaded successfully: ${blob.url}`);

    return {
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: blob.size
    };
  } catch (error) {
    logger.error(`Error uploading file to Vercel Blob: ${fileName}`, error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete a file from Vercel Blob
 * @param {string} blobUrl - Full URL of the blob to delete
 * @returns {Promise<void>}
 */
const deleteFile = async (blobUrl) => {
  try {
    logger.info(`Deleting file from Vercel Blob: ${blobUrl}`);

    await del(blobUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    logger.info(`File deleted successfully: ${blobUrl}`);
  } catch (error) {
    logger.error(`Error deleting file from Vercel Blob: ${blobUrl}`, error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get file metadata from Vercel Blob
 * @param {string} blobUrl - Full URL of the blob
 * @returns {Promise<Object>} - File metadata
 */
const getFileMetadata = async (blobUrl) => {
  try {
    const metadata = await head(blobUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return {
      url: metadata.url,
      size: metadata.size,
      uploadedAt: metadata.uploadedAt,
      pathname: metadata.pathname,
      contentType: metadata.contentType
    };
  } catch (error) {
    logger.error(`Error getting metadata for blob: ${blobUrl}`, error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
};

/**
 * Verify Vercel Blob configuration on startup
 * @returns {boolean} - True if configured correctly
 */
const verifyBlobConfig = () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    logger.error('Vercel Blob configuration incomplete. Missing BLOB_READ_WRITE_TOKEN.');
    logger.warn('File uploads will fail without Vercel Blob configuration.');
    return false;
  }

  logger.info('Vercel Blob configured successfully');
  return true;
};

// Verify configuration on module load
verifyBlobConfig();

module.exports = {
  uploadFile,
  deleteFile,
  getFileMetadata,
  verifyBlobConfig
};
