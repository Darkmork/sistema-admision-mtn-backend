const express = require('express');
const router = express.Router();
const EvaluationController = require('../controllers/EvaluationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { validate, createEvaluationSchema, updateEvaluationSchema } = require('../middleware/validators');
const { dbPool } = require('../config/database');

// All routes require authentication
router.get('/', authenticate, EvaluationController.getAllEvaluations.bind(EvaluationController));

// GET /api/evaluations/statistics - Get statistics (MUST BE BEFORE /:id)
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const totalResult = await dbPool.query('SELECT COUNT(*) as count FROM evaluations');
    const byStatusResult = await dbPool.query(`
      SELECT status, COUNT(*) as count
      FROM evaluations
      GROUP BY status
    `);
    const byTypeResult = await dbPool.query(`
      SELECT evaluation_type, COUNT(*) as count
      FROM evaluations
      GROUP BY evaluation_type
    `);

    const avgScoreResult = await dbPool.query(`
      SELECT AVG(score) as avg_score
      FROM evaluations
      WHERE score IS NOT NULL
    `);

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].count),
        byStatus: byStatusResult.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        byType: byTypeResult.rows.reduce((acc, row) => {
          acc[row.evaluation_type] = parseInt(row.count);
          return acc;
        }, {}),
        averageScore: parseFloat(avgScoreResult.rows[0].avg_score || 0).toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      details: error.message
    });
  }
});

// GET /api/evaluations/assignments - Get all assignments (MUST BE BEFORE /:id)
router.get('/assignments', authenticate, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT e.*, u.first_name as evaluator_first_name, u.last_name as evaluator_last_name,
             a.id as application_id
      FROM evaluations e
      LEFT JOIN users u ON e.evaluator_id = u.id
      LEFT JOIN applications a ON e.application_id = a.id
      WHERE e.status IN ('PENDING', 'IN_PROGRESS')
      ORDER BY e.evaluation_date ASC
    `);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener asignaciones',
      details: error.message
    });
  }
});

// GET /api/evaluations/export - Export evaluations (MUST BE BEFORE /:id)
router.get('/export', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { status, type, format = 'json' } = req.query;

    let sqlQuery = `SELECT e.*, u.first_name as evaluator_first_name, u.last_name as evaluator_last_name
                    FROM evaluations e
                    LEFT JOIN users u ON e.evaluator_id = u.id
                    WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sqlQuery += ` AND e.status = $${paramIndex}`;
      params.push(status.toUpperCase());
      paramIndex++;
    }

    if (type) {
      sqlQuery += ` AND e.evaluation_type = $${paramIndex}`;
      params.push(type.toUpperCase());
      paramIndex++;
    }

    sqlQuery += ' ORDER BY e.created_at DESC';

    const result = await dbPool.query(sqlQuery, params);

    if (format === 'csv') {
      const headers = Object.keys(result.rows[0] || {}).join(',');
      const rows = result.rows.map(row =>
        Object.values(row).map(val => `"${val}"`).join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=evaluations.csv');
      res.send(`${headers}\n${rows}`);
    } else {
      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
        exportDate: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al exportar evaluaciones',
      details: error.message
    });
  }
});

// GET /api/evaluations/application/:applicationId (moved from bottom, MUST BE BEFORE /:id)
router.get('/application/:applicationId', authenticate, EvaluationController.getEvaluationsByApplicationId.bind(EvaluationController));

// GET /api/evaluations/evaluator/:evaluatorId - Get by evaluator (MUST BE BEFORE /:id)
router.get('/evaluator/:evaluatorId', authenticate, async (req, res) => {
  try {
    const { evaluatorId } = req.params;

    const result = await dbPool.query(
      `SELECT e.*, a.id as application_id
       FROM evaluations e
       LEFT JOIN applications a ON e.application_id = a.id
       WHERE e.evaluator_id = $1
       ORDER BY e.created_at DESC`,
      [parseInt(evaluatorId)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener evaluaciones del evaluador',
      details: error.message
    });
  }
});

// GET /api/evaluations/evaluator/:id/pending - Pending evaluations for evaluator (MUST BE BEFORE /:id)
router.get('/evaluator/:id/pending', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(
      `SELECT e.*, a.id as application_id
       FROM evaluations e
       LEFT JOIN applications a ON e.application_id = a.id
       WHERE e.evaluator_id = $1 AND e.status IN ('PENDING', 'IN_PROGRESS')
       ORDER BY e.evaluation_date ASC`,
      [parseInt(id)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener evaluaciones pendientes',
      details: error.message
    });
  }
});

// GET /api/evaluations/evaluator/:id/completed - Completed evaluations for evaluator (MUST BE BEFORE /:id)
router.get('/evaluator/:id/completed', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(
      `SELECT e.*, a.id as application_id
       FROM evaluations e
       LEFT JOIN applications a ON e.application_id = a.id
       WHERE e.evaluator_id = $1 AND e.status IN ('COMPLETED', 'REVIEWED', 'APPROVED')
       ORDER BY e.completion_date DESC`,
      [parseInt(id)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener evaluaciones completadas',
      details: error.message
    });
  }
});

// GET /api/evaluations/type/:type - Filter by type (MUST BE BEFORE /:id)
router.get('/type/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;

    const result = await dbPool.query(
      `SELECT e.*, a.id as application_id
       FROM evaluations e
       LEFT JOIN applications a ON e.application_id = a.id
       WHERE e.evaluation_type = $1
       ORDER BY e.created_at DESC`,
      [type.toUpperCase()]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al filtrar por tipo',
      details: error.message
    });
  }
});

// GET /api/evaluations/subject/:subject - Filter by subject (MUST BE BEFORE /:id)
router.get('/subject/:subject', authenticate, async (req, res) => {
  try {
    const { subject } = req.params;

    // Map subject to evaluation_type
    const typeMapping = {
      'LANGUAGE': 'LANGUAGE_EXAM',
      'MATHEMATICS': 'MATHEMATICS_EXAM',
      'ENGLISH': 'ENGLISH_EXAM'
    };

    const evaluationType = typeMapping[subject.toUpperCase()] || subject.toUpperCase();

    const result = await dbPool.query(
      `SELECT e.*, a.id as application_id
       FROM evaluations e
       LEFT JOIN applications a ON e.application_id = a.id
       WHERE e.evaluation_type = $1
       ORDER BY e.created_at DESC`,
      [evaluationType]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      subject: subject
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al filtrar por materia',
      details: error.message
    });
  }
});

// Get my evaluations (must be before /:id route)
router.get('/my-evaluations', authenticate, EvaluationController.getMyEvaluations.bind(EvaluationController));

router.get('/:id', authenticate, EvaluationController.getEvaluationById.bind(EvaluationController));

router.post(
  '/',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  validate(createEvaluationSchema),
  EvaluationController.createEvaluation.bind(EvaluationController)
);

router.put(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  validate(updateEvaluationSchema),
  EvaluationController.updateEvaluation.bind(EvaluationController)
);

router.delete(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN'),
  EvaluationController.deleteEvaluation.bind(EvaluationController)
);

// POST /api/evaluations/:id/complete - Mark evaluation as complete
router.post('/:id/complete', authenticate, validateCsrf, requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { score, recommendations, observations } = req.body;

    const result = await dbPool.query(
      `UPDATE evaluations
       SET status = 'COMPLETED',
           completion_date = NOW(),
           score = $1,
           recommendations = $2,
           observations = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [score || null, recommendations || null, observations || null, parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Evaluación ${id} no encontrada`
      });
    }

    res.json({
      success: true,
      message: 'Evaluación completada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al completar evaluación',
      details: error.message
    });
  }
});

// POST /api/evaluations/:id/assign - Assign evaluation to evaluator
router.post('/:id/assign', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { evaluatorId, evaluationDate } = req.body;

    if (!evaluatorId) {
      return res.status(400).json({
        success: false,
        error: 'evaluatorId es requerido'
      });
    }

    const result = await dbPool.query(
      `UPDATE evaluations
       SET evaluator_id = $1,
           evaluation_date = $2,
           status = 'PENDING',
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [parseInt(evaluatorId), evaluationDate || null, parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Evaluación ${id} no encontrada`
      });
    }

    res.json({
      success: true,
      message: 'Evaluación asignada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al asignar evaluación',
      details: error.message
    });
  }
});

// POST /api/evaluations/:id/reschedule - Reschedule evaluation
router.post('/:id/reschedule', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST'), async (req, res) => {
  try {
    const { id } = req.params;
    const { evaluationDate } = req.body;

    if (!evaluationDate) {
      return res.status(400).json({
        success: false,
        error: 'evaluationDate es requerido'
      });
    }

    const result = await dbPool.query(
      `UPDATE evaluations
       SET evaluation_date = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [evaluationDate, parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Evaluación ${id} no encontrada`
      });
    }

    res.json({
      success: true,
      message: 'Evaluación reprogramada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al reprogramar evaluación',
      details: error.message
    });
  }
});

// POST /api/evaluations/:id/cancel - Cancel evaluation
router.post('/:id/cancel', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await dbPool.query(
      `UPDATE evaluations
       SET status = 'CANCELLED',
           observations = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason || 'Cancelada', parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Evaluación ${id} no encontrada`
      });
    }

    res.json({
      success: true,
      message: 'Evaluación cancelada exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al cancelar evaluación',
      details: error.message
    });
  }
});

// POST /api/evaluations/bulk/assign - Bulk assign evaluations
router.post('/bulk/assign', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { evaluationIds, evaluatorId, evaluationDate } = req.body;

    if (!evaluationIds || !Array.isArray(evaluationIds) || evaluationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs de evaluaciones'
      });
    }

    if (!evaluatorId) {
      return res.status(400).json({
        success: false,
        error: 'evaluatorId es requerido'
      });
    }

    const placeholders = evaluationIds.map((_, i) => `$${i + 1}`).join(',');

    const result = await dbPool.query(
      `UPDATE evaluations
       SET evaluator_id = $${evaluationIds.length + 1},
           evaluation_date = $${evaluationIds.length + 2},
           status = 'PENDING',
           updated_at = NOW()
       WHERE id IN (${placeholders})
       RETURNING *`,
      [...evaluationIds, parseInt(evaluatorId), evaluationDate || null]
    );

    res.json({
      success: true,
      message: `${result.rows.length} evaluaciones asignadas`,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al asignar evaluaciones en lote',
      details: error.message
    });
  }
});

module.exports = router;
