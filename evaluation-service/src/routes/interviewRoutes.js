const express = require('express');
const router = express.Router();
const InterviewController = require('../controllers/InterviewController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, createInterviewSchema, updateInterviewSchema } = require('../middleware/validators');
const { dbPool } = require('../config/database');

// Public endpoint - Get list of available interviewers (no auth required)
router.get('/public/interviewers', async (req, res) => {
  try {
    // Get interviewers from users table (staff members who can interview)
    const result = await dbPool.query(`
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.role,
        u.subject,
        CASE
          WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST') THEN 'ALL'
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
      WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR')
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
    const totalResult = await dbPool.query('SELECT COUNT(*) as count FROM interviews');
    const byStatusResult = await dbPool.query(`
      SELECT status, COUNT(*) as count
      FROM interviews
      GROUP BY status
    `);
    const byTypeResult = await dbPool.query(`
      SELECT type, COUNT(*) as count
      FROM interviews
      GROUP BY type
    `);

    const upcomingResult = await dbPool.query(`
      SELECT COUNT(*) as count
      FROM interviews
      WHERE scheduled_date > NOW() AND status IN ('SCHEDULED', 'CONFIRMED')
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
          acc[row.type] = parseInt(row.count);
          return acc;
        }, {}),
        upcoming: parseInt(upcomingResult.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de entrevistas',
      details: error.message
    });
  }
});

// GET /api/interviews/calendar - Get interviews for calendar view (MUST BE BEFORE /:id)
router.get('/calendar', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT i.*,
             s.first_name,
             s.paternal_last_name,
             s.maternal_last_name
      FROM interviews i
      LEFT JOIN applications a ON i.application_id = a.id
      LEFT JOIN students s ON a.student_id = s.id
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

    query += ' ORDER BY i.scheduled_date ASC';

    const result = await dbPool.query(query, params);

    const events = result.rows.map(row => ({
      id: row.id,
      title: `${row.type || 'Entrevista'} - ${row.first_name} ${row.paternal_last_name}`,
      start: row.scheduled_date,
      end: row.scheduled_date,
      status: row.status,
      type: row.type,
      studentName: `${row.first_name} ${row.paternal_last_name} ${row.maternal_last_name || ''}`.trim(),
      location: row.location,
      notes: row.notes,
      applicationId: row.application_id
    }));

    res.json({
      success: true,
      data: events,
      count: events.length
    });
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

    // Parse date and get day of week
    const targetDate = new Date(date);
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
      SELECT scheduled_time, duration
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
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  validate(createInterviewSchema),
  InterviewController.createInterview.bind(InterviewController)
);

router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR'),
  validate(updateInterviewSchema),
  InterviewController.updateInterview.bind(InterviewController)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  InterviewController.deleteInterview.bind(InterviewController)
);

module.exports = router;
