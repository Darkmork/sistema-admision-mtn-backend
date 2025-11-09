const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Evaluation = require('../models/Evaluation');
const logger = require('../utils/logger');

class EvaluationService {
  async getAllEvaluations(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { applicationId, evaluationType, status, evaluatorId } = filters;
      const offset = page * limit;

      let query = 'SELECT * FROM evaluations WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (applicationId) {
        query += ` AND application_id = $${paramIndex++}`;
        params.push(applicationId);
      }
      if (evaluationType) {
        query += ` AND evaluation_type = $${paramIndex++}`;
        params.push(evaluationType);
      }
      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
      if (evaluatorId) {
        query += ` AND evaluator_id = $${paramIndex++}`;
        params.push(evaluatorId);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM evaluations WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (applicationId) {
        countQuery += ` AND application_id = $${countIndex++}`;
        countParams.push(applicationId);
      }
      if (evaluationType) {
        countQuery += ` AND evaluation_type = $${countIndex++}`;
        countParams.push(evaluationType);
      }
      if (status) {
        countQuery += ` AND status = $${countIndex++}`;
        countParams.push(status);
      }
      if (evaluatorId) {
        countQuery += ` AND evaluator_id = $${countIndex++}`;
        countParams.push(evaluatorId);
      }

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} evaluations`);

      return {
        evaluations: Evaluation.fromDatabaseRows(result.rows),
        total,
        page,
        limit
      };
    });
  }

  async getEvaluationById(id) {
    return await mediumQueryBreaker.fire(async () => {
      const query = `
        SELECT
          e.*,
          a.id as application_id,
          a.status as application_status,
          a.submission_date,
          s.id as student_id,
          s.first_name as student_first_name,
          s.paternal_last_name as student_paternal_last_name,
          s.maternal_last_name as student_maternal_last_name,
          s.rut as student_rut,
          s.grade_applied as student_grade_applied,
          s.birth_date as student_birth_date,
          s.current_school as student_current_school,
          u.first_name as evaluator_first_name,
          u.last_name as evaluator_last_name,
          u.subject as evaluator_subject,
          f.full_name as father_name,
          f.email as father_email,
          f.phone as father_phone,
          m.full_name as mother_name,
          m.email as mother_email,
          m.phone as mother_phone
        FROM evaluations e
        LEFT JOIN applications a ON e.application_id = a.id
        LEFT JOIN students s ON a.student_id = s.id
        LEFT JOIN users u ON e.evaluator_id = u.id
        LEFT JOIN parents f ON f.id = a.father_id AND f.parent_type = 'FATHER'
        LEFT JOIN parents m ON m.id = a.mother_id AND m.parent_type = 'MOTHER'
        WHERE e.id = $1
      `;
      const result = await dbPool.query(query, [id]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const evaluation = Evaluation.fromDatabaseRow(row);

      // Add student info to response
      const enrichedEvaluation = {
        ...evaluation.toJSON(), // Use toJSON() to get plain object
        application: {
          id: row.application_id,
          status: row.application_status,
          submissionDate: row.submission_date,
          student: {
            id: row.student_id,
            firstName: row.student_first_name,
            paternalLastName: row.student_paternal_last_name,
            maternalLastName: row.student_maternal_last_name,
            rut: row.student_rut,
            gradeApplied: row.student_grade_applied,
            birthDate: row.student_birth_date,
            currentSchool: row.student_current_school
          }
        },
        evaluator: {
          firstName: row.evaluator_first_name,
          lastName: row.evaluator_last_name,
          subject: row.evaluator_subject
        },
        father: row.father_name ? {
          name: row.father_name,
          email: row.father_email,
          phone: row.father_phone
        } : null,
        mother: row.mother_name ? {
          name: row.mother_name,
          email: row.mother_email,
          phone: row.mother_phone
        } : null
      };

      logger.info(`Retrieved evaluation ${id} with student info`);
      return enrichedEvaluation;
    });
  }

  async createEvaluation(evaluationData, evaluatorId) {
    return await writeOperationBreaker.fire(async () => {
      const evaluation = new Evaluation({ ...evaluationData, evaluatorId });
      const dbData = evaluation.toDatabase();

      // Use a transaction with row-level locking to prevent race conditions
      const client = await dbPool.connect();

      try {
        await client.query('BEGIN');

        // Check for duplicate with FOR UPDATE to lock rows and prevent race conditions
        // This ensures no other transaction can insert a duplicate while we're checking
        const duplicateCheck = await client.query(
          `SELECT id, evaluator_id, status
           FROM evaluations
           WHERE application_id = $1
             AND evaluation_type = $2
             AND evaluator_id = $3
           FOR UPDATE`,
          [dbData.application_id, dbData.evaluation_type, dbData.evaluator_id]
        );

        if (duplicateCheck.rows.length > 0) {
          const existing = duplicateCheck.rows[0];
          logger.warn(
            `Duplicate evaluation attempt: application_id=${dbData.application_id}, ` +
            `type=${dbData.evaluation_type}, evaluator_id=${dbData.evaluator_id}, ` +
            `existing_id=${existing.id}`
          );
          throw new Error(
            `Ya existe una evaluación de tipo ${dbData.evaluation_type} ` +
            `del evaluador ${dbData.evaluator_id} para esta postulación ` +
            `(ID: ${existing.id}, Estado: ${existing.status})`
          );
        }

        // Insert new evaluation within the transaction
        const result = await client.query(
          `INSERT INTO evaluations (
            application_id, evaluator_id, evaluation_type, score, max_score,
            strengths, areas_for_improvement, observations, recommendations, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          RETURNING *`,
          [
            dbData.application_id, dbData.evaluator_id, dbData.evaluation_type,
            dbData.score, dbData.max_score, dbData.strengths,
            dbData.areas_for_improvement, dbData.observations,
            dbData.recommendations, 'PENDING'
          ]
        );

        await client.query('COMMIT');
        logger.info(`Created evaluation ${result.rows[0].id} with transaction lock`);
        return Evaluation.fromDatabaseRow(result.rows[0]);

      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error creating evaluation, transaction rolled back: ${error.message}`);
        throw error;
      } finally {
        client.release();
      }
    });
  }

  async updateEvaluation(id, updateData) {
    return await writeOperationBreaker.fire(async () => {
      const evaluation = new Evaluation(updateData);
      const dbData = evaluation.toDatabase();

      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(dbData).forEach(key => {
        if (dbData[key] !== undefined && dbData[key] !== null && key !== 'application_id' && key !== 'evaluator_id' && key !== 'evaluation_type') {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(dbData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE evaluations SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) return null;

      logger.info(`Updated evaluation ${id}`);
      return Evaluation.fromDatabaseRow(result.rows[0]);
    });
  }

  async deleteEvaluation(id) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query('DELETE FROM evaluations WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return null;
      logger.info(`Deleted evaluation ${id}`);
      return Evaluation.fromDatabaseRow(result.rows[0]);
    });
  }

  async getEvaluationsByApplicationId(applicationId) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM evaluations WHERE application_id = $1 ORDER BY created_at DESC',
        [applicationId]
      );
      logger.info(`Retrieved ${result.rows.length} evaluations for application ${applicationId}`);
      return Evaluation.fromDatabaseRows(result.rows);
    });
  }

  async getMyEvaluationsWithStudentInfo(evaluatorId, filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { status, evaluationType } = filters;
      const offset = page * limit;

      let query = `
        SELECT
          e.*,
          a.id as application_id,
          a.status as application_status,
          a.submission_date,
          s.id as student_id,
          s.first_name as student_first_name,
          s.paternal_last_name as student_paternal_last_name,
          s.maternal_last_name as student_maternal_last_name,
          s.rut as student_rut,
          s.grade_applied as student_grade_applied,
          s.birth_date as student_birth_date,
          s.current_school as student_current_school,
          u.first_name as evaluator_first_name,
          u.last_name as evaluator_last_name,
          u.subject as evaluator_subject
        FROM evaluations e
        LEFT JOIN applications a ON e.application_id = a.id
        LEFT JOIN students s ON a.student_id = s.id
        LEFT JOIN users u ON e.evaluator_id = u.id
        WHERE e.evaluator_id = $1
      `;
      const params = [evaluatorId];
      let paramIndex = 2;

      if (status) {
        query += ` AND e.status = $${paramIndex++}`;
        params.push(status);
      }
      if (evaluationType) {
        query += ` AND e.evaluation_type = $${paramIndex++}`;
        params.push(evaluationType);
      }

      query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      // Count query
      let countQuery = `
        SELECT COUNT(*)
        FROM evaluations e
        WHERE e.evaluator_id = $1
      `;
      const countParams = [evaluatorId];
      let countIndex = 2;

      if (status) {
        countQuery += ` AND e.status = $${countIndex++}`;
        countParams.push(status);
      }
      if (evaluationType) {
        countQuery += ` AND e.evaluation_type = $${countIndex++}`;
        countParams.push(evaluationType);
      }

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} evaluations with student info for evaluator ${evaluatorId}`);

      // Map results to include student data in a nested structure
      const evaluations = result.rows.map(row => {
        const evaluation = Evaluation.fromDatabaseRow(row);
        return {
          ...evaluation,
          application: {
            id: row.application_id,
            status: row.application_status,
            submissionDate: row.submission_date,
            student: {
              id: row.student_id,
              firstName: row.student_first_name,
              paternalLastName: row.student_paternal_last_name,
              maternalLastName: row.student_maternal_last_name,
              rut: row.student_rut,
              gradeApplied: row.student_grade_applied,
              birthDate: row.student_birth_date,
              currentSchool: row.student_current_school
            }
          },
          evaluator: {
            firstName: row.evaluator_first_name,
            lastName: row.evaluator_last_name,
            subject: row.evaluator_subject
          }
        };
      });

      return {
        evaluations,
        total,
        page,
        limit
      };
    });
  }
}

module.exports = new EvaluationService();
