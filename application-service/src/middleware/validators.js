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
  // Required student fields
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
  studentMaternalLastName: Joi.string().min(2).max(100).optional().allow(''),
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
  gradeAppliedFor: Joi.string().valid(
    'PRE_KINDER', 'KINDER',
    '1_BASICO', '2_BASICO', '3_BASICO', '4_BASICO', '5_BASICO', '6_BASICO', '7_BASICO', '8_BASICO',
    '1_MEDIO', '2_MEDIO', '3_MEDIO', '4_MEDIO'
  ).required()
    .messages({
      'any.only': 'Invalid grade level',
      'any.required': 'Grade applied for is required'
    }),

  // Optional student fields
  studentEmail: Joi.string().email().optional().allow(''),
  studentAddress: Joi.string().max(300).optional().allow(''),
  studentCurrentSchool: Joi.string().max(200).optional().allow(''),
  studentAdmissionPreference: Joi.string().max(200).optional().allow(''),
  studentPais: Joi.string().max(100).optional().allow(''),
  studentRegion: Joi.string().max(100).optional().allow(''),
  studentComuna: Joi.string().max(100).optional().allow(''),
  studentAdditionalNotes: Joi.string().max(1000).optional().allow(''),

  // Father (parent1) fields - all optional
  parent1Name: Joi.string().max(255).optional().allow(''),
  parent1Rut: Joi.string().optional().allow(''),
  parent1Email: Joi.string().email().optional().allow(''),
  parent1Phone: Joi.string().max(255).optional().allow(''),
  parent1Address: Joi.string().max(255).optional().allow(''),
  parent1Profession: Joi.string().max(255).optional().allow(''),

  // Mother (parent2) fields - all optional
  parent2Name: Joi.string().max(255).optional().allow(''),
  parent2Rut: Joi.string().optional().allow(''),
  parent2Email: Joi.string().email().optional().allow(''),
  parent2Phone: Joi.string().max(255).optional().allow(''),
  parent2Address: Joi.string().max(255).optional().allow(''),
  parent2Profession: Joi.string().max(255).optional().allow(''),

  // Guardian fields - all optional
  guardianName: Joi.string().max(255).optional().allow(''),
  guardianRut: Joi.string().optional().allow(''),
  guardianEmail: Joi.string().email().optional().allow(''),
  guardianPhone: Joi.string().max(255).optional().allow(''),
  guardianRelation: Joi.string().max(255).optional().allow(''),

  // Supporter fields - all optional
  supporterName: Joi.string().max(255).optional().allow(''),
  supporterRut: Joi.string().optional().allow(''),
  supporterEmail: Joi.string().email().optional().allow(''),
  supporterPhone: Joi.string().max(255).optional().allow(''),
  supporterRelation: Joi.string().max(255).optional().allow(''),

  // Additional notes
  additionalNotes: Joi.string().max(1000).optional().allow('')
});

// Application update schema (accepts nested structure from frontend)
const updateApplicationSchema = Joi.object({
  // Nested student object
  student: Joi.object({
    firstName: Joi.string().min(2).max(100),
    paternalLastName: Joi.string().min(2).max(100),
    maternalLastName: Joi.string().min(2).max(100),
    rut: Joi.string().custom(rutValidator, 'RUT validation'),
    birthDate: Joi.date().iso().max('now'),
    gender: Joi.string().valid('M', 'F', 'OTHER'),
    email: Joi.string().email().allow('', null),
    address: Joi.string().max(500).allow('', null),
    gradeApplied: Joi.string().valid(
      'PRE_KINDER', 'KINDER',
      '1_BASICO', '2_BASICO', '3_BASICO', '4_BASICO', '5_BASICO', '6_BASICO', '7_BASICO', '8_BASICO',
      '1_MEDIO', '2_MEDIO', '3_MEDIO', '4_MEDIO'
    ),
    currentSchool: Joi.string().max(200).allow('', null),
    targetSchool: Joi.string().max(200).allow('', null),
    additionalNotes: Joi.string().max(1000).allow('', null),
    admissionPreference: Joi.string().allow('', null),
    // Special categories
    isEmployeeChild: Joi.boolean(),
    employeeParentName: Joi.string().max(200).allow('', null),
    isAlumniChild: Joi.boolean(),
    alumniParentYear: Joi.number().integer().min(1900).max(2100).allow(null),
    isInclusionStudent: Joi.boolean(),
    inclusionType: Joi.string().max(100).allow('', null),
    inclusionNotes: Joi.string().max(1000).allow('', null)
  }),
  // Nested father object
  father: Joi.object({
    fullName: Joi.string().min(2).max(200),
    rut: Joi.string().custom(rutValidator, 'RUT validation'),
    email: Joi.string().email(),
    phone: Joi.string().max(20),
    address: Joi.string().max(500),
    profession: Joi.string().max(100)
  }),
  // Nested mother object
  mother: Joi.object({
    fullName: Joi.string().min(2).max(200),
    rut: Joi.string().custom(rutValidator, 'RUT validation'),
    email: Joi.string().email(),
    phone: Joi.string().max(20),
    address: Joi.string().max(500),
    profession: Joi.string().max(100)
  }),
  // Nested guardian object
  guardian: Joi.object({
    fullName: Joi.string().min(2).max(200),
    rut: Joi.string().custom(rutValidator, 'RUT validation'),
    email: Joi.string().email(),
    phone: Joi.string().max(20),
    relationship: Joi.string().max(50)
  }),
  // Nested supporter object
  supporter: Joi.object({
    fullName: Joi.string().min(2).max(200),
    rut: Joi.string().custom(rutValidator, 'RUT validation'),
    email: Joi.string().email(),
    phone: Joi.string().max(20),
    relationship: Joi.string().max(50)
  }),
  // Top-level fields
  schoolApplied: Joi.string().valid('MONTE_TABOR', 'NAZARET'),
  status: Joi.string().valid('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'),
  notes: Joi.string().max(1000).allow('', null)
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

      // LOG DETALLADO PARA DEBUG
      console.log('=== VALIDATION ERROR DEBUG ===');
      console.log('Request body:', JSON.stringify(req[property], null, 2));
      console.log('Validation errors:', JSON.stringify(details, null, 2));
      console.log('==============================');

      return res.status(400).json(
        fail('VALIDATION_ERROR', 'Request validation failed', details)
      );
    }

    req[property] = value;
    next();
  };
};

// Student creation schema
const createStudentSchema = Joi.object({
  firstName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name cannot exceed 100 characters',
      'any.required': 'First name is required'
    }),
  paternalLastName: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Paternal last name must be at least 2 characters',
      'any.required': 'Paternal last name is required'
    }),
  maternalLastName: Joi.string().min(2).max(100).optional().allow('', null)
    .messages({
      'string.min': 'Maternal last name must be at least 2 characters'
    }),
  rut: Joi.string().custom(rutValidator, 'RUT validation').optional().allow('', null)
    .messages({
      'any.invalid': 'Invalid Chilean RUT format'
    }),
  birthDate: Joi.date().iso().max('now').optional().allow(null)
    .messages({
      'date.max': 'Birth date cannot be in the future'
    }),
  gradeApplied: Joi.string().valid(
    'PRE_KINDER', 'KINDER',
    '1_BASICO', '2_BASICO', '3_BASICO', '4_BASICO', '5_BASICO', '6_BASICO', '7_BASICO', '8_BASICO',
    '1_MEDIO', '2_MEDIO', '3_MEDIO', '4_MEDIO'
  ).optional().allow('', null)
    .messages({
      'any.only': 'Invalid grade level'
    }),
  currentSchool: Joi.string().max(200).optional().allow('', null),
  address: Joi.string().max(300).optional().allow('', null),
  email: Joi.string().email().optional().allow('', null)
    .messages({
      'string.email': 'Invalid email format'
    }),
  pais: Joi.string().max(100).optional().allow('', null).default('Chile'),
  region: Joi.string().max(100).optional().allow('', null),
  comuna: Joi.string().max(100).optional().allow('', null),
  admissionPreference: Joi.string().max(200).optional().allow('', null),
  additionalNotes: Joi.string().max(1000).optional().allow('', null)
});

// Student update schema (all fields optional except at least one must be present)
const updateStudentSchema = Joi.object({
  firstName: Joi.string().min(2).max(100),
  paternalLastName: Joi.string().min(2).max(100),
  maternalLastName: Joi.string().min(2).max(100).allow('', null),
  rut: Joi.string().custom(rutValidator, 'RUT validation').allow('', null),
  birthDate: Joi.date().iso().max('now').allow(null),
  gradeApplied: Joi.string().valid(
    'PRE_KINDER', 'KINDER',
    '1_BASICO', '2_BASICO', '3_BASICO', '4_BASICO', '5_BASICO', '6_BASICO', '7_BASICO', '8_BASICO',
    '1_MEDIO', '2_MEDIO', '3_MEDIO', '4_MEDIO'
  ).allow('', null),
  currentSchool: Joi.string().max(200).allow('', null),
  address: Joi.string().max(300).allow('', null),
  email: Joi.string().email().allow('', null),
  pais: Joi.string().max(100).allow('', null),
  region: Joi.string().max(100).allow('', null),
  comuna: Joi.string().max(100).allow('', null),
  admissionPreference: Joi.string().max(200).allow('', null),
  additionalNotes: Joi.string().max(1000).allow('', null)
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

module.exports = {
  validate,
  createApplicationSchema,
  updateApplicationSchema,
  updateStatusSchema,
  createStudentSchema,
  updateStudentSchema
};
