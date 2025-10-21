/**
 * Student Model
 * Represents a student with data conversion methods
 * Handles snake_case (DB) ↔ camelCase (API) conversion
 */

class Student {
  constructor(data) {
    this.id = data.id;
    this.firstName = data.firstName || data.first_name;
    this.paternalLastName = data.paternalLastName || data.paternal_last_name;
    this.maternalLastName = data.maternalLastName || data.maternal_last_name;
    this.rut = data.rut;
    this.birthDate = data.birthDate || data.birth_date;
    this.gradeApplied = data.gradeApplied || data.grade_applied;
    this.currentSchool = data.currentSchool || data.current_school;
    this.address = data.address;
    this.email = data.email;
    this.pais = data.pais || 'Chile';
    this.region = data.region;
    this.comuna = data.comuna;
    this.admissionPreference = data.admissionPreference || data.admission_preference;
    this.additionalNotes = data.additionalNotes || data.additional_notes;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  /**
   * Convert to JSON (camelCase for API responses)
   */
  toJSON() {
    return {
      id: this.id,
      firstName: this.firstName,
      paternalLastName: this.paternalLastName,
      maternalLastName: this.maternalLastName,
      fullName: this.getFullName(),
      rut: this.rut,
      birthDate: this.birthDate,
      gradeApplied: this.gradeApplied,
      currentSchool: this.currentSchool,
      address: this.address,
      email: this.email,
      pais: this.pais,
      region: this.region,
      comuna: this.comuna,
      admissionPreference: this.admissionPreference,
      additionalNotes: this.additionalNotes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Convert to database format (snake_case)
   */
  toDatabase() {
    return {
      first_name: this.firstName,
      paternal_last_name: this.paternalLastName,
      maternal_last_name: this.maternalLastName,
      rut: this.rut,
      birth_date: this.birthDate,
      grade_applied: this.gradeApplied,
      current_school: this.currentSchool,
      address: this.address,
      email: this.email,
      pais: this.pais,
      region: this.region,
      comuna: this.comuna,
      admission_preference: this.admissionPreference,
      additional_notes: this.additionalNotes
    };
  }

  /**
   * Create Student from database row (snake_case)
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Student(row);
  }

  /**
   * Create multiple Students from database rows
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => Student.fromDatabaseRow(row));
  }

  /**
   * Get full name
   */
  getFullName() {
    const parts = [
      this.firstName,
      this.paternalLastName,
      this.maternalLastName
    ].filter(Boolean);
    return parts.join(' ');
  }

  /**
   * Validate RUT format (Chilean ID)
   */
  static validateRUT(rut) {
    if (!rut) return false;

    // Remove dots and hyphens
    const cleaned = rut.replace(/[.-]/g, '');

    // Must be 8-9 digits + verification digit
    if (!/^[0-9]{7,8}[0-9Kk]$/.test(cleaned)) {
      return false;
    }

    // Extract number and verification digit
    const number = cleaned.slice(0, -1);
    const verificationDigit = cleaned.slice(-1).toUpperCase();

    // Calculate expected verification digit
    let sum = 0;
    let multiplier = 2;

    for (let i = number.length - 1; i >= 0; i--) {
      sum += parseInt(number[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = sum % 11;
    const expectedDigit = remainder === 0 ? '0' :
                         remainder === 1 ? 'K' :
                         String(11 - remainder);

    return verificationDigit === expectedDigit;
  }

  /**
   * Format RUT with dots and hyphen (12.345.678-9)
   */
  static formatRUT(rut) {
    if (!rut) return '';

    const cleaned = rut.replace(/[.-]/g, '');
    const number = cleaned.slice(0, -1);
    const digit = cleaned.slice(-1);

    // Add dots every 3 digits from right to left
    const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${formatted}-${digit}`;
  }
}

module.exports = Student;
