/**
 * Response Helpers
 * Standardized response formats for API endpoints
 */

const now = () => new Date().toISOString();

/**
 * Success response
 * @param {*} data - Response data
 * @param {Object} meta - Optional metadata
 */
const ok = (data, meta = {}) => ({
  success: true,
  data,
  timestamp: now(),
  ...meta
});

/**
 * Paginated response
 * @param {Array} data - Array of items
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 */
const page = (data, total, page, limit) => ({
  success: true,
  data,
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  timestamp: now()
});

/**
 * Error response
 * @param {string} errorCode - Error code
 * @param {string} message - Error message
 * @param {Object} details - Optional error details
 */
const fail = (errorCode, message, details = null) => ({
  success: false,
  error: {
    code: errorCode,
    message,
    ...(details && { details })
  },
  timestamp: now()
});

module.exports = {
  ok,
  page,
  fail
};
