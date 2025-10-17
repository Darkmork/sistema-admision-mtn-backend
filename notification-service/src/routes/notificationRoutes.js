const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications with filters
 * @access  Private (ADMIN, COORDINATOR)
 * @query   recipientType, recipientId, channel, type, status, page, limit
 */
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  NotificationController.getAllNotifications
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID
 * @access  Private (ADMIN, COORDINATOR)
 */
router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  NotificationController.getNotificationById
);

/**
 * @route   POST /api/notifications/email
 * @desc    Send single email
 * @access  Private (ADMIN, COORDINATOR)
 * @body    { to, subject, message, templateName?, templateData?, type? }
 */
router.post(
  '/email',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  NotificationController.sendEmail
);

/**
 * @route   POST /api/notifications/sms
 * @desc    Send single SMS
 * @access  Private (ADMIN, COORDINATOR)
 * @body    { to, message, type? }
 */
router.post(
  '/sms',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  NotificationController.sendSMS
);

/**
 * @route   POST /api/notifications/email/bulk
 * @desc    Send bulk emails
 * @access  Private (ADMIN, COORDINATOR)
 * @body    { recipients: [{ to, subject, message, templateName?, templateData? }] }
 */
router.post(
  '/email/bulk',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  NotificationController.sendBulkEmail
);

/**
 * @route   POST /api/notifications/sms/bulk
 * @desc    Send bulk SMS
 * @access  Private (ADMIN, COORDINATOR)
 * @body    { recipients: [{ to, message }] }
 */
router.post(
  '/sms/bulk',
  authenticate,
  requireRole('ADMIN', 'COORDINATOR'),
  NotificationController.sendBulkSMS
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private (ADMIN)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  NotificationController.deleteNotification
);

module.exports = router;
