const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { dbPool } = require('../config/database');

// GET /api/interviewer-schedules/interviewer/:interviewerId - Get all schedules for an interviewer
router.get('/interviewer/:interviewerId', authenticate, async (req, res) => {
  try {
    const { interviewerId } = req.params;

    const result = await dbPool.query(`
      SELECT
        s.*,
        u.first_name, u.last_name, u.email, u.role
      FROM interviewer_schedules s
      INNER JOIN users u ON s.interviewer_id = u.id
      WHERE s.interviewer_id = $1 AND s.is_active = true
      ORDER BY s.year DESC, s.day_of_week, s.start_time
    `, [interviewerId]);

    const schedules = result.rows.map(row => ({
      id: row.id,
      interviewer: {
        id: parseInt(interviewerId),
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        role: row.role
      },
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      year: row.year,
      specificDate: row.specific_date,
      scheduleType: row.schedule_type || 'RECURRING',
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching interviewer schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horarios del entrevistador',
      details: error.message
    });
  }
});

// GET /api/interviewer-schedules/interviewer/:interviewerId/year/:year - Get schedules by year
router.get('/interviewer/:interviewerId/year/:year', authenticate, async (req, res) => {
  try {
    const { interviewerId, year } = req.params;

    const result = await dbPool.query(`
      SELECT
        s.*,
        u.first_name, u.last_name, u.email, u.role
      FROM interviewer_schedules s
      INNER JOIN users u ON s.interviewer_id = u.id
      WHERE s.interviewer_id = $1 AND s.year = $2 AND s.is_active = true
      ORDER BY s.day_of_week, s.start_time
    `, [interviewerId, year]);

    const schedules = result.rows.map(row => ({
      id: row.id,
      interviewer: {
        id: parseInt(interviewerId),
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        role: row.role
      },
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      year: row.year,
      specificDate: row.specific_date,
      scheduleType: row.schedule_type || 'RECURRING',
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules by year:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horarios por año',
      details: error.message
    });
  }
});

// POST /api/interviewer-schedules - Create a new schedule
// Invalidates interviewer cache since schedule count changes
router.post('/', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { interviewer, dayOfWeek, startTime, endTime, year, specificDate, scheduleType, notes } = req.body;
    const interviewerId = interviewer?.id || interviewer;

    if (!interviewerId || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: interviewer, startTime, endTime'
      });
    }

    const result = await dbPool.query(`
      INSERT INTO interviewer_schedules (
        interviewer_id, day_of_week, start_time, end_time, year,
        specific_date, schedule_type, notes, is_active, date, user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $6, NULL)
      RETURNING *
    `, [interviewerId, dayOfWeek, startTime, endTime, year, specificDate, scheduleType || 'RECURRING', notes]);

    const created = result.rows[0];

    // Get user info
    const userResult = await dbPool.query('SELECT first_name, last_name, email, role FROM users WHERE id = $1', [interviewerId]);
    const user = userResult.rows[0];

    // Invalidate interviewer list cache (schedule count changed)
    if (req.evaluationCache) {
      const invalidated = req.evaluationCache.invalidatePattern('interviewers:*');
      console.log(`Cache invalidated after schedule CREATE: ${invalidated} entries`);
    }

    res.status(201).json({
      id: created.id,
      interviewer: {
        id: parseInt(interviewerId),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
      },
      dayOfWeek: created.day_of_week,
      startTime: created.start_time,
      endTime: created.end_time,
      year: created.year,
      specificDate: created.specific_date,
      scheduleType: created.schedule_type,
      isActive: created.is_active,
      notes: created.notes,
      createdAt: created.created_at,
      updatedAt: created.updated_at
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear horario',
      details: error.message
    });
  }
});

// POST /api/interviewer-schedules/interviewer/:interviewerId/recurring/:year - Create recurring schedules
router.post('/interviewer/:interviewerId/recurring/:year', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { interviewerId, year } = req.params;
    const schedules = req.body;

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de horarios'
      });
    }

    const created = [];
    for (const schedule of schedules) {
      const result = await dbPool.query(`
        INSERT INTO interviewer_schedules (
          interviewer_id, day_of_week, start_time, end_time, year,
          schedule_type, notes, is_active
        )
        VALUES ($1, $2, $3, $4, $5, 'RECURRING', $6, true)
        RETURNING *
      `, [interviewerId, schedule.dayOfWeek, schedule.startTime, schedule.endTime, year, schedule.notes]);

      created.push(result.rows[0]);
    }

    // Get user info
    const userResult = await dbPool.query('SELECT first_name, last_name, email, role FROM users WHERE id = $1', [interviewerId]);
    const user = userResult.rows[0];

    const response = created.map(row => ({
      id: row.id,
      interviewer: {
        id: parseInt(interviewerId),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
      },
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      year: row.year,
      scheduleType: row.schedule_type,
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating recurring schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear horarios recurrentes',
      details: error.message
    });
  }
});

// PUT /api/interviewer-schedules/:id - Update schedule
// Invalidates interviewer and interview caches since availability changes
router.put('/:id', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, year, specificDate, scheduleType, notes, isActive } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (dayOfWeek !== undefined) {
      updates.push(`day_of_week = $${paramIndex++}`);
      values.push(dayOfWeek);
    }
    if (startTime !== undefined) {
      updates.push(`start_time = $${paramIndex++}`);
      values.push(startTime);
    }
    if (endTime !== undefined) {
      updates.push(`end_time = $${paramIndex++}`);
      values.push(endTime);
    }
    if (year !== undefined) {
      updates.push(`year = $${paramIndex++}`);
      values.push(year);
    }
    if (specificDate !== undefined) {
      updates.push(`specific_date = $${paramIndex++}`);
      values.push(specificDate);
    }
    if (scheduleType !== undefined) {
      updates.push(`schedule_type = $${paramIndex++}`);
      values.push(scheduleType);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await dbPool.query(`
      UPDATE interviewer_schedules
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Horario no encontrado'
      });
    }

    // Invalidate interviewer and interview caches (availability changed)
    if (req.evaluationCache) {
      const invalidated = req.evaluationCache.invalidatePattern('interviewers:*');
      console.log(`Cache invalidated after schedule UPDATE: ${invalidated} entries`);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar horario',
      details: error.message
    });
  }
});

// PUT /api/interviewer-schedules/:id/deactivate - Deactivate schedule
router.put('/:id/deactivate', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(`
      UPDATE interviewer_schedules
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Horario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Horario desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error deactivating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desactivar horario',
      details: error.message
    });
  }
});

// DELETE /api/interviewer-schedules/:id - Delete schedule
// Invalidates interviewer cache since schedule count changes
router.delete('/:id', authenticate, validateCsrf, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query('DELETE FROM interviewer_schedules WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Horario no encontrado'
      });
    }

    // Invalidate interviewer list cache (schedule count changed)
    if (req.evaluationCache) {
      const invalidated = req.evaluationCache.invalidatePattern('interviewers:*');
      console.log(`Cache invalidated after schedule DELETE: ${invalidated} entries`);
    }

    res.json({
      success: true,
      message: 'Horario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar horario',
      details: error.message
    });
  }
});

// GET /api/interviewer-schedules/interviewers-with-schedules/:year - Get interviewers with schedules
router.get('/interviewers-with-schedules/:year', authenticate, async (req, res) => {
  try {
    const { year } = req.params;

    const result = await dbPool.query(`
      SELECT DISTINCT u.id, u.first_name as "firstName", u.last_name as "lastName",
             u.email, u.role, u.subject,
             COUNT(s.id) as schedule_count
      FROM users u
      INNER JOIN interviewer_schedules s ON u.id = s.interviewer_id
      WHERE s.year = $1 AND s.is_active = true
        AND u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR')
        AND u.active = true
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, u.subject
      ORDER BY u.last_name, u.first_name
    `, [year]);

    const interviewers = result.rows.map(row => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      role: row.role,
      subject: row.subject,
      scheduleCount: parseInt(row.schedule_count)
    }));

    res.json(interviewers);
  } catch (error) {
    console.error('Error fetching interviewers with schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener entrevistadores con horarios',
      details: error.message
    });
  }
});

module.exports = router;
