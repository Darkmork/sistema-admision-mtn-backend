/**
 * Application Service
 * Business logic for application management
 */

const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker } = require('../config/circuitBreakers');
const Application = require('../models/Application');
const logger = require('../utils/logger');

class ApplicationService {
  /**
   * Get all applications with pagination and filters
   */
  async getAllApplications(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { status, applicationYear, guardianRUT } = filters;
      const offset = page * limit;

      // Include student data with LEFT JOIN
      let query = `
        SELECT a.*,
               s.rut as student_rut,
               s.first_name as student_first_name,
               s.paternal_last_name as student_paternal_last_name,
               s.maternal_last_name as student_maternal_last_name,
               s.grade_applied as student_grade_applied
        FROM applications a
        LEFT JOIN students s ON a.student_id = s.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND a.status = $${paramIndex++}`;
        params.push(status);
      }

      if (applicationYear) {
        query += ` AND a.application_year = $${paramIndex++}`;
        params.push(applicationYear);
      }

      if (guardianRUT) {
        query += ` AND a.guardian_rut = $${paramIndex++}`;
        params.push(guardianRUT);
      }

      query += '';
      query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(limit, offset);

      const result = await dbPool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM applications WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (status) {
        countQuery += ` AND status = $${countIndex++}`;
        countParams.push(status);
      }

      if (applicationYear) {
        countQuery += ` AND application_year = $${countIndex++}`;
        countParams.push(applicationYear);
      }

      if (guardianRUT) {
        countQuery += ` AND guardian_rut = $${countIndex++}`;
        countParams.push(guardianRUT);
      }

      const countResult = await dbPool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      logger.info(`Retrieved ${result.rows.length} applications (page ${page}, total ${total})`);

      return {
        applications: Application.fromDatabaseRows(result.rows),
        total,
        page,
        limit
      };
    });
  }

  /**
   * Get application by ID with all related data (student, parents, documents)
   * Based on the original backend implementation
   */
  async getApplicationById(id) {
    return await mediumQueryBreaker.fire(async () => {
      // Main application query with complete student and parent information
      const appQuery = `
        SELECT
          a.*,

          -- Student information
          s.id as student_id,
          s.first_name as student_first_name,
          s.paternal_last_name as student_paternal_last_name,
          s.maternal_last_name as student_maternal_last_name,
          s.rut as student_rut,
          s.birth_date as student_birth_date,
          s.grade_applied as student_grade,
          s.current_school as student_current_school,
          s.address as student_address,
          s.admission_preference as student_admission_preference,
          s.email as student_email,
          s.additional_notes as student_notes,
          s.pais as student_pais,
          s.region as student_region,
          s.comuna as student_comuna,

          -- Father information
          f.id as father_id,
          f.full_name as father_name,
          f.rut as father_rut,
          f.email as father_email,
          f.phone as father_phone,
          f.profession as father_profession,
          f.address as father_address,

          -- Mother information
          m.id as mother_id,
          m.full_name as mother_name,
          m.rut as mother_rut,
          m.email as mother_email,
          m.phone as mother_phone,
          m.profession as mother_profession,
          m.address as mother_address,

          -- Applicant user information (guardian who created the application)
          au.email as applicant_email,
          au.first_name as applicant_first_name,
          au.last_name as applicant_last_name

        FROM applications a
        LEFT JOIN students s ON s.id = a.student_id
        LEFT JOIN parents f ON f.id = a.father_id AND f.parent_type = 'FATHER'
        LEFT JOIN parents m ON m.id = a.mother_id AND m.parent_type = 'MOTHER'
        LEFT JOIN users au ON au.id = a.applicant_user_id
        WHERE a.id = $1
      `;

      const result = await dbPool.query(appQuery, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Get documents data
      const documentsQuery = `
        SELECT
          d.id,
          d.document_type as name,
          d.created_at as upload_date,
          d.file_path,
          d.file_name,
          d.original_name,
          d.file_size,
          d.is_required,
          d.approval_status,
          d.reviewed_at,
          d.reviewed_by
        FROM documents d
        WHERE d.application_id = $1
        ORDER BY d.created_at DESC
      `;
      const documentsResult = await dbPool.query(documentsQuery, [id]);

      // Build the complete application object matching original backend structure
      const appData = {
        ...row,
        student: {
          id: row.student_id,
          firstName: row.student_first_name,
          paternalLastName: row.student_paternal_last_name,
          maternalLastName: row.student_maternal_last_name || '',
          lastName: `${row.student_paternal_last_name || ''} ${row.student_maternal_last_name || ''}`.trim(),
          fullName: `${row.student_first_name || ''} ${row.student_paternal_last_name || ''} ${row.student_maternal_last_name || ''}`.trim(),
          rut: row.student_rut,
          birthDate: row.student_birth_date,
          gradeApplied: row.student_grade,
          currentSchool: row.student_current_school || 'No especificado',
          address: row.student_address || 'Dirección no especificada',
          email: row.student_email,
          notes: row.student_notes,
          age: row.student_birth_date ? new Date().getFullYear() - new Date(row.student_birth_date).getFullYear() : null,
          pais: row.student_pais || 'Chile',
          region: row.student_region,
          comuna: row.student_comuna,
          admissionPreference: row.student_admission_preference || 'NINGUNA'
        },
        father: row.father_id ? {
          id: row.father_id,
          fullName: row.father_name,
          rut: row.father_rut,
          email: row.father_email,
          phone: row.father_phone,
          profession: row.father_profession,
          address: row.father_address
        } : null,
        mother: row.mother_id ? {
          id: row.mother_id,
          fullName: row.mother_name,
          rut: row.mother_rut,
          email: row.mother_email,
          phone: row.mother_phone,
          profession: row.mother_profession,
          address: row.mother_address
        } : null,
        applicantUser: row.applicant_email ? {
          email: row.applicant_email,
          firstName: row.applicant_first_name,
          lastName: row.applicant_last_name
        } : null,
        documents: documentsResult.rows.map(doc => ({
          id: doc.id,
          name: doc.name,
          fileName: doc.file_name,
          originalName: doc.original_name,
          uploadDate: doc.upload_date,
          filePath: doc.file_path,
          fileSize: doc.file_size,
          isRequired: doc.is_required,
          approval_status: doc.approval_status,
          reviewed_at: doc.reviewed_at,
          reviewed_by: doc.reviewed_by
        }))
      };

      logger.info(`Retrieved application ${id} with ${row.father_id ? 1 : 0} father, ${row.mother_id ? 1 : 0} mother, ${documentsResult.rows.length} documents`);
      return Application.fromDatabaseRow(appData);
    });
  }

  /**
   * Create new application
   */
  async createApplication(applicationData) {
    return await writeOperationBreaker.fire(async () => {
      // The applications table uses foreign keys to students, parents, guardians, supporters
      // We need to create those records first, then link them in applications table

      // Step 1: Create student record
      const studentResult = await dbPool.query(
        `INSERT INTO students (
          first_name, paternal_last_name, maternal_last_name,
          rut, birth_date, grade_applied, current_school, address, email,
          admission_preference, pais, region, comuna, additional_notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING id`,
        [
          applicationData.studentFirstName,
          applicationData.studentPaternalLastName,
          applicationData.studentMaternalLastName || '',
          applicationData.studentRUT,
          applicationData.studentDateOfBirth,
          applicationData.gradeAppliedFor,
          applicationData.studentCurrentSchool || '',
          applicationData.studentAddress || '',
          applicationData.studentEmail || '',
          applicationData.studentAdmissionPreference || 'NINGUNA',
          applicationData.studentPais || 'Chile',
          applicationData.studentRegion || '',
          applicationData.studentComuna || '',
          applicationData.studentAdditionalNotes || ''
        ]
      );
      const studentId = studentResult.rows[0].id;
      logger.info(`Created student ${studentId}`);

      // Step 2: Create father record (if data provided)
      // Note: All fields are NOT NULL in parents table, so we need complete data
      let fatherId = null;
      if (applicationData.parent1Name && applicationData.parent1Rut &&
          applicationData.parent1Email && applicationData.parent1Phone &&
          applicationData.parent1Address && applicationData.parent1Profession) {
        const fatherResult = await dbPool.query(
          `INSERT INTO parents (
            full_name, rut, email, phone, address, profession, parent_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING id`,
          [
            applicationData.parent1Name,
            applicationData.parent1Rut,
            applicationData.parent1Email,
            applicationData.parent1Phone,
            applicationData.parent1Address,
            applicationData.parent1Profession,
            'FATHER'
          ]
        );
        fatherId = fatherResult.rows[0].id;
        logger.info(`Created father ${fatherId}`);
      } else {
        logger.info('Skipping father creation - incomplete data');
      }

      // Step 3: Create mother record (if data provided)
      // Note: All fields are NOT NULL in parents table, so we need complete data
      let motherId = null;
      if (applicationData.parent2Name && applicationData.parent2Rut &&
          applicationData.parent2Email && applicationData.parent2Phone &&
          applicationData.parent2Address && applicationData.parent2Profession) {
        const motherResult = await dbPool.query(
          `INSERT INTO parents (
            full_name, rut, email, phone, address, profession, parent_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING id`,
          [
            applicationData.parent2Name,
            applicationData.parent2Rut,
            applicationData.parent2Email,
            applicationData.parent2Phone,
            applicationData.parent2Address,
            applicationData.parent2Profession,
            'MOTHER'
          ]
        );
        motherId = motherResult.rows[0].id;
        logger.info(`Created mother ${motherId}`);
      } else {
        logger.info('Skipping mother creation - incomplete data');
      }

      // Step 4: Create guardian record (if data provided)
      // Note: All fields are NOT NULL in guardians table, so we need complete data
      let guardianId = null;
      if (applicationData.guardianName && applicationData.guardianRut &&
          applicationData.guardianEmail && applicationData.guardianPhone &&
          applicationData.guardianRelation) {
        const guardianResult = await dbPool.query(
          `INSERT INTO guardians (
            full_name, rut, email, phone, relationship, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING id`,
          [
            applicationData.guardianName,
            applicationData.guardianRut,
            applicationData.guardianEmail,
            applicationData.guardianPhone,
            applicationData.guardianRelation
          ]
        );
        guardianId = guardianResult.rows[0].id;
        logger.info(`Created guardian ${guardianId}`);
      } else {
        logger.info('Skipping guardian creation - incomplete data');
      }

      // Step 5: Create supporter record (if data provided)
      // Note: All fields are NOT NULL in supporters table, so we need complete data
      let supporterId = null;
      if (applicationData.supporterName && applicationData.supporterRut &&
          applicationData.supporterEmail && applicationData.supporterPhone &&
          applicationData.supporterRelation) {
        const supporterResult = await dbPool.query(
          `INSERT INTO supporters (
            full_name, rut, email, phone, relationship, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING id`,
          [
            applicationData.supporterName,
            applicationData.supporterRut,
            applicationData.supporterEmail,
            applicationData.supporterPhone,
            applicationData.supporterRelation
          ]
        );
        supporterId = supporterResult.rows[0].id;
        logger.info(`Created supporter ${supporterId}`);
      } else {
        logger.info('Skipping supporter creation - incomplete data');
      }

      // Step 6: Create application record linking all FKs
      const appResult = await dbPool.query(
        `INSERT INTO applications (
          student_id, father_id, mother_id, guardian_id, supporter_id,
          status, submission_date, created_at, updated_at, additional_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), $7)
        RETURNING *`,
        [
          studentId,
          fatherId,
          motherId,
          guardianId,
          supporterId,
          'PENDING',
          applicationData.additionalNotes || ''
        ]
      );

      logger.info(`Created application ${appResult.rows[0].id} with student ${studentId}, father ${fatherId}, mother ${motherId}, guardian ${guardianId}, supporter ${supporterId}`);

      // Return basic application data without documents (getApplicationById may fail if schema differs)
      // This is a simplified response for creation - full data can be fetched separately if needed
      const basicApp = {
        id: appResult.rows[0].id,
        studentId: studentId,
        fatherId: fatherId,
        motherId: motherId,
        guardianId: guardianId,
        supporterId: supporterId,
        status: appResult.rows[0].status,
        submissionDate: appResult.rows[0].submission_date,
        createdAt: appResult.rows[0].created_at
      };

      return Application.fromDatabaseRow(basicApp);
    });
  }

  /**
   * Update application
   */
  async updateApplication(id, updateData) {
    return await writeOperationBreaker.fire(async () => {
      const app = new Application(updateData);
      const dbData = app.toDatabase();

      const fields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(dbData).forEach(key => {
        if (dbData[key] !== undefined && dbData[key] !== null) {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(dbData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `UPDATE applications SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await dbPool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated application ${id}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(id, status, notes, reviewedBy) {
    return await writeOperationBreaker.fire(async () => {
      const result = await dbPool.query(
        `UPDATE applications
         SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, notes, reviewedBy, id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Updated application ${id} status to ${status}`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Archive application
   * Note: is_archived column doesn't exist in current schema
   * This method is kept for API compatibility but does nothing
   */
  async archiveApplication(id) {
    return await writeOperationBreaker.fire(async () => {
      // Since is_archived column doesn't exist, we just return the application as-is
      const result = await dbPool.query(
        'SELECT * FROM applications WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Archive requested for application ${id} (no-op - column doesn't exist)`);
      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Get application statistics
   */
  async getApplicationStats(applicationYear) {
    return await mediumQueryBreaker.fire(async () => {
      let query = 'SELECT status, COUNT(*) as count FROM applications WHERE 1=1';
      const params = [];

      if (applicationYear) {
        query += ' AND application_year = $1';
        params.push(applicationYear);
      }

      query += ' GROUP BY status';

      const result = await dbPool.query(query, params);

      const stats = {
        total: 0,
        byStatus: {}
      };

      result.rows.forEach(row => {
        const count = parseInt(row.count);
        stats.byStatus[row.status] = count;
        stats.total += count;
      });

      logger.info(`Retrieved application stats for year ${applicationYear || 'all'}`);
      return stats;
    });
  }
}

module.exports = new ApplicationService();
