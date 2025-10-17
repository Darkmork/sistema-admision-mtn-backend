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

  transporter.verify((error) => {
    if (error) {
      logger.error('Email transport verification failed:', error);
    } else {
      logger.info('Email transport configured successfully');
    }
  });

  return transporter;
};

module.exports = { createEmailTransporter };
