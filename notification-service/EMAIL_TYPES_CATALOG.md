# Catálogo de Tipos de Emails del Sistema de Admisión MTN

Este documento describe todos los tipos de emails que el sistema de admisión debe enviar según el flujo del frontend.

**Fecha de prueba:** 21 de Octubre, 2025
**Destinatario de prueba:** jorge.gangale@mtn.cl
**Total de tipos de emails:** 14

### Categorías:
- **Emails para Apoderados:** 8 tipos (Verificación, Confirmación, Entrevistas, Estados, Documentos, Aprobación/Rechazo)
- **Emails para Personal (Entrevistadores):** 2 tipos
- **Emails para Personal (Evaluadores):** 3 tipos
- **Emails para Coordinación:** 1 tipo

---

## 1. Email de Verificación de Registro

**Trigger:** Usuario completa el formulario de registro
**Endpoint:** `POST /api/email/send-verification`
**Destinatario:** Email del usuario registrándose
**Asunto:** `Código de Verificación - Colegio MTN`

### Contenido:
- Saludo personalizado con nombre del usuario
- Código de verificación de 6 dígitos (generado aleatoriamente)
- Tiempo de expiración: 15 minutos
- Advertencia de ignorar si no solicitó el código

### Datos dinámicos:
```javascript
{
  firstName: "Jorge",
  lastName: "Gangale",
  verificationCode: "123456",
  expiresAt: "2025-10-21T13:10:00Z"
}
```

### Message ID de prueba:
`<c7cb4409-de40-6f29-cbcc-8d076bd61d49@mtn.cl>`

---

## 2. Email de Confirmación de Aplicación Recibida

**Trigger:** Apoderado completa y envía una aplicación
**Endpoint:** `POST /api/notifications/email` (después de crear aplicación)
**Destinatario:** Email del apoderado
**Asunto:** `Aplicación Recibida - Admisión 2025 Colegio MTN`

### Contenido:
- Confirmación de recepción de la aplicación
- Detalles de la aplicación:
  - Número de aplicación
  - Nombre del estudiante
  - RUT del estudiante
  - Grado solicitado
  - Fecha de recepción
  - Estado inicial: "EN REVISIÓN"
- Próximos pasos del proceso
- Link para ver estado en tiempo real

### Datos dinámicos:
```javascript
{
  applicationNumber: "#APP-2025-001234",
  studentName: "María González López",
  studentRut: "20.123.456-7",
  grade: "5° Básico",
  receivedDate: "21 de Octubre, 2025",
  status: "EN REVISIÓN"
}
```

### Message ID de prueba:
`<9a16f3c3-0877-c886-1db4-caabb408f3e4@mtn.cl>`

---

## 3. Email de Entrevista Programada

**Trigger:** Coordinador programa una entrevista para un postulante
**Endpoint:** `POST /api/notifications/email` (después de crear entrevista)
**Destinatario:** Email del apoderado
**Asunto:** `Entrevista Programada - Admisión 2025 Colegio MTN`

### Contenido:
- Confirmación de entrevista programada
- Detalles de la entrevista:
  - Tipo de entrevista (Familiar/Director de Ciclo/Individual)
  - Fecha y hora
  - Nombre del entrevistador
  - Lugar específico (oficina, dirección)
  - Duración estimada
- Instrucciones importantes:
  - Confirmar asistencia
  - Requisitos (presencia de apoderados, documentos)
  - Llegar con anticipación
- Información de contacto para reprogramar

### Datos dinámicos:
```javascript
{
  interviewType: "Entrevista Familiar",
  date: "Viernes, 25 de Octubre de 2025",
  time: "14:30 hrs",
  interviewerName: "Prof. Ana Martínez",
  interviewerRole: "Directora de Ciclo",
  location: "Oficina de Admisiones - Colegio MTN\nAv. Providencia 1234, Santiago",
  duration: "45 minutos",
  studentName: "María González López"
}
```

### Message ID de prueba:
`<1a7621d0-bff3-0e07-b721-24768ad9379c@mtn.cl>`

---

## 4. Email de Recordatorio de Entrevista

**Trigger:** 24 horas antes de la entrevista programada (cron job)
**Endpoint:** `POST /api/notifications/email` (enviado automáticamente)
**Destinatario:** Email del apoderado
**Asunto:** `⏰ Recordatorio: Entrevista Mañana - Colegio MTN`

### Contenido:
- Recordatorio urgente de entrevista al día siguiente
- Resumen de detalles de la entrevista (mismos que email #3)
- Checklist antes de la entrevista:
  - Documentos a llevar
  - Hora de llegada recomendada
  - Número de aplicación
- Instrucciones de cómo llegar (transporte público, estacionamiento)
- Contacto para reprogramación de emergencia

### Datos dinámicos:
```javascript
{
  // Mismos datos que email #3 +
  applicationNumber: "#APP-2025-001234",
  arrivalTime: "14:20 hrs", // 10 min antes
  transportInfo: "Metro: Línea 1, Estación Pedro de Valdivia"
}
```

### Message ID de prueba:
`<bafda221-5276-7199-ac04-d340c3116e83@mtn.cl>`

---

## 5. Email de Cambio de Estado de Aplicación

**Trigger:** Cuando cambia el estado de una aplicación
**Endpoint:** `POST /api/notifications/email` (después de actualizar estado)
**Destinatario:** Email del apoderado
**Asunto:** `Actualización de Estado - Aplicación #APP-2025-001234`

### Contenido:
- Notificación de cambio de estado
- Detalles del cambio:
  - Número de aplicación
  - Estado anterior
  - Estado nuevo
  - Fecha y hora del cambio
- Comentarios del equipo de admisión (opcional)
- Próximos pasos según el nuevo estado
- Link para ver más detalles en el sistema

### Estados posibles:
- `DRAFT` → `SUBMITTED`
- `SUBMITTED` → `UNDER_REVIEW`
- `UNDER_REVIEW` → `INTERVIEW_SCHEDULED`
- `INTERVIEW_SCHEDULED` → `EVALUATED`
- `EVALUATED` → `APPROVED` / `REJECTED`
- `APPROVED` → `ENROLLED`

### Datos dinámicos:
```javascript
{
  applicationNumber: "#APP-2025-001234",
  studentName: "María González López",
  previousStatus: "EN REVISIÓN",
  currentStatus: "EVALUADO",
  changedAt: "21 de Octubre, 2025 - 10:30 hrs",
  comments: "La documentación ha sido revisada satisfactoriamente..."
}
```

### Message ID de prueba:
`<747c93aa-ded3-bd26-b4a0-2dbd0548b2d7@mtn.cl>`

---

## 6. Email de Solicitud de Documentos Adicionales

**Trigger:** Coordinador marca documentos como rechazados o faltantes
**Endpoint:** `POST /api/notifications/email` (después de rechazar documentos)
**Destinatario:** Email del apoderado
**Asunto:** `📎 Documentos Adicionales Requeridos - Aplicación #APP-2025-001234`

### Contenido:
- Solicitud de documentación adicional
- Lista de documentos requeridos con:
  - Nombre del documento
  - Motivo de la solicitud (no legible, desactualizado, faltante)
- Plazo de entrega
- Formas de envío:
  - Subir al sistema (con botón/link directo)
  - Enviar por correo electrónico
  - Presentar presencialmente
- Formatos aceptados y tamaño máximo
- Advertencia de que el proceso está pausado hasta recibir documentos

### Datos dinámicos:
```javascript
{
  applicationNumber: "#APP-2025-001234",
  studentName: "María González López",
  requiredDocuments: [
    {
      name: "Certificado de Nacimiento",
      reason: "El documento presentado no es legible en su totalidad"
    },
    {
      name: "Informe de Notas Actualizado",
      reason: "Requerimos las notas del semestre actual"
    },
    {
      name: "Certificado Médico",
      reason: "Documento no presentado"
    }
  ],
  deadline: "28 de Octubre, 2025",
  uploadLink: "https://admision.mtn.cl/upload-documents/APP-2025-001234"
}
```

### Message ID de prueba:
`<cec1da15-f3e5-9d52-7d90-7d5d1a046443@mtn.cl>`

---

## 7. Email de Aprobación Final (ACEPTADO)

**Trigger:** Comité de admisión aprueba una aplicación
**Endpoint:** `POST /api/notifications/email` (después de cambiar estado a APPROVED)
**Destinatario:** Email del apoderado
**Asunto:** `🎉 ¡ACEPTADO! - Admisión 2025 Colegio MTN`

### Contenido:
- **Header visual celebratorio**
- Felicitaciones por la aceptación
- Detalles de admisión:
  - Estudiante aceptado
  - Grado
  - Año escolar
  - Número de aplicación
  - Fecha de aceptación
- **Próximos pasos para matrícula:**
  1. Confirmar aceptación (plazo)
  2. Agendar cita presencial
  3. Documentación final a presentar
  4. Pago de matrícula
- **Información de costos:**
  - Matrícula anual
  - Mensualidad
  - Descuentos disponibles
- **Advertencia de plazo:** Confirmar antes de X fecha o se libera el cupo
- **Botón CTA:** Confirmar Aceptación y Agendar Cita
- Mensaje de bienvenida a la familia MTN

### Datos dinámicos:
```javascript
{
  studentName: "María González López",
  studentRut: "20.123.456-7",
  grade: "5° Básico",
  schoolYear: "2025",
  applicationNumber: "#APP-2025-001234",
  acceptanceDate: "21 de Octubre, 2025",
  confirmationDeadline: "26 de Octubre, 2025",
  costs: {
    enrollment: "$350.000 CLP",
    monthly: "$280.000 CLP",
    installments: 10
  },
  documentsRequired: [
    "Certificado de nacimiento original",
    "Certificado de estudios del año en curso",
    "Informe de personalidad",
    "Certificado médico actualizado",
    "4 fotos tamaño carnet",
    "Fotocopia cédula de identidad"
  ],
  confirmationLink: "https://admision.mtn.cl/confirm-enrollment/APP-2025-001234"
}
```

### Message ID de prueba:
`<f96c3280-662e-0475-0c2b-f2a6f7ab225a@mtn.cl>`

---

## 8. Email de Rechazo

**Trigger:** Comité de admisión rechaza una aplicación
**Endpoint:** `POST /api/notifications/email` (después de cambiar estado a REJECTED)
**Destinatario:** Email del apoderado
**Asunto:** `Resultado del Proceso de Admisión - Colegio MTN`

### Contenido:
- **Tono empático y profesional**
- Agradecimiento por el interés y tiempo dedicado
- Detalles de la aplicación
- Comunicación del resultado negativo (sin usar palabra "rechazo" en título)
- Consideraciones importantes:
  - No refleja capacidades del estudiante
  - Alta demanda vs cupos limitados
  - Proceso equitativo para todos
- **Opciones futuras:**
  - Postular nuevamente el próximo año
  - Ingreso a lista de espera
  - Postular a otros grados
- Ofrecimiento de feedback/reunión
- Mejores deseos para el futuro

### Datos dinámicos:
```javascript
{
  studentName: "María González López",
  applicationNumber: "#APP-2025-001234",
  gradeApplied: "5° Básico",
  schoolYear: "2025",
  feedbackOffered: true
}
```

### Message ID de prueba:
`<df6f87ed-bec7-f619-bc4f-8dea6f968609@mtn.cl>`

---

## Resumen de Envíos de Prueba

Todos los emails fueron enviados exitosamente a **jorge.gangale@mtn.cl** el 21 de Octubre de 2025.

### Estadísticas:
- **Total de emails enviados:** 14
- **Tasa de éxito:** 100%
- **Modo:** PRODUCTION (emails reales enviados vía SMTP)
- **Servidor SMTP:** smtp.gmail.com:587
- **Remitente:** Admisión MTN <admision@mtn.cl>

### Message IDs - Emails para Apoderados:
1. `<c7cb4409-de40-6f29-cbcc-8d076bd61d49@mtn.cl>` - Verificación
2. `<9a16f3c3-0877-c886-1db4-caabb408f3e4@mtn.cl>` - Confirmación Aplicación
3. `<1a7621d0-bff3-0e07-b721-24768ad9379c@mtn.cl>` - Entrevista Programada
4. `<bafda221-5276-7199-ac04-d340c3116e83@mtn.cl>` - Recordatorio Entrevista
5. `<747c93aa-ded3-bd26-b4a0-2dbd0548b2d7@mtn.cl>` - Cambio de Estado
6. `<cec1da15-f3e5-9d52-7d90-7d5d1a046443@mtn.cl>` - Solicitud Documentos
7. `<f96c3280-662e-0475-0c2b-f2a6f7ab225a@mtn.cl>` - Aprobación
8. `<df6f87ed-bec7-f619-bc4f-8dea6f968609@mtn.cl>` - Rechazo

### Message IDs - Emails para Personal (Entrevistadores):
9. `<f81324db-c502-0983-b75d-1c44d95790cb@mtn.cl>` - Entrevista Asignada
10. `<52e33f7c-cab5-e7c8-3f66-a26d6f4f9ee3@mtn.cl>` - Recordatorio Entrevistador

### Message IDs - Emails para Personal (Evaluadores):
11. `<d8dc1966-b2ef-461e-a9af-33a425d4f088@mtn.cl>` - Examen Asignado
12. `<7674022f-947c-b3bd-8311-7762a4bbd89f@mtn.cl>` - Recordatorio Examen Pendiente
13. `<44f03151-26af-0f4f-4960-6663af2db47b@mtn.cl>` - Alerta Urgente Examen

### Message IDs - Emails para Coordinación:
14. `<c0d514f4-b466-78da-4297-0503fc920112@mtn.cl>` - Resumen Semanal

---

## Próximos Pasos de Implementación

### 1. Crear Templates HTML Reutilizables
Ubicación sugerida: `notification-service/src/templates/`

```
templates/
├── verification-code.hbs
├── application-received.hbs
├── interview-scheduled.hbs
├── interview-reminder.hbs
├── status-change.hbs
├── documents-required.hbs
├── application-approved.hbs
└── application-rejected.hbs
```

### 2. Integrar Envío de Emails en Flujos del Sistema

**Application Service:**
- Después de crear aplicación → Email #2 (Confirmación)
- Después de cambiar estado → Email #5 (Cambio de Estado)
- Después de rechazar documentos → Email #6 (Solicitud Documentos)
- Después de aprobar → Email #7 (Aprobación)
- Después de rechazar → Email #8 (Rechazo)

**Evaluation Service:**
- Después de crear entrevista → Email #3 (Entrevista Programada)

**User Service:**
- Después de registro → Email #1 (Verificación)

**Cron Jobs (Notification Service):**
- Diariamente verificar entrevistas de mañana → Email #4 (Recordatorio)

### 3. Variables de Entorno para Templates

```env
# Email Templates Configuration
EMAIL_TEMPLATES_DIR=./src/templates
EMAIL_BASE_URL=https://admision.mtn.cl
EMAIL_CONTACT_EMAIL=admision@mtn.cl
EMAIL_CONTACT_PHONE=+56 2 2345 6789
EMAIL_COLLEGE_ADDRESS=Av. Providencia 1234, Santiago
```

### 4. Configuración de Handlebars

```javascript
// src/utils/templateEngine.js
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const renderTemplate = (templateName, data) => {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.hbs`);
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);
  return template(data);
};
```

### 5. Helpers de Envío por Tipo

```javascript
// src/services/EmailNotificationService.js
class EmailNotificationService {
  async sendVerificationCode(email, firstName, lastName, code) { ... }
  async sendApplicationReceived(email, applicationData) { ... }
  async sendInterviewScheduled(email, interviewData) { ... }
  async sendInterviewReminder(email, interviewData) { ... }
  async sendStatusChange(email, statusData) { ... }
  async sendDocumentsRequired(email, documentsData) { ... }
  async sendApplicationApproved(email, approvalData) { ... }
  async sendApplicationRejected(email, rejectionData) { ... }
}
```

---

## Notas Finales

- Todos los emails usan HTML para mejor presentación
- Se incluyen emojis para mejorar el engagement
- Los CTAs (Call-to-Action) son botones destacados
- Se mantiene un tono profesional pero cercano
- Los emails de rechazo son especialmente empáticos
- Se incluye información de contacto en todos los emails
- Los plazos y fechas importantes están destacados visualmente

---

**Documento generado:** 21 de Octubre, 2025
**Responsable:** Sistema de Notificaciones - Colegio MTN
**Contacto:** admision@mtn.cl

---

## 9. Email a Entrevistador - Nueva Entrevista Asignada

**Trigger:** Coordinador programa una entrevista y asigna un entrevistador
**Endpoint:** `POST /api/notifications/email` (después de asignar entrevistador)
**Destinatario:** Email del entrevistador (TEACHER, CYCLE_DIRECTOR)
**Asunto:** `📋 Nueva Entrevista Asignada - Sistema de Admisión MTN`

### Contenido:
- Notificación de nueva entrevista asignada
- Detalles completos de la entrevista:
  - Tipo de entrevista
  - Aplicación y estudiante
  - Apoderados
  - Fecha, hora, lugar
  - Duración
- Información del postulante:
  - Colegio actual
  - Promedio académico
  - Preferencias de admisión
  - Notas adicionales
- Documentos disponibles para revisión
- Link al expediente completo
- Recordatorios importantes:
  - Revisar expediente antes
  - Completar pauta después
  - Llegar con anticipación

### Datos dinámicos:
```javascript
{
  interviewerName: "Prof. Jorge Gangale",
  interviewType: "Entrevista Familiar",
  applicationNumber: "#APP-2025-001234",
  studentName: "María González López",
  studentGrade: "5° Básico",
  guardians: "Jorge Gangale y Ana María Pérez",
  date: "Viernes, 25 de Octubre de 2025",
  time: "14:30 hrs",
  location: "Oficina de Admisiones - Sala 3",
  duration: "45 minutos",
  currentSchool: "Escuela Básica Central",
  average: "6.5",
  admissionPreference: "Hermano en el colegio",
  notes: "Estudiante destacada en matemáticas",
  documentsAvailable: ["Certificado de notas", "Informe de personalidad", "Cartas de recomendación"],
  expedientUrl: "https://admision.mtn.cl/staff/interviews/12345"
}
```

### Message ID de prueba:
`<f81324db-c502-0983-b75d-1c44d95790cb@mtn.cl>`

---

## 10. Email Recordatorio a Entrevistador (24h antes)

**Trigger:** Cron job diario verifica entrevistas de mañana
**Endpoint:** `POST /api/notifications/email` (cron automático)
**Destinatario:** Email del entrevistador
**Asunto:** `⏰ Recordatorio: Entrevista Mañana - Prof. [Nombre]`

### Contenido:
- Recordatorio urgente de entrevista al día siguiente
- Resumen de detalles de la entrevista
- Checklist pre-entrevista:
  - Revisar expediente
  - Leer informes
  - Preparar pauta de evaluación
  - Verificar sala
- Resumen del postulante (académico y personal)
- Aspectos clave a evaluar:
  - Motivación
  - Valores familiares
  - Expectativas académicas
  - Compromiso con formación integral
- Links rápidos a expediente y pauta
- Recordatorio de completar evaluación después

### Datos dinámicos:
```javascript
{
  interviewerName: "Prof. Jorge Gangale",
  studentName: "María González López",
  applicationNumber: "#APP-2025-001234",
  interviewType: "Entrevista Familiar",
  date: "Viernes, 25 de Octubre de 2025",
  time: "14:30 hrs",
  location: "Oficina de Admisiones - Sala 3",
  guardians: "Jorge Gangale y Ana María Pérez",
  studentSummary: {
    average: "6.5",
    currentSchool: "Escuela Básica Central",
    strengths: "Matemáticas, responsabilidad",
    activities: "Fútbol, ajedrez"
  },
  expedientUrl: "https://admision.mtn.cl/staff/interviews/12345/review",
  evaluationFormUrl: "https://admision.mtn.cl/staff/interviews/12345/evaluation-form"
}
```

### Message ID de prueba:
`<52e33f7c-cab5-e7c8-3f66-a26d6f4f9ee3@mtn.cl>`

---

## 11. Email a Profesor - Nuevo Examen Asignado

**Trigger:** Estudiante completa un examen y se asigna a un profesor para corrección
**Endpoint:** `POST /api/notifications/email` (después de asignar evaluador)
**Destinatario:** Email del profesor evaluador
**Asunto:** `📝 Nuevo Examen Asignado para Revisión - Sistema de Admisión MTN`

### Contenido:
- Notificación de nuevo examen asignado
- Detalles del examen:
  - Estudiante y aplicación
  - Grado y asignatura
  - Tipo de evaluación
  - Fecha del examen
  - Plazo de corrección (destacado)
- Información del examen:
  - Número de preguntas
  - Puntaje total
  - Tiempo rendido
  - Temas evaluados
- Archivos disponibles:
  - Hoja de respuestas escaneada
  - Pauta de corrección
  - Tabla de puntajes
- Rúbrica de evaluación con rangos
- Instrucciones de completar:
  - Puntaje por sección
  - Observaciones
  - Nivel de dominio
  - Recomendación final
- Recordatorios de cumplimiento de plazo

### Datos dinámicos:
```javascript
{
  professorName: "Prof. Jorge Gangale",
  studentName: "María González López",
  applicationNumber: "#APP-2025-001234",
  grade: "5° Básico",
  subject: "Matemáticas",
  evaluationType: "Examen Diagnóstico",
  examDate: "20 de Octubre, 2025",
  assignedDate: "21 de Octubre, 2025 - 09:00 hrs",
  deadline: "25 de Octubre, 2025 (4 días)",
  examDetails: {
    totalQuestions: 25,
    multipleChoice: 15,
    essay: 10,
    totalPoints: 100,
    duration: "90 minutos",
    topics: ["Álgebra básica", "geometría", "resolución de problemas"]
  },
  files: [
    { name: "Hoja de respuestas", size: "2.3 MB" },
    { name: "Pauta de corrección", size: "850 KB" }
  ],
  reviewUrl: "https://admision.mtn.cl/staff/evaluations/exam-45678/review"
}
```

### Message ID de prueba:
`<d8dc1966-b2ef-461e-a9af-33a425d4f088@mtn.cl>`

---

## 12. Email Recordatorio - Examen Pendiente de Corrección

**Trigger:** Cron job diario verifica exámenes pendientes (2 días antes de vencer)
**Endpoint:** `POST /api/notifications/email` (cron automático)
**Destinatario:** Email del profesor evaluador
**Asunto:** `⏰ Recordatorio: Examen Pendiente de Corrección - Prof. [Nombre]`

### Contenido:
- Recordatorio de examen pendiente
- Detalles del examen pendiente
- Estado de corrección:
  - Estado actual
  - Progreso (%)
  - Tiempo restante destacado
- Barra de progreso visual
- Acciones rápidas:
  - Botón "Corregir Ahora"
  - Opción "Solicitar Extensión"
- Resumen de información del examen
- Advertencia sobre importancia de cumplir plazo
- Lista de otros exámenes pendientes del profesor

### Datos dinámicos:
```javascript
{
  professorName: "Prof. Jorge Gangale",
  studentName: "María González López",
  applicationNumber: "#APP-2025-001234",
  subject: "Matemáticas",
  examType: "Examen Diagnóstico",
  assignedDate: "21 de Octubre, 2025",
  deadline: "25 de Octubre, 2025",
  daysRemaining: 2,
  status: "PENDIENTE",
  progress: 0,
  reviewUrl: "https://admision.mtn.cl/staff/evaluations/exam-45678/review",
  postponeUrl: "https://admision.mtn.cl/staff/evaluations/exam-45678/postpone",
  otherPendingExams: [
    { student: "Juan Pérez", subject: "Lenguaje", deadline: "26 Oct" },
    { student: "Ana Torres", subject: "Ciencias", deadline: "27 Oct" }
  ]
}
```

### Message ID de prueba:
`<7674022f-947c-b3bd-8311-7762a4bbd89f@mtn.cl>`

---

## 13. Email de Alerta - Examen Próximo a Vencer (Urgente)

**Trigger:** Cron job verifica exámenes que vencen en < 24 horas
**Endpoint:** `POST /api/notifications/email` (cron automático con prioridad alta)
**Destinatario:** Email del profesor evaluador
**Asunto:** `🚨 URGENTE: Examen Vence en 24 Horas - Prof. [Nombre]`

### Contenido:
- **Header visual urgente (rojo)**
- Alerta de examen próximo a vencer (< 24 horas)
- Detalles del examen con formato de urgencia
- Tiempo restante en formato destacado
- Estado actual (sin iniciar/parcial)
- Botón CTA urgente "CORREGIR AHORA"
- Consecuencias del incumplimiento:
  - Retraso en proceso
  - Reasignación a otro docente
  - Registro de incumplimiento
  - Notificación a coordinación
- Contactos de emergencia si necesita extensión
- Información del examen (tiempo estimado de corrección)
- Advertencia final sobre acciones automáticas del sistema

### Datos dinámicos:
```javascript
{
  professorName: "Prof. Jorge Gangale",
  studentName: "María González López",
  applicationNumber: "#APP-2025-001234",
  subject: "Matemáticas",
  examType: "Examen Diagnóstico",
  assignedDate: "21 de Octubre, 2025",
  deadline: "25 de Octubre, 2025 a las 23:59 hrs",
  hoursRemaining: "< 24",
  status: "PENDIENTE - SIN INICIAR",
  notificationsSent: 3,
  reviewUrl: "https://admision.mtn.cl/staff/evaluations/exam-45678/review",
  emergencyContacts: [
    { name: "Ana Martínez", role: "Coordinadora", email: "a.martinez@mtn.cl", phone: "+56 9 8765 4321" },
    { name: "Carlos Rodríguez", role: "Director Académico", email: "c.rodriguez@mtn.cl", phone: "+56 9 8765 4322" }
  ]
}
```

### Message ID de prueba:
`<44f03151-26af-0f4f-4960-6663af2db47b@mtn.cl>`

---

## 14. Email Resumen Semanal para Coordinador

**Trigger:** Cron job semanal (lunes 08:00 hrs)
**Endpoint:** `POST /api/notifications/email` (cron automático semanal)
**Destinatario:** Email del coordinador de admisión (ADMIN, COORDINATOR)
**Asunto:** `📊 Resumen Semanal del Proceso de Admisión - Semana [XX]/2025`

### Contenido:
- Resumen ejecutivo de la semana
- **Sección Aplicaciones:**
  - Nuevas aplicaciones
  - Estados actuales (revisión, evaluadas, aprobadas, rechazadas)
  - Total activas
- **Sección Entrevistas:**
  - Realizadas en la semana (por tipo)
  - Programadas próxima semana
  - Pendientes de programar
- **Sección Evaluaciones Académicas:**
  - Exámenes aplicados
  - Exámenes corregidos (%)
  - Exámenes pendientes (%)
  - Exámenes próximos a vencer
  - Promedio de corrección
- **Desempeño del Equipo:**
  - Top 3 entrevistadores
  - Top 3 evaluadores
  - Docentes con retrasos
- **Alertas y Acciones Requeridas:**
  - Lista numerada de alertas prioritarias
- **Estadísticas por Grado:**
  - Tabla con aplicaciones, aprobadas, cupos
- **Próxima Semana:**
  - Eventos importantes
  - Plazos cercanos
- Link al reporte completo

### Datos dinámicos:
```javascript
{
  coordinatorName: "Jorge Gangale",
  weekNumber: 43,
  year: 2025,
  dateRange: "21-27 de Octubre",
  applications: {
    new: 23,
    inReview: 45,
    evaluated: 18,
    approved: 12,
    rejected: 6,
    totalActive: 98
  },
  interviews: {
    completed: 15,
    byType: { family: 8, cycleDirector: 5, individual: 2 },
    scheduledNextWeek: 12,
    pendingSchedule: 8
  },
  evaluations: {
    applied: 28,
    corrected: 20,
    pending: 8,
    aboutToExpire: 3,
    avgCorrectionDays: 3.2
  },
  topPerformers: {
    interviewers: [
      { name: "Prof. Ana Martínez", count: 8 },
      { name: "Prof. Carlos Rodríguez", count: 5 }
    ],
    evaluators: [
      { name: "Prof. Juan Pérez", count: 12 },
      { name: "Prof. Laura Torres", count: 8 }
    ]
  },
  delayed: [
    { name: "Prof. Roberto Gómez", count: 3 },
    { name: "Prof. Patricia López", count: 2 }
  ],
  alerts: [
    { priority: "HIGH", message: "3 exámenes vencen en 24-48 horas" },
    { priority: "MEDIUM", message: "8 postulantes sin entrevista programada" }
  ],
  statsByGrade: [
    { grade: "Pre-Kinder", applications: 15, approved: 8, slots: 20 },
    { grade: "1° Básico", applications: 25, approved: 15, slots: 25 }
  ],
  nextWeek: [
    { event: "Reunión comité de admisión", date: "Jueves 31 Oct, 15:00 hrs" }
  ],
  reportUrl: "https://admision.mtn.cl/staff/reports/weekly"
}
```

### Message ID de prueba:
`<c0d514f4-b466-78da-4297-0503fc920112@mtn.cl>`

---

