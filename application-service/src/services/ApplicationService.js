/**
 * Application Service
 * Business logic for application management
 */

const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Application = require('../models/Application');
const logger = require('../utils/logger');

class ApplicationService {
  /**
   * Get all applications with pagination and filters
   */
  async getAllApplications(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { status, applicationYear, guardianRUT } = filters;
      const offset = page * limit;

      // Include student data with LEFT JOIN
      let query = `
        SELECT a.*,
               s.rut as student_rut,
               s.first_name as student_first_name,
               s.paternal_last_name as student_paternal_last_name,
               s.maternal_last_name as student_maternal_last_name,
               s.grade_applied as student_grade_applied
        FROM applications a
        LEFT JOIN students s ON a.student_id = s.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND a.status = $${paramIndex++}`;
        params.push(status);
      }

      if (applicationYear) {
        query += ` AND a.application_year = $${paramIndex++}`;
        params.push(applicationYear);
      }

      if (guardianRUT) {
        query += ` AND a.guardian_rut = $${paramIndex++}`;
        params.push(guardianRUT);
      }

      query += ' AND a.is_archived = false';
      query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM applications WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (status) {
        countQuery += ` AND status = $${countIndex++}`;
        countParams.push(status);
      }

      if (applicationYear) {
        countQuery += ` AND application_year = $${countIndex++}`;
        countParams.push(applicationYear);
      }

      if (guardianRUT) {
        countQuery += ` AND guardian_rut = $${countIndex++}`;
        countParams.push(guardianRUT);
      }

      countQuery += ' AND is_archived = false';

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} applications (page ${page}, total ${total})`);

      return {
        applications: Application.fromDatabaseRows(result.rows),
        total,
        page,
        limit
      };
    });
  }

  /**
   * Get application by ID
   */
  async getApplicationById(id) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM applications WHERE id = $1 AND is_archived = false',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved application ${id}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Create new application
   */
  async createApplication(applicationData) {
    return await writeOperationBreaker.fire(async () => {
      const app = new Application(applicationData);
      const dbData = app.toDatabase();

      const result = await dbPool.query(
        `INSERT INTO applications (
          student_first_name, student_paternal_last_name, student_maternal_last_name,
          student_rut, student_date_of_birth, student_gender, grade_applied_for,
          guardian_rut, guardian_email, application_year, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          dbData.student_first_name,
          dbData.student_paternal_last_name,
          dbData.student_maternal_last_name,
          dbData.student_rut,
          dbData.student_date_of_birth,
          dbData.student_gender,
          dbData.grade_applied_for,
          dbData.guardian_rut,
          dbData.guardian_email,
          dbData.application_year,
          'PENDING'
        ]
      );

      logger.info(`Created application ${result.rows[0].id}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Update application
   */
  async updateApplication(id, updateData) {
    return await writeOperationBreaker.fire(async () => {
      const app = new Application(updateData);
      const dbData = app.toDatabase();

      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(dbData).forEach(key => {
        if (dbData[key] !== undefined && dbData[key] !== null) {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(dbData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${paramIndex} AND is_archived = false RETURNING *`;

      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated application ${id}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(id, status, notes, reviewedBy) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query(
        `UPDATE applications
         SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $4 AND is_archived = false
         RETURNING *`,
        [status, notes, reviewedBy, id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated application ${id} status to ${status}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Archive application
   */
  async archiveApplication(id) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query(
        'UPDATE applications SET is_archived = true, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Archived application ${id}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get application statistics
   */
  async getApplicationStats(applicationYear) {
    return await mediumQueryBreaker.fire(async () => {
      let query = 'SELECT status, COUNT(*) as count FROM applications WHERE is_archived = false';
      const params = [];

      if (applicationYear) {
        query += ' AND application_year = $1';
        params.push(applicationYear);
      }

      query += ' GROUP BY status';

      const result = await dbPool.query(query, params);

      const stats = {
        total: 0,
        byStatus: {}
      };

      result.rows.forEach(row => {
        const count = parseInt(row.count);
        stats.byStatus[row.status] = count;
        stats.total += count;
      });

      logger.info(`Retrieved application stats for year ${applicationYear || 'all'}`);
      return stats;
    });
  }
}

module.exports = new ApplicationService();
