/**
 * Standardized API response helpers
 * Ensures consistent response format across all endpoints
 */

/**
 * Success response for single resource
 * @param {*} data - Response data
 * @returns {object} - Standardized success response
 */
const ok = (data) => ({
  success: true,
  data,
  timestamp: new Date().toISOString()
});

/**
 * Success response for paginated resources
 * @param {Array} data - Array of resources
 * @param {number} total - Total count of resources
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {object} - Standardized paginated response
 */
const page = (data, total, page, limit) => ({
  success: true,
  data,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  },
  timestamp: new Date().toISOString()
});

/**
 * Error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {*} details - Optional error details
 * @returns {object} - Standardized error response
 */
const fail = (code, message, details = null) => {
  const response = {
    success: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};

module.exports = { ok, page, fail };
