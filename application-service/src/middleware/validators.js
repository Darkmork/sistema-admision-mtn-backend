/**
 * Request Validation Middleware
 * Uses Joi for schema validation
 */

const Joi = require('joi');
const { fail } = require('../utils/responseHelpers');
const { validateRUT } = require('../utils/validations');

// Custom RUT validator for Joi
const rutValidator = (value, helpers) => {
  if (!validateRUT(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Application creation schema
const createApplicationSchema = Joi.object({
  studentFirstName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Student first name must be at least 2 characters',
      'string.max': 'Student first name cannot exceed 100 characters',
      'any.required': 'Student first name is required'
    }),
  studentPaternalLastName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Paternal last name must be at least 2 characters',
      'any.required': 'Paternal last name is required'
    }),
  studentMaternalLastName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Maternal last name must be at least 2 characters',
      'any.required': 'Maternal last name is required'
    }),
  studentRUT: Joi.string().custom(rutValidator, 'RUT validation').required()
    .messages({
      'any.invalid': 'Invalid Chilean RUT format',
      'any.required': 'Student RUT is required'
    }),
  studentDateOfBirth: Joi.date().iso().max('now').required()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'any.required': 'Date of birth is required'
    }),
  studentGender: Joi.string().valid('M', 'F', 'OTHER').required()
    .messages({
      'any.only': 'Gender must be M, F, or OTHER',
      'any.required': 'Student gender is required'
    }),
  gradeAppliedFor: Joi.string().valid(
    'PRE_KINDER', 'KINDER',
    '1_BASICO', '2_BASICO', '3_BASICO', '4_BASICO', '5_BASICO', '6_BASICO', '7_BASICO', '8_BASICO',
    '1_MEDIO', '2_MEDIO', '3_MEDIO', '4_MEDIO'
  ).required()
    .messages({
      'any.only': 'Invalid grade level',
      'any.required': 'Grade applied for is required'
    }),
  guardianRUT: Joi.string().custom(rutValidator, 'RUT validation').required()
    .messages({
      'any.invalid': 'Invalid guardian RUT format',
      'any.required': 'Guardian RUT is required'
    }),
  guardianEmail: Joi.string().email().required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Guardian email is required'
    }),
  applicationYear: Joi.number().integer().min(2024).max(2030).required()
    .messages({
      'number.min': 'Application year must be 2024 or later',
      'number.max': 'Application year cannot exceed 2030',
      'any.required': 'Application year is required'
    })
});

// Application update schema (all fields optional)
const updateApplicationSchema = Joi.object({
  studentFirstName: Joi.string().min(2).max(100),
  studentPaternalLastName: Joi.string().min(2).max(100),
  studentMaternalLastName: Joi.string().min(2).max(100),
  studentRUT: Joi.string().custom(rutValidator, 'RUT validation'),
  studentDateOfBirth: Joi.date().iso().max('now'),
  studentGender: Joi.string().valid('M', 'F', 'OTHER'),
  gradeAppliedFor: Joi.string().valid(
    'PRE_KINDER', 'KINDER',
    '1_BASICO', '2_BASICO', '3_BASICO', '4_BASICO', '5_BASICO', '6_BASICO', '7_BASICO', '8_BASICO',
    '1_MEDIO', '2_MEDIO', '3_MEDIO', '4_MEDIO'
  ),
  guardianRUT: Joi.string().custom(rutValidator, 'RUT validation'),
  guardianEmail: Joi.string().email(),
  notes: Joi.string().max(1000)
}).min(1);

// Status update schema
const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'
  ).required()
    .messages({
      'any.only': 'Invalid status value',
      'any.required': 'Status is required'
    }),
  notes: Joi.string().max(1000).allow('', null)
});

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json(
        fail('VALIDATION_ERROR', 'Request validation failed', details)
      );
    }

    req[property] = value;
    next();
  };
};

module.exports = {
  validate,
  createApplicationSchema,
  updateApplicationSchema,
  updateStatusSchema
};
