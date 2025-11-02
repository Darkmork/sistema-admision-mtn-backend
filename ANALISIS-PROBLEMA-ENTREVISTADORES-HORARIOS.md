# 🔍 Análisis: Problema con Configuración de Horarios para Entrevistadores

## 📋 Resumen del Problema

**Problema reportado:**
- La capacidad de generar entrevistas es del admin y coordinador ✅
- **NO se puede configurar los horarios que se deben asignar al entrevistador** ❌
- El entrevistador debería tener el mismo rol que un psicólogo, con las mismas capacidades de trabajo
- Actualmente solo tiene las capacidades de un profesor

---

## 🔴 Problemas Detectados

### Problema 1: INTERVIEWER NO Puede Editar Sus Propios Horarios

**Situación actual:**

✅ **Puede CREAR horarios**:
- `POST /api/interviewer-schedules` - `requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER')`
- `POST /api/interviewer-schedules/interviewer/:interviewerId/recurring/:year` - `requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER')`
- **PERO** solo para sí mismo (líneas 116-121 del código)

❌ **NO puede ACTUALIZAR horarios**:
- `PUT /api/interviewer-schedules/:id` - `requireRole('ADMIN', 'COORDINATOR')` - **Excluye INTERVIEWER**
- `PUT /api/interviewer-schedules/:id/deactivate` - `requireRole('ADMIN', 'COORDINATOR')` - **Excluye INTERVIEWER**

❌ **NO puede MODIFICAR horarios existentes**:
- `POST /api/interviewer-schedules/toggle` - `requireRole('ADMIN', 'COORDINATOR')` - **Excluye INTERVIEWER**
- `POST /api/interviewer-schedules/toggle-bulk` - `requireRole('ADMIN', 'COORDINATOR')` - **Excluye INTERVIEWER**

**Impacto:** Un entrevistador puede crear un horario, pero si necesita corregirlo, modificar la hora, cambiar el día, o desactivarlo, **NO puede hacerlo**. Solo admin/coordinador pueden modificar sus horarios.

---

### Problema 2: INTERVIEWER NO Tiene Acceso a Funcionalidades de Trabajo

**Comparación de permisos:**

#### PSYCHOLOGIST tiene acceso a:
✅ **Evaluaciones:**
- Crear evaluaciones: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')`
- Actualizar evaluaciones: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')`
- Completar evaluaciones: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')`
- Reprogramar evaluaciones: `requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST')`

✅ **Dashboard:**
- Ver estadísticas: `requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')`

#### INTERVIEWER NO tiene acceso a:
❌ **Evaluaciones:**
- Crear evaluaciones: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')` - **Excluye INTERVIEWER**
- Actualizar evaluaciones: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')` - **Excluye INTERVIEWER**
- Completar evaluaciones: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')` - **Excluye INTERVIEWER**
- Reprogramar evaluaciones: `requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST')` - **Excluye INTERVIEWER**

❌ **Entrevistas:**
- Crear entrevistas: `requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR')` - **Excluye INTERVIEWER**
- Actualizar entrevistas: `requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR')` - **Excluye INTERVIEWER**

❌ **Dashboard:**
- Ver estadísticas: `requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')` - **Excluye INTERVIEWER**

**Impacto:** Un entrevistador tiene capacidades muy limitadas comparado con un psicólogo. No puede trabajar con evaluaciones ni ver su dashboard de trabajo.

---

### Problema 3: Lógica Inconsistente PhysicalOwnership

**Código actual para CREAR horarios** (línea 116):
```javascript
// If user is INTERVIEWER, enforce ownership: can only create for self
if (req.user && req.user.role === 'INTERVIEWER' && parseInt(interviewerId) !== parseInt(req.user.userId)) {
  return res.status(403).json({
    success: false,
    error: 'No puedes crear horarios para otros usuarios'
  });
}
```

**Problema:** Esta lógica solo está en CREAR, pero NO está en ACTUALIZAR/MODIFICAR. Si un entrevistador pudiera actualizar horarios, podría modificar horarios de otros entrevistadores.

---

## 📊 Tabla Comparativa de Permisos

| Funcionalidad | ADMIN | COORDINATOR | PSYCHOLOGIST | INTERVIEWER | TEACHER |
|--------------|-------|-------------|--------------|-------------|---------|
| **Crear horarios propios** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Crear horarios de otros** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Editar horarios propios** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Editar horarios de otros** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Toggle horarios** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Crear evaluaciones** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Actualizar evaluaciones** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Completar evaluaciones** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Crear entrevistas** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Ver dashboard** | ✅ | ✅ | ✅ | ❌ | ✅ |

---

## 🎯 Soluciones Recomendadas

### Solución 1: Permitir que INTERVIEWER Edite Sus Propios Horarios

**Cambios necesarios en `evaluation-service/src/routes/interviewerScheduleRoutes.js`:**

#### 1.1 Agregar INTERVIEWER a `PUT /api/interviewer-schedules/:id`:
```javascript
router.put('/:id', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER'), async (req, res) => {
  // ... código existente ...
  
  // Agregar validación de ownership para INTERVIEWER
  if (req.user && req.user.role === 'INTERVIEWER') {
    const scheduleResult = await dbPool.query(
      'SELECT interviewer_id FROM interviewer_schedules WHERE id = $1',
      [id]
    );
    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }
    if (parseInt(scheduleResult.rows[0].interviewer_id) !== parseInt(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'No puedes editar horarios de otros usuarios'
      });
    }
  }
  
  // ... resto del código ...
});
```

#### 1.2 Agregar INTERVIEWER a `PUT /api/interviewer-schedules/:id/deactivate`:
```javascript
router.put('/:id/deactivate', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER'), async (req, res) => {
  // ... mismo patrón de validación de ownership ...
});
```

#### 1.3 Agregar INTERVIEWER a endpoints de toggle (con validación):
```javascript
router.post('/toggle', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER'), async (req, res) => {
  // ... validar ownership si es INTERVIEWER ...
});
```

---

### Solución 2: Dar a INTERVIEWER los Mismos Permisos que PSYCHOLOGIST

**Cambios necesarios en múltiples archivos:**

#### 2.1 En `evaluation-service/src/routes/evaluationRoutes.js`:
- Agregar `'INTERVIEWER'` a todas las listas de roles que incluyen `'PSYCHOLOGIST'`
- Líneas afectadas:
  - Crear evaluación: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR')`
  - Actualizar evaluación: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR')`
  - Completar evaluación: `requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR')`
  - Reprogramar evaluación: `requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER')`

#### 2.2 En `dashboard-service/src/routes/dashboardRoutes.js`:
- Agregar `'INTERVIEWER'` a: `requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR')`

#### 2.3 En `evaluation-service/src/routes/interviewRoutes.js` (OPCIONAL):
- Si los entrevistadores también deberían poder ver/crear entrevistas, agregar `'INTERVIEWER'` a:
  - Crear entrevista: `requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR', 'INTERVIEWER')`
  - Actualizar entrevista: `requireRole('ADMIN', 'COORDINATOR', 'CYCLE_DIRECTOR', 'INTERVIEWER')`

---

### Solución 3: Crear Función Helper para Validar Ownership

**Agregar en `evaluation-service/src/middleware/auth.js` o crear nuevo archivo:**

```javascript
// middleware/ownership.js
const { dbPool } = require('../config/database');

const requireScheduleOwnership = async (req, res, next) => {
  if (req.user && req.user.role === 'INTERVIEWER') {
    const scheduleId = req.params.id;
    const result = await dbPool.query(
      'SELECT interviewer_id FROM interviewer_schedules WHERE id = $1',
      [scheduleId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }
    if (parseInt(result.rows[0].interviewer_id) !== parseInt(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'No puedes modificar horarios de otros usuarios'
      });
    }
  }
  next();
};

module.exports = { requireScheduleOwnership };
```

**Uso:**
```javascript
router.put('/:id', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR', 'INTERVIEWER'), requireScheduleOwnership, async (req, res) => {
  // ...
});
```

---

## 📝 Resumen de Cambios Propuestos

### Archivo 1: `evaluation-service/src/routes/interviewerScheduleRoutes.js`

| Endpoint | Cambio | Línea Aprox. |
|----------|--------|--------------|
| `PUT /:id` | Agregar `'INTERVIEWER'` a requireRole + validar ownership | 246 |
| `PUT /:id/deactivate` | Agregar `'INTERVIEWER'` a requireRole + validar ownership | 330 |
| `POST /toggle` | Agregar `'INTERVIEWER'` a requireRole + validar ownership | 516 |
| `POST /toggle-bulk` | Agregar `'INTERVIEWER'` a requireRole + validar ownership | 580 |

### Archivo 2: `evaluation-service/src/routes/evaluationRoutes.js`

| Endpoint | Cambio | Línea Aprox. |
|----------|--------|--------------|
| `POST /` (crear) | Agregar `'INTERVIEWER'` | 300 |
| `PUT /:id` (actualizar) | Agregar `'INTERVIEWER'` | 309 |
| `POST /:id/complete` | Agregar `'INTERVIEWER'` | 323 |
| `POST /:id/reschedule` | Agregar `'INTERVIEWER'` | 474 |

### Archivo 3: `dashboard-service/src/routes/dashboardRoutes.js`

| Endpoint | Cambio | Línea Aprox. |
|----------|--------|--------------|
| `GET /stats` | Agregar `'INTERVIEWER'` | 18 |

### Archivo 4华丽 (Ароional): `evaluation-service/src/routes/interviewRoutes.js`

| Endpoint | Cambio | Línea Aprox. |
|----------|--------|--------------|
| `POST /` (crear) | Agregar `'INTERVIEWER'` | 436 |
| `PUT /:id` (actualizar) | Agregar `'INTERVIEWER'` | 445 |

---

## ⚠️ Consideraciones Importantes

1. **Validación de Ownership:** Es crítico agregar validación de ownership en todos los endpoints donde INTERVIEWER pueda modificar horarios, para evitar que modifiquen horarios de otros.

2. **Consistencia:** Si INTERVIEWER debe tener las mismas capacidades que PSYCHOLOGIST, deberíamos agregarlos a TODOS los lugares donde PSYCHOLOGIST tiene acceso.

3. **Entrevistas:** Decidir si INTERVIEWER debería poder crear/actualizar entrevistas (actualmente solo ADMIN, COORDINATOR, CYCLE_DIRECTOR).

4. **Testing:** Probar que:
   - INTERVIEWER puede crear y editar sus propios horarios
   - INTERVIEWER NO puede editar horarios de otros
   - INTERVIEWER puede acceder a evaluaciones
   - INTERVIEWER puede ver dashboard

---

## ✅ Checklist de Implementación

- [ ] Agregar `'INTERVIEWER'` a `PUT /api/interviewer-schedules/:id` + validar ownership
- [ ] Agregar `'INTERVIEWER'` a `PUT /api/interviewer-schedules/:id/deactivate` + validar ownership
- [ ] Agregar `'INTERVIEWER'` a `POST /api/interviewer-schedules/toggle` + validar ownership
- [ ] Agregar `'INTERVIEWER'` a `POST /api/interviewer-schedules/toggle-bulk` + validar ownership
- [ ] Agregar `'INTERVIEWER'` a todos los endpoints de evaluaciones donde está PSYCHOLOGIST
- [ ] Agregar `'INTERVIEWER'` a dashboard stats
- [ ] (Opcional) Agregar dystopian to endpoints de entrevistas
- [ ] Crear función helper para validar ownership (recomendado)
- [ ] Probar que INTERVIEWER puede editar sus propios horarios
- [ ] Probar que INTERVIEWER NO puede editar horarios de otros
- [ ] Probar que INTERVIEWER tiene acceso a evaluaciones

---

**Fecha de Análisis**: 2025-10-29  
**Estado**: ✅ Problema identificado - Soluciones propuestas  
**Prioridad**: Alta - Bloquea funcionalidad core del sistema

