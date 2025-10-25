const express = require('express');
const router = express.Router();
const { ok, fail } = require('../utils/responseHelpers');
const logger = require('../utils/logger');
const emailService = require('../services/EmailService');
const axios = require('axios');

/**
 * @route   GET /api/institutional-emails/debug
 * @desc    Debug endpoint to check configuration
 */
router.get('/debug', async (req, res) => {
  const APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:8083';

  try {
    // Test connection to application-service /contact endpoint
    const testResponse = await axios.get(`${APPLICATION_SERVICE_URL}/api/applications/2/contact`, {
      timeout: 5000
    });

    res.json({
      success: true,
      config: {
        APPLICATION_SERVICE_URL,
        contactEndpoint: `${APPLICATION_SERVICE_URL}/api/applications/2/contact`,
        connectionStatus: 'OK'
      },
      testResponse: testResponse.data
    });
  } catch (error) {
    res.json({
      success: false,
      config: {
        APPLICATION_SERVICE_URL,
        contactEndpoint: `${APPLICATION_SERVICE_URL}/api/applications/2/contact`,
        connectionStatus: 'FAILED'
      },
      error: {
        message: error.message,
        code: error.code,
        response: error.response?.data
      }
    });
  }
});

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

    // Get applicant email from application-service (public endpoint - no auth required)
    const APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:8083';
    let recipientEmail = null;
    let guardianName = 'Apoderado/a';
    let studentName = 'Estudiante';
    let allDocumentsFromDB = [];

    try {
      // Use public /contact endpoint instead of full application endpoint
      logger.info(`Fetching application contact from: ${APPLICATION_SERVICE_URL}/api/applications/${applicationId}/contact`);

      const contactResponse = await axios.get(`${APPLICATION_SERVICE_URL}/api/applications/${applicationId}/contact`, {
        timeout: 5000
      });

      const contact = contactResponse.data.data;
      logger.info(`Contact data received for application ${applicationId}`);

      // Get student name
      studentName = contact.studentName || 'Estudiante';

      // ALWAYS use applicant email (person who created the application)
      if (contact.applicantUser?.email) {
        recipientEmail = contact.applicantUser.email;
        guardianName = `${contact.applicantUser.firstName || ''} ${contact.applicantUser.lastName || ''}`.trim() || 'Apoderado/a';
        logger.info(`Using applicant email: ${recipientEmail}`);
      } else {
        logger.warn(`No applicant email found for application ${applicationId}, using fallback`);
        recipientEmail = 'admision@mtn.cl';
      }

      // Get ALL documents from application to show complete status
      try {
        const docsResponse = await axios.get(`${APPLICATION_SERVICE_URL}/api/applications/${applicationId}/documents`, {
          timeout: 5000
        });
        allDocumentsFromDB = docsResponse.data.data || [];
        logger.info(`Retrieved ${allDocumentsFromDB.length} documents from application ${applicationId}`);
      } catch (docError) {
        logger.warn(`Could not fetch documents for application ${applicationId}:`, docError.message);
      }
    } catch (error) {
      logger.error(`Error fetching application ${applicationId} contact:`, error.message);
      recipientEmail = 'admision@mtn.cl';
      logger.warn(`Using fallback email due to error: ${recipientEmail}`);
    }

    // Categorize ALL documents by status
    const previouslyApprovedDocs = allDocumentsFromDB
      .filter(doc => doc.approvalStatus === 'APPROVED' && !approvedDocuments.includes(doc.fileName || doc.name))
      .map(doc => doc.fileName || doc.name || 'Documento');

    const currentlyRejectedDocs = rejectedDocuments;
    const newlyApprovedDocs = approvedDocuments;

    // Prepare email content based on review results
    let subject, message;

    // Combine all approved documents (previously + newly approved)
    const allApprovedDocsList = [...previouslyApprovedDocs, ...newlyApprovedDocs];

    if (allApproved) {
      subject = '✅ Todos los Documentos Aprobados - Colegio MTN';
      message = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #2d6a4f; margin-top: 0;">✅ Documentos Aprobados</h2>

    <p style="color: #333; line-height: 1.6;">Estimado/a <strong>${guardianName}</strong>,</p>

    <p style="color: #333; line-height: 1.6;">
      Nos complace informarle que <strong>todos los documentos</strong> de la postulación de
      <strong>${studentName}</strong> han sido revisados y aprobados exitosamente.
    </p>

    <div style="background-color: #d4edda; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
      <h3 style="color: #155724; margin-top: 0;">📋 Documentos Aprobados (${allApprovedDocsList.length})</h3>
      <ul style="color: #155724; line-height: 1.8;">
        ${allApprovedDocsList.map(doc => `<li>✓ ${doc}</li>`).join('')}
      </ul>
    </div>

    <p style="color: #333; line-height: 1.6;">
      <strong>¡Felicitaciones!</strong> Puede continuar con el siguiente paso del proceso de admisión.
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      Saludos cordiales,<br>
      <strong>Equipo de Admisiones</strong><br>
      Colegio Monte Tabor y Nazaret
    </p>
  </div>
</div>
      `.trim();
    } else if (currentlyRejectedDocs.length > 0) {
      subject = currentlyRejectedDocs.length === allDocumentsFromDB.length
        ? '❌ Documentos Requieren Corrección - Colegio MTN'
        : '⚠️ Revisión de Documentos - Acción Requerida - Colegio MTN';

      message = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #d9534f; margin-top: 0;">⚠️ Revisión de Documentos</h2>

    <p style="color: #333; line-height: 1.6;">Estimado/a <strong>${guardianName}</strong>,</p>

    <p style="color: #333; line-height: 1.6;">
      Hemos revisado los documentos de la postulación de <strong>${studentName}</strong>.
      ${allApprovedDocsList.length > 0
        ? 'Algunos documentos han sido aprobados, pero otros requieren ser actualizados.'
        : 'Los documentos enviados requieren correcciones.'}
    </p>

    ${allApprovedDocsList.length > 0 ? `
    <div style="background-color: #d4edda; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
      <h3 style="color: #155724; margin-top: 0;">✅ Documentos Aprobados (${allApprovedDocsList.length})</h3>
      <ul style="color: #155724; line-height: 1.8;">
        ${allApprovedDocsList.map(doc => `<li>✓ ${doc}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div style="background-color: #f8d7da; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0;">
      <h3 style="color: #721c24; margin-top: 0;">❌ Documentos que Requieren Corrección (${currentlyRejectedDocs.length})</h3>
      <ul style="color: #721c24; line-height: 1.8;">
        ${currentlyRejectedDocs.map(doc => `<li>✗ ${doc}</li>`).join('')}
      </ul>
    </div>

    <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
      <p style="color: #856404; margin: 0; line-height: 1.6;">
        <strong>⚠️ Acción Requerida:</strong> Por favor, ingrese al sistema y vuelva a subir los documentos
        rechazados con las correcciones necesarias.
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      Saludos cordiales,<br>
      <strong>Equipo de Admisiones</strong><br>
      Colegio Monte Tabor y Nazaret
    </p>
  </div>
</div>
      `.trim();
    } else {
      // Solo documentos aprobados (sin rechazados)
      subject = '✅ Documentos Aprobados - Colegio MTN';
      message = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #2d6a4f; margin-top: 0;">✅ Documentos Aprobados</h2>

    <p style="color: #333; line-height: 1.6;">Estimado/a <strong>${guardianName}</strong>,</p>

    <p style="color: #333; line-height: 1.6;">
      Le informamos que se han aprobado nuevos documentos de la postulación de <strong>${studentName}</strong>.
    </p>

    <div style="background-color: #d4edda; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0;">
      <h3 style="color: #155724; margin-top: 0;">📋 Estado de Documentos</h3>

      ${previouslyApprovedDocs.length > 0 ? `
      <h4 style="color: #155724; margin-top: 15px;">✓ Documentos Aprobados Anteriormente (${previouslyApprovedDocs.length})</h4>
      <ul style="color: #155724; line-height: 1.8;">
        ${previouslyApprovedDocs.map(doc => `<li>${doc}</li>`).join('')}
      </ul>
      ` : ''}

      <h4 style="color: #155724; margin-top: 15px;">✓ Nuevos Documentos Aprobados (${newlyApprovedDocs.length})</h4>
      <ul style="color: #155724; line-height: 1.8;">
        ${newlyApprovedDocs.map(doc => `<li><strong>${doc}</strong></li>`).join('')}
      </ul>
    </div>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      Saludos cordiales,<br>
      <strong>Equipo de Admisiones</strong><br>
      Colegio Monte Tabor y Nazaret
    </p>
  </div>
</div>
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
 * @desc    Send status update email to applicant
 * @access  Protected (Admin/Coordinator)
 * @body    { newStatus: string, notes?: string }
 */
router.post('/status-update/:applicationId', async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { newStatus, notes } = req.body;

    logger.info(`📧 Sending status update email for application ${applicationId}`, { newStatus });

    // Get applicant email from application-service
    const APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:8083';
    let recipientEmail = null;
    let guardianName = 'Apoderado/a';
    let studentName = 'el estudiante';

    try {
      // Use public /contact endpoint instead of full application endpoint
      logger.info(`Fetching application contact from: ${APPLICATION_SERVICE_URL}/api/applications/${applicationId}/contact`);

      const contactResponse = await axios.get(`${APPLICATION_SERVICE_URL}/api/applications/${applicationId}/contact`, {
        timeout: 5000
      });

      const contact = contactResponse.data.data;
      logger.info(`Contact data received for application ${applicationId}`);

      // Get student name
      studentName = contact.studentName || 'Estudiante';

      // ALWAYS use applicant email (person who created the application)
      if (contact.applicantUser?.email) {
        recipientEmail = contact.applicantUser.email;
        guardianName = `${contact.applicantUser.firstName || ''} ${contact.applicantUser.lastName || ''}`.trim() || 'Apoderado/a';
        logger.info(`Using applicant email: ${recipientEmail}`);
      } else {
        logger.warn(`No applicant email found for application ${applicationId}`);
        return res.status(400).json(fail('INST_EMAIL_004_NO_EMAIL', 'No applicant email found for this application'));
      }
    } catch (error) {
      logger.error(`Error fetching application ${applicationId} contact:`, error.message);
      return res.status(500).json(fail('INST_EMAIL_004_FETCH_ERROR', 'Error fetching application contact details', error.message));
    }

    // Prepare email content based on new status
    const { subject, message } = generateStatusUpdateEmail(newStatus, guardianName, studentName, notes);

    // Send email using email service
    try {
      const result = await emailService.sendEmail(recipientEmail, subject, message);

      logger.info(`✅ Status update email sent for application ${applicationId}`, {
        messageId: result.messageId,
        recipient: recipientEmail,
        newStatus
      });

      res.json(ok({
        message: 'Status update email sent successfully',
        applicationId,
        newStatus,
        emailSent: true,
        recipient: recipientEmail,
        messageId: result.messageId
      }));
    } catch (emailError) {
      logger.error('❌ Error sending status update email:', emailError);

      // Return success but indicate email failed (so app can continue)
      res.json(ok({
        message: 'Status updated but email failed to send',
        applicationId,
        newStatus,
        emailSent: false,
        error: emailError.message
      }));
    }
  } catch (error) {
    logger.error('Error in status-update endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_004', 'Error processing status update notification', error.message));
  }
});

/**
 * Helper function to generate email content based on status
 */
function generateStatusUpdateEmail(status, guardianName, studentName, notes) {
  const statusMessages = {
    'SUBMITTED': {
      subject: '✅ Postulación Recibida - Colegio MTN',
      message: `
Estimado/a ${guardianName},

Hemos recibido exitosamente la postulación de ${studentName}.

📋 **Estado Actual:** Postulación Recibida

Nuestro equipo de admisiones revisará la documentación y nos pondremos en contacto con usted para los siguientes pasos del proceso.

${notes ? `\n**Observaciones:**\n${notes}\n` : ''}
Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    },
    'UNDER_REVIEW': {
      subject: '🔍 Postulación en Revisión - Colegio MTN',
      message: `
Estimado/a ${guardianName},

La postulación de ${studentName} se encuentra actualmente en proceso de revisión.

📋 **Estado Actual:** En Revisión

Nuestro equipo está evaluando la documentación presentada. Le notificaremos sobre cualquier actualización o requerimiento adicional.

${notes ? `\n**Observaciones:**\n${notes}\n` : ''}
Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    },
    'INTERVIEW_SCHEDULED': {
      subject: '📅 Entrevista Programada - Colegio MTN',
      message: `
Estimado/a ${guardianName},

Nos complace informarle que hemos programado una entrevista para la postulación de ${studentName}.

📋 **Estado Actual:** Entrevista Programada

Recibirá próximamente los detalles de fecha, hora y lugar de la entrevista.

${notes ? `\n**Información Adicional:**\n${notes}\n` : ''}
Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    },
    'APPROVED': {
      subject: '🎉 ¡Postulación Aprobada! - Colegio MTN',
      message: `
Estimado/a ${guardianName},

¡Tenemos excelentes noticias! La postulación de ${studentName} ha sido **APROBADA**.

📋 **Estado Actual:** Aprobada

Felicitaciones por este logro. Próximamente recibirá información sobre los siguientes pasos para formalizar la matrícula.

${notes ? `\n**Mensaje del Equipo de Admisiones:**\n${notes}\n` : ''}
¡Bienvenidos a la familia MTN!

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    },
    'REJECTED': {
      subject: 'Resultado de Postulación - Colegio MTN',
      message: `
Estimado/a ${guardianName},

Lamentamos informarle que, tras evaluar la postulación de ${studentName}, no ha sido posible aprobarla en esta oportunidad.

📋 **Estado Actual:** No Aprobada

Esta decisión se basa en diversos criterios del proceso de admisión. Agradecemos sinceramente su interés en nuestro colegio.

${notes ? `\n**Información Adicional:**\n${notes}\n` : ''}
Le deseamos mucho éxito en su búsqueda educativa.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    },
    'WAITLIST': {
      subject: '⏳ Postulación en Lista de Espera - Colegio MTN',
      message: `
Estimado/a ${guardianName},

La postulación de ${studentName} ha sido incluida en nuestra lista de espera.

📋 **Estado Actual:** Lista de Espera

Esto significa que su postulación cumple con nuestros requisitos, pero actualmente no contamos con cupos disponibles. Le notificaremos si se libera un cupo.

${notes ? `\n**Información Adicional:**\n${notes}\n` : ''}
Agradecemos su paciencia y comprensión.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    },
    'ARCHIVED': {
      subject: '📁 Postulación Archivada - Colegio MTN',
      message: `
Estimado/a ${guardianName},

La postulación de ${studentName} ha sido archivada.

📋 **Estado Actual:** Archivada

${notes ? `\n**Motivo:**\n${notes}\n` : ''}
Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
      `.trim()
    }
  };

  // Default message for unknown statuses
  const defaultMessage = {
    subject: 'Actualización de Postulación - Colegio MTN',
    message: `
Estimado/a ${guardianName},

Le informamos que el estado de la postulación de ${studentName} ha sido actualizado.

📋 **Estado Actual:** ${status}

${notes ? `\n**Detalles:**\n${notes}\n` : ''}
Para más información, por favor ingrese a su panel de postulante.

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
    `.trim()
  };

  return statusMessages[status] || defaultMessage;
}

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
