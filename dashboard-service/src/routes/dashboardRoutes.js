const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authenticate, requireRole } = require('../middleware/auth');
const { dbPool } = require('../config/database');

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
 * @route   GET /api/dashboard/admin/detailed-stats
 * @desc    Get detailed admin statistics with filters
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get('/admin/detailed-stats', authenticate, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { startDate, endDate, status, grade } = req.query;

    let sqlQuery = 'SELECT * FROM applications WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      sqlQuery += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sqlQuery += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      sqlQuery += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const result = await dbPool.query(sqlQuery, params);

    const stats = {
      totalApplications: result.rows.length,
      byStatus: {},
      applications: result.rows
    };

    result.rows.forEach(row => {
      stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas detalladas',
      details: error.message
    });
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
