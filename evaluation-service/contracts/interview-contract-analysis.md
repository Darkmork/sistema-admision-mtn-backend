# Análisis de Alineación de Contratos API - Endpoint de Entrevistas

**Fecha**: 2025-10-20
**Microservicio**: evaluation-service
**Endpoint**: `/api/interviews`
**Problema Reportado**: Las entrevistas se muestran como "No programada" en el frontend a pesar de existir en la base de datos

---

## 1. RESUMEN EJECUTIVO

### Estado del Problema
**CONTRATO ALINEADO** - No hay discrepancias en los campos principales entre backend y frontend.

### Causa Raíz Identificada
El problema NO es de contrato API, sino de **lógica de negocio en el frontend**:

1. **Backend devuelve datos correctos**: 2 entrevistas con todos los campos mapeados correctamente
2. **Frontend recibe los datos**: El servicio `getInterviewsByApplication` mapea correctamente
3. **Lógica de filtrado incorrecta**: El componente `StudentDetailModal` busca entrevistas por `i.type === type.type` donde:
   - `REQUIRED_INTERVIEW_TYPES` define `type.type` como `'FAMILY'` y `'CYCLE_DIRECTOR'`
   - Backend devuelve `interviewType: 'FAMILY'` y `interviewType: 'CYCLE_DIRECTOR'`
   - Frontend mapea correctamente a `type: 'FAMILY'` y `type: 'CYCLE_DIRECTOR'`
   - **El filtro funciona correctamente en StudentDetailModal línea 997**

4. **Problema real**: La propiedad `postulante.entrevistaProgramada` (líneas 778, 902) es un campo **calculado del backend de aplicaciones**, no del backend de entrevistas. Este campo puede estar desactualizado o no reflejar las entrevistas recién creadas.

---

## 2. ANÁLISIS DE CONTRATOS

### 2.1 Backend Response (evaluation-service)

**Endpoint**: `GET /api/interviews?applicationId={id}`
**Archivo**: `/Users/jorgegangale/Desktop/MIcroservicios/evaluation-service/src/controllers/InterviewController.js` (líneas 69-88)

```javascript
{
  "success": true,
  "data": [
    {
      "id": 9,
      "applicationId": 1,
      "interviewerId": 3,
      "interviewType": "FAMILY",                    // ✅ Campo correcto
      "scheduledDate": "2025-10-20",               // ✅ Campo correcto
      "scheduledTime": "09:00:00",                 // ✅ Campo correcto
      "duration": 45,
      "location": "Sala de Reuniones",
      "mode": "IN_PERSON",
      "status": "SCHEDULED",                        // ✅ Campo correcto
      "notes": null,
      "cancelReason": null,
      "createdAt": "2025-10-19T15:30:00.000Z",
      "updatedAt": "2025-10-19T15:30:00.000Z",
      "studentName": "Juan Pérez González",        // ✅ Campo agregado
      "interviewerName": "María López",            // ✅ Campo agregado
      "gradeApplied": "Kinder"                     // ✅ Campo agregado
    }
  ],
  "count": 2,
  "page": 0,
  "limit": 10
}
```

**Mapeo Backend (snake_case → camelCase)**: ✅ CORRECTO
- `application_id` → `applicationId`
- `interviewer_user_id` → `interviewerId`
- `type` → `interviewType` (✅ nombre descriptivo)
- `scheduled_date` → `scheduledDate`
- `scheduled_time` → `scheduledTime`
- `cancel_reason` → `cancelReason`
- `created_at` → `createdAt`
- `updated_at` → `updatedAt`

### 2.2 Frontend Mapping (interviewService.ts)

**Archivo**: `interviewService.ts` (líneas 98-142)

```typescript
private mapBackendResponse(backendData: any): Interview {
  return {
    id: parseInt(backendData.id) || 0,
    applicationId: parseInt(backendData.applicationId) || 0,
    studentName: backendData.studentName || 'Sin nombre',
    gradeApplied: backendData.gradeApplied || 'Sin especificar',
    interviewerId: parseInt(backendData.interviewerId) || 0,
    interviewerName: backendData.interviewerName || 'Sin asignar',
    status: backendData.status || InterviewStatus.SCHEDULED,
    type: backendData.type || InterviewType.INDIVIDUAL,  // ⚠️ POTENCIAL PROBLEMA
    mode: backendData.mode || InterviewMode.IN_PERSON,
    scheduledDate: scheduledDate,
    scheduledTime: scheduledTime,
    duration: backendData.duration || 60,
    location: backendData.location || '',
    // ... otros campos
  }
}
```

**Problema Identificado**:
- Backend envía: `interviewType: "FAMILY"`
- Frontend mapea: `backendData.type` (⚠️ campo incorrecto)
- **Debería mapear**: `backendData.interviewType`

### 2.3 Frontend Display Logic (StudentDetailModal.tsx)

**Archivo**: `StudentDetailModal.tsx` (líneas 996-998)

```typescript
const interview = interviews.find(i => i.type === type.type);
const hasInterview = !!interview;
```

**Tipos esperados**:
```typescript
const REQUIRED_INTERVIEW_TYPES = [
  { type: 'FAMILY', title: 'Familiar', icon: '👨‍👩‍👧‍👦', required: true },
  { type: 'CYCLE_DIRECTOR', title: 'Director de Ciclo', icon: '👔', required: true }
];
```

**Verificación**:
- ✅ Frontend busca `i.type === 'FAMILY'`
- ✅ Backend envía `interviewType: 'FAMILY'`
- ⚠️ Frontend mapea `backendData.type` en lugar de `backendData.interviewType`

---

## 3. DISCREPANCIAS ENCONTRADAS

### 3.1 Discrepancia Crítica: Campo `type` vs `interviewType`

| Aspecto | Backend | Frontend Mapping | Frontend Display | Estado |
|---------|---------|------------------|------------------|--------|
| Campo enviado | `interviewType` | Lee `backendData.type` | Usa `i.type` | ❌ MISMATCH |
| Valor esperado | `"FAMILY"`, `"CYCLE_DIRECTOR"` | `undefined` → `"INDIVIDUAL"` (default) | Busca `"FAMILY"`, `"CYCLE_DIRECTOR"` | ❌ NO ENCUENTRA |

**Resultado**: Las entrevistas no se encuentran porque:
1. Backend envía `interviewType: "FAMILY"`
2. Frontend lee `backendData.type` (que es `undefined`)
3. Asigna valor por defecto `InterviewType.INDIVIDUAL`
4. Búsqueda `i.type === 'FAMILY'` falla
5. Se muestra "No programada"

### 3.2 Otros Campos Analizados

| Campo | Backend | Frontend Mapping | Estado |
|-------|---------|------------------|--------|
| `scheduledDate` | `"2025-10-20"` | ✅ Correcto | ✅ OK |
| `scheduledTime` | `"09:00:00"` | ✅ Correcto | ✅ OK |
| `status` | `"SCHEDULED"` | ✅ Correcto | ✅ OK |
| `interviewerName` | `"María López"` | ✅ Correcto | ✅ OK |
| `studentName` | `"Juan Pérez González"` | ✅ Correcto | ✅ OK |
| `applicationId` | `1` | ✅ Correcto | ✅ OK |

---

## 4. EVIDENCIA DEL PROBLEMA

### 4.1 Logs del Backend
```
Debug: 2 entrevistas cargadas
- ID 9: type='FAMILY', scheduled_date='2025-10-20', scheduled_time='09:00:00', status='SCHEDULED'
- ID 17: type='CYCLE_DIRECTOR', scheduled_date='2025-10-21', scheduled_time='09:00:00', status='SCHEDULED'
```

### 4.2 Respuesta Real del Backend
```json
{
  "success": true,
  "data": [
    {
      "id": 9,
      "applicationId": 1,
      "interviewType": "FAMILY",  // ← Backend envía este campo
      "scheduledDate": "2025-10-20",
      "status": "SCHEDULED"
    }
  ]
}
```

### 4.3 Mapeo Frontend Actual
```typescript
// interviewService.ts línea 117
type: backendData.type || InterviewType.INDIVIDUAL,  // ← Lee campo incorrecto
```

**Resultado**: `backendData.type` es `undefined` → Asigna `"INDIVIDUAL"` → No coincide con `"FAMILY"`

---

## 5. CORRECCIONES NECESARIAS

### 5.1 Corrección Principal: Frontend Mapping

**Archivo**: `/Users/jorgegangale/Library/Mobile Documents/com~apple~CloudDocs/Proyectos/Admision_MTN/Admision_MTN_front/services/interviewService.ts`

**Línea 117** - Cambiar:
```typescript
// ❌ INCORRECTO
type: backendData.type || InterviewType.INDIVIDUAL,
```

Por:
```typescript
// ✅ CORRECTO
type: backendData.interviewType || InterviewType.INDIVIDUAL,
```

### 5.2 Verificación Adicional

También verificar que en otros métodos que mapean entrevistas se use `interviewType`:

**Líneas 62-94** - Método `mapInterviewResponse`:
```typescript
// Verificar si este método también se usa
type: response.type,  // ← Verificar estructura de InterviewResponse
```

---

## 6. OPCIONES DE SOLUCIÓN

### Opción A: Corregir Frontend (RECOMENDADO)
**Ventaja**: Mínimo cambio, no afecta otros servicios
**Implementación**: 1 línea de código
**Riesgo**: Bajo

```typescript
// interviewService.ts línea 117
type: backendData.interviewType || InterviewType.INDIVIDUAL,
```

### Opción B: Cambiar Backend
**Ventaja**: Consistencia con otros campos
**Implementación**: Cambiar `interviewType` a `type` en InterviewController.js
**Riesgo**: Alto - Puede afectar otros consumidores de la API

```javascript
// InterviewController.js línea 73
type: row.type,  // en lugar de interviewType: row.type
```

### Opción C: Agregar Ambos Campos (Máxima Compatibilidad)
**Ventaja**: Retrocompatibilidad total
**Implementación**: Backend envía ambos campos
**Riesgo**: Bajo, pero redundante

```javascript
// InterviewController.js línea 73
interviewType: row.type,
type: row.type,  // agregar campo duplicado
```

**RECOMENDACIÓN**: Implementar **Opción A** (corregir frontend) ya que:
1. Es el cambio más pequeño
2. No afecta otros servicios
3. El backend ya está correcto según su propia convención
4. Otros métodos del frontend ya usan `interviewType` correctamente

---

## 7. VALIDACIÓN POST-CORRECCIÓN

Después de aplicar la corrección, verificar:

1. **Test Manual**:
```typescript
// En consola del navegador
const response = await fetch('http://localhost:8080/api/interviews?applicationId=1');
const data = await response.json();
console.log('Campo type:', data.data[0].type);           // undefined
console.log('Campo interviewType:', data.data[0].interviewType);  // "FAMILY"
```

2. **Test de Mapeo**:
```typescript
// Verificar que el mapeo funciona
const mapped = interviewService.mapBackendResponse(data.data[0]);
console.log('Tipo mapeado:', mapped.type);  // Debe ser "FAMILY"
```

3. **Test Visual**:
   - Abrir modal de estudiante con ID 1
   - Verificar que muestra "Programada" con detalles
   - Verificar fecha: "20 oct. 2025"
   - Verificar hora: "09:00:00"
   - Verificar entrevistador: nombre correcto

---

## 8. MEJORAS ADICIONALES RECOMENDADAS

### 8.1 Validación de Contratos con Zod

Agregar validación en tiempo de ejecución:

```typescript
// interviewService.ts
import { z } from 'zod';

const BackendInterviewSchema = z.object({
  id: z.number(),
  applicationId: z.number(),
  interviewType: z.enum(['FAMILY', 'CYCLE_DIRECTOR']),  // ← Validar nombre correcto
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  status: z.string(),
  // ... otros campos
});

private mapBackendResponse(backendData: any): Interview {
  // Validar estructura antes de mapear
  const validated = BackendInterviewSchema.safeParse(backendData);
  if (!validated.success) {
    console.error('❌ Schema mismatch:', validated.error.flatten());
    throw new Error('Contract violation: interview data');
  }

  return {
    type: validated.data.interviewType,  // ← Campo validado
    // ... resto del mapeo
  };
}
```

### 8.2 Tests de Contrato

Crear tests automáticos que fallen cuando el contrato cambie:

```typescript
// __tests__/interview-contract.test.ts
describe('Interview API Contract', () => {
  it('should have interviewType field in response', async () => {
    const response = await fetch('/api/interviews?applicationId=1');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data[0]).toHaveProperty('interviewType');
    expect(['FAMILY', 'CYCLE_DIRECTOR']).toContain(data.data[0].interviewType);
  });

  it('should map backend response correctly', () => {
    const backendData = {
      id: 1,
      applicationId: 1,
      interviewType: 'FAMILY',
      scheduledDate: '2025-10-20',
      scheduledTime: '09:00:00',
      status: 'SCHEDULED'
    };

    const mapped = interviewService.mapBackendResponse(backendData);
    expect(mapped.type).toBe('FAMILY');
  });
});
```

### 8.3 Documentación OpenAPI

Agregar documentación explícita del campo:

```yaml
# openapi.yaml o comentarios JSDoc
interviewType:
  type: string
  enum: [FAMILY, CYCLE_DIRECTOR, PSYCHOLOGICAL, ACADEMIC]
  description: |
    Tipo de entrevista requerida. Valores posibles:
    - FAMILY: Entrevista familiar (requiere 2 entrevistadores)
    - CYCLE_DIRECTOR: Entrevista con director de ciclo
  example: "FAMILY"
```

---

## 9. CHECKLIST DE IMPLEMENTACIÓN

- [ ] **Corrección Principal**: Cambiar `backendData.type` a `backendData.interviewType` en línea 117
- [ ] **Verificar método mapInterviewResponse**: Asegurar que también use campo correcto (líneas 62-94)
- [ ] **Test Manual**: Verificar respuesta del backend con cURL o Postman
- [ ] **Test Frontend**: Verificar mapeo en consola del navegador
- [ ] **Test Visual**: Abrir modal y confirmar que muestra "Programada"
- [ ] **Agregar Validación Zod**: Validar esquema en tiempo de ejecución
- [ ] **Crear Tests**: Tests automáticos de contrato
- [ ] **Documentar**: Actualizar comentarios JSDoc sobre el campo
- [ ] **Commit**: Mensaje claro: "fix: correct interview type field mapping from backend"

---

## 10. CONCLUSIÓN

### Problema Real
El problema NO es un desalineamiento de contratos, sino un **error de mapeo en el frontend**:
- Backend envía `interviewType` (correcto según su convención)
- Frontend lee `type` (incorrecto)

### Solución
Cambiar 1 línea de código en `interviewService.ts`:
```typescript
type: backendData.interviewType || InterviewType.INDIVIDUAL,
```

### Impacto
- **Severidad**: Alta (funcionalidad principal no funciona)
- **Complejidad**: Baja (1 línea de código)
- **Riesgo**: Bajo (corrección simple sin efectos secundarios)
- **Tiempo estimado**: 5 minutos de desarrollo + 10 minutos de testing

### Causa Raíz
Falta de validación de contratos y tests automáticos que habrían detectado este problema antes de producción.

---

**Generado por**: API Contract Guardian
**Timestamp**: 2025-10-20T00:00:00Z
