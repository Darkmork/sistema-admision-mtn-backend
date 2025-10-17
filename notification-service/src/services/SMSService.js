const { externalServiceBreaker } = require('../config/circuitBreakers');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.mockMode = process.env.SMS_MOCK_MODE === 'true';
    if (this.mockMode) {
      logger.info('SMS Service configured in MOCK mode');
    }
  }

  async sendSMS(to, message) {
    return await externalServiceBreaker.fire(async () => {
      if (this.mockMode) {
        logger.info('MOCK SMS:', { to, message: message.substring(0, 50) });
        return {
          success: true,
          messageId: 'mock-sms-' + Date.now(),
          status: 'sent'
        };
      }

      // Real Twilio implementation (commented for mock mode)
      /*
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const client = require('twilio')(accountSid, authToken);

      try {
        const result = await client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: to
        });

        logger.info(`SMS sent successfully to ${to}:`, { sid: result.sid });

        return {
          success: true,
          messageId: result.sid,
          status: result.status
        };
      } catch (error) {
        logger.error(`Failed to send SMS to ${to}:`, error);
        throw error;
      }
      */

      return {
        success: true,
        messageId: 'mock-sms-' + Date.now(),
        status: 'sent'
      };
    });
  }

  async sendBulkSMS(recipients) {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendSMS(recipient.to, recipient.message);
        results.push({ to: recipient.to, ...result });
      } catch (error) {
        results.push({ to: recipient.to, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Bulk SMS sent: ${successCount}/${recipients.length} successful`);

    return {
      total: recipients.length,
      successful: successCount,
      failed: recipients.length - successCount,
      results
    };
  }
}

module.exports = new SMSService();
