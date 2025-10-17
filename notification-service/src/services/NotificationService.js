const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

class NotificationService {
  async getAllNotifications(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { recipientType, recipientId, channel, type, status } = filters;
      const offset = page * limit;

      let query = 'SELECT * FROM notifications WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (recipientType) {
        query += ` AND recipient_type = $${paramIndex++}`;
        params.push(recipientType);
      }
      if (recipientId) {
        query += ` AND recipient_id = $${paramIndex++}`;
        params.push(recipientId);
      }
      if (channel) {
        query += ` AND channel = $${paramIndex++}`;
        params.push(channel);
      }
      if (type) {
        query += ` AND type = $${paramIndex++}`;
        params.push(type);
      }
      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      let countQuery = 'SELECT COUNT(*) FROM notifications WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (recipientType) {
        countQuery += ` AND recipient_type = $${countIndex++}`;
        countParams.push(recipientType);
      }
      if (recipientId) {
        countQuery += ` AND recipient_id = $${countIndex++}`;
        countParams.push(recipientId);
      }
      if (channel) {
        countQuery += ` AND channel = $${countIndex++}`;
        countParams.push(channel);
      }
      if (type) {
        countQuery += ` AND type = $${countIndex++}`;
        countParams.push(type);
      }
      if (status) {
        countQuery += ` AND status = $${countIndex++}`;
        countParams.push(status);
      }

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} notifications`);

      return {
        notifications: Notification.fromDatabaseRows(result.rows),
        total,
        page,
        limit
      };
    });
  }

  async getNotificationById(id) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query('SELECT * FROM notifications WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;
      logger.info(`Retrieved notification ${id}`);
      return Notification.fromDatabaseRow(result.rows[0]);
    });
  }

  async createNotification(notificationData) {
    return await writeOperationBreaker.fire(async () => {
      const notification = new Notification(notificationData);
      const dbData = notification.toDatabase();

      const result = await dbPool.query(
        `INSERT INTO notifications (
          recipient_type, recipient_id, recipient_email, recipient_phone,
          channel, type, subject, message, template_name, template_data, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          dbData.recipient_type, dbData.recipient_id, dbData.recipient_email,
          dbData.recipient_phone, dbData.channel, dbData.type, dbData.subject,
          dbData.message, dbData.template_name, dbData.template_data, 'PENDING'
        ]
      );

      logger.info(`Created notification ${result.rows[0].id}`);
      return Notification.fromDatabaseRow(result.rows[0]);
    });
  }

  async updateNotificationStatus(id, status, errorMessage = null) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query(
        `UPDATE notifications
         SET status = $1, error_message = $2, sent_at = CASE WHEN $1 = 'SENT' THEN NOW() ELSE sent_at END, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, errorMessage, id]
      );

      if (result.rows.length === 0) return null;

      logger.info(`Updated notification ${id} status to ${status}`);
      return Notification.fromDatabaseRow(result.rows[0]);
    });
  }

  async deleteNotification(id) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return null;
      logger.info(`Deleted notification ${id}`);
      return Notification.fromDatabaseRow(result.rows[0]);
    });
  }
}

module.exports = new NotificationService();
