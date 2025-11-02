# 🔴 Problema: Admin No Puede Asignar Horarios a Entrevistador

## 📋 Descripción del Problema

**Síntoma**: El ADMIN no puede asignarle horarios a un entrevistador porque le falta algún permiso.

---

## 🔍 Análisis del Código

### Endpoints Disponibles para Crear Horarios

Hay **3 endpoints** principales para crear/administrar horarios:

#### 1. `POST /api/interviewer-schedules` (Línea 103)
- **Permisos**: `requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER')`
- **Uso**: Crear un horario individual
- **Estado**: ✅ ADMIN tiene permiso
- **Body**: `{ interviewer, dayOfWeek, startTime, endTime, year, specificDate, scheduleType, notes }`

#### 2. `POST /api/interviewer-schedules/toggle` (Línea 516)
- **Permisos**: `requireRole('ADMIN', 'COORDINATOR')` ⚠️
- **Uso**: Toggle (activar/desactivar) un slot de 30 minutos específico
- **Estado**: ✅ ADMIN tiene permiso
- **Body**: `{ interviewer, specificDate, startTime, endTime, year, notes }`

#### 3. `POST /api/interviewer-schedules/toggle-bulk` (Línea 580)
- **Permisos**: `requireRole('ADMIN', 'COORDINATOR')` ⚠️
- **Uso**: Toggle múltiples slots de 30 minutos en un rango de tiempo
- **Estado**: ✅ ADMIN tiene permiso
- **Body**: `{ interviewer, specificDate, startTime, endTime, year, notes }`

---

## 🎯 Posibles Causas

### Causa 1: Frontend Usa Endpoint Incorrecto

El frontend podría estar intentando usar un endpoint que no existe o que requiere otros permisos.

**Verificar:**
- ¿Qué endpoint está llamando el frontend?
- ¿Qué error exacto está recibiendo? (403 Forbidden, 404 Not Found, 400 Bad Request)

---

### Causa 2: Validación Falla Silenciosamente

**Código actual** (líneas 135-136, 210-211):
```javascript
// Get user info
const userResult = await dbPool.query('SELECT eco_name, last_name, email, role FROM users WHERE id = $1', [interviewerId]);
const user = userResult.rows[0];  // ⚠️ Si no existe el usuario, esto es undefined
```

**Problema**: Si el `interviewerId` no existe en la base de datos o no está activo, `user` será `undefined` y causará un error cuando intenta acceder a `user.first_name`, `user.last_name`, etc.

**Solución**: Agregar validación antes de usar el usuario.

---

### Causa 3: El Usuario Entrevistador No Existe o No Tiene el Rol Correcto

El `interviewerId` enviado desde el frontend podría:
- No existir en la tabla `users`
- Tener un rol diferente a `INTERVIEWER`
- Estar inactivo (`active = false`)

**Verificar**:
```sql
SELECT id, first_name, last_name, email, role, active 
FROM users 
WHERE role = 'INTERVIEWER' AND active = true;
```

---

### Causa 4: El Endpoint `/toggle` o `/toggle-bulk` Requiere Validaciones Adicionales

Estos endpoints no validan si el usuario existe antes de crear el horario. Si el frontend está usando estos endpoints y envía un `interviewerId` inválido, podría fallar silenciosamente.

**Código actual de `/toggle`** (línea 516-575):
- No valida si el usuario existe
- No valida si el usuario tiene rol `INTERVIEWER`
- Simplemente intenta insertar en `interviewer_schedules`

---

## ✅ Soluciones Recomendadas

### Solución 1: Agregar Validación de Usuario en Todos los Endpoints

**Agregar validación en `POST /api/interviewer-schedules`** (después de línea 113):

```javascript
// Validate that interviewer exists and is active
const userCheck = await dbPool.query(
  'SELECT id, first_name, last_name, email, role, active FROM users WHERE id = $1',
  [interviewerId]
);

if (userCheck.rows.length === 0) {
  return res.status(404).json({
    success: false,
    error: 'El entrevistador no existe'
  });
}

const interviewer = userCheck.rows[0];

if (!interviewer.active) {
  return res.status(400).json({
    success: false,
    error: 'El entrevistador está inactivo'
  });
}

// Optional: Validate that user has a role that can interview
const validInterviewerRoles = ['TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER'];
if (!validInterviewerRoles.includes(interviewer.role)) {
  return res.status(400).json({
    success: false,
    error: `El usuario con rol '${interviewer.role}' no puede recibir horarios de entrevistador`
  });
}
```

**Luego usar `interviewer` en lugar de hacer otra query** (cambiar línea 135-136):
```javascript
// Ya tenemos la info del usuario, no necesitamos otra query
const user = interviewer;
```

---

### Solución 2: Agregar Validación en `/toggle` y `/toggle-bulk`

**Agregar la misma validación en `POST /api/interviewer-schedules/toggle`** (después de línea 526):

```javascript
// Validate that interviewer exists and is active
const userCheck = await dbPool.query(
  'SELECT id, first_name, last_name, email, role, active FROM users WHERE id = $1',
  [interviewerId]
);

if (userCheck.rows.length === 0) {
  return res.status(404).json({
    Frankfurt: false,
    error: 'El entrevistador no existe'
  });
}

const interviewer = userCheck.rows[0];

if (!interviewer.active) {
  return res.status(400).json({
    success: false,
    error: 'El entrevistador está inactivo'
  });
}
```

**Hacer lo mismo en `POST /api/interviewer-schedules/toggle-bulk`** (después de línea 591).

---

### Solución 3: Mejorar Manejo de Errores

**En lugar de** (línea 135-136):
```javascript
const userResult = await dbPool.query('SELECT first_name, last_name, email, role FROM users WHERE id = $1', [interviewerId]);
const user = userResult.rows[0];  // ⚠️ Puede ser undefined
```

**Usar**:
```javascript
const userResult = await dbPool.query('SELECT first_name, last_name, email, role FROM users WHERE id = $1', [interviewerId]);
if (userResult.rows.length === 0) {
  return res.status(404).json({
    success: false,
    error: 'Entrevistador no encontrado'
  });
}
const user = userResult.rows[0];
```

---

## 🔍 Verificación de Causas

### Paso 1: Verificar en Logs

**Buscar en logs del servicio `evaluation-service`**:
```bash
# Railway → evaluation-service → Logs
# Buscar errores relacionados con:
- "Error creating schedule"
- "Cannot read property 'first_name' of undefined"
- "interviewerId"
```

### Paso 2: Verificar en Base de Datos

**Ejecutar queries SQL**:
```sql
-- Ver si hay usuarios con rol INTERVIEWER
SELECT id, first_name, last_name, email, role, active 
FROM users 
WHERE role = 'INTERVIEWER';

-- Ver si hay horarios creados
SELECT COUNT(*) as total_schedules 
FROM interviewer_schedules;

-- Ver últimos horarios creados
SELECT s.*, u.first_name, u.last_name, u.role
FROM interviewer_schedules s
LEFT JOIN users u ON s.interviewer_id = u.id
ORDER BY s.created_at DESC
LIMIT 10;
```

### Paso 3: Verificar Endpoint Usado por Frontend

**En DevTools del navegador (F12) → Network tab**:
- Filtrar por "interviewer-schedules"
- Intentar crear un horario
- Ver qué endpoint se llama y qué error retorna

---

## 📝 Checklist de Diagnóstico

- [ ] Verificar qué endpoint está usando el frontend
- [ ] Verificar logs del `evaluation-service` para errores
- [ ] Verificar que existan usuarios con rol `INTERVIEWER` en la BD
- [ ] Verificar que esos usuarios estén `active = true`
- [ ] Verificar que el `interviewerId` enviado desde el frontend sea válido
- [ ] Probar directamente el endpoint con curl/Postman

---

## 🛠️ Prueba Manual con cURL

**Probar endpoint directo** (reemplazar valores):
```bash
TOKEN="token_del_admin"
INTERVIEWER_ID=123  # ID del usuario entrevistador
YEAR=2025

# Probar endpoint básico
curl -X POST https://gateway-service-production-a753.up.railway.app/api/interviewer-schedules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <token>" \
  -d '{
    "interviewer": '$INTERVIEWER_ID',
    "dayOfWeek": "MONDAY",
    "startTime": "09:00",
    "endTime": "10:00",
    "year": '$YEAR',
    "scheduleType": "RECURRING"
  }'

# Probar endpoint toggle
curl -X POST https://gateway-service-production-a753.up.railway.app/api/interviewer-schedules/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: <token>" \
  -d '{
    "interviewer": '$INTERVIEWER_ID',
    "specificDate": "2025-11-01",
    "startTime": "09:00",
    "endTime": "09:30",
    "year": '$YEAR'
  }'
```

---

## 🎯 Solución Inmediata

**El código tiene un bug**: Si el `interviewerId` no existe, la línea 136 o 211 intentará acceder a `user.first_name` cuando `user` es `undefined`, causando un error.

**Fix rápido**: Agregar validación ANTES de usar `userResult.rows[0]` en TODOS los endpoints que crean horarios.

---

## 📊 Resumen

**Problema identificado**:
1. ❌ No hay validación de que el usuario entrevistador existe antes de crear horario
2. ❌ Si el usuario no existe, el código falla silenciosamente al intentar acceder a propiedades de `undefined`
3. ❌ Los endpoints `/toggle` y `/toggle-bulk` no validan si el usuario existe

**Solución**:
- Agregar validación de existencia y estado activo del usuario en TODOS los endpoints
- Mejorar manejo de errores para retornar mensajes claros

---

**Fecha de Análisis**: 2025-10-29  
**Estado**: 🔴 Problema identificado - Requiere validaciones adicionales  
**Prioridad**: Alta - Bloquea funcionalidad crítica

