# ESTADO DEL SISTEMA - ROLLBACK PRE-INTERVIEW-CANCELLATION

**Fecha de creación:** 2025-11-03 20:19 CLT
**Commit de rollback:** 476fc0f
**Tag de Git:** `rollback-pre-interview-cancellation`
**Backup de base de datos:** `backups/backup-pre-interview-cancellation-20251103-201934.backup` (114KB)

---

## 1. INFORMACIÓN DE ROLLBACK

### Punto de Restauración

Este documento marca el estado estable del sistema **antes** de implementar la funcionalidad de cancelación y reagendación de entrevistas.

### ¿Cómo Revertir el Sistema?

#### Opción A: Restaurar solo el código (mantener datos nuevos)
```bash
# Crear rama temporal desde el punto de rollback
git checkout rollback-pre-interview-cancellation
git checkout -b rollback-temp-branch

# Verificar que el código es correcto
npm test  # En cada servicio

# Si todo funciona, merge a main
git checkout main
git merge rollback-temp-branch
git push origin main
```

#### Opción B: Restaurar código Y base de datos (reseteo completo)
```bash
# 1. Restaurar código
git reset --hard rollback-pre-interview-cancellation

# 2. Restaurar base de datos
PGPASSWORD=admin123 pg_restore -h localhost -U admin -d "Admisión_MTN_DB" -c -v backups/backup-pre-interview-cancellation-20251103-201934.backup

# 3. Re-deployar servicios a Railway
cd gateway-service && git push origin main
cd user-service && git push origin main
cd application-service && git push origin main
cd evaluation-service && git push origin main
cd notification-service && git push origin main
cd dashboard-service && git push origin main
cd guardian-service && git push origin main
```

---

## 2. ARQUITECTURA DEL SISTEMA

### Microservicios Desplegados

| Servicio | Puerto Local | Railway URL | Estado |
|----------|--------------|-------------|--------|
| **Gateway** | 8080 | https://gateway-service-production-a753.up.railway.app | ✅ Operativo |
| **User Service** | 8082 | Private (user-service:8080) | ✅ Operativo |
| **Application Service** | 8083 | Private (application-service:8080) | ✅ Operativo |
| **Evaluation Service** | 8084 | Private (evaluation-service:8080) | ✅ Operativo |
| **Notification Service** | 8085 | Private (notification-service:8080) | ✅ Operativo |
| **Dashboard Service** | 8086 | Private (dashboard-service:8080) | ✅ Operativo |
| **Guardian Service** | 8087 | Private (guardian-service:8080) | ✅ Operativo |

### Frontend

| Entorno | URL | Branch |
|---------|-----|--------|
| **Producción (Vercel)** | https://admision-mtn-front.vercel.app | main |
| **Desarrollo Local** | http://localhost:5173 | feature branches |

### Base de Datos

| Parámetro | Valor |
|-----------|-------|
| **Host** | localhost (local) / Railway Postgres (production) |
| **Puerto** | 5432 |
| **Nombre** | Admisión_MTN_DB |
| **Usuario** | admin |
| **Backup Location** | `/Users/jorgegangale/Desktop/MIcroservicios/backups/` |

---

## 3. VARIABLES DE ENTORNO CRÍTICAS

### Secretos Compartidos (DEBEN ser idénticos en todos los servicios)

```bash
# Generar nuevos secretos en caso de comprometer seguridad:
# CSRF_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

CSRF_SECRET=<valor-secreto-compartido>
JWT_SECRET=mtn_secret_key_2025_admissions
```

### Variables por Servicio

#### Gateway Service
```bash
NODE_ENV=production
PORT=8080

# Private Networking URLs (Railway)
USER_SERVICE_URL=http://user-service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080

# CORS
CORS_ORIGIN=https://admision-mtn-front.vercel.app
FRONTEND_URL=https://admision-mtn-front.vercel.app
```

#### User Service
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=mtn_secret_key_2025_admissions
CSRF_SECRET=<mismo-valor-que-otros-servicios>
```

#### Application Service
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
CSRF_SECRET=<mismo-valor-que-otros-servicios>
JWT_SECRET=mtn_secret_key_2025_admissions

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES=5
UPLOAD_DIR=./uploads
```

#### Evaluation Service
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
CSRF_SECRET=<mismo-valor-que-otros-servicios>
JWT_SECRET=mtn_secret_key_2025_admissions
```

#### Notification Service
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=mtn_secret_key_2025_admissions

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<email@gmail.com>
SMTP_PASSWORD=<app-password>

# Twilio (SMS) - Opcional
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=<numero>
```

#### Dashboard Service
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=mtn_secret_key_2025_admissions

# Cache
CACHE_ENABLED=true
CACHE_TTL_GENERAL=180000  # 3 minutos
CACHE_TTL_DETAILED=300000  # 5 minutos
```

#### Guardian Service
```bash
NODE_ENV=production
PORT=8080
DATABASE_URL=${{Postgres.DATABASE_URL}}
CSRF_SECRET=<mismo-valor-que-otros-servicios>
JWT_SECRET=mtn_secret_key_2025_admissions
```

---

## 4. FUNCIONALIDADES OPERATIVAS

### Sistema de Entrevistas (Estado Actual)

#### Tipos de Entrevista Implementados
- ✅ **FAMILY** - Entrevista familiar (requiere 2 evaluadores)
- ✅ **CYCLE_DIRECTOR** - Entrevista con Director de Ciclo (1 evaluador)
- ✅ **INDIVIDUAL** - Entrevista individual con estudiante (1 evaluador)

#### Flujo de Asignación de Entrevistas
1. Admin/Coordinador selecciona tipo de entrevista
2. Sistema carga evaluadores disponibles según tipo
3. Admin selecciona fecha
4. Sistema muestra horarios disponibles (o comunes para FAMILY)
5. Admin selecciona hora y asigna evaluadores
6. Sistema valida disponibilidad y crea entrevista
7. Notificaciones enviadas a evaluadores y apoderado

#### Prevención de Duplicados
- ✅ Validación backend: evita múltiples evaluaciones del mismo tipo por applicación
- ✅ Validación frontend: UI deshabilitada para evaluaciones ya asignadas
- ✅ Códigos de error: 409 Conflict para duplicados

#### Problemas Resueltos Recientemente
- ✅ **Race condition** en carga de horarios (AbortController + debouncing implementado)
- ✅ **Llamadas API duplicadas** entre componentes padre e hijo (props unidireccionales)
- ✅ **Validación de documentos** (sincronización entre código y base de datos)
- ✅ **created_at NULL constraints** (INSERT statements actualizados)

### Funcionalidades NO Implementadas (Próximamente)
- ❌ Cancelación de entrevistas
- ❌ Reagendación de entrevistas
- ❌ Historial de cambios de entrevistas
- ❌ Notificaciones de cancelación/reagendación

---

## 5. SCHEMA DE BASE DE DATOS

### Tablas Principales

#### students
```sql
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  rut VARCHAR(12) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  paternal_last_name VARCHAR(100) NOT NULL,
  maternal_last_name VARCHAR(100),
  birth_date DATE NOT NULL,
  gender VARCHAR(20) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  grade_applied VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL,  -- ⚠️ NO DEFAULT VALUE
  updated_at TIMESTAMP
);
```

#### applications
```sql
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  father_id INTEGER REFERENCES parents(id),
  mother_id INTEGER REFERENCES parents(id),
  guardian_id INTEGER REFERENCES guardians(id),
  supporter_id INTEGER REFERENCES supporters(id),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED', 'EVALUATED', 'APPROVED', 'REJECTED', 'ENROLLED', 'ARCHIVED')),
  submission_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL,  -- ⚠️ NO DEFAULT VALUE
  updated_at TIMESTAMP
);
```

#### interviews
```sql
CREATE TABLE interviews (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  interview_type VARCHAR(50) NOT NULL CHECK (interview_type IN ('FAMILY', 'CYCLE_DIRECTOR', 'INDIVIDUAL')),
  interviewer_id INTEGER REFERENCES users(id),  -- Primer evaluador
  second_interviewer_id INTEGER REFERENCES users(id),  -- Segundo evaluador (solo FAMILY)
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX idx_interviews_application_id ON interviews(application_id);
CREATE INDEX idx_interviews_interviewer_id ON interviews(interviewer_id);
CREATE INDEX idx_interviews_second_interviewer_id ON interviews(second_interviewer_id);
CREATE INDEX idx_interviews_scheduled_date ON interviews(scheduled_date);
```

#### evaluations
```sql
CREATE TABLE evaluations (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  evaluator_id INTEGER REFERENCES users(id),
  evaluation_type VARCHAR(50) NOT NULL CHECK (evaluation_type IN ('ACADEMIC', 'PSYCHOLOGICAL', 'FAMILY')),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  score DECIMAL(5,2),
  max_score DECIMAL(5,2) DEFAULT 100,
  comments TEXT,
  evaluation_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  UNIQUE (application_id, evaluation_type)  -- ⚠️ Previene duplicados
);
```

#### interviewer_schedules
```sql
CREATE TABLE interviewer_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  available_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE INDEX idx_interviewer_schedules_user_date ON interviewer_schedules(user_id, available_date);
```

#### documents
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL CHECK (document_type IN ('BIRTH_CERTIFICATE', 'GRADES_2023', 'GRADES_2024', 'GRADES_2025_SEMESTER_1', 'PERSONALITY_REPORT_2024', 'PERSONALITY_REPORT_2025_SEMESTER_1', 'STUDENT_PHOTO', 'BAPTISM_CERTIFICATE', 'PREVIOUS_SCHOOL_REPORT', 'MEDICAL_CERTIFICATE', 'PSYCHOLOGICAL_REPORT')),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  uploaded_by INTEGER REFERENCES users(id),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,  -- ⚠️ NO DEFAULT VALUE
  updated_at TIMESTAMP
);

CREATE INDEX idx_documents_application_id ON documents(application_id);
```

### Constraints Críticos

**⚠️ IMPORTANTE: created_at sin DEFAULT VALUE**

Varias tablas tienen `created_at TIMESTAMP NOT NULL` **sin DEFAULT**, lo que requiere especificarlo explícitamente en los INSERT:

```sql
-- ✅ CORRECTO
INSERT INTO students (..., created_at) VALUES (..., NOW());

-- ❌ INCORRECTO (Fallará con "null value violates not-null constraint")
INSERT INTO students (...) VALUES (...);
```

**Tablas afectadas:**
- students
- documents
- applications (algunos campos)

---

## 6. CIRCUIT BREAKERS

### Configuraciones Actuales

| Tipo | Timeout | Error Threshold | Reset Time | Uso |
|------|---------|-----------------|------------|-----|
| **Simple** | 2s | 60% | 20s | Consultas rápidas (lookups simples) |
| **Medium** | 5s | 50% | 30s | Queries estándar con JOINs, autenticación |
| **Write** | 3s | 30% | 45s | Operaciones de escritura críticas |
| **External** | 8s | 70% | 120s | Servicios externos (SMTP, Twilio, otros microservicios) |

### Estados del Circuit Breaker
- **CLOSED (normal)** - Operaciones fluyen normalmente
- **OPEN (fallando)** - Operaciones bloqueadas, falla rápido
- **HALF_OPEN (testing)** - Probando recuperación

---

## 7. ENDPOINTS PROTEGIDOS CON CSRF

### User Service (3 endpoints)
```
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
```

### Application Service (6 endpoints)
```
POST   /api/applications
PUT    /api/applications/:id
DELETE /api/applications/:id
POST   /api/documents
PUT    /api/documents/:id
DELETE /api/documents/:id
```

### Evaluation Service (18 endpoints)
```
POST   /api/evaluations
PUT    /api/evaluations/:id
DELETE /api/evaluations/:id
POST   /api/interviews
PUT    /api/interviews/:id
DELETE /api/interviews/:id
POST   /api/interviewer-schedules
PUT    /api/interviewer-schedules/:id
DELETE /api/interviewer-schedules/:id
... (9 endpoints más)
```

### Guardian Service (3 endpoints)
```
POST   /api/guardians
PUT    /api/guardians/:id
DELETE /api/guardians/:id
```

**Total: 30 endpoints protegidos con CSRF**

---

## 8. LOGS Y MONITOREO

### Ubicación de Logs

#### Local (Winston)
```
logs/user-service.log
logs/user-service-error.log
logs/application-service.log
logs/application-service-error.log
logs/evaluation-service.log
logs/evaluation-service-error.log
logs/notification-service.log
logs/notification-service-error.log
logs/dashboard-service.log
logs/dashboard-service-error.log
logs/guardian-service.log
logs/guardian-service-error.log
```

#### Railway
```bash
# Ver logs en tiempo real
railway logs --service <service-name>

# Ver logs de todos los servicios
railway logs

# Filtrar por error
railway logs --service evaluation-service 2>&1 | grep -i error
```

### Health Checks

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Cada servicio expone este endpoint |
| `GET /gateway/status` | Gateway muestra estado de todos los servicios |

---

## 9. TESTING

### Tests Implementados

- **Unit tests**: Lógica de negocio en services/ (Jest)
- **Integration tests**: Endpoints con base de datos de prueba
- **Manual testing**: Flujos end-to-end con Postman/UI

### Comandos de Testing

```bash
# Ejecutar tests
cd <service-name>
npm test

# Con coverage
npm test -- --coverage

# Watch mode (desarrollo)
npm run test:watch
```

---

## 10. DEPLOYMENT WORKFLOW

### Workflow Actual (Producción)

```bash
# 1. Cambios en código
git add .
git commit -m "feat(service): descripción del cambio"

# 2. Push a GitHub (activa auto-deploy en Railway)
git push origin main

# 3. Railway detecta cambio y redeploya automáticamente

# 4. Verificar deployment
railway logs --service <service-name>

# 5. Probar en Vercel (frontend se conecta a Railway backend)
```

### Workflow Recomendado (Safe Development)

```bash
# 1. Crear feature branch
git checkout -b feature/nueva-funcionalidad

# 2. Desarrollar y testear localmente
npm run dev  # En cada servicio
npm test     # Ejecutar tests

# 3. Push a feature branch
git push origin feature/nueva-funcionalidad

# 4. Vercel automáticamente crea Preview Deployment
#    URL: https://admision-mtn-front-<branch-name>.vercel.app

# 5. Probar en preview deployment (apunta al mismo Railway backend)

# 6. Si todo funciona, crear Pull Request y merge a main
git checkout main
git merge feature/nueva-funcionalidad
git push origin main

# 7. Railway redeploya main automáticamente
```

---

## 11. DEPENDENCIAS CLAVE

### Backend (Común a todos los microservicios)

```json
{
  "express": "^4.18.2",
  "pg": "^8.11.0",
  "dotenv": "^16.0.3",
  "cors": "^2.8.5",
  "winston": "^3.11.0",
  "opossum": "^8.1.3",  // Circuit Breaker
  "joi": "^17.11.0",    // Validation
  "jsonwebtoken": "^9.0.2"
}
```

### Específicas por Servicio

- **Application Service**: `multer` (file uploads)
- **Notification Service**: `nodemailer`, `twilio`
- **Evaluation Service**: `handlebars` (email templates)
- **Dashboard Service**: `SimpleCache` (custom, in-memory)

### Frontend

```json
{
  "react": "^19.1.0",
  "typescript": "^5.7.2",
  "vite": "^6.2.0",
  "react-router": "^7.6.0",
  "@tanstack/react-query": "^5.90.0",
  "axios": "^1.11.0",
  "tailwindcss": "^3.4.0"
}
```

---

## 12. CONFIGURACIÓN DE RAILWAY

### Railway.toml (Común a todos los servicios excepto Gateway)

```toml
[build]
builder = "DOCKERFILE"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Gateway Railway.toml

```toml
[build]
builder = "DOCKERFILE"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[service]
internal_port = 8080  # Expone puerto público
```

### Private Networking

- ✅ Habilitado en el proyecto Railway
- ✅ Todos los servicios en el mismo proyecto
- ✅ DNS interno: `<service-name>:8080`
- ✅ NO usar `.railway.internal` suffix

---

## 13. NOTAS IMPORTANTES

### Seguridad

1. **CSRF_SECRET** y **JWT_SECRET** DEBEN ser idénticos en todos los servicios con CSRF
2. Nunca commitear `.env` files a Git
3. Usar secrets management de Railway para producción
4. Rotar secretos cada 90 días mínimo

### Performance

1. **Connection Pooling** configurado en todos los servicios (max 20 conexiones)
2. **Circuit Breakers** evitan cascadas de fallos
3. **SimpleCache** en Dashboard Service (TTL 3-15 minutos)
4. **Keepalive** en Gateway (32 conexiones, 100 requests/conn, 60s timeout)

### Bugs Conocidos (Resueltos)

- ✅ Race condition en horarios de entrevistas (AbortController implementado)
- ✅ Llamadas API duplicadas (props unidireccionales)
- ✅ Validación de document_type (sincronizada con DB constraint)
- ✅ created_at NULL errors (INSERT statements actualizados)

### Limitaciones Actuales

- ❌ No hay cancelación de entrevistas
- ❌ No hay reagendación de entrevistas
- ❌ No hay historial de cambios (interview_history table no existe)
- ❌ Notificaciones solo se envían al crear entrevista, no al modificar

---

## 14. CONTACTOS Y RECURSOS

### Documentación

- **CLAUDE.md** - Guía completa de desarrollo
- **CSRF_IMPLEMENTATION_SUMMARY.md** - Resumen ejecutivo CSRF
- **RAILWAY_DEPLOYMENT_CSRF.md** - Guía de deployment Railway
- **FASE-0-ANALISIS.md** - Análisis arquitectura completo

### Plataformas

- **Railway Dashboard**: https://railway.app
- **Vercel Dashboard**: https://vercel.com
- **GitHub Repo**: (especificar URL del repositorio)

### Comandos de Emergencia

```bash
# Rollback completo a este punto
git reset --hard rollback-pre-interview-cancellation

# Ver estado de todos los servicios Railway
railway status

# Re-deployar todos los servicios
for service in gateway-service user-service application-service evaluation-service notification-service dashboard-service guardian-service; do
  cd $service && git push origin main && cd ..
done

# Restaurar base de datos
PGPASSWORD=admin123 pg_restore -h localhost -U admin -d "Admisión_MTN_DB" -c -v backups/backup-pre-interview-cancellation-20251103-201934.backup
```

---

**Fin del documento de estado del sistema**
**Última actualización:** 2025-11-03 20:19 CLT
**Autor:** Claude Code (via jorge gangale)
