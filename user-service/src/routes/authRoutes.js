const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateCsrf } = require('../middleware/csrfMiddleware');

const router = express.Router();

// Initialize controller (will be set up in index.js with dependencies)
let authController;

router.use((req, res, next) => {
  if (!authController) {
    authController = new AuthController(req.dbPool, req.circuitBreakers);
  }
  next();
});

// Public endpoints
router.get('/csrf-token', (req, res) => authController.getCsrfToken(req, res));
router.post('/login', validateCsrf, (req, res) => authController.login(req, res));
router.post('/register', validateCsrf, (req, res) => authController.register(req, res));
router.get('/check-email', (req, res) => authController.checkEmail(req, res));

// Protected endpoints
router.get('/check', authenticateToken, (req, res) => authController.check(req, res));

module.exports = router;
