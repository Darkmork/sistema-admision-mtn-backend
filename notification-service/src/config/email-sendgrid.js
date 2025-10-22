const sendGridMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

// Configure SendGrid API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.SMTP_PASSWORD;

if (SENDGRID_API_KEY && process.env.EMAIL_MOCK_MODE !== 'true') {
  try {
    sendGridMail.setApiKey(SENDGRID_API_KEY);
    logger.info('✅ SendGrid API configured successfully');
  } catch (error) {
    logger.error('❌ Failed to configure SendGrid API:', error);
  }
}

const createEmailTransporter = () => {
  if (process.env.EMAIL_MOCK_MODE === 'true') {
    logger.info('📧 Email transport configured in MOCK mode');
    return {
      sendMail: async (mailOptions) => {
        logger.info('MOCK EMAIL:', { to: mailOptions.to, subject: mailOptions.subject });
        return { messageId: 'mock-' + Date.now(), accepted: [mailOptions.to] };
      }
    };
  }

  // Return SendGrid API wrapper that mimics nodemailer interface
  return {
    sendMail: async (mailOptions) => {
      const message = {
        to: mailOptions.to,
        from: mailOptions.from || process.env.EMAIL_FROM || 'admision@mtn.cl',
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text
      };

      try {
        const response = await sendGridMail.send(message);
        logger.info(`✅ Email sent via SendGrid API to ${mailOptions.to}`);

        return {
          messageId: response[0].headers['x-message-id'],
          accepted: [mailOptions.to],
          rejected: []
        };
      } catch (error) {
        logger.error('❌ SendGrid API error:', {
          message: error.message,
          code: error.code,
          response: error.response?.body
        });
        throw error;
      }
    }
  };
};

module.exports = { createEmailTransporter };
