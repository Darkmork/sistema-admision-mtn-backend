const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Interview = require('../models/Interview');
const logger = require('../utils/logger');

class InterviewService {
  async getAllInterviews(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { applicationId, interviewType, status, interviewerId } = filters;
      const offset = page * limit;

      let query = 'SELECT * FROM interviews WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (applicationId) {
        query += ` AND application_id = $${paramIndex++}`;
        params.push(applicationId);
      }
      if (interviewType) {
        query += ` AND interview_type = $${paramIndex++}`;
        params.push(interviewType);
      }
      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
      if (interviewerId) {
        query += ` AND interviewer_user_id = $${paramIndex++}`;
        params.push(interviewerId);
      }

      query += ` ORDER BY scheduled_date ASC, scheduled_time ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM interviews WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (applicationId) {
        countQuery += ` AND application_id = $${countIndex++}`;
        countParams.push(applicationId);
      }
      if (interviewType) {
        countQuery += ` AND interview_type = $${countIndex++}`;
        countParams.push(interviewType);
      }
      if (status) {
        countQuery += ` AND status = $${countIndex++}`;
        countParams.push(status);
      }
      if (interviewerId) {
        countQuery += ` AND interviewer_user_id = $${countIndex++}`;
        countParams.push(interviewerId);
      }

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} interviews`);

      return {
        interviews: Interview.fromDatabaseRows(result.rows),
        total,
        page,
        limit
      };
    });
  }

  async getInterviewById(id) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query('SELECT * FROM interviews WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;
      logger.info(`Retrieved interview ${id}`);
      return Interview.fromDatabaseRow(result.rows[0]);
    });
  }

  async createInterview(interviewData, interviewerId) {
    return await writeOperationBreaker.fire(async () => {
      const interview = new Interview({ ...interviewData, interviewerId });
      const dbData = interview.toDatabase();

      const result = await dbPool.query(
        `INSERT INTO interviews (
          application_id, interviewer_user_id, second_interviewer_id, type, scheduled_date,
          scheduled_time, duration, location, mode, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          dbData.application_id, dbData.interviewer_user_id, interviewData.secondInterviewerId || null,
          dbData.interview_type, dbData.scheduled_date, dbData.scheduled_time, dbData.duration || 45,
          dbData.location, dbData.mode || 'IN_PERSON', 'SCHEDULED', dbData.notes
        ]
      );

      logger.info(`Created interview ${result.rows[0].id}${interviewData.secondInterviewerId ? ` with second interviewer ${interviewData.secondInterviewerId}` : ''}`);

      const createdInterview = Interview.fromDatabaseRow(result.rows[0]);

      // Crear evaluación automáticamente según el tipo de entrevista
      // IMPORTANTE: Crear una evaluación por cada participante (entrevistador principal + segundo entrevistador)
      try {
        const evaluationType = this.mapInterviewTypeToEvaluationType(dbData.interview_type);
        const interviewers = [dbData.interviewer_user_id];

        // Si hay segundo entrevistador, agregarlo a la lista
        if (interviewData.secondInterviewerId) {
          interviewers.push(interviewData.secondInterviewerId);
        }

        logger.info(`Creating ${interviewers.length} evaluation(s) of type ${evaluationType} for interview ${createdInterview.id}`);

        // Crear una evaluación para cada entrevistador
        for (const evaluatorId of interviewers) {
          try {
            await dbPool.query(
              `INSERT INTO evaluations (
                application_id, evaluator_id, evaluation_type, score, max_score,
                strengths, areas_for_improvement, observations, recommendations, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
              RETURNING *`,
              [
                dbData.application_id,
                evaluatorId,
                evaluationType,
                0,
                100,
                '',
                '',
                '',
                '',
                'PENDING'
              ]
            );

            logger.info(`Created evaluation ${evaluationType} for evaluator ${evaluatorId} in interview ${createdInterview.id}`);
          } catch (evalError) {
            // Si ya existe la evaluación para este evaluador, no es un error crítico
            if (evalError.message && evalError.message.includes('Ya existe')) {
              logger.warn(`Evaluation already exists for evaluator ${evaluatorId} in interview ${createdInterview.id}`);
            } else {
              logger.error(`Error creating evaluation for evaluator ${evaluatorId} in interview ${createdInterview.id}:`, evalError);
              // Continuar con el siguiente evaluador
            }
          }
        }

        // Si es entrevista de Director de Ciclo, crear también el CYCLE_DIRECTOR_REPORT
        // IMPORTANTE: Crear un informe para CADA participante (principal + segundo)
        if (dbData.interview_type === 'CYCLE_DIRECTOR') {
          logger.info(`Creating CYCLE_DIRECTOR_REPORT for ${interviewers.length} interviewer(s)`);

          for (const evaluatorId of interviewers) {
            try {
              logger.info(`Creating CYCLE_DIRECTOR_REPORT for evaluator ${evaluatorId}`);

              await dbPool.query(
                `INSERT INTO evaluations (
                  application_id, evaluator_id, evaluation_type, score, max_score,
                  strengths, areas_for_improvement, observations, recommendations, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                RETURNING *`,
                [
                  dbData.application_id,
                  evaluatorId,  // Cada director de ciclo participante
                  'CYCLE_DIRECTOR_REPORT',
                  0,
                  100,
                  '',
                  '',
                  `Informe Final Director de Ciclo - Entrevista #${createdInterview.id}`,
                  '',
                  'PENDING'
                ]
              );

              logger.info(`Created CYCLE_DIRECTOR_REPORT for evaluator ${evaluatorId} in interview ${createdInterview.id}`);
            } catch (reportError) {
              if (reportError.message && reportError.message.includes('Ya existe')) {
                logger.warn(`CYCLE_DIRECTOR_REPORT already exists for evaluator ${evaluatorId} in interview ${createdInterview.id}`);
              } else {
                logger.error(`Error creating CYCLE_DIRECTOR_REPORT for evaluator ${evaluatorId}:`, reportError);
              }
            }
          }
        }

        logger.info(`Completed creating evaluations for interview ${createdInterview.id}`);
      } catch (evalError) {
        logger.error(`Error in evaluation creation process for interview ${createdInterview.id}:`, evalError);
        // No lanzar el error para no bloquear la creación de la entrevista
      }

      // Enviar notificaciones por email (sin bloquear la respuesta)
      this.sendInterviewNotifications(createdInterview, interviewData).catch(err => {
        logger.error(`Error sending interview notifications for interview ${createdInterview.id}:`, err);
      });

      return createdInterview;
    });
  }

  mapInterviewTypeToEvaluationType(interviewType) {
    const mapping = {
      'FAMILY': 'FAMILY_INTERVIEW',
      'CYCLE_DIRECTOR': 'CYCLE_DIRECTOR_INTERVIEW',
      'INDIVIDUAL': 'PSYCHOLOGICAL_INTERVIEW'
    };
    return mapping[interviewType] || 'PSYCHOLOGICAL_INTERVIEW';
  }

  async sendInterviewNotifications(interview, interviewData) {
    const axios = require('axios');
    const { dbPool } = require('../config/database');

    try {
      logger.info(`Sending notifications for interview ${interview.id}`);

      // 1. Obtener información de la aplicación, estudiante y apoderado
      const appResult = await dbPool.query(`
        SELECT
          a.id as application_id,
          s.id as student_id,
          s.first_name as student_first_name,
          s.paternal_last_name as student_paternal_last_name,
          s.maternal_last_name as student_maternal_last_name,
          g.id as guardian_id,
          g.email as guardian_email,
          g.first_name as guardian_first_name,
          g.last_name as guardian_last_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN guardians g ON a.guardian_id = g.id
        WHERE a.id = $1
      `, [interview.applicationId]);

      if (appResult.rows.length === 0) {
        logger.warn(`Application ${interview.applicationId} not found for interview ${interview.id}`);
        return;
      }

      const appData = appResult.rows[0];
      const studentName = `${appData.student_first_name} ${appData.student_paternal_last_name} ${appData.student_maternal_last_name || ''}`.trim();

      // 2. Obtener información de los entrevistadores
      const interviewerIds = [interview.interviewerId];
      if (interviewData.secondInterviewerId) {
        interviewerIds.push(interviewData.secondInterviewerId);
      }

      const interviewersResult = await dbPool.query(`
        SELECT id, email, first_name, last_name, role
        FROM users
        WHERE id = ANY($1)
      `, [interviewerIds]);

      const interviewers = interviewersResult.rows;
      const mainInterviewer = interviewers.find(i => i.id === interview.interviewerId);
      const secondInterviewer = interviewers.find(i => i.id === interviewData.secondInterviewerId);

      // 3. Preparar datos comunes del email
      const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';

      const interviewTypeLabels = {
        'FAMILY': 'Entrevista Familiar',
        'STUDENT': 'Entrevista al Estudiante',
        'DIRECTOR': 'Entrevista con Director',
        'PSYCHOLOGIST': 'Entrevista Psicológica',
        'ACADEMIC': 'Entrevista Académica',
        'CYCLE_DIRECTOR': 'Entrevista Director de Ciclo'
      };

      const commonData = {
        studentName,
        interviewTypeLabel: interviewTypeLabels[interview.interviewType] || interview.interviewType,
        interviewDate: new Date(interview.scheduledDate).toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        interviewTime: interview.scheduledTime ? interview.scheduledTime.substring(0, 5) : 'No especificada',
        duration: interview.duration || 60,
        location: interview.location || 'Por confirmar',
        isVirtual: interview.mode === 'VIRTUAL',
        virtualLink: interview.mode === 'VIRTUAL' ? interviewData.virtualMeetingLink : null,
        notes: interview.notes || '',
        year: new Date().getFullYear(),
        portalUrl: process.env.PORTAL_URL || 'https://admision.mtn.cl'
      };

      // 4. Enviar email al apoderado
      if (appData.guardian_email) {
        const guardianEmail = {
          to: appData.guardian_email,
          subject: `Entrevista Programada - ${studentName}`,
          template: 'interview-scheduled',
          data: {
            ...commonData,
            isGuardian: true,
            recipientName: `${appData.guardian_first_name} ${appData.guardian_last_name}`.trim(),
            interviewer: mainInterviewer ? `${mainInterviewer.first_name} ${mainInterviewer.last_name}` : 'Por asignar',
            secondInterviewer: secondInterviewer ? `${secondInterviewer.first_name} ${secondInterviewer.last_name}` : null
          }
        };

        try {
          await axios.post(
            `${notificationServiceUrl}/api/notifications/email`,
            guardianEmail,
            { timeout: 10000 }
          );
          logger.info(`Email sent to guardian ${appData.guardian_email} for interview ${interview.id}`);
        } catch (error) {
          logger.error(`Failed to send email to guardian ${appData.guardian_email}:`, error.message);
        }
      }

      // 5. Enviar email al entrevistador principal
      if (mainInterviewer && mainInterviewer.email) {
        const interviewerEmail = {
          to: mainInterviewer.email,
          subject: `Nueva Entrevista Asignada - ${studentName}`,
          template: 'interview-scheduled',
          data: {
            ...commonData,
            isGuardian: false,
            recipientName: `${mainInterviewer.first_name} ${mainInterviewer.last_name}`,
            interviewer: `${mainInterviewer.first_name} ${mainInterviewer.last_name}`,
            secondInterviewer: secondInterviewer ? `${secondInterviewer.first_name} ${secondInterviewer.last_name}` : null
          }
        };

        try {
          await axios.post(
            `${notificationServiceUrl}/api/notifications/email`,
            interviewerEmail,
            { timeout: 10000 }
          );
          logger.info(`Email sent to interviewer ${mainInterviewer.email} for interview ${interview.id}`);
        } catch (error) {
          logger.error(`Failed to send email to interviewer ${mainInterviewer.email}:`, error.message);
        }
      }

      // 6. Enviar email al segundo entrevistador (si existe)
      if (secondInterviewer && secondInterviewer.email) {
        const secondInterviewerEmail = {
          to: secondInterviewer.email,
          subject: `Nueva Entrevista Asignada - ${studentName}`,
          template: 'interview-scheduled',
          data: {
            ...commonData,
            isGuardian: false,
            recipientName: `${secondInterviewer.first_name} ${secondInterviewer.last_name}`,
            interviewer: `${mainInterviewer.first_name} ${mainInterviewer.last_name}`,
            secondInterviewer: `${secondInterviewer.first_name} ${secondInterviewer.last_name}`
          }
        };

        try {
          await axios.post(
            `${notificationServiceUrl}/api/notifications/email`,
            secondInterviewerEmail,
            { timeout: 10000 }
          );
          logger.info(`Email sent to second interviewer ${secondInterviewer.email} for interview ${interview.id}`);
        } catch (error) {
          logger.error(`Failed to send email to second interviewer ${secondInterviewer.email}:`, error.message);
        }
      }

      logger.info(`All notifications sent successfully for interview ${interview.id}`);
    } catch (error) {
      logger.error(`Error in sendInterviewNotifications for interview ${interview.id}:`, error);
      throw error;
    }
  }

  async updateInterview(id, updateData) {
    return await writeOperationBreaker.fire(async () => {
      const interview = new Interview(updateData);
      const dbData = interview.toDatabase();

      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(dbData).forEach(key => {
        if (dbData[key] !== undefined && dbData[key] !== null && key !== 'application_id' && key !== 'interviewer_id' && key !== 'interview_type') {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(dbData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE interviews SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) return null;

      logger.info(`Updated interview ${id}`);
      return Interview.fromDatabaseRow(result.rows[0]);
    });
  }

  async deleteInterview(id) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query('DELETE FROM interviews WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return null;
      logger.info(`Deleted interview ${id}`);
      return Interview.fromDatabaseRow(result.rows[0]);
    });
  }

  async getInterviewsByApplicationId(applicationId) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM interviews WHERE application_id = $1 ORDER BY scheduled_date ASC, scheduled_time ASC',
        [applicationId]
      );
      logger.info(`Retrieved ${result.rows.length} interviews for application ${applicationId}`);
      return Interview.fromDatabaseRows(result.rows);
    });
  }

  async checkInterviewerAvailability(interviewerId, date, time, duration) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        `SELECT * FROM interviews
         WHERE interviewer_user_id = $1
         AND scheduled_date = $2
         AND status IN ('SCHEDULED', 'RESCHEDULED')
         AND (
           (scheduled_time <= $3 AND scheduled_time + (duration || ' minutes')::interval > $3)
           OR (scheduled_time < ($3::time + ($4 || ' minutes')::interval) AND scheduled_time >= $3)
         )`,
        [interviewerId, date, time, duration]
      );

      return result.rows.length === 0;
    });
  }

  /**
   * Cancel an interview
   * @param {number} interviewId - ID of the interview to cancel
   * @param {number} cancelledBy - User ID of who is cancelling
   * @param {string} cancellationReason - Reason for cancellation
   * @returns {Promise<Interview>} - Cancelled interview
   */
  async cancelInterview(interviewId, cancelledBy, cancellationReason) {
    return await writeOperationBreaker.fire(async () => {
      // Verificar que la entrevista existe y no está ya cancelada
      const checkResult = await dbPool.query(
        'SELECT * FROM interviews WHERE id = $1',
        [interviewId]
      );

      if (checkResult.rows.length === 0) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      const currentInterview = checkResult.rows[0];

      if (currentInterview.status === 'CANCELLED') {
        throw new Error(`Interview ${interviewId} is already cancelled`);
      }

      if (currentInterview.status === 'COMPLETED') {
        throw new Error(`Cannot cancel a completed interview`);
      }

      // Actualizar la entrevista a CANCELLED
      // El trigger automáticamente registrará el cambio en interview_history
      const result = await dbPool.query(
        `UPDATE interviews
         SET status = 'CANCELLED',
             cancelled_at = NOW(),
             cancelled_by = $1,
             cancellation_reason = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [cancelledBy, cancellationReason, interviewId]
      );

      logger.info(`Interview ${interviewId} cancelled by user ${cancelledBy}. Reason: ${cancellationReason}`);

      const cancelledInterview = Interview.fromDatabaseRow(result.rows[0]);

      // Liberar horarios en interviewer_schedules (si existen)
      try {
        await this.releaseInterviewerSchedule(
          currentInterview.interviewer_user_id,
          currentInterview.scheduled_date,
          currentInterview.scheduled_time
        );

        // Si hay segundo entrevistador, liberar su horario también
        if (currentInterview.second_interviewer_id) {
          await this.releaseInterviewerSchedule(
            currentInterview.second_interviewer_id,
            currentInterview.scheduled_date,
            currentInterview.scheduled_time
          );
        }
      } catch (scheduleError) {
        logger.error(`Error releasing interviewer schedules for interview ${interviewId}:`, scheduleError);
        // No fallar la cancelación si no se pueden liberar los horarios
      }

      // Enviar notificaciones (sin bloquear la respuesta)
      this.sendCancellationNotifications(cancelledInterview, currentInterview, cancellationReason).catch(err => {
        logger.error(`Error sending cancellation notifications for interview ${interviewId}:`, err);
      });

      return cancelledInterview;
    });
  }

  /**
   * Reschedule an interview to a new date/time
   * @param {number} interviewId - ID of the interview to reschedule
   * @param {string} newDate - New date (YYYY-MM-DD)
   * @param {string} newTime - New time (HH:MM:SS)
   * @param {number} rescheduledBy - User ID of who is rescheduling
   * @param {string} reason - Reason for rescheduling
   * @returns {Promise<Interview>} - Rescheduled interview
   */
  async rescheduleInterview(interviewId, newDate, newTime, rescheduledBy, reason) {
    return await writeOperationBreaker.fire(async () => {
      // Verificar que la entrevista existe y puede ser reagendada
      const checkResult = await dbPool.query(
        'SELECT * FROM interviews WHERE id = $1',
        [interviewId]
      );

      if (checkResult.rows.length === 0) {
        throw new Error(`Interview ${interviewId} not found`);
      }

      const currentInterview = checkResult.rows[0];

      if (currentInterview.status === 'CANCELLED') {
        throw new Error(`Cannot reschedule a cancelled interview`);
      }

      if (currentInterview.status === 'COMPLETED') {
        throw new Error(`Cannot reschedule a completed interview`);
      }

      // Verificar disponibilidad del entrevistador en la nueva fecha/hora
      const isAvailable = await this.checkInterviewerAvailability(
        currentInterview.interviewer_user_id,
        newDate,
        newTime,
        currentInterview.duration || 60
      );

      if (!isAvailable) {
        throw new Error(`Interviewer is not available at ${newDate} ${newTime}`);
      }

      // Si hay segundo entrevistador, verificar su disponibilidad también
      if (currentInterview.second_interviewer_id) {
        const isSecondAvailable = await this.checkInterviewerAvailability(
          currentInterview.second_interviewer_id,
          newDate,
          newTime,
          currentInterview.duration || 60
        );

        if (!isSecondAvailable) {
          throw new Error(`Second interviewer is not available at ${newDate} ${newTime}`);
        }
      }

      // Actualizar la entrevista con nueva fecha/hora y status RESCHEDULED
      // El trigger automáticamente registrará el cambio en interview_history
      const result = await dbPool.query(
        `UPDATE interviews
         SET scheduled_date = $1,
             scheduled_time = $2,
             status = 'RESCHEDULED',
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newDate, newTime, interviewId]
      );

      logger.info(`Interview ${interviewId} rescheduled to ${newDate} ${newTime} by user ${rescheduledBy}. Reason: ${reason}`);

      const rescheduledInterview = Interview.fromDatabaseRow(result.rows[0]);

      // Liberar horarios antiguos en interviewer_schedules
      try {
        await this.releaseInterviewerSchedule(
          currentInterview.interviewer_user_id,
          currentInterview.scheduled_date,
          currentInterview.scheduled_time
        );

        if (currentInterview.second_interviewer_id) {
          await this.releaseInterviewerSchedule(
            currentInterview.second_interviewer_id,
            currentInterview.scheduled_date,
            currentInterview.scheduled_time
          );
        }
      } catch (scheduleError) {
        logger.error(`Error releasing old interviewer schedules for interview ${interviewId}:`, scheduleError);
      }

      // Enviar notificaciones (sin bloquear la respuesta)
      this.sendRescheduleNotifications(rescheduledInterview, currentInterview, reason).catch(err => {
        logger.error(`Error sending reschedule notifications for interview ${interviewId}:`, err);
      });

      return rescheduledInterview;
    });
  }

  /**
   * Release interviewer schedule slot
   * @param {number} interviewerId - Interviewer user ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @param {string} time - Time (HH:MM:SS)
   */
  async releaseInterviewerSchedule(interviewerId, date, time) {
    try {
      // Marcar el horario como disponible nuevamente (is_booked = false)
      const result = await dbPool.query(
        `UPDATE interviewer_schedules
         SET is_booked = false,
             updated_at = NOW()
         WHERE interviewer_id = $1
         AND schedule_date = $2
         AND start_time = $3
         RETURNING *`,
        [interviewerId, date, time]
      );

      if (result.rows.length > 0) {
        logger.info(`Released interviewer schedule for interviewer ${interviewerId} on ${date} at ${time}`);
      } else {
        logger.warn(`No interviewer schedule found to release for interviewer ${interviewerId} on ${date} at ${time}`);
      }
    } catch (error) {
      logger.error(`Error releasing interviewer schedule:`, error);
      throw error;
    }
  }

  /**
   * Send cancellation notifications
   * @param {Interview} cancelledInterview - The cancelled interview
   * @param {Object} originalInterviewData - Original interview data from DB
   * @param {string} cancellationReason - Reason for cancellation
   */
  async sendCancellationNotifications(cancelledInterview, originalInterviewData, cancellationReason) {
    const axios = require('axios');

    try {
      logger.info(`Sending cancellation notifications for interview ${cancelledInterview.id}`);

      // 1. Obtener información de la aplicación, estudiante y apoderado
      const appResult = await dbPool.query(`
        SELECT
          a.id as application_id,
          s.id as student_id,
          s.first_name as student_first_name,
          s.paternal_last_name as student_paternal_last_name,
          s.maternal_last_name as student_maternal_last_name,
          g.id as guardian_id,
          g.email as guardian_email,
          g.first_name as guardian_first_name,
          g.last_name as guardian_last_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN guardians g ON a.guardian_id = g.id
        WHERE a.id = $1
      `, [cancelledInterview.applicationId]);

      if (appResult.rows.length === 0) {
        logger.warn(`Application ${cancelledInterview.applicationId} not found for interview ${cancelledInterview.id}`);
        return;
      }

      const appData = appResult.rows[0];
      const studentName = `${appData.student_first_name} ${appData.student_paternal_last_name} ${appData.student_maternal_last_name || ''}`.trim();

      // 2. Obtener información de los entrevistadores
      const interviewerIds = [originalInterviewData.interviewer_user_id];
      if (originalInterviewData.second_interviewer_id) {
        interviewerIds.push(originalInterviewData.second_interviewer_id);
      }

      const interviewersResult = await dbPool.query(`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id = ANY($1)
      `, [interviewerIds]);

      const interviewers = interviewersResult.rows;

      // 3. Preparar datos para el email
      const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';

      const interviewTypeLabels = {
        'FAMILY': 'Entrevista Familiar',
        'CYCLE_DIRECTOR': 'Entrevista Director de Ciclo',
        'INDIVIDUAL': 'Entrevista Psicológica'
      };

      const emailData = {
        studentName,
        interviewTypeLabel: interviewTypeLabels[originalInterviewData.interview_type] || originalInterviewData.interview_type,
        originalDate: new Date(originalInterviewData.scheduled_date).toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        originalTime: originalInterviewData.scheduled_time ? originalInterviewData.scheduled_time.substring(0, 5) : 'No especificada',
        cancellationReason,
        year: new Date().getFullYear(),
        portalUrl: process.env.PORTAL_URL || 'https://admision.mtn.cl'
      };

      // 4. Enviar email al apoderado
      if (appData.guardian_email) {
        try {
          await axios.post(
            `${notificationServiceUrl}/api/notifications/email`,
            {
              to: appData.guardian_email,
              subject: `Entrevista Cancelada - ${studentName}`,
              template: 'interview-cancelled',
              data: {
                ...emailData,
                recipientName: `${appData.guardian_first_name} ${appData.guardian_last_name}`.trim()
              }
            },
            { timeout: 10000 }
          );
          logger.info(`Cancellation email sent to guardian ${appData.guardian_email} for interview ${cancelledInterview.id}`);
        } catch (error) {
          logger.error(`Failed to send cancellation email to guardian:`, error.message);
        }
      }

      // 5. Enviar email a los entrevistadores
      for (const interviewer of interviewers) {
        if (interviewer.email) {
          try {
            await axios.post(
              `${notificationServiceUrl}/api/notifications/email`,
              {
                to: interviewer.email,
                subject: `Entrevista Cancelada - ${studentName}`,
                template: 'interview-cancelled',
                data: {
                  ...emailData,
                  recipientName: `${interviewer.first_name} ${interviewer.last_name}`
                }
              },
              { timeout: 10000 }
            );
            logger.info(`Cancellation email sent to interviewer ${interviewer.email} for interview ${cancelledInterview.id}`);
          } catch (error) {
            logger.error(`Failed to send cancellation email to interviewer ${interviewer.email}:`, error.message);
          }
        }
      }

      logger.info(`All cancellation notifications sent for interview ${cancelledInterview.id}`);
    } catch (error) {
      logger.error(`Error in sendCancellationNotifications for interview ${cancelledInterview.id}:`, error);
      throw error;
    }
  }

  /**
   * Send reschedule notifications
   * @param {Interview} rescheduledInterview - The rescheduled interview
   * @param {Object} originalInterviewData - Original interview data from DB
   * @param {string} reason - Reason for rescheduling
   */
  async sendRescheduleNotifications(rescheduledInterview, originalInterviewData, reason) {
    const axios = require('axios');

    try {
      logger.info(`Sending reschedule notifications for interview ${rescheduledInterview.id}`);

      // 1. Obtener información de la aplicación, estudiante y apoderado
      const appResult = await dbPool.query(`
        SELECT
          a.id as application_id,
          s.id as student_id,
          s.first_name as student_first_name,
          s.paternal_last_name as student_paternal_last_name,
          s.maternal_last_name as student_maternal_last_name,
          g.id as guardian_id,
          g.email as guardian_email,
          g.first_name as guardian_first_name,
          g.last_name as guardian_last_name
        FROM applications a
        JOIN students s ON a.student_id = s.id
        LEFT JOIN guardians g ON a.guardian_id = g.id
        WHERE a.id = $1
      `, [rescheduledInterview.applicationId]);

      if (appResult.rows.length === 0) {
        logger.warn(`Application ${rescheduledInterview.applicationId} not found for interview ${rescheduledInterview.id}`);
        return;
      }

      const appData = appResult.rows[0];
      const studentName = `${appData.student_first_name} ${appData.student_paternal_last_name} ${appData.student_maternal_last_name || ''}`.trim();

      // 2. Obtener información de los entrevistadores
      const interviewerIds = [originalInterviewData.interviewer_user_id];
      if (originalInterviewData.second_interviewer_id) {
        interviewerIds.push(originalInterviewData.second_interviewer_id);
      }

      const interviewersResult = await dbPool.query(`
        SELECT id, email, first_name, last_name
        FROM users
        WHERE id = ANY($1)
      `, [interviewerIds]);

      const interviewers = interviewersResult.rows;

      // 3. Preparar datos para el email
      const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';

      const interviewTypeLabels = {
        'FAMILY': 'Entrevista Familiar',
        'CYCLE_DIRECTOR': 'Entrevista Director de Ciclo',
        'INDIVIDUAL': 'Entrevista Psicológica'
      };

      const emailData = {
        studentName,
        interviewTypeLabel: interviewTypeLabels[originalInterviewData.interview_type] || originalInterviewData.interview_type,
        originalDate: new Date(originalInterviewData.scheduled_date).toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        originalTime: originalInterviewData.scheduled_time ? originalInterviewData.scheduled_time.substring(0, 5) : 'No especificada',
        newDate: new Date(rescheduledInterview.scheduledDate).toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        newTime: rescheduledInterview.scheduledTime ? rescheduledInterview.scheduledTime.substring(0, 5) : 'No especificada',
        rescheduleReason: reason,
        location: originalInterviewData.location || 'Por confirmar',
        duration: originalInterviewData.duration || 60,
        year: new Date().getFullYear(),
        portalUrl: process.env.PORTAL_URL || 'https://admision.mtn.cl'
      };

      // 4. Enviar email al apoderado
      if (appData.guardian_email) {
        try {
          await axios.post(
            `${notificationServiceUrl}/api/notifications/email`,
            {
              to: appData.guardian_email,
              subject: `Entrevista Reagendada - ${studentName}`,
              template: 'interview-rescheduled',
              data: {
                ...emailData,
                recipientName: `${appData.guardian_first_name} ${appData.guardian_last_name}`.trim()
              }
            },
            { timeout: 10000 }
          );
          logger.info(`Reschedule email sent to guardian ${appData.guardian_email} for interview ${rescheduledInterview.id}`);
        } catch (error) {
          logger.error(`Failed to send reschedule email to guardian:`, error.message);
        }
      }

      // 5. Enviar email a los entrevistadores
      for (const interviewer of interviewers) {
        if (interviewer.email) {
          try {
            await axios.post(
              `${notificationServiceUrl}/api/notifications/email`,
              {
                to: interviewer.email,
                subject: `Entrevista Reagendada - ${studentName}`,
                template: 'interview-rescheduled',
                data: {
                  ...emailData,
                  recipientName: `${interviewer.first_name} ${interviewer.last_name}`
                }
              },
              { timeout: 10000 }
            );
            logger.info(`Reschedule email sent to interviewer ${interviewer.email} for interview ${rescheduledInterview.id}`);
          } catch (error) {
            logger.error(`Failed to send reschedule email to interviewer ${interviewer.email}:`, error.message);
          }
        }
      }

      logger.info(`All reschedule notifications sent for interview ${rescheduledInterview.id}`);
    } catch (error) {
      logger.error(`Error in sendRescheduleNotifications for interview ${rescheduledInterview.id}:`, error);
      throw error;
    }
  }
}

module.exports = new InterviewService();
