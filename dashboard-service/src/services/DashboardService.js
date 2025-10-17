const { dbPool } = require('../config/database');
const { simpleQueryBreaker, mediumQueryBreaker, heavyQueryBreaker } = require('../config/circuitBreakers');
const cache = require('../config/cache');
const logger = require('../utils/logger');

class DashboardService {
  /**
   * Get general dashboard statistics (cached)
   * Includes: total applications, by status, recent applications
   */
  async getGeneralStats() {
    const cacheKey = 'dashboard:stats:general';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return await mediumQueryBreaker.fire(async () => {
      const stats = {};

      // Total applications
      const totalResult = await dbPool.query('SELECT COUNT(*) FROM applications');
      stats.totalApplications = parseInt(totalResult.rows[0].count);

      // Applications by status
      const statusResult = await dbPool.query(
        `SELECT status, COUNT(*) as count
         FROM applications
         GROUP BY status
         ORDER BY count DESC`
      );
      stats.applicationsByStatus = statusResult.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count)
      }));

      // Applications by grade
      const gradeResult = await dbPool.query(
        `SELECT grade_applying_for as grade, COUNT(*) as count
         FROM applications
         GROUP BY grade_applying_for
         ORDER BY grade`
      );
      stats.applicationsByGrade = gradeResult.rows.map(row => ({
        grade: row.grade,
        count: parseInt(row.count)
      }));

      // Recent applications (last 7 days)
      const recentResult = await dbPool.query(
        `SELECT COUNT(*)
         FROM applications
         WHERE created_at >= NOW() - INTERVAL '7 days'`
      );
      stats.recentApplications = parseInt(recentResult.rows[0].count);

      // Total interviews
      const interviewsResult = await dbPool.query('SELECT COUNT(*) FROM interviews');
      stats.totalInterviews = parseInt(interviewsResult.rows[0].count);

      // Interviews by status
      const interviewStatusResult = await dbPool.query(
        `SELECT status, COUNT(*) as count
         FROM interviews
         GROUP BY status`
      );
      stats.interviewsByStatus = interviewStatusResult.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count)
      }));

      // Total evaluations
      const evaluationsResult = await dbPool.query('SELECT COUNT(*) FROM evaluations');
      stats.totalEvaluations = parseInt(evaluationsResult.rows[0].count);

      logger.info('Retrieved general dashboard statistics');

      const ttl = parseInt(process.env.CACHE_TTL_STATS || '300000', 10);
      cache.set(cacheKey, stats, ttl);

      return stats;
    });
  }

  /**
   * Get admin-specific detailed statistics (cached)
   * Includes conversion rates, average scores, completion rates
   */
  async getAdminStats() {
    const cacheKey = 'dashboard:stats:admin';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return await mediumQueryBreaker.fire(async () => {
      const stats = {};

      // Conversion rate (submitted -> approved)
      const conversionResult = await dbPool.query(
        `SELECT
          COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved
         FROM applications`
      );
      const submitted = parseInt(conversionResult.rows[0].submitted);
      const approved = parseInt(conversionResult.rows[0].approved);
      stats.conversionRate = submitted > 0 ? ((approved / submitted) * 100).toFixed(2) : 0;

      // Average evaluation scores by type
      const avgScoresResult = await dbPool.query(
        `SELECT evaluation_type, AVG(score) as avg_score, AVG(max_score) as avg_max_score
         FROM evaluations
         WHERE score IS NOT NULL
         GROUP BY evaluation_type`
      );
      stats.averageScores = avgScoresResult.rows.map(row => ({
        evaluationType: row.evaluation_type,
        averageScore: parseFloat(row.avg_score).toFixed(2),
        averageMaxScore: parseFloat(row.avg_max_score).toFixed(2)
      }));

      // Document completion rate
      const docCompletionResult = await dbPool.query(
        `SELECT
          COUNT(*) as total_applications,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as completed
         FROM applications`
      );
      const total = parseInt(docCompletionResult.rows[0].total_applications);
      const completed = parseInt(docCompletionResult.rows[0].completed);
      stats.documentCompletionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;

      // Interview completion rate
      const interviewCompletionResult = await dbPool.query(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed
         FROM interviews`
      );
      const totalInterviews = parseInt(interviewCompletionResult.rows[0].total);
      const completedInterviews = parseInt(interviewCompletionResult.rows[0].completed);
      stats.interviewCompletionRate = totalInterviews > 0
        ? ((completedInterviews / totalInterviews) * 100).toFixed(2)
        : 0;

      // Applications per month (current year)
      const monthlyResult = await dbPool.query(
        `SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count
         FROM applications
         WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month`
      );
      stats.applicationsPerMonth = monthlyResult.rows.map(row => ({
        month: row.month,
        count: parseInt(row.count)
      }));

      logger.info('Retrieved admin dashboard statistics');

      const ttl = parseInt(process.env.CACHE_TTL_STATS || '180000', 10);
      cache.set(cacheKey, stats, ttl);

      return stats;
    });
  }

  /**
   * Get analytics dashboard metrics (heavy query, cached)
   */
  async getAnalyticsDashboard() {
    const cacheKey = 'analytics:dashboard:metrics';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return await heavyQueryBreaker.fire(async () => {
      const metrics = {};

      // Applications trend (last 12 months)
      const trendResult = await dbPool.query(
        `SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
         FROM applications
         WHERE created_at >= NOW() - INTERVAL '12 months'
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month`
      );
      metrics.applicationsTrend = trendResult.rows.map(row => ({
        month: row.month,
        total: parseInt(row.count),
        approved: parseInt(row.approved),
        rejected: parseInt(row.rejected)
      }));

      // Evaluation scores distribution
      const scoresDistResult = await dbPool.query(
        `SELECT
          evaluation_type,
          MIN(score) as min_score,
          MAX(score) as max_score,
          AVG(score) as avg_score,
          STDDEV(score) as stddev_score,
          COUNT(*) as count
         FROM evaluations
         WHERE score IS NOT NULL
         GROUP BY evaluation_type`
      );
      metrics.scoresDistribution = scoresDistResult.rows.map(row => ({
        evaluationType: row.evaluation_type,
        minScore: parseFloat(row.min_score || 0).toFixed(2),
        maxScore: parseFloat(row.max_score || 0).toFixed(2),
        avgScore: parseFloat(row.avg_score || 0).toFixed(2),
        stddevScore: parseFloat(row.stddev_score || 0).toFixed(2),
        count: parseInt(row.count)
      }));

      // Interview types distribution
      const interviewTypesResult = await dbPool.query(
        `SELECT interview_type, COUNT(*) as count
         FROM interviews
         GROUP BY interview_type
         ORDER BY count DESC`
      );
      metrics.interviewTypes = interviewTypesResult.rows.map(row => ({
        type: row.interview_type,
        count: parseInt(row.count)
      }));

      // Top evaluators by volume
      const evaluatorsResult = await dbPool.query(
        `SELECT
          u.first_name,
          u.last_name,
          u.email,
          COUNT(e.id) as evaluation_count
         FROM evaluations e
         JOIN users u ON e.evaluator_id = u.id
         GROUP BY u.id, u.first_name, u.last_name, u.email
         ORDER BY evaluation_count DESC
         LIMIT 10`
      );
      metrics.topEvaluators = evaluatorsResult.rows.map(row => ({
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        evaluationCount: parseInt(row.evaluation_count)
      }));

      logger.info('Retrieved analytics dashboard metrics');

      const ttl = parseInt(process.env.CACHE_TTL_ANALYTICS || '600000', 10);
      cache.set(cacheKey, metrics, ttl);

      return metrics;
    });
  }

  /**
   * Get status distribution (simple query, cached)
   */
  async getStatusDistribution() {
    const cacheKey = 'analytics:status:distribution';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        `SELECT status, COUNT(*) as count
         FROM applications
         GROUP BY status
         ORDER BY count DESC`
      );

      const distribution = result.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count),
        percentage: 0 // Will be calculated
      }));

      const total = distribution.reduce((sum, item) => sum + item.count, 0);
      distribution.forEach(item => {
        item.percentage = total > 0 ? ((item.count / total) * 100).toFixed(2) : 0;
      });

      logger.info('Retrieved status distribution');

      cache.set(cacheKey, distribution, 600000); // 10 min TTL
      return distribution;
    });
  }

  /**
   * Get temporal trends (heavy query, cached)
   */
  async getTemporalTrends() {
    const cacheKey = 'analytics:temporal:trends';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    return await heavyQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        `SELECT
          DATE(created_at) as date,
          COUNT(*) as applications,
          COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'UNDER_REVIEW' THEN 1 END) as under_review
         FROM applications
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date`
      );

      const trends = result.rows.map(row => ({
        date: row.date,
        applications: parseInt(row.applications),
        approved: parseInt(row.approved),
        rejected: parseInt(row.rejected),
        underReview: parseInt(row.under_review)
      }));

      logger.info('Retrieved temporal trends');

      cache.set(cacheKey, trends, 900000); // 15 min TTL
      return trends;
    });
  }

  /**
   * Clear cache for specific pattern or all
   */
  async clearCache(pattern = null) {
    cache.clear(pattern);
    logger.info(`Cache cleared${pattern ? ` for pattern: ${pattern}` : ''}`);
    return { message: 'Cache cleared successfully', pattern };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return cache.getStats();
  }
}

module.exports = new DashboardService();
