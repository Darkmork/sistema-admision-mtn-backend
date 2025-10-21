const Joi = require('joi');
const { fail } = require('../utils/responseHelpers');

// Evaluation creation schema
const createEvaluationSchema = Joi.object({
  applicationId: Joi.number().integer().positive().required(),
  evaluationType: Joi.string().valid(
    'LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM',
    'CYCLE_DIRECTOR_REPORT', 'CYCLE_DIRECTOR_INTERVIEW', 'PSYCHOLOGICAL_INTERVIEW'
  ).required(),
  score: Joi.number().min(0).required(),
  maxScore: Joi.number().min(1).required(),
  strengths: Joi.string().max(1000).allow('', null),
  areasForImprovement: Joi.string().max(1000).allow('', null),
  observations: Joi.string().max(2000).allow('', null),
  recommendations: Joi.string().max(2000).allow('', null)
});

// Evaluation update schema
const updateEvaluationSchema = Joi.object({
  score: Joi.number().min(0),
  maxScore: Joi.number().min(1),
  strengths: Joi.string().max(1000).allow('', null),
  areasForImprovement: Joi.string().max(1000).allow('', null),
  observations: Joi.string().max(2000).allow('', null),
  recommendations: Joi.string().max(2000).allow('', null),
  status: Joi.string().valid('PENDING', 'COMPLETED', 'CANCELLED')
}).min(1);

// Interview creation schema
const createInterviewSchema = Joi.object({
  applicationId: Joi.number().integer().positive().required(),
  interviewerId: Joi.number().integer().positive().required(),
  secondInterviewerId: Joi.number().integer().positive().allow(null),
  type: Joi.string().valid(
    'FAMILY', 'STUDENT', 'DIRECTOR', 'PSYCHOLOGIST', 'ACADEMIC', 'CYCLE_DIRECTOR'
  ).required(),
  mode: Joi.string().valid('IN_PERSON', 'VIRTUAL', 'HYBRID').default('IN_PERSON'),
  scheduledDate: Joi.string().required(), // Changed to string to accept date format from frontend
  scheduledTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)/).required(),
  duration: Joi.number().integer().min(15).max(180).default(60),
  location: Joi.string().max(200).allow('', null),
  status: Joi.string().valid('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED').default('SCHEDULED'),
  notes: Joi.string().max(1000).allow('', null)
});

// Interview update schema
const updateInterviewSchema = Joi.object({
  scheduledDate: Joi.date().iso().min('now'),
  scheduledTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/),
  duration: Joi.number().integer().min(15).max(180),
  location: Joi.string().max(200).allow('', null),
  mode: Joi.string().valid('IN_PERSON', 'VIRTUAL', 'HYBRID'),
  status: Joi.string().valid('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'),
  notes: Joi.string().max(1000).allow('', null),
  cancelReason: Joi.string().max(500).allow('', null)
}).min(1);

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
      return res.status(400).json(fail('VALIDATION_ERROR', 'Request validation failed', details));
    }

    req[property] = value;
    next();
  };
};

module.exports = {
  validate,
  createEvaluationSchema,
  updateEvaluationSchema,
  createInterviewSchema,
  updateInterviewSchema
};
