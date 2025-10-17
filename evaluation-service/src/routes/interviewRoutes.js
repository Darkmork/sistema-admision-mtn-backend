const express = require('express');
const router = express.Router();
const InterviewController = require('../controllers/InterviewController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, createInterviewSchema, updateInterviewSchema } = require('../middleware/validators');

// All routes require authentication
router.get('/', authenticate, InterviewController.getAllInterviews.bind(InterviewController));

router.get('/:id', authenticate, InterviewController.getInterviewById.bind(InterviewController));

router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  validate(createInterviewSchema),
  InterviewController.createInterview.bind(InterviewController)
);

router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  validate(updateInterviewSchema),
  InterviewController.updateInterview.bind(InterviewController)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  InterviewController.deleteInterview.bind(InterviewController)
);

router.get(
  '/application/:applicationId',
  authenticate,
  InterviewController.getInterviewsByApplicationId.bind(InterviewController)
);

module.exports = router;
