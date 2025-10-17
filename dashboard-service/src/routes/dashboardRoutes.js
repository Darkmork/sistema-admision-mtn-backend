const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get general dashboard statistics
 * @access  Private (ADMIN, COORDINATOR, TEACHER, PSYCHOLOGIST, CYCLE_DIRECTOR)
 */
router.get(
  '/stats',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  DashboardController.getGeneralStats
);

/**
 * @route   GET /api/dashboard/admin/stats
 * @desc    Get admin-specific detailed statistics
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/admin/stats',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getAdminStats
);

/**
 * @route   GET /api/analytics/dashboard-metrics
 * @desc    Get comprehensive analytics dashboard metrics
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/metrics',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getAnalyticsDashboard
);

/**
 * @route   GET /api/analytics/status-distribution
 * @desc    Get application status distribution
 * @access  Private (ADMIN, COORDINATOR, TEACHER)
 */
router.get(
  '/status-distribution',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'TEACHER'),
  DashboardController.getStatusDistribution
);

/**
 * @route   GET /api/analytics/temporal-trends
 * @desc    Get temporal trends (last 30 days)
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/temporal-trends',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getTemporalTrends
);

/**
 * @route   POST /api/dashboard/cache/clear
 * @desc    Clear cache
 * @access  Private (ADMIN only)
 * @body    { pattern?: string }
 */
router.post(
  '/cache/clear',
  authenticate,
  requireRole('ADMIN'),
  DashboardController.clearCache
);

/**
 * @route   GET /api/dashboard/cache/stats
 * @desc    Get cache statistics
 * @access  Private (ADMIN only)
 */
router.get(
  '/cache/stats',
  authenticate,
  requireRole('ADMIN'),
  DashboardController.getCacheStats
);

module.exports = router;
