/**
 * Validation utilities for Chilean RUT, email, phone, etc.
 */

/**
 * Validates Chilean RUT
 * @param {string} rut - RUT in format 12345678-9
 * @returns {boolean}
 */
const validateRUT = (rut) => {
  if (!rut || typeof rut !== 'string') return false;

  const cleanRUT = rut.replace(/[.-]/g, '');
  if (cleanRUT.length < 2) return false;

  const body = cleanRUT.slice(0, -1);
  const checkDigit = cleanRUT.slice(-1).toUpperCase();

  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedDigit = 11 - (sum % 11);
  const calculatedDigit = expectedDigit === 11 ? '0' : expectedDigit === 10 ? 'K' : expectedDigit.toString();

  return calculatedDigit === checkDigit;
};

/**
 * Validates email format
 * @param {string} email
 * @returns {boolean}
 */
const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates Chilean phone number
 * @param {string} phone - Phone number (+56912345678 or 912345678)
 * @returns {boolean}
 */
const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const phoneRegex = /^(\+?56)?[2-9]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Validates file extension
 * @param {string} filename
 * @param {Array} allowedExtensions
 * @returns {boolean}
 */
const validateFileExtension = (filename, allowedExtensions) => {
  if (!filename || typeof filename !== 'string') return false;
  const ext = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(ext);
};

/**
 * Validates file size
 * @param {number} size - Size in bytes
 * @param {number} maxSize - Max size in bytes
 * @returns {boolean}
 */
const validateFileSize = (size, maxSize) => {
  return typeof size === 'number' && size > 0 && size <= maxSize;
};

/**
 * Sanitizes filename
 * @param {string} filename
 * @returns {string}
 */
const sanitizeFilename = (filename) => {
  if (!filename) return '';
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
};

module.exports = {
  validateRUT,
  validateEmail,
  validatePhone,
  validateFileExtension,
  validateFileSize,
  sanitizeFilename
};
