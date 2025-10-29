/**
 * Response Helpers
 * Standardized response formats for API endpoints
 * Imported from: shared/utils/responseHelpers.js
 */

const now = () => new Date().toISOString();

const ok = (data, meta = {}) => ({
  success: true,
  data,
  timestamp: now(),
  ...meta
});

const page = (data, total, pageNum, limit, meta = {}) => ({
  success: true,
  data,
  pagination: {
    total,
    page: pageNum,
    limit,
    totalPages: Math.ceil(total / limit)
  },
  timestamp: now(),
  ...meta
});

const fail = (errorCode, message, details = null) => {
  const error = {
    code: errorCode,
    message
  };

  if (details !== null) {
    if (details instanceof Error) {
      error.details = {
        message: details.message,
        stack: details.stack
      };
    } else if (typeof details === 'object') {
      error.details = details;
    } else {
      error.details = details;
    }
  }

  return {
    success: false,
    error,
    timestamp: now()
  };
};

module.exports = {
  ok,
  page,
  fail
};
