# Análisis de Endpoints: Frontend vs Backend - Gestión de Evaluaciones

**Fecha**: 2025-10-23
**Contexto**: Dashboard de Admin - Gestión de Evaluaciones
**Objetivo**: Identificar inconsistencias entre endpoints del frontend y backend para corregirlas

---

## 📊 Resumen Ejecutivo

### Estado General
- **Frontend**: `evaluationService.ts` tiene 24 métodos
- **Backend**: `evaluationRoutes.js` tiene 19 endpoints
- **Inconsistencias encontradas**: 8 críticas, 3 menores
- **Acción requerida**: Actualizar frontend para que coincida con backend

---

## 🔴 INCONSISTENCIAS CRÍTICAS (Requieren Corrección Inmediata)

### 1. **getAllEvaluations() - CORRECTO ✅**
**Frontend (línea 581)**:
```typescript
async getAllEvaluations(): Promise<Evaluation[]> {
  const response = await api.get('/api/evaluations');
  return response.data.data;
}
```

**Backend (línea 10)**:
```javascript
router.get('/', authenticate, EvaluationController.getAllEvaluations);
// Ruta completa: GET /api/evaluations
```

**Status**: ✅ **MATCH PERFECTO**

---

### 2. **getEvaluationById() - CORRECTO ✅**
**Frontend (línea 607)**:
```typescript
async getEvaluationById(evaluationId: number): Promise<Evaluation> {
  const response = await api.get(`/api/evaluations/${evaluationId}`);
  return response.data.data;
}
```

**Backend (línea 291)**:
```javascript
router.get('/:id', authenticate, EvaluationController.getEvaluationById);
```

**Status**: ✅ **MATCH PERFECTO**

---

### 3. **getEvaluationsByApplicationId() - CORRECTO ✅**
**Frontend (línea 633)**:
```typescript
async getEvaluationsByApplicationId(applicationId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/application/${applicationId}`);
  return response.data;
}
```

**Backend (línea 139)**:
```javascript
router.get('/application/:applicationId', authenticate,
  EvaluationController.getEvaluationsByApplicationId);
```

**Status**: ✅ **MATCH PERFECTO**

---

### 4. **getEvaluationStatistics() - ❌ INCORRECTO**

**Frontend (línea 523)**:
```typescript
async getEvaluationStatistics(): Promise<{...}> {
  const response = await api.get('/evaluations/statistics');  // ❌ FALTA /api/
  return response.data;
}
```

**Backend (línea 13)**:
```javascript
router.get('/statistics', authenticate, async (req, res) => {
  // Ruta completa: GET /api/evaluations/statistics
});
```

**🔧 CORRECCIÓN REQUERIDA**:
```typescript
// CAMBIAR DE:
const response = await api.get('/evaluations/statistics');

// A:
const response = await api.get('/api/evaluations/statistics');
```

---

### 5. **assignBulkEvaluations() - ❌ RUTA INCORRECTA**

**Frontend (línea 492)**:
```typescript
async assignBulkEvaluations(applicationIds: number[]): Promise<{...}> {
  const response = await api.post('/evaluations/assign/bulk', { applicationIds });
  // ❌ FALTA /api/ y la ruta está invertida
}
```

**Backend (línea 485)**:
```javascript
router.post('/bulk/assign', authenticate, validateCsrf,
  requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  // Ruta completa: POST /api/evaluations/bulk/assign
  // Parámetros: { evaluationIds, evaluatorId, evaluationDate }
  // ❌ Frontend envía applicationIds, backend espera evaluationIds
});
```

**🔧 CORRECCIÓN REQUERIDA**:
```typescript
// CAMBIAR DE:
async assignBulkEvaluations(applicationIds: number[]): Promise<{...}> {
  const response = await api.post('/evaluations/assign/bulk', { applicationIds });
}

// A:
async assignBulkEvaluations(evaluationIds: number[], evaluatorId: number, evaluationDate?: string): Promise<{...}> {
  const response = await api.post('/api/evaluations/bulk/assign', {
    evaluationIds,
    evaluatorId,
    evaluationDate
  });
  return response.data;
}
```

---

### 6. **reassignEvaluation() - ❌ RUTA INCORRECTA**

**Frontend (línea 518)**:
```typescript
async reassignEvaluation(evaluationId: number, newEvaluatorId: number): Promise<Evaluation> {
  const response = await api.put(`/evaluations/${evaluationId}/reassign/${newEvaluatorId}`);
  // ❌ FALTA /api/ y el endpoint no existe en backend
}
```

**Backend**: **NO EXISTE** ❌

**Backend similar** (línea 360):
```javascript
router.post('/:id/assign', authenticate, validateCsrf,
  requireRole('ADMIN', 'COORDINATOR'), async (req, res) => {
  // POST /api/evaluations/:id/assign
  // Body: { evaluatorId, evaluationDate }
});
```

**🔧 CORRECCIÓN REQUERIDA**:
```typescript
// CAMBIAR DE:
async reassignEvaluation(evaluationId: number, newEvaluatorId: number): Promise<Evaluation> {
  const response = await api.put(`/evaluations/${evaluationId}/reassign/${newEvaluatorId}`);
}

// A:
async assignEvaluation(evaluationId: number, evaluatorId: number, evaluationDate?: string): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/assign`, {
    evaluatorId,
    evaluationDate
  });
  return response.data.data;
}

// Y renombrar el método reassignEvaluation a assignEvaluation
```

---

### 7. **getMyEvaluations() - ❌ ENDPOINT NO EXISTE**

**Frontend (línea 423)**:
```typescript
async getMyEvaluations(): Promise<Evaluation[]> {
  const response = await api.get('/evaluations/my-evaluations');
  // ❌ Este endpoint NO existe en backend
}
```

**Backend**: **NO EXISTE** ❌

**Backend similar** (línea 142):
```javascript
router.get('/evaluator/:evaluatorId', authenticate, async (req, res) => {
  // GET /api/evaluations/evaluator/:evaluatorId
});
```

**🔧 CORRECCIÓN REQUERIDA**:
```typescript
// CAMBIAR DE:
async getMyEvaluations(): Promise<Evaluation[]> {
  const response = await api.get('/evaluations/my-evaluations');
}

// A:
async getEvaluationsByEvaluator(evaluatorId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/evaluator/${evaluatorId}`);
  return response.data.data;
}
```

---

### 8. **getMyPendingEvaluations() - ❌ ENDPOINT NO EXISTE**

**Frontend (línea 428)**:
```typescript
async getMyPendingEvaluations(): Promise<Evaluation[]> {
  const response = await api.get('/evaluations/my-pending');
  // ❌ Este endpoint NO existe en backend
}
```

**Backend**: **EXISTE PERO DIFERENTE** ⚠️

**Backend (línea 170)**:
```javascript
router.get('/evaluator/:id/pending', authenticate, async (req, res) => {
  // GET /api/evaluations/evaluator/:id/pending
});
```

**🔧 CORRECCIÓN REQUERIDA**:
```typescript
// CAMBIAR DE:
async getMyPendingEvaluations(): Promise<Evaluation[]> {
  const response = await api.get('/evaluations/my-pending');
}

// A:
async getPendingEvaluationsByEvaluator(evaluatorId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/evaluator/${evaluatorId}/pending`);
  return response.data.data;
}
```

---

### 9. **updateEvaluation() - ❌ FALTA /api/**

**Frontend (línea 433)**:
```typescript
async updateEvaluation(evaluationId: number, evaluationData: Partial<Evaluation>): Promise<Evaluation> {
  const response = await api.put(`/evaluations/${evaluationId}`, evaluationData);
  // ❌ FALTA /api/
}
```

**Backend (línea 302)**:
```javascript
router.put('/:id', authenticate, validateCsrf,
  requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  validate(updateEvaluationSchema),
  EvaluationController.updateEvaluation);
// PUT /api/evaluations/:id
```

**🔧 CORRECCIÓN REQUERIDA**:
```typescript
// CAMBIAR DE:
const response = await api.put(`/evaluations/${evaluationId}`, evaluationData);

// A:
const response = await api.put(`/api/evaluations/${evaluationId}`, evaluationData);
```

---

### 10. **getDetailedEvaluationsByApplication() - ❌ ENDPOINT NO EXISTE**

**Frontend (línea 547)**:
```typescript
async getDetailedEvaluationsByApplication(applicationId: number): Promise<any[]> {
  const response = await api.get(`/evaluations/application/${applicationId}/detailed`);
  // ❌ Este endpoint NO existe
}
```

**Backend**: **NO EXISTE** ❌

**🔧 SOLUCIÓN**:
```typescript
// ELIMINAR este método o usar getEvaluationsByApplicationId() existente
// O solicitar al backend crear este endpoint si se necesita información adicional
```

---

## 🟡 ENDPOINTS DEL BACKEND NO USADOS EN FRONTEND

### 11. **GET /api/evaluations/assignments** - ⚠️ NO USADO

**Backend (línea 58)**:
```javascript
router.get('/assignments', authenticate, async (req, res) => {
  // Obtiene evaluaciones en estado PENDING o IN_PROGRESS
});
```

**Frontend**: NO EXISTE

**🔧 AGREGAR AL FRONTEND**:
```typescript
async getActiveAssignments(): Promise<Evaluation[]> {
  const response = await api.get('/api/evaluations/assignments');
  return response.data.data;
}
```

---

### 12. **GET /api/evaluations/export** - ⚠️ NO USADO

**Backend (línea 85)**:
```javascript
router.get('/export', authenticate, requireRole('ADMIN', 'COORDINATOR'),
  async (req, res) => {
  // Exportar evaluaciones en JSON o CSV
  // Query params: status, type, format
});
```

**Frontend**: NO EXISTE

**🔧 AGREGAR AL FRONTEND**:
```typescript
async exportEvaluations(filters?: {
  status?: string;
  type?: string;
  format?: 'json' | 'csv'
}): Promise<Blob | any> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.format) params.append('format', filters.format);

  const response = await api.get(`/api/evaluations/export?${params.toString()}`, {
    responseType: filters?.format === 'csv' ? 'blob' : 'json'
  });

  return response.data;
}
```

---

### 13. **GET /api/evaluations/evaluator/:id/completed** - ⚠️ NO USADO

**Backend (línea 198)**:
```javascript
router.get('/evaluator/:id/completed', authenticate, async (req, res) => {
  // Evaluaciones completadas de un evaluador
});
```

**🔧 AGREGAR AL FRONTEND**:
```typescript
async getCompletedEvaluationsByEvaluator(evaluatorId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/evaluator/${evaluatorId}/completed`);
  return response.data.data;
}
```

---

### 14. **GET /api/evaluations/type/:type** - ⚠️ NO USADO

**Backend (línea 226)**:
```javascript
router.get('/type/:type', authenticate, async (req, res) => {
  // Filtrar por tipo de evaluación
});
```

**🔧 AGREGAR AL FRONTEND**:
```typescript
async getEvaluationsByType(type: EvaluationType): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/type/${type}`);
  return response.data.data;
}
```

---

### 15. **GET /api/evaluations/subject/:subject** - ⚠️ NO USADO

**Backend (línea 254)**:
```javascript
router.get('/subject/:subject', authenticate, async (req, res) => {
  // Filtrar por materia (LANGUAGE, MATHEMATICS, ENGLISH)
});
```

**🔧 AGREGAR AL FRONTEND**:
```typescript
async getEvaluationsBySubject(subject: 'LANGUAGE' | 'MATHEMATICS' | 'ENGLISH'): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/subject/${subject}`);
  return response.data.data;
}
```

---

### 16. **POST /api/evaluations/:id/complete** - ⚠️ NO USADO

**Backend (línea 320)**:
```javascript
router.post('/:id/complete', authenticate, validateCsrf,
  requireRole('ADMIN', 'TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR'),
  async (req, res) => {
  // Body: { score, recommendations, observations }
});
```

**🔧 AGREGAR AL FRONTEND**:
```typescript
async completeEvaluation(
  evaluationId: number,
  data: {
    score?: number;
    recommendations?: string;
    observations?: string
  }
): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/complete`, data);
  return response.data.data;
}
```

---

### 17. **POST /api/evaluations/:id/reschedule** - ⚠️ NO USADO

**Backend (línea 405)**:
```javascript
router.post('/:id/reschedule', authenticate, validateCsrf,
  requireRole('ADMIN', 'COORDINATOR', 'TEACHER', 'PSYCHOLOGIST'),
  async (req, res) => {
  // Body: { evaluationDate }
});
```

**🔧 AGREGAR AL FRONTEND**:
```typescript
async rescheduleEvaluation(evaluationId: number, evaluationDate: string): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/reschedule`, {
    evaluationDate
  });
  return response.data.data;
}
```

---

### 18. **POST /api/evaluations/:id/cancel** - ⚠️ NO USADO

**Backend (línea 448)**:
```javascript
router.post('/:id/cancel', authenticate, validateCsrf,
  requireRole('ADMIN', 'COORDINATOR'),
  async (req, res) => {
  // Body: { reason }
});
```

**🔧 AGREGAR AL FRONTEND**:
```typescript
async cancelEvaluation(evaluationId: number, reason?: string): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/cancel`, {
    reason
  });
  return response.data.data;
}
```

---

## 📋 ENDPOINTS LEGACY EN FRONTEND (Sin backend correspondiente)

### ❌ Métodos que NO tienen endpoint en backend:

1. **assignEvaluationsToApplication()** (línea 340) - ❌ NO EXISTE
2. **assignSpecificEvaluation()** (línea 352) - ❌ NO EXISTE
3. **getEvaluationProgress()** (línea 376) - ❌ NO EXISTE
4. **getEvaluatorsByRole()** (línea 394) - ❌ NO EXISTE (existe en user-service)

**🔧 ACCIÓN**: Estos métodos deberían eliminarse o movarse a sus servicios correspondientes.

---

## 🎯 PLAN DE CORRECCIÓN

### Prioridad 1: Correcciones Críticas (Inmediatas)

```typescript
// evaluationService.ts - CORRECCIONES CRÍTICAS

// 1. Corregir getEvaluationStatistics
async getEvaluationStatistics(): Promise<{...}> {
  const response = await api.get('/api/evaluations/statistics'); // ✅ Agregado /api/
  return response.data.data;
}

// 2. Corregir assignBulkEvaluations
async assignBulkEvaluations(
  evaluationIds: number[],
  evaluatorId: number,
  evaluationDate?: string
): Promise<{...}> {
  const response = await api.post('/api/evaluations/bulk/assign', {
    evaluationIds,  // ✅ Cambiado de applicationIds
    evaluatorId,    // ✅ Agregado
    evaluationDate  // ✅ Agregado
  });
  return response.data;
}

// 3. Renombrar y corregir reassignEvaluation → assignEvaluation
async assignEvaluation(
  evaluationId: number,
  evaluatorId: number,
  evaluationDate?: string
): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/assign`, {
    evaluatorId,
    evaluationDate
  });
  return response.data.data;
}

// 4. Corregir getMyEvaluations
async getEvaluationsByEvaluator(evaluatorId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/evaluator/${evaluatorId}`);
  return response.data.data;
}

// 5. Corregir getMyPendingEvaluations
async getPendingEvaluationsByEvaluator(evaluatorId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/evaluator/${evaluatorId}/pending`);
  return response.data.data;
}

// 6. Corregir updateEvaluation
async updateEvaluation(evaluationId: number, evaluationData: Partial<Evaluation>): Promise<Evaluation> {
  const response = await api.put(`/api/evaluations/${evaluationId}`, evaluationData);
  return response.data.data;
}
```

### Prioridad 2: Agregar Endpoints Faltantes

```typescript
// Nuevos métodos para agregar al evaluationService

async getActiveAssignments(): Promise<Evaluation[]> {
  const response = await api.get('/api/evaluations/assignments');
  return response.data.data;
}

async exportEvaluations(filters?: {
  status?: string;
  type?: string;
  format?: 'json' | 'csv'
}): Promise<Blob | any> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.format) params.append('format', filters.format);

  const response = await api.get(`/api/evaluations/export?${params.toString()}`, {
    responseType: filters?.format === 'csv' ? 'blob' : 'json'
  });

  return response.data;
}

async getCompletedEvaluationsByEvaluator(evaluatorId: number): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/evaluator/${evaluatorId}/completed`);
  return response.data.data;
}

async getEvaluationsByType(type: EvaluationType): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/type/${type}`);
  return response.data.data;
}

async getEvaluationsBySubject(subject: 'LANGUAGE' | 'MATHEMATICS' | 'ENGLISH'): Promise<Evaluation[]> {
  const response = await api.get(`/api/evaluations/subject/${subject}`);
  return response.data.data;
}

async completeEvaluation(
  evaluationId: number,
  data: {
    score?: number;
    recommendations?: string;
    observations?: string
  }
): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/complete`, data);
  return response.data.data;
}

async rescheduleEvaluation(evaluationId: number, evaluationDate: string): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/reschedule`, {
    evaluationDate
  });
  return response.data.data;
}

async cancelEvaluation(evaluationId: number, reason?: string): Promise<Evaluation> {
  const response = await api.post(`/api/evaluations/${evaluationId}/cancel`, {
    reason
  });
  return response.data.data;
}
```

### Prioridad 3: Limpiar Métodos Legacy

```typescript
// ELIMINAR estos métodos:
// - assignEvaluationsToApplication()
// - assignSpecificEvaluation()
// - getEvaluationProgress()
// - getEvaluatorsByRole() (debe estar en userService)
// - getDetailedEvaluationsByApplication()
```

---

## 📊 TABLA COMPARATIVA COMPLETA

| Método Frontend | Endpoint Actual | Endpoint Correcto | Status |
|----------------|----------------|-------------------|--------|
| `getAllEvaluations()` | `/api/evaluations` | `/api/evaluations` | ✅ OK |
| `getEvaluationById()` | `/api/evaluations/:id` | `/api/evaluations/:id` | ✅ OK |
| `getEvaluationsByApplicationId()` | `/api/evaluations/application/:id` | `/api/evaluations/application/:id` | ✅ OK |
| `getEvaluationStatistics()` | `/evaluations/statistics` | `/api/evaluations/statistics` | ❌ FIX |
| `assignBulkEvaluations()` | `/evaluations/assign/bulk` | `/api/evaluations/bulk/assign` | ❌ FIX |
| `reassignEvaluation()` | `/evaluations/:id/reassign/:id` | `/api/evaluations/:id/assign` | ❌ FIX |
| `getMyEvaluations()` | `/evaluations/my-evaluations` | `/api/evaluations/evaluator/:id` | ❌ FIX |
| `getMyPendingEvaluations()` | `/evaluations/my-pending` | `/api/evaluations/evaluator/:id/pending` | ❌ FIX |
| `updateEvaluation()` | `/evaluations/:id` | `/api/evaluations/:id` | ❌ FIX |
| `getActiveAssignments()` | NO EXISTE | `/api/evaluations/assignments` | ➕ ADD |
| `exportEvaluations()` | NO EXISTE | `/api/evaluations/export` | ➕ ADD |
| `getCompletedByEvaluator()` | NO EXISTE | `/api/evaluations/evaluator/:id/completed` | ➕ ADD |
| `getEvaluationsByType()` | NO EXISTE | `/api/evaluations/type/:type` | ➕ ADD |
| `getEvaluationsBySubject()` | NO EXISTE | `/api/evaluations/subject/:subject` | ➕ ADD |
| `completeEvaluation()` | NO EXISTE | `/api/evaluations/:id/complete` | ➕ ADD |
| `rescheduleEvaluation()` | NO EXISTE | `/api/evaluations/:id/reschedule` | ➕ ADD |
| `cancelEvaluation()` | NO EXISTE | `/api/evaluations/:id/cancel` | ➕ ADD |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Paso 1: Backup
- [ ] Hacer backup de `evaluationService.ts` actual
- [ ] Crear rama: `fix/frontend-evaluation-endpoints-alignment`

### Paso 2: Correcciones Críticas
- [ ] Corregir `getEvaluationStatistics()` - agregar `/api/`
- [ ] Corregir `assignBulkEvaluations()` - cambiar parámetros y ruta
- [ ] Renombrar `reassignEvaluation()` a `assignEvaluation()` y corregir ruta
- [ ] Corregir `getMyEvaluations()` → `getEvaluationsByEvaluator()`
- [ ] Corregir `getMyPendingEvaluations()` → `getPendingEvaluationsByEvaluator()`
- [ ] Corregir `updateEvaluation()` - agregar `/api/`

### Paso 3: Agregar Métodos Faltantes
- [ ] Agregar `getActiveAssignments()`
- [ ] Agregar `exportEvaluations()`
- [ ] Agregar `getCompletedEvaluationsByEvaluator()`
- [ ] Agregar `getEvaluationsByType()`
- [ ] Agregar `getEvaluationsBySubject()`
- [ ] Agregar `completeEvaluation()`
- [ ] Agregar `rescheduleEvaluation()`
- [ ] Agregar `cancelEvaluation()`

### Paso 4: Limpieza
- [ ] Eliminar `assignEvaluationsToApplication()`
- [ ] Eliminar `assignSpecificEvaluation()`
- [ ] Eliminar `getEvaluationProgress()`
- [ ] Mover `getEvaluatorsByRole()` a `userService.ts`
- [ ] Eliminar `getDetailedEvaluationsByApplication()`

### Paso 5: Testing
- [ ] Probar todos los endpoints corregidos
- [ ] Verificar respuestas del backend
- [ ] Actualizar componentes que usan los métodos renombrados
- [ ] Probar dashboard de admin de evaluaciones

### Paso 6: Documentación
- [ ] Actualizar comentarios en `evaluationService.ts`
- [ ] Documentar nuevos métodos
- [ ] Actualizar tipos TypeScript si es necesario

---

## 🚀 PRÓXIMOS PASOS

1. **Crear archivo corregido**: `evaluationService.FIXED.ts`
2. **Testear localmente** con backend corriendo
3. **Actualizar componentes** del dashboard que usan estos métodos
4. **Deploy a staging** y verificar
5. **Deploy a producción**

---

**Generado por**: Claude Code
**Última actualización**: 2025-10-23
