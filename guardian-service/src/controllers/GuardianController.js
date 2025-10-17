const GuardianService = require('../services/GuardianService');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class GuardianController {
  /**
   * GET /api/guardians
   * Get all guardians with pagination and filters
   */
  async getAllGuardians(req, res) {
    try {
      const { relationship, search, page: pageNum = 0, limit = 10 } = req.query;

      const filters = {
        ...(relationship && { relationship }),
        ...(search && { search })
      };

      const result = await GuardianService.getAllGuardians(filters, parseInt(pageNum), parseInt(limit));

      return res.json(page(
        result.guardians.map(g => g.toJSON()),
        result.total,
        result.page,
        result.limit
      ));
    } catch (error) {
      logger.error('Error getting guardians:', error);
      return res.status(500).json(fail('GUARD_001', 'Failed to retrieve guardians', error.message));
    }
  }

  /**
   * GET /api/guardians/:id
   * Get guardian by ID
   */
  async getGuardianById(req, res) {
    try {
      const { id } = req.params;
      const guardian = await GuardianService.getGuardianById(id);

      if (!guardian) {
        return res.status(404).json(fail('GUARD_002', `Guardian ${id} not found`));
      }

      return res.json(ok(guardian.toJSON()));
    } catch (error) {
      logger.error(`Error getting guardian ${req.params.id}:`, error);
      return res.status(500).json(fail('GUARD_003', 'Failed to retrieve guardian', error.message));
    }
  }

  /**
   * GET /api/guardians/rut/:rut
   * Get guardian by RUT
   */
  async getGuardianByRut(req, res) {
    try {
      const { rut } = req.params;
      const guardian = await GuardianService.getGuardianByRut(rut);

      if (!guardian) {
        return res.status(404).json(fail('GUARD_004', `Guardian with RUT ${rut} not found`));
      }

      return res.json(ok(guardian.toJSON()));
    } catch (error) {
      logger.error(`Error getting guardian by RUT ${req.params.rut}:`, error);
      return res.status(500).json(fail('GUARD_005', 'Failed to retrieve guardian', error.message));
    }
  }

  /**
   * GET /api/guardians/user/:userId
   * Get guardians by user ID
   */
  async getGuardiansByUserId(req, res) {
    try {
      const { userId } = req.params;
      const guardians = await GuardianService.getGuardiansByUserId(userId);

      return res.json(ok(guardians.map(g => g.toJSON())));
    } catch (error) {
      logger.error(`Error getting guardians for user ${req.params.userId}:`, error);
      return res.status(500).json(fail('GUARD_006', 'Failed to retrieve guardians', error.message));
    }
  }

  /**
   * POST /api/guardians
   * Create new guardian
   */
  async createGuardian(req, res) {
    try {
      const guardian = await GuardianService.createGuardian(req.validatedData);

      return res.status(201).json(ok(guardian.toJSON()));
    } catch (error) {
      logger.error('Error creating guardian:', error);

      if (error.message.includes('already registered')) {
        return res.status(409).json(fail('GUARD_007', error.message));
      }

      return res.status(500).json(fail('GUARD_008', 'Failed to create guardian', error.message));
    }
  }

  /**
   * PUT /api/guardians/:id
   * Update guardian
   */
  async updateGuardian(req, res) {
    try {
      const { id } = req.params;
      const guardian = await GuardianService.updateGuardian(id, req.validatedData);

      if (!guardian) {
        return res.status(404).json(fail('GUARD_009', `Guardian ${id} not found`));
      }

      return res.json(ok(guardian.toJSON()));
    } catch (error) {
      logger.error(`Error updating guardian ${req.params.id}:`, error);
      return res.status(500).json(fail('GUARD_010', 'Failed to update guardian', error.message));
    }
  }

  /**
   * DELETE /api/guardians/:id
   * Delete guardian
   */
  async deleteGuardian(req, res) {
    try {
      const { id } = req.params;
      const guardian = await GuardianService.deleteGuardian(id);

      if (!guardian) {
        return res.status(404).json(fail('GUARD_011', `Guardian ${id} not found`));
      }

      return res.json(ok({ message: 'Guardian deleted successfully', guardian: guardian.toJSON() }));
    } catch (error) {
      logger.error(`Error deleting guardian ${req.params.id}:`, error);
      return res.status(500).json(fail('GUARD_012', 'Failed to delete guardian', error.message));
    }
  }

  /**
   * GET /api/guardians/stats
   * Get guardian statistics
   */
  async getGuardianStats(req, res) {
    try {
      const stats = await GuardianService.getGuardianStats();
      return res.json(ok(stats));
    } catch (error) {
      logger.error('Error getting guardian stats:', error);
      return res.status(500).json(fail('GUARD_013', 'Failed to retrieve statistics', error.message));
    }
  }
}

module.exports = new GuardianController();
