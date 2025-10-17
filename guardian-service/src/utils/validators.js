/**
 * Chilean RUT validation utilities
 */

/**
 * Clean RUT (remove dots and dashes)
 * @param {string} rut - RUT to clean
 * @returns {string} - Cleaned RUT
 */
const cleanRut = (rut) => {
  if (!rut) return '';
  return rut.toString().replace(/\./g, '').replace(/-/g, '').toUpperCase();
};

/**
 * Format RUT (12345678-9)
 * @param {string} rut - RUT to format
 * @returns {string} - Formatted RUT
 */
const formatRut = (rut) => {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Add thousands separators
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
};

/**
 * Calculate RUT verification digit
 * @param {string} rut - RUT without verification digit
 * @returns {string} - Verification digit
 */
const calculateDV = (rut) => {
  const clean = cleanRut(rut);
  const body = clean.slice(0, -1);

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const dv = 11 - remainder;

  if (dv === 11) return '0';
  if (dv === 10) return 'K';
  return dv.toString();
};

/**
 * Validate Chilean RUT
 * @param {string} rut - RUT to validate
 * @returns {boolean} - True if valid
 */
const validateRut = (rut) => {
  if (!rut) return false;

  const clean = cleanRut(rut);

  // Must be at least 2 characters (1 digit + DV)
  if (clean.length < 2) return false;

  // Must not exceed 9 characters (8 digits + DV)
  if (clean.length > 9) return false;

  // Extract body and DV
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  // Body must be numeric
  if (!/^\d+$/.test(body)) return false;

  // DV must be digit or K
  if (!/^[\dK]$/.test(dv)) return false;

  // Calculate expected DV
  const expectedDV = calculateDV(body + '0');

  return dv === expectedDV;
};

/**
 * Validate Chilean phone number
 * @param {string} phone - Phone to validate
 * @returns {boolean} - True if valid
 */
const validatePhone = (phone) => {
  if (!phone) return false;

  // Remove all non-digits
  const clean = phone.replace(/\D/g, '');

  // Chilean phone: 9 digits (mobile) or 8 digits (landline)
  // With country code: +56 9 XXXX XXXX (11-12 digits total)
  return /^(\+?56)?[2-9]\d{7,8}$/.test(clean);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
const validateEmail = (email) => {
  if (!email) return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  cleanRut,
  formatRut,
  calculateDV,
  validateRut,
  validatePhone,
  validateEmail
};
