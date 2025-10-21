/**
 * Student Controller
 * HTTP request handlers for student endpoints
 */

const StudentService = require('../services/StudentService');
const Student = require('../models/Student');
const { ok, page, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');

class StudentController {
  /**
   * GET /api/students
   * Get all students with pagination and filtering
   */
  async getAllStudents(req, res) {
    try {
      const { page: pageNum, limit, gradeApplied, search } = req.query;

      const result = await StudentService.getAllStudents({
        page: pageNum,
        limit,
        gradeApplied,
        search
      });

      return res.json(
        page(
          result.students.map(s => s.toJSON()),
          result.total,
          result.page,
          result.limit
        )
      );
    } catch (error) {
      logger.error('Error getting all students:', error);
      return res.status(500).json(
        fail('STU_001', 'Failed to retrieve students', error.message)
      );
    }
  }

  /**
   * GET /api/students/:id
   * Get student by ID
   */
  async getStudentById(req, res) {
    try {
      const { id } = req.params;
      const student = await StudentService.getStudentById(id);

      if (!student) {
        return res.status(404).json(
          fail('STU_002', `Student ${id} not found`)
        );
      }

      return res.json(ok(student.toJSON()));
    } catch (error) {
      logger.error(`Error getting student ${req.params.id}:`, error);
      return res.status(500).json(
        fail('STU_003', 'Failed to retrieve student', error.message)
      );
    }
  }

  /**
   * GET /api/students/rut/:rut
   * Get student by RUT
   */
  async getStudentByRUT(req, res) {
    try {
      const { rut } = req.params;

      // Validate RUT format
      if (!Student.validateRUT(rut)) {
        return res.status(400).json(
          fail('STU_004', 'Invalid RUT format')
        );
      }

      const student = await StudentService.getStudentByRUT(rut);

      if (!student) {
        return res.status(404).json(
          fail('STU_005', `Student with RUT ${rut} not found`)
        );
      }

      return res.json(ok(student.toJSON()));
    } catch (error) {
      logger.error(`Error getting student by RUT ${req.params.rut}:`, error);
      return res.status(500).json(
        fail('STU_006', 'Failed to retrieve student by RUT', error.message)
      );
    }
  }

  /**
   * GET /api/students/by-guardian/:guardianId
   * Get students by guardian ID
   */
  async getStudentsByGuardian(req, res) {
    try {
      const { guardianId } = req.params;

      const students = await StudentService.getStudentsByGuardian(guardianId);

      return res.json(ok(students.map(s => s.toJSON())));
    } catch (error) {
      logger.error(`Error getting students by guardian ${req.params.guardianId}:`, error);
      return res.status(500).json(
        fail('STU_007', 'Failed to retrieve students by guardian', error.message)
      );
    }
  }

  /**
   * POST /api/students
   * Create new student
   */
  async createStudent(req, res) {
    try {
      const studentData = req.body;

      // Validate RUT if provided
      if (studentData.rut && !Student.validateRUT(studentData.rut)) {
        return res.status(400).json(
          fail('STU_007', 'Invalid RUT format')
        );
      }

      // Check for duplicate RUT
      if (studentData.rut) {
        const duplicate = await StudentService.checkDuplicateRUT(studentData.rut);
        if (duplicate) {
          return res.status(409).json(
            fail(
              'STU_008',
              `Student with RUT ${studentData.rut} already exists (ID: ${duplicate.id})`
            )
          );
        }
      }

      const student = await StudentService.createStudent(studentData);

      return res.status(201).json(
        ok({
          message: 'Student created successfully',
          student: student.toJSON()
        })
      );
    } catch (error) {
      logger.error('Error creating student:', error);
      return res.status(500).json(
        fail('STU_009', 'Failed to create student', error.message)
      );
    }
  }

  /**
   * PUT /api/students/:id
   * Update student
   */
  async updateStudent(req, res) {
    try {
      const { id } = req.params;
      const studentData = req.body;

      // Check if student exists
      const existing = await StudentService.getStudentById(id);
      if (!existing) {
        return res.status(404).json(
          fail('STU_010', `Student ${id} not found`)
        );
      }

      // Validate RUT if provided
      if (studentData.rut && !Student.validateRUT(studentData.rut)) {
        return res.status(400).json(
          fail('STU_011', 'Invalid RUT format')
        );
      }

      // Check for duplicate RUT (excluding current student)
      if (studentData.rut && studentData.rut !== existing.rut) {
        const duplicate = await StudentService.checkDuplicateRUT(studentData.rut, id);
        if (duplicate) {
          return res.status(409).json(
            fail(
              'STU_012',
              `RUT ${studentData.rut} is already used by another student (ID: ${duplicate.id})`
            )
          );
        }
      }

      const student = await StudentService.updateStudent(id, studentData);

      return res.json(
        ok({
          message: 'Student updated successfully',
          student: student.toJSON()
        })
      );
    } catch (error) {
      logger.error(`Error updating student ${req.params.id}:`, error);
      return res.status(500).json(
        fail('STU_013', 'Failed to update student', error.message)
      );
    }
  }

  /**
   * DELETE /api/students/:id
   * Delete student (checks FK constraints)
   */
  async deleteStudent(req, res) {
    try {
      const { id } = req.params;

      const student = await StudentService.deleteStudent(id);

      if (!student) {
        return res.status(404).json(
          fail('STU_014', `Student ${id} not found`)
        );
      }

      return res.json(
        ok({
          message: 'Student deleted successfully',
          student: student.toJSON()
        })
      );
    } catch (error) {
      // Check if error is due to FK constraint
      if (error.message && error.message.includes('Cannot delete student')) {
        return res.status(409).json(
          fail('STU_015', error.message)
        );
      }

      logger.error(`Error deleting student ${req.params.id}:`, error);
      return res.status(500).json(
        fail('STU_016', 'Failed to delete student', error.message)
      );
    }
  }

  /**
   * GET /api/students/grade/:grade
   * Get students by grade
   */
  async getStudentsByGrade(req, res) {
    try {
      const { grade } = req.params;
      const students = await StudentService.getStudentsByGrade(grade);

      return res.json(
        ok({
          grade,
          count: students.length,
          students: students.map(s => s.toJSON())
        })
      );
    } catch (error) {
      logger.error(`Error getting students by grade ${req.params.grade}:`, error);
      return res.status(500).json(
        fail('STU_017', 'Failed to retrieve students by grade', error.message)
      );
    }
  }

  /**
   * GET /api/students/search/:term
   * Search students
   */
  async searchStudents(req, res) {
    try {
      const { term } = req.params;

      if (!term || term.trim() === '') {
        return res.status(400).json(
          fail('STU_018', 'Search term is required')
        );
      }

      const students = await StudentService.searchStudents(term);

      return res.json(
        ok({
          searchTerm: term,
          count: students.length,
          students: students.map(s => s.toJSON())
        })
      );
    } catch (error) {
      logger.error(`Error searching students with term "${req.params.term}":`, error);
      return res.status(500).json(
        fail('STU_019', 'Failed to search students', error.message)
      );
    }
  }

  /**
   * GET /api/students/statistics/by-grade
   * Get statistics by grade
   */
  async getStatisticsByGrade(req, res) {
    try {
      const statistics = await StudentService.getStatisticsByGrade();

      return res.json(
        ok({
          total: statistics.reduce((sum, stat) => sum + stat.count, 0),
          byGrade: statistics
        })
      );
    } catch (error) {
      logger.error('Error getting student statistics:', error);
      return res.status(500).json(
        fail('STU_020', 'Failed to retrieve statistics', error.message)
      );
    }
  }

  /**
   * POST /api/students/validate-rut
   * Validate RUT format
   */
  async validateRUT(req, res) {
    try {
      const { rut } = req.body;

      if (!rut) {
        return res.status(400).json(
          fail('STU_021', 'RUT is required')
        );
      }

      const isValid = Student.validateRUT(rut);
      const formatted = isValid ? Student.formatRUT(rut) : null;

      return res.json(
        ok({
          rut,
          isValid,
          formatted
        })
      );
    } catch (error) {
      logger.error('Error validating RUT:', error);
      return res.status(500).json(
        fail('STU_022', 'Failed to validate RUT', error.message)
      );
    }
  }
}

module.exports = new StudentController();
