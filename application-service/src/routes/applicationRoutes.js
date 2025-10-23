/**
 * Application Routes
 * Defines HTTP routes for application endpoints
 */

const express = require('express');
const router = express.Router();
const ApplicationController = require('../controllers/ApplicationController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { validate, createApplicationSchema, updateApplicationSchema, updateStatusSchema } = require('../middleware/validators');
const { dbPool } = require('../config/database');

// Public routes
router.get('/stats', ApplicationController.getApplicationStats.bind(ApplicationController));

// GET /api/applications/public/all - Public endpoint (MUST BE BEFORE other routes)
router.get('/public/all', async (req, res) => {
  try {
    const { page: pageNum = 0, limit = 10 } = req.query;

    const offset = parseInt(pageNum) * parseInt(limit);
    const result = await dbPool.query(
      `SELECT a.id, a.status, a.submission_date, a.created_at, a.updated_at,
              s.rut as student_rut, s.first_name as student_first_name,
              s.paternal_last_name as student_paternal_last_name,
              s.maternal_last_name as student_maternal_last_name
       FROM applications a
       LEFT JOIN students s ON a.student_id = s.id
       ORDER BY a.submission_date DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const countResult = await dbPool.query(
      'SELECT COUNT(*) as total FROM applications'
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(pageNum),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener aplicaciones públicas',
      details: error.message
    });
  }
});

// GET /api/applications/statistics - Alias for /stats (MUST BE BEFORE /:id)
router.get('/statistics', ApplicationController.getApplicationStats.bind(ApplicationController));

// GET /api/applications/recent - Get recent applications (MUST BE BEFORE /:id)
router.get('/recent', authenticate, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await dbPool.query(
      `SELECT * FROM applications
      
       ORDER BY submission_date DESC
       LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener aplicaciones recientes'
    });
  }
});

// GET /api/applications/requiring-documents - Applications needing documents (MUST BE BEFORE /:id)
router.get('/requiring-documents', authenticate, async (req, res) => {
  try {

    const result = await dbPool.query(
      `SELECT * FROM applications
       WHERE status = 'PENDING_DOCUMENTS' OR status = 'INCOMPLETE'
       ORDER BY submission_date ASC`
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener aplicaciones que requieren documentos'
    });
  }
});

// GET /api/applications/search - Search applications (MUST BE BEFORE /:id)
router.get('/search', authenticate, async (req, res) => {
  try {
    const { query, status } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un término de búsqueda'
      });
    }

    const searchTerm = `%${query.toLowerCase()}%`;
    let sqlQuery = `
      SELECT a.*, s.rut as student_rut, s.first_name as student_first_name,
             s.paternal_last_name as student_paternal_last_name, s.maternal_last_name as student_maternal_last_name
      FROM applications a
      LEFT JOIN students s ON a.student_id = s.id
      WHERE (
        LOWER(s.first_name) LIKE $1 OR
        LOWER(s.paternal_last_name) LIKE $1 OR LOWER(s.maternal_last_name) LIKE $1 OR
        LOWER(s.rut) LIKE $1 OR
        CAST(a.id AS TEXT) LIKE $1
      )
    `;

    const params = [searchTerm];
    let paramIndex = 2;

    if (status) {
      sqlQuery += ` AND a.status = $${paramIndex}`;
      params.push(status.toUpperCase());
      paramIndex++;
    }

    sqlQuery += ' ORDER BY a.submission_date DESC LIMIT 50';

    const result = await dbPool.query(sqlQuery, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      query: query
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al buscar aplicaciones',
      details: error.message
    });
  }
});

// GET /api/applications/export - Export applications (MUST BE BEFORE /:id)
router.get('/export', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { status, format = 'json' } = req.query;

    let sqlQuery = `SELECT a.*, s.rut as student_rut, s.first_name as student_first_name,
                           s.paternal_last_name as student_paternal_last_name, s.maternal_last_name as student_maternal_last_name
                    FROM applications a
                    LEFT JOIN students s ON a.student_id = s.id
                   `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sqlQuery += ` AND a.status = $${paramIndex}`;
      params.push(status.toUpperCase());
      paramIndex++;
    }

    sqlQuery += ' ORDER BY a.submission_date DESC';

    const result = await dbPool.query(sqlQuery, params);

    if (format === 'csv') {
      // Simple CSV export
      const headers = Object.keys(result.rows[0] || {}).join(',');
      const rows = result.rows.map(row =>
        Object.values(row).map(val => `"${val}"`).join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
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
      error: 'Error al exportar aplicaciones'
    });
  }
});

// GET /api/applications/status/:status - Filter by status (MUST BE BEFORE /:id)
router.get('/status/:status', authenticate, async (req, res) => {
  try {
    const { status } = req.params;
    const { page: pageNum = 0, limit = 10 } = req.query;

    const offset = parseInt(pageNum) * parseInt(limit);

    const result = await dbPool.query(
      `SELECT * FROM applications
       WHERE status = $1
       ORDER BY submission_date DESC
       LIMIT $2 OFFSET $3`,
      [status.toUpperCase(), parseInt(limit), offset]
    );

    const countResult = await dbPool.query(
      'SELECT COUNT(*) as total FROM applications WHERE status = $1',
      [status.toUpperCase()]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(pageNum),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al filtrar aplicaciones por estado'
    });
  }
});

// GET /api/applications/user/:userId - Get applications by user (MUST BE BEFORE /:id)
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await dbPool.query(
      `SELECT * FROM applications
       WHERE guardian_id = $1
       ORDER BY submission_date DESC`,
      [parseInt(userId)]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener aplicaciones del usuario'
    });
  }
});

// GET /api/applications/my-applications - Get applications for logged-in user (MUST BE BEFORE /:id)
router.get('/my-applications', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get applications where the user is the applicant_user_id OR guardian
    const result = await dbPool.query(
      `SELECT a.id, a.status, a.submission_date, a.created_at, a.updated_at,
              s.rut as student_rut, s.first_name as student_first_name,
              s.paternal_last_name as student_paternal_last_name,
              s.maternal_last_name as student_maternal_last_name,
              s.grade_applied as grade_applied,
              s.birth_date as birth_date
       FROM applications a
       LEFT JOIN students s ON a.student_id = s.id
       WHERE a.applicant_user_id = $1
       ORDER BY a.submission_date DESC`,
      [parseInt(userId)]
    );

    console.log(`Found ${result.rows.length} applications for user ${userId}`);

    // Transform flat data to nested structure that frontend expects
    const transformedApplications = result.rows.map(row => ({
      id: row.id,
      status: row.status,
      submissionDate: row.submission_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      student: {
        firstName: row.student_first_name,
        lastName: row.student_paternal_last_name,
        maternalLastName: row.student_maternal_last_name,
        rut: row.student_rut,
        gradeApplied: row.grade_applied,
        birthDate: row.birth_date || null
      }
    }));

    res.json({
      success: true,
      data: transformedApplications,
      count: transformedApplications.length
    });
  } catch (error) {
    console.error('Error getting my applications:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tus aplicaciones',
      details: error.message
    });
  }
});

// GET /api/applications/for-evaluation/:evaluatorId - Applications assigned to evaluator (MUST BE BEFORE /:id)
router.get('/for-evaluation/:evaluatorId', authenticate, async (req, res) => {
  try {
    const { evaluatorId } = req.params;

    // Get applications that have evaluations assigned to this evaluator
    const result = await dbPool.query(
      `SELECT DISTINCT a.*
       FROM applications a
       INNER JOIN evaluations e ON e.application_id = a.id
       WHERE e.evaluator_id = $1
       AND a.status IN ('IN_REVIEW', 'PENDING_INTERVIEW', 'INTERVIEW_SCHEDULED')
       ORDER BY a.submission_date DESC`,
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
      error: 'Error al obtener aplicaciones para evaluación'
    });
  }
});

// GET /api/applications/special-category/:category - Filter by special category (MUST BE BEFORE /:id)
router.get('/special-category/:category', authenticate, async (req, res) => {
  try {
    const { category } = req.params;

    // Note: special_category column doesn't exist in current schema
    // Returning empty result for now - needs schema update if feature is required
    res.json({
      success: true,
      data: [],
      count: 0,
      category: category,
      message: 'Special category filtering not implemented - schema update required'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al filtrar por categoría especial',
      details: error.message
    });
  }
});

// POST /api/applications/bulk/update-status - Bulk update status (MUST BE BEFORE /:id routes)
router.post('/bulk/update-status', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { applicationIds, status, notes } = req.body;

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de IDs de aplicaciones'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un estado'
      });
    }

    const placeholders = applicationIds.map((_, i) => `$${i + 1}`).join(',');

    const result = await dbPool.query(
      `UPDATE applications
       SET status = $${applicationIds.length + 1},
           additional_notes = $${applicationIds.length + 2},
           updated_at = NOW()
       WHERE id IN (${placeholders})
       RETURNING *`,
      [...applicationIds, status.toUpperCase(), notes || null]
    );

    // Invalidate all cached application lists (bulk update)
    const invalidated = req.applicationCache.invalidatePattern('applications:list:*');
    console.log(`Cache invalidated after BULK UPDATE: ${invalidated} entries`);

    res.json({
      success: true,
      message: `${result.rows.length} aplicaciones actualizadas`,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al actualizar aplicaciones en lote'
    });
  }
});

// Protected routes
router.get(
  '/',
  authenticate,
  ApplicationController.getAllApplications.bind(ApplicationController)
);

router.get(
  '/:id',
  authenticate,
  ApplicationController.getApplicationById.bind(ApplicationController)
);

router.post(
  '/',
  authenticate,
  validateCsrf,
  validate(createApplicationSchema),
  ApplicationController.createApplication.bind(ApplicationController)
);

router.put(
  '/:id',
  authenticate,
  validateCsrf,
  validate(updateApplicationSchema),
  ApplicationController.updateApplication.bind(ApplicationController)
);

router.patch(
  '/:id/status',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'COORDINATOR'),
  validate(updateStatusSchema),
  ApplicationController.updateApplicationStatus.bind(ApplicationController)
);

router.put(
  '/:id/archive',
  authenticate,
  validateCsrf,
  requireRole('ADMIN'),
  ApplicationController.archiveApplication.bind(ApplicationController)
);

// POST /api/applications/cache/clear - Clear application cache (admin only)
router.post('/cache/clear', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const invalidated = req.applicationCache.invalidatePattern('applications:list:*');
    console.log(`Cache manually cleared: ${invalidated} entries`);

    res.json({
      success: true,
      message: `Cache cleared successfully`,
      entriesCleared: invalidated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al limpiar cache'
    });
  }
});

// DELETE /api/applications/:id - Delete application (admin only)
router.delete(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await dbPool.query(
        'DELETE FROM applications WHERE id = $1 RETURNING *',
        [parseInt(id)]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Aplicación ${id} no encontrada`
        });
      }

      // Invalidate all cached application lists (application deleted)
      const invalidated = req.applicationCache.invalidatePattern('applications:list:*');
      console.log(`Cache invalidated after DELETE: ${invalidated} entries`);

      res.json({
        success: true,
        message: 'Aplicación eliminada exitosamente',
        data: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al eliminar aplicación'
      });
    }
  }
);

module.exports = router;
