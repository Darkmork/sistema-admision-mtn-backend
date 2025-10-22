const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const createEmailTransporter = () => {
  if (process.env.EMAIL_MOCK_MODE === 'true') {
    logger.info('Email transport configured in MOCK mode');
    return {
      sendMail: async (mailOptions) => {
        logger.info('MOCK EMAIL:', { to: mailOptions.to, subject: mailOptions.subject });
        return { messageId: 'mock-' + Date.now(), accepted: [mailOptions.to] };
      }
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Verify connection asynchronously (non-blocking)
  transporter.verify()
    .then(() => {
      logger.info('✅ Email transport configured successfully (SendGrid)');
    })
    .catch((error) => {
      logger.warn('⚠️  Email transport verification failed (will retry on first send):', {
        message: error.message,
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER ? '***configured***' : 'not set'
      });
      // Don't throw - let the service start and fail on actual send if needed
    });

  return transporter;
};

module.exports = { createEmailTransporter };
