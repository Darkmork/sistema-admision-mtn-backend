const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporterInstance = null;

const createEmailTransporter = () => {
  // Return cached instance if exists
  if (transporterInstance) {
    return transporterInstance;
  }

  if (process.env.EMAIL_MOCK_MODE === 'true') {
    logger.info('📧 Email transport configured in MOCK mode');
    transporterInstance = {
      sendMail: async (mailOptions) => {
        logger.info('MOCK EMAIL:', { to: mailOptions.to, subject: mailOptions.subject });
        return { messageId: 'mock-' + Date.now(), accepted: [mailOptions.to] };
      }
    };
    return transporterInstance;
  }

  try {
    logger.info('📧 Creating email transporter...');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      // Don't verify on creation - verify lazily on first send
      pool: false,
      logger: false,
      debug: false
    });

    // Verify connection asynchronously (non-blocking) - AFTER returning transporter
    setImmediate(() => {
      transporter.verify()
        .then(() => {
          logger.info('✅ Email transport verified successfully (SendGrid)');
        })
        .catch((error) => {
          logger.warn('⚠️  Email transport verification failed (will retry on send):', {
            message: error.message,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT
          });
        });
    });

    transporterInstance = transporter;
    return transporter;
  } catch (error) {
    logger.error('❌ Failed to create email transporter:', error);
    // Return mock transporter as fallback
    transporterInstance = {
      sendMail: async () => {
        throw new Error('Email transporter not configured');
      }
    };
    return transporterInstance;
  }
};

module.exports = { createEmailTransporter };
