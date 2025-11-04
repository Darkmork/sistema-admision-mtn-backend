const InterviewService = require('../services/InterviewService');
const Interview = require('../models/Interview');
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
    const { dbPool } = require('../config/database');

    try {
      const { applicationId } = req.params;

      // Get interviews with interviewer names
      const result = await dbPool.query(`
        SELECT
          i.*,
          CONCAT(u1.first_name, ' ', u1.last_name) as interviewer_name,
          CONCAT(u2.first_name, ' ', u2.last_name) as second_interviewer_name
        FROM interviews i
        LEFT JOIN users u1 ON i.interviewer_user_id = u1.id
        LEFT JOIN users u2 ON i.second_interviewer_id = u2.id
        WHERE i.application_id = $1
        ORDER BY i.scheduled_date ASC, i.scheduled_time ASC
      `, [applicationId]);

      const interviews = result.rows.map(row => ({
        ...Interview.fromDatabaseRow(row).toJSON(),
        interviewerName: row.interviewer_name || 'No asignado',
        secondInterviewerName: row.second_interviewer_name || null
      }));

      return res.json(ok(interviews));
    } catch (error) {
      logger.error(`Error getting interviews for application ${req.params.applicationId}:`, error);
      return res.status(500).json(fail('INT_009', 'Failed to retrieve interviews', error.message));
    }
  }

  // Check if interview summary was already sent
  async checkSummaryStatus(req, res) {
    const { dbPool } = require('../config/database');

    try {
      const { applicationId } = req.params;

      // Get last updated timestamp of interviews for this application
      const interviewsUpdate = await dbPool.query(`
        SELECT MAX(updated_at) as last_updated
        FROM interviews
        WHERE application_id = $1
      `, [applicationId]);

      const lastInterviewUpdate = interviewsUpdate.rows[0]?.last_updated;

      // Check if summary email was sent
      const emailCheck = await dbPool.query(`
        SELECT id, sent_at, additional_data
        FROM email_notifications
        WHERE application_id = $1
          AND email_type = 'INTERVIEW_SUMMARY'
        ORDER BY sent_at DESC
        LIMIT 1
      `, [applicationId]);

      if (emailCheck.rows.length === 0) {
        return res.json(ok({
          summarySent: false,
          canResend: true,
          message: 'No se ha enviado resumen de entrevistas aún'
        }));
      }

      const lastEmail = emailCheck.rows[0];
      const emailSentAt = new Date(lastEmail.sent_at);
      const interviewUpdatedAt = lastInterviewUpdate ? new Date(lastInterviewUpdate) : null;

      // Check if interviews were modified after email was sent
      const interviewsModified = interviewUpdatedAt && interviewUpdatedAt > emailSentAt;

      return res.json(ok({
        summarySent: true,
        sentAt: emailSentAt,
        canResend: interviewsModified,
        interviewsModifiedAfterSend: interviewsModified,
        recipientsCount: lastEmail.additional_data?.recipientsCount || 0,
        message: interviewsModified
          ? 'Las entrevistas fueron modificadas después del último envío. Puede reenviar el resumen.'
          : 'Resumen ya enviado. Las entrevistas no han sido modificadas.'
      }));

    } catch (error) {
      logger.error(`Error checking summary status for application ${req.params.applicationId}:`, error);
      return res.status(500).json(fail('INT_017', 'Failed to check summary status', error.message));
    }
  }

  /**
   * PATCH /api/interviews/:id/cancel
   * Cancel an interview
   */
  async cancelInterview(req, res) {
    try {
      const { id } = req.params;
      const { cancellationReason } = req.body;
      const cancelledBy = req.user?.id; // From authentication middleware

      if (!cancelledBy) {
        return res.status(401).json(fail('INT_018', 'User not authenticated'));
      }

      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json(fail('INT_019', 'Cancellation reason is required'));
      }

      const interview = await InterviewService.cancelInterview(id, cancelledBy, cancellationReason);

      // Invalidate cached interview lists
      const invalidated = req.evaluationCache.invalidatePattern('interviews:*');
      logger.info(`Cache invalidated after CANCEL: ${invalidated} entries`);

      return res.json(ok({
        message: 'Interview cancelled successfully',
        interview: interview.toJSON()
      }));
    } catch (error) {
      logger.error(`Error cancelling interview ${req.params.id}:`, error);

      // Handle specific errors
      if (error.message.includes('not found')) {
        return res.status(404).json(fail('INT_020', 'Interview not found'));
      }
      if (error.message.includes('already cancelled')) {
        return res.status(409).json(fail('INT_021', 'Interview is already cancelled'));
      }
      if (error.message.includes('Cannot cancel a completed interview')) {
        return res.status(409).json(fail('INT_022', 'Cannot cancel a completed interview'));
      }

      return res.status(500).json(fail('INT_023', 'Failed to cancel interview', error.message));
    }
  }

  /**
   * PATCH /api/interviews/:id/reschedule
   * Reschedule an interview to a new date/time
   */
  async rescheduleInterview(req, res) {
    try {
      const { id } = req.params;
      const { newDate, newTime, reason } = req.body;
      const rescheduledBy = req.user?.id; // From authentication middleware

      if (!rescheduledBy) {
        return res.status(401).json(fail('INT_024', 'User not authenticated'));
      }

      if (!newDate || !newTime) {
        return res.status(400).json(fail('INT_025', 'New date and time are required'));
      }

      if (!reason || reason.trim() === '') {
        return res.status(400).json(fail('INT_026', 'Reschedule reason is required'));
      }

      const interview = await InterviewService.rescheduleInterview(id, newDate, newTime, rescheduledBy, reason);

      // Invalidate cached interview lists
      const invalidated = req.evaluationCache.invalidatePattern('interviews:*');
      logger.info(`Cache invalidated after RESCHEDULE: ${invalidated} entries`);

      return res.json(ok({
        message: 'Interview rescheduled successfully',
        interview: interview.toJSON()
      }));
    } catch (error) {
      logger.error(`Error rescheduling interview ${req.params.id}:`, error);

      // Handle specific errors
      if (error.message.includes('not found')) {
        return res.status(404).json(fail('INT_027', 'Interview not found'));
      }
      if (error.message.includes('Cannot reschedule a cancelled interview')) {
        return res.status(409).json(fail('INT_028', 'Cannot reschedule a cancelled interview'));
      }
      if (error.message.includes('Cannot reschedule a completed interview')) {
        return res.status(409).json(fail('INT_029', 'Cannot reschedule a completed interview'));
      }
      if (error.message.includes('not available')) {
        return res.status(409).json(fail('INT_030', 'Interviewer is not available at the requested time'));
      }

      return res.status(500).json(fail('INT_031', 'Failed to reschedule interview', error.message));
    }
  }

  // Send interview summary email to applicant and interviewers
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

      // 2. Get application, student, and applicant user details
      const appResult = await dbPool.query(`
        SELECT
          a.id as application_id,
          a.status as application_status,
          s.first_name,
          s.paternal_last_name,
          s.maternal_last_name,
          u.email as applicant_email,
          CONCAT(u.first_name, ' ', u.last_name) as applicant_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN users u ON a.applicant_user_id = u.id
        WHERE a.id = $1
      `, [applicationId]);

      if (appResult.rows.length === 0) {
        return res.status(404).json(fail('INT_013', 'Application not found'));
      }

      const appData = appResult.rows[0];
      const studentName = `${appData.first_name} ${appData.paternal_last_name} ${appData.maternal_last_name || ''}`.trim();
      const applicantName = appData.applicant_name || 'Apoderado';
      const applicantEmail = appData.applicant_email;

      if (!applicantEmail) {
        return res.status(400).json(fail('INT_014', 'No applicant email found for this application'));
      }

      // 3. Get interviewer details for each interview and collect unique interviewer IDs
      const interviewerIds = new Set();
      const interviewsWithDetails = await Promise.all(
        interviews.map(async (interview) => {
          // Add main interviewer
          if (interview.interviewerId) {
            interviewerIds.add(interview.interviewerId);
          }

          // Add second interviewer if exists
          if (interview.secondInterviewerId) {
            interviewerIds.add(interview.secondInterviewerId);
          }

          // Get main interviewer name
          const interviewerResult = await dbPool.query(`
            SELECT
              CONCAT(first_name, ' ', last_name) as interviewer_name
            FROM users
            WHERE id = $1
          `, [interview.interviewerId]);

          // Get second interviewer name if exists
          let secondInterviewerName = null;
          if (interview.secondInterviewerId) {
            const secondInterviewerResult = await dbPool.query(`
              SELECT
                CONCAT(first_name, ' ', last_name) as interviewer_name
              FROM users
              WHERE id = $1
            `, [interview.secondInterviewerId]);
            secondInterviewerName = secondInterviewerResult.rows[0]?.interviewer_name;
          }

          return {
            type: interview.interviewType,
            scheduledDate: interview.scheduledDate,
            scheduledTime: interview.scheduledTime,
            duration: interview.duration,
            location: interview.location,
            mode: interview.mode,
            status: interview.status,
            interviewerName: interviewerResult.rows[0]?.interviewer_name || 'No asignado',
            secondInterviewerName
          };
        })
      );

      // 4. Get all interviewer emails
      logger.info(`Collected ${interviewerIds.size} unique interviewer IDs: ${Array.from(interviewerIds).join(', ')}`);

      const interviewerEmailsResult = await dbPool.query(`
        SELECT id, email, CONCAT(first_name, ' ', last_name) as name
        FROM users
        WHERE id = ANY($1)
      `, [Array.from(interviewerIds)]);

      const interviewerEmails = interviewerEmailsResult.rows;
      logger.info(`Found ${interviewerEmails.length} interviewer emails: ${interviewerEmails.map(i => i.email).join(', ')}`);

      // 5. Send email via institutional email endpoint
      const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';

      const formattedInterviews = interviewsWithDetails.map(interview => ({
        ...interview,
        scheduledDate: interview.scheduledDate ? new Date(interview.scheduledDate).toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'Fecha no definida',
        scheduledTime: interview.scheduledTime ? interview.scheduledTime.substring(0, 5) : 'Hora no definida'
      }));

      const emailsSent = [];
      const emailsFailed = [];

      // Send to applicant
      try {
        logger.info(`Sending interview summary email to applicant: ${applicantEmail}`);

        await axios.post(
          `${notificationServiceUrl}/api/institutional-emails/interview-summary/${applicationId}`,
          {
            recipientEmail: applicantEmail,
            recipientName: applicantName,
            studentName,
            interviews: formattedInterviews,
            isApplicant: true
          },
          { timeout: 10000 }
        );

        emailsSent.push({ email: applicantEmail, name: applicantName, role: 'applicant' });
      } catch (error) {
        logger.error(`Failed to send email to applicant ${applicantEmail}:`, error.message);
        emailsFailed.push({ email: applicantEmail, name: applicantName, role: 'applicant', error: error.message });
      }

      // Send to all interviewers
      for (const interviewer of interviewerEmails) {
        try {
          logger.info(`Sending interview summary email to interviewer: ${interviewer.email}`);

          await axios.post(
            `${notificationServiceUrl}/api/institutional-emails/interview-summary/${applicationId}`,
            {
              recipientEmail: interviewer.email,
              recipientName: interviewer.name,
              studentName,
              interviews: formattedInterviews,
              isInterviewer: true
            },
            { timeout: 10000 }
          );

          emailsSent.push({ email: interviewer.email, name: interviewer.name, role: 'interviewer' });
        } catch (error) {
          logger.error(`Failed to send email to interviewer ${interviewer.email}:`, error.message);
          emailsFailed.push({ email: interviewer.email, name: interviewer.name, role: 'interviewer', error: error.message });
        }
      }

      logger.info(`Interview summary emails sent: ${emailsSent.length} successful, ${emailsFailed.length} failed`);

      // Register email notification in database
      if (emailsSent.length > 0) {
        try {
          const crypto = require('crypto');
          const trackingToken = crypto.randomBytes(32).toString('hex');

          await dbPool.query(`
            INSERT INTO email_notifications (
              application_id,
              recipient_email,
              email_type,
              subject,
              student_name,
              student_gender,
              target_school,
              tracking_token,
              additional_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            applicationId,
            applicantEmail, // Primary recipient
            'INTERVIEW_SUMMARY',
            `Resumen de Entrevistas - ${studentName}`,
            studentName,
            'MALE', // Default, could be retrieved from student table if needed
            'MTN', // Monte Tabor y Nazaret
            trackingToken,
            JSON.stringify({
              recipientsCount: emailsSent.length,
              recipients: emailsSent,
              interviewCount: interviews.length
            })
          ]);

          logger.info(`Email notification registered for application ${applicationId}`);
        } catch (dbError) {
          logger.error('Failed to register email notification in database:', dbError);
          // Don't fail the request, just log the error
        }
      }

      return res.json(ok({
        message: `Interview summary emails sent to ${emailsSent.length} recipients`,
        emailsSent,
        emailsFailed,
        totalRecipients: emailsSent.length + emailsFailed.length,
        interviewCount: interviews.length
      }));

    } catch (error) {
      logger.error(`Error sending interview summary for application ${req.params.applicationId}:`, error);
      return res.status(500).json(fail('INT_016', 'Failed to send interview summary', error.message));
    }
  }
}

module.exports = new InterviewController();
