/**
 * Student Service
 * Business logic for student management
 */

const { dbPool } = require('../config/database');
const { simpleQueryBreaker, mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Student = require('../models/Student');
const logger = require('../utils/logger');

class StudentService {
  /**
   * Get all students with pagination and filtering
   */
  async getAllStudents(filters = {}) {
    return await mediumQueryBreaker.fire(async () => {
      const { page = 0, limit = 50, gradeApplied, search } = filters;
      const offset = parseInt(page) * parseInt(limit);

      let query = 'SELECT * FROM students WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      // Filter by grade
      if (gradeApplied) {
        query += ` AND grade_applied = $${paramIndex}`;
        params.push(gradeApplied);
        paramIndex++;
      }

      // Search by name or RUT
      if (search) {
        const searchTerm = `%${search.toLowerCase()}%`;
        query += ` AND (
          LOWER(first_name) LIKE $${paramIndex} OR
          LOWER(paternal_last_name) LIKE $${paramIndex} OR
          LOWER(maternal_last_name) LIKE $${paramIndex} OR
          LOWER(rut) LIKE $${paramIndex}
        )`;
        params.push(searchTerm);
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), offset);

      const result = await dbPool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
      const countParams = [];
      let countParamIndex = 1;

      if (gradeApplied) {
        countQuery += ` AND grade_applied = $${countParamIndex}`;
        countParams.push(gradeApplied);
        countParamIndex++;
      }

      if (search) {
        const searchTerm = `%${search.toLowerCase()}%`;
        countQuery += ` AND (
          LOWER(first_name) LIKE $${countParamIndex} OR
          LOWER(paternal_last_name) LIKE $${countParamIndex} OR
          LOWER(maternal_last_name) LIKE $${countParamIndex} OR
          LOWER(rut) LIKE $${countParamIndex}
        )`;
        countParams.push(searchTerm);
      }

      const countResult = await dbPool.query(countQuery, countParams);

      logger.info(`Retrieved ${result.rows.length} students (page ${page}, limit ${limit})`);

      return {
        students: Student.fromDatabaseRows(result.rows),
        total: parseInt(countResult.rows[0].total),
        page: parseInt(page),
        limit: parseInt(limit)
      };
    });
  }

  /**
   * Get student by ID
   */
  async getStudentById(id) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM students WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved student ${id}`);
      return Student.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get student by RUT
   */
  async getStudentByRUT(rut) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM students WHERE rut = $1',
        [rut]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Retrieved student by RUT: ${rut}`);
      return Student.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get students by guardian ID
   */
  async getStudentsByGuardian(guardianId) {
    return await simpleQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM students WHERE guardian_id = $1 ORDER BY created_at DESC',
        [guardianId]
      );

      logger.info(`Retrieved ${result.rows.length} students for guardian ${guardianId}`);
      return Student.fromDatabaseRows(result.rows);
    });
  }

  /**
   * Create new student
   */
  async createStudent(studentData) {
    return await writeOperationBreaker.fire(async () => {
      const student = new Student(studentData);
      const dbData = student.toDatabase();

      const result = await dbPool.query(
        `INSERT INTO students (
          first_name, paternal_last_name, maternal_last_name, rut,
          birth_date, grade_applied, current_school, address,
          email, pais, region, comuna, admission_preference, additional_notes,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING *`,
        [
          dbData.first_name,
          dbData.paternal_last_name,
          dbData.maternal_last_name,
          dbData.rut,
          dbData.birth_date,
          dbData.grade_applied,
          dbData.current_school,
          dbData.address,
          dbData.email,
          dbData.pais,
          dbData.region,
          dbData.comuna,
          dbData.admission_preference,
          dbData.additional_notes
        ]
      );

      logger.info(`Created student ${result.rows[0].id} (RUT: ${dbData.rut})`);
      return Student.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Update student
   */
  async updateStudent(id, studentData) {
    return await writeOperationBreaker.fire(async () => {
      const student = new Student(studentData);
      const dbData = student.toDatabase();

      const result = await dbPool.query(
        `UPDATE students
         SET first_name = $1,
             paternal_last_name = $2,
             maternal_last_name = $3,
             rut = $4,
             birth_date = $5,
             grade_applied = $6,
             current_school = $7,
             address = $8,
             email = $9,
             pais = $10,
             region = $11,
             comuna = $12,
             admission_preference = $13,
             additional_notes = $14,
             updated_at = NOW()
         WHERE id = $15
         RETURNING *`,
        [
          dbData.first_name,
          dbData.paternal_last_name,
          dbData.maternal_last_name,
          dbData.rut,
          dbData.birth_date,
          dbData.grade_applied,
          dbData.current_school,
          dbData.address,
          dbData.email,
          dbData.pais,
          dbData.region,
          dbData.comuna,
          dbData.admission_preference,
          dbData.additional_notes,
          id
        ]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated student ${id}`);
      return Student.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Delete student (checks for FK constraints)
   */
  async deleteStudent(id) {
    return await writeOperationBreaker.fire(async () => {
      // Check if student is referenced in applications
      const applicationsCheck = await dbPool.query(
        'SELECT COUNT(*) as count FROM applications WHERE student_id = $1',
        [id]
      );

      const applicationCount = parseInt(applicationsCheck.rows[0].count);

      if (applicationCount > 0) {
        throw new Error(
          `Cannot delete student ${id}: referenced in ${applicationCount} application(s). ` +
          `Consider archiving the applications first.`
        );
      }

      // Get student before deleting
      const student = await this.getStudentById(id);
      if (!student) {
        return null;
      }

      // Delete student
      await dbPool.query('DELETE FROM students WHERE id = $1', [id]);

      logger.info(`Deleted student ${id} (RUT: ${student.rut})`);
      return student;
    });
  }

  /**
   * Get students by grade
   */
  async getStudentsByGrade(gradeApplied) {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        'SELECT * FROM students WHERE grade_applied = $1 ORDER BY created_at DESC',
        [gradeApplied]
      );

      logger.info(`Retrieved ${result.rows.length} students for grade ${gradeApplied}`);
      return Student.fromDatabaseRows(result.rows);
    });
  }

  /**
   * Search students by name or RUT
   */
  async searchStudents(searchTerm) {
    return await mediumQueryBreaker.fire(async () => {
      const term = `%${searchTerm.toLowerCase()}%`;

      const result = await dbPool.query(
        `SELECT * FROM students
         WHERE LOWER(first_name) LIKE $1
            OR LOWER(paternal_last_name) LIKE $1
            OR LOWER(maternal_last_name) LIKE $1
            OR LOWER(rut) LIKE $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [term]
      );

      logger.info(`Found ${result.rows.length} students matching "${searchTerm}"`);
      return Student.fromDatabaseRows(result.rows);
    });
  }

  /**
   * Check for duplicate RUT
   */
  async checkDuplicateRUT(rut, excludeId = null) {
    return await simpleQueryBreaker.fire(async () => {
      let query = 'SELECT id, first_name, paternal_last_name, maternal_last_name FROM students WHERE rut = $1';
      const params = [rut];

      if (excludeId) {
        query += ' AND id != $2';
        params.push(excludeId);
      }

      const result = await dbPool.query(query, params);

      return result.rows.length > 0 ? result.rows[0] : null;
    });
  }

  /**
   * Get statistics by grade
   */
  async getStatisticsByGrade() {
    return await mediumQueryBreaker.fire(async () => {
      const result = await dbPool.query(
        `SELECT grade_applied, COUNT(*) as count
         FROM students
         GROUP BY grade_applied
         ORDER BY grade_applied`
      );

      logger.info('Retrieved student statistics by grade');
      return result.rows.map(row => ({
        gradeApplied: row.grade_applied,
        count: parseInt(row.count)
      }));
    });
  }
}

module.exports = new StudentService();
