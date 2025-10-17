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
      const result = await dbPool.query('SELECT * FROM evaluations WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;
      logger.info(`Retrieved evaluation ${id}`);
      return Evaluation.fromDatabaseRow(result.rows[0]);
    });
  }

  async createEvaluation(evaluationData, evaluatorId) {
    return await writeOperationBreaker.fire(async () => {
      const evaluation = new Evaluation({ ...evaluationData, evaluatorId });
      const dbData = evaluation.toDatabase();

      const result = await dbPool.query(
        `INSERT INTO evaluations (
          application_id, evaluator_id, evaluation_type, score, max_score,
          strengths, areas_for_improvement, observations, recommendations, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          dbData.application_id, dbData.evaluator_id, dbData.evaluation_type,
          dbData.score, dbData.max_score, dbData.strengths,
          dbData.areas_for_improvement, dbData.observations,
          dbData.recommendations, 'PENDING'
        ]
      );

      logger.info(`Created evaluation ${result.rows[0].id}`);
      return Evaluation.fromDatabaseRow(result.rows[0]);
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
}

module.exports = new EvaluationService();
