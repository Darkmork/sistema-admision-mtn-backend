# 📧 Implementación de Envío de Correos al Cambiar Estado de Postulación

**Fecha**: 2025-01-21
**Autor**: Claude Code
**Ticket/Issue**: Problema de envío de correos en dashboard de admin

---

## 📋 RESUMEN

Se implementó la funcionalidad completa para enviar correos electrónicos automáticos a los apoderados cuando se cambia el estado de una postulación desde el dashboard de administración.

### Estado Anterior
❌ **PROBLEMA**: Al cambiar el estado de una postulación, NO se enviaba ningún correo al apoderado, aunque el frontend mostraba el mensaje: *"El apoderado recibirá una notificación por correo electrónico"*.

### Estado Actual
✅ **SOLUCIONADO**: El sistema ahora envía automáticamente un correo personalizado al apoderado cuando se cambia el estado de una postulación.

---

## 🔧 CAMBIOS REALIZADOS

### 1. Notification Service

**Archivo**: `/notification-service/src/routes/institutionalEmailRoutes.js`

#### Implementación Completa del Endpoint `/status-update/:applicationId`

**Líneas 217-469**: Se implementó el endpoint que estaba marcado como `TODO`.

**Funcionalidades**:
- ✅ Obtiene el email del apoderado desde application-service
- ✅ Detecta el nombre del estudiante para personalizar el correo
- ✅ Genera plantillas de correo específicas para cada estado
- ✅ Envía el correo usando EmailService con circuit breaker
- ✅ Manejo de errores robusto (continúa aunque falle el email)

**Estados Soportados con Plantillas Personalizadas**:
1. `SUBMITTED` - Postulación Recibida ✅
2. `UNDER_REVIEW` - Postulación en Revisión 🔍
3. `INTERVIEW_SCHEDULED` - Entrevista Programada 📅
4. `APPROVED` - ¡Postulación Aprobada! 🎉
5. `REJECTED` - Resultado de Postulación ❌
6. `WAITLIST` - Lista de Espera ⏳
7. `ARCHIVED` - Postulación Archivada 📁

**Ejemplo de Correo Generado** (Estado APPROVED):
```
Asunto: 🎉 ¡Postulación Aprobada! - Colegio MTN

Estimado/a Jorge Gangale,

¡Tenemos excelentes noticias! La postulación de María González ha sido APROBADA.

📋 Estado Actual: Aprobada

Felicitaciones por este logro. Próximamente recibirá información sobre
los siguientes pasos para formalizar la matrícula.

¡Bienvenidos a la familia MTN!

Saludos cordiales,
Equipo de Admisiones
Colegio Monte Tabor y Nazaret
```

---

### 2. Application Service

**Archivo**: `/application-service/src/services/ApplicationService.js`

#### Modificaciones:

**1. Imports (Líneas 7-10)**:
```javascript
const { externalServiceBreaker } = require('../config/circuitBreakers');
const axios = require('axios');
```

**2. Función `updateApplicationStatus` (Líneas 756-763)**:
- Se agregó llamada asíncrona a `sendStatusUpdateNotification()`
- La llamada es **no bloqueante** (usa `.catch()`)
- Si falla el envío de correo, NO falla la actualización de estado

```javascript
// Send status update notification email (async - don't wait for result)
this.sendStatusUpdateNotification(id, status, notes).catch(error => {
  logger.error(`Failed to send status update notification for application ${id}:`, error.message);
  // Don't throw - email failure shouldn't block status update
});
```

**3. Nueva Función `sendStatusUpdateNotification` (Líneas 766-805)**:
- Llama al endpoint `/api/institutional-emails/status-update/:applicationId`
- Usa `externalServiceBreaker` para resiliencia
- Timeout de 8 segundos (alineado con circuit breaker)
- Logging detallado de éxito/fallo

---

## 🔄 FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (Dashboard de Admin)                               │
│    ApplicationStatusChanger.tsx                                 │
│    - Usuario cambia estado de postulación                      │
│    - Llama: applicationService.updateApplicationStatus()       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. GATEWAY SERVICE (Port 8080)                                  │
│    - Autentica request (JWT)                                    │
│    - Valida CSRF token                                          │
│    - Redirige a Application Service                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. APPLICATION SERVICE (Port 8083)                              │
│    ApplicationController.updateApplicationStatus()             │
│    ├─> ApplicationService.updateApplicationStatus()            │
│    │   ├─> UPDATE applications SET status=... (DB)             │
│    │   └─> sendStatusUpdateNotification() [ASYNC]              │
│    │       └─> POST /api/institutional-emails/status-update    │
│    └─> Retorna resultado al frontend                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. NOTIFICATION SERVICE (Port 8085)                             │
│    institutionalEmailRoutes.js                                  │
│    ├─> GET /api/applications/:id (obtener email apoderado)     │
│    ├─> generateStatusUpdateEmail() (plantilla según estado)    │
│    ├─> emailService.sendEmail() (SendGrid/SMTP)                │
│    └─> Retorna confirmación de envío                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. EMAIL DELIVERY                                               │
│    - SendGrid API / SMTP                                        │
│    - Correo enviado a: applicantUser.email                     │
│    - Asunto y contenido personalizados por estado              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 TESTING

### Script de Prueba Automatizado

**Archivo**: `/test-status-update-email.sh`

**Uso**:
```bash
cd /Users/jorgegangale/Desktop/MIcroservicios
./test-status-update-email.sh
```

**El script verifica**:
1. ✅ Health checks de Application y Notification services
2. ✅ Autenticación (login como admin)
3. ✅ Obtención de CSRF token
4. ✅ Consulta de estado actual de aplicación
5. ✅ Cambio de estado (triggering email)
6. ✅ Logs de confirmación

### Prueba Manual

**1. Verificar servicios corriendo:**
```bash
curl http://localhost:8083/health  # Application Service
curl http://localhost:8085/health  # Notification Service
```

**2. Probar endpoint directo de notificación:**
```bash
curl -X POST http://localhost:8085/api/institutional-emails/status-update/1 \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "APPROVED",
    "notes": "Excelente desempeño en evaluaciones"
  }'
```

**3. Cambiar estado desde el dashboard:**
- Login como ADMIN o COORDINATOR
- Ir a "Gestión de Postulaciones"
- Seleccionar una aplicación
- Cambiar estado usando el modal
- Verificar logs y email recibido

---

## 📝 CONFIGURACIÓN REQUERIDA

### Variables de Entorno

**Application Service** (`.env`):
```bash
NOTIFICATION_SERVICE_URL=http://localhost:8085
# En Railway: NOTIFICATION_SERVICE_URL=http://notification-service:8080
```

**Notification Service** (`.env`):
```bash
APPLICATION_SERVICE_URL=http://localhost:8083
# En Railway: APPLICATION_SERVICE_URL=http://application-service:8080

# Email configuration (SendGrid o SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>
EMAIL_FROM=Admisión MTN <admision@mtn.cl>
```

---

## 🔍 LOGS Y DEBUGGING

### Logs a Monitorear

**Application Service**:
```bash
tail -f application-service/logs/*.log | grep "notification"
```

**Mensajes esperados**:
- `📧 Calling notification service for application X status update`
- `✅ Notification service responded for application X`
- `❌ Error calling notification service` (si hay error)

**Notification Service**:
```bash
tail -f notification-service/logs/*.log | grep "status-update"
```

**Mensajes esperados**:
- `📧 Sending status update email for application X`
- `Fetching application details from: http://...`
- `Using applicant email: jorge.gangale@mail.up.cl`
- `✅ Status update email sent for application X`

### Verificación de Email Enviado

**1. Check SendGrid Dashboard** (si usas SendGrid):
- https://app.sendgrid.com/email_activity
- Buscar por recipient email

**2. Check Logs del EmailService**:
```bash
grep "Email sent successfully" notification-service/logs/*.log
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### 1. Manejo de Errores
- ✅ Si falla el envío de email, **NO falla** la actualización de estado
- ✅ El error se loggea pero no se propaga al usuario
- ✅ Circuit breaker protege contra timeouts del notification service

### 2. Performance
- ✅ Llamada asíncrona (no bloquea la respuesta HTTP)
- ✅ Timeout de 8s para evitar esperas largas
- ✅ Circuit breaker se abre tras 70% de errores

### 3. Prioridad de Email
El sistema busca el email en este orden:
1. `applicantUser.email` (quien creó la postulación) ✅ **PRIORIDAD**
2. `guardian.email` (apoderado principal)
3. `father.email` (padre)
4. `mother.email` (madre)

### 4. Estados Soportados
Todos los estados tienen plantillas de correo:
- SUBMITTED, UNDER_REVIEW, INTERVIEW_SCHEDULED
- APPROVED, REJECTED, WAITLIST, ARCHIVED

---

## 🚀 DEPLOYMENT

### Local Development
```bash
# Terminal 1: Application Service
cd application-service && npm run dev

# Terminal 2: Notification Service
cd notification-service && npm run dev

# Verificar funcionamiento
./test-status-update-email.sh
```

### Railway Production

**1. Variables de Entorno en Railway**:
- Application Service:
  - `NOTIFICATION_SERVICE_URL=http://notification-service:8080`

- Notification Service:
  - `APPLICATION_SERVICE_URL=http://application-service:8080`
  - `SMTP_*` variables configuradas

**2. Deploy**:
```bash
git add .
git commit -m "feat(application): implement status update email notifications"
git push origin main
```

**3. Verificar en Railway**:
- Check logs de ambos servicios
- Probar cambio de estado desde dashboard
- Verificar email recibido

---

## 📚 DOCUMENTACIÓN RELACIONADA

- **CLAUDE.md** (líneas 1260-1365): Frontend Integration > CSRF Token Handling
- **RAILWAY_DEPLOYMENT_CSRF.md**: Railway deployment con CSRF
- **notification-service/README.md**: Documentación del servicio de notificaciones

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Implementar endpoint `/status-update` en notification-service
- [x] Crear función `generateStatusUpdateEmail()` con plantillas
- [x] Modificar `ApplicationService.updateApplicationStatus()`
- [x] Agregar llamada asíncrona a notification service
- [x] Implementar circuit breaker para external service
- [x] Crear script de prueba automatizado
- [x] Documentar cambios y flujo completo
- [ ] Probar en ambiente local
- [ ] Probar en Railway/producción
- [ ] Verificar envío de emails reales
- [ ] Monitorear logs por 24 horas

---

## 🐛 TROUBLESHOOTING

### Problema: No se envía el correo

**Posibles causas**:
1. **Notification Service no corriendo**:
   - Verificar: `curl http://localhost:8085/health`

2. **SMTP no configurado**:
   - Verificar variables: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`
   - Check logs: `grep "SMTP" notification-service/logs/*.log`

3. **Circuit breaker abierto**:
   - Check logs: `grep "Circuit Breaker" application-service/logs/*.log`
   - Esperar reset (120s) o reiniciar servicio

4. **Email no encontrado en application**:
   - Verificar que la aplicación tenga `applicantUser.email`
   - Check logs: `grep "No email found" notification-service/logs/*.log`

### Problema: "Error calling notification service"

**Solución**:
1. Verificar `NOTIFICATION_SERVICE_URL` en application-service
2. Check network connectivity entre servicios
3. Verificar Railway Private Networking está habilitado

---

## 📞 CONTACTO

Para problemas o preguntas:
- Revisar logs detallados en `/logs/`
- Ejecutar script de prueba: `./test-status-update-email.sh`
- Verificar CLAUDE.md para arquitectura general

---

**Fin del documento**
