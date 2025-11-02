# Family Interview Feature - Deployment Status

**Fecha**: 2025-11-01
**Estado**: ✅ Backend y Frontend Deployados

## Resumen Ejecutivo

Se ha completado exitosamente la implementación y deployment del sistema de entrevistas familiares con preguntas condicionales basadas en el grado del estudiante.

## ✅ Completado

### 1. Backend (evaluation-service)

**Commit**: `ac971fe`
**Mensaje**: "feat(evaluation): add family interview template system with grade-based conditional questions"
**Deployment**: Railway (auto-deployment desde GitHub)

**Archivos Modificados/Creados**:
- `src/routes/evaluationRoutes.js` - 3 nuevos endpoints API
- `src/services/FamilyInterviewTemplateService.js` - Servicio de templates por grado
- `ENTREVISTA_FAMILIAS_2026_COMPLETO.json` - Template completo con texto exacto
- `FAMILY_INTERVIEW_IMPLEMENTATION_STATUS.md` - Documentación de implementación

**Nuevos Endpoints API**:

```bash
# GET - Obtener template filtrado por grado
GET /api/evaluations/family-interview-template/:grade
Headers: Authorization: Bearer <JWT_TOKEN>
Response: { success: true, data: { metadata, sections, observations, gradeRange, gradeApplied } }

# GET - Obtener respuestas guardadas
GET /api/evaluations/:evaluationId/family-interview-data
Headers: Authorization: Bearer <JWT_TOKEN>
Response: { success: true, data: {...}, score: 45 }

# PUT - Guardar respuestas (auto-calcula puntaje)
PUT /api/evaluations/:evaluationId/family-interview-data
Headers:
  - Authorization: Bearer <JWT_TOKEN>
  - x-csrf-token: <CSRF_TOKEN>
Body: { interviewData: {...} }
Response: { success: true, data: { evaluationId, totalScore, interview_data } }
```

**Características**:
- ✅ Filtrado automático de preguntas por rango de grado
- ✅ Cálculo automático de puntaje (máx 51 puntos)
- ✅ Validación de respuestas completas
- ✅ Almacenamiento en columna JSONB (PostgreSQL)
- ✅ Protección CSRF en operaciones de escritura
- ✅ Control de acceso basado en roles (ADMIN, COORDINATOR, PSYCHOLOGIST)

### 2. Frontend (familyInterviewService)

**Commit**: `7c10117`
**Mensaje**: "feat(frontend): add family interview service for grade-based template management"
**Deployment**: Vercel (auto-deployment desde GitHub)

**Archivo Creado**:
- `services/familyInterviewService.ts` - Servicio TypeScript completo

**Métodos Disponibles**:

```typescript
// Obtener template para un grado específico
const template = await familyInterviewService.getTemplateForGrade('5_BASICO');

// Cargar respuestas guardadas
const { data, score } = await familyInterviewService.getInterviewData(evaluationId);

// Guardar respuestas (auto-calcula puntaje)
const result = await familyInterviewService.saveInterviewData(evaluationId, interviewData);

// Validación del lado del cliente
const score = familyInterviewService.calculateScore(interviewData);
const validation = familyInterviewService.validateResponses(template, responses);

// Helpers
const maxScore = familyInterviewService.getMaxScore(); // 51
const formattedScore = familyInterviewService.formatScore(45); // "45/51"
const percentage = familyInterviewService.getScorePercentage(45); // 88
```

### 3. Rangos de Grado Configurados

| Rango | Grados Incluidos | Preguntas Aplicables |
|-------|------------------|----------------------|
| **PREKINDER_2BASICO** | PRE_KINDER, KINDER, 1_BASICO, 2_BASICO | Preguntas para primeros años |
| **3BASICO_4BASICO** | 3_BASICO, 4_BASICO | Preguntas para educación básica media |
| **5BASICO_3MEDIO** | 5_BASICO, 6_BASICO, 7_BASICO, 8_BASICO, I_MEDIO, II_MEDIO, III_MEDIO | Preguntas para educación superior |
| **4MEDIO** | IV_MEDIO | Preguntas específicas para último año |

### 4. Sistema de Puntaje

```
Sección 1: 10 puntos máx (4 preguntas)
Sección 2: 10 puntos máx (4 preguntas)
Sección 3: 10 puntos máx (4 preguntas)
Sección 4: 10 puntos máx (4 preguntas)
Observaciones - Checklist: 7 puntos máx (7 items, 1 punto cada uno)
Observaciones - Opinión General: 4 puntos máx
────────────────────────────────────────
TOTAL: 51 puntos máx
```

## ⏳ Pendiente

### 1. Actualización del Componente Frontend

**Archivo a Modificar**: `/components/FamilyInterviewForm.tsx` (o componente equivalente)

**Tareas Requeridas**:

```typescript
// 1. Obtener el grado del estudiante desde los datos de la aplicación
const studentGrade = application.student.gradeApplied; // e.g., "5_BASICO"

// 2. Cargar template filtrado cuando se monta el componente
useEffect(() => {
  const loadTemplate = async () => {
    const template = await familyInterviewService.getTemplateForGrade(studentGrade);
    setInterviewTemplate(template);
    // template.sections contiene SOLO las preguntas aplicables al grado
  };

  loadTemplate();
}, [studentGrade]);

// 3. Cargar respuestas existentes si ya hay una evaluación
useEffect(() => {
  if (evaluationId) {
    const loadData = async () => {
      const { data, score } = await familyInterviewService.getInterviewData(evaluationId);
      setInterviewResponses(data);
      setCurrentScore(score);
    };

    loadData();
  }
}, [evaluationId]);

// 4. Renderizar solo las preguntas aplicables
{Object.entries(interviewTemplate.sections).map(([sectionKey, sectionData]) => (
  <Section key={sectionKey}>
    <h3>{sectionData.title}</h3>
    {Object.entries(sectionData.questions).map(([questionKey, question]) => (
      <Question key={questionKey}>
        <p>{question.text}</p>
        <ScoreSelector
          options={question.rubric}
          onChange={(score) => handleScoreChange(sectionKey, questionKey, score)}
          value={interviewResponses[sectionKey]?.[questionKey]?.score}
        />
      </Question>
    ))}
  </Section>
))}

// 5. Guardar respuestas
const handleSubmit = async () => {
  try {
    const result = await familyInterviewService.saveInterviewData(
      evaluationId,
      interviewResponses
    );

    toast.success(`Entrevista guardada. Puntaje: ${result.totalScore}/51`);
  } catch (error) {
    toast.error('Error al guardar la entrevista');
  }
};
```

### 2. Testing

**Test Checklist**:

- [ ] **Test 1**: Template endpoint con diferentes grados
  ```bash
  curl -H "Authorization: Bearer TOKEN" \
    https://gateway-url/api/evaluations/family-interview-template/PRE_KINDER
  ```
  - Verificar que solo aparecen preguntas para PREKINDER_2BASICO

- [ ] **Test 2**: Template para 5_BASICO
  ```bash
  curl -H "Authorization: Bearer TOKEN" \
    https://gateway-url/api/evaluations/family-interview-template/5_BASICO
  ```
  - Verificar que aparecen preguntas para 5BASICO_3MEDIO

- [ ] **Test 3**: Template para IV_MEDIO
  ```bash
  curl -H "Authorization: Bearer TOKEN" \
    https://gateway-url/api/evaluations/family-interview-template/IV_MEDIO
  ```
  - Verificar que aparecen preguntas específicas para 4MEDIO

- [ ] **Test 4**: Guardar y recuperar datos de entrevista
  ```bash
  # Guardar
  curl -X PUT -H "Authorization: Bearer TOKEN" \
    -H "x-csrf-token: CSRF_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"interviewData": {...}}' \
    https://gateway-url/api/evaluations/123/family-interview-data

  # Recuperar
  curl -H "Authorization: Bearer TOKEN" \
    https://gateway-url/api/evaluations/123/family-interview-data
  ```
  - Verificar que el puntaje se calcula correctamente (máx 51)

- [ ] **Test 5**: Verificar texto exacto del documento Word
  - Comparar preguntas del JSON con "Entrevista Familias 2026.docx"
  - Confirmar que TODO el texto está transcrito exactamente

## 📊 Información de Deployment

### Railway (Backend)

**Proyecto**: Admision_MTN_Backend
**Ambiente**: production
**Servicio**: evaluation-service
**URL Base**: `https://evaluation-service-production.up.railway.app` (vía gateway)

**Variables de Entorno Requeridas**:
- `DATABASE_URL` - Conexión PostgreSQL
- `JWT_SECRET` - Secret para validación de tokens
- `CSRF_SECRET` - Secret para validación CSRF (debe coincidir con otros servicios)
- `NODE_ENV=production`

### Vercel (Frontend)

**Proyecto**: Admision_MTN_front
**URL**: `https://admision-mtn-frontend.vercel.app`

**Nota**: El servicio `familyInterviewService.ts` detecta automáticamente el ambiente y usa la URL correcta del gateway (Railway en producción, localhost en desarrollo).

## 🔍 Verificación de Deployment

Para verificar que el deployment está funcionando:

```bash
# 1. Verificar que el servicio está corriendo
railway logs --service evaluation-service | grep "Family interview template loaded"

# 2. Probar endpoint público (requiere autenticación)
curl https://gateway-production-url/api/evaluations/family-interview-template/5_BASICO \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Respuesta esperada:
{
  "success": true,
  "data": {
    "metadata": { "title": "Entrevista Familias 2026", ... },
    "sections": { ... },
    "observations": { ... },
    "gradeRange": "5BASICO_3MEDIO",
    "gradeApplied": "5_BASICO"
  }
}
```

## 📝 Notas Técnicas

1. **JSONB Column**: El campo `interview_data` en la tabla `evaluations` almacena las respuestas estructuradas en formato JSON.

2. **Cálculo de Puntaje**: El puntaje se calcula automáticamente tanto en el backend (al guardar) como en el frontend (para validación).

3. **CSRF Protection**: El endpoint PUT requiere un token CSRF válido obtenido desde `/api/csrf-token`.

4. **Autenticación**: Todos los endpoints requieren un JWT válido en el header `Authorization: Bearer <token>`.

5. **Roles Permitidos**: Solo usuarios con rol ADMIN, COORDINATOR o PSYCHOLOGIST pueden guardar/modificar datos de entrevista.

## 🚀 Próximos Pasos

1. **Actualizar componente frontend** para usar el nuevo servicio
2. **Realizar testing end-to-end** con diferentes grados
3. **Validar texto exacto** contra documento Word original
4. **Deploy del componente actualizado** a Vercel

## 📞 Contacto y Soporte

- **Repositorio Backend**: [GitHub - evaluation-service]
- **Repositorio Frontend**: [GitHub - Admision_MTN_front]
- **Documentación Adicional**: Ver `FAMILY_INTERVIEW_IMPLEMENTATION_STATUS.md`
