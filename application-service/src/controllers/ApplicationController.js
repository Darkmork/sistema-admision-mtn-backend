/**
 * Application Controller
 * HTTP request handlers for application endpoints
 */

const ApplicationService = require('../services/ApplicationService');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class ApplicationController {
  /**
   * GET /api/applications
   */
  async getAllApplications(req, res) {
    try {
      const { status, applicationYear, guardianRUT, page: pageNum = 0, limit = 10 } = req.query;

      const filters = {
        ...(status && { status }),
        ...(applicationYear && { applicationYear: parseInt(applicationYear) }),
        ...(guardianRUT && { guardianRUT })
      };

      const result = await ApplicationService.getAllApplications(
        filters,
        parseInt(pageNum),
        parseInt(limit)
      );

      return res.json(
        page(
          result.applications.map(app => app.toJSON()),
          result.total,
          result.page,
          result.limit
        )
      );
    } catch (error) {
      logger.error('Error getting applications:', error);
      return res.status(500).json(
        fail('APP_001', 'Failed to retrieve applications', error.message)
      );
    }
  }

  /**
   * GET /api/applications/:id
   */
  async getApplicationById(req, res) {
    try {
      const { id } = req.params;
      const application = await ApplicationService.getApplicationById(id);

      if (!application) {
        return res.status(404).json(
          fail('APP_002', `Application ${id} not found`)
        );
      }

      return res.json(ok(application.toJSON()));
    } catch (error) {
      logger.error(`Error getting application ${req.params.id}:`, error);
      return res.status(500).json(
        fail('APP_003', 'Failed to retrieve application', error.message)
      );
    }
  }

  /**
   * POST /api/applications
   */
  async createApplication(req, res) {
    try {
      const application = await ApplicationService.createApplication(req.body);

      return res.status(201).json(ok(application.toJSON()));
    } catch (error) {
      logger.error('Error creating application:', error);

      if (error.code === '23505') { // Unique violation
        return res.status(409).json(
          fail('APP_004', 'Application already exists for this student RUT')
        );
      }

      return res.status(500).json(
        fail('APP_005', 'Failed to create application', error.message)
      );
    }
  }

  /**
   * PUT /api/applications/:id
   */
  async updateApplication(req, res) {
    try {
      const { id } = req.params;
      const application = await ApplicationService.updateApplication(id, req.body);

      if (!application) {
        return res.status(404).json(
          fail('APP_006', `Application ${id} not found`)
        );
      }

      return res.json(ok(application.toJSON()));
    } catch (error) {
      logger.error(`Error updating application ${req.params.id}:`, error);
      return res.status(500).json(
        fail('APP_007', 'Failed to update application', error.message)
      );
    }
  }

  /**
   * PATCH /api/applications/:id/status
   */
  async updateApplicationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const reviewedBy = req.user.userId;

      const application = await ApplicationService.updateApplicationStatus(
        id,
        status,
        notes,
        reviewedBy
      );

      if (!application) {
        return res.status(404).json(
          fail('APP_008', `Application ${id} not found`)
        );
      }

      return res.json(ok(application.toJSON()));
    } catch (error) {
      logger.error(`Error updating application status ${req.params.id}:`, error);
      return res.status(500).json(
        fail('APP_009', 'Failed to update application status', error.message)
      );
    }
  }

  /**
   * PUT /api/applications/:id/archive
   */
  async archiveApplication(req, res) {
    try {
      const { id } = req.params;
      const application = await ApplicationService.archiveApplication(id);

      if (!application) {
        return res.status(404).json(
          fail('APP_010', `Application ${id} not found`)
        );
      }

      return res.json(ok(application.toJSON()));
    } catch (error) {
      logger.error(`Error archiving application ${req.params.id}:`, error);
      return res.status(500).json(
        fail('APP_011', 'Failed to archive application', error.message)
      );
    }
  }

  /**
   * GET /api/applications/stats
   */
  async getApplicationStats(req, res) {
    try {
      const { applicationYear } = req.query;
      const stats = await ApplicationService.getApplicationStats(
        applicationYear ? parseInt(applicationYear) : null
      );

      return res.json(ok(stats));
    } catch (error) {
      logger.error('Error getting application stats:', error);
      return res.status(500).json(
        fail('APP_012', 'Failed to retrieve application statistics', error.message)
      );
    }
  }
}

module.exports = new ApplicationController();
