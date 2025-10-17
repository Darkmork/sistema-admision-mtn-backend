# Evaluation Service

Microservicio de evaluaciones académicas y entrevistas - Sistema de Admisión MTN

## Descripción

Maneja toda la lógica relacionada con:
- Evaluaciones académicas (exámenes de lenguaje, matemáticas, inglés, etc.)
- Entrevistas (familiar, estudiante, director)
- Asignación de evaluadores/entrevistadores
- Gestión de horarios y disponibilidad
- Seguimiento de resultados

## Tecnologías

- Node.js 18+, Express 5.1.0, PostgreSQL, Opossum (Circuit Breakers), Joi (Validation), Winston (Logging)

## API Endpoints (12 Total)

### Evaluations (6)
- GET /api/evaluations - Listar evaluaciones
- GET /api/evaluations/:id - Obtener por ID
- POST /api/evaluations - Crear evaluación (ADMIN/TEACHER/PSYCHOLOGIST/CYCLE_DIRECTOR)
- PUT /api/evaluations/:id - Actualizar (ADMIN/TEACHER/PSYCHOLOGIST/CYCLE_DIRECTOR)
- DELETE /api/evaluations/:id - Eliminar (ADMIN)
- GET /api/evaluations/application/:applicationId - Por postulación

### Interviews (6)
- GET /api/interviews - Listar entrevistas
- GET /api/interviews/:id - Obtener por ID
- POST /api/interviews - Agendar entrevista (ADMIN/COORDINATOR/CYCLE_DIRECTOR)
- PUT /api/interviews/:id - Actualizar (ADMIN/COORDINATOR/CYCLE_DIRECTOR)
- DELETE /api/interviews/:id - Eliminar (ADMIN)
- GET /api/interviews/application/:applicationId - Por postulación

## Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev

# Verificar
curl http://localhost:8084/health
```

## Variables de Entorno

```bash
PORT=8084
DB_HOST=localhost
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123
JWT_SECRET=your_secret
```

## Características

✅ Arquitectura en capas (Routes → Controllers → Services → Models)
✅ Connection pooling PostgreSQL (20 conexiones)
✅ Circuit Breakers (4 tipos)
✅ JWT Authentication + RBAC
✅ Validación con Joi
✅ Logging con Winston
✅ Docker multi-stage build
✅ Graceful shutdown
✅ Health check endpoint

## Scripts

```bash
npm start       # Producción
npm run dev     # Desarrollo con auto-reload
npm test        # Tests
npm run lint    # ESLint
```

## Licencia

ISC
