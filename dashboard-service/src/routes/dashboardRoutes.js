const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authenticate, requireRole } = require('../middleware/auth');
const { dbPool } = require('../config/database');
const logger = require('../utils/logger');
const cache = require('../config/cache');
const { simpleQueryBreaker, mediumQueryBreaker, heavyQueryBreaker } = require('../config/circuitBreakers');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get general dashboard statistics
 * @access  Private (ADMIN, COORDINATOR, TEACHER, PSYCHOLOGIST, CYCLE_DIRECTOR)
 */
router.get(
  '/stats',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  DashboardController.getGeneralStats
);

/**
 * @route   GET /api/dashboard/admin/stats
 * @desc    Get admin-specific detailed statistics
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/admin/stats',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getAdminStats
);

/**
 * @route   GET /api/analytics/dashboard-metrics
 * @desc    Get comprehensive analytics dashboard metrics
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/dashboard-metrics',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getAnalyticsDashboard
);

/**
 * @route   GET /api/analytics/status-distribution
 * @desc    Get application status distribution
 * @access  Private (ADMIN, COORDINATOR, TEACHER)
 */
router.get(
  '/status-distribution',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'TEACHER'),
  DashboardController.getStatusDistribution
);

/**
 * @route   GET /api/analytics/temporal-trends
 * @desc    Get temporal trends (last 30 days)
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/temporal-trends',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getTemporalTrends
);

/**
 * @route   POST /api/dashboard/cache/clear
 * @desc    Clear cache
 * @access  Private (ADMIN only)
 * @body    { pattern?: string }
 */
router.post(
  '/cache/clear',
  authenticate,
  requireRole('ADMIN'),
  DashboardController.clearCache
);

/**
 * @route   GET /api/dashboard/cache/stats
 * @desc    Get cache statistics
 * @access  Private (ADMIN only)
 */
router.get(
  '/cache/stats',
  authenticate,
  requireRole('ADMIN'),
  DashboardController.getCacheStats
);

/**
 * @route   GET /api/dashboard/applicants/:id/summary
 * @desc    Get comprehensive summary for a specific applicant
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/applicants/:id/summary',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  DashboardController.getApplicantSummary
);

/**
 * @route   GET /api/dashboard/admin/detailed-stats
 * @desc    Get comprehensive detailed admin statistics with academic year filter
 * @access  Private (ADMIN, COORDINATOR)
 * @query   academicYear - Optional academic year filter (defaults to next year)
 */
router.get('/admin/detailed-stats', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  const { academicYear } = req.query;
  const yearFilter = academicYear ? parseInt(academicYear) : new Date().getFullYear() + 1;

  // Check cache first
  const cacheKey = `dashboard:detailed-stats:${yearFilter}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info(`[Cache HIT] dashboard:detailed-stats:${yearFilter}`);
    return res.json(cached);
  }
  logger.info(`[Cache MISS] dashboard:detailed-stats:${yearFilter}`);

  const client = await dbPool.connect();
  try {
    // 1. Entrevistas de la semana actual
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weeklyInterviewsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed
        FROM interviews
        WHERE scheduled_date >= $1 AND scheduled_date < $2
      `, [startOfWeek.toISOString(), endOfWeek.toISOString()])
    );

    // 2. Evaluaciones pendientes por tipo
    const pendingEvaluationsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          evaluation_type,
          COUNT(*) as count
        FROM evaluations
        WHERE status IN ('PENDING', 'IN_PROGRESS')
        GROUP BY evaluation_type
        ORDER BY count DESC
      `, [])
    );

    // 3. Tendencias mensuales de postulaciones (últimos 12 meses)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrendsQuery = await heavyQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
        FROM applications
        WHERE created_at >= $1
          AND EXTRACT(YEAR FROM created_at) = $2
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month ASC
      `, [twelveMonthsAgo.toISOString(), yearFilter])
    );

    // 4. Estadísticas por estado (para el año seleccionado)
    const statusStatsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          status,
          COUNT(*) as count
        FROM applications
        WHERE EXTRACT(YEAR FROM created_at) = $1
        GROUP BY status
      `, [yearFilter])
    );

    // 5. Años académicos disponibles
    const academicYearsQuery = await simpleQueryBreaker.fire(async () =>
      await client.query(`
        SELECT DISTINCT EXTRACT(YEAR FROM created_at) as application_year
        FROM applications
        WHERE created_at IS NOT NULL
        ORDER BY application_year DESC
      `, [])
    );

    // 6. Breakdown por grado (grade distribution)
    const gradeBreakdownQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          s.grade_applied as grade,
          COUNT(*) as count,
          COUNT(CASE WHEN a.status = 'APPROVED' THEN 1 END) as approved,
          COUNT(CASE WHEN a.status = 'REJECTED' THEN 1 END) as rejected,
          COUNT(CASE WHEN a.status = 'PENDING' THEN 1 END) as pending
        FROM applications a
        LEFT JOIN students s ON s.id = a.student_id
        WHERE EXTRACT(YEAR FROM a.created_at) = $1
          AND a.deleted_at IS NULL
        GROUP BY s.grade_applied
        ORDER BY count DESC
      `, [yearFilter])
    );

    // 7. Métricas de entrevistas
    const interviewMetricsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN i.status = 'SCHEDULED' THEN 1 END) as scheduled,
          COUNT(CASE WHEN i.status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN i.status = 'PENDING' THEN 1 END) as pending
        FROM interviews i
        JOIN applications a ON a.id = i.application_id
        WHERE EXTRACT(YEAR FROM a.created_at) = $1
      `, [yearFilter])
    );

    // 8. Métricas de evaluaciones
    const evaluationMetricsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN e.status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN e.status = 'PENDING' THEN 1 END) as pending,
          AVG(CASE WHEN e.score IS NOT NULL THEN e.score ELSE NULL END) as avg_score
        FROM evaluations e
        JOIN applications a ON a.id = e.application_id
        WHERE EXTRACT(YEAR FROM a.created_at) = $1
      `, [yearFilter])
    );

    // Construir respuesta
    const weeklyInterviews = weeklyInterviewsQuery.rows[0];

    const pendingEvaluations = {};
    pendingEvaluationsQuery.rows.forEach(row => {
      pendingEvaluations[row.evaluation_type] = parseInt(row.count);
    });

    const monthlyTrends = monthlyTrendsQuery.rows.map(row => ({
      month: row.month,
      total: parseInt(row.total),
      submitted: parseInt(row.submitted),
      approved: parseInt(row.approved),
      rejected: parseInt(row.rejected),
      underReview: 0  // Add this field for frontend compatibility
    }));

    // Status breakdown with proper mapping
    const statusBreakdown = {
      submitted: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      waitlist: 0
    };

    statusStatsQuery.rows.forEach(row => {
      const status = row.status.toLowerCase();
      statusBreakdown[status] = parseInt(row.count);
    });

    const academicYears = academicYearsQuery.rows.map(row => parseInt(row.application_year));
    const totalApps = Object.values(statusBreakdown).reduce((sum, val) => sum + val, 0);

    // Grade breakdown with status counts AND percentage
    const gradeDistribution = gradeBreakdownQuery.rows.map(row => {
      const count = parseInt(row.count);
      return {
        grade: row.grade || 'Sin especificar',
        count: count,
        approved: parseInt(row.approved),
        rejected: parseInt(row.rejected),
        pending: parseInt(row.pending),
        percentage: totalApps > 0 ? ((count / totalApps) * 100).toFixed(1) : 0
      };
    });

    // Interview metrics
    const interviewMetrics = {
      total: parseInt(interviewMetricsQuery.rows[0]?.total || 0),
      scheduled: parseInt(interviewMetricsQuery.rows[0]?.scheduled || 0),
      completed: parseInt(interviewMetricsQuery.rows[0]?.completed || 0),
      pending: parseInt(interviewMetricsQuery.rows[0]?.pending || 0),
      completionRate: interviewMetricsQuery.rows[0]?.total > 0
        ? (parseInt(interviewMetricsQuery.rows[0]?.completed || 0) / parseInt(interviewMetricsQuery.rows[0]?.total || 1)) * 100
        : 0
    };

    // Evaluation metrics
    const evaluationMetrics = {
      total: parseInt(evaluationMetricsQuery.rows[0]?.total || 0),
      completed: parseInt(evaluationMetricsQuery.rows[0]?.completed || 0),
      pending: parseInt(evaluationMetricsQuery.rows[0]?.pending || 0),
      averageScore: parseFloat(evaluationMetricsQuery.rows[0]?.avg_score || 0)
    };

    // Build complete detailed stats object
    const detailedStats = {
      academicYear: yearFilter,
      totalApplications: totalApps,
      statusBreakdown: statusBreakdown,
      gradeDistribution: gradeDistribution,
      monthlyTrends: monthlyTrends,
      interviewMetrics: interviewMetrics,
      evaluationMetrics: evaluationMetrics,
      availableYears: academicYears
    };

    // Return response
    const response = {
      success: true,
      data: detailedStats,
      ...detailedStats,  // Flatten fields to root for backward compatibility
      timestamp: new Date().toISOString()
    };

    // Cache for 5 minutes
    cache.set(cacheKey, response, 300000);
    res.json(response);

  } catch (error) {
    logger.error('Error fetching detailed dashboard stats:', error);

    if (error.message && error.message.includes('breaker')) {
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable - circuit breaker open',
        code: 'CIRCUIT_BREAKER_OPEN',
        message: 'El servicio está temporalmente sobrecargado. Por favor, intenta nuevamente en unos minutos.',
        retryAfter: 30
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas detalladas',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/dashboard/applicant-metrics
 * @desc    Get detailed metrics for each applicant with filters
 * @access  Private (ADMIN, COORDINATOR)
 * @query   academicYear, grade, status, sortBy, sortOrder
 */
router.get('/applicant-metrics', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  const { academicYear, grade, status, sortBy = 'studentName', sortOrder = 'ASC' } = req.query;
  const yearFilter = academicYear ? parseInt(academicYear) : new Date().getFullYear() + 1;

  const client = await dbPool.connect();
  try {
    // Build WHERE clause dynamically
    const conditions = ['EXTRACT(YEAR FROM a.created_at) = $1', 'a.deleted_at IS NULL'];
    const params = [yearFilter];
    let paramCount = 1;

    if (grade) {
      paramCount++;
      conditions.push(`s.grade_applied = $${paramCount}`);
      params.push(grade);
    }

    if (status) {
      paramCount++;
      conditions.push(`a.status = $${paramCount}`);
      params.push(status.toUpperCase());
    }

    const whereClause = conditions.join(' AND ');

    // Validate sortBy to prevent SQL injection
    const validSortColumns = ['studentName', 'gradeApplied', 'evaluationPassRate', 'interviewAvg', 'applicationStatus'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'studentName';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Map frontend column names to SQL expressions
    const sortMapping = {
      'studentName': `s.first_name || ' ' || s.paternal_last_name || ' ' || COALESCE(s.maternal_last_name, '')`,
      'gradeApplied': 's.grade_applied',
      'evaluationPassRate': 'evaluation_pass_rate',
      'interviewAvg': 'interview_avg_score',
      'applicationStatus': 'a.status'
    };

    // Get base applicant data
    const applicantMetricsQuery = await heavyQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          a.id as application_id,
          s.id as student_id,
          s.first_name || ' ' || s.paternal_last_name || ' ' || COALESCE(s.maternal_last_name, '') as student_name,
          s.grade_applied as grade_applied,
          a.status as application_status,
          a.created_at as application_date,
          COALESCE(g.full_name, 'No registrado') as guardian_name,
          COALESCE(g.email, 'No registrado') as guardian_email
        FROM applications a
        INNER JOIN students s ON s.id = a.student_id
        LEFT JOIN guardians g ON g.id = a.guardian_id
        WHERE ${whereClause}
        ORDER BY ${sortMapping[sortColumn]} ${order}
      `, params)
    );

    // Get detailed evaluations for each application (individual exam scores)
    const evaluationsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          e.application_id,
          e.evaluation_type,
          e.status,
          e.score,
          e.max_score
        FROM evaluations e
        WHERE e.application_id = ANY(
          SELECT id FROM applications a
          WHERE ${whereClause}
        )
      `, params)
    );

    // Get detailed family interviews (individual scores from each interviewer)
    const interviewsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          i.application_id,
          i.interview_type,
          i.status,
          i.score,
          i.result,
          u.first_name || ' ' || u.last_name as interviewer_name
        FROM interviews i
        LEFT JOIN users u ON u.id = i.interviewer_user_id
        WHERE i.interview_type = 'FAMILY'
          AND i.application_id = ANY(
            SELECT id FROM applications a
            WHERE ${whereClause}
          )
      `, params)
    );

    // Get document completion data
    const documentsQuery = await mediumQueryBreaker.fire(async () =>
      await client.query(`
        SELECT
          d.application_id,
          COUNT(*) FILTER (WHERE d.approval_status = 'APPROVED') as documents_approved,
          COUNT(*) as documents_total
        FROM documents d
        WHERE d.application_id = ANY(
          SELECT id FROM applications a
          WHERE ${whereClause}
        )
        GROUP BY d.application_id
      `, params)
    );

    // Map evaluations by application_id
    const evaluationsByApp = {};
    evaluationsQuery.rows.forEach(eval => {
      if (!evaluationsByApp[eval.application_id]) {
        evaluationsByApp[eval.application_id] = [];
      }
      evaluationsByApp[eval.application_id].push({
        type: eval.evaluation_type,
        status: eval.status,
        score: eval.score,
        maxScore: eval.max_score
      });
    });

    // Map interviews by application_id
    const interviewsByApp = {};
    interviewsQuery.rows.forEach(interview => {
      if (!interviewsByApp[interview.application_id]) {
        interviewsByApp[interview.application_id] = [];
      }
      interviewsByApp[interview.application_id].push({
        status: interview.status,
        score: interview.score,
        result: interview.result,
        interviewerName: interview.interviewer_name
      });
    });

    // Map documents by application_id
    const documentsByApp = {};
    documentsQuery.rows.forEach(doc => {
      documentsByApp[doc.application_id] = {
        approved: parseInt(doc.documents_approved || 0),
        total: parseInt(doc.documents_total || 0)
      };
    });

    // Build final response with detailed exam and interview data
    const applicants = applicantMetricsQuery.rows.map(row => {
      const appId = row.application_id;
      const evaluations = evaluationsByApp[appId] || [];
      const interviews = interviewsByApp[appId] || [];
      const docs = documentsByApp[appId] || { approved: 0, total: 0 };

      // Extract individual exam scores
      const mathExam = evaluations.find(e => e.type === 'MATHEMATICS_EXAM');
      const languageExam = evaluations.find(e => e.type === 'LANGUAGE_EXAM');
      const englishExam = evaluations.find(e => e.type === 'ENGLISH_EXAM');

      // Calculate exam completion percentage
      const totalExams = [mathExam, languageExam, englishExam].filter(e => e).length;
      const completedExams = [mathExam, languageExam, englishExam].filter(e => e && e.status === 'COMPLETED').length;
      const examCompletionRate = totalExams > 0 ? ((completedExams / totalExams) * 100).toFixed(1) : '0.0';

      // Extract family interview scores
      const completedInterviews = interviews.filter(i => i.status === 'COMPLETED' && i.score !== null);

      return {
        applicationId: appId,
        studentId: row.student_id,
        studentName: row.student_name,
        gradeApplied: row.grade_applied || 'No especificado',
        applicationStatus: row.application_status,
        applicationDate: row.application_date,
        guardianName: row.guardian_name,
        guardianEmail: row.guardian_email,

        // Detailed exam scores
        examScores: {
          mathematics: mathExam ? {
            status: mathExam.status,
            score: mathExam.score,
            maxScore: mathExam.maxScore,
            percentage: mathExam.score && mathExam.maxScore ? ((mathExam.score / mathExam.maxScore) * 100).toFixed(1) : null
          } : null,
          language: languageExam ? {
            status: languageExam.status,
            score: languageExam.score,
            maxScore: languageExam.maxScore,
            percentage: languageExam.score && languageExam.maxScore ? ((languageExam.score / languageExam.maxScore) * 100).toFixed(1) : null
          } : null,
          english: englishExam ? {
            status: englishExam.status,
            score: englishExam.score,
            maxScore: englishExam.maxScore,
            percentage: englishExam.score && englishExam.maxScore ? ((englishExam.score / englishExam.maxScore) * 100).toFixed(1) : null
          } : null,
          completionRate: examCompletionRate
        },

        // Detailed family interview scores (from each interviewer)
        familyInterviews: completedInterviews.map(i => ({
          interviewerName: i.interviewerName || 'Sin asignar',
          score: i.score,
          result: i.result
        })),

        // Document metrics
        documents: {
          approved: docs.approved,
          total: docs.total,
          completionRate: docs.total > 0 ? ((docs.approved / docs.total) * 100).toFixed(1) : '0.0'
        }
      };
    });

    res.json({
      success: true,
      data: applicants,
      meta: {
        total: applicants.length,
        academicYear: yearFilter,
        filters: { grade, status },
        sortBy: sortColumn,
        sortOrder: order
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching applicant metrics:', error);

    if (error.message && error.message.includes('breaker')) {
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable - circuit breaker open',
        code: 'CIRCUIT_BREAKER_OPEN',
        message: 'El servicio está temporalmente sobrecargado. Por favor, intenta nuevamente en unos minutos.',
        retryAfter: 30
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de postulantes',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/analytics/grade-distribution
 * @desc    Get distribution of applications by grade
 * @access  Private
 */
router.get('/grade-distribution', authenticate, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT s.grade_applied as grade, COUNT(*) as count
      FROM applications a
      JOIN students s ON a.student_id = s.id
      WHERE a.is_archived = false
      GROUP BY s.grade_applied
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        grade: row.grade,
        count: parseInt(row.count)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener distribución por grado',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/analytics/insights
 * @desc    Get insights and recommendations
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get('/insights', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const applicationsCount = await dbPool.query('SELECT COUNT(*) FROM applications WHERE is_archived = false');
    const evaluationsCount = await dbPool.query('SELECT COUNT(*) FROM evaluations WHERE status = \'COMPLETED\'');
    const avgScore = await dbPool.query('SELECT AVG(score) as avg FROM evaluations WHERE score IS NOT NULL');

    const insights = [];

    const totalApps = parseInt(applicationsCount.rows[0].count);
    const completedEvals = parseInt(evaluationsCount.rows[0].count);
    const averageScore = parseFloat(avgScore.rows[0].avg || 0);

    if (totalApps > 0 && completedEvals / totalApps < 0.5) {
      insights.push({
        type: 'warning',
        message: 'Menos del 50% de las aplicaciones tienen evaluaciones completadas',
        action: 'Revisar asignación de evaluadores'
      });
    }

    if (averageScore > 0 && averageScore < 70) {
      insights.push({
        type: 'alert',
        message: 'El promedio de evaluaciones es bajo',
        action: 'Revisar criterios de evaluación'
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'success',
        message: 'Todas las métricas están dentro de los rangos esperados',
        action: null
      });
    }

    res.json({
      success: true,
      data: {
        insights,
        metrics: {
          totalApplications: totalApps,
          completedEvaluations: completedEvals,
          averageScore: averageScore.toFixed(2)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener insights',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/analytics/evaluator-analysis
 * @desc    Get evaluator performance analysis
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get('/evaluator-analysis', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT
        u.id as evaluator_id,
        u.first_name || ' ' || u.last_name as evaluator_name,
        COUNT(e.id) as total_evaluations,
        AVG(e.score) as average_score,
        COUNT(CASE WHEN e.status = 'COMPLETED' THEN 1 END) as completed_evaluations,
        COUNT(CASE WHEN e.status = 'PENDING' THEN 1 END) as pending_evaluations
      FROM users u
      LEFT JOIN evaluations e ON u.id = e.evaluator_id
      WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_evaluations DESC
    `);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        evaluatorId: row.evaluator_id,
        evaluatorName: row.evaluator_name,
        totalEvaluations: parseInt(row.total_evaluations),
        averageScore: parseFloat(row.average_score || 0).toFixed(2),
        completedEvaluations: parseInt(row.completed_evaluations),
        pendingEvaluations: parseInt(row.pending_evaluations)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al analizar evaluadores',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/analytics/performance-metrics
 * @desc    Get overall system performance metrics
 * @access  Private (ADMIN)
 */
router.get('/performance-metrics', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const applications = await dbPool.query('SELECT COUNT(*), status FROM applications GROUP BY status');
    const evaluations = await dbPool.query('SELECT COUNT(*), status FROM evaluations GROUP BY status');
    const interviews = await dbPool.query('SELECT COUNT(*), status FROM interviews GROUP BY status');

    const avgProcessingTime = await dbPool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg_days
      FROM applications
      WHERE status IN ('APPROVED', 'REJECTED')
    `);

    res.json({
      success: true,
      data: {
        applications: {
          byStatus: applications.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          }, {})
        },
        evaluations: {
          byStatus: evaluations.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          }, {})
        },
        interviews: {
          byStatus: interviews.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          }, {})
        },
        averageProcessingDays: parseFloat(avgProcessingTime.rows[0]?.avg_days || 0).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener métricas de rendimiento',
      details: error.message
    });
  }
});

module.exports = router;
