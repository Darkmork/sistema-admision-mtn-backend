const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// BCrypt rounds optimized for Railway shared vCPU
const BCRYPT_ROUNDS = 8;

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

class AuthService {
  constructor(dbPool, mediumQueryBreaker) {
    this.dbPool = dbPool;
    this.mediumQueryBreaker = mediumQueryBreaker;
  }

  /**
   * Login user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} User data with token
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email y contraseña son obligatorios');
    }

    const client = await this.dbPool.connect();
    try {
      // Query user from database
      const userQuery = await client.query(
        'SELECT id, first_name, last_name, email, role, subject, password, active, email_verified FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      if (userQuery.rows.length === 0) {
        throw new Error('Credenciales inválidas');
      }

      const user = userQuery.rows[0];

      // Check if user is active
      if (!user.active) {
        throw new Error('Usuario inactivo');
      }

      // Verify password with BCrypt
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new Error('Credenciales inválidas');
      }

      // Update last_login
      await client.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // For APODERADO users, find their applicationId
      let applicationId = null;
      if (user.role === 'APODERADO') {
        const applicationQuery = await client.query(
          'SELECT id FROM applications WHERE applicant_user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [user.id]
        );
        if (applicationQuery.rows.length > 0) {
          applicationId = applicationQuery.rows[0].id;
        }
      }

      // Create JWT token
      const token = this.createJWT(user);

      const responseData = {
        success: true,
        message: 'Login exitoso',
        token,
        id: user.id.toString(),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        subject: user.subject
      };

      if (applicationId !== null) {
        responseData.applicationId = applicationId;
      }

      return responseData;

    } finally {
      client.release();
    }
  }

  /**
   * Register new APODERADO user
   * @param {Object} userData
   * @returns {Promise<Object>} User data with token
   */
  async register(userData) {
    const { firstName, lastName, email, password, rut, phone } = userData;

    if (!firstName || !lastName || !email || !password) {
      throw new Error('Todos los campos obligatorios deben ser completados');
    }

    const client = await this.dbPool.connect();
    try {
      // Check if email exists
      const existingUserQuery = await client.query(
        'SELECT id, email FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      if (existingUserQuery.rows.length > 0) {
        // Allow re-registration for test emails
        if (email === 'test@example.com' || email === 'jorge.gangale@gmail.com') {
          await client.query('DELETE FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        } else {
          throw new Error('Este email ya está registrado en el sistema');
        }
      }

      // Check if RUT exists (if RUT is provided)
      if (rut && rut.trim()) {
        const existingRutQuery = await client.query(
          'SELECT id, email, rut FROM users WHERE rut = $1',
          [rut.trim()]
        );

        if (existingRutQuery.rows.length > 0) {
          const existingUser = existingRutQuery.rows[0];
          throw new Error(`Este RUT ya está registrado en el sistema con el email: ${existingUser.email}`);
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Insert new user
      const insertQuery = `
        INSERT INTO users (
          first_name, last_name, email, password, rut, phone, role,
          active, email_verified, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        ) RETURNING id, first_name, last_name, email, role, active, email_verified, created_at
      `;

      let insertResult;
      try {
        insertResult = await client.query(insertQuery, [
          firstName.trim(),
          lastName.trim(),
          email.toLowerCase().trim(),
          hashedPassword,
          rut ? rut.trim() : null,
          phone ? phone.trim() : null,
          'APODERADO',
          true,
          true
        ]);
      } catch (dbError) {
        // Handle database constraint violations
        if (dbError.code === '23505') { // Unique violation
          if (dbError.constraint === 'uk6dotkott2kjsp8vw4d0m25fb7') {
            throw new Error('Este email ya está registrado en el sistema');
          } else if (dbError.constraint === 'ukscuj1snh0iy35s195t3qff5o') {
            throw new Error('Este RUT ya está registrado en el sistema');
          }
        }
        throw dbError;
      }

      const newUser = insertResult.rows[0];
      const token = this.createJWT(newUser);

      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        token,
        id: newUser.id.toString(),
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        fullName: `${newUser.first_name} ${newUser.last_name}`,
        email: newUser.email,
        role: newUser.role,
        rut: rut ? rut.trim() : null,
        phone: phone ? phone.trim() : null,
        emailVerified: newUser.email_verified,
        createdAt: newUser.created_at.toISOString()
      };

    } finally {
      client.release();
    }
  }

  /**
   * Create JWT token
   * @param {Object} user
   * @returns {string} JWT token
   */
  createJWT(user) {
    const payload = {
      userId: user.id.toString(),
      email: user.email,
      role: user.role
    };

    // Sign token with HS256 algorithm and 24-hour expiration
    return jwt.sign(payload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '24h'
    });
  }
}

module.exports = AuthService;
