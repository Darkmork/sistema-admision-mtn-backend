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

    // Get applications with ALL related data (student, parents, guardian, supporter)
    const result = await dbPool.query(
      `SELECT
        a.id, a.status, a.submission_date, a.created_at, a.updated_at, a.additional_notes,

        -- Student information
        s.id as student_id,
        s.rut as student_rut,
        s.first_name as student_first_name,
        s.paternal_last_name as student_paternal_last_name,
        s.maternal_last_name as student_maternal_last_name,
        s.grade_applied as grade_applied,
        s.birth_date as birth_date,
        s.email as student_email,
        s.address as student_address,
        s.current_school as student_current_school,
        s.admission_preference as student_admission_preference,

        -- Father information
        f.id as father_id,
        f.full_name as father_name,
        f.rut as father_rut,
        f.email as father_email,
        f.phone as father_phone,
        f.profession as father_profession,
        f.address as father_address,

        -- Mother information
        m.id as mother_id,
        m.full_name as mother_name,
        m.rut as mother_rut,
        m.email as mother_email,
        m.phone as mother_phone,
        m.profession as mother_profession,
        m.address as mother_address,

        -- Guardian information
        g.id as guardian_id,
        g.full_name as guardian_name,
        g.rut as guardian_rut,
        g.email as guardian_email,
        g.phone as guardian_phone,
        g.relationship as guardian_relationship,
        g.profession as guardian_profession,

        -- Supporter information
        sp.id as supporter_id,
        sp.full_name as supporter_name,
        sp.rut as supporter_rut,
        sp.email as supporter_email,
        sp.phone as supporter_phone,
        sp.relationship as supporter_relationship

       FROM applications a
       LEFT JOIN students s ON a.student_id = s.id
       LEFT JOIN parents f ON a.father_id = f.id AND f.parent_type = 'FATHER'
       LEFT JOIN parents m ON a.mother_id = m.id AND m.parent_type = 'MOTHER'
       LEFT JOIN guardians g ON a.guardian_id = g.id
       LEFT JOIN supporters sp ON a.supporter_id = sp.id
       WHERE a.applicant_user_id = $1
       ORDER BY a.submission_date DESC`,
      [parseInt(userId)]
    );

    console.log(`Found ${result.rows.length} applications for user ${userId}`);

    // For each application, get its documents
    const applicationsWithDocuments = await Promise.all(
      result.rows.map(async (row) => {
        // Get documents for this application
        const documentsResult = await dbPool.query(
          `SELECT
            d.id,
            d.document_type,
            d.file_name,
            d.original_name,
            d.file_path,
            d.file_size,
            d.is_required,
            d.approval_status,
            d.created_at
          FROM documents d
          WHERE d.application_id = $1
          ORDER BY d.created_at DESC`,
          [row.id]
        );

        // Transform flat data to nested structure that frontend expects
        return {
          id: row.id,
          status: row.status,
          submissionDate: row.submission_date,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          additionalNotes: row.additional_notes,
          student: {
            id: row.student_id,
            firstName: row.student_first_name,
            lastName: row.student_paternal_last_name,
            maternalLastName: row.student_maternal_last_name,
            rut: row.student_rut,
            gradeApplied: row.grade_applied,
            birthDate: row.birth_date,
            email: row.student_email,
            address: row.student_address,
            currentSchool: row.student_current_school,
            admissionPreference: row.student_admission_preference
          },
          father: row.father_id ? {
            id: row.father_id,
            fullName: row.father_name,
            rut: row.father_rut,
            email: row.father_email,
            phone: row.father_phone,
            profession: row.father_profession,
            address: row.father_address
          } : null,
          mother: row.mother_id ? {
            id: row.mother_id,
            fullName: row.mother_name,
            rut: row.mother_rut,
            email: row.mother_email,
            phone: row.mother_phone,
            profession: row.mother_profession,
            address: row.mother_address
          } : null,
          guardian: row.guardian_id ? {
            id: row.guardian_id,
            fullName: row.guardian_name,
            rut: row.guardian_rut,
            email: row.guardian_email,
            phone: row.guardian_phone,
            relationship: row.guardian_relationship,
            profession: row.guardian_profession
          } : null,
          supporter: row.supporter_id ? {
            id: row.supporter_id,
            fullName: row.supporter_name,
            rut: row.supporter_rut,
            email: row.supporter_email,
            phone: row.supporter_phone,
            relationship: row.supporter_relationship
          } : null,
          documents: documentsResult.rows.map(doc => ({
            id: doc.id,
            documentType: doc.document_type,
            fileName: doc.file_name,
            originalName: doc.original_name,
            filePath: doc.file_path,
            fileSize: doc.file_size,
            isRequired: doc.is_required,
            approvalStatus: doc.approval_status,
            uploadDate: doc.created_at
          }))
        };
      })
    );

    res.json({
      success: true,
      data: applicationsWithDocuments,
      count: applicationsWithDocuments.length
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

// ===========================
// DOCUMENTS ENDPOINTS
// ===========================

/**
 * GET /api/applications/:id/documents
 * Get all documents for a specific application
 */
router.get('/:id/documents', authenticate, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);

    // Get documents for this application
    const documentsResult = await dbPool.query(
      `SELECT
        d.id,
        d.document_type,
        d.file_name,
        d.original_name,
        d.file_path,
        d.file_size,
        d.content_type,
        d.is_required,
        d.approval_status,
        d.rejection_reason,
        d.approved_by,
        d.approval_date,
        d.created_at,
        d.updated_at
      FROM documents d
      WHERE d.application_id = $1
      ORDER BY d.created_at DESC`,
      [applicationId]
    );

    // Transform to camelCase
    const documents = documentsResult.rows.map(doc => ({
      id: doc.id,
      documentType: doc.document_type,
      fileName: doc.file_name,
      originalName: doc.original_name,
      filePath: doc.file_path,
      fileSize: doc.file_size,
      contentType: doc.content_type,
      isRequired: doc.is_required,
      approvalStatus: doc.approval_status,
      rejectionReason: doc.rejection_reason,
      approvedBy: doc.approved_by,
      approvalDate: doc.approval_date,
      uploadDate: doc.created_at,
      updatedAt: doc.updated_at
    }));

    res.json({
      success: true,
      data: documents,
      count: documents.length
    });
  } catch (error) {
    console.error('Error getting documents for application:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener documentos de la aplicación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===========================
// COMPLEMENTARY APPLICATION FORM ENDPOINTS
// ===========================

/**
 * GET /api/applications/:id/complementary-form
 * Get complementary form data for an application
 */
router.get('/:id/complementary-form', authenticate, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    const userId = req.user.userId;

    // Verify application exists and user has access
    const appCheckResult = await dbPool.query(
      `SELECT a.id, a.applicant_user_id, a.status
       FROM applications a
       WHERE a.id = $1`,
      [applicationId]
    );

    if (appCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Postulación no encontrada'
      });
    }

    const application = appCheckResult.rows[0];

    // Check if user has access (either the applicant or an admin/coordinator)
    const hasAccess =
      application.applicant_user_id === userId ||
      req.user.role === 'ADMIN' ||
      req.user.role === 'COORDINATOR';

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder a este formulario'
      });
    }

    // Get complementary form data (now stored as JSONB)
    const formResult = await dbPool.query(
      `SELECT
        id,
        application_id,
        form_data,
        is_submitted,
        submitted_at,
        created_at,
        updated_at
      FROM complementary_application_forms
      WHERE application_id = $1`,
      [applicationId]
    );

    if (formResult.rows.length === 0) {
      // No form exists yet - return 404 so frontend knows to create one
      return res.status(404).json({
        success: false,
        error: 'Formulario complementario no encontrado',
        message: 'No se ha creado un formulario complementario para esta aplicación'
      });
    }

    const formData = formResult.rows[0];

    // Return form data with JSONB form_data spread
    res.json({
      success: true,
      data: {
        id: formData.id,
        applicationId: formData.application_id,
        ...formData.form_data, // Spread the JSON data containing all form fields
        isSubmitted: formData.is_submitted,
        submittedAt: formData.submitted_at,
        createdAt: formData.created_at,
        updatedAt: formData.updated_at
      }
    });
  } catch (error) {
    console.error('Error getting complementary form:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el formulario complementario',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
router.post('/:id/complementary-form', authenticate, validateCsrf, async (req, res) => {
  try {
    const applicationId = parseInt(req.params.id);
    const userId = req.user.userId;

    // Extract isSubmitted flag and all other data as form_data JSON
    const { isSubmitted, ...formDataFields } = req.body;

    // Validate required fields in form_data
    if (!formDataFields.applicationReasons || !formDataFields.familyValues) {
      return res.status(400).json({
        success: false,
        error: 'Los campos de razones de postulación y valores familiares son obligatorios'
      });
    }

    // Verify application exists and user has access
    const appCheckResult = await dbPool.query(
      `SELECT a.id, a.applicant_user_id, a.status
       FROM applications a
       WHERE a.id = $1`,
      [applicationId]
    );

    if (appCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Postulación no encontrada'
      });
    }

    const application = appCheckResult.rows[0];

    // Only the applicant can create/update their complementary form
    if (application.applicant_user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para modificar este formulario'
      });
    }

    // Check if complementary form already exists
    const existingFormResult = await dbPool.query(
      `SELECT id, is_submitted, submitted_at FROM complementary_application_forms WHERE application_id = $1`,
      [applicationId]
    );

    // Prevent modification if form was already submitted
    if (existingFormResult.rows.length > 0 && existingFormResult.rows[0].is_submitted) {
      return res.status(403).json({
        success: false,
        error: 'Este formulario ya fue enviado y no puede ser modificado',
        submittedAt: existingFormResult.rows[0].submitted_at
      });
    }

    let formData;
    const submittedTimestamp = isSubmitted ? new Date() : null;

    if (existingFormResult.rows.length === 0) {
      // Insert new form with JSONB data
      const insertResult = await dbPool.query(
        `INSERT INTO complementary_application_forms (
          application_id,
          form_data,
          is_submitted,
          submitted_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          applicationId,
          JSON.stringify(formDataFields), // Store all form data as JSON
          isSubmitted || false,
          submittedTimestamp
        ]
      );

      formData = insertResult.rows[0];
      console.log(`Created complementary form ${formData.id} for application ${applicationId}`);
    } else {
      // Update existing form with JSONB data
      const formId = existingFormResult.rows[0].id;

      const updateResult = await dbPool.query(
        `UPDATE complementary_application_forms SET
          form_data = $1,
          is_submitted = $2,
          submitted_at = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`,
        [
          JSON.stringify(formDataFields),
          isSubmitted || false,
          submittedTimestamp,
          formId
        ]
      );

      formData = updateResult.rows[0];
      console.log(`Updated complementary form ${formId} for application ${applicationId}`);
    }

    // Return form data with JSONB spread
    res.json({
      success: true,
      message: isSubmitted
        ? 'Formulario complementario enviado exitosamente'
        : 'Formulario complementario guardado como borrador',
      data: {
        id: formData.id,
        applicationId: formData.application_id,
        ...formData.form_data, // Spread the JSON data
        isSubmitted: formData.is_submitted,
        submittedAt: formData.submitted_at,
        createdAt: formData.created_at,
        updatedAt: formData.updated_at
      }
    });
  } catch (error) {
    console.error('Error saving complementary form:', error);
    res.status(500).json({
      success: false,
      error: 'Error al guardar el formulario complementario',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
