const express = require('express');
const router = express.Router();
const { dbPool } = require('../config/database');
const { ok, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');
const crypto = require('crypto');
const emailService = require('../services/EmailService');

/**
 * @route   GET /api/email/config-status
 * @desc    Check SMTP configuration status (for debugging)
 * @access  Public (should be protected in production)
 */
router.get('/config-status', (req, res) => {
  const isMockMode = process.env.EMAIL_MOCK_MODE === 'true';
  const config = {
    mockMode: isMockMode,
    smtpConfigured: !isMockMode && !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD),
    smtpHost: process.env.SMTP_HOST || 'not configured',
    smtpPort: process.env.SMTP_PORT || 'not configured',
    smtpUser: process.env.SMTP_USER ? '***configured***' : 'not configured',
    smtpPassword: process.env.SMTP_PASSWORD ? '***configured***' : 'not configured',
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(ok({
    status: config.smtpConfigured ? 'SMTP Ready' : (isMockMode ? 'Mock Mode' : 'Not Configured'),
    ...config
  }));
});

/**
 * @route   GET /api/email/check-exists
 * @desc    Check if email already exists in the system (public endpoint for registration)
 * @access  Public
 * @query   email - The email to check
 */
router.get('/check-exists', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(422).json(fail('EMAIL_001', 'Email is required'));
    }

    // Check in users table
    const result = await dbPool.query(
      'SELECT COUNT(*) as count FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const exists = parseInt(result.rows[0].count) > 0;

    logger.info(`Email check: ${email} - Exists: ${exists}`);

    res.json(ok({
      exists,
      email: email.toLowerCase()
    }));
  } catch (error) {
    logger.error('Error checking email existence:', error);
    res.status(500).json(fail('EMAIL_002', 'Error checking email', error.message));
  }
});

/**
 * @route   POST /api/email/send-verification
 * @desc    Send verification code to email (public endpoint for registration)
 * @access  Public
 * @body    { email, firstName?, lastName?, rut? }
 */
router.post('/send-verification', async (req, res) => {
  try {
    const { email, firstName, lastName, rut } = req.body;

    // Log para debugging - ver qué datos están llegando
    logger.info(`📧 Recibiendo request de verificación - Email: ${email}, RUT: ${rut || 'NO PROPORCIONADO'}, FirstName: ${firstName || 'N/A'}, LastName: ${lastName || 'N/A'}`);

    if (!email) {
      return res.status(422).json(fail('EMAIL_003', 'Email is required'));
    }

    // ============= VALIDACIONES ANTES DE ENVIAR EL CÓDIGO =============

    // 1. Verificar si el email ya existe en el sistema
    const emailCheckResult = await dbPool.query(
      'SELECT email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (emailCheckResult.rows.length > 0) {
      logger.warn(`Registration attempt with existing email: ${email}`);
      return res.status(409).json(fail('EMAIL_008', 'Este email ya está registrado en el sistema. Por favor, inicia sesión o usa otro email.'));
    }

    // 2. Verificar si el RUT ya existe en el sistema (si se proporciona)
    if (rut && rut.trim()) {
      const rutCheckResult = await dbPool.query(
        'SELECT email, rut FROM users WHERE rut = $1',
        [rut.trim()]
      );

      if (rutCheckResult.rows.length > 0) {
        const existingUser = rutCheckResult.rows[0];
        logger.warn(`Registration attempt with existing RUT: ${rut} (belongs to ${existingUser.email})`);
        return res.status(409).json(fail('EMAIL_009', `Este RUT ya está registrado en el sistema con el email: ${existingUser.email}`));
      }
    }

    // ============= VALIDACIONES EXITOSAS - PROCEDER A ENVIAR CÓDIGO =============

    // Generate 6-digit verification code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store verification code in database
    // First, delete any existing verification codes for this email
    await dbPool.query(
      'DELETE FROM email_verifications WHERE email = $1',
      [email.toLowerCase()]
    );

    // Insert new verification code
    await dbPool.query(
      `INSERT INTO email_verifications (email, code, expires_at, type, used, created_at)
       VALUES ($1, $2, $3, 'REGISTRATION', false, NOW())`,
      [email.toLowerCase(), verificationCode, expiresAt]
    );

    // Send email with verification code
    const subject = 'Código de Verificación - Colegio MTN';
    const message = `
Estimado/a ${firstName || ''} ${lastName || ''},

Tu código de verificación es: ${verificationCode}

Este código expirará en 15 minutos.

Si no solicitaste este código, por favor ignora este mensaje.

Saludos cordiales,
Colegio MTN
    `.trim();

    // Send email using email service
    let emailSent = false;
    let emailError = null;
    try {
      const emailResult = await emailService.sendEmail(email, subject, message);
      emailSent = true;
      logger.info(`Verification code sent to ${email}`, emailResult);
    } catch (error) {
      emailError = error.message;
      logger.error('Error sending verification email:', error);
      // Continue anyway - code is stored in DB
    }

    res.json(ok({
      message: 'Verification code sent successfully',
      email: email.toLowerCase(),
      expiresAt: expiresAt.toISOString(),
      emailSent, // Include whether email was actually sent
      ...(emailError && process.env.NODE_ENV !== 'production' && { emailError }) // Show error in dev
    }));
  } catch (error) {
    logger.error('Error sending verification code:', error);
    res.status(500).json(fail('EMAIL_004', 'Error sending verification code', error.message));
  }
});

/**
 * @route   POST /api/email/verify-code
 * @desc    Verify the code sent to email
 * @access  Public
 * @body    { email, code }
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(422).json(fail('EMAIL_005', 'Email and code are required'));
    }

    // Check verification code
    const result = await dbPool.query(
      `SELECT * FROM email_verifications
       WHERE email = $1 AND code = $2 AND expires_at > NOW() AND used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.toLowerCase(), code]
    );

    if (result.rows.length === 0) {
      return res.status(422).json(fail('EMAIL_006', 'Invalid or expired verification code'));
    }

    // Mark as verified (set used = true)
    await dbPool.query(
      'UPDATE email_verifications SET used = true, used_at = NOW() WHERE email = $1 AND code = $2',
      [email.toLowerCase(), code]
    );

    logger.info(`Email verified successfully: ${email}`);

    res.json(ok({
      isValid: true,
      verified: true,
      email: email.toLowerCase()
    }));
  } catch (error) {
    logger.error('Error verifying code:', error);
    res.status(500).json(fail('EMAIL_007', 'Error verifying code', error.message));
  }
});

/**
 * @route   POST /api/email/send-test
 * @desc    Send a test email (for testing purposes)
 * @access  Public (should be protected in production)
 * @body    { to, subject?, message?, firstName?, lastName? }
 */
router.post('/send-test', async (req, res) => {
  try {
    const { to, subject, message, firstName, lastName } = req.body;

    if (!to) {
      return res.status(422).json(fail('EMAIL_TEST_001', 'Recipient email (to) is required'));
    }

    // Default subject and message if not provided
    const emailSubject = subject || '🧪 Correo de Prueba - Sistema de Admisión MTN';
    const emailMessage = message || `
Hola ${firstName || 'Usuario'} ${lastName || ''},

Este es un correo de prueba del Sistema de Admisión del Colegio Monte Tabor y Nazaret (MTN).

📧 **Detalles del envío:**
- Fecha: ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}
- Sistema: Notification Service (Puerto 8085)
- Servidor SMTP: ${process.env.SMTP_HOST || 'smtp.gmail.com'}
- Modo: ${process.env.EMAIL_MOCK_MODE === 'true' ? 'SIMULACIÓN (no se envía realmente)' : 'PRODUCCIÓN (envío real)'}

✅ **Estado:**
Si recibes este correo, significa que el servicio de notificaciones está funcionando correctamente.

---

*Este es un mensaje automático generado por el Sistema de Admisión MTN.*
*Por favor, no respondas a este correo.*

Saludos cordiales,
**Equipo Técnico - Colegio MTN**
    `.trim();

    // Send email using email service
    logger.info(`📤 Sending test email to: ${to}`);

    try {
      const result = await emailService.sendEmail(to, emailSubject, emailMessage);

      logger.info(`✅ Test email sent successfully to ${to}`, {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      });

      res.json(ok({
        message: 'Test email sent successfully',
        recipient: to,
        subject: emailSubject,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        timestamp: new Date().toISOString(),
        mockMode: process.env.EMAIL_MOCK_MODE === 'true'
      }));
    } catch (emailError) {
      logger.error('❌ Error sending test email:', emailError);

      return res.status(500).json(fail('EMAIL_TEST_002', 'Failed to send test email', {
        error: emailError.message,
        details: emailError.stack,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER,
        mockMode: process.env.EMAIL_MOCK_MODE === 'true'
      }));
    }
  } catch (error) {
    logger.error('Error in send-test endpoint:', error);
    res.status(500).json(fail('EMAIL_TEST_003', 'Internal error sending test email', error.message));
  }
});

module.exports = router;
