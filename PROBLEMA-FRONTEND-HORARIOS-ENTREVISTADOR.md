# 🔴 Problema: No Aparece Opción para Agregar Horarios a Entrevistador

## 📋 Descripción del Problema

**Síntoma**: Cuando se crea un usuario con rol `INTERVIEWER`, no aparece o no se activa la opción para agregar horarios de atención a ese entrevistador en el frontend.

---

## 🔍 Análisis del Backend

### Endpoint que Lista Entrevistadores: `/api/interviews/public/interviewers`

**Código actual** (`evaluation-service/src/routes/interviewRoutes.js`, líneas 25-46):

```javascript
const result = await dbPool.query(`
  SELECT
    u.id,
    CONCAT(u.first_name, ' ', u.last_name) as name,
    u.role,
    u.subject,
    CASE
      WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST') THEN 'ALL'
      WHEN u.subject LIKE '%MATH%' OR u.subject LIKE '%SCIENCE%' THEN 'SECONDARY'
      ELSE 'PRIMARY'
    END as educational_level,
    (
      SELECT COUNT(*)
      FROM interviewer_schedules s
      WHERE s.interviewer_id = u.id
        AND s.is_active = true
    ) as schedule_count
  FROM users u
  WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER')
    AND u.active = true
  ORDER BY u.role, u.last_name, u.first_name
`);
```

**Análisis**:
- ✅ Incluye `'INTERVIEWER'` en la lista de roles válidos (línea 43)
- ✅ Filtra por `active = true`
- ⚠️ **PROBLEMA POTENCIAL**: El `educational_level` para `INTERVIEWER` será `'PRIMARY'` (línea 34) porque:
  - No está en la lista `('CYCLE_DIRECTOR', 'PSYCHOLOGIST')` → no es `'ALL'`
  - Probablemente no tiene `subject` con `'MATH'` o `'SCIENCE'` → no es `'SECONDARY'`
  - Por lo tanto, cae en `ELSE 'PRIMARY'`

**Impacto**: Si el frontend filtra o valida por `educational_level`, podría estar excluyendo entrevistadores.

---

### Endpoint Alternativo: `/api/users/public/school-staff`

**Código actual** (`user-service/src/routes/userRoutes.js`, líneas 25-49):

```javascript
WHERE role IN ('ADMIN', 'TEACHER', 'COORDINATOR', 'CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER')

// ...

canInterview: ['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER'].includes(user.role)
```

**Análisis**:
- ✅ Incluye `'INTERVIEWER'` en la query
- ✅ Calcula `canInterview: true` para `INTERVIEWER`
- ❌ **NO incluye `educational_level`** en la respuesta

---

## 🎯 Posibles Causas en el Frontend

### Causa 1: Frontend Filtra por `educational_level`

Si el frontend tiene código como:
```javascript
// Frontend podría tener algo como:
const canAssignSchedules = interviewer.educationalLevel === 'ALL' || interviewer.educationalLevel === 'SECONDARY';
```

Entonces los entrevistadores con `educational_level = 'PRIMARY'` serían excluidos.

**Solución Backend**: Agregar `INTERVIEWER` al CASE para que tenga `educational_level = 'ALL'` (igual que PSYCHOLOGIST).

---

### Causa 2: Frontend Valida `subject` No Nulo

Si el frontend requiere que el entrevistador tenga un `subject` definido:
```javascript
if (!interviewer.subject) {
  // No mostrar opción de horarios
}
```

Y el usuario `INTERVIEWER` recién creado no tiene `subject` asignado.

**Solución**: Asegurarse de que al crear un `INTERVIEWER`, se le asigne un `subject` o hacer que el frontend no requiera `subject` para entrevistadores.

---

### Causa 3: Frontend Filtra por Rol Específico

Si el frontend tiene una lista hardcodeada de roles que pueden tener horarios:
```javascript
const canHaveSchedules = ['TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR'];
// Falta 'INTERVIEWER'
```

**Solución Frontend**: Agregar `'INTERVIEWER'` a la lista.

---

### Causa 4: Endpoint Diferente o Cache

- El frontend podría estar usando un endpoint diferente que NO incluye `INTERVIEWER`
- Podría haber cache del lado del frontend que no se ha refrescado
- El usuario recién creado podría no estar en la respuesta porque el cache del backend no se ha invalidado

---

## ✅ Soluciones Recomendadas

### Solución 1: Hacer que INTERVIEWER Tenga `educational_level = 'ALL'`

**Cambiar en `evaluation-service/src/routes/interviewRoutes.js`** (línea 31-35):

```javascript
CASE
  WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER') THEN 'ALL'  // ← Agregar 'INTERVIEWER'
  WHEN u.subject LIKE '%MATH%' OR u.subject LIKE '%SCIENCE%' THEN 'SECONDARY'
  ELSE 'PRIMARY'
END as educational_level,
```

**Justificación**: Un entrevistador debería poder entrevistar a estudiantes de todos los niveles (igual que un psicólogo), no solo primaria.

---

### Solución 2: Agregar Validación para Verificar que Usuario Existe

**Mejorar el endpoint `/api/interviews/public/interviewers`** para incluir validación adicional:

```javascript
// Agregar después de la query
const interviewers = result.rows.map(row => ({
  id: row.id,
  name: row.name,
  role: row.role,
  subject:原因 subject,
  educationalLevel: row.educational_level,
  scheduleCount: parseInt(row.schedule_count || 0),
  canReceiveSchedules: true  // ← Agregar flag explícito
}));
```

---

### Solución 3: Crear Endpoint Específico para Entrevistadores Disponibles

**Nuevo endpoint**: `GET /api/interviewers/available-for-schedules`

```javascript
router.get('/available-for-schedules', authenticate, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.role,
        u.subject,
        u.email,
        CASE
          WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER') THEN 'ALL'
          WHEN u.subject LIKE '%MATH%' OR u.subject LIKE '%SCIENCE%' THEN 'SECONDARY'
          ELSE 'PRIMARY'
        END as educational_level,
        (
          SELECT COUNT(*)
          FROM interviewer_schedules s
          WHERE s.interviewer_id = u.id
            AND s.is_active = true
        ) as schedule_count
      FROM users u
      WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER')
        AND u.active = true
      ORDER BY u.role, u.last_name, u.first_name
    `);

    const interviewers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role,
      subject: row.subject,
      email: row.email,
      educationalLevel: row.educational_level,
      scheduleCount: parseInt(row.schedule_count || 0),
      canReceiveSchedules: true
    }));

    res.json({
      success: true,
      data: interviewers,
      count: interviewers.length
    });
  } catch (error) {
    console.error('Error fetching available interviewers:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener entrevistadores disponibles',
      details: error.message
    });
  }
});
```

---

## 🔍 Verificaciones Necesarias

### 1. Verificar Qué Endpoint Usa el Frontend

**En DevTools del navegador (F12) → Network tab**:
- Filtrar por "interviewer" o "schedule"
- Intentar crear un horario para un entrevistador
- Ver qué endpoint se llama

### 2. Verificar la Respuesta del Backend

**Probar endpoint directamente**:
```bash
curl https://gateway-service-production-a753.up.railway.app/api/interviews/public/interviewers
```

**Buscar**:
- ¿Aparecen usuarios con `role: "INTERVIEWER"`?
- ¿Qué `educationalLevel` tienen?
- ¿Tienen `subject` definido?

### 3. Verificar en Base de Datของ

```sql
-- Ver todos los entrevistadores creados
SELECT id, first_name, last_name, email, role, subject, active
FROM users
WHERE role = 'INTERVIEWER'
ORDER BY created_at DESC;

-- Ver si tienen horarios asignados
SELECT u.id, u.first_name, u.last_name, u.role, COUNT(s.id) as schedule_count
FROM users u
LEFT JOIN interviewer_schedules s ON u.id = s.interviewer_id AND s.is_active = true
WHERE u.role = 'INTERVIEWER'
GROUP BY u.id, u.first_name, u.last_name, u.role;
```

---

## 📊 Comparación: PSYCHOLOGIST vs INTERVIEWER

| Campo | PSYCHOLOGIST | INTERVIEWER | ¿Diferencia Causa Problema? |
|-------|--------------|-------------|----------------------------|
| `role` | `'PSYCHOLOGIST'` | `'INTERVIEWER'` | ❌ Ambos están en la lista de roles válidos |
| `educational_level` | `'ALL'` | `'PRIMARY'` | ⚠️ **POSIBLE PROBLEMA** - Frontend podría filtrar por esto |
| `subject` | Puede ser null | Puede ser null | ⚠️ Si frontend valida, ambos tienen el mismo problema |
| `canInterview` | `true` (calculado) | `true` (calculado) | ✅ Igual |
| `schedule_count` | Funciona | Funciona | ✅ Igual |

---

## 🎯 Solución Recomendada (Mínima)

**Cambio inmediato en backend** - Línea 32 de `evaluation-service/src/routes/interviewRoutes.js`:

```javascript
// ANTES:
WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST') THEN 'ALL'

// DESPUÉS:
WHEN u.role IN ('CYCLE_DIRECTOR', 'PSYCHOLOGIST', 'INTERVIEWER') THEN 'ALL'
```

**Impacto**:
- ✅ Los entrevistadores tendrán `educational_level = 'ALL'` (igual que psicólogos)
- ✅ Si el frontend filtra por `educational_level`, ahora incluirá a entrevistadores
- ✅ Cambio mínimo y seguro

---

## 📝 Checklist para Diagnosticar

- [ ] Verificar que el usuario `INTERVIEWER` esté `active = true` en la BD
- [ ] Probar endpoint `/api/interviews/public/interviewers` y ver si aparece el entrevistador
- [ ] Verificar qué `educational_level` tiene el entrevistador en la respuesta
- [ ] Revisar código del frontend para ver si filtra por `educational_level` o `role`
- [ ] Verificar si el frontend requiere `subject` no null
- [ ] Probar crear horario directamente con curl/Postman usando el `interviewerId` del entrevistador
- [ ] Verificar si hay cache que necesita refrescarse

---

**Fecha de Análisis**: 2025-10-29  
**Estado**: 🔴 Problema identificado - `educational_level` incorrecto para INTERVIEWER  
**Prioridad**: Alta - Bloquea funcionalidad core  
**Solución Propuesta**: Cambiar línea 32 para incluir 'INTERVIEWER' en el CASE que retorna 'ALL'

