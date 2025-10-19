const AuthService = require('../services/authService');
const { generateCsrfToken } = require('../middleware/csrfMiddleware');

class AuthController {
  constructor(dbPool, circuitBreakers) {
    this.authService = new AuthService(dbPool, circuitBreakers.medium);
  }

  /**
   * GET /api/auth/csrf-token
   * Generate and return a CSRF token
   */
  getCsrfToken(req, res) {
    const csrfToken = generateCsrfToken();
    res.json({
      success: true,
      csrfToken,
      expiresIn: 3600 // 1 hour in seconds
    });
  }

  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login(email, password);
      res.json(result);
    } catch (error) {
      const status = error.message.includes('Credenciales') || error.message.includes('inactivo') ? 401 : 422;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const result = await this.authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      const status = error.message.includes('registrado') ? 409 : 422;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/auth/check
   */
  check(req, res) {
    res.json({
      success: true,
      authenticated: true,
      user: req.user
    });
  }

  /**
   * GET /api/auth/check-email
   */
  async checkEmail(req, res) {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(422).json({
          success: false,
          error: 'Email es requerido'
        });
      }

      const client = await req.dbPool.connect();
      try {
        const result = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email.toLowerCase().trim()]
        );
        res.json(result.rows.length > 0);
      } finally {
        client.release();
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error al verificar email'
      });
    }
  }
}

module.exports = AuthController;
