const express = require('express');
const router = express.Router();
const EvaluationController = require('../controllers/EvaluationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, createEvaluationSchema, updateEvaluationSchema } = require('../middleware/validators');

// All routes require authentication
router.get('/', authenticate, EvaluationController.getAllEvaluations.bind(EvaluationController));

router.get('/:id', authenticate, EvaluationController.getEvaluationById.bind(EvaluationController));

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  validate(createEvaluationSchema),
  EvaluationController.createEvaluation.bind(EvaluationController)
);

router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  validate(updateEvaluationSchema),
  EvaluationController.updateEvaluation.bind(EvaluationController)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  EvaluationController.deleteEvaluation.bind(EvaluationController)
);

router.get(
  '/application/:applicationId',
  authenticate,
  EvaluationController.getEvaluationsByApplicationId.bind(EvaluationController)
);

module.exports = router;
