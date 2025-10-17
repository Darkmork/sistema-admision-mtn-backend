const InterviewService = require('../services/InterviewService');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class InterviewController {
  async getAllInterviews(req, res) {
    try {
      const { applicationId, interviewType, status, interviewerId, page: pageNum = 0, limit = 10 } = req.query;
      const filters = {
        ...(applicationId && { applicationId: parseInt(applicationId) }),
        ...(interviewType && { interviewType }),
        ...(status && { status }),
        ...(interviewerId && { interviewerId: parseInt(interviewerId) })
      };

      const result = await InterviewService.getAllInterviews(filters, parseInt(pageNum), parseInt(limit));

      return res.json(page(
        result.interviews.map(i => i.toJSON()),
        result.total,
        result.page,
        result.limit
      ));
    } catch (error) {
      logger.error('Error getting interviews:', error);
      return res.status(500).json(fail('INT_001', 'Failed to retrieve interviews', error.message));
    }
  }

  async getInterviewById(req, res) {
    try {
      const { id } = req.params;
      const interview = await InterviewService.getInterviewById(id);

      if (!interview) {
        return res.status(404).json(fail('INT_002', `Interview ${id} not found`));
      }

      return res.json(ok(interview.toJSON()));
    } catch (error) {
      logger.error(`Error getting interview ${req.params.id}:`, error);
      return res.status(500).json(fail('INT_003', 'Failed to retrieve interview', error.message));
    }
  }

  async createInterview(req, res) {
    try {
      const interviewerId = req.user.userId;

      // Check interviewer availability
      const isAvailable = await InterviewService.checkInterviewerAvailability(
        interviewerId,
        req.body.scheduledDate,
        req.body.scheduledTime,
        req.body.duration || 45
      );

      if (!isAvailable) {
        return res.status(409).json(fail('INT_010', 'Interviewer is not available at the requested time'));
      }

      const interview = await InterviewService.createInterview(req.body, interviewerId);

      return res.status(201).json(ok(interview.toJSON()));
    } catch (error) {
      logger.error('Error creating interview:', error);
      return res.status(500).json(fail('INT_004', 'Failed to create interview', error.message));
    }
  }

  async updateInterview(req, res) {
    try {
      const { id } = req.params;
      const interview = await InterviewService.updateInterview(id, req.body);

      if (!interview) {
        return res.status(404).json(fail('INT_005', `Interview ${id} not found`));
      }

      return res.json(ok(interview.toJSON()));
    } catch (error) {
      logger.error(`Error updating interview ${req.params.id}:`, error);
      return res.status(500).json(fail('INT_006', 'Failed to update interview', error.message));
    }
  }

  async deleteInterview(req, res) {
    try {
      const { id } = req.params;
      const interview = await InterviewService.deleteInterview(id);

      if (!interview) {
        return res.status(404).json(fail('INT_007', `Interview ${id} not found`));
      }

      return res.json(ok({ message: 'Interview deleted successfully', interview: interview.toJSON() }));
    } catch (error) {
      logger.error(`Error deleting interview ${req.params.id}:`, error);
      return res.status(500).json(fail('INT_008', 'Failed to delete interview', error.message));
    }
  }

  async getInterviewsByApplicationId(req, res) {
    try {
      const { applicationId } = req.params;
      const interviews = await InterviewService.getInterviewsByApplicationId(applicationId);

      return res.json(ok(interviews.map(i => i.toJSON())));
    } catch (error) {
      logger.error(`Error getting interviews for application ${req.params.applicationId}:`, error);
      return res.status(500).json(fail('INT_009', 'Failed to retrieve interviews', error.message));
    }
  }
}

module.exports = new InterviewController();
