/**
 * Document Model
 * Represents an application document with data conversion methods
 */

class Document {
  constructor(data) {
    this.id = data.id;
    this.applicationId = data.applicationId || data.application_id;
    this.documentType = data.documentType || data.document_type;
    this.fileName = data.fileName || data.file_name;
    this.filePath = data.filePath || data.file_path;
    this.fileSize = data.fileSize || data.file_size;
    this.mimeType = data.mimeType || data.mime_type;
    this.approvalStatus = data.approvalStatus || data.approval_status || 'PENDING';
    this.rejectionReason = data.rejectionReason || data.rejection_reason;
    this.uploadedBy = data.uploadedBy || data.uploaded_by;
    this.uploadedAt = data.uploadedAt || data.uploaded_at;
    this.approvedBy = data.approvedBy || data.approved_by;
    this.approvedAt = data.approvedAt || data.approved_at;
  }

  /**
   * Convert to JSON (camelCase)
   */
  toJSON() {
    return {
      id: this.id,
      applicationId: this.applicationId,
      documentType: this.documentType,
      fileName: this.fileName,
      filePath: this.filePath,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      approvalStatus: this.approvalStatus,
      rejectionReason: this.rejectionReason,
      uploadedBy: this.uploadedBy,
      uploadedAt: this.uploadedAt,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt
    };
  }

  /**
   * Convert to database format (snake_case)
   */
  toDatabase() {
    return {
      application_id: this.applicationId,
      document_type: this.documentType,
      file_name: this.fileName,
      file_path: this.filePath,
      file_size: this.fileSize,
      mime_type: this.mimeType,
      approval_status: this.approvalStatus,
      rejection_reason: this.rejectionReason,
      uploaded_by: this.uploadedBy,
      uploaded_at: this.uploadedAt,
      approved_by: this.approvedBy,
      approved_at: this.approvedAt
    };
  }

  /**
   * Check if document is approved
   */
  isApproved() {
    return this.approvalStatus === 'APPROVED';
  }

  /**
   * Check if document is pending
   */
  isPending() {
    return this.approvalStatus === 'PENDING';
  }

  /**
   * Check if document is rejected
   */
  isRejected() {
    return this.approvalStatus === 'REJECTED';
  }

  /**
   * Create Document from database row
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Document(row);
  }

  /**
   * Create multiple Documents from database rows
   */
  static fromDatabaseRows(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(row => Document.fromDatabaseRow(row));
  }
}

module.exports = Document;
