const InterviewService = require('../services/InterviewService');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class InterviewController {
  /**
   * GET /api/interviews
   * Implements caching for common filter combinations (5 min TTL)
   */
  async getAllInterviews(req, res) {
    const { dbPool } = require('../config/database');

    try {
      const { applicationId, interviewType, status, interviewerId, page: pageNum = 0, limit = 10 } = req.query;
      const offset = parseInt(pageNum) * parseInt(limit);

      // Build cache key from query parameters
      const cacheKey = `interviews:list:${applicationId || 'all'}:${interviewType || 'all'}:${status || 'all'}:${interviewerId || 'all'}:page${pageNum}:limit${limit}`;

      // Try to get from cache first
      const cached = req.evaluationCache.get(cacheKey);
      if (cached) {
        logger.info(`Cache HIT for interviews list: ${cacheKey}`);
        return res.json(cached);
      }

      logger.info(`Cache MISS for interviews list: ${cacheKey}`);

      // Build WHERE clause
      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (applicationId) {
        whereConditions.push(`i.application_id = $${paramIndex++}`);
        params.push(parseInt(applicationId));
      }
      if (interviewType) {
        whereConditions.push(`i.type = $${paramIndex++}`);
        params.push(interviewType);
      }
      if (status) {
        whereConditions.push(`i.status = $${paramIndex++}`);
        params.push(status);
      }
      if (interviewerId) {
        whereConditions.push(`i.interviewer_user_id = $${paramIndex++}`);
        params.push(parseInt(interviewerId));
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Query with JOINs to get student and interviewer info
      const query = `
        SELECT
          i.*,
          i.scheduled_time::text as scheduled_time_text,
          s.first_name,
          s.paternal_last_name,
          s.maternal_last_name,
          CONCAT(u.first_name, ' ', u.last_name) as interviewer_name,
          CONCAT(u2.first_name, ' ', u2.last_name) as second_interviewer_name,
          s.grade_applied
        FROM interviews i
        LEFT JOIN applications a ON i.application_id = a.id
        LEFT JOIN students s ON a.student_id = s.id
        LEFT JOIN users u ON i.interviewer_user_id = u.id
        LEFT JOIN users u2 ON i.second_interviewer_id = u2.id
        ${whereClause}
        ORDER BY i.scheduled_date DESC, i.scheduled_time DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `;
      params.push(parseInt(limit), offset);

      const result = await dbPool.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*)
        FROM interviews i
        ${whereClause}
      `;
      const countParams = params.slice(0, params.length - 2); // Remove LIMIT and OFFSET params
      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Map results to include student and interviewer names
      const interviews = result.rows.map(row => ({
        id: row.id,
        applicationId: row.application_id,
        interviewerId: row.interviewer_user_id,
        secondInterviewerId: row.second_interviewer_id,
        interviewType: row.type,
        scheduledDate: row.scheduled_date,
        scheduledTime: row.scheduled_time_text || row.scheduled_time, // Usar versión texto si existe
        duration: row.duration,
        location: row.location,
        mode: row.mode,
        status: row.status,
        notes: row.notes,
        // cancelReason no existe en la tabla interviews
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Additional fields for frontend
        studentName: `${row.first_name} ${row.paternal_last_name} ${row.maternal_last_name || ''}`.trim(),
        interviewerName: row.interviewer_name || 'No asignado',
        secondInterviewerName: row.second_interviewer_name || null,
        gradeApplied: row.grade_applied
      }));

      const response = {
        success: true,
        data: interviews,
        count: total,
        page: parseInt(pageNum),
        limit: parseInt(limit)
      };

      // Cache the result for 5 minutes
      req.evaluationCache.set(cacheKey, response, 300000);
      logger.info(`Cached interviews list: ${cacheKey}`);

      return res.json(response);
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

  /**
   * POST /api/interviews
   * Invalidates cache after creating new interview
   */
  async createInterview(req, res) {
    try {
      // Use interviewerId from request body (selected by admin)
      const interviewerId = req.body.interviewerId;

      if (!interviewerId) {
        return res.status(400).json(fail('INT_011', 'interviewerId is required'));
      }

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

      // Invalidate all cached interview lists and calendar events
      const invalidated = req.evaluationCache.invalidatePattern('interviews:*');
      logger.info(`Cache invalidated after CREATE: ${invalidated} entries`);

      return res.status(201).json(ok(interview.toJSON()));
    } catch (error) {
      logger.error('Error creating interview:', error);

      // Handle CHECK constraint violation for interview type
      if (error.code === '23514' && error.constraint === 'interviews_type_check') {
        return res.status(400).json(fail(
          'INT_012',
          'Tipo de entrevista no válido. La base de datos necesita ser actualizada para soportar CYCLE_DIRECTOR.',
          `Invalid interview type: ${req.body.type}. Database constraint needs to be updated.`
        ));
      }

      // Handle duplicate key error (unique constraint violation)
      if (error.code === '23505' && error.constraint === 'unique_interviewer_datetime') {
        return res.status(409).json(fail(
          'INT_010',
          'El entrevistador ya tiene una entrevista programada en este horario',
          'Interviewer already has an interview scheduled at this time'
        ));
      }

      return res.status(500).json(fail('INT_004', 'Failed to create interview', error.message));
    }
  }

  /**
   * PUT /api/interviews/:id
   * Invalidates cache after updating interview
   */
  async updateInterview(req, res) {
    try {
      const { id } = req.params;
      const interview = await InterviewService.updateInterview(id, req.body);

      if (!interview) {
        return res.status(404).json(fail('INT_005', `Interview ${id} not found`));
      }

      // Invalidate all cached interview lists and calendar events
      const invalidated = req.evaluationCache.invalidatePattern('interviews:*');
      logger.info(`Cache invalidated after UPDATE: ${invalidated} entries`);

      return res.json(ok(interview.toJSON()));
    } catch (error) {
      logger.error(`Error updating interview ${req.params.id}:`, error);
      return res.status(500).json(fail('INT_006', 'Failed to update interview', error.message));
    }
  }

  /**
   * DELETE /api/interviews/:id
   * Invalidates cache after deleting interview
   */
  async deleteInterview(req, res) {
    try {
      const { id } = req.params;
      const interview = await InterviewService.deleteInterview(id);

      if (!interview) {
        return res.status(404).json(fail('INT_007', `Interview ${id} not found`));
      }

      // Invalidate all cached interview lists and calendar events
      const invalidated = req.evaluationCache.invalidatePattern('interviews:*');
      logger.info(`Cache invalidated after DELETE: ${invalidated} entries`);

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

  async sendInterviewSummary(req, res) {
    const axios = require('axios');
    const { dbPool } = require('../config/database');

    try {
      const { applicationId } = req.params;

      logger.info(`Sending interview summary for application ${applicationId}`);

      // 1. Get interviews for this application
      const interviews = await InterviewService.getInterviewsByApplicationId(applicationId);

      if (!interviews || interviews.length === 0) {
        return res.status(404).json(fail('INT_012', 'No interviews found for this application'));
      }

      // 2. Get application and student details
      const appResult = await dbPool.query(`
        SELECT
          a.id as application_id,
          a.status as application_status,
          s.first_name,
          s.paternal_last_name,
          s.maternal_last_name,
          g.email as guardian_email,
          g.first_name as guardian_first_name,
          g.last_name as guardian_last_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN guardians g ON a.guardian_id = g.id
        WHERE a.id = $1
      `, [applicationId]);

      if (appResult.rows.length === 0) {
        return res.status(404).json(fail('INT_013', 'Application not found'));
      }

      const appData = appResult.rows[0];
      const studentName = `${appData.first_name} ${appData.paternal_last_name} ${appData.maternal_last_name || ''}`.trim();
      const guardianName = `${appData.guardian_first_name} ${appData.guardian_last_name}`.trim();
      const guardianEmail = appData.guardian_email;

      if (!guardianEmail) {
        return res.status(400).json(fail('INT_014', 'No guardian email found for this application'));
      }

      // 3. Get interviewer details for each interview
      const interviewsWithDetails = await Promise.all(
        interviews.map(async (interview) => {
          const interviewerResult = await dbPool.query(`
            SELECT
              CONCAT(first_name, ' ', last_name) as interviewer_name
            FROM users
            WHERE id = $1
          `, [interview.interviewerId]);

          return {
            type: interview.interviewType,
            scheduledDate: interview.scheduledDate,
            scheduledTime: interview.scheduledTime,
            duration: interview.duration,
            location: interview.location,
            mode: interview.mode,
            status: interview.status,
            interviewerName: interviewerResult.rows[0]?.interviewer_name || 'No asignado'
          };
        })
      );

      // 4. Send email via institutional email endpoint
      const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';

      const emailData = {
        guardianEmail,
        guardianName,
        studentName,
        interviews: interviewsWithDetails.map(interview => ({
          ...interview,
          scheduledDate: interview.scheduledDate ? new Date(interview.scheduledDate).toLocaleDateString('es-CL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : 'Fecha no definida',
          scheduledTime: interview.scheduledTime ? interview.scheduledTime.substring(0, 5) : 'Hora no definida'
        }))
      };

      logger.info(`Sending interview summary email to ${guardianEmail}`);

      try {
        const notificationResponse = await axios.post(
          `${notificationServiceUrl}/api/institutional-emails/interview-summary/${applicationId}`,
          emailData,
          { timeout: 10000 }
        );

        logger.info(`Interview summary email sent successfully for application ${applicationId}`);

        return res.json(ok({
          message: 'Interview summary email sent successfully',
          emailSent: true,
          recipientEmail: guardianEmail,
          interviewCount: interviews.length
        }));

      } catch (notificationError) {
        logger.error(`Error calling notification service:`, notificationError.message);

        // Return success but indicate email couldn't be sent
        return res.status(500).json(fail(
          'INT_015',
          'Failed to send email notification',
          notificationError.message
        ));
      }

    } catch (error) {
      logger.error(`Error sending interview summary for application ${req.params.applicationId}:`, error);
      return res.status(500).json(fail('INT_016', 'Failed to send interview summary', error.message));
    }
  }
}

module.exports = new InterviewController();
