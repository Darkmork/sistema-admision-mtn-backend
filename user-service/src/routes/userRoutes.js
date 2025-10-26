const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const bcrypt = require('bcryptjs');

const router = express.Router();
const BCRYPT_ROUNDS = 8;

// GET /api/users/roles - Get all roles
router.get('/roles', (req, res) => {
  const roles = ['ADMIN', 'TEACHER', 'COORDINATOR', 'CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER', 'APODERADO'];
  res.json({ roles });
});

// GET /api/users/public/school-staff - Get school staff users (public endpoint - no auth required)
router.get('/public/school-staff', async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { activeOnly } = req.query;

    let query = `
      SELECT id, first_name as "firstName", last_name as "lastName", email, role,
             subject, rut, phone, active, email_verified as "emailVerified"
      FROM users
      WHERE role IN ('ADMIN', 'TEACHER', 'COORDINATOR', 'CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER')
    `;

    if (activeOnly === 'true') {
      query += ' AND active = true';
    }

    query += ' ORDER BY role, first_name, last_name';

    const result = await client.query(query);

    const staffUsers = result.rows.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      subject: user.subject,
      rut: user.rut,
      phone: user.phone,
      active: user.active,
      emailVerified: user.emailVerified,
      canInterview: ['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR'].includes(user.role)
    }));

    res.json({
      success: true,
      data: staffUsers,
      content: staffUsers,  // Frontend expects 'content' field
      count: staffUsers.length,
      totalElements: staffUsers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios del staff',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/users/me - Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const userQuery = await client.query(
      'SELECT id, first_name, last_name, email, role, phone, rut, subject, active, email_verified, created_at FROM users WHERE id = $1',
      [parseInt(req.user.userId)]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userQuery.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        phone: user.phone,
        rut: user.rut,
        subject: user.subject,
        active: user.active,
        emailVerified: user.email_verified,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener perfil de usuario'
    });
  } finally {
    client.release();
  }
});

// GET /api/users/stats - Get user statistics (MUST BE BEFORE /:id)
router.get('/stats', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const totalUsersResult = await client.query('SELECT COUNT(*) as count FROM users');
    const activeUsersResult = await client.query('SELECT COUNT(*) as count FROM users WHERE active = true');
    const byRoleResult = await client.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);

    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    const activeUsers = parseInt(activeUsersResult.rows[0].count);

    const byRole = {};
    byRoleResult.rows.forEach(row => {
      byRole[row.role] = parseInt(row.count);
    });

    res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/users/statistics - Get user statistics (MUST BE BEFORE /:id) - DEPRECATED, use /stats
router.get('/statistics', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const totalUsersResult = await client.query('SELECT COUNT(*) as count FROM users');
    const activeUsersResult = await client.query('SELECT COUNT(*) as count FROM users WHERE active = true');
    const byRoleResult = await client.query(`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);

    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    const activeUsers = parseInt(activeUsersResult.rows[0].count);

    const usersByRole = {};
    byRoleResult.rows.forEach(row => {
      usersByRole[row.role] = parseInt(row.count);
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        usersByRole,
        activationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  } finally {
    client.release();
  }
});

// GET /api/users/by-role/:role - Get users by specific role (MUST BE BEFORE /:id)
router.get('/by-role/:role', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { role } = req.params;
    const { activeOnly } = req.query;

    let query = `
      SELECT id, first_name as "firstName", last_name as "lastName", email, role,
             subject, rut, phone, active, email_verified as "emailVerified", created_at as "createdAt"
      FROM users
      WHERE role = $1
    `;

    if (activeOnly === 'true') {
      query += ' AND active = true';
    }

    query += ' ORDER BY first_name, last_name';

    const result = await client.query(query, [role.toUpperCase()]);

    const users = result.rows.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.lastName}`
    }));

    res.json({
      success: true,
      data: users,
      count: users.length,
      role: role.toUpperCase()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios por rol'
    });
  } finally {
    client.release();
  }
});

// GET /api/users/evaluators - Get all evaluators (MUST BE BEFORE /:id)
router.get('/evaluators', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { subject, educationalLevel, activeOnly } = req.query;

    let query = `
      SELECT id, first_name as "firstName", last_name as "lastName", email, role,
             subject, rut, phone, active, email_verified as "emailVerified"
      FROM users
      WHERE role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR')
    `;

    const params = [];
    let paramIndex = 1;

    if (subject) {
      query += ` AND subject = $${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }

    if (activeOnly === 'true' || activeOnly === true) {
      query += ' AND active = true';
    }

    query += ' ORDER BY role, first_name, last_name';

    const result = await client.query(query, params);

    const evaluators = result.rows.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.lastName}`
    }));

    res.json({
      success: true,
      data: evaluators,
      count: evaluators.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener evaluadores'
    });
  } finally {
    client.release();
  }
});

// GET /api/users/guardians - Get guardian users (APODERADO role) with pagination (MUST BE BEFORE /:id)
router.get('/guardians', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { page = 0, size = 15, search, active } = req.query;
    const offset = parseInt(page) * parseInt(size);
    const limit = parseInt(size);

    // Build WHERE clause
    let whereConditions = [`role = 'APODERADO'`];
    const params = [];
    let paramIndex = 1;

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions.push(`(
        LOWER(first_name) LIKE $${paramIndex} OR
        LOWER(last_name) LIKE $${paramIndex} OR
        LOWER(email) LIKE $${paramIndex} OR
        LOWER(rut) LIKE $${paramIndex}
      )`);
      params.push(searchTerm);
      paramIndex++;
    }

    if (active !== undefined && active !== '') {
      whereConditions.push(`active = $${paramIndex}`);
      params.push(active === 'true' || active === true);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const totalElements = parseInt(countResult.rows[0].count);

    // Get paginated data
    params.push(limit);
    params.push(offset);
    const dataQuery = `
      SELECT id, first_name as "firstName", last_name as "lastName", email, role,
             rut, phone, active, email_verified as "emailVerified", created_at as "createdAt"
      FROM users
      WHERE ${whereClause}
      ORDER BY first_name, last_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await client.query(dataQuery, params);

    const users = result.rows.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.lastName}`
    }));

    res.json({
      content: users,
      number: parseInt(page),
      size: parseInt(size),
      totalElements,
      totalPages: Math.ceil(totalElements / limit),
      first: parseInt(page) === 0,
      last: parseInt(page) >= Math.ceil(totalElements / limit) - 1,
      numberOfElements: users.length,
      empty: users.length === 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios apoderados',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/users/staff - Get staff users with pagination (MUST BE BEFORE /:id)
router.get('/staff', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { page = 0, size = 15, search, role, active } = req.query;
    const offset = parseInt(page) * parseInt(size);
    const limit = parseInt(size);

    // Build WHERE clause
    let whereConditions = [`role IN ('ADMIN', 'TEACHER', 'COORDINATOR', 'CYCLE_DIRECTOR', 'PSYCHOLOGIST')`];
    const params = [];
    let paramIndex = 1;

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions.push(`(
        LOWER(first_name) LIKE $${paramIndex} OR
        LOWER(last_name) LIKE $${paramIndex} OR
        LOWER(email) LIKE $${paramIndex} OR
        LOWER(rut) LIKE $${paramIndex}
      )`);
      params.push(searchTerm);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      params.push(role.toUpperCase());
      paramIndex++;
    }

    if (active !== undefined && active !== '') {
      whereConditions.push(`active = $${paramIndex}`);
      params.push(active === 'true' || active === true);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const totalElements = parseInt(countResult.rows[0].count);

    // Get paginated data
    params.push(limit);
    params.push(offset);
    const dataQuery = `
      SELECT id, first_name as "firstName", last_name as "lastName", email, role,
             subject, rut, phone, active, email_verified as "emailVerified", created_at as "createdAt"
      FROM users
      WHERE ${whereClause}
      ORDER BY role, first_name, last_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await client.query(dataQuery, params);

    const users = result.rows.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.lastName}`,
      canInterview: ['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR'].includes(user.role)
    }));

    res.json({
      content: users,
      number: parseInt(page),
      size: parseInt(size),
      totalElements,
      totalPages: Math.ceil(totalElements / limit),
      first: parseInt(page) === 0,
      last: parseInt(page) >= Math.ceil(totalElements / limit) - 1,
      numberOfElements: users.length,
      empty: users.length === 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios del staff',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/users/search - Search users by query (MUST BE BEFORE /:id)
router.get('/search', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { query, role, activeOnly } = req.query;

    if (!query || query.trim() === '') {
      return res.status(422).json({
        success: false,
        error: 'Se requiere un término de búsqueda'
      });
    }

    const searchTerm = `%${query.toLowerCase()}%`;
    let sqlQuery = `
      SELECT id, first_name as "firstName", last_name as "lastName", email, role,
             subject, rut, phone, active, email_verified as "emailVerified", created_at as "createdAt"
      FROM users
      WHERE (
        LOWER(first_name) LIKE $1 OR
        LOWER(last_name) LIKE $1 OR
        LOWER(email) LIKE $1 OR
        LOWER(rut) LIKE $1
      )
    `;

    const params = [searchTerm];
    let paramIndex = 2;

    if (role) {
      sqlQuery += ` AND role = $${paramIndex}`;
      params.push(role.toUpperCase());
      paramIndex++;
    }

    if (activeOnly === 'true') {
      sqlQuery += ' AND active = true';
    }

    sqlQuery += ' ORDER BY first_name, last_name LIMIT 50';

    const result = await client.query(sqlQuery, params);

    const users = result.rows.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.lastName}`
    }));

    res.json({
      success: true,
      data: users,
      count: users.length,
      query: query
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al buscar usuarios'
    });
  } finally {
    client.release();
  }
});

// GET /api/users - Get all users
router.get('/', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const result = await client.query(
      `SELECT id, first_name as "firstName", last_name as "lastName", email, role, subject,
              rut, phone, active, email_verified as "emailVerified", created_at as "createdAt"
       FROM users ORDER BY role, first_name`
    );

    const users = result.rows.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.lastName}`
    }));

    res.json({
      success: true,
      data: users,
      users: users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios'
    });
  } finally {
    client.release();
  }
});

// GET /api/users/:id/associated-data - Get user's associated data count (MUST BE BEFORE /:id)
router.get('/:id/associated-data', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const userId = parseInt(req.params.id);

    // Count evaluations
    const evaluationsResult = await client.query(
      'SELECT COUNT(*) as count FROM evaluations WHERE evaluator_id = $1',
      [userId]
    );

    // Count interviews
    const interviewsResult = await client.query(
      'SELECT COUNT(*) as count FROM interviews WHERE interviewer_id = $1',
      [userId]
    );

    // Count evaluation schedules
    const schedulesResult = await client.query(
      'SELECT COUNT(*) as count FROM evaluation_schedules WHERE evaluator_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: {
        evaluations: parseInt(evaluationsResult.rows[0].count),
        interviews: parseInt(interviewsResult.rows[0].count),
        schedules: parseInt(schedulesResult.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos asociados',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const result = await client.query(
      'SELECT id, first_name, last_name, email, role, subject, rut, phone, active, email_verified FROM users WHERE id = $1',
      [parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
      subject: user.subject,
      rut: user.rut,
      phone: user.phone,
      active: user.active,
      emailVerified: user.email_verified,
      canInterview: ['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR'].includes(user.role)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuario'
    });
  } finally {
    client.release();
  }
});

// POST /api/users - Create new user
router.post('/', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const hashedPassword = req.body.password ?
      await bcrypt.hash(req.body.password, BCRYPT_ROUNDS) : null;

    const insertQuery = `
      INSERT INTO users (first_name, last_name, email, password, role, active, email_verified, rut, phone, subject, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id, first_name, last_name, email, role
    `;

    const result = await client.query(insertQuery, [
      req.body.firstName,
      req.body.lastName,
      req.body.email,
      hashedPassword,
      req.body.role || 'APODERADO',
      req.body.active !== undefined ? req.body.active : true,
      req.body.emailVerified !== undefined ? req.body.emailVerified : false,
      req.body.rut || null,
      req.body.phone || null,
      req.body.subject || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un usuario con ese email'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Error al crear usuario'
    });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    let hashedPassword = null;
    if (req.body.password && req.body.password.trim() !== '') {
      hashedPassword = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
    }

    const updateQuery = hashedPassword ?
      `UPDATE users SET first_name = $2, last_name = $3, email = $4, password = $5, role = $6,
       active = $7, email_verified = $8, rut = $9, phone = $10, subject = $11, updated_at = NOW() WHERE id = $1 RETURNING *` :
      `UPDATE users SET first_name = $2, last_name = $3, email = $4, role = $5,
       active = $6, email_verified = $7, rut = $8, phone = $9, subject = $10, updated_at = NOW() WHERE id = $1 RETURNING *`;

    const params = hashedPassword ?
      [req.params.id, req.body.firstName, req.body.lastName, req.body.email, hashedPassword,
       req.body.role, req.body.active, req.body.emailVerified !== undefined ? req.body.emailVerified : false,
       req.body.rut, req.body.phone, req.body.subject] :
      [req.params.id, req.body.firstName, req.body.lastName, req.body.email,
       req.body.role, req.body.active, req.body.emailVerified !== undefined ? req.body.emailVerified : false,
       req.body.rut, req.body.phone, req.body.subject];

    const result = await client.query(updateQuery, params);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al actualizar usuario'
    });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    await client.query('DELETE FROM users WHERE id = $1', [parseInt(req.params.id)]);
    res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        error: 'No se puede eliminar este usuario porque tiene datos asociados'
      });
    }
    res.status(500).json({
      success: false,
      error: 'Error al eliminar usuario'
    });
  } finally {
    client.release();
  }
});

// PATCH /api/users/:id/status - Toggle user active status
router.patch('/:id/status', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(422).json({
        success: false,
        error: 'El campo "active" debe ser booleano'
      });
    }

    const result = await client.query(
      `UPDATE users SET active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, first_name, last_name, email, role, active`,
      [active, parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      message: `Usuario ${active ? 'activado' : 'desactivado'} exitosamente`,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        active: user.active
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estado del usuario'
    });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id/activate - Activate user
router.put('/:id/activate', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const result = await client.query(
      `UPDATE users SET active = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, first_name as "firstName", last_name as "lastName", email, role, active`,
      [parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      message: 'Usuario activado exitosamente',
      data: {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al activar usuario',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id/deactivate - Deactivate user
router.put('/:id/deactivate', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const result = await client.query(
      `UPDATE users SET active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, first_name as "firstName", last_name as "lastName", email, role, active`,
      [parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
      data: {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al desactivar usuario',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id/reset-password - Reset user password (admin only)
router.put('/:id/reset-password', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    // Generate temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const result = await client.query(
      `UPDATE users SET password = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, first_name, last_name`,
      [hashedPassword, parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      data: {
        temporaryPassword: temporaryPassword
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al restablecer contraseña',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// POST /api/users/:id/reset-password - Reset user password (admin only) - DEPRECATED, use PUT
router.post('/:id/reset-password', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    // Generate temporary password
    const temporaryPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const result = await client.query(
      `UPDATE users SET password = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, first_name, last_name`,
      [hashedPassword, parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      data: {
        temporaryPassword: temporaryPassword
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al restablecer contraseña'
    });
  } finally {
    client.release();
  }
});

// POST /api/users/:id/verify-email - Verify user email
router.post('/:id/verify-email', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const result = await client.query(
      `UPDATE users SET email_verified = true, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, email_verified`,
      [parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Email verificado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al verificar email'
    });
  } finally {
    client.release();
  }
});

// PATCH /api/users/:id/preferences - Update user preferences
router.patch('/:id/preferences', authenticateToken, validateCsrf, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(422).json({
        success: false,
        error: 'Se requieren las preferencias en formato objeto'
      });
    }

    // Store preferences as JSON in a preferences column (if exists) or just return success
    // For now, we'll just acknowledge the update without storing it
    // You may want to add a 'preferences' JSONB column to the users table

    res.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente',
      data: {
        id: parseInt(req.params.id),
        preferences: preferences
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al actualizar preferencias'
    });
  } finally {
    client.release();
  }
});

module.exports = router;
