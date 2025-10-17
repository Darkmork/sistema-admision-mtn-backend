const Joi = require('joi');
const { fail } = require('../utils/responseHelpers');
const { validateRut, validatePhone, validateEmail } = require('../utils/validators');

/**
 * Custom Joi validator for Chilean RUT
 */
const rutValidator = (value, helpers) => {
  if (process.env.RUT_VALIDATION_ENABLED === 'false') {
    return value;
  }

  if (!validateRut(value)) {
    return helpers.error('any.invalid');
  }

  return value;
};

/**
 * Custom Joi validator for Chilean phone
 */
const phoneValidator = (value, helpers) => {
  if (!validatePhone(value)) {
    return helpers.error('any.invalid');
  }

  return value;
};

/**
 * Validation schemas
 */
const schemas = {
  createGuardian: Joi.object({
    rut: Joi.string().required().custom(rutValidator, 'RUT validation')
      .messages({
        'any.required': 'RUT is required',
        'any.invalid': 'Invalid Chilean RUT format'
      }),
    firstName: Joi.string().required().min(2).max(100)
      .messages({
        'any.required': 'First name is required',
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name must not exceed 100 characters'
      }),
    lastName: Joi.string().required().min(2).max(100)
      .messages({
        'any.required': 'Last name is required',
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name must not exceed 100 characters'
      }),
    email: Joi.string().required().email()
      .messages({
        'any.required': 'Email is required',
        'string.email': 'Invalid email format'
      }),
    phone: Joi.string().required().custom(phoneValidator, 'Phone validation')
      .messages({
        'any.required': 'Phone is required',
        'any.invalid': 'Invalid Chilean phone format'
      }),
    address: Joi.string().required().max(255),
    commune: Joi.string().required().max(100),
    city: Joi.string().required().max(100),
    region: Joi.string().required().max(100),
    relationship: Joi.string().required().valid('FATHER', 'MOTHER', 'TUTOR', 'OTHER')
      .messages({
        'any.only': 'Relationship must be FATHER, MOTHER, TUTOR, or OTHER'
      }),
    occupation: Joi.string().allow('', null).max(100),
    workplace: Joi.string().allow('', null).max(255),
    workPhone: Joi.string().allow('', null).custom(phoneValidator, 'Work phone validation'),
    emergencyContactName: Joi.string().allow('', null).max(200),
    emergencyContactPhone: Joi.string().allow('', null).custom(phoneValidator, 'Emergency phone validation'),
    emergencyContactRelationship: Joi.string().allow('', null).max(100)
  }),

  updateGuardian: Joi.object({
    firstName: Joi.string().min(2).max(100),
    lastName: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    phone: Joi.string().custom(phoneValidator, 'Phone validation'),
    address: Joi.string().max(255),
    commune: Joi.string().max(100),
    city: Joi.string().max(100),
    region: Joi.string().max(100),
    relationship: Joi.string().valid('FATHER', 'MOTHER', 'TUTOR', 'OTHER'),
    occupation: Joi.string().allow('', null).max(100),
    workplace: Joi.string().allow('', null).max(255),
    workPhone: Joi.string().allow('', null).custom(phoneValidator, 'Work phone validation'),
    emergencyContactName: Joi.string().allow('', null).max(200),
    emergencyContactPhone: Joi.string().allow('', null).custom(phoneValidator, 'Emergency phone validation'),
    emergencyContactRelationship: Joi.string().allow('', null).max(100)
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

/**
 * Validation middleware factory
 */
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return res.status(500).json(fail('VAL_001', 'Validation schema not found'));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json(fail('VAL_002', 'Validation failed', errors));
    }

    req.validatedData = value;
    next();
  };
};

module.exports = { validate };
