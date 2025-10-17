/**
 * Guardian Model
 * Represents an apoderado (guardian) in the system
 */

class Guardian {
  constructor(data = {}) {
    // Primary fields
    this.id = data.id;
    this.rut = data.rut;
    this.firstName = data.firstName || data.first_name;
    this.lastName = data.lastName || data.last_name;
    this.email = data.email;
    this.phone = data.phone;

    // Address fields
    this.address = data.address;
    this.commune = data.commune;
    this.city = data.city;
    this.region = data.region;

    // Additional fields
    this.relationship = data.relationship; // FATHER, MOTHER, TUTOR, OTHER
    this.occupation = data.occupation;
    this.workplace = data.workplace;
    this.workPhone = data.workPhone || data.work_phone;

    // Emergency contact
    this.emergencyContactName = data.emergencyContactName || data.emergency_contact_name;
    this.emergencyContactPhone = data.emergencyContactPhone || data.emergency_contact_phone;
    this.emergencyContactRelationship = data.emergencyContactRelationship || data.emergency_contact_relationship;

    // Metadata
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;

    // Associated user ID (if registered)
    this.userId = data.userId || data.user_id;
  }

  /**
   * Convert to JSON (camelCase for frontend)
   */
  toJSON() {
    return {
      id: this.id,
      rut: this.rut,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      address: this.address,
      commune: this.commune,
      city: this.city,
      region: this.region,
      relationship: this.relationship,
      occupation: this.occupation,
      workplace: this.workplace,
      workPhone: this.workPhone,
      emergencyContactName: this.emergencyContactName,
      emergencyContactPhone: this.emergencyContactPhone,
      emergencyContactRelationship: this.emergencyContactRelationship,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Convert to database format (snake_case)
   */
  toDatabase() {
    return {
      id: this.id,
      rut: this.rut,
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      phone: this.phone,
      address: this.address,
      commune: this.commune,
      city: this.city,
      region: this.region,
      relationship: this.relationship,
      occupation: this.occupation,
      workplace: this.workplace,
      work_phone: this.workPhone,
      emergency_contact_name: this.emergencyContactName,
      emergency_contact_phone: this.emergencyContactPhone,
      emergency_contact_relationship: this.emergencyContactRelationship,
      user_id: this.userId
    };
  }

  /**
   * Get full name
   */
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Create from database row
   */
  static fromDatabaseRow(row) {
    return new Guardian(row);
  }

  /**
   * Create multiple from database rows
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => Guardian.fromDatabaseRow(row));
  }
}

module.exports = Guardian;
