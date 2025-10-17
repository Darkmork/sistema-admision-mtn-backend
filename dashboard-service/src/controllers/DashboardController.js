const DashboardService = require('../services/DashboardService');
const { ok, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class DashboardController {
  /**
   * GET /api/dashboard/stats
   * Get general dashboard statistics
   */
  async getGeneralStats(req, res) {
    try {
      const stats = await DashboardService.getGeneralStats();
      return res.json(ok(stats));
    } catch (error) {
      logger.error('Error getting general stats:', error);
      return res.status(500).json(fail('DASH_001', 'Failed to retrieve general statistics', error.message));
    }
  }

  /**
   * GET /api/dashboard/admin/stats
   * Get admin-specific detailed statistics
   */
  async getAdminStats(req, res) {
    try {
      const stats = await DashboardService.getAdminStats();
      return res.json(ok(stats));
    } catch (error) {
      logger.error('Error getting admin stats:', error);
      return res.status(500).json(fail('DASH_002', 'Failed to retrieve admin statistics', error.message));
    }
  }

  /**
   * GET /api/analytics/dashboard-metrics
   * Get comprehensive analytics dashboard metrics
   */
  async getAnalyticsDashboard(req, res) {
    try {
      const metrics = await DashboardService.getAnalyticsDashboard();
      return res.json(ok(metrics));
    } catch (error) {
      logger.error('Error getting analytics dashboard:', error);
      return res.status(500).json(fail('DASH_003', 'Failed to retrieve analytics metrics', error.message));
    }
  }

  /**
   * GET /api/analytics/status-distribution
   * Get application status distribution
   */
  async getStatusDistribution(req, res) {
    try {
      const distribution = await DashboardService.getStatusDistribution();
      return res.json(ok(distribution));
    } catch (error) {
      logger.error('Error getting status distribution:', error);
      return res.status(500).json(fail('DASH_004', 'Failed to retrieve status distribution', error.message));
    }
  }

  /**
   * GET /api/analytics/temporal-trends
   * Get temporal trends (last 30 days)
   */
  async getTemporalTrends(req, res) {
    try {
      const trends = await DashboardService.getTemporalTrends();
      return res.json(ok(trends));
    } catch (error) {
      logger.error('Error getting temporal trends:', error);
      return res.status(500).json(fail('DASH_005', 'Failed to retrieve temporal trends', error.message));
    }
  }

  /**
   * POST /api/dashboard/cache/clear
   * Clear cache (admin only)
   */
  async clearCache(req, res) {
    try {
      const { pattern } = req.body;
      const result = await DashboardService.clearCache(pattern);
      return res.json(ok(result));
    } catch (error) {
      logger.error('Error clearing cache:', error);
      return res.status(500).json(fail('DASH_006', 'Failed to clear cache', error.message));
    }
  }

  /**
   * GET /api/dashboard/cache/stats
   * Get cache statistics
   */
  async getCacheStats(req, res) {
    try {
      const stats = await DashboardService.getCacheStats();
      return res.json(ok(stats));
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return res.status(500).json(fail('DASH_007', 'Failed to retrieve cache statistics', error.message));
    }
  }
}

module.exports = new DashboardController();
