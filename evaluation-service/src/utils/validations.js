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

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateTimeFormat = (time) => {
  if (!time || typeof time !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

const validateDateFormat = (date) => {
  if (!date || typeof date !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

module.exports = { validateRUT, validateEmail, validateTimeFormat, validateDateFormat };
