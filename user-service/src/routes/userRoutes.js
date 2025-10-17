const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

const router = express.Router();
const BCRYPT_ROUNDS = 8;

// GET /api/users/roles - Get all roles
router.get('/roles', (req, res) => {
  const roles = ['ADMIN', 'TEACHER', 'COORDINATOR', 'CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'APODERADO'];
  res.json({ roles });
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
      emailVerified: user.email_verified
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
router.post('/', authenticateToken, async (req, res) => {
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
router.put('/:id', authenticateToken, async (req, res) => {
  const client = await req.dbPool.connect();
  try {
    let hashedPassword = null;
    if (req.body.password && req.body.password.trim() !== '') {
      hashedPassword = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
    }

    const updateQuery = hashedPassword ?
      `UPDATE users SET first_name = $2, last_name = $3, email = $4, password = $5, role = $6,
       active = $7, rut = $8, phone = $9, subject = $10, updated_at = NOW() WHERE id = $1` :
      `UPDATE users SET first_name = $2, last_name = $3, email = $4, role = $5,
       active = $6, rut = $7, phone = $8, subject = $9, updated_at = NOW() WHERE id = $1`;

    const params = hashedPassword ?
      [req.params.id, req.body.firstName, req.body.lastName, req.body.email, hashedPassword,
       req.body.role, req.body.active, req.body.rut, req.body.phone, req.body.subject] :
      [req.params.id, req.body.firstName, req.body.lastName, req.body.email,
       req.body.role, req.body.active, req.body.rut, req.body.phone, req.body.subject];

    await client.query(updateQuery, params);

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente'
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
router.delete('/:id', authenticateToken, async (req, res) => {
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

module.exports = router;
