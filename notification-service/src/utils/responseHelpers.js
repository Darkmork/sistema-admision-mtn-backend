const now = () => new Date().toISOString();
const ok = (data, meta = {}) => ({ success: true, data, timestamp: now(), ...meta });
const page = (data, total, page, limit) => ({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit), timestamp: now() });
const fail = (errorCode, message, details = null) => ({ success: false, error: { code: errorCode, message, ...(details && { details }) }, timestamp: now() });
module.exports = { ok, page, fail };
