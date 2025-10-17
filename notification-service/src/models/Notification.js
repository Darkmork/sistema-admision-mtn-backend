class Notification {
  constructor(data) {
    this.id = data.id;
    this.recipientType = data.recipientType || data.recipient_type;
    this.recipientId = data.recipientId || data.recipient_id;
    this.recipientEmail = data.recipientEmail || data.recipient_email;
    this.recipientPhone = data.recipientPhone || data.recipient_phone;
    this.channel = data.channel || 'EMAIL';
    this.type = data.type;
    this.subject = data.subject;
    this.message = data.message;
    this.templateName = data.templateName || data.template_name;
    this.templateData = data.templateData || data.template_data;
    this.status = data.status || 'PENDING';
    this.sentAt = data.sentAt || data.sent_at;
    this.errorMessage = data.errorMessage || data.error_message;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      recipientType: this.recipientType,
      recipientId: this.recipientId,
      recipientEmail: this.recipientEmail,
      recipientPhone: this.recipientPhone,
      channel: this.channel,
      type: this.type,
      subject: this.subject,
      message: this.message,
      templateName: this.templateName,
      templateData: this.templateData,
      status: this.status,
      sentAt: this.sentAt,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabase() {
    return {
      recipient_type: this.recipientType,
      recipient_id: this.recipientId,
      recipient_email: this.recipientEmail,
      recipient_phone: this.recipientPhone,
      channel: this.channel,
      type: this.type,
      subject: this.subject,
      message: this.message,
      template_name: this.templateName,
      template_data: this.templateData ? JSON.stringify(this.templateData) : null,
      status: this.status,
      sent_at: this.sentAt,
      error_message: this.errorMessage
    };
  }

  static fromDatabaseRow(row) {
    if (!row) return null;
    if (row.template_data && typeof row.template_data === 'string') {
      row.template_data = JSON.parse(row.template_data);
    }
    return new Notification(row);
  }

  static fromDatabaseRows(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(row => Notification.fromDatabaseRow(row));
  }
}

module.exports = Notification;
