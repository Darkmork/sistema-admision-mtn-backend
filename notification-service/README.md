# Notification Service

Microservicio de notificaciones por email y SMS para el Sistema de Admisión MTN.

## Características

- ✉️ **Envío de emails** con soporte para plantillas Handlebars
- 📱 **Envío de SMS** con integración Twilio (con modo mock)
- 📊 **Historial de notificaciones** con filtros avanzados
- 🔄 **Envío masivo** de emails y SMS
- 🎨 **Plantillas HTML** personalizables
- 🛡️ **Circuit Breakers** para servicios externos (SMTP, Twilio)
- 🔐 **Autenticación JWT** con RBAC
- 📝 **Logs estructurados** con Winston
- 🐳 **Docker** listo para producción

## Requisitos

- Node.js 18+
- PostgreSQL 12+
- Cuenta SMTP (Gmail, SendGrid, etc.)
- Cuenta Twilio (opcional, tiene modo mock)

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar en desarrollo
npm run dev

# Iniciar en producción
npm start
```

## Configuración

### Variables de Entorno

```bash
# Server
NODE_ENV=development
PORT=8085

# Database (priority: DATABASE_URL > individual vars)
DATABASE_URL=postgresql://admin:admin123@localhost:5432/Admisión_MTN_DB
# OR
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123

# JWT
JWT_SECRET=your_secure_jwt_secret_here

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=jorge.gangale@mtn.cl
SMTP_PASSWORD=your_app_password
EMAIL_FROM=Admisión MTN <admision@mtn.cl>
EMAIL_MOCK_MODE=true  # true para desarrollo

# SMS (Twilio)
SMS_MOCK_MODE=true  # true para desarrollo
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+56912345678

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=8000
CIRCUIT_BREAKER_ERROR_THRESHOLD=70
CIRCUIT_BREAKER_RESET_TIMEOUT=120000
```

### Gmail App Passwords

Para usar Gmail SMTP:

1. Habilitar autenticación en dos pasos
2. Ir a https://myaccount.google.com/apppasswords
3. Generar contraseña de aplicación para "Correo"
4. Usar la contraseña generada en `SMTP_PASSWORD`

## Docker

```bash
# Construir imagen
docker build -t notification-service .

# Iniciar con docker-compose
docker-compose up -d

# Ver logs
docker-compose logs -f notification-service

# Detener
docker-compose down
```

## API Endpoints

### Notificaciones

```
GET    /api/notifications           # Listar notificaciones (filtros: recipientType, recipientId, channel, type, status)
GET    /api/notifications/:id       # Obtener notificación por ID
POST   /api/notifications/email     # Enviar email
POST   /api/notifications/sms       # Enviar SMS
POST   /api/notifications/email/bulk  # Enviar emails masivos
POST   /api/notifications/sms/bulk    # Enviar SMS masivos
DELETE /api/notifications/:id       # Eliminar notificación
```

### Health Check

```
GET /health  # Estado del servicio
```

## Ejemplos de Uso

### Enviar Email con Plantilla

```bash
curl -X POST http://localhost:8085/api/notifications/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "to": "apoderado@example.com",
    "subject": "Bienvenido al Sistema de Admisión",
    "message": "Mensaje de respaldo en texto plano",
    "templateName": "welcome",
    "templateData": {
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan.perez@example.com",
      "role": "APODERADO",
      "loginUrl": "https://admision.mtn.cl/login",
      "year": 2025
    },
    "type": "WELCOME"
  }'
```

### Enviar SMS

```bash
curl -X POST http://localhost:8085/api/notifications/sms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "to": "+56912345678",
    "message": "Su entrevista está programada para mañana a las 10:00 AM.",
    "type": "INTERVIEW_REMINDER"
  }'
```

### Enviar Emails Masivos

```bash
curl -X POST http://localhost:8085/api/notifications/email/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "recipients": [
      {
        "to": "apoderado1@example.com",
        "subject": "Actualización de Estado",
        "message": "Su postulación ha sido aprobada",
        "templateName": "application-status",
        "templateData": {
          "guardianName": "María González",
          "studentName": "Pedro González",
          "statusText": "APROBADA",
          "statusColor": "#28a745",
          "grade": "1° Básico",
          "academicYear": 2025,
          "updateDate": "2025-10-16",
          "dashboardUrl": "https://admision.mtn.cl/dashboard",
          "year": 2025
        }
      },
      {
        "to": "apoderado2@example.com",
        "subject": "Actualización de Estado",
        "message": "Su postulación está en revisión",
        "templateName": "application-status",
        "templateData": {
          "guardianName": "Carlos Ramírez",
          "studentName": "Ana Ramírez",
          "statusText": "EN REVISIÓN",
          "statusColor": "#ffc107",
          "grade": "2° Básico",
          "academicYear": 2025,
          "updateDate": "2025-10-16",
          "dashboardUrl": "https://admision.mtn.cl/dashboard",
          "year": 2025
        }
      }
    ]
  }'
```

### Listar Notificaciones con Filtros

```bash
# Todas las notificaciones
curl http://localhost:8085/api/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filtrar por canal
curl "http://localhost:8085/api/notifications?channel=EMAIL&page=0&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filtrar por estado
curl "http://localhost:8085/api/notifications?status=SENT&page=0&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filtrar por tipo
curl "http://localhost:8085/api/notifications?type=INTERVIEW_REMINDER&page=0&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Plantillas de Email

Las plantillas están en `src/templates/` usando Handlebars:

- `welcome.hbs` - Email de bienvenida
- `application-status.hbs` - Actualización de estado de postulación
- `interview-reminder.hbs` - Recordatorio de entrevista
- `document-approved.hbs` - Documento aprobado

### Crear Nueva Plantilla

```handlebars
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>
    /* Tus estilos aquí */
  </style>
</head>
<body>
  <h1>Hola {{name}}</h1>
  <p>{{message}}</p>

  {{#if conditional}}
    <p>Contenido condicional</p>
  {{/if}}

  <ul>
    {{#each items}}
      <li>{{this}}</li>
    {{/each}}
  </ul>
</body>
</html>
```

## Tipos de Notificación

- `WELCOME` - Bienvenida
- `APPLICATION_SUBMITTED` - Postulación enviada
- `APPLICATION_STATUS_CHANGED` - Cambio de estado
- `INTERVIEW_SCHEDULED` - Entrevista agendada
- `INTERVIEW_REMINDER` - Recordatorio de entrevista
- `DOCUMENT_APPROVED` - Documento aprobado
- `DOCUMENT_REJECTED` - Documento rechazado
- `GENERAL` - Notificación general

## Canales de Notificación

- `EMAIL` - Correo electrónico
- `SMS` - Mensaje de texto
- `PUSH` - Notificación push (futuro)
- `IN_APP` - Notificación en la app (futuro)

## Estados de Notificación

- `PENDING` - Pendiente de envío
- `SENT` - Enviada exitosamente
- `FAILED` - Falló el envío
- `DELIVERED` - Entregada (futuro con webhooks)
- `READ` - Leída (futuro)

## Circuit Breakers

El servicio implementa circuit breakers para servicios externos:

- **External Services Breaker** (Email/SMS):
  - Timeout: 8s
  - Error Threshold: 70%
  - Reset Timeout: 120s

Si SMTP o Twilio fallan repetidamente, el circuit breaker se abre automáticamente para evitar sobrecarga.

## Logs

Los logs se guardan en:

- `logs/notification-service.log` - Todos los logs
- `logs/notification-service-error.log` - Solo errores

Formato JSON estructurado con Winston.

## Testing

```bash
# Unit tests
npm test

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Base de Datos

El servicio usa la tabla `notifications`:

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  recipient_type VARCHAR(50),
  recipient_id INTEGER,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  channel VARCHAR(20) NOT NULL,
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  template_name VARCHAR(100),
  template_data JSONB,
  status VARCHAR(20) DEFAULT 'PENDING',
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_type ON notifications(type);
```

## Seguridad

- ✅ Autenticación JWT requerida
- ✅ RBAC (ADMIN, COORDINATOR tienen acceso)
- ✅ Validación de datos de entrada
- ✅ Rate limiting (recomendado en NGINX)
- ✅ CORS configurado
- ✅ Usuario no-root en Docker

## Performance

- **Connection Pooling**: 20 conexiones máximo
- **Circuit Breakers**: Protección contra servicios lentos
- **Bulk Operations**: Envío masivo optimizado
- **Template Caching**: Plantillas compiladas en memoria

## Troubleshooting

### Error: "Failed to send email"

- Verificar credenciales SMTP en `.env`
- Verificar que `EMAIL_MOCK_MODE=false` en producción
- Revisar logs en `logs/notification-service-error.log`

### Error: "Circuit breaker opened"

- El servicio externo (SMTP/Twilio) está fallando
- Esperar 2 minutos para que el circuit breaker intente reconectar
- Verificar conectividad con el proveedor

### Emails no llegan

- Verificar carpeta de spam
- Verificar que `EMAIL_FROM` sea válido
- Revisar logs para errores de SMTP

## Contribuir

1. Fork el proyecto
2. Crear branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## Licencia

Propietario: Colegio Monte Tabor y Nazaret

## Contacto

Equipo de Desarrollo MTN - admision@mtn.cl
