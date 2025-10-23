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
    this.studentDateOfBirth = data.studentDateOfBirth || data.student_date_of_birth || data.student_birth_date;
    this.studentGender = data.studentGender || data.student_gender;
    this.studentEmail = data.studentEmail || data.student_email;
    this.studentAddress = data.studentAddress || data.student_address;
    this.currentSchool = data.currentSchool || data.student_current_school;
    this.targetSchool = data.targetSchool || data.student_target_school;
    this.gradeAppliedFor = data.gradeAppliedFor || data.grade_applied_for || data.student_grade_applied;
    this.guardianRUT = data.guardianRUT || data.guardian_rut;
    this.guardianEmail = data.guardianEmail || data.guardian_email;
    this.applicationYear = data.applicationYear || data.application_year;
    this.status = data.status;
    this.submittedAt = data.submittedAt || data.submitted_at || data.submission_date;
    this.reviewedAt = data.reviewedAt || data.reviewed_at;
    this.reviewedBy = data.reviewedBy || data.reviewed_by;
    this.notes = data.notes;
    this.isArchived = data.isArchived !== undefined ? data.isArchived : data.is_archived;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;

    // Special categories
    this.isEmployeeChild = data.isEmployeeChild !== undefined ? data.isEmployeeChild : data.is_employee_child;
    this.employeeParentName = data.employeeParentName || data.employee_parent_name;
    this.isAlumniChild = data.isAlumniChild !== undefined ? data.isAlumniChild : data.is_alumni_child;
    this.alumniParentYear = data.alumniParentYear || data.alumni_parent_year;
    this.isInclusionStudent = data.isInclusionStudent !== undefined ? data.isInclusionStudent : data.is_inclusion_student;
    this.inclusionType = data.inclusionType || data.inclusion_type;
    this.inclusionNotes = data.inclusionNotes || data.inclusion_notes;

    // Related data
    this.guardians = data.guardians || [];
    this.parents = data.parents || [];
    this.documents = data.documents || [];
  }

  /**
   * Convert to JSON (camelCase with nested objects for frontend compatibility)
   */
  toJSON() {
    // Process guardians - there's only one guardian per application (one-to-one relationship)
    const mainGuardian = this.guardians[0] || null;

    // Process parents - separate father and mother
    const father = this.parents.find(p => p.parent_type === 'FATHER') || null;
    const mother = this.parents.find(p => p.parent_type === 'MOTHER') || null;

    return {
      id: this.id,
      // Nested student object (frontend expects this structure)
      student: {
        firstName: this.studentFirstName,
        lastName: this.studentPaternalLastName, // Usar paternal como lastName principal
        paternalLastName: this.studentPaternalLastName,
        maternalLastName: this.studentMaternalLastName,
        fullName: `${this.studentFirstName || ''} ${this.studentPaternalLastName || ''} ${this.studentMaternalLastName || ''}`.trim(),
        rut: this.studentRUT,
        birthDate: this.studentDateOfBirth,
        gender: this.studentGender,
        email: this.studentEmail,
        address: this.studentAddress,
        gradeApplied: this.gradeAppliedFor,
        currentSchool: this.currentSchool,
        targetSchool: this.targetSchool,
        // Special categories
        isEmployeeChild: this.isEmployeeChild,
        employeeParentName: this.employeeParentName,
        isAlumniChild: this.isAlumniChild,
        alumniParentYear: this.alumniParentYear,
        isInclusionStudent: this.isInclusionStudent,
        inclusionType: this.inclusionType,
        inclusionNotes: this.inclusionNotes
      },
      // Guardian information
      guardian: mainGuardian ? {
        fullName: mainGuardian.full_name,
        rut: mainGuardian.rut,
        email: mainGuardian.email,
        phone: mainGuardian.phone,
        relationship: mainGuardian.relationship
      } : null,
      // All guardians array
      guardians: this.guardians.map(g => ({
        id: g.id,
        fullName: g.full_name,
        rut: g.rut,
        email: g.email,
        phone: g.phone,
        relationship: g.relationship,
        profession: g.profession,
        workplace: g.workplace
      })),
      // Father information
      father: father ? {
        fullName: father.full_name,
        rut: father.rut,
        email: father.email,
        phone: father.phone,
        profession: father.profession
      } : null,
      // Mother information
      mother: mother ? {
        fullName: mother.full_name,
        rut: mother.rut,
        email: mother.email,
        phone: mother.phone,
        profession: mother.profession
      } : null,
      // Documents array
      documents: this.documents.map(d => ({
        id: d.id,
        documentType: d.document_type,
        fileName: d.file_name,
        filePath: d.file_path,
        fileSize: d.file_size,
        mimeType: d.content_type || d.mime_type, // Handle both column names
        approvalStatus: d.approval_status,
        uploadedAt: d.uploaded_at,
        approvedBy: d.approved_by,
        approvalDate: d.approval_date,
        rejectionReason: d.rejection_reason
      })),
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
      student_email: this.studentEmail,
      student_address: this.studentAddress,
      grade_applied_for: this.gradeAppliedFor,
      student_current_school: this.currentSchool,
      student_target_school: this.targetSchool,
      student_admission_preference: this.studentAdmissionPreference,
      student_additional_notes: this.studentAdditionalNotes,
      // Special categories
      is_employee_child: this.isEmployeeChild,
      employee_parent_name: this.employeeParentName,
      is_alumni_child: this.isAlumniChild,
      alumni_parent_year: this.alumniParentYear,
      is_inclusion_student: this.isInclusionStudent,
      inclusion_type: this.inclusionType,
      inclusion_notes: this.inclusionNotes,
      // Guardian info
      guardian_rut: this.guardianRUT,
      guardian_email: this.guardianEmail,
      // Application metadata
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
