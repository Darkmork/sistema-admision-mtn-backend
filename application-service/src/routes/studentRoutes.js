/**
 * Student Routes
 * Defines HTTP routes for student endpoints
 */

const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/StudentController');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateCsrf } = require('../middleware/csrfMiddleware');
const { validate, createStudentSchema, updateStudentSchema } = require('../middleware/validators');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Validate RUT format (utility endpoint)
router.post('/validate-rut', StudentController.validateRUT.bind(StudentController));

// ============================================
// READ ROUTES (Authentication required)
// ============================================

// Get statistics by grade (MUST BE BEFORE /:id)
router.get(
  '/statistics/by-grade',
  authenticate,
  StudentController.getStatisticsByGrade.bind(StudentController)
);

// Search students (MUST BE BEFORE /:id)
router.get(
  '/search/:term',
  authenticate,
  StudentController.searchStudents.bind(StudentController)
);

// Get students by grade (MUST BE BEFORE /:id)
router.get(
  '/grade/:grade',
  authenticate,
  StudentController.getStudentsByGrade.bind(StudentController)
);

// Get student by RUT (MUST BE BEFORE /:id)
router.get(
  '/rut/:rut',
  authenticate,
  StudentController.getStudentByRUT.bind(StudentController)
);

// Get students by guardian ID (MUST BE BEFORE /:id)
router.get(
  '/by-guardian/:guardianId',
  authenticate,
  StudentController.getStudentsByGuardian.bind(StudentController)
);

// Get all students (with pagination and filtering)
router.get(
  '/',
  authenticate,
  StudentController.getAllStudents.bind(StudentController)
);

// Get student by ID
router.get(
  '/:id',
  authenticate,
  StudentController.getStudentById.bind(StudentController)
);

// ============================================
// WRITE ROUTES (Authentication + CSRF required)
// ============================================

// Create new student
router.post(
  '/',
  authenticate,
  validateCsrf,
  validate(createStudentSchema),
  requireRole('ADMIN', 'COORDINATOR', 'APODERADO'),
  StudentController.createStudent.bind(StudentController)
);

// Update student
router.put(
  '/:id',
  authenticate,
  validateCsrf,
  validate(updateStudentSchema),
  requireRole('ADMIN', 'COORDINATOR'),
  StudentController.updateStudent.bind(StudentController)
);

// Delete student
router.delete(
  '/:id',
  authenticate,
  validateCsrf,
  requireRole('ADMIN'),
  StudentController.deleteStudent.bind(StudentController)
);

module.exports = router;
