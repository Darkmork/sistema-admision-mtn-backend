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
    this.mimeType = data.mimeType || data.content_type || data.mime_type; // Handle both column names
    this.originalName = data.originalName || data.original_name;
    this.isRequired = data.isRequired !== undefined ? data.isRequired : data.is_required;
    this.approvalStatus = data.approvalStatus || data.approval_status || 'PENDING';
    this.rejectionReason = data.rejectionReason || data.rejection_reason;
    this.uploadedAt = data.uploadedAt || data.created_at || data.uploaded_at;
    this.approvedBy = data.approvedBy || data.approved_by;
    this.approvedAt = data.approvedAt || data.approval_date || data.approved_at;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
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
      originalName: this.originalName,
      isRequired: this.isRequired,
      approvalStatus: this.approvalStatus,
      rejectionReason: this.rejectionReason,
      uploadedAt: this.uploadedAt,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
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
      content_type: this.mimeType,
      original_name: this.originalName,
      is_required: this.isRequired,
      approval_status: this.approvalStatus,
      rejection_reason: this.rejectionReason,
      approved_by: this.approvedBy,
      approval_date: this.approvedAt
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
