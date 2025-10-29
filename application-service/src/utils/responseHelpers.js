/**
 * Response Helpers - Importado desde shared
 * Standardized response formats for all microservices
 */

// Importar desde shared para unificación
const { ok, page, fail } = require('../../shared/utils/responseHelpers');

module.exports = {
  ok,
  page,
  fail
};
