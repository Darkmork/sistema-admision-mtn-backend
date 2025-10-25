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

    // Categorize ALL documents by status with detailed information
    const documentStatusList = allDocumentsFromDB.map(doc => {
      const docName = doc.fileName || doc.name || 'Documento';

      // Check if this document was just approved/rejected in this notification
      const isNewlyApproved = approvedDocuments.includes(docName);
      const isNewlyRejected = rejectedDocuments.includes(docName);

      let status = 'PENDING';
      let isNew = false;

      if (isNewlyApproved) {
        status = 'APPROVED';
        isNew = true;
      } else if (isNewlyRejected) {
        status = 'REJECTED';
        isNew = true;
      } else if (doc.approvalStatus === 'APPROVED') {
        status = 'APPROVED';
      } else if (doc.approvalStatus === 'REJECTED') {
        status = 'REJECTED';
      }

      return { name: docName, status, isNew };
    });

    const approvedCount = documentStatusList.filter(d => d.status === 'APPROVED').length;
    const rejectedCount = documentStatusList.filter(d => d.status === 'REJECTED').length;
    const pendingCount = documentStatusList.filter(d => d.status === 'PENDING').length;
    const totalDocs = documentStatusList.length;

    // Prepare email content based on review results
    let subject, message;

    if (approvedCount === totalDocs && totalDocs > 0) {
      // TODOS LOS DOCUMENTOS APROBADOS - Mensaje especial de felicitación
      subject = '🎉 ¡Felicitaciones! Todos los Documentos Aprobados - Colegio MTN';
      message = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <!-- Header con logo/banner -->
  <div style="background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px;">🎉 ¡Felicitaciones!</h1>
    <p style="color: #d8f3dc; margin: 10px 0 0 0; font-size: 16px;">Colegio Monte Tabor y Nazaret</p>
  </div>

  <!-- Contenido principal -->
  <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="color: #333; font-size: 16px; line-height: 1.8; margin-top: 0;">
      Estimado/a <strong style="color: #2d6a4f;">${guardianName}</strong>,
    </p>

    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; border-left: 5px solid #28a745; margin: 25px 0;">
      <p style="color: #155724; font-size: 17px; font-weight: bold; margin: 0 0 10px 0;">
        ✅ Excelentes Noticias
      </p>
      <p style="color: #155724; margin: 0; line-height: 1.7;">
        Nos complace informarle que <strong>todos los documentos</strong> de la postulación de
        <strong>${studentName}</strong> han sido revisados y <strong style="color: #28a745;">APROBADOS exitosamente</strong>.
      </p>
    </div>

    <!-- Tabla de documentos -->
    <div style="margin: 30px 0;">
      <h3 style="color: #2d6a4f; border-bottom: 2px solid #2d6a4f; padding-bottom: 10px; margin-bottom: 20px;">
        📋 Estado Detallado de Documentos (${totalDocs})
      </h3>

      <table style="width: 100%; border-collapse: collapse; background-color: #f9f9f9;">
        <thead>
          <tr style="background-color: #2d6a4f; color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Estado</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Documento</th>
          </tr>
        </thead>
        <tbody>
          ${documentStatusList.map((doc, index) => `
          <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
              <span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;
                background-color: #d4edda; color: #155724;">
                ✓ APROBADO
              </span>
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; color: #333;">
              ${doc.isNew ? `<strong>${doc.name}</strong> <span style="color: #28a745; font-size: 12px;">(✨ Nuevo)</span>` : doc.name}
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mensaje de felicitación -->
    <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0;">
      <p style="color: #000; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">
        🏆 ¡Proceso de Documentación Completado!
      </p>
      <p style="color: #333; margin: 0; line-height: 1.6;">
        Puede continuar con el siguiente paso del proceso de admisión.
      </p>
    </div>

    <hr style="border: none; border-top: 2px solid #e9ecef; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.8; margin-bottom: 0;">
      Saludos cordiales,<br>
      <strong style="color: #2d6a4f;">Equipo de Admisiones</strong><br>
      Colegio Monte Tabor y Nazaret
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">Este es un correo automático, por favor no responder.</p>
  </div>
</div>
      `.trim();
    } else if (rejectedCount > 0) {
      // HAY DOCUMENTOS RECHAZADOS - Mostrar estado completo de todos
      subject = rejectedCount === totalDocs
        ? '❌ Documentos Requieren Corrección - Colegio MTN'
        : '⚠️ Revisión de Documentos - Acción Requerida - Colegio MTN';

      message = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <!-- Header con logo/banner -->
  <div style="background: linear-gradient(135deg, #c1121f 0%, #d00000 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px;">⚠️ Revisión de Documentos</h1>
    <p style="color: #ffd6d9; margin: 10px 0 0 0; font-size: 16px;">Colegio Monte Tabor y Nazaret</p>
  </div>

  <!-- Contenido principal -->
  <div style="background-color: #ffffff; padding: 35px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="color: #333; font-size: 16px; line-height: 1.8; margin-top: 0;">
      Estimado/a <strong style="color: #2d6a4f;">${guardianName}</strong>,
    </p>

    <p style="color: #333; line-height: 1.8;">
      Hemos revisado los documentos de la postulación de <strong>${studentName}</strong>.
      ${approvedCount > 0
        ? `<strong style="color: #28a745;">${approvedCount} documento(s)</strong> han sido aprobados, pero <strong style="color: #dc3545;">${rejectedCount} documento(s)</strong> requieren correcciones.`
        : `Los <strong style="color: #dc3545;">${rejectedCount} documento(s)</strong> enviados requieren correcciones.`}
    </p>

    <!-- Resumen de estado -->
    <div style="display: table; width: 100%; margin: 25px 0; border-radius: 8px; overflow: hidden;">
      <div style="display: table-row;">
        <div style="display: table-cell; background-color: #d4edda; padding: 15px; text-align: center; border-right: 2px solid #fff;">
          <div style="font-size: 28px; font-weight: bold; color: #155724;">${approvedCount}</div>
          <div style="font-size: 13px; color: #155724;">Aprobados</div>
        </div>
        <div style="display: table-cell; background-color: #f8d7da; padding: 15px; text-align: center; border-right: 2px solid #fff;">
          <div style="font-size: 28px; font-weight: bold; color: #721c24;">${rejectedCount}</div>
          <div style="font-size: 13px; color: #721c24;">Rechazados</div>
        </div>
        <div style="display: table-cell; background-color: #fff3cd; padding: 15px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #856404;">${pendingCount}</div>
          <div style="font-size: 13px; color: #856404;">Pendientes</div>
        </div>
      </div>
    </div>

    <!-- Tabla detallada de TODOS los documentos -->
    <div style="margin: 30px 0;">
      <h3 style="color: #2d6a4f; border-bottom: 2px solid #2d6a4f; padding-bottom: 10px; margin-bottom: 20px;">
        📋 Estado Detallado de Todos los Documentos (${totalDocs})
      </h3>

      <table style="width: 100%; border-collapse: collapse; background-color: #f9f9f9;">
        <thead>
          <tr style="background-color: #2d6a4f; color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd; width: 30%;">Estado</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Documento</th>
          </tr>
        </thead>
        <tbody>
          ${documentStatusList.map((doc, index) => {
            let statusBadge, bgColor;
            if (doc.status === 'APPROVED') {
              statusBadge = '<span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; background-color: #d4edda; color: #155724;">✓ APROBADO</span>';
              bgColor = index % 2 === 0 ? '#f0fff4' : '#e6f9ed';
            } else if (doc.status === 'REJECTED') {
              statusBadge = '<span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; background-color: #f8d7da; color: #721c24;">✗ RECHAZADO</span>';
              bgColor = index % 2 === 0 ? '#fff5f5' : '#ffe6e6';
            } else {
              statusBadge = '<span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; background-color: #fff3cd; color: #856404;">⏱ PENDIENTE</span>';
              bgColor = index % 2 === 0 ? '#ffffff' : '#fffef0';
            }

            return `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
              ${statusBadge}
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; color: #333;">
              ${doc.isNew ? `<strong>${doc.name}</strong> <span style="color: ${doc.status === 'APPROVED' ? '#28a745' : '#dc3545'}; font-size: 12px;">(✨ Actualizado)</span>` : doc.name}
            </td>
          </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mensaje de acción requerida -->
    ${rejectedCount > 0 ? `
    <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; border-left: 5px solid #ffc107; margin: 25px 0;">
      <p style="color: #856404; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">
        ⚠️ Acción Requerida
      </p>
      <p style="color: #856404; margin: 0; line-height: 1.7;">
        Por favor, <strong>ingrese al sistema</strong> y vuelva a subir los <strong>${rejectedCount} documento(s) rechazado(s)</strong>
        con las correcciones necesarias. Una vez corregidos, serán revisados nuevamente.
      </p>
    </div>
    ` : ''}

    <hr style="border: none; border-top: 2px solid #e9ecef; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.8; margin-bottom: 0;">
      Saludos cordiales,<br>
      <strong style="color: #2d6a4f;">Equipo de Admisiones</strong><br>
      Colegio Monte Tabor y Nazaret
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">Este es un correo automático, por favor no responder.</p>
  </div>
</div>
      `.trim();
    } else {
      // Solo documentos aprobados (sin rechazados) - Algunos documentos aún pendientes
      subject = '✅ Documentos Aprobados - Colegio MTN';
      message = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <!-- Header con logo/banner -->
  <div style="background: linear-gradient(135deg, #2d6a4f 0%, #52b788 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px;">✅ Documentos Aprobados</h1>
    <p style="color: #d8f3dc; margin: 10px 0 0 0; font-size: 16px;">Colegio Monte Tabor y Nazaret</p>
  </div>

  <!-- Contenido principal -->
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Saludo personalizado -->
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
      Estimado/a <strong style="color: #2d6a4f;">${guardianName}</strong>,
    </p>

    <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
      Le informamos que se han aprobado nuevos documentos de la postulación de <strong>${studentName}</strong>.
    </p>

    <!-- Resumen de estado -->
    <div style="background: linear-gradient(135deg, #d8f3dc 0%, #b7e4c7 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
      <h3 style="color: #1b4332; margin: 0 0 15px 0; font-size: 18px;">📊 Resumen de Documentos</h3>
      <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
        <div style="margin: 10px;">
          <p style="margin: 0; color: #1b4332; font-size: 28px; font-weight: bold;">${approvedCount}</p>
          <p style="margin: 5px 0 0 0; color: #2d6a4f; font-size: 14px;">Aprobados</p>
        </div>
        <div style="margin: 10px;">
          <p style="margin: 0; color: #d4a825; font-size: 28px; font-weight: bold;">${pendingCount}</p>
          <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">Pendientes</p>
        </div>
        <div style="margin: 10px;">
          <p style="margin: 0; color: #1b4332; font-size: 28px; font-weight: bold;">${totalDocs}</p>
          <p style="margin: 5px 0 0 0; color: #2d6a4f; font-size: 14px;">Total</p>
        </div>
      </div>
    </div>

    <!-- Tabla completa de documentos -->
    <h3 style="color: #1b4332; margin-bottom: 15px; font-size: 18px;">📋 Estado Detallado de Documentos</h3>

    <table style="width: 100%; border-collapse: collapse; background-color: #f9f9f9; margin-bottom: 25px;">
      <thead>
        <tr style="background-color: #2d6a4f; color: white;">
          <th style="padding: 12px; text-align: left; border: 1px solid #ddd; font-size: 14px;">Estado</th>
          <th style="padding: 12px; text-align: left; border: 1px solid #ddd; font-size: 14px;">Documento</th>
        </tr>
      </thead>
      <tbody>
        ${documentStatusList.map((doc, index) => {
          let badgeColor = '#ffc107'; // Pending - yellow
          let badgeTextColor = '#856404';
          let badgeText = '⏳ PENDIENTE';
          let rowBgColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';

          if (doc.status === 'APPROVED') {
            badgeColor = '#d4edda';
            badgeTextColor = '#155724';
            badgeText = '✓ APROBADO';
            rowBgColor = index % 2 === 0 ? '#f1f9f4' : '#e8f5e9'; // Green tint
          }

          return `
        <tr style="background-color: ${rowBgColor};">
          <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
            <span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold;
              background-color: ${badgeColor}; color: ${badgeTextColor};">
              ${badgeText}
            </span>
          </td>
          <td style="padding: 12px; border: 1px solid #ddd; color: #333;">
            ${doc.isNew ? `<strong>${doc.name}</strong> <span style="color: #28a745; font-size: 12px;">(✨ Nuevo)</span>` : doc.name}
          </td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    ${pendingCount > 0 ? `
    <!-- Información sobre documentos pendientes -->
    <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 20px; border-radius: 5px; margin-bottom: 25px;">
      <h4 style="color: #856404; margin-top: 0; font-size: 16px;">⏳ Documentos Pendientes</h4>
      <p style="color: #856404; font-size: 14px; line-height: 1.6; margin: 0;">
        Aún quedan <strong>${pendingCount} documento(s)</strong> pendientes de revisión.
        Le notificaremos cuando sean evaluados.
      </p>
    </div>
    ` : ''}

    <!-- Mensaje de cierre -->
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 5px;">
      Saludos cordiales,
    </p>
    <p style="color: #2d6a4f; font-size: 15px; font-weight: bold; margin: 0;">
      Equipo de Admisiones<br>
      Colegio Monte Tabor y Nazaret
    </p>

  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">Este es un correo automático, por favor no responder.</p>
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

/**
 * @route   POST /api/institutional-emails/evaluation-assignment/:evaluationId
 * @desc    Send evaluation assignment notification to evaluator (teacher/psychologist)
 * @access  Public (called by evaluation-service)
 */
router.post('/evaluation-assignment/:evaluationId', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { evaluatorEmail, evaluatorName, studentName, evaluationType, applicationId } = req.body;

    logger.info(`📧 Sending evaluation assignment email for evaluation ${evaluationId}`);

    // Validation
    if (!evaluatorEmail || !evaluatorName || !studentName || !evaluationType) {
      return res.status(400).json(fail(
        'INST_EMAIL_007',
        'Missing required fields',
        'evaluatorEmail, evaluatorName, studentName, and evaluationType are required'
      ));
    }

    // Map evaluation type to Spanish label
    const evaluationTypeLabels = {
      'MATHEMATICS_EXAM': 'Examen de Matemáticas',
      'LANGUAGE_EXAM': 'Examen de Lenguaje',
      'PSYCHOSOCIAL_INTERVIEW': 'Entrevista Psicosocial',
      'FAMILY_INTERVIEW': 'Entrevista Familiar',
      'DIRECTOR_INTERVIEW': 'Entrevista con Director',
      'ACADEMIC_PERFORMANCE': 'Evaluación de Rendimiento Académico',
      'BEHAVIORAL_ASSESSMENT': 'Evaluación Conductual'
    };

    const evaluationLabel = evaluationTypeLabels[evaluationType] || evaluationType;

    // Email subject and message
    const subject = `📋 Nueva Evaluación Asignada - ${evaluationLabel}`;

    const message = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <!-- Header con logo/banner -->
  <div style="background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 26px;">📋 Nueva Evaluación Asignada</h1>
    <p style="color: #d8f3dc; margin: 10px 0 0 0; font-size: 16px;">Colegio Monte Tabor y Nazaret</p>
  </div>

  <!-- Contenido principal -->
  <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Saludo personalizado -->
    <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
      Estimado/a <strong style="color: #2d6a4f;">${evaluatorName}</strong>,
    </p>

    <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 25px;">
      Se le ha asignado una nueva evaluación en el proceso de admisión del Colegio Monte Tabor y Nazaret.
    </p>

    <!-- Información de la evaluación -->
    <div style="background: linear-gradient(135deg, #d8f3dc 0%, #b7e4c7 100%); padding: 25px; border-radius: 8px; margin-bottom: 25px;">
      <h3 style="color: #1b4332; margin: 0 0 20px 0; font-size: 18px; border-bottom: 2px solid #52b788; padding-bottom: 10px;">
        📝 Detalles de la Evaluación
      </h3>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; color: #2d6a4f; font-weight: bold; width: 40%;">
            👨‍🎓 Estudiante:
          </td>
          <td style="padding: 12px 0; color: #1b4332; font-size: 15px;">
            <strong>${studentName}</strong>
          </td>
        </tr>
        <tr style="background-color: rgba(255, 255, 255, 0.5);">
          <td style="padding: 12px 0; color: #2d6a4f; font-weight: bold;">
            📋 Tipo de Evaluación:
          </td>
          <td style="padding: 12px 0; color: #1b4332; font-size: 15px;">
            <strong>${evaluationLabel}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #2d6a4f; font-weight: bold;">
            🔢 ID de Evaluación:
          </td>
          <td style="padding: 12px 0; color: #666; font-size: 14px;">
            #${evaluationId}
          </td>
        </tr>
        ${applicationId ? `
        <tr style="background-color: rgba(255, 255, 255, 0.5);">
          <td style="padding: 12px 0; color: #2d6a4f; font-weight: bold;">
            📄 ID de Postulación:
          </td>
          <td style="padding: 12px 0; color: #666; font-size: 14px;">
            #${applicationId}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Próximos pasos -->
    <div style="background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 20px; border-radius: 5px; margin-bottom: 25px;">
      <h4 style="color: #856404; margin-top: 0; font-size: 16px;">
        📌 Próximos Pasos
      </h4>
      <ul style="color: #856404; font-size: 14px; line-height: 1.8; margin: 10px 0; padding-left: 20px;">
        <li>Acceda al sistema de admisiones para ver los detalles completos</li>
        <li>Revise la información del estudiante antes de la evaluación</li>
        <li>Coordine la fecha y hora de la evaluación (si aplica)</li>
        <li>Complete la evaluación dentro del plazo establecido</li>
      </ul>
    </div>

    <!-- Información importante -->
    <div style="background-color: #e3f2fd; border-left: 5px solid #2196f3; padding: 20px; border-radius: 5px; margin-bottom: 25px;">
      <h4 style="color: #0d47a1; margin-top: 0; font-size: 16px;">
        ℹ️ Información Importante
      </h4>
      <p style="color: #1565c0; font-size: 14px; line-height: 1.6; margin: 0;">
        Por favor, complete esta evaluación a la brevedad posible. Recuerde que su evaluación es fundamental para el proceso de admisión del estudiante. Si tiene alguna pregunta o necesita más información, no dude en contactar al equipo de admisiones.
      </p>
    </div>

    <!-- Mensaje de cierre -->
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 5px;">
      Gracias por su compromiso con el proceso de admisión.
    </p>
    <p style="color: #2d6a4f; font-size: 15px; font-weight: bold; margin: 0;">
      Equipo de Admisiones<br>
      Colegio Monte Tabor y Nazaret
    </p>

  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">Este es un correo automático, por favor no responder.</p>
    <p style="margin: 5px 0 0 0;">Si tiene dudas, contacte a admisiones@mtn.cl</p>
  </div>
</div>
    `.trim();

    // Send email
    try {
      const result = await emailService.sendEmail(evaluatorEmail, subject, message);

      logger.info(`✅ Evaluation assignment email sent for evaluation ${evaluationId}`, {
        messageId: result.messageId,
        recipient: evaluatorEmail,
        evaluationType
      });

      res.json(ok({
        message: 'Evaluation assignment email sent successfully',
        evaluationId,
        emailSent: true,
        recipient: evaluatorEmail,
        messageId: result.messageId
      }));
    } catch (emailError) {
      logger.error('❌ Error sending evaluation assignment email:', emailError);

      // Return success but indicate email failed (so evaluation assignment can continue)
      res.json(ok({
        message: 'Evaluation assigned but email failed to send',
        evaluationId,
        emailSent: false,
        error: emailError.message
      }));
    }
  } catch (error) {
    logger.error('Error in evaluation-assignment endpoint:', error);
    res.status(500).json(fail('INST_EMAIL_007', 'Error processing evaluation assignment notification', error.message));
  }
});

module.exports = router;
