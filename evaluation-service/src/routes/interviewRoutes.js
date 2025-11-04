const express = require('express');
const router = express.Router();
const InterviewController = require('../controllers/InterviewController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { validate, createInterviewSchema, updateInterviewSchema } = require('../middleware/validators');
const { dbPool } = require('../config/database');

// Public endpoint - Get list of available interviewers (no auth required)
// Cached for 10 minutes since interviewer list doesn't change frequently
router.get('/public/interviewers', async (req, res) => {
  try {
    const cacheKey = 'interviewers:list:public';

    // Try cache first
    const cached = req.evaluationCache.get(cacheKey);
    if (cached) {
      console.log(`Cache HIT for interviewers list: ${cacheKey}`);
      return res.json(cached);
    }

    console.log(`Cache MISS for interviewers list: ${cacheKey}`);

    // Get interviewers from users table (staff members who can interview)
    const result = await dbPool.query(`
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.role,
        u.subject,
        CASE
          WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER') THEN 'ALL'
          WHEN u.subject LIKE '%MATH%' OR u.subject LIKE '%SCIENCE%' THEN 'SECONDARY'
          ELSE 'PRIMARY'
        END as educational_level,
        (
          SELECT COUNT(*)
          FROM interviewer_schedules s
          WHERE s.interviewer_id = u.id
            AND s.is_active = true
        ) as schedule_count
      FROM users u
      WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER')
        AND u.active = true
      ORDER BY u.role, u.last_name, u.first_name
    `);

    const interviewers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role,
      subject: row.subject,
      educationalLevel: row.educational_level,
      scheduleCount: parseInt(row.schedule_count || 0)
    }));

    // Cache for 10 minutes
    req.evaluationCache.set(cacheKey, interviewers, 600000);
    console.log(`Cached interviewers list: ${cacheKey}`);

    res.json(interviewers);
  } catch (error) {
    console.error('Error fetching interviewers:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de entrevistadores',
      details: error.message
    });
  }
});

// All routes require authentication
router.get('/', authenticate, InterviewController.getAllInterviews.bind(InterviewController));

// GET /api/interviews/statistics - Get interview statistics (MUST BE BEFORE /:id)
router.get('/statistics', authenticate, async (req, res) => {
  try {
    console.log('📊 GET /api/interviews/statistics - Fetching interview statistics');

    const totalResult = await dbPool.query('SELECT COUNT(*) as count FROM interviews');
    console.log(`Total interviews: ${totalResult.rows[0].count}`);

    const byStatusResult = await dbPool.query(`
      SELECT status, COUNT(*) as count
      FROM interviews
      GROUP BY status
    `);
    console.log(`By status: ${byStatusResult.rows.length} different statuses`);

    const byTypeResult = await dbPool.query(`
      SELECT interview_type as type, COUNT(*) as count
      FROM interviews
      GROUP BY interview_type
    `);
    console.log(`By type: ${byTypeResult.rows.length} different types`);

    const upcomingResult = await dbPool.query(`
      SELECT COUNT(*) as count
      FROM interviews
      WHERE scheduled_date > NOW() AND status IN ('SCHEDULED', 'CONFIRMED')
    `);
    console.log(`Upcoming interviews: ${upcomingResult.rows[0].count}`);

    // Build byStatus object
    const byStatus = byStatusResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    // Build byType object
    const byType = byTypeResult.rows.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    const total = parseInt(totalResult.rows[0].count);
    const upcoming = parseInt(upcomingResult.rows[0].count);

    // Calculate completion rate
    const completed = byStatus['COMPLETED'] || 0;
    const cancelled = byStatus['CANCELLED'] || 0;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(2) : '0.00';
    const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(2) : '0.00';

    const response = {
      success: true,
      data: {
        // Frontend expects overview object with these fields
        overview: {
          total: total,
          scheduled: byStatus['SCHEDULED'] || 0,
          completed: completed,
          cancelled: cancelled,
          upcoming: upcoming,
          completionRate: completionRate,
          cancellationRate: cancellationRate
        },
        byStatus: byStatus,
        byType: byType,
        upcoming: upcoming
      }
    };

    console.log('✅ Statistics response:', JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching interview statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de entrevistas',
      details: error.message
    });
  }
});

// GET /api/interviews/calendar - Get interviews for calendar view (MUST BE BEFORE /:id)
// Cached for 3 minutes since calendar data is time-sensitive
router.get('/calendar', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build cache key from date range
    const cacheKey = `interviews:calendar:${startDate || 'all'}:${endDate || 'all'}`;

    // Try cache first
    const cached = req.evaluationCache.get(cacheKey);
    if (cached) {
      console.log(`Cache HIT for calendar: ${cacheKey}`);
      return res.json(cached);
    }

    console.log(`Cache MISS for calendar: ${cacheKey}`);

    let query = `
      SELECT i.*,
             i.scheduled_time::text as scheduled_time_text,
             s.first_name,
             s.paternal_last_name,
             s.maternal_last_name,
             s.grade_applied,
             CONCAT(u1.first_name, ' ', u1.last_name) as interviewer_name,
             CONCAT(u2.first_name, ' ', u2.last_name) as second_interviewer_name
      FROM interviews i
      LEFT JOIN applications a ON i.application_id = a.id
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN users u1 ON i.interviewer_user_id = u1.id
      LEFT JOIN users u2 ON i.second_interviewer_id = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND i.scheduled_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND i.scheduled_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ' ORDER BY i.scheduled_date ASC, i.scheduled_time ASC';

    const result = await dbPool.query(query, params);

    const events = result.rows.map(row => ({
      id: row.id,
      title: `${row.interview_type || 'Entrevista'} - ${row.first_name} ${row.paternal_last_name}`,
      start: row.scheduled_date,
      end: row.scheduled_date,
      status: row.status,
      interviewType: row.interview_type,
      studentName: `${row.first_name} ${row.paternal_last_name} ${row.maternal_last_name || ''}`.trim(),
      gradeApplied: row.grade_applied,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time_text || row.scheduled_time,
      duration: row.duration,
      location: row.location,
      mode: row.mode,
      notes: row.notes,
      applicationId: row.application_id,
      interviewerId: row.interviewer_user_id,
      secondInterviewerId: row.second_interviewer_id,
      interviewerName: row.interviewer_name || 'No asignado',
      secondInterviewerName: row.second_interviewer_name || null
    }));

    const response = {
      success: true,
      data: events,
      count: events.length
    };

    // Cache for 3 minutes (calendar is time-sensitive)
    req.evaluationCache.set(cacheKey, response, 180000);
    console.log(`Cached calendar events: ${cacheKey}`);

    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener calendario de entrevistas',
      details: error.message
    });
  }
});

// GET /api/interviews/application/:applicationId - MUST BE BEFORE /:id
router.get('/application/:applicationId', authenticate, InterviewController.getInterviewsByApplicationId.bind(InterviewController));

// GET /api/interviews/interviewer/:interviewerId - Get interviews by interviewer (MUST BE BEFORE /:id)
router.get('/interviewer/:interviewerId', authenticate, async (req, res) => {
  try {
    const { interviewerId } = req.params;
    const { dbPool } = require('../config/database');

    // Query to get interviews where user is interviewer or second interviewer
    const query = `
      SELECT
        i.*,
        i.scheduled_time::text as scheduled_time_text,
        s.first_name,
        s.paternal_last_name,
        s.maternal_last_name,
        CONCAT(u.first_name, ' ', u.last_name) as interviewer_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as second_interviewer_name,
        s.grade_applied
      FROM interviews i
      LEFT JOIN applications a ON i.application_id = a.id
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN users u ON i.interviewer_user_id = u.id
      LEFT JOIN users u2 ON i.second_interviewer_id = u2.id
      WHERE i.interviewer_user_id = $1 OR i.second_interviewer_id = $1
      ORDER BY i.scheduled_date DESC, i.scheduled_time DESC
    `;

    const result = await dbPool.query(query, [parseInt(interviewerId)]);

    const interviews = result.rows.map(row => ({
      id: row.id,
      applicationId: row.application_id,
      interviewerId: row.interviewer_user_id,
      secondInterviewerId: row.second_interviewer_id,
      interviewType: row.type,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time_text || row.scheduled_time,
      duration: row.duration,
      location: row.location,
      mode: row.mode,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      studentName: `${row.first_name} ${row.paternal_last_name} ${row.maternal_last_name || ''}`.trim(),
      interviewerName: row.interviewer_name || 'No asignado',
      secondInterviewerName: row.second_interviewer_name || null,
      gradeApplied: row.grade_applied
    }));

    return res.json(interviews);
  } catch (error) {
    logger.error(`Error getting interviews for interviewer ${req.params.interviewerId}:`, error);
    return res.status(500).json({ error: 'Failed to retrieve interviews', message: error.message });
  }
});

// GET /api/interviews/application/:applicationId/summary-status - Check if summary was already sent
router.get('/application/:applicationId/summary-status', authenticate, InterviewController.checkSummaryStatus.bind(InterviewController));

// POST /api/interviews/application/:applicationId/send-summary - Send interview summary via email
router.post('/application/:applicationId/send-summary', authenticate, validateCsrf, InterviewController.sendInterviewSummary.bind(InterviewController));

// GET /api/interviews/available-slots - Get available interview slots (MUST BE BEFORE /:id)
router.get('/available-slots', authenticate, async (req, res) => {
  try {
    const { interviewerId, date, duration = 60 } = req.query;

    if (!interviewerId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren interviewerId y date'
      });
    }

    // Parse date correctly to avoid timezone issues
    // Input format: 'YYYY-MM-DD'
    const [yearStr, monthStr, dayStr] = date.split('-');
    const targetDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][targetDate.getDay()];
    const year = targetDate.getFullYear();

    // Get interviewer's schedule for this day/year
    const scheduleResult = await dbPool.query(`
      SELECT start_time, end_time
      FROM interviewer_schedules
      WHERE interviewer_id = $1
        AND year = $2
        AND (
          (schedule_type = 'RECURRING' AND day_of_week = $3)
          OR
          (schedule_type = 'SPECIFIC_DATE' AND specific_date = $4)
        )
        AND is_active = true
    `, [interviewerId, year, dayOfWeek, date]);

    if (scheduleResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          availableSlots: [],
          message: 'No hay horarios disponibles para esta fecha'
        }
      });
    }

    // Get existing interviews for this interviewer on this date
    const interviewsResult = await dbPool.query(`
      SELECT scheduled_time::text as scheduled_time, duration
      FROM interviews
      WHERE (interviewer_id = $1 OR second_interviewer_id = $1)
        AND scheduled_date = $2
        AND status NOT IN ('CANCELLED', 'RESCHEDULED')
    `, [interviewerId, date]);

    // Generate available slots
    const availableSlots = [];
    const durationMinutes = parseInt(duration);

    for (const schedule of scheduleResult.rows) {
      const startTime = schedule.start_time;
      const endTime = schedule.end_time;

      // Parse times
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      let currentMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      while (currentMinutes + durationMinutes <= endMinutes) {
        const slotHour = Math.floor(currentMinutes / 60);
        const slotMinute = currentMinutes % 60;
        const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}:00`;

        // Check if this slot conflicts with existing interviews
        const hasConflict = interviewsResult.rows.some(interview => {
          const [intHour, intMinute] = interview.scheduled_time.split(':').map(Number);
          const intStartMinutes = intHour * 60 + intMinute;
          const intEndMinutes = intStartMinutes + parseInt(interview.duration || 60);

          return (
            (currentMinutes >= intStartMinutes && currentMinutes < intEndMinutes) ||
            (currentMinutes + durationMinutes > intStartMinutes && currentMinutes + durationMinutes <= intEndMinutes) ||
            (currentMinutes <= intStartMinutes && currentMinutes + durationMinutes >= intEndMinutes)
          );
        });

        if (!hasConflict) {
          availableSlots.push({
            time: slotTime,
            display: `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`
          });
        }

        currentMinutes += durationMinutes;
      }
    }

    res.json({
      success: true,
      data: {
        availableSlots,
        date,
        interviewerId: parseInt(interviewerId),
        duration: durationMinutes
      }
    });
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horarios disponibles',
      details: error.message
    });
  }
});

// GET /api/interviews/:id - Get interview by ID (MUST BE AFTER specific routes)
router.get('/:id', authenticate, InterviewController.getInterviewById.bind(InterviewController));

router.post(
  '/',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  validate(createInterviewSchema),
  InterviewController.createInterview.bind(InterviewController)
);

router.put(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  validate(updateInterviewSchema),
  InterviewController.updateInterview.bind(InterviewController)
);

router.delete(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN'),
  InterviewController.deleteInterview.bind(InterviewController)
);

// PATCH /api/interviews/:id/cancel - Cancel an interview
router.patch(
  '/:id/cancel',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  InterviewController.cancelInterview.bind(InterviewController)
);

// PATCH /api/interviews/:id/reschedule - Reschedule an interview
router.patch(
  '/:id/reschedule',
  authenticate,
  validateCsrf,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  InterviewController.rescheduleInterview.bind(InterviewController)
);

module.exports = router;
