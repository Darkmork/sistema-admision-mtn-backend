const express = require('express');
const router = express.Router();
const { ok, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');
const emailService = require('../services/EmailService');
const axios = require('axios');

/**
 * @route   POST /api/institutional-emails/document-review/:applicationId
 * @desc    Send document review notification email to applicant
 * @access  Protected (Admin/Coordinator)
 * @body    { approvedDocuments: string[], rejectedDocuments: string[], allApproved: boolean }
 */
router.post('/document-review/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { approvedDocuments, rejectedDocuments, allApproved } = req.body;

    logger.info(`📧 Sending document review email for application ${applicationId}`, {
      approvedCount: approvedDocuments?.length || 0,
      rejectedCount: rejectedDocuments?.length || 0,
      allApproved
    });

    // Get applicant email from application-service
    const APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:8083';
    let recipientEmail = null;
    let guardianName = 'Apoderado/a';

    try {
      logger.info(`Fetching application details from: ${APPLICATION_SERVICE_URL}/api/applications/${applicationId}`);

      const appResponse = await axios.get(`${APPLICATION_SERVICE_URL}/api/applications/${applicationId}`, {
        timeout: 5000
      });

      const application = appResponse.data.data;
      logger.info(`Application data received for ${applicationId}`);

      // Priority: applicant (who created the application) > guardian > father > mother
      if (application.applicant?.email) {
        recipientEmail = application.applicant.email;
        guardianName = `${application.applicant.firstName} ${application.applicant.lastName}`.trim() || 'Apoderado/a';
        logger.info(`Using applicant email: ${recipientEmail}`);
      } else if (application.guardian?.email) {
        recipientEmail = application.guardian.email;
        guardianName = `${application.guardian.firstName} ${application.guardian.lastName}`.trim() || 'Apoderado/a';
        logger.info(`Using guardian email: ${recipientEmail}`);
      } else if (application.father?.email) {
        recipientEmail = application.father.email;
        guardianName = `${application.father.firstName} ${application.father.lastName}`.trim() || 'Apoderado/a';
        logger.info(`Using father email: ${recipientEmail}`);
      } else if (application.mother?.email) {
        recipientEmail = application.mother.email;
        guardianName = `${application.mother.firstName} ${application.mother.lastName}`.trim() || 'Apoderado/a';
        logger.info(`Using mother email: ${recipientEmail}`);
      }

      if (!recipientEmail) {
        logger.warn(`No email found for application ${applicationId}, using fallback`);
        recipientEmail = 'admision@mtn.cl';
      }
    } catch (error) {
      logger.error(`Error fetching application ${applicationId}:`, error.message);
      recipientEmail = 'admision@mtn.cl';
      logger.warn(`Using fallback email due to error: ${recipientEmail}`);
    }

    // Prepare email content based on review results
    let subject, message;

    if (allApproved) {
      subject = '✅ Documentos Aprobados - Colegio MTN';
      message = `
Estimado/a ${guardianName},

Nos complace informarle que todos los documentos de su postulación han sido revisados y aprobados.

📋 **Documentos Aprobados:**
${approvedDocuments.map(doc => `✓ ${doc}`).join('\n')}

Puede continuar con el siguiente paso del proceso de admisión.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim();
    } else if (rejectedDocuments.length > 0 && approvedDocuments.length > 0) {
      subject = '⚠️ Revisión de Documentos - Acción Requerida - Colegio MTN';
      message = `
Estimado/a ${guardianName},

Hemos revisado los documentos de su postulación. Algunos documentos han sido aprobados, pero otros requieren ser actualizados.

✅ **Documentos Aprobados:**
${approvedDocuments.map(doc => `✓ ${doc}`).join('\n')}

❌ **Documentos Rechazados (requieren actualización):**
${rejectedDocuments.map(doc => `✗ ${doc}`).join('\n')}

Por favor, ingrese al sistema y vuelva a subir los documentos rechazados con las correcciones necesarias.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim();
    } else if (rejectedDocuments.length > 0) {
      subject = '❌ Documentos Requieren Actualización - Colegio MTN';
      message = `
Estimado/a ${guardianName},

Hemos revisado los documentos de su postulación y algunos requieren ser actualizados.

❌ **Documentos Rechazados (requieren actualización):**
${rejectedDocuments.map(doc => `✗ ${doc}`).join('\n')}

Por favor, ingrese al sistema y vuelva a subir estos documentos con las correcciones necesarias.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim();
    } else {
      subject = '📋 Actualización de Documentos - Colegio MTN';
      message = `
Estimado/a Apoderado/a,

Le informamos sobre el estado de los documentos de su postulación.

Por favor, revise su panel de postulante para más detalles.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim();
    }

    // Send email using email service
    try {
      const result = await emailService.sendEmail(recipientEmail, subject, message);

      logger.info(`✅ Document review email sent for application ${applicationId}`, {
        messageId: result.messageId,
        recipient: recipientEmail
      });

      res.json(ok({
        message: 'Document review email sent successfully',
        applicationId,
        emailSent: true,
        recipient: recipientEmail,
        messageId: result.messageId
      }));
    } catch (emailError) {
      logger.error('❌ Error sending document review email:', emailError);

      // Return success but indicate email failed (so app can continue)
      res.json(ok({
        message: 'Document review processed but email failed to send',
        applicationId,
        emailSent: false,
        error: emailError.message
      }));
    }
  } catch (error) {
    logger.error('Error in document-review endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_001', 'Error processing document review notification', error.message));
  }
});

/**
 * @route   POST /api/institutional-emails/application-received/:applicationId
 * @desc    Send application received confirmation email
 * @access  Protected
 */
router.post('/application-received/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;

    logger.info(`📧 Sending application received email for application ${applicationId}`);

    // TODO: Implement application received email
    res.json(ok({
      message: 'Application received email endpoint (not yet implemented)',
      applicationId
    }));
  } catch (error) {
    logger.error('Error in application-received endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_002', 'Error sending application received email', error.message));
  }
});

/**
 * @route   POST /api/institutional-emails/interview-invitation/:interviewId
 * @desc    Send interview invitation email
 * @access  Protected
 */
router.post('/interview-invitation/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;

    logger.info(`📧 Sending interview invitation for interview ${interviewId}`);

    // TODO: Implement interview invitation email
    res.json(ok({
      message: 'Interview invitation email endpoint (not yet implemented)',
      interviewId
    }));
  } catch (error) {
    logger.error('Error in interview-invitation endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_003', 'Error sending interview invitation', error.message));
  }
});

/**
 * @route   POST /api/institutional-emails/status-update/:applicationId
 * @desc    Send status update email
 * @access  Protected
 */
router.post('/status-update/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { newStatus } = req.body;

    logger.info(`📧 Sending status update email for application ${applicationId}`, { newStatus });

    // TODO: Implement status update email
    res.json(ok({
      message: 'Status update email endpoint (not yet implemented)',
      applicationId,
      newStatus
    }));
  } catch (error) {
    logger.error('Error in status-update endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_004', 'Error sending status update', error.message));
  }
});

/**
 * @route   POST /api/institutional-emails/document-reminder/:applicationId
 * @desc    Send document reminder email
 * @access  Protected
 */
router.post('/document-reminder/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { pendingDocuments } = req.body;

    logger.info(`📧 Sending document reminder for application ${applicationId}`);

    // TODO: Implement document reminder email
    res.json(ok({
      message: 'Document reminder email endpoint (not yet implemented)',
      applicationId,
      pendingDocuments
    }));
  } catch (error) {
    logger.error('Error in document-reminder endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_005', 'Error sending document reminder', error.message));
  }
});

/**
 * @route   POST /api/institutional-emails/admission-result/:applicationId
 * @desc    Send admission result email
 * @access  Protected
 */
router.post('/admission-result/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { result, message: customMessage } = req.body;

    logger.info(`📧 Sending admission result for application ${applicationId}`, { result });

    // TODO: Implement admission result email
    res.json(ok({
      message: 'Admission result email endpoint (not yet implemented)',
      applicationId,
      result
    }));
  } catch (error) {
    logger.error('Error in admission-result endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_006', 'Error sending admission result', error.message));
  }
});

module.exports = router;
