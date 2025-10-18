/**
 * Application Model
 * Represents a student application with data conversion methods
 */

class Application {
  constructor(data) {
    this.id = data.id;
    this.studentFirstName = data.studentFirstName || data.student_first_name;
    this.studentPaternalLastName = data.studentPaternalLastName || data.student_paternal_last_name;
    this.studentMaternalLastName = data.studentMaternalLastName || data.student_maternal_last_name;
    this.studentRUT = data.studentRUT || data.student_rut;
    this.studentDateOfBirth = data.studentDateOfBirth || data.student_date_of_birth;
    this.studentGender = data.studentGender || data.student_gender;
    this.gradeAppliedFor = data.gradeAppliedFor || data.grade_applied_for;
    this.guardianRUT = data.guardianRUT || data.guardian_rut;
    this.guardianEmail = data.guardianEmail || data.guardian_email;
    this.applicationYear = data.applicationYear || data.application_year;
    this.status = data.status;
    this.submittedAt = data.submittedAt || data.submitted_at;
    this.reviewedAt = data.reviewedAt || data.reviewed_at;
    this.reviewedBy = data.reviewedBy || data.reviewed_by;
    this.notes = data.notes;
    this.isArchived = data.isArchived !== undefined ? data.isArchived : data.is_archived;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  /**
   * Convert to JSON (camelCase with nested objects for frontend compatibility)
   */
  toJSON() {
    return {
      id: this.id,
      // Nested student object (frontend expects this structure)
      student: {
        firstName: this.studentFirstName,
        lastName: this.studentPaternalLastName, // Usar paternal como lastName principal
        paternalLastName: this.studentPaternalLastName,
        maternalLastName: this.studentMaternalLastName,
        rut: this.studentRUT,
        birthDate: this.studentDateOfBirth,
        gender: this.studentGender,
        gradeApplied: this.gradeAppliedFor
      },
      // Flat fields for backward compatibility
      studentFirstName: this.studentFirstName,
      studentPaternalLastName: this.studentPaternalLastName,
      studentMaternalLastName: this.studentMaternalLastName,
      studentRUT: this.studentRUT,
      status: this.status,
      submissionDate: this.submittedAt,
      isArchived: this.isArchived,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Additional fields
      applicationYear: this.applicationYear,
      reviewedAt: this.reviewedAt,
      reviewedBy: this.reviewedBy,
      notes: this.notes
    };
  }

  /**
   * Convert to database format (snake_case)
   */
  toDatabase() {
    return {
      student_first_name: this.studentFirstName,
      student_paternal_last_name: this.studentPaternalLastName,
      student_maternal_last_name: this.studentMaternalLastName,
      student_rut: this.studentRUT,
      student_date_of_birth: this.studentDateOfBirth,
      student_gender: this.studentGender,
      grade_applied_for: this.gradeAppliedFor,
      guardian_rut: this.guardianRUT,
      guardian_email: this.guardianEmail,
      application_year: this.applicationYear,
      status: this.status,
      submitted_at: this.submittedAt,
      reviewed_at: this.reviewedAt,
      reviewed_by: this.reviewedBy,
      notes: this.notes,
      is_archived: this.isArchived
    };
  }

  /**
   * Create Application from database row
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Application(row);
  }

  /**
   * Create multiple Applications from database rows
   */
  static fromDatabaseRows(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(row => Application.fromDatabaseRow(row));
  }
}

module.exports = Application;
