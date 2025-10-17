/**
 * Application Routes
 * Defines HTTP routes for application endpoints
 */

const express = require('express');
const router = express.Router();
const ApplicationController = require('../controllers/ApplicationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, createApplicationSchema, updateApplicationSchema, updateStatusSchema } = require('../middleware/validators');

// Public routes
router.get('/stats', ApplicationController.getApplicationStats.bind(ApplicationController));

// Protected routes
router.get(
  '/',
  authenticate,
  ApplicationController.getAllApplications.bind(ApplicationController)
);

router.get(
  '/:id',
  authenticate,
  ApplicationController.getApplicationById.bind(ApplicationController)
);

router.post(
  '/',
  authenticate,
  validate(createApplicationSchema),
  ApplicationController.createApplication.bind(ApplicationController)
);

router.put(
  '/:id',
  authenticate,
  validate(updateApplicationSchema),
  ApplicationController.updateApplication.bind(ApplicationController)
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  validate(updateStatusSchema),
  ApplicationController.updateApplicationStatus.bind(ApplicationController)
);

router.put(
  '/:id/archive',
  authenticate,
  requireRole('ADMIN'),
  ApplicationController.archiveApplication.bind(ApplicationController)
);

module.exports = router;
