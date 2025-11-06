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

  /**
   * Get applicant metrics with exam completion and family interview scores
   * @param {Object} filters - Filter options
   * @param {string} filters.studentName - Filter by student name (partial match)
   * @param {number} filters.minFamilyScore - Minimum family interview score
   * @param {number} filters.maxFamilyScore - Maximum family interview score
   * @param {number} filters.minExamCompletion - Minimum exam completion percentage (0-100)
   * @param {string} filters.applicationStatus - Filter by application status
   * @param {string} filters.gradeApplied - Filter by grade applied
   * @param {number} filters.academicYear - Filter by academic year
   * @param {number} filters.limit - Maximum number of results (default: 100)
   * @param {number} filters.offset - Pagination offset (default: 0)
   */
  async getApplicantMetrics(filters = {}) {
    const {
      studentName,
      minFamilyScore,
      maxFamilyScore,
      minExamCompletion,
      applicationStatus,
      gradeApplied,
      academicYear,
      limit = 100,
      offset = 0
    } = filters;

    return await heavyQueryBreaker.fire(async () => {
      // Build WHERE clauses dynamically
      const whereClauses = [];
      const queryParams = [];
      let paramCounter = 1;

      // Academic year filter
      if (academicYear) {
        whereClauses.push(`EXTRACT(YEAR FROM a.created_at) = $${paramCounter}`);
        queryParams.push(academicYear);
        paramCounter++;
      }

      // Student name filter (case-insensitive partial match)
      if (studentName) {
        whereClauses.push(`(s.first_name || ' ' || s.paternal_last_name || ' ' || COALESCE(s.maternal_last_name, '')) ILIKE $${paramCounter}`);
        queryParams.push(`%${studentName}%`);
        paramCounter++;
      }

      // Application status filter
      if (applicationStatus) {
        whereClauses.push(`a.status = $${paramCounter}`);
        queryParams.push(applicationStatus);
        paramCounter++;
      }

      // Grade applied filter
      if (gradeApplied) {
        whereClauses.push(`s.grade_applied = $${paramCounter}`);
        queryParams.push(gradeApplied);
        paramCounter++;
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Main query with exam completion and family score
      const query = `
        WITH applicant_data AS (
          SELECT
            s.id as student_id,
            s.first_name || ' ' || s.paternal_last_name || ' ' || COALESCE(s.maternal_last_name, '') as student_name,
            s.rut as student_rut,
            s.grade_applied,
            a.id as application_id,
            a.status as application_status,
            a.submission_date,

            -- Exam completion metrics
            COUNT(DISTINCT e.id) FILTER (
              WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
            ) as total_exams_assigned,

            COUNT(DISTINCT e.id) FILTER (
              WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
              AND e.status = 'COMPLETED'
            ) as exams_completed,

            CASE
              WHEN COUNT(DISTINCT e.id) FILTER (
                WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
              ) > 0
              THEN ROUND(
                (COUNT(DISTINCT e.id) FILTER (
                  WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
                  AND e.status = 'COMPLETED'
                )::decimal /
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
                )::decimal) * 100, 2
              )
              ELSE 0
            END as exam_completion_percentage,

            -- Family interview score
            AVG(i.score) FILTER (
              WHERE i.type = 'FAMILY' AND i.status = 'COMPLETED' AND i.score IS NOT NULL
            ) as family_interview_score,

            COUNT(DISTINCT i.id) FILTER (
              WHERE i.type = 'FAMILY' AND i.status = 'COMPLETED'
            ) as family_interviews_completed,

            -- Guardian info
            u.email as guardian_email,
            u.first_name || ' ' || u.last_name as guardian_name,
            u.phone as guardian_phone

          FROM students s
          JOIN applications a ON a.student_id = s.id
          LEFT JOIN evaluations e ON e.application_id = a.id
          LEFT JOIN interviews i ON i.application_id = a.id
          LEFT JOIN users u ON u.id = a.applicant_user_id
          ${whereClause}
          GROUP BY
            s.id, s.first_name, s.paternal_last_name, s.maternal_last_name,
            s.rut, s.grade_applied, a.id, a.status, a.submission_date,
            u.email, u.first_name, u.last_name, u.phone
        )
        SELECT * FROM applicant_data
        WHERE 1=1
        ${minFamilyScore !== undefined ? `AND family_interview_score >= ${minFamilyScore}` : ''}
        ${maxFamilyScore !== undefined ? `AND family_interview_score <= ${maxFamilyScore}` : ''}
        ${minExamCompletion !== undefined ? `AND exam_completion_percentage >= ${minExamCompletion}` : ''}
        ORDER BY student_name ASC
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
      `;

      queryParams.push(limit, offset);

      logger.info('Fetching applicant metrics', { filters, queryParams });

      const result = await dbPool.query(query, queryParams);

      // Get total count for pagination
      const countQuery = `
        WITH applicant_data AS (
          SELECT
            s.id,
            CASE
              WHEN COUNT(DISTINCT e.id) FILTER (
                WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
              ) > 0
              THEN ROUND(
                (COUNT(DISTINCT e.id) FILTER (
                  WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
                  AND e.status = 'COMPLETED'
                )::decimal /
                COUNT(DISTINCT e.id) FILTER (
                  WHERE e.evaluation_type IN ('LANGUAGE_EXAM', 'MATHEMATICS_EXAM', 'ENGLISH_EXAM')
                )::decimal) * 100, 2
              )
              ELSE 0
            END as exam_completion_percentage,
            AVG(i.score) FILTER (
              WHERE i.type = 'FAMILY' AND i.status = 'COMPLETED' AND i.score IS NOT NULL
            ) as family_interview_score
          FROM students s
          JOIN applications a ON a.student_id = s.id
          LEFT JOIN evaluations e ON e.application_id = a.id
          LEFT JOIN interviews i ON i.application_id = a.id
          ${whereClause}
          GROUP BY s.id
        )
        SELECT COUNT(*) FROM applicant_data
        WHERE 1=1
        ${minFamilyScore !== undefined ? `AND family_interview_score >= ${minFamilyScore}` : ''}
        ${maxFamilyScore !== undefined ? `AND family_interview_score <= ${maxFamilyScore}` : ''}
        ${minExamCompletion !== undefined ? `AND exam_completion_percentage >= ${minExamCompletion}` : ''}
      `;

      const countResult = await dbPool.query(countQuery, queryParams.slice(0, -2));
      const totalCount = parseInt(countResult.rows[0].count);

      // Format results
      const applicants = result.rows.map(row => ({
        studentId: row.student_id,
        studentName: row.student_name.trim(),
        studentRut: row.student_rut,
        gradeApplied: row.grade_applied,
        applicationId: row.application_id,
        applicationStatus: row.application_status,
        submissionDate: row.submission_date,
        examMetrics: {
          totalExamsAssigned: parseInt(row.total_exams_assigned),
          examsCompleted: parseInt(row.exams_completed),
          completionPercentage: parseFloat(row.exam_completion_percentage) || 0
        },
        familyInterviewMetrics: {
          score: row.family_interview_score ? parseFloat(row.family_interview_score).toFixed(2) : null,
          interviewsCompleted: parseInt(row.family_interviews_completed)
        },
        guardianInfo: {
          name: row.guardian_name,
          email: row.guardian_email,
          phone: row.guardian_phone
        }
      }));

      return {
        applicants,
        pagination: {
          total: totalCount,
          limit: limit,
          offset: offset,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: Math.floor(offset / limit) + 1
        },
        summary: {
          totalApplicants: totalCount,
          avgExamCompletion: applicants.length > 0
            ? (applicants.reduce((sum, a) => sum + a.examMetrics.completionPercentage, 0) / applicants.length).toFixed(2)
            : 0,
          avgFamilyScore: applicants.length > 0
            ? (applicants
                .filter(a => a.familyInterviewMetrics.score !== null)
                .reduce((sum, a) => sum + parseFloat(a.familyInterviewMetrics.score), 0) /
               applicants.filter(a => a.familyInterviewMetrics.score !== null).length
              ).toFixed(2)
            : null
        }
      };
    });
  }

  /**
   * Get comprehensive summary for a specific applicant
   * Returns normalized exam scores (0-100), family interview data, and cycle director decision
   * @param {number} applicationId - Application ID
   * @returns {object} Applicant summary with scores, interviews, and decision
   */
  async getApplicantSummary(applicationId) {
    const cacheKey = `dashboard:applicant-summary:${applicationId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info(`[Cache HIT] applicant-summary:${applicationId}`);
      return cached;
    }
    logger.info(`[Cache MISS] applicant-summary:${applicationId}`);

    return await mediumQueryBreaker.fire(async () => {
      // Get basic applicant data
      const applicantQuery = await dbPool.query(
        `SELECT
          a.id as application_id,
          s.first_name || ' ' || s.paternal_last_name || ' ' || COALESCE(s.maternal_last_name, '') as student_name,
          s.grade_applied as grade_applied,
          a.status as application_status
        FROM applications a
        INNER JOIN students s ON s.id = a.student_id
        WHERE a.id = $1 AND a.deleted_at IS NULL`,
        [applicationId]
      );

      if (applicantQuery.rows.length === 0) {
        return null; // Application not found
      }

      const applicant = applicantQuery.rows[0];

      // Get evaluation scores (normalized to 0-100)
      const scoresQuery = await dbPool.query(
        `SELECT
          evaluation_type,
          score,
          max_score,
          status
        FROM evaluations
        WHERE application_id = $1
          AND evaluation_type IN ('LANGUAGE_EXAM', 'ENGLISH_EXAM', 'MATHEMATICS_EXAM')
          AND status = 'COMPLETED'`,
        [applicationId]
      );

      // Normalize scores to 0-100
      const scores = {
        languagePct: null,
        englishPct: null,
        mathPct: null
      };

      scoresQuery.rows.forEach(row => {
        if (row.score !== null && row.max_score && row.max_score > 0) {
          const percentage = Math.round((row.score / row.max_score) * 100 * 10) / 10; // Round to 1 decimal

          if (row.evaluation_type === 'LANGUAGE_EXAM') {
            scores.languagePct = percentage;
          } else if (row.evaluation_type === 'ENGLISH_EXAM') {
            scores.englishPct = percentage;
          } else if (row.evaluation_type === 'MATHEMATICS_EXAM') {
            scores.mathPct = percentage;
          }
        }
      });

      // Get family interview data
      const interviewQuery = await dbPool.query(
        `SELECT
          AVG(score) as avg_score,
          COUNT(*) as count
        FROM interviews
        WHERE application_id = $1
          AND interview_type = 'FAMILY'
          AND status = 'COMPLETED'
          AND score IS NOT NULL`,
        [applicationId]
      );

      const familyInterview = {
        avgScore: interviewQuery.rows[0].avg_score
          ? Math.round(parseFloat(interviewQuery.rows[0].avg_score) * 10) / 10
          : null,
        count: parseInt(interviewQuery.rows[0].count) || 0
      };

      // Get cycle director decision (latest)
      const decisionQuery = await dbPool.query(
        `SELECT
          decision,
          decision_date,
          highlights,
          comment
        FROM cycle_director_decisions
        WHERE application_id = $1
        ORDER BY decision_date DESC
        LIMIT 1`,
        [applicationId]
      );

      const cycleDirectorDecision = decisionQuery.rows.length > 0 ? {
        decision: decisionQuery.rows[0].decision || 'PENDIENTE',
        decisionDate: decisionQuery.rows[0].decision_date || null,
        highlights: decisionQuery.rows[0].highlights || '',
        rawComment: decisionQuery.rows[0].comment || ''
      } : {
        decision: 'PENDIENTE',
        decisionDate: null,
        highlights: '',
        rawComment: ''
      };

      const summary = {
        applicantId: parseInt(applicant.application_id),
        studentName: applicant.student_name.trim(),
        gradeApplied: applicant.grade_applied || 'No especificado',
        applicationStatus: applicant.application_status,
        scores,
        familyInterview,
        cycleDirectorDecision
      };

      // Cache for 60 seconds
      cache.set(cacheKey, summary, 60000);
      logger.info(`Retrieved applicant summary for application ${applicationId}`);

      return summary;
    });
  }
}

module.exports = new DashboardService();
