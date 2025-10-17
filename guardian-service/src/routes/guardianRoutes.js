const express = require('express');
const router = express.Router();
const GuardianController = require('../controllers/GuardianController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validators');

/**
 * @route   GET /api/guardians
 * @desc    Get all guardians with pagination and filters
 * @access  Private (ADMIN, COORDINATOR)
 * @query   relationship, search, page, limit
 */
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  GuardianController.getAllGuardians
);

/**
 * @route   GET /api/guardians/stats
 * @desc    Get guardian statistics
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/stats',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  GuardianController.getGuardianStats
);

/**
 * @route   GET /api/guardians/:id
 * @desc    Get guardian by ID
 * @access  Private (ADMIN, COORDINATOR, APODERADO - own data)
 */
router.get(
  '/:id',
  authenticate,
  GuardianController.getGuardianById
);

/**
 * @route   GET /api/guardians/rut/:rut
 * @desc    Get guardian by RUT
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/rut/:rut',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  GuardianController.getGuardianByRut
);

/**
 * @route   GET /api/guardians/user/:userId
 * @desc    Get guardians by user ID
 * @access  Private (ADMIN, COORDINATOR, APODERADO - own data)
 */
router.get(
  '/user/:userId',
  authenticate,
  GuardianController.getGuardiansByUserId
);

/**
 * @route   POST /api/guardians
 * @desc    Create new guardian
 * @access  Private (ADMIN, COORDINATOR)
 * @body    Guardian data
 */
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  validate('createGuardian'),
  GuardianController.createGuardian
);

/**
 * @route   PUT /api/guardians/:id
 * @desc    Update guardian
 * @access  Private (ADMIN, COORDINATOR, APODERADO - own data)
 * @body    Partial guardian data
 */
router.put(
  '/:id',
  authenticate,
  validate('updateGuardian'),
  GuardianController.updateGuardian
);

/**
 * @route   DELETE /api/guardians/:id
 * @desc    Delete guardian
 * @access  Private (ADMIN only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  GuardianController.deleteGuardian
);

module.exports = router;
