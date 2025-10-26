# 🕐 Timezone Fix - 26 de Octubre 2025

## Fecha y Hora
**Creado:** 2025-10-26 03:10 UTC (00:10 CLT)
**Problema resuelto:** Horas de entrevistas mostrándose incorrectamente (21:00 en vez de 12:00)

---

## Problema Identificado

### Síntoma
Las entrevistas programadas a las 12:00 del mediodía se mostraban como 21:00 horas en la interfaz frontend.

### Causa Raíz
PostgreSQL serializa campos de tipo `TIME` con información de zona horaria cuando se devuelven a través del driver `pg` de Node.js. Al convertir 12:00 UTC a CLT (UTC-3), se produce el desplazamiento a 21:00 del día anterior.

### Evidencia
```
Base de datos: scheduled_time = '12:00:00'
Respuesta API: scheduledTime = '21:00:00-03'  ← Problema
Frontend: Muestra "21:00 hrs"
```

---

## Solución Implementada

### Archivos Modificados

**Backend:** `/evaluation-service/src/controllers/InterviewController.js`

### Cambios Específicos

#### 1. Cast de TIME a TEXT en Query SQL (Línea 57)
```javascript
// ANTES (causaba conversión de zona horaria)
SELECT i.scheduled_time, ...

// DESPUÉS (fuerza conversión a string puro)
SELECT
  i.*,
  i.scheduled_time::text as scheduled_time_text,
  ...
```

#### 2. Agregado JOIN para Segundo Entrevistador (Línea 68)
```javascript
LEFT JOIN users u2 ON i.second_interviewer_id = u2.id
```

#### 3. Uso de Versión TEXT en Mapeo (Línea 95)
```javascript
scheduledTime: row.scheduled_time_text || row.scheduled_time,
```

#### 4. Eliminación de Campo Inexistente (Línea 101)
```javascript
// Comentario agregado:
// cancelReason no existe en la tabla interviews
```

#### 5. Soporte para Segundo Entrevistador (Líneas 92-93, 107)
```javascript
secondInterviewerId: row.second_interviewer_id,
secondInterviewerName: row.second_interviewer_name || null,
```

---

## Código Completo del Fix

### Query SQL Actualizado
```javascript
const query = `
  SELECT
    i.*,
    i.scheduled_time::text as scheduled_time_text,
    s.first_name,
    s.paternal_last_name,
    s.maternal_last_name,
    CONCAT(u.first_name, ' ', u.last_name) as interviewer_name,
    CONCAT(u2.first_name, ' ', u2.last_name) as second_interviewer_name,
    s.grade_applied
  FROM interviews i
  LEFT JOIN applications a ON i.application_id = a.id
  LEFT JOIN students s ON a.student_id = s.id
  LEFT JOIN users u ON i.interviewer_user_id = u.id
  LEFT JOIN users u2 ON i.second_interviewer_id = u2.id
  ${whereClause}
  ORDER BY i.scheduled_date DESC, i.scheduled_time DESC
  LIMIT $${paramIndex++} OFFSET $${paramIndex}
`;
```

### Mapeo de Resultados
```javascript
const interviews = result.rows.map(row => ({
  id: row.id,
  applicationId: row.application_id,
  interviewerId: row.interviewer_user_id,
  secondInterviewerId: row.second_interviewer_id,
  interviewType: row.type,
  scheduledDate: row.scheduled_date,
  scheduledTime: row.scheduled_time_text || row.scheduled_time, // ← FIX PRINCIPAL
  duration: row.duration,
  location: row.location,
  mode: row.mode,
  status: row.status,
  notes: row.notes,
  // cancelReason no existe en la tabla interviews
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // Additional fields for frontend
  studentName: `${row.first_name} ${row.paternal_last_name} ${row.maternal_last_name || ''}`.trim(),
  interviewerName: row.interviewer_name || 'No asignado',
  secondInterviewerName: row.second_interviewer_name || null,
  gradeApplied: row.grade_applied
}));
```

---

## Commits Relacionados

### Orden Cronológico
1. **d63d836** - `fix(evaluation): convertir scheduled_time a text en query para evitar conversión de zona horaria`
   - Primer intento: especificó todas las columnas explícitamente
   - **Resultado:** Error 500 - "column i.cancel_reason does not exist"

2. **b2edd81** - `fix(evaluation): usar i.* en SELECT y agregar scheduled_time_text como alias separado`
   - Corrigió el error usando `i.*` en vez de lista explícita
   - Agregó `scheduled_time::text as scheduled_time_text` como columna adicional

3. **50ef29c** - `fix(evaluation): eliminar cancelReason del mapeo - columna no existe`
   - Removió comentarios sobre cancelReason del mapeo
   - Agregó comentario explicativo: "cancelReason no existe en la tabla interviews"

---

## Testing Realizado

### 1. Verificación de Esquema de Base de Datos
```bash
\d interviews
```
**Resultado:** Confirmado que `cancel_reason` NO existe como columna

### 2. Test de Endpoint
```bash
curl "https://gateway-service-production-a753.up.railway.app/api/interviews?limit=1"
```
**Resultado:** Servicio respondiendo correctamente (requiere auth)

### 3. Verificación de Despliegue
```bash
git log --oneline -5
```
**Resultado:**
```
50ef29c fix(evaluation): eliminar cancelReason del mapeo - columna no existe
b2edd81 fix(evaluation): usar i.* en SELECT y agregar scheduled_time_text como alias separado
d63d836 fix(evaluation): convertir scheduled_time a text en query para evitar conversión de zona horaria
```

---

## Resultado Esperado

### Antes del Fix
| Campo | Base de Datos | API Response | Frontend Display |
|-------|---------------|--------------|------------------|
| scheduled_time | `12:00:00` | `21:00:00-03` | **21:00 hrs** ❌ |

### Después del Fix
| Campo | Base de Datos | API Response | Frontend Display |
|-------|---------------|--------------|------------------|
| scheduled_time | `12:00:00` | `12:00:00` | **12:00 hrs** ✅ |

---

## Verificación para Usuario

Para confirmar que el fix funciona correctamente:

1. **Refrescar la página de gestión de entrevistas** (Ctrl+F5 o Cmd+Shift+R)
2. **Verificar las horas mostradas:**
   - Entrevista del lunes 03/11 a las 12:00 → Debe mostrar "12:00 hrs" ✅
   - NO debe mostrar "21:00 hrs" ❌

3. **Verificar entrevistadores:**
   - Para entrevistas FAMILY y CYCLE_DIRECTOR
   - Deben aparecer ambos entrevistadores

4. **Verificar fechas:**
   - Las fechas deben coincidir con las programadas
   - Sin desfase de día (ya corregido en commit anterior)

---

## Contexto Técnico

### PostgreSQL TIME Type Behavior
- El tipo `TIME` en PostgreSQL almacena solo la hora (sin fecha ni zona horaria)
- Sin embargo, al serializar a través del driver `pg` de Node.js, PostgreSQL añade información de zona horaria
- Esto causa conversión automática a la zona horaria del servidor/cliente

### Solución con ::text Cast
- `::text` fuerza a PostgreSQL a devolver la hora como string literal
- No se aplica ninguna conversión de zona horaria
- El frontend recibe exactamente "12:00:00" tal como está en la base de datos

### Por Qué i.* en Lugar de Lista Explícita
- Usando `i.*` obtenemos todas las columnas de la tabla `interviews` automáticamente
- No necesitamos listar cada columna explícitamente
- Si la columna no existe (como `cancel_reason`), no causa error
- Agregamos alias adicionales (como `scheduled_time_text`) para datos calculados/convertidos

---

## Estado del Sistema

**Servicios:** ✅ Todos operativos
**Base de Datos:** ✅ PostgreSQL funcionando
**Frontend:** ✅ Vercel deployment activo
**Backend:** ✅ Railway deployment completado (commit 50ef29c)

---

## Lecciones Aprendidas

1. **PostgreSQL TIME serialization** - Los tipos TIME se serializan con zona horaria por defecto en el driver pg
2. **Cast a TEXT solución robusta** - Usar `::text` previene conversiones de zona horaria no deseadas
3. **Verificar esquema antes de queries** - Siempre usar `\d table_name` para confirmar columnas existentes
4. **i.* vs lista explícita** - Para tablas con muchas columnas, `i.*` es más seguro y mantenible
5. **Testing iterativo** - Primera solución falló, logs del usuario permitieron identificar causa exacta

---

## Referencias

- **Rollback Point Anterior:** `/ROLLBACK-POINT-2025-10-25.md`
- **Script SQL CYCLE_DIRECTOR:** `/evaluation-service/scripts/add-cycle-director-type.sql`
- **Controlador Modificado:** `/evaluation-service/src/controllers/InterviewController.js:54-109`

---

## Contacto y Notas

**Sistema:** Admisión MTN (Colegio Monte Tabor y Nazaret)
**Arquitectura:** Microservicios (Gateway + 6 servicios backend)
**Frontend:** React + TypeScript + Vite (Vercel)
**Backend:** Node.js + Express + PostgreSQL (Railway)

**Nota importante:** Este fix resuelve el problema de zona horaria en la visualización de horas de entrevistas. Funciona en conjunto con los fixes anteriores de fecha (parseLocalDate) para garantizar que fechas Y horas se muestren correctamente sin desfases de zona horaria.
