class Interview {
  constructor(data) {
    this.id = data.id;
    this.applicationId = data.applicationId || data.application_id;
    this.interviewerId = data.interviewerId || data.interviewer_id || data.interviewer_user_id;
    this.secondInterviewerId = data.secondInterviewerId || data.second_interviewer_id;
    this.interviewType = data.interviewType || data.interview_type || data.type;
    this.scheduledDate = data.scheduledDate || data.scheduled_date;
    this.scheduledTime = data.scheduledTime || data.scheduled_time;
    this.duration = data.duration;
    this.location = data.location;
    this.mode = data.mode;
    this.status = data.status || 'SCHEDULED';
    this.notes = data.notes;
    this.cancelReason = data.cancelReason || data.cancel_reason;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      applicationId: this.applicationId,
      interviewerId: this.interviewerId,
      secondInterviewerId: this.secondInterviewerId,
      interviewType: this.interviewType,
      scheduledDate: this.scheduledDate,
      scheduledTime: this.scheduledTime,
      duration: this.duration,
      location: this.location,
      mode: this.mode,
      status: this.status,
      notes: this.notes,
      cancelReason: this.cancelReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabase() {
    return {
      application_id: this.applicationId,
      interviewer_user_id: this.interviewerId,
      second_interviewer_id: this.secondInterviewerId,
      interview_type: this.interviewType,
      scheduled_date: this.scheduledDate,
      scheduled_time: this.scheduledTime,
      duration: this.duration,
      location: this.location,
      mode: this.mode,
      status: this.status,
      notes: this.notes,
      cancel_reason: this.cancelReason
    };
  }

  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Interview(row);
  }

  static fromDatabaseRows(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(row => Interview.fromDatabaseRow(row));
  }
}

module.exports = Interview;
