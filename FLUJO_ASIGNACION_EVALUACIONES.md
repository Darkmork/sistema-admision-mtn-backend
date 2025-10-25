# 📋 Flujo Completo: Asignación de Evaluaciones con Notificación por Email

## 🎯 Resumen

Cuando un administrador asigna una evaluación a un profesor/evaluador, el sistema automáticamente:
1. Crea o actualiza la evaluación en la base de datos
2. Envía un email profesional al evaluador con todos los detalles
3. El evaluador recibe la notificación inmediatamente

---

## 🔄 Flujo Completo

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND - Admin Dashboard                                        │
│    Usuario abre modal de asignación de evaluadores                   │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND - EvaluationManagement.tsx                               │
│    - Carga evaluaciones existentes (previene duplicados)            │
│    - Usuario selecciona evaluador para cada tipo de evaluación      │
│    - Valida que no existan evaluaciones duplicadas                  │
│    - Envía POST /api/evaluations con datos de la evaluación         │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. GATEWAY SERVICE                                                    │
│    Ruta: POST /api/evaluations → evaluation-service                 │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4. EVALUATION SERVICE - EvaluationService.createEvaluation()        │
│    - Valida duplicados (application_id + evaluation_type)           │
│    - Si ya existe: retorna 409 Conflict                             │
│    - Si no existe: crea evaluación con status PENDING               │
│    - Retorna evaluación creada con ID                               │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND - evaluationService.assignSpecificEvaluation()          │
│    - Recibe evaluación creada (con ID)                              │
│    - Llama POST /api/evaluations/:id/assign con evaluatorId         │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 6. EVALUATION SERVICE - POST /api/evaluations/:id/assign            │
│    - Actualiza evaluation con evaluator_id y evaluation_date        │
│    - Cambia status a PENDING                                         │
│    - Hace JOIN para obtener:                                         │
│      * evaluator email, nombre                                       │
│      * student nombre completo                                       │
│      * evaluation_type, application_id                               │
│    - Llama a notification-service (NON-BLOCKING)                    │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 7. NOTIFICATION SERVICE - POST /api/institutional-emails/           │
│    evaluation-assignment/:evaluationId                               │
│    - Valida campos requeridos                                        │
│    - Mapea evaluation_type a etiqueta en español                    │
│    - Genera email HTML profesional con:                             │
│      * Header con gradiente verde MTN                                │
│      * Saludo personalizado al evaluador                            │
│      * Tabla con detalles (estudiante, tipo, IDs)                   │
│      * Próximos pasos en lista                                       │
│      * Información importante                                        │
│      * Footer con contacto                                           │
│    - Envía email via SendGrid/SMTP                                   │
│    - Retorna success (incluso si email falla)                       │
└─────────────────────────┬────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 8. EMAIL ENVIADO AL EVALUADOR                                        │
│    Subject: 📋 Nueva Evaluación Asignada - [Tipo de Evaluación]    │
│    To: evaluator@email.com                                           │
│    Content: HTML profesional con todos los detalles                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Archivos Modificados

### Backend

#### 1. `/evaluation-service/src/routes/evaluationRoutes.js` (líneas 362-455)

**Cambios**:
- Agregado código después de asignar evaluación para obtener detalles
- JOIN para obtener evaluator email, nombre y student información
- Llamada asíncrona (non-blocking) a notification-service
- Manejo de errores graceful (assignment succeeds even if email fails)

**SQL Query**:
```sql
SELECT
  e.id,
  e.application_id,
  e.evaluation_type,
  u.email as evaluator_email,
  u.first_name as evaluator_first_name,
  u.last_name as evaluator_last_name,
  s.first_name as student_first_name,
  s.paternal_last_name as student_paternal_last_name,
  s.maternal_last_name as student_maternal_last_name
FROM evaluations e
LEFT JOIN users u ON e.evaluator_id = u.id
LEFT JOIN applications a ON e.application_id = a.id
LEFT JOIN students s ON a.student_id = s.id
WHERE e.id = $1
```

**HTTP Call**:
```javascript
axios.post(`${notificationUrl}/api/institutional-emails/evaluation-assignment/${id}`, {
  evaluatorEmail,
  evaluatorName,
  studentName,
  evaluationType: details.evaluation_type,
  applicationId: details.application_id
});
```

#### 2. `/notification-service/src/routes/institutionalEmailRoutes.js` (líneas 823-1000)

**Nuevo Endpoint**:
- `POST /api/institutional-emails/evaluation-assignment/:evaluationId`
- Público (llamado por evaluation-service)
- Valida campos requeridos
- Genera HTML profesional
- Envía email via emailService

**Request Body**:
```json
{
  "evaluatorEmail": "teacher@mail.up.cl",
  "evaluatorName": "Juan Pérez",
  "studentName": "María González López",
  "evaluationType": "MATHEMATICS_EXAM",
  "applicationId": 2
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "message": "Evaluation assignment email sent successfully",
    "evaluationId": 123,
    "emailSent": true,
    "recipient": "teacher@mail.up.cl",
    "messageId": "abc123"
  }
}
```

### Frontend

#### 3. `/components/admin/EvaluationManagement.tsx` (líneas 467-593)

**Mejoras**:
- Mejor logging para debug
- Muestra advertencia si falla carga de evaluaciones existentes
- Manejo específico de error 409 (duplicado)
- Recarga automática de evaluaciones al detectar conflicto
- Logs detallados de validación de assignments

#### 4. `/pages/AdminDashboard.tsx` (líneas 329-381)

**Mejoras**:
- Usa `Promise.allSettled` en lugar de `Promise.all`
- Maneja errores individuales de cada evaluación
- Detecta y cuenta errores 409 (duplicados)
- Permite éxito parcial (algunas asignaciones exitosas, otras ya existían)
- Mejor logging de proceso de asignación

---

## 📧 Template del Email

### Subject
```
📋 Nueva Evaluación Asignada - Examen de Matemáticas
```

### Contenido (HTML)

**Header**:
- Gradiente verde (#2d6a4f → #40916c)
- Título: "📋 Nueva Evaluación Asignada"
- Subtítulo: "Colegio Monte Tabor y Nazaret"

**Cuerpo**:
1. **Saludo**: "Estimado/a [Nombre Evaluador]"
2. **Mensaje**: Notificación de asignación
3. **Detalles de Evaluación** (tabla):
   - 👨‍🎓 Estudiante: [Nombre completo]
   - 📋 Tipo de Evaluación: [Etiqueta en español]
   - 🔢 ID de Evaluación: #[ID]
   - 📄 ID de Postulación: #[ID]
4. **Próximos Pasos** (lista):
   - Acceder al sistema
   - Revisar información del estudiante
   - Coordinar fecha/hora
   - Completar evaluación
5. **Información Importante**:
   - Recordatorio de completar a tiempo
   - Contacto con equipo de admisiones
6. **Footer**:
   - Firma: "Equipo de Admisiones"
   - Disclaimer: correo automático
   - Contacto: admisiones@mtn.cl

---

## 🔧 Configuración Requerida

### Railway Environment Variables

#### evaluation-service
```bash
# PRODUCCIÓN (Railway)
NOTIFICATION_SERVICE_URL=https://notification-service-production-3411.up.railway.app

# DESARROLLO LOCAL
NOTIFICATION_SERVICE_URL=http://localhost:8085
```

**IMPORTANTE**:
- En Railway, usar la URL pública del notification-service (no Private Networking)
- Railway Private Networking (`http://notification-service:8080`) presentó problemas de conectividad
- La URL pública funciona correctamente y los emails se entregan sin problemas

---

## 🧪 Cómo Probar

### Opción 1: Script Automatizado

```bash
# Ejecutar script de prueba
cd /Users/jorgegangale/Desktop/MIcroservicios
./test-evaluation-assignment-email.sh
```

El script:
1. ✅ Login como admin
2. ✅ Obtiene CSRF token
3. ✅ Verifica evaluaciones existentes
4. ✅ Crea evaluación (o usa existente)
5. ✅ Asigna evaluación a evaluador
6. ✅ Verifica que email fue enviado

### Opción 2: Desde el Dashboard (UI)

1. **Login** como admin en https://admision-mtn-front.vercel.app
2. **Ir a** "Gestión de Postulantes"
3. **Seleccionar** una postulación
4. **Click en** "Información Detallada"
5. **Click en** "Asignar Evaluadores"
6. **Seleccionar** evaluador del dropdown
7. **Click en** "Asignar"
8. **Verificar**:
   - Modal muestra "✅ Se asignaron X evaluador(es) correctamente"
   - Consola del navegador muestra logs de asignación
   - Email llega al evaluador

### Opción 3: CURL Manual

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://gateway-service-production-a753.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jorge.gangale@mail.up.cl","password":"admin123"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 2. Get CSRF Token
CSRF_TOKEN=$(curl -s https://gateway-service-production-a753.up.railway.app/api/auth/csrf-token \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

# 3. Create Evaluation
EVAL_RESPONSE=$(curl -s -X POST https://gateway-service-production-a753.up.railway.app/api/evaluations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "applicationId": 2,
    "evaluatorId": 124,
    "evaluationType": "MATHEMATICS_EXAM",
    "score": 0,
    "maxScore": 100,
    "status": "PENDING"
  }')

# Extract evaluation ID
EVAL_ID=$(echo $EVAL_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

# 4. Assign Evaluation (THIS SENDS EMAIL)
curl -X POST "https://gateway-service-production-a753.up.railway.app/api/evaluations/$EVAL_ID/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "{
    \"evaluatorId\": 124,
    \"evaluationDate\": \"$(date +%Y-%m-%d)\"
  }"
```

---

## 📊 Verificar Logs

### Railway Logs (Notification Service)

```bash
# Ver logs de notification-service
railway logs --service notification-service

# Filtrar solo emails de asignación
railway logs --service notification-service | grep "evaluation-assignment"

# Ver éxitos
railway logs --service notification-service | grep "✅ Evaluation assignment email sent"

# Ver fallos
railway logs --service notification-service | grep "❌ Error sending evaluation assignment email"
```

### Railway Logs (Evaluation Service)

```bash
# Ver logs de evaluation-service
railway logs --service evaluation-service

# Filtrar solo asignaciones
railway logs --service evaluation-service | grep "Email notification sent"
```

### SendGrid Dashboard

1. Ir a https://app.sendgrid.com
2. Activity Feed → Ver emails enviados
3. Buscar subject: "Nueva Evaluación Asignada"
4. Ver status: Delivered/Opened/Bounced

---

## 🔍 Troubleshooting

### ❌ Email no se envía

**Causa posible**: `NOTIFICATION_SERVICE_URL` no configurada en evaluation-service

**Solución**:
1. Ir a Railway dashboard
2. Seleccionar evaluation-service
3. Variables → Agregar:
   ```
   NOTIFICATION_SERVICE_URL=http://notification-service:8080
   ```
4. Redeploy evaluation-service

### ❌ Error 409 al asignar evaluación

**Causa**: Evaluación ya existe para ese tipo y postulación

**Solución**: El sistema ahora maneja esto automáticamente:
- Frontend filtra evaluaciones ya asignadas
- Al detectar 409, recarga evaluaciones y actualiza UI
- Permite asignaciones parciales (algunas exitosas, otras ya existían)

### ❌ Email llega a spam

**Causa**: Configuración de SendGrid

**Solución**:
1. Verificar dominio en SendGrid
2. Configurar SPF y DKIM records
3. Usar email de remitente verificado

### ⚠️ Assignment exitoso pero email falla

**Comportamiento**: CORRECTO - La asignación NO debe fallar si el email falla

**Logs a verificar**:
```
✅ Evaluación asignada exitosamente
⚠️ Failed to send email notification for evaluation X: [error]
```

---

## 🎯 Tipos de Evaluación Soportados

| Código Backend | Etiqueta en Email |
|----------------|-------------------|
| MATHEMATICS_EXAM | Examen de Matemáticas |
| LANGUAGE_EXAM | Examen de Lenguaje |
| PSYCHOSOCIAL_INTERVIEW | Entrevista Psicosocial |
| FAMILY_INTERVIEW | Entrevista Familiar |
| DIRECTOR_INTERVIEW | Entrevista con Director |
| ACADEMIC_PERFORMANCE | Evaluación de Rendimiento Académico |
| BEHAVIORAL_ASSESSMENT | Evaluación Conductual |

---

## ✅ Checklist de Verificación

Después de desplegar, verificar:

- [ ] Railway: evaluation-service tiene `NOTIFICATION_SERVICE_URL` configurada
- [ ] Railway: notification-service está running
- [ ] Railway: SendGrid API key configurada en notification-service
- [ ] Dashboard: Modal de asignación carga correctamente
- [ ] Dashboard: Evaluaciones existentes se cargan sin errores
- [ ] Dashboard: Al asignar, muestra mensaje de éxito
- [ ] Logs: evaluation-service muestra "Email notification sent"
- [ ] Logs: notification-service muestra "Evaluation assignment email sent"
- [ ] Email: Evaluador recibe email en su inbox
- [ ] Email: HTML se ve correctamente en Gmail/Outlook
- [ ] Frontend: Manejo de error 409 funciona correctamente
- [ ] Frontend: Recarga de evaluaciones después de asignación

---

## 📝 Notas Importantes

1. **Non-Blocking Email**: La asignación de evaluación NO falla si el email falla de enviarse. Esto es intencional para evitar bloquear el proceso crítico.

2. **Prevención de Duplicados**: El sistema tiene 3 capas de prevención:
   - Backend: Validación en `createEvaluation()` (409 si existe)
   - Frontend: Filtro en `handleSubmit()` antes de enviar
   - Frontend UI: Dropdowns deshabilitados para evaluaciones ya asignadas

3. **Promise.allSettled**: Permite asignaciones parciales. Si intentas asignar 3 evaluaciones y 1 ya existe, las otras 2 se crean exitosamente.

4. **Private Networking**: evaluation-service llama a notification-service usando Railway Private Networking (http://notification-service:8080), no URL pública.

5. **HTML Email**: El email usa inline CSS para compatibilidad con todos los clientes de email (Gmail, Outlook, Apple Mail, etc).

---

**Fin del documento**
