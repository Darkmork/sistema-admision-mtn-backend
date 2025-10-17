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
        query += ` AND interviewer_id = $${paramIndex++}`;
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
        countQuery += ` AND interviewer_id = $${countIndex++}`;
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
          application_id, interviewer_id, interview_type, scheduled_date,
          scheduled_time, duration, location, mode, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          dbData.application_id, dbData.interviewer_id, dbData.interview_type,
          dbData.scheduled_date, dbData.scheduled_time, dbData.duration || 45,
          dbData.location, dbData.mode || 'IN_PERSON', 'SCHEDULED', dbData.notes
        ]
      );

      logger.info(`Created interview ${result.rows[0].id}`);
      return Interview.fromDatabaseRow(result.rows[0]);
    });
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
         WHERE interviewer_id = $1
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
}

module.exports = new InterviewService();
