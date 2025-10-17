const EvaluationService = require('../services/EvaluationService');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class EvaluationController {
  async getAllEvaluations(req, res) {
    try {
      const { applicationId, evaluationType, status, evaluatorId, page: pageNum = 0, limit = 10 } = req.query;
      const filters = {
        ...(applicationId && { applicationId: parseInt(applicationId) }),
        ...(evaluationType && { evaluationType }),
        ...(status && { status }),
        ...(evaluatorId && { evaluatorId: parseInt(evaluatorId) })
      };

      const result = await EvaluationService.getAllEvaluations(filters, parseInt(pageNum), parseInt(limit));

      return res.json(page(
        result.evaluations.map(e => e.toJSON()),
        result.total,
        result.page,
        result.limit
      ));
    } catch (error) {
      logger.error('Error getting evaluations:', error);
      return res.status(500).json(fail('EVAL_001', 'Failed to retrieve evaluations', error.message));
    }
  }

  async getEvaluationById(req, res) {
    try {
      const { id } = req.params;
      const evaluation = await EvaluationService.getEvaluationById(id);

      if (!evaluation) {
        return res.status(404).json(fail('EVAL_002', `Evaluation ${id} not found`));
      }

      return res.json(ok(evaluation.toJSON()));
    } catch (error) {
      logger.error(`Error getting evaluation ${req.params.id}:`, error);
      return res.status(500).json(fail('EVAL_003', 'Failed to retrieve evaluation', error.message));
    }
  }

  async createEvaluation(req, res) {
    try {
      const evaluatorId = req.user.userId;
      const evaluation = await EvaluationService.createEvaluation(req.body, evaluatorId);

      return res.status(201).json(ok(evaluation.toJSON()));
    } catch (error) {
      logger.error('Error creating evaluation:', error);
      return res.status(500).json(fail('EVAL_004', 'Failed to create evaluation', error.message));
    }
  }

  async updateEvaluation(req, res) {
    try {
      const { id } = req.params;
      const evaluation = await EvaluationService.updateEvaluation(id, req.body);

      if (!evaluation) {
        return res.status(404).json(fail('EVAL_005', `Evaluation ${id} not found`));
      }

      return res.json(ok(evaluation.toJSON()));
    } catch (error) {
      logger.error(`Error updating evaluation ${req.params.id}:`, error);
      return res.status(500).json(fail('EVAL_006', 'Failed to update evaluation', error.message));
    }
  }

  async deleteEvaluation(req, res) {
    try {
      const { id } = req.params;
      const evaluation = await EvaluationService.deleteEvaluation(id);

      if (!evaluation) {
        return res.status(404).json(fail('EVAL_007', `Evaluation ${id} not found`));
      }

      return res.json(ok({ message: 'Evaluation deleted successfully', evaluation: evaluation.toJSON() }));
    } catch (error) {
      logger.error(`Error deleting evaluation ${req.params.id}:`, error);
      return res.status(500).json(fail('EVAL_008', 'Failed to delete evaluation', error.message));
    }
  }

  async getEvaluationsByApplicationId(req, res) {
    try {
      const { applicationId } = req.params;
      const evaluations = await EvaluationService.getEvaluationsByApplicationId(applicationId);

      return res.json(ok(evaluations.map(e => e.toJSON())));
    } catch (error) {
      logger.error(`Error getting evaluations for application ${req.params.applicationId}:`, error);
      return res.status(500).json(fail('EVAL_009', 'Failed to retrieve evaluations', error.message));
    }
  }
}

module.exports = new EvaluationController();
