const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { getPublicKeyInfo, decryptCredentialsMiddleware } = require('../utils/encryption');

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
router.get('/public-key', (req, res) => {
  try {
    const publicKeyInfo = getPublicKeyInfo();
    res.json({
      success: true,
      data: publicKeyInfo
    });
  } catch (error) {
    console.error('[Auth] Failed to get public key:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve public key',
      code: 'ENCRYPTION_KEY_ERROR'
    });
  }
});
router.post('/login', decryptCredentialsMiddleware, validateCsrf, (req, res) => authController.login(req, res));
router.post('/register', decryptCredentialsMiddleware, validateCsrf, (req, res) => authController.register(req, res));
router.post('/check-email', (req, res) => authController.checkEmail(req, res));

// Protected endpoints
router.get('/check', authenticateToken, (req, res) => authController.check(req, res));

module.exports = router;
