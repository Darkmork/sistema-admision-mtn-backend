/**
 * Application Service
 * Business logic for application management
 */

const { dbPool } = require('../config/database');
const { mediumQueryBreaker, writeOperationBreaker, externalServiceBreaker } = require('../config/circuitBreakers');
const Application = require('../models/Application');
const logger = require('../utils/logger');
const axios = require('axios');

class ApplicationService {
  /**
   * Get all applications with pagination and filters
   */
  async getAllApplications(filters = {}, page = 0, limit = 10) {
    return await mediumQueryBreaker.fire(async () => {
      const { status, applicationYear, guardianRUT } = filters;
      const offset = page * limit;

      // Include student, guardian, father, and mother data with LEFT JOIN
      let query = `
        SELECT a.*,
               s.rut as student_rut,
               s.nationality as student_nationality,
               s.passport as student_passport,
               s.first_name as student_first_name,
               s.paternal_last_name as student_paternal_last_name,
               s.maternal_last_name as student_maternal_last_name,
               s.grade_applied as student_grade_applied,

               -- Guardian information
               g.id as guardian_id,
               g.full_name as guardian_name,
               g.rut as guardian_rut_detail,
               g.email as guardian_email,
               g.phone as guardian_phone,
               g.relationship as guardian_relationship,
               g.profession as guardian_profession,

               -- Father information
               f.id as father_id,
               f.full_name as father_name,
               f.rut as father_rut,
               f.email as father_email,
               f.phone as father_phone,
               f.address as father_address,
               f.profession as father_profession,

               -- Mother information
               m.id as mother_id,
               m.full_name as mother_name,
               m.rut as mother_rut,
               m.email as mother_email,
               m.phone as mother_phone,
               m.address as mother_address,
               m.profession as mother_profession
        FROM applications a
        LEFT JOIN students s ON a.student_id = s.id
        LEFT JOIN guardians g ON a.guardian_id = g.id
        LEFT JOIN parents f ON f.id = a.father_id AND f.parent_type = 'FATHER'
        LEFT JOIN parents m ON m.id = a.mother_id AND m.parent_type = 'MOTHER'
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

      // Transform each row to include guardian, father, and mother objects
      // similar to how getApplicationById() does it
      const transformedRows = result.rows.map(row => {
        return {
          ...row,
          // Build guardians array from flattened columns
          guardians: row.guardian_id ? [{
            id: row.guardian_id,
            full_name: row.guardian_name,
            rut: row.guardian_rut_detail,
            email: row.guardian_email,
            phone: row.guardian_phone,
            relationship: row.guardian_relationship,
            profession: row.guardian_profession
          }] : [],
          // Build parents array from flattened columns
          parents: [
            ...(row.father_id ? [{
              id: row.father_id,
              full_name: row.father_name,
              rut: row.father_rut,
              email: row.father_email,
              phone: row.father_phone,
              profession: row.father_profession,
              address: row.father_address,
              parent_type: 'FATHER'
            }] : []),
            ...(row.mother_id ? [{
              id: row.mother_id,
              full_name: row.mother_name,
              rut: row.mother_rut,
              email: row.mother_email,
              phone: row.mother_phone,
              profession: row.mother_profession,
              address: row.mother_address,
              parent_type: 'MOTHER'
            }] : [])
          ]
        };
      });

      return {
        applications: Application.fromDatabaseRows(transformedRows),
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
          s.nationality as student_nationality,
          s.passport as student_passport,
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

          -- Guardian information
          g.id as guardian_id,
          g.full_name as guardian_name,
          g.rut as guardian_rut,
          g.email as guardian_email,
          g.phone as guardian_phone,
          g.relationship as guardian_relationship,
          g.profession as guardian_profession,

          -- Supporter information
          sp.id as supporter_id,
          sp.full_name as supporter_name,
          sp.rut as supporter_rut,
          sp.email as supporter_email,
          sp.phone as supporter_phone,
          sp.relationship as supporter_relationship,

          -- Applicant user information (guardian who created the application)
          au.email as applicant_email,
          au.first_name as applicant_first_name,
          au.last_name as applicant_last_name

        FROM applications a
        LEFT JOIN students s ON s.id = a.student_id
        LEFT JOIN parents f ON f.id = a.father_id AND f.parent_type = 'FATHER'
        LEFT JOIN parents m ON m.id = a.mother_id AND m.parent_type = 'MOTHER'
        LEFT JOIN guardians g ON g.id = a.guardian_id
        LEFT JOIN supporters sp ON sp.id = a.supporter_id
        LEFT JOIN users au ON au.id = a.applicant_user_id
        WHERE a.id = $1
      `;

      const result = await dbPool.query(appQuery, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Get documents data with approval information
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
          d.approved_by,
          d.approval_date,
          d.rejection_reason
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
          nationality: row.student_nationality || 'CHILENA',
          passport: row.student_passport,
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
        guardian: row.guardian_id ? {
          id: row.guardian_id,
          fullName: row.guardian_name,
          rut: row.guardian_rut,
          email: row.guardian_email,
          phone: row.guardian_phone,
          relationship: row.guardian_relationship,
          profession: row.guardian_profession
        } : null,
        supporter: row.supporter_id ? {
          id: row.supporter_id,
          fullName: row.supporter_name,
          rut: row.supporter_rut,
          email: row.supporter_email,
          phone: row.supporter_phone,
          relationship: row.supporter_relationship
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
          approvalStatus: doc.approval_status,
          approvedBy: doc.approved_by,
          approvalDate: doc.approval_date,
          rejectionReason: doc.rejection_reason
        }))
      };

      logger.info(`Retrieved application ${id} with ${row.father_id ? 1 : 0} father, ${row.mother_id ? 1 : 0} mother, ${row.guardian_id ? 1 : 0} guardian, ${row.supporter_id ? 1 : 0} supporter, ${documentsResult.rows.length} documents`);
      // Return appData directly - it already has the correct nested structure for the frontend
      // Don't use Application model here because it expects flat fields, not nested objects
      return appData;
    });
  }

  /**
   * Create new application
   * @param {Object} applicationData - Application data from request
   * @param {number} userId - ID of the user creating the application (from JWT)
   */
  async createApplication(applicationData, userId = null) {
    return await writeOperationBreaker.fire(async () => {
      // The applications table uses foreign keys to students, parents, guardians, supporters
      // We need to create those records first, then link them in applications table

      // Step 1: Create student record
      const studentResult = await dbPool.query(
        `INSERT INTO students (
          first_name, paternal_last_name, maternal_last_name,
          rut, nationality, passport, birth_date, grade_applied, current_school, address, email,
          admission_preference, pais, region, comuna, additional_notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING id`,
        [
          applicationData.studentFirstName,
          applicationData.studentPaternalLastName,
          applicationData.studentMaternalLastName || '',
          applicationData.studentRUT || null,
          applicationData.nationality || 'CHILENA',
          applicationData.passport || null,
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
          applicant_user_id, status, submission_date, created_at, updated_at, additional_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW(), $8)
        RETURNING *`,
        [
          studentId,
          fatherId,
          motherId,
          guardianId,
          supporterId,
          userId, // Store who created this application
          'PENDING',
          applicationData.additionalNotes || ''
        ]
      );

      logger.info(`Created application ${appResult.rows[0].id} with student ${studentId}, father ${fatherId}, mother ${motherId}, guardian ${guardianId}, supporter ${supporterId}, applicant_user_id ${userId}`);

      // Return simple object with just the ID - frontend only needs this for document upload
      // Full application data can be fetched with getApplicationById if needed
      return {
        id: appResult.rows[0].id,
        status: appResult.rows[0].status,
        submissionDate: appResult.rows[0].submission_date,
        createdAt: appResult.rows[0].created_at,
        studentId: studentId
      };
    });
  }

  /**
   * Update application
   * Note: Applications table only stores references (student_id, guardian_id, etc.)
   * This method updates the related tables (students, guardians, etc.)
   */
  async updateApplication(id, updateData) {
    return await writeOperationBreaker.fire(async () => {
      // First, get the current application to find related IDs
      const appResult = await dbPool.query(
        'SELECT * FROM applications WHERE id = $1',
        [id]
      );

      if (appResult.rows.length === 0) {
        return null;
      }

      const application = appResult.rows[0];
      const studentId = application.student_id;
      const guardianId = application.guardian_id;
      const fatherId = application.father_id;
      const motherId = application.mother_id;

      // Update student table if student data is provided
      if (updateData.student && studentId) {
        const studentFields = [];
        const studentValues = [];
        let studentParamIndex = 1;

        if (updateData.student.firstName !== undefined) {
          studentFields.push(`first_name = $${studentParamIndex++}`);
          studentValues.push(updateData.student.firstName);
        }
        if (updateData.student.paternalLastName !== undefined) {
          studentFields.push(`paternal_last_name = $${studentParamIndex++}`);
          studentValues.push(updateData.student.paternalLastName);
        }
        if (updateData.student.maternalLastName !== undefined) {
          studentFields.push(`maternal_last_name = $${studentParamIndex++}`);
          studentValues.push(updateData.student.maternalLastName);
        }
        if (updateData.student.rut !== undefined) {
          studentFields.push(`rut = $${studentParamIndex++}`);
          studentValues.push(updateData.student.rut);
        }
        if (updateData.student.birthDate !== undefined) {
          studentFields.push(`birth_date = $${studentParamIndex++}`);
          studentValues.push(updateData.student.birthDate);
        }
        if (updateData.student.email !== undefined) {
          studentFields.push(`email = $${studentParamIndex++}`);
          studentValues.push(updateData.student.email);
        }
        if (updateData.student.address !== undefined) {
          studentFields.push(`address = $${studentParamIndex++}`);
          studentValues.push(updateData.student.address);
        }
        if (updateData.student.gradeApplied !== undefined) {
          studentFields.push(`grade_applied = $${studentParamIndex++}`);
          studentValues.push(updateData.student.gradeApplied);
        }
        if (updateData.student.currentSchool !== undefined) {
          studentFields.push(`current_school = $${studentParamIndex++}`);
          studentValues.push(updateData.student.currentSchool);
        }

        if (studentFields.length > 0) {
          studentFields.push(`updated_at = NOW()`);
          studentValues.push(studentId);

          const studentQuery = `UPDATE students SET ${studentFields.join(', ')} WHERE id = $${studentParamIndex} RETURNING *`;
          await dbPool.query(studentQuery, studentValues);
          logger.info(`Updated student ${studentId} for application ${id}`);
        }
      }

      // Update guardian table if guardian data is provided
      if (updateData.guardian && guardianId) {
        const guardianFields = [];
        const guardianValues = [];
        let guardianParamIndex = 1;

        if (updateData.guardian.fullName !== undefined) {
          guardianFields.push(`full_name = $${guardianParamIndex++}`);
          guardianValues.push(updateData.guardian.fullName);
        }
        if (updateData.guardian.rut !== undefined) {
          guardianFields.push(`rut = $${guardianParamIndex++}`);
          guardianValues.push(updateData.guardian.rut);
        }
        if (updateData.guardian.email !== undefined) {
          guardianFields.push(`email = $${guardianParamIndex++}`);
          guardianValues.push(updateData.guardian.email);
        }
        if (updateData.guardian.phone !== undefined) {
          guardianFields.push(`phone = $${guardianParamIndex++}`);
          guardianValues.push(updateData.guardian.phone);
        }
        if (updateData.guardian.relationship !== undefined) {
          guardianFields.push(`relationship = $${guardianParamIndex++}`);
          guardianValues.push(updateData.guardian.relationship);
        }

        if (guardianFields.length > 0) {
          guardianFields.push(`updated_at = NOW()`);
          guardianValues.push(guardianId);

          const guardianQuery = `UPDATE guardians SET ${guardianFields.join(', ')} WHERE id = $${guardianParamIndex} RETURNING *`;
          await dbPool.query(guardianQuery, guardianValues);
          logger.info(`Updated guardian ${guardianId} for application ${id}`);
        }
      }

      // Update father table if father data is provided
      if (updateData.father && fatherId) {
        const fatherFields = [];
        const fatherValues = [];
        let fatherParamIndex = 1;

        if (updateData.father.fullName !== undefined) {
          fatherFields.push(`full_name = $${fatherParamIndex++}`);
          fatherValues.push(updateData.father.fullName);
        }
        if (updateData.father.rut !== undefined) {
          fatherFields.push(`rut = $${fatherParamIndex++}`);
          fatherValues.push(updateData.father.rut);
        }
        if (updateData.father.email !== undefined) {
          fatherFields.push(`email = $${fatherParamIndex++}`);
          fatherValues.push(updateData.father.email);
        }
        if (updateData.father.phone !== undefined) {
          fatherFields.push(`phone = $${fatherParamIndex++}`);
          fatherValues.push(updateData.father.phone);
        }

        if (fatherFields.length > 0) {
          fatherFields.push(`updated_at = NOW()`);
          fatherValues.push(fatherId);

          const fatherQuery = `UPDATE parents SET ${fatherFields.join(', ')} WHERE id = $${fatherParamIndex} RETURNING *`;
          await dbPool.query(fatherQuery, fatherValues);
          logger.info(`Updated father ${fatherId} for application ${id}`);
        }
      }

      // Update mother table if mother data is provided
      if (updateData.mother && motherId) {
        const motherFields = [];
        const motherValues = [];
        let motherParamIndex = 1;

        if (updateData.mother.fullName !== undefined) {
          motherFields.push(`full_name = $${motherParamIndex++}`);
          motherValues.push(updateData.mother.fullName);
        }
        if (updateData.mother.rut !== undefined) {
          motherFields.push(`rut = $${motherParamIndex++}`);
          motherValues.push(updateData.mother.rut);
        }
        if (updateData.mother.email !== undefined) {
          motherFields.push(`email = $${motherParamIndex++}`);
          motherValues.push(updateData.mother.email);
        }
        if (updateData.mother.phone !== undefined) {
          motherFields.push(`phone = $${motherParamIndex++}`);
          motherValues.push(updateData.mother.phone);
        }

        if (motherFields.length > 0) {
          motherFields.push(`updated_at = NOW()`);
          motherValues.push(motherId);

          const motherQuery = `UPDATE parents SET ${motherFields.join(', ')} WHERE id = $${motherParamIndex} RETURNING *`;
          await dbPool.query(motherQuery, motherValues);
          logger.info(`Updated mother ${motherId} for application ${id}`);
        }
      }

      // Update application table (only fields that exist in applications table)
      const appFields = [];
      const appValues = [];
      let appParamIndex = 1;

      if (updateData.status !== undefined) {
        appFields.push(`status = $${appParamIndex++}`);
        appValues.push(updateData.status);
      }
      if (updateData.notes !== undefined) {
        appFields.push(`additional_notes = $${appParamIndex++}`);
        appValues.push(updateData.notes);
      }

      if (appFields.length > 0) {
        appFields.push(`updated_at = NOW()`);
        appValues.push(id);

        const appQuery = `UPDATE applications SET ${appFields.join(', ')} WHERE id = $${appParamIndex} RETURNING *`;
        await dbPool.query(appQuery, appValues);
        logger.info(`Updated application ${id} metadata`);
      }

      // Return the updated application with all related data
      return await this.getApplicationById(id);
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

      // Send status update notification email (async - don't wait for result)
      this.sendStatusUpdateNotification(id, status, notes).catch(error => {
        logger.error(`Failed to send status update notification for application ${id}:`, error.message);
        // Don't throw - email failure shouldn't block status update
      });

      return Application.fromDatabaseRow(result.rows[0]);
    });
  }

  /**
   * Send status update notification email
   * This is called asynchronously after status update
   */
  async sendStatusUpdateNotification(applicationId, newStatus, notes) {
    try {
      const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8085';
      const endpoint = `${NOTIFICATION_SERVICE_URL}/api/institutional-emails/status-update/${applicationId}`;

      logger.info(`📧 Calling notification service for application ${applicationId} status update`, {
        endpoint,
        newStatus
      });

      // Use external service circuit breaker with timeout
      await externalServiceBreaker.fire(async () => {
        const response = await axios.post(endpoint, {
          newStatus,
          notes
        }, {
          timeout: 8000 // Match externalServiceBreaker timeout
        });

        logger.info(`✅ Notification service responded for application ${applicationId}`, {
          emailSent: response.data.data?.emailSent,
          recipient: response.data.data?.recipient
        });

        return response.data;
      });
    } catch (error) {
      logger.error(`❌ Error calling notification service for application ${applicationId}:`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // Re-throw so caller can decide whether to fail or continue
      throw error;
    }
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
