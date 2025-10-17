const { createEmailTransporter } = require('../config/email');
const { externalServiceBreaker } = require('../config/circuitBreakers');
const { renderTemplate } = require('../utils/templateEngine');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = createEmailTransporter();
  }

  async sendEmail(to, subject, message, templateName = null, templateData = null) {
    return await externalServiceBreaker.fire(async () => {
      try {
        let htmlContent = message;

        // Use template if provided
        if (templateName && templateData) {
          try {
            htmlContent = await renderTemplate(templateName, templateData);
          } catch (templateError) {
            logger.warn(`Failed to render template ${templateName}, using plain message:`, templateError);
          }
        }

        const mailOptions = {
          from: process.env.EMAIL_FROM || 'Admisión MTN <admision@mtn.cl>',
          to,
          subject,
          html: htmlContent,
          text: message // Fallback plain text
        };

        const result = await this.transporter.sendMail(mailOptions);

        logger.info(`Email sent successfully to ${to}:`, { messageId: result.messageId });

        return {
          success: true,
          messageId: result.messageId,
          accepted: result.accepted,
          rejected: result.rejected
        };
      } catch (error) {
        logger.error(`Failed to send email to ${to}:`, error);
        throw error;
      }
    });
  }

  async sendBulkEmails(recipients) {
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendEmail(
          recipient.to,
          recipient.subject,
          recipient.message,
          recipient.templateName,
          recipient.templateData
        );
        results.push({ to: recipient.to, ...result });
      } catch (error) {
        results.push({ to: recipient.to, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`Bulk email sent: ${successCount}/${recipients.length} successful`);

    return {
      total: recipients.length,
      successful: successCount,
      failed: recipients.length - successCount,
      results
    };
  }
}

module.exports = new EmailService();
