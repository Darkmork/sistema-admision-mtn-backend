const { dbPool } = require('../config/database');
const { simpleQueryBreaker, mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Guardian = require('../models/Guardian');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

class GuardianService {
  /**
   * Get all guardians with pagination and filters
   */
  async getAllGuardians(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { relationship, search } = filters;
      const offset = page * limit;

      let query = 'SELECT * FROM guardians WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (relationship) {
        query += ` AND relationship = $${paramIndex++}`;
        params.push(relationship);
      }

      if (search) {
        query += ` AND (first_name ILIKE $${paramIndex++} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR rut ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM guardians WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (relationship) {
        countQuery += ` AND relationship = $${countIndex++}`;
        countParams.push(relationship);
      }

      if (search) {
        countQuery += ` AND (first_name ILIKE $${countIndex} OR last_name ILIKE $${countIndex} OR email ILIKE $${countIndex} OR rut ILIKE $${countIndex})`;
        countParams.push(`%${search}%`);
      }

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} guardians`);

      return {
        guardians: Guardian.fromDatabaseRows(result.rows),
        total,
        page,
        limit
      };
    });
  }

  /**
   * Get guardian by ID
   */
  async getGuardianById(id) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM guardians WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved guardian ${id}`);
      return Guardian.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get guardian by RUT
   */
  async getGuardianByRut(rut) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM guardians WHERE rut = $1',
        [rut]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved guardian by RUT ${rut}`);
      return Guardian.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get guardian by email
   */
  async getGuardianByEmail(email) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM guardians WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved guardian by email ${email}`);
      return Guardian.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get guardians by user ID
   */
  async getGuardiansByUserId(userId) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM guardians WHERE user_id = $1',
        [userId]
      );

      logger.info(`Retrieved guardians for user ${userId}`);
      return Guardian.fromDatabaseRows(result.rows);
    });
  }

  /**
   * Create new guardian
   */
  async createGuardian(guardianData) {
    return await writeOperationBreaker.fire(async () => {
      const guardian = new Guardian(guardianData);
      const dbData = guardian.toDatabase();

      // Check if RUT already exists
      const existing = await this.getGuardianByRut(guardian.rut);
      if (existing) {
        throw new Error('RUT already registered');
      }

      // Check if email already exists
      const existingEmail = await this.getGuardianByEmail(guardian.email);
      if (existingEmail) {
        throw new Error('Email already registered');
      }

      const result = await dbPool.query(
        `INSERT INTO guardians (
          rut, first_name, last_name, email, phone,
          address, commune, city, region,
          relationship, occupation, workplace, work_phone,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relationship
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          dbData.rut, dbData.first_name, dbData.last_name, dbData.email, dbData.phone,
          dbData.address, dbData.commune, dbData.city, dbData.region,
          dbData.relationship, dbData.occupation, dbData.workplace, dbData.work_phone,
          dbData.emergency_contact_name, dbData.emergency_contact_phone, dbData.emergency_contact_relationship
        ]
      );

      const createdGuardian = Guardian.fromDatabaseRow(result.rows[0]);

      // Create user account with APODERADO role
      try {
        const hashedPassword = await bcrypt.hash(guardian.rut, parseInt(process.env.BCRYPT_ROUNDS || '8', 10));

        const userResult = await dbPool.query(
          `INSERT INTO users (
            email, password, role, first_name, last_name, rut, phone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id`,
          [
            guardian.email,
            hashedPassword,
            'APODERADO',
            guardian.firstName,
            guardian.lastName,
            guardian.rut,
            guardian.phone
          ]
        );

        // Link guardian to user
        await dbPool.query(
          'UPDATE guardians SET user_id = $1 WHERE id = $2',
          [userResult.rows[0].id, createdGuardian.id]
        );

        createdGuardian.userId = userResult.rows[0].id;

        logger.info(`Created user account for guardian ${createdGuardian.id}`);
      } catch (userError) {
        logger.warn(`Failed to create user account for guardian ${createdGuardian.id}:`, userError.message);
        // Continue without user account - guardian is still created
      }

      logger.info(`Created guardian ${createdGuardian.id}`);
      return createdGuardian;
    });
  }

  /**
   * Update guardian
   */
  async updateGuardian(id, updateData) {
    return await writeOperationBreaker.fire(async () => {
      // Check if guardian exists
      const existing = await this.getGuardianById(id);
      if (!existing) {
        return null;
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramIndex = 1;

      const fieldMap = {
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        phone: 'phone',
        address: 'address',
        commune: 'commune',
        city: 'city',
        region: 'region',
        relationship: 'relationship',
        occupation: 'occupation',
        workplace: 'workplace',
        workPhone: 'work_phone',
        emergencyContactName: 'emergency_contact_name',
        emergencyContactPhone: 'emergency_contact_phone',
        emergencyContactRelationship: 'emergency_contact_relationship'
      };

      for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
        if (updateData[jsKey] !== undefined) {
          updates.push(`${dbKey} = $${paramIndex++}`);
          values.push(updateData[jsKey]);
        }
      }

      if (updates.length === 0) {
        return existing;
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      const query = `UPDATE guardians SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await dbPool.query(query, values);

      logger.info(`Updated guardian ${id}`);
      return Guardian.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Delete guardian
   */
  async deleteGuardian(id) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query(
        'DELETE FROM guardians WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Deleted guardian ${id}`);
      return Guardian.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get guardian statistics
   */
  async getGuardianStats() {
    return await simpleQueryBreaker.fire(async () => {
      const totalResult = await dbPool.query('SELECT COUNT(*) FROM guardians');
      const total = parseInt(totalResult.rows[0].count);

      const relationshipResult = await dbPool.query(
        `SELECT relationship, COUNT(*) as count
         FROM guardians
         GROUP BY relationship
         ORDER BY count DESC`
      );

      const stats = {
        total,
        byRelationship: relationshipResult.rows.map(row => ({
          relationship: row.relationship,
          count: parseInt(row.count)
        }))
      };

      logger.info('Retrieved guardian statistics');
      return stats;
    });
  }
}

module.exports = new GuardianService();
