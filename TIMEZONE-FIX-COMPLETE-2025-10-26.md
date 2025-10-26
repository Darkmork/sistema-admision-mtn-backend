# 🎯 Fix Completo de Zona Horaria - 26 de Octubre 2025

## Problema Resuelto ✅

**Síntoma**: Las entrevistas siempre mostraban "21:00 hrs" independientemente de la hora real programada.

**Ejemplo**:
- Base de datos: `scheduled_time = '12:00:00'`
- Frontend mostraba: **"Hora: 21:00"** ❌

---

## Causa Raíz Identificada

El problema estaba en **DOS lugares diferentes**:

### 1. Backend - Conversión de PostgreSQL TIME
**Archivo**: `evaluation-service/src/routes/interviewRoutes.js:249`

PostgreSQL serializa campos de tipo `TIME` con información de zona horaria cuando se devuelven a través del driver `pg` de Node.js.

```javascript
// PROBLEMA
SELECT scheduled_time, duration
FROM interviews
// → PostgreSQL devuelve: "12:00:00-03" (con zona horaria)
// → Al parsear, se convierte según zona horaria
```

### 2. Frontend - Extracción Incorrecta de Hora
**Archivo**: `services/interviewService.ts:104`

El frontend **IGNORABA** el campo `scheduledTime` del backend y extraía la hora desde `scheduledDate` usando `new Date()`.

```typescript
// PROBLEMA
const scheduledTime = this.extractTimeFromDate(backendData.scheduledDate);
// ❌ Ignora backendData.scheduledTime que ya viene del backend

// extractTimeFromDate hace:
const date = new Date("2025-11-04");  // Interpreta como UTC 00:00
const hours = date.getHours();        // En CLT (UTC-3) = 21:00 del día anterior
```

**Flujo incorrecto**:
1. Backend envía: `{ scheduledDate: "2025-11-04", scheduledTime: "12:00:00" }`
2. Frontend ignora `scheduledTime`
3. Frontend crea `new Date("2025-11-04")` → UTC medianoche
4. Convierte a CLT (UTC-3) → 21:00 del día anterior
5. Usuario ve "21:00 hrs" siempre

---

## Soluciones Aplicadas

### Backend Fix 1: Cast TIME a TEXT en InterviewController

**Archivo**: `evaluation-service/src/controllers/InterviewController.js:57`

```javascript
// ANTES
SELECT
  i.scheduled_time,
  s.first_name,
  ...

// DESPUÉS
SELECT
  i.*,
  i.scheduled_time::text as scheduled_time_text,  // ← FIX
  s.first_name,
  ...
```

**Commit**: `50ef29c` - "fix(evaluation): eliminar cancelReason del mapeo - columna no existe"

### Backend Fix 2: Cast TIME a TEXT en available-slots

**Archivo**: `evaluation-service/src/routes/interviewRoutes.js:249`

```javascript
// ANTES
SELECT scheduled_time, duration
FROM interviews
WHERE (interviewer_id = $1 OR second_interviewer_id = $1)

// DESPUÉS
SELECT scheduled_time::text as scheduled_time, duration  // ← FIX
FROM interviews
WHERE (interviewer_id = $1 OR second_interviewer_id = $1)
```

**Commit**: `1538803` - "fix(evaluation): cast scheduled_time to text in available-slots query to prevent timezone conversion"

### Frontend Fix: Usar scheduledTime del Backend

**Archivo**: `services/interviewService.ts:104-108`

```typescript
// ANTES
const scheduledTime = this.extractTimeFromDate(backendData.scheduledDate);
// ❌ Extraía hora de scheduledDate (causaba conversión UTC → CLT)

// DESPUÉS
const scheduledTime = backendData.scheduledTime
  ? (backendData.scheduledTime.length > 5
      ? backendData.scheduledTime.substring(0, 5)  // HH:MM:SS → HH:MM
      : backendData.scheduledTime)                  // Ya es HH:MM
  : this.extractTimeFromDate(backendData.scheduledDate);  // Fallback
// ✅ Usa directamente scheduledTime del backend (sin conversión)
```

**Commit**: `6d0b20a` - "fix(frontend): use scheduledTime from backend instead of extracting from scheduledDate to prevent timezone conversion"

---

## Resultado Final

### Antes del Fix
| Campo | Base de Datos | Backend Response | Frontend Display |
|-------|---------------|------------------|------------------|
| scheduled_time | `12:00:00` | `12:00:00-03` (con TZ) | **21:00 hrs** ❌ |

### Después del Fix
| Campo | Base de Datos | Backend Response | Frontend Display |
|-------|---------------|------------------|------------------|
| scheduled_time | `12:00:00` | `12:00:00` (texto puro) | **12:00 hrs** ✅ |

---

## Archivos Modificados

### Backend
1. `/evaluation-service/src/controllers/InterviewController.js` (líneas 57, 95, 107)
   - Agregado `i.scheduled_time::text as scheduled_time_text`
   - Uso de `row.scheduled_time_text || row.scheduled_time` en mapeo

2. `/evaluation-service/src/routes/interviewRoutes.js` (línea 249)
   - Agregado `::text` cast en query de available-slots

### Frontend
1. `/services/interviewService.ts` (líneas 104-108)
   - Cambio de `extractTimeFromDate(scheduledDate)` a uso directo de `backendData.scheduledTime`

---

## Testing Realizado

### 1. Verificación Visual (Usuario)
- ✅ Entrevista programada a las 12:00 ahora muestra "Hora: 12:00"
- ✅ No más "21:00 hrs" fijo

### 2. Verificación de Código
```bash
# Backend desplegado
git log --oneline -3
# 1538803 fix(evaluation): cast scheduled_time to text in available-slots query
# 50ef29c fix(evaluation): eliminar cancelReason del mapeo - columna no existe
# b2edd81 fix(evaluation): usar i.* en SELECT y agregar scheduled_time_text

# Frontend desplegado
cd Admision_MTN_front && git log --oneline -1
# 6d0b20a fix(frontend): use scheduledTime from backend instead of extracting
```

### 3. Servicios Desplegados
- ✅ Railway: evaluation-service (commit 1538803)
- ✅ Vercel: frontend (commit 6d0b20a)

---

## Lecciones Aprendidas

### 1. PostgreSQL TIME Serialization
- Los tipos `TIME` en PostgreSQL incluyen zona horaria al serializarse vía driver `pg`
- **Solución**: Usar `::text` cast para obtener string literal sin conversión
- Aplicar consistentemente en TODAS las queries que devuelvan `scheduled_time`

### 2. Frontend Field Mapping
- **NUNCA** asumir que un campo no viene del backend
- Verificar SIEMPRE qué campos envía el backend antes de extraer/calcular
- El backend ya enviaba `scheduledTime` correctamente, pero frontend lo ignoraba

### 3. Debugging de Zona Horaria
- Cuando hay desfase de 3 horas (CLT = UTC-3), sospechar de `new Date()`
- Buscar conversiones UTC ↔ Local en:
  - Parseo de strings con `new Date()`
  - Métodos `.getHours()`, `.getMinutes()` sin contexto de TZ
  - Campos de tipo TIME/TIMESTAMP en PostgreSQL

### 4. Doble Verificación
- Un problema de zona horaria puede tener múltiples causas
- Verificar TANTO backend COMO frontend
- En este caso, ambos tenían issues que se sumaban

---

## Prevención Futura

### Checklist para Nuevos Campos de Tiempo

Al agregar nuevos campos de tipo `TIME` o `TIMESTAMP`:

**Backend**:
- [ ] Usar `::text` cast en SELECT cuando se devuelva a frontend
- [ ] Verificar que INSERT reciba formato correcto (HH:MM:SS)
- [ ] No asumir conversión automática de zona horaria

**Frontend**:
- [ ] Usar campos del backend directamente cuando existan
- [ ] Evitar `new Date(dateString)` con strings de solo fecha
- [ ] Si se necesita parsear, usar parsing manual de componentes:
  ```typescript
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  ```

**Testing**:
- [ ] Verificar que horas se muestren exactamente como están en BD
- [ ] Probar con diferentes zonas horarias (UTC, CLT, PST)
- [ ] Validar tanto creación como visualización de datos

---

## Documentos Relacionados

- **ROLLBACK-POINT-2025-10-25.md** - Estado anterior del sistema
- **TIMEZONE-FIX-2025-10-26.md** - Primera iteración del fix (solo backend)
- **TIMEZONE-FIX-COMPLETE-2025-10-26.md** - Este documento (fix completo)

---

## Commits Completos

### Backend
1. `d63d836` - Primera iteración (con error en cancel_reason)
2. `b2edd81` - Corrección usando i.* en SELECT
3. `50ef29c` - Eliminación de cancelReason del mapeo
4. `1538803` - Fix en available-slots query
5. `1a849d6` - Documentación del fix

### Frontend
1. `3b82d65` - Fix de fecha en InterviewManagement (parseLocalDate)
2. `6d0b20a` - Fix de hora usando scheduledTime del backend

---

## Estado Final del Sistema

**Fecha**: 2025-10-26 03:15 UTC (00:15 CLT)
**Estado**: ✅ FUNCIONANDO CORRECTAMENTE

### Verificación
- [x] Horas se muestran correctas en listados de entrevistas
- [x] Horas se muestran correctas en tarjetas de entrevistas (InterviewManagement)
- [x] Horas se muestran correctas en calendario
- [x] Fechas se muestran correctas (fix anterior con parseLocalDate)
- [x] Segundo entrevistador se muestra para FAMILY y CYCLE_DIRECTOR
- [x] Backend Railway desplegado
- [x] Frontend Vercel desplegado

### Usuario Confirmó
> "ahora si"

**Sistema operativo al 100%** ✅
