const NotificationService = require('../services/NotificationService');
const EmailService = require('../services/EmailService');
const SMSService = require('../services/SMSService');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class NotificationController {
  async getAllNotifications(req, res) {
    try {
      const { recipientType, recipientId, channel, type, status, page: pageNum = 0, limit = 10 } = req.query;
      const filters = {
        ...(recipientType && { recipientType }),
        ...(recipientId && { recipientId: parseInt(recipientId) }),
        ...(channel && { channel }),
        ...(type && { type }),
        ...(status && { status })
      };

      const result = await NotificationService.getAllNotifications(filters, parseInt(pageNum), parseInt(limit));

      return res.json(page(
        result.notifications.map(n => n.toJSON()),
        result.total,
        result.page,
        result.limit
      ));
    } catch (error) {
      logger.error('Error getting notifications:', error);
      return res.status(500).json(fail('NOTIF_001', 'Failed to retrieve notifications', error.message));
    }
  }

  async getNotificationById(req, res) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.getNotificationById(id);

      if (!notification) {
        return res.status(404).json(fail('NOTIF_002', `Notification ${id} not found`));
      }

      return res.json(ok(notification.toJSON()));
    } catch (error) {
      logger.error(`Error getting notification ${req.params.id}:`, error);
      return res.status(500).json(fail('NOTIF_003', 'Failed to retrieve notification', error.message));
    }
  }

  async sendEmail(req, res) {
    try {
      const { to, subject, message, templateName, templateData } = req.body;

      // Create notification record
      const notification = await NotificationService.createNotification({
        recipientEmail: to,
        channel: 'EMAIL',
        type: req.body.type || 'GENERAL',
        subject,
        message,
        templateName,
        templateData
      });

      // Send email
      try {
        const result = await EmailService.sendEmail(to, subject, message, templateName, templateData);
        await NotificationService.updateNotificationStatus(notification.id, 'SENT');

        return res.status(201).json(ok({
          notification: notification.toJSON(),
          emailResult: result
        }));
      } catch (emailError) {
        await NotificationService.updateNotificationStatus(notification.id, 'FAILED', emailError.message);
        throw emailError;
      }
    } catch (error) {
      logger.error('Error sending email:', error);
      return res.status(500).json(fail('NOTIF_004', 'Failed to send email', error.message));
    }
  }

  async sendSMS(req, res) {
    try {
      const { to, message } = req.body;

      // Create notification record
      const notification = await NotificationService.createNotification({
        recipientPhone: to,
        channel: 'SMS',
        type: req.body.type || 'GENERAL',
        message
      });

      // Send SMS
      try {
        const result = await SMSService.sendSMS(to, message);
        await NotificationService.updateNotificationStatus(notification.id, 'SENT');

        return res.status(201).json(ok({
          notification: notification.toJSON(),
          smsResult: result
        }));
      } catch (smsError) {
        await NotificationService.updateNotificationStatus(notification.id, 'FAILED', smsError.message);
        throw smsError;
      }
    } catch (error) {
      logger.error('Error sending SMS:', error);
      return res.status(500).json(fail('NOTIF_005', 'Failed to send SMS', error.message));
    }
  }

  async sendBulkEmail(req, res) {
    try {
      const { recipients } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json(fail('NOTIF_006', 'Recipients array is required and must not be empty'));
      }

      const result = await EmailService.sendBulkEmails(recipients);

      return res.json(ok(result));
    } catch (error) {
      logger.error('Error sending bulk email:', error);
      return res.status(500).json(fail('NOTIF_007', 'Failed to send bulk emails', error.message));
    }
  }

  async sendBulkSMS(req, res) {
    try {
      const { recipients } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json(fail('NOTIF_008', 'Recipients array is required and must not be empty'));
      }

      const result = await SMSService.sendBulkSMS(recipients);

      return res.json(ok(result));
    } catch (error) {
      logger.error('Error sending bulk SMS:', error);
      return res.status(500).json(fail('NOTIF_009', 'Failed to send bulk SMS', error.message));
    }
  }

  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.deleteNotification(id);

      if (!notification) {
        return res.status(404).json(fail('NOTIF_010', `Notification ${id} not found`));
      }

      return res.json(ok({ message: 'Notification deleted successfully', notification: notification.toJSON() }));
    } catch (error) {
      logger.error(`Error deleting notification ${req.params.id}:`, error);
      return res.status(500).json(fail('NOTIF_011', 'Failed to delete notification', error.message));
    }
  }
}

module.exports = new NotificationController();
