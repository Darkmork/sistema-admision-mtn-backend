# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **microservices-based admission system** for Colegio Monte Tabor y Nazaret (MTN). The system manages student applications, evaluations, interviews, notifications, and administrative dashboards through 7 independent services orchestrated by an NGINX API gateway.

## Microservices Architecture

### Service Topology

```
NGINX Gateway (Port 8080)
├── User Service (Port 8082) - Authentication & user management
├── Application Service (Port 8083) - Student applications & documents
├── Evaluation Service (Port 8084) - Academic evaluations & interviews
├── Notification Service (Port 8085) - Email & SMS notifications
├── Dashboard Service (Port 8086) - Analytics & metrics
└── Guardian Service (Port 8087) - Guardian management

All services connect to PostgreSQL DB: "Admisión_MTN_DB" (Port 5432)
```

### Service Responsibilities

- **Gateway Service**: Express.js API gateway with http-proxy-middleware, path-based routing, CORS, and health monitoring
  - **Note**: Originally designed for NGINX, currently using Express for simpler development/deployment
  - NGINX configuration files remain in `gateway-service/config/nginx.conf` for production use
- **User Service**: JWT authentication, user CRUD, role-based access control (RBAC)
- **Application Service**: Application CRUD, document upload/approval, file management (Multer)
- **Evaluation Service**: Academic evaluations, interview scheduling, result tracking
- **Notification Service**: Email (SMTP/Handlebars templates), SMS (Twilio), notification history
- **Dashboard Service**: Real-time statistics, analytics, in-memory caching, admin metrics
- **Guardian Service**: Guardian/family management, relationship tracking

## Development Commands

### Starting Services

Each service can be started individually:

```bash
# Start in development mode (auto-reload with nodemon)
cd <service-name>
npm run dev

# Start in production mode
npm start

# Health check
curl http://localhost:<PORT>/health
```

Service ports:
- Gateway: 8080
- User: 8082
- Application: 8083
- Evaluation: 8084
- Notification: 8085
- Dashboard: 8086
- Guardian: 8087

### Gateway Management

**Current Setup: Express.js Gateway**

```bash
cd gateway-service

# Start Express gateway (development)
npm run dev

# Start in production
npm start

# Health check
curl http://localhost:8080/health
```

**Express Gateway Configuration** (`gateway-service/src/server.js`):
- Path-based routing with `http-proxy-middleware`
- Routes defined in route configuration files
- Automatic path rewriting (strips `/api/xyz` prefix, restores it for backend)
- CORS enabled for all origins in development

**Alternative: NGINX Gateway** (production-ready, not currently active)

```bash
cd gateway-service

# Start NGINX gateway
./scripts/start-gateway.sh
# OR manually: nginx -c "$(pwd)/config/nginx.conf"

# Stop gateway
./scripts/stop-gateway.sh
# OR manually: nginx -s stop

# Reload configuration (zero downtime)
nginx -s reload

# Test configuration
nginx -t -c "$(pwd)/config/nginx.conf"
```

**Health Check Tools**:
```bash
# Check all backend services
node src/health-check.js

# Continuous monitoring
node src/health-check.js --monitor
```

### Testing

Most services use Jest for testing:

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

### Linting

Services with ESLint configured:

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

### Docker

Each service has Dockerfile and docker-compose.yml:

```bash
# Build service image
docker build -t <service-name> .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f <service-name>

# Stop services
docker-compose down
```

## Architecture Patterns

### Layered Architecture (Separation of Concerns)

All services follow this structure:

```
src/
├── config/           # Database & circuit breaker configuration
├── routes/           # HTTP endpoint definitions
├── controllers/      # Request/response handlers
├── services/         # Business logic (pure functions)
├── models/           # Data models with camelCase ↔ snake_case conversion
├── middleware/       # Authentication, validation, CSRF, file upload
├── utils/            # Logger, helpers, validators
├── exceptions/       # Custom error classes
├── app.js            # Express app configuration
└── server.js         # Entry point with graceful shutdown
```

**Key principle**: Routes → Controllers → Services → Models → Database

### Shared Utilities

The project includes a `/shared` directory with reusable components:

```
shared/
├── config/
│   └── circuitBreaker.js    # Shared circuit breaker configurations
├── middleware/
│   └── cors.js               # Shared CORS configuration
└── utils/
    └── SimpleCache.js        # In-memory cache class with TTL
```

**Note**: While a shared directory exists, most services currently duplicate utilities (logger, responseHelpers) within their own `src/utils/` folders. Consider consolidating common utilities into the shared directory for consistency.

### Database Configuration

All services use PostgreSQL with **connection pooling**:

```javascript
// Priority: DATABASE_URL (Railway/production) > individual env vars (local)
const dbPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ... })
  : new Pool({ host, port, database, user, password, ... });

// Configuration:
// - max: 20 connections
// - idleTimeoutMillis: 30000 (30s)
// - connectionTimeoutMillis: 2000 (2s)
// - query_timeout: 5000 (5s, adjustable per circuit breaker)
```

**Important**: Always use `dbPool.query()` wrapped in circuit breakers.

### Circuit Breakers (Opossum)

All services implement 4 types of circuit breakers for resilience:

| Type | Timeout | Error Threshold | Reset Time | Usage |
|------|---------|-----------------|------------|-------|
| **Simple** | 2s | 60% | 20s | Fast lookups, simple queries |
| **Medium** | 5s | 50% | 30s | Standard queries with joins, auth operations |
| **Write** | 3s | 30% | 45s | Critical write operations (strict) |
| **External** | 8s | 70% | 120s | External services (SMTP, Twilio, other microservices) |

**Usage pattern**:
```javascript
const result = await mediumQueryBreaker.fire(async () => {
  return await dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
});
```

**Circuit breaker states**: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED

### Authentication & Authorization

- **JWT-based authentication**: User Service issues tokens (24h expiration)
- **RBAC roles**: ADMIN, COORDINATOR, APODERADO, TEACHER, PSYCHOLOGIST, CYCLE_DIRECTOR
- **Mock auth middleware** (development): `src/middleware/auth.js`
- **Protected routes**: Use `requireRole(['ADMIN', 'COORDINATOR'])` middleware

Example:
```javascript
router.put('/:id', requireRole(['ADMIN', 'COORDINATOR']), controller.update);
```

### CSRF Protection

**Status**: Implemented in 4 services (User, Application, Evaluation, Guardian)

- **Pattern**: Stateless CSRF tokens with HMAC-SHA256 validation
- **Token format**: `timestamp.signature`
- **Expiration**: 1 hour
- **Header**: `x-csrf-token`
- **Protected methods**: POST, PUT, PATCH, DELETE
- **Safe methods**: GET, OPTIONS (no CSRF required)

**Middleware implementation** (`src/middleware/csrfMiddleware.js`):
```javascript
const { generateCsrfToken, validateCsrf } = require('./csrfMiddleware');

// Get token endpoint (public)
router.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken();
  res.json({ success: true, csrfToken: token, expiresIn: 3600 });
});

// Protected routes (JWT + CSRF)
router.post('/', authenticate, validateCsrf, requireRole(['ADMIN']), controller.create);
```

**Environment variable** (CRITICAL):
- `CSRF_SECRET` - Must be identical across all services
- Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

**Defense in depth order**:
```
authenticate → validateCsrf → requireRole → validate → controller
```

### File Upload (Multer)

Application Service handles file uploads (`application-service/src/middleware/upload.js`):

```javascript
// Supported formats: PDF, JPG, PNG, GIF, DOC, DOCX
// Max file size: 10MB
// Max files per request: 5
// Storage: ./uploads/ directory
// Filename sanitization: automatic
```

**CRITICAL: Document Type Validation**

Document types MUST match the database CHECK constraint. The allowed types are defined in two places that **must be synchronized**:

1. **Application Code** (`application-service/src/middleware/upload.js` lines 62-75):
```javascript
const VALID_DOCUMENT_TYPES = [
  'BIRTH_CERTIFICATE',
  'GRADES_2023',
  'GRADES_2024',
  'GRADES_2025_SEMESTER_1',
  'PERSONALITY_REPORT_2024',
  'PERSONALITY_REPORT_2025_SEMESTER_1',
  'STUDENT_PHOTO',
  'BAPTISM_CERTIFICATE',
  'PREVIOUS_SCHOOL_REPORT',
  'MEDICAL_CERTIFICATE',
  'PSYCHOLOGICAL_REPORT'
];
```

2. **Database Constraint** (Check with: `\d+ documents` in psql):
```sql
CHECK (document_type IN ('BIRTH_CERTIFICATE', 'GRADES_2023', 'GRADES_2024', ...))
```

**Common Pitfall**: If you add a new document type to the application code but forget to update the database constraint (or vice versa), uploads will fail with:
- Application validation error: "Invalid document type"
- Database constraint error: "violates check constraint documents_document_type_check"

**When adding new document types**:
1. Update `VALID_DOCUMENT_TYPES` array in `upload.js`
2. Update database CHECK constraint:
   ```sql
   ALTER TABLE documents DROP CONSTRAINT documents_document_type_check;
   ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
     CHECK (document_type IN ('BIRTH_CERTIFICATE', 'NEW_TYPE', ...));
   ```
3. Test upload with new type before deploying

### Logging (Winston)

All services use structured logging:

```javascript
const logger = require('./utils/logger');

logger.info('Message', { metadata });
logger.error('Error occurred', error);
logger.warn('Warning');
logger.debug('Debug info');
```

Logs are saved to:
- `logs/<service-name>.log` - All logs
- `logs/<service-name>-error.log` - Errors only
- Console output in development

### Response Standardization

Use helper functions for consistent API responses:

```javascript
const { ok, page, fail } = require('./utils/responseHelpers');

// Success
return ok(res, data, meta);

// Paginated
return page(res, data, total, currentPage);

// Error
return fail(res, 'ERROR_CODE', 'Message', 400);
```

Response format:
```json
{
  "success": true,
  "data": {...},
  "meta": { "timestamp": "..." }
}
```

### Data Model Conventions

- **Database**: snake_case (student_first_name)
- **API/JavaScript**: camelCase (studentFirstName)
- **Conversion**: Models include `toJSON()` and `fromDB()` methods

Example:
```javascript
class Application {
  static fromDB(row) {
    return {
      id: row.id,
      studentFirstName: row.student_first_name,
      // ... convert all fields
    };
  }
}
```

### Environment Variables

**Required for all services**:
```bash
# Server
PORT=<service-port>
NODE_ENV=development|production

# Database (Railway uses DATABASE_URL, local uses individual vars)
DATABASE_URL=postgresql://user:pass@host:port/db
# OR
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123

# JWT
JWT_SECRET=your_secret_key

# CORS
CORS_ORIGIN=http://localhost:5173
```

**Service-specific**:
- **All services with CSRF**: `CSRF_SECRET` (User, Application, Evaluation, Guardian)
- **Notification Service**: SMTP_HOST, SMTP_USER, SMTP_PASSWORD, TWILIO_* (SMS)
- **Application Service**: MAX_FILE_SIZE, MAX_FILES, UPLOAD_DIR
- **Dashboard Service**: CACHE_ENABLED, CACHE_TTL_*

## Gateway Configuration

### Current Setup: Express Gateway Routing

**Active Configuration**: The system currently uses Express.js with `http-proxy-middleware` for routing.

Routes are configured in `gateway-service/src/routes/` directory with automatic service URL detection:

```javascript
// Example: gateway-service/src/routes/applicationRoutes.js
const { createProxyMiddleware } = require('http-proxy-middleware');

const applicationProxy = createProxyMiddleware({
  target: process.env.APPLICATION_SERVICE_URL || 'http://localhost:8083',
  changeOrigin: true,
  pathRewrite: {
    '^/api/applications': '/api/applications',  // Restore path after Express strips it
    '^/api/documents': '/api/documents'
  }
});

module.exports = (app) => {
  app.use('/api/applications', applicationProxy);
  app.use('/api/documents', applicationProxy);
};
```

**Key Express Gateway Features**:
- **Path-based routing**: Each `/api/*` path routes to the appropriate service
- **Automatic path rewriting**: Express strips the matched path, middleware restores it
- **Environment-based URLs**: Falls back to localhost for local development
- **Error handling**: 502 responses when backend services are unreachable

### Alternative: NGINX Routing (Production-Ready)

Routes are defined in `gateway-service/config/nginx.conf`:

```nginx
location /api/auth { proxy_pass http://user-service; }
location /api/users { proxy_pass http://user-service; }
location /api/applications { proxy_pass http://application-service; }
location /api/documents { proxy_pass http://application-service; }
location /api/evaluations { proxy_pass http://evaluation-service; }
location /api/interviews { proxy_pass http://evaluation-service; }
location /api/notifications { proxy_pass http://notification-service; }
location /api/dashboard { proxy_pass http://dashboard-service; }
location /api/analytics { proxy_pass http://dashboard-service; }
location /api/guardians { proxy_pass http://guardian-service; }
```

### Timeouts & Rate Limiting

**Timeouts** (aligned with circuit breakers):
- `proxy_connect_timeout`: 3s (connect to backend)
- `proxy_read_timeout`: 8s (read response - 5s CB + 3s margin)
- `proxy_send_timeout`: 10s (send request)

**Rate limiting**:
- 20 req/s per IP (general)
- 100 req/s per JWT token (authenticated)
- Burst: 30-50 requests
- Connection limit: 10 concurrent per IP

**File uploads**: Extended timeout (30s) and 50MB max body size for `/api/documents`

### Connection Pooling

NGINX maintains keepalive connections to backends:
```nginx
keepalive 32;              # 32 connections per upstream
keepalive_requests 100;    # Reuse each connection 100 times
keepalive_timeout 60s;     # Keep alive for 60 seconds
```

## Common Development Tasks

### Adding a New Endpoint

1. **Define route** in `src/routes/<entity>Routes.js`:
```javascript
router.post('/', requireRole(['ADMIN']), controller.create);
```

2. **Create controller** in `src/controllers/<Entity>Controller.js`:
```javascript
async create(req, res) {
  const data = await service.create(req.body);
  return ok(res, data);
}
```

3. **Implement business logic** in `src/services/<Entity>Service.js`:
```javascript
async create(data) {
  return await writeOperationBreaker.fire(async () => {
    const result = await dbPool.query('INSERT INTO ...', [values]);
    return Model.fromDB(result.rows[0]);
  });
}
```

4. **Update gateway** `config/nginx.conf` if needed

### Adding a New Microservice

1. Copy structure from existing service (e.g., `evaluation-service`)
2. Update `package.json` with service name and port
3. Configure database connection in `src/config/database.js`
4. Set up circuit breakers in `src/config/circuitBreakers.js`
5. Create models, services, controllers, routes
6. Add route to NGINX `config/nginx.conf`:
```nginx
upstream new-service {
  server localhost:8088;
  keepalive 32;
}
location /api/newservice {
  proxy_pass http://new-service;
  # ... standard proxy headers
}
```
7. Update gateway health check in `src/health-check.js`

### Database Migrations

**Note**: No migration framework is currently used. Schema changes are manual.

To modify schema:
1. Connect to PostgreSQL: `psql -h localhost -U admin -d "Admisión_MTN_DB"`
2. Run DDL statements
3. Update model classes to reflect changes
4. Update seed data if needed

**CRITICAL: created_at and updated_at Fields**

Many tables have `created_at` and `updated_at` columns with NOT NULL constraints but NO DEFAULT values. This means INSERT statements MUST explicitly set these fields:

```javascript
// CORRECT - Explicitly set created_at
const result = await dbPool.query(
  `INSERT INTO students (..., created_at) VALUES (..., NOW()) RETURNING *`,
  [values]
);

// WRONG - Will fail with "null value in column created_at violates not-null constraint"
const result = await dbPool.query(
  `INSERT INTO students (...) VALUES (...) RETURNING *`,
  [values]
);
```

**Affected tables**: students, documents, applications, evaluations, interviews, etc.

**When adding new INSERT statements**:
1. Always include `created_at = NOW()` in the column list and VALUES
2. For updates, include `updated_at = NOW()`
3. Check the database schema with `\d+ table_name` to verify constraints

### Running the Full System Locally

1. **Start PostgreSQL** (ensure "Admisión_MTN_DB" exists)
2. **Start all services** (in separate terminals):
```bash
cd user-service && npm run dev
cd application-service && npm run dev
cd evaluation-service && npm run dev
cd notification-service && npm run dev
cd dashboard-service && npm run dev
cd guardian-service && npm run dev
```
3. **Start gateway**:
```bash
cd gateway-service && ./scripts/start-gateway.sh
```
4. **Verify health**:
```bash
curl http://localhost:8080/gateway/status
cd gateway-service && node src/health-check.js
```

### Troubleshooting

**Port already in use**:
```bash
lsof -ti:<PORT> | xargs kill -9
```

**Database connection issues**:
```bash
# Test connection
pg_isready -h localhost -p 5432

# Verify credentials
PGPASSWORD=admin123 psql -h localhost -U admin -d "Admisión_MTN_DB" -c "SELECT 1"
```

**NGINX not starting**:
```bash
# Test config
nginx -t -c "$(pwd)/gateway-service/config/nginx.conf"

# Kill existing NGINX
pkill -9 nginx

# Check error logs
tail -f gateway-service/logs/error.log
```

**Circuit breaker opened**:
- Check service logs for errors
- Verify database is responsive
- Wait for reset timeout (20s-120s depending on breaker type)
- Circuit breakers log state changes: grep "Circuit Breaker" in logs

**502 Bad Gateway**:
- Ensure backend service is running: `curl http://localhost:<PORT>/health`
- Check NGINX error logs
- Verify upstream configuration in `nginx.conf`

**Dashboard/Frontend only showing 10 items when more exist**:
- **Symptoms**: Professor dashboard shows 10 evaluations when 20+ are assigned, or any listing shows partial data
- **Root Cause**: Backend controller default `limit` parameter set to 10 (pagination limit)
- **Solution**: Change default `limit` from 10 to 1000 in controller methods
- **Files to check**:
  - Backend controllers: `<service>/src/controllers/*Controller.js`
  - Look for query parameter destructuring: `const { page, limit = 10 } = req.query;`
  - Frontend: Remove `.slice()` calls that limit displayed items
- **Example fix** (EvaluationController.js:114):
```javascript
// BEFORE:
const { page: pageNum = 0, limit = 10, status, evaluationType } = req.query;

// AFTER:
const { page: pageNum = 0, limit = 1000, status, evaluationType } = req.query;
```
- **Testing**: After deploying, verify the affected dashboard loads all expected items
- **Note**: This pattern was used successfully in AdminDashboard and ProfessorDashboard

## Key Technical Decisions

1. **Microservices over Monolith**: Enables independent scaling, deployment, and team ownership
2. **NGINX over Express Gateway**: Better performance, battle-tested, advanced features (rate limiting, keepalive)
3. **Connection Pooling**: Reuse DB connections for 20-30x performance improvement
4. **Circuit Breakers**: Prevent cascading failures, fail fast, automatic recovery
5. **JWT Auth**: Stateless authentication, enables horizontal scaling
6. **Multer for Files**: Industry standard, stream-based (memory efficient)
7. **Winston Logging**: Structured logs, multiple transports, production-ready
8. **No ORM**: Direct SQL for performance, full control, no abstraction overhead
9. **Joi Validation**: Schema-based, clear error messages, composable

## Testing Strategy

- **Unit tests**: Business logic in services (pure functions)
- **Integration tests**: API endpoints with test database
- **Health checks**: `/health` endpoint on every service
- **Manual testing**: Postman collections (check service README files)

Test databases should be separate from development databases.

## Production Deployment Considerations

- Set `NODE_ENV=production`
- Use `DATABASE_URL` for Railway/Heroku deployments
- Set proper `JWT_SECRET` (32+ char random string)
- Configure SSL/TLS on NGINX (port 443)
- Set strict CORS origins (no wildcards)
- Enable HTTP → HTTPS redirect
- Use environment-specific rate limits
- Monitor circuit breaker states
- Set up log aggregation (Winston → CloudWatch/Datadog)
- Configure health check intervals (30s recommended)
- Use Docker for consistent deployments

## Evaluation Assignment System

### Duplicate Prevention Pattern

The evaluation service implements a complete duplicate prevention system to ensure each student receives only one evaluation per type.

**Backend Validation** (`evaluation-service/src/services/EvaluationService.js:139-151`):
```javascript
// Check for duplicate before INSERT
const duplicateCheck = await dbPool.query(
  `SELECT id, evaluator_id, status
   FROM evaluations
   WHERE application_id = $1 AND evaluation_type = $2`,
  [applicationId, evaluationType]
);

if (duplicateCheck.rows.length > 0) {
  throw new Error(`Ya existe una evaluación de tipo ${evaluationType}...`);
}
```

**Controller Error Handling** (`evaluation-service/src/controllers/EvaluationController.js:58-61`):
```javascript
// Return 409 Conflict for duplicates instead of 500
if (error.message.includes('Ya existe una evaluación')) {
  return res.status(409).json(fail('EVAL_DUPLICATE', 'Duplicate evaluation', error.message));
}
```

**Frontend UI Blocking** (`EvaluationManagement.tsx:462-504`):
```typescript
// Load existing evaluations when modal opens
useEffect(() => {
  if (isOpen) {
    loadExistingEvaluations();
  }
}, [isOpen, application.id]);

// Disable dropdowns for already-assigned evaluations
const isAlreadyAssigned = existingEvaluations.some(
  (ev: any) => ev.evaluationType === evaluationType
);

<select disabled={isAlreadyAssigned}>
  {/* Evaluation options */}
</select>
```

**Submit Logic** (`EvaluationManagement.tsx:520-532`):
```typescript
// Filter out already-assigned evaluations before submitting
const validAssignments = assignments.filter(a => {
  const isAlreadyAssigned = existingEvaluations.some(
    (ev: any) => ev.evaluationType === a.evaluationType
  );
  return a.evaluatorId > 0 && !isAlreadyAssigned;
});
```

**Key Points**:
- Backend enforces uniqueness constraint: (application_id, evaluation_type)
- Frontend prevents UI submission of duplicates
- Backend returns 409 Conflict if duplicate attempt occurs
- Evaluations already assigned show "Ya asignado" badge and disabled dropdown

### Score Display Pattern

**CRITICAL**: Always use `evaluation.maxScore` instead of hardcoded `/100`

**Correct**:
```typescript
<p>Puntaje: {evaluation.score}/{evaluation.maxScore || 100}</p>
```

**Incorrect**:
```typescript
<p>Puntaje: {evaluation.score}/100</p>  // ❌ Wrong if teacher used different maxScore
```

**Affected Files**:
- `StudentDetailModal.tsx:1742`
- `EvaluationReports.tsx:304, 614`
- Any component displaying evaluation scores

### Response Format Extraction

**CRITICAL**: Backend uses standardized response format `{ success: true, data: [...] }`

When calling evaluation endpoints, always extract data correctly:

**Correct**:
```typescript
const response = await api.get('/api/evaluations/application/:id');
const evaluations = response.data.data || response.data;  // ✅ Handles both formats
```

**Incorrect**:
```typescript
const evaluations = response.data;  // ❌ Gets wrapper object instead of array
```

## Validation Patterns

### RUT Validation (Chilean ID)

```javascript
// Format: 12.345.678-9
const validateRUT = (rut) => {
  const cleaned = rut.replace(/[.-]/g, '');
  // ... check digit validation
};
```

### Email & Phone

```javascript
// Email: Standard RFC 5322
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Phone: Chilean format (+56 9 1234 5678)
const validatePhone = (phone) => /^\+56\s?[0-9]\s?[0-9]{4}\s?[0-9]{4}$/.test(phone);
```

### Application Status Flow

```
DRAFT → SUBMITTED → UNDER_REVIEW → INTERVIEW_SCHEDULED →
EVALUATED → APPROVED/REJECTED → ENROLLED/ARCHIVED
```

Only ADMIN/COORDINATOR can change status. Transitions are validated in service layer.

## Caching Strategy (Dashboard Service)

- **In-memory cache** with TTL (no external cache like Redis)
- **Cache keys**: `dashboard:stats:general`, `analytics:dashboard:metrics`, etc.
- **TTLs**: 3-15 minutes depending on data freshness requirements
- **Cache invalidation**: Manual via `/api/dashboard/cache/clear` (ADMIN only)
- **Hit rate target**: 70-90%

## Service Communication

Services do NOT call each other directly. All communication goes through the gateway:

```
Frontend → Gateway → Service A
                  → Service B
                  → Service C
```

Future: Consider message queue (RabbitMQ/Kafka) for async operations (notifications, etc.)

## Document Review Email Notification System

### Overview

The notification service implements a comprehensive document review email system that sends professional HTML emails to applicants when admins/coordinators review their documents.

**Key Features:**
- Professional HTML email templates with responsive design
- Three email variants based on document status
- Complete document status tracking (approved/rejected/pending)
- Sends emails to the person who created the application (applicant)
- Color-coded status badges and visual hierarchy

### Email Templates

**1. All Documents Approved (Congratulations)**
- Green gradient header with celebration message
- Table showing all documents with "APROBADO" badges
- Gold congratulations box
- Marks newly approved documents with ✨ icon
- Subject: `🎉 ¡Felicitaciones! Todos los Documentos Aprobados - Colegio MTN`

**2. Documents with Rejections (Action Required)**
- Red gradient header for attention
- Summary counters (approved/rejected/pending)
- Complete document status table with color-coded rows
- Yellow warning box indicating action required
- Subject: `⚠️ Revisión de Documentos - Acción Requerida - Colegio MTN`

**3. Only Approved Documents (Progress Update)**
- Green gradient header
- Summary counters (approved/pending)
- Professional table with status badges
- Yellow info box for pending documents
- Subject: `✅ Documentos Aprobados - Colegio MTN`

### Backend Implementation

**Endpoint**: `POST /api/institutional-emails/document-review/:applicationId`

**Location**: `/notification-service/src/routes/institutionalEmailRoutes.js` (lines 9-416)

**Request Body**:
```json
{
  "approvedDocuments": ["Certificado de Nacimiento", "Notas 2024"],
  "rejectedDocuments": ["Foto del Estudiante"],
  "allApproved": false
}
```

**Email Routing Logic**:
1. Fetches applicant information from application-service via `/api/applications/:id/contact` endpoint
2. Determines recipient email (sends ONLY to applicant who created the application)
3. Fetches all documents from database for complete status
4. Categorizes documents by status (approved/rejected/pending)
5. Selects appropriate email template based on document counts
6. Sends HTML email via SendGrid/SMTP

**CRITICAL Environment Variable**:
```bash
APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
```

This variable MUST be configured in Railway for notification-service to fetch applicant contact information.

### Frontend Integration

**Current Status**: Backend implementation complete and functional.

**Pending**: Frontend component integration to trigger document review emails when admin/coordinator approves/rejects documents in the dashboard.

**Expected Integration Point**: Admin dashboard → Student detail modal → Document review interface

### Testing Document Review Emails

**Manual Testing** (Postman/curl):
```bash
# Test document review email endpoint
curl -X POST https://gateway-service-production-a753.up.railway.app/api/institutional-emails/document-review/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "approvedDocuments": ["Certificado de Nacimiento", "Notas 2024"],
    "rejectedDocuments": ["Foto del Estudiante"],
    "allApproved": false
  }'
```

**Verify Email Sent**:
- Check notification-service logs for email delivery confirmation
- Verify recipient email address matches applicant email
- Check SendGrid dashboard for delivery status

### Public Contact Endpoint

To enable email routing, the application-service provides a public `/contact` endpoint:

**Endpoint**: `GET /api/applications/:id/contact`

**Location**: `/application-service/src/routes/applicationRoutes.js`

**Response Format**:
```json
{
  "success": true,
  "data": {
    "applicationId": 1,
    "applicantUser": {
      "email": "jorge.gangale@mail.up.cl",
      "firstName": "Jorge",
      "lastName": "Gangale"
    },
    "guardian": {
      "email": "guardian@example.com",
      "fullName": "Guardian Name"
    },
    "father": {
      "email": "father@example.com",
      "fullName": "Father Name"
    },
    "mother": {
      "email": "mother@example.com",
      "fullName": "Mother Name"
    },
    "studentName": "María González Pérez"
  }
}
```

**Note**: This endpoint is public (no authentication required) to allow notification-service to fetch contact information. It only exposes email addresses and names, no sensitive data.

### Email Design Specifications

**HTML Email Best Practices Implemented:**
- Inline CSS for maximum email client compatibility
- Responsive design (max-width: 650px)
- Professional color scheme (MTN school branding)
- Table-based layout for document status
- Clear visual hierarchy with gradients and badges
- Footer with automatic email disclaimer

**Color Palette:**
- Green (`#2d6a4f`, `#52b788`): Approved/success states
- Red (`#c9302c`, `#d73027`): Rejected/action required
- Yellow (`#ffc107`, `#856404`): Pending/warning
- Gold (`#ffd700`, `#daa520`): Congratulations
- Neutral (`#333`, `#666`, `#999`): Text and backgrounds

### Troubleshooting Email Delivery

**Issue: Emails not being sent**
1. Check `APPLICATION_SERVICE_URL` is configured in Railway
2. Verify SendGrid API key is valid
3. Check notification-service logs for errors
4. Test contact endpoint: `curl https://application-service-production.up.railway.app/api/applications/1/contact`

**Issue: Emails sent to wrong recipient**
1. Verify applicant email in database: `SELECT * FROM users WHERE id = (SELECT applicant_user_id FROM applications WHERE id = 1)`
2. Check contact endpoint returns correct applicant email
3. Review notification-service logs for recipient email address

**Issue: Email formatting broken**
1. Test email HTML in email testing tool (Litmus, Email on Acid)
2. Check for missing inline CSS styles
3. Verify table structure is valid
4. Test in multiple email clients (Gmail, Outlook, Apple Mail)

### Related Documentation

- **VERIFICACION_CORREOS_DOCUMENTOS.md** - Complete analysis of email notification system (document review vs status change emails)
- **notification-service/README.md** - Notification service documentation
- **application-service/README.md** - Application service endpoints

## Key Documentation Files

### Security & Deployment
- **CSRF_IMPLEMENTATION_SUMMARY.md** - Executive summary of CSRF implementation across 4 services
- **RAILWAY_DEPLOYMENT_CSRF.md** - Detailed Railway deployment guide for CSRF-protected services
- **FASE-0-ANALISIS.md** - Comprehensive architecture analysis and service inventory
- **VERIFICACION_CORREOS_DOCUMENTOS.md** - Document review vs status change email system analysis

### API Contracts
- **evaluation-service/contracts/** - Interview endpoint contract documentation and validation scripts
  - Contains field mapping tables, validation scripts, and migration guides
  - See "API Contract Validation" section above for details

### Service Documentation
Each service has its own README with:
- Endpoints documentation
- Environment variables
- Testing instructions
- Deployment notes

**Recent Changes (2025-10-26)**:
- **Dashboard Service 500 Error Fix** - Fixed runtime module loading issue
  - Moved logger, cache, and circuitBreakers requires to top of dashboardRoutes.js
  - Removed dynamic requires inside route handlers (anti-pattern)
  - `/admin/detailed-stats` endpoint now fully functional
  - Comprehensive dashboard statistics now loading successfully in frontend
  - Commits: `73f2cbf` (port endpoint from monolith), `3fd1a11` (fix module requires)

**Previous Changes (2025-10-25)**:
- **Frontend HTTP Client Authentication** - Added JWT token injection to all API requests
  - Fixed 401 Unauthorized errors in dashboard modal
  - HTTP client now automatically includes auth_token or professor_token from localStorage
  - Commit: `c16a20d`
- **Document Review Email System** - Professional HTML email templates for document review notifications
  - Three email variants: all approved (congratulations), mixed approved/rejected (action required), only approved (progress)
  - Complete document status tracking with color-coded badges
  - Public `/contact` endpoint for fetching applicant email
  - Configured `APPLICATION_SERVICE_URL` in Railway notification-service
  - Rollback tag created: `v1.0.0-document-review-emails`

**Previous Changes (2025-10-24)**:
- **Evaluation duplicate prevention** - Backend validates and prevents duplicate evaluation assignments (409 Conflict)
- **Evaluation assignment UI blocking** - Frontend modal loads existing evaluations and disables already-assigned types
- **MaxScore display fix** - All evaluation score displays now use actual maxScore instead of hardcoded /100
- **Response format standardization** - Fixed evaluationService.getEvaluationsByApplicationId to extract data from response.data.data

**Previous Changes (2025-10-21)**:
- **Document upload system fully functional** - Fixed document type validation alignment between code and database
- **Critical bug fixes**:
  - Added `created_at = NOW()` to DocumentService.js INSERT statements (application-service/src/services/DocumentService.js:27)
  - Synchronized VALID_DOCUMENT_TYPES in upload.js with database CHECK constraint (application-service/src/middleware/upload.js:62-75)
- **Testing**: End-to-end flow testing successful for authentication, students, applications, and document uploads (Flows 1-3B)
- **Gateway**: Express-based API gateway with path-based routing fully operational
- **Database**: All services using connection pooling with circuit breakers

**Previous Changes (2025-10-20)**:
- CSRF protection implemented in 4 services (User, Application, Evaluation, Guardian)
- 27 routes protected with CSRF validation
- Shared utilities directory created (`/shared`)
- Railway deployment configurations updated

## Railway Deployment

### Overview

The system is deployed to Railway (railway.app) using Docker containers with Private Networking for inter-service communication.

### Key Railway Concepts

**Port Configuration:**
- Railway automatically injects `PORT` environment variable (always 8080 internally)
- Local development ports (8082, 8083, etc.) are ONLY for local use
- Services listen on `0.0.0.0:${PORT}` to accept connections from Railway's proxy and private network

**Private Networking:**
- Services communicate using format: `http://service-name:8080`
- Service names MUST match exactly (case-sensitive, use underscores/hyphens consistently)
- No `.railway.internal` suffix needed (Railway handles DNS internally)
- All services must be in the same Railway project

**Database Connection:**
- Railway provides `DATABASE_URL` variable (full PostgreSQL connection string)
- Services MUST prioritize `DATABASE_URL` over individual vars for Railway deployment
- Connection pooling configured in `src/config/database.js` detects Railway automatically

### Deployment Configuration

Each service has a `railway.toml` file:

```toml
[build]
builder = "DOCKERFILE"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

# Optional: only for exposed services
[service]
internal_port = 8080
```

**Important**: Gateway uses `[service]` section to expose port 8080. Backend services don't need this.

### Environment Variables (Railway)

**Required for all services:**
```bash
NODE_ENV=production
JWT_SECRET=mtn_secret_key_2025_admissions
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway variable reference
```

**Gateway Service specific:**
```bash
# Service URLs using Private Networking
USER_SERVICE_URL=http://user_service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080
```

**CRITICAL Security Variables (must be identical across all services):**
```bash
# Generate production secrets:
# CSRF_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

CSRF_SECRET=<same-value-in-all-services>
JWT_SECRET=<same-value-in-all-services>
```

**CRITICAL**:
- Service names in URLs must match EXACTLY with Railway service names (check Railway dashboard)
- `CSRF_SECRET` and `JWT_SECRET` MUST be identical in User, Application, Evaluation, and Guardian services
- Never use development secrets in production
- Secrets should be 32+ characters (base64 encoded)

### Deploying to Railway

**1. Link GitHub Repository**
- Connect Railway project to GitHub repo
- Railway auto-deploys on push to main branch

**2. Deploy Individual Service**
```bash
cd <service-name>

# Ensure Dockerfile exists and railway.toml is configured

# Push to GitHub (triggers auto-deploy)
git add .
git commit -m "deploy: Update <service-name>"
git push origin main

# OR use Railway CLI
railway up
```

**3. Configure Environment Variables**
- Go to Railway dashboard > Service > Variables
- Add required variables (see above)
- Railway auto-redeploys when variables change

**4. Enable Private Networking**
- Go to Railway project settings
- Enable "Private Networking"
- Verify all services are in same project

**5. Generate Public Domain (if needed)**
- Only gateway-service needs public domain
- Go to Railway dashboard > gateway-service > Settings > Networking
- Click "Generate Domain"
- Backend services should NOT have public domains (security)

### Troubleshooting Railway

**Issue: Service keeps restarting**
- Check logs: `railway logs` or Railway dashboard
- Verify `DATABASE_URL` is set and valid
- Remove `healthcheckPath` from railway.toml (causes restart loops)
- Ensure service binds to `0.0.0.0:${PORT}`, not `localhost`

**Issue: Gateway can't connect to service (502 Bad Gateway)**
- Verify service name in `<SERVICE>_URL` matches Railway service name EXACTLY
- Check Private Networking is enabled
- Verify service is running: check Railway dashboard status
- Ensure service listens on port 8080 (Railway's PORT variable)
- Check gateway logs for exact error

**Issue: Database connection errors**
- Verify `DATABASE_URL` is set: `railway variables`
- Check database is running in same project
- Test connection: add debug route to print `process.env.DATABASE_URL` (remove after testing)

**Issue: "Variable not found" errors**
- Railway uses `${{Postgres.DATABASE_URL}}` syntax for variable references
- Ensure PostgreSQL plugin is added to project
- Check variable name matches exactly (case-sensitive)

**Issue: Port conflicts**
- DO NOT set `PORT` variable manually in Railway (Railway injects it automatically)
- Use `process.env.PORT || <local-port>` in code for dual local/Railway support

**Issue: "CSRF validation failed: Token missing"**
- Frontend must include `x-csrf-token` header in POST/PUT/PATCH/DELETE requests
- Obtain token from `GET /api/csrf-token` endpoint before mutations
- Verify CSRF middleware is properly applied to routes

**Issue: "CSRF validation failed: Invalid signature"**
- Ensure `CSRF_SECRET` is identical across all services in Railway
- Check that CSRF_SECRET was set before generating tokens
- If secret changed, clients must obtain new tokens

**Issue: "CSRF validation failed: Token expired"**
- Tokens expire after 1 hour
- Frontend should implement automatic token refresh
- Obtain new token from `/api/csrf-token` endpoint

### Railway Best Practices

1. **Never commit .env files** - Use Railway dashboard for production secrets
2. **Use Private Networking** - Never expose backend services publicly
3. **Service naming** - Use consistent naming (underscores or hyphens, not mixed)
4. **Health checks** - Provide `/health` endpoint, but don't use Railway's health check feature (causes restarts)
5. **Logging** - Railway captures stdout/stderr, use `console.log` or Winston
6. **Database migrations** - Run manually via Railway shell or separate migration service
7. **Resource limits** - Monitor usage in Railway dashboard (free tier has limits)

### Railway CLI Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Open shell
railway shell

# View variables
railway variables

# Deploy
railway up

# Check status
railway status
```

### Monitoring Railway Services

**Via Railway Dashboard:**
- Deployments tab: View build/deploy status
- Metrics tab: CPU, memory, network usage
- Logs tab: Real-time logs

**Via API:**
- Gateway exposes `/health` endpoint
- Returns status of all backend services
- Can be monitored by external service (UptimeRobot, etc.)

## API Contract Validation

### Overview

API contract alignment between frontend and backend is critical. Mismatches in field names or response structures can cause silent failures. The system includes contract documentation and validation tools.

### Contract Documentation Location

Contract analysis files are stored in each service's `/contracts/` directory:

```
evaluation-service/
└── contracts/
    ├── interview-contract-analysis.md    # Technical analysis
    ├── RESUMEN-EJECUTIVO.md               # Executive summary
    ├── ANTES-DESPUES.md                   # Visual before/after
    └── validate-interview-contract.js     # Validation script
```

### Common Contract Pitfalls

**Problem**: Backend and frontend use different field names
- Backend sends: `interviewType: "FAMILY"`
- Frontend expects: `type: "FAMILY"` or reads wrong field like `backendData.type`
- Result: Field is `undefined`, defaults are used, lookups fail

**Solution**: Always map backend fields explicitly in service layer:
```typescript
// CORRECT mapping
type: backendData.interviewType || InterviewType.INDIVIDUAL

// INCORRECT (silent failure)
type: backendData.type || InterviewType.INDIVIDUAL  // type doesn't exist!
```

### Validating Contracts

**Manual verification**:
```bash
# Test backend response structure
curl http://localhost:8080/api/interviews?applicationId=1 | jq

# Look for exact field names in response
```

**Automated validation script** (Evaluation Service example):
```bash
cd evaluation-service/contracts
node validate-interview-contract.js
```

The script validates:
- Connection to backend service
- Response structure matches expected format
- All required fields are present
- Field types are correct
- Enum values are valid

### Frontend-Backend Field Mapping Table

**Interviews Endpoint** (`GET /api/interviews`):

| Backend Field | Frontend Field | Type | Notes |
|--------------|----------------|------|-------|
| `interviewType` | `type` | enum | Must map explicitly |
| `scheduledDate` | `scheduledDate` | string | YYYY-MM-DD |
| `scheduledTime` | `scheduledTime` | string | HH:MM:SS |
| `interviewerId` | `interviewerId` | number | User ID |
| `interviewerName` | `interviewerName` | string | Computed from JOIN |
| `studentName` | `studentName` | string | Computed from JOIN |
| `applicationId` | `applicationId` | number | FK reference |

**Critical**: The backend uses snake_case in DB but returns camelCase in JSON. Models handle this conversion via `toJSON()` methods.

### Contract Testing Strategy

**Unit tests for field mapping** (Frontend):
```typescript
// __tests__/interview-contract.test.ts
it('should map backend interviewType to frontend type', () => {
  const backendData = { interviewType: 'FAMILY', /* ... */ };
  const mapped = interviewService.mapBackendResponse(backendData);
  expect(mapped.type).toBe('FAMILY');
});
```

**Integration tests** (Backend):
```javascript
// Should return correct field names in response
const response = await request(app).get('/api/interviews?applicationId=1');
expect(response.body.data[0]).toHaveProperty('interviewType');
expect(response.body.data[0]).not.toHaveProperty('type');
```

### Debugging Contract Issues

**Symptoms of contract mismatch**:
- Data exists in DB but shows as "not found" in UI
- Fields display as "undefined" or use default values
- Console shows `undefined` for expected values
- No error messages (silent failure)

**Debugging steps**:
1. Check browser console for actual backend response structure
2. Compare backend response fields with frontend mapping code
3. Verify field names match exactly (case-sensitive)
4. Look for typos in field names
5. Check if frontend is reading from correct nested object path

**Example debugging session**:
```typescript
// Add debug logging in frontend service
console.log('Backend response:', backendData);
console.log('Mapped type:', backendData.interviewType);  // Check field exists
console.log('Incorrect field:', backendData.type);       // Should be undefined

// Expected output:
// Backend response: { interviewType: "FAMILY", ... }
// Mapped type: "FAMILY"
// Incorrect field: undefined  ← Problem identified!
```

### Preventing Contract Issues

1. **Use TypeScript interfaces** matching backend exactly:
```typescript
interface BackendInterviewResponse {
  interviewType: InterviewType;  // Not 'type'
  scheduledDate: string;
  scheduledTime: string;
  // ... exact field names from backend
}
```

2. **Add contract validation to CI/CD**:
```bash
# In CI pipeline
npm run test:contracts
```

3. **Document API contracts** in `/contracts/` directory when making changes

4. **Version API changes** - breaking changes require new endpoint version

5. **Use Zod or similar** for runtime validation:
```typescript
import { z } from 'zod';

const BackendInterviewSchema = z.object({
  interviewType: z.enum(['FAMILY', 'CYCLE_DIRECTOR', 'INDIVIDUAL']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // ... validate all fields
});

// Will throw if contract doesn't match
const validated = BackendInterviewSchema.parse(backendData);
```

### When to Update Contract Documentation

Update `/contracts/` directory when:
- Adding new endpoints
- Changing response structure
- Adding/removing/renaming fields
- Changing field types or validation rules
- Discovering and fixing contract bugs

**Documentation should include**:
- Field mapping table (backend → frontend)
- Example requests and responses
- Validation script for automated testing
- Migration guide if breaking changes

## Frontend Integration

### CSRF Token Handling

Frontend applications must obtain and include CSRF tokens for all mutation requests (POST, PUT, PATCH, DELETE).

**1. Obtain CSRF Token:**
```javascript
const getCsrfToken = async (serviceUrl) => {
  const response = await fetch(`${serviceUrl}/api/csrf-token`);
  const data = await response.json();
  return data.csrfToken;
};
```

**2. Include in Request Headers:**
```javascript
const csrfToken = await getCsrfToken('https://application-service.railway.app');

fetch('https://application-service.railway.app/api/applications', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'x-csrf-token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(applicationData)
});
```

**3. Implement Token Caching (Recommended):**
```javascript
class CsrfTokenManager {
  constructor() {
    this.tokens = new Map(); // serviceUrl -> { token, expiry }
  }

  async getToken(serviceUrl) {
    const cached = this.tokens.get(serviceUrl);
    const now = Date.now();

    // Refresh if missing or expiring within 1 minute
    if (!cached || now > cached.expiry - 60000) {
      const response = await fetch(`${serviceUrl}/api/csrf-token`);
      const data = await response.json();

      this.tokens.set(serviceUrl, {
        token: data.csrfToken,
        expiry: now + (data.expiresIn * 1000)
      });

      return data.csrfToken;
    }

    return cached.token;
  }

  clearToken(serviceUrl) {
    this.tokens.delete(serviceUrl);
  }
}

// Usage:
const csrfManager = new CsrfTokenManager();
const token = await csrfManager.getToken('https://application-service.railway.app');
```

**4. Handle CSRF Errors:**
```javascript
async function makeRequest(url, options) {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-csrf-token': await csrfManager.getToken(serviceUrl)
    }
  });

  // Retry once if CSRF validation fails
  if (response.status === 403) {
    const error = await response.json();
    if (error.code === 'CSRF_VALIDATION_FAILED') {
      csrfManager.clearToken(serviceUrl);
      const newToken = await csrfManager.getToken(serviceUrl);

      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'x-csrf-token': newToken
        }
      });
    }
  }

  return response;
}
```

### Services Requiring CSRF Tokens

- **User Service** (Port 8082): All write operations
- **Application Service** (Port 8083): 6 protected routes (applications, documents)
- **Evaluation Service** (Port 8084): 18 protected routes (evaluations, interviews, schedules)
- **Guardian Service** (Port 8087): 3 protected routes (guardian management)

**Note**: Notification and Dashboard services currently do NOT require CSRF tokens

## Frontend Architecture Integration

### Overview

The frontend is a React + TypeScript application built with Vite, deployed on Vercel, and communicates with the Railway-hosted backend microservices through the Gateway Service.

**Frontend Stack:**
- **React 19.1** - UI framework
- **TypeScript 5.7** - Type safety
- **Vite 6.2** - Build tool & dev server
- **React Router 7.6** - Client-side routing
- **TanStack Query 5.90** - Server state management
- **Axios 1.11** - HTTP client with retry logic
- **Tailwind CSS** - Styling

**Deployment:**
- **Platform**: Vercel (Production) / Local dev (Port 5173)
- **Build**: `npm run build` → static files in `/dist`
- **Runtime**: Client-side only (no SSR)

### Frontend-Backend Communication

**Gateway URL Resolution** (`config/api.config.ts`):
```typescript
// Runtime detection (NOT build-time)
export function getApiBaseUrl(): string {
  const hostname = window.location.hostname;

  // Vercel deployment → Railway backend
  if (hostname.includes('vercel.app')) {
    return 'https://gateway-service-production-a753.up.railway.app';
  }

  // Custom production domains
  if (hostname === 'admision.mtn.cl' || hostname === 'admin.mtn.cl') {
    return 'https://gateway-service-production-a753.up.railway.app';
  }

  // Local development → Local gateway
  return 'http://localhost:8080';
}
```

**CRITICAL**: API URL is determined at **runtime in the browser**, NOT at build time. This allows a single build to work in all environments (Vercel, production domains, local dev).

### HTTP Client Architecture

**Unified HTTP Client** (`services/http.ts`):

```typescript
class HttpClient {
  // Features:
  // - Runtime base URL detection
  // - Automatic JWT token injection (Bearer)
  // - CSRF token management (POST/PUT/DELETE/PATCH)
  // - Exponential backoff retry (3 attempts, 408/429/500/502/503/504)
  // - Request correlation IDs for tracing
  // - 401 auto-redirect to login
  // - 403 redirect to unauthorized page

  async get<T>(url: string): Promise<T> { ... }
  async post<T>(url: string, data: any): Promise<T> { ... }
  async put<T>(url: string, data: any): Promise<T> { ... }
  async delete<T>(url: string): Promise<T> { ... }
}
```

**Request Flow:**
```
Frontend → httpClient
  ↓
  1. Detect runtime base URL (getApiBaseUrl())
  2. Get JWT token from localStorage (auth_token or professor_token)
  3. Get CSRF token if needed (csrfService)
  4. Add headers (Authorization, X-CSRF-Token, X-Correlation-Id)
  ↓
Gateway Service (Railway)
  ↓
Microservice (User/Application/Evaluation/etc.)
  ↓
PostgreSQL
```

### CSRF Token Flow (Frontend)

**CSRF Service** (`services/csrfService.ts`):

```typescript
class CsrfService {
  private csrfToken: string | null = null;
  private tokenExpiry: number | null = null;

  // Fetch token from backend
  async fetchCsrfToken(): Promise<string> {
    const response = await api.get('/api/auth/csrf-token');
    this.csrfToken = response.data.csrfToken;
    this.tokenExpiry = Date.now() + 3600000; // 1 hour
    return this.csrfToken;
  }

  // Get cached token or fetch new one if expired
  async getCsrfToken(): Promise<string> {
    if (this.csrfToken && Date.now() < this.tokenExpiry) {
      return this.csrfToken;
    }
    return await this.fetchCsrfToken();
  }

  // Get headers for mutation requests
  async getCsrfHeaders(): Promise<{ 'X-CSRF-Token': string }> {
    const token = await this.getCsrfToken();
    return { 'X-CSRF-Token': token };
  }
}
```

**Integration in HTTP Client:**
```typescript
// http.ts interceptor (lines 104-121)
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
  const csrfHeaders = await csrfService.getCsrfHeaders();
  config.headers['X-CSRF-Token'] = csrfHeaders['X-CSRF-Token'];
}
```

### Authentication Tokens

**Token Storage Hierarchy:**
1. `localStorage.getItem('auth_token')` - Regular users (apoderados)
2. `localStorage.getItem('professor_token')` - School staff
3. `oidcService.getAccessToken()` - OIDC fallback (if implemented)

**Token Lifecycle:**
- Set on login: `localStorage.setItem('auth_token', token)`
- Retrieved on every request: httpClient interceptor
- Cleared on logout: `localStorage.removeItem('auth_token')`
- Auto-refresh on 401: oidcService.renewToken()

### Frontend Service Layer

**Service Pattern:**
```typescript
// Example: services/applicationService.ts
import httpClient from './http';

export const applicationService = {
  async getAll() {
    const response = await httpClient.get('/api/applications');
    return response.data;
  },

  async create(data: CreateApplicationDto) {
    // CSRF token automatically added by httpClient
    const response = await httpClient.post('/api/applications', data);
    return response.data;
  },

  async update(id: number, data: UpdateApplicationDto) {
    const response = await httpClient.put(`/api/applications/${id}`, data);
    return response.data;
  },
};
```

**Available Services:**
- `authService.ts` - Login, register, password reset
- `userService.ts` - User CRUD, profile
- `applicationService.ts` - Student applications
- `documentService.ts` - Document uploads
- `evaluationService.ts` - Evaluations, scoring
- `interviewService.ts` - Interview scheduling
- `guardianService.ts` - Guardian management
- `notificationService.ts` - Email/SMS notifications
- `dashboardService.ts` - Analytics, statistics
- `csrfService.ts` - CSRF token management

### Environment Variables (Frontend)

**Production** (`.env.production`):
```bash
# Runtime detection handles the URL automatically
VITE_API_BASE_URL=https://gateway-service-production-a753.up.railway.app
```

**Development** (`.env.development`):
```bash
# Points to local gateway
VITE_API_BASE_URL=http://localhost:8080
```

**IMPORTANT**: The `VITE_API_BASE_URL` is for documentation only. The actual URL is determined at runtime by `getApiBaseUrl()` in `config/api.config.ts`.

### File Upload Handling

**Document Upload Flow:**
```typescript
// Frontend: services/documentService.ts
const formData = new FormData();
formData.append('file', file);
formData.append('documentType', 'BIRTH_CERTIFICATE');
formData.append('applicationId', '123');

// CSRF token added automatically
await httpClient.post('/api/documents', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Backend: application-service/src/middleware/upload.js
// - Multer validates file type, size
// - Saves to ./uploads/ directory
// - Returns file metadata
```

**Constraints:**
- Max file size: 10MB
- Max files per request: 5
- Allowed types: PDF, JPG, PNG, GIF, DOC, DOCX
- Document types must match backend VALID_DOCUMENT_TYPES array

### Frontend Error Handling

**HTTP Status Handling:**
```typescript
// 401 Unauthorized
- Auto-redirect to /login
- Save current path for post-login redirect
- Attempt token refresh (oidcService)

// 403 Forbidden
- Redirect to /unauthorized page
- User lacks required role

// 408, 429, 500, 502, 503, 504
- Automatic retry (3 attempts, exponential backoff)
- Jitter to prevent thundering herd

// Other errors
- Throw HttpError with status, message, correlationId
- Display to user via toast/notification
```

### Testing Frontend Integration

**Local Development:**
```bash
# Terminal 1: Start backend gateway
cd gateway-service && npm run dev

# Terminal 2: Start all backend services
# (see "Running the Full System Locally" section)

# Terminal 3: Start frontend
cd ../Admision_MTN_front
npm run dev
# Open http://localhost:5173
```

**Verify Integration:**
```bash
# Check frontend can reach gateway
curl http://localhost:5173  # Frontend loads

# Check API calls work
# Login in browser, open DevTools → Network
# Should see requests to http://localhost:8080/api/*

# Check CSRF token flow
# Open Console, look for:
# [CSRF] Fetching new CSRF token...
# 🛡️ http.ts - Added CSRF token to POST request
```

**Production Testing:**
```bash
# Vercel URL: https://admision-mtn-frontend.vercel.app
# Should auto-detect and use Railway backend:
# https://gateway-service-production-a753.up.railway.app

# Check Console logs:
# [API Config] Is Vercel? true
# [API Config] ✅ Vercel deployment detected → Railway backend
```

### Common Frontend-Backend Issues

**Issue: "Network Error" or "ERR_CONNECTION_REFUSED"**
- **Cause**: Gateway not running or wrong URL
- **Fix**:
  - Verify gateway is running: `curl http://localhost:8080/health`
  - Check browser console for actual URL being used
  - Verify `getApiBaseUrl()` returns correct URL for environment

**Issue: "401 Unauthorized" on every request**
- **Cause**: Token not being sent or invalid
- **Fix**:
  - Check localStorage: `localStorage.getItem('auth_token')`
  - Verify Authorization header in Network tab
  - Check token hasn't expired (JWT exp claim)

**Issue: "403 CSRF validation failed"**
- **Cause**: CSRF token missing or invalid
- **Fix**:
  - Check Console: should see "🛡️ Added CSRF token to POST request"
  - Verify `/api/auth/csrf-token` endpoint works
  - Ensure CSRF_SECRET matches between frontend/backend services

**Issue: CORS errors in browser**
- **Cause**: Gateway CORS not configured for frontend origin
- **Fix**:
  - Check gateway CORS settings: `CORS_ORIGIN=http://localhost:5173`
  - Verify preflight OPTIONS requests succeed (200)
  - Check response headers: `Access-Control-Allow-Origin`

**Issue: API calls work locally but fail on Vercel**
- **Cause**: Runtime detection not working
- **Fix**:
  - Check Console logs in production browser
  - Verify hostname detection logic in `api.config.ts`
  - Test manually: call `debugApiConfig()` in browser Console

**Issue: "No hay horarios disponibles" despite API successfully returning time slots (Interview Scheduling)**
- **Symptoms**:
  - Console logs show successful API calls with data (e.g., `✅ Horarios comunes obtenidos (5 slots): ['13:00', '13:30', ...]`)
  - UI displays empty state message "No hay horarios disponibles para Evaluador en esta fecha"
  - No error messages (silent failure)
- **Root Cause**:
  - **Race condition**: Multiple rapid API calls when selecting second interviewer for FAMILY interviews, causing state updates with stale data
  - **Duplicate API calls**: Parent component (`InterviewForm`) and child component (`DayScheduleSelector`) independently loading the same data, creating parallel state systems
- **Fix**:
  1. **Race condition solution** (InterviewForm.tsx:1007-1090):
     - Implemented `useRef` for tracking: `loadingSlotsRef`, `abortControllerRef`, `debounceTimerRef`
     - Added `AbortController` to cancel outdated API calls
     - Added 300ms debouncing in useEffect
     - Only update state if call wasn't aborted
     - Enhanced logging with unique timestamps for tracing
  2. **Duplicate API calls solution** (Commit: 73ce9c2):
     - Modified `DayScheduleSelector.tsx` to accept optional `availableTimeSlots` and `isLoadingSlots` props
     - When props are provided, component uses those instead of making its own API calls
     - Parent (`InterviewForm`) now passes both props to child (`DayScheduleSelector`)
     - Created single source of truth for time slot data
     - Maintained backward compatibility (component still works standalone)
- **How to recognize**:
  - Look for alternating console logs showing different slot counts (5 slots → [] → 5 slots)
  - Check for multiple API calls with same parameters in Network tab
  - Verify both parent and child components are loading the same data
- **Code References**:
  - DayScheduleSelector.tsx:21-22 (new props)
  - DayScheduleSelector.tsx:34-44 (prop usage logic)
  - DayScheduleSelector.tsx:47-62 (skip loading if props provided)
  - InterviewForm.tsx:1066-1067 (passing props to child)
- **Prevention**:
  - Always pass data as props from parent to child instead of letting child fetch independently
  - Use AbortController for all async operations in useEffect
  - Add debouncing for operations triggered by rapid state changes
  - Include unique correlation IDs in logs for tracing race conditions

### Frontend Development Workflow

**Adding a new feature:**
```bash
# 1. Create backend endpoint (see "Adding a New Endpoint")
# 2. Test endpoint with curl/Postman
# 3. Add TypeScript types in frontend/types/
# 4. Create/update service in frontend/services/
# 5. Create React component in frontend/components/ or pages/
# 6. Test locally with both frontend and backend running
# 7. Deploy backend to Railway
# 8. Deploy frontend to Vercel (auto-deploy on push)
```

**Example: Adding "Export Applications to Excel" feature**
```bash
# Backend
cd application-service
# Add GET /api/applications/export endpoint
# Returns Excel file (Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

# Frontend
cd Admision_MTN_front
# Add to services/applicationService.ts:
export const downloadApplicationsExcel = async () => {
  const response = await httpClient.get('/api/applications/export', {
    responseType: 'blob'
  });

  const url = window.URL.createObjectURL(new Blob([response]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'applications.xlsx');
  document.body.appendChild(link);
  link.click();
  link.remove();
};

# Add button in components/ApplicationList.tsx:
<button onClick={() => downloadApplicationsExcel()}>
  Export to Excel
</button>
```

### Deployment Checklist

**Before deploying backend changes:**
- [ ] All services pass tests: `npm test`
- [ ] Database migrations applied (if any)
- [ ] Environment variables updated in Railway
- [ ] CSRF_SECRET and JWT_SECRET match across all services
- [ ] Test endpoints with curl/Postman

**Before deploying frontend changes:**
- [ ] TypeScript compiles: `npm run build`
- [ ] No ESLint errors
- [ ] Runtime API detection works (test in browser Console)
- [ ] CSRF token flow works for mutations
- [ ] Authentication flow works (login, token storage, auto-logout)
- [ ] File uploads work (if changed)

**After deployment:**
- [ ] Verify Vercel build succeeded
- [ ] Check Railway services are healthy
- [ ] Test critical user flows (login, create application, upload document)
- [ ] Check browser Console for errors
- [ ] Verify CORS working (no preflight errors)

## Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

**Format**: `type(scope): description`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Dependency updates, config changes
- `perf`: Performance improvements
- `style`: Code style changes (formatting, semicolons, etc.)
- `build`: Build system changes
- `ci`: CI/CD pipeline changes

**Scopes** (service names):
- `user`, `application`, `evaluation`, `notification`, `dashboard`, `guardian`, `gateway`
- `frontend` - for frontend changes
- `shared` - for shared utilities
- `docs` - for documentation

**Examples**:
```bash
git commit -m "feat(user): add two-factor authentication"
git commit -m "fix(application): resolve file upload timeout"
git commit -m "docs(readme): update installation guide"
git commit -m "refactor(evaluation): improve circuit breaker logic"
git commit -m "test(notification): add email service integration tests"
git commit -m "chore(deps): upgrade express to 5.1.0"
git commit -m "feat(frontend): add application export to Excel"
git commit -m "fix(frontend): resolve CSRF token expiration issue"
```

## Branching Strategy

### Main Branches

- **`main`** - Production code (protected, requires PR)
- **`develop`** - Development integration branch
- **`hotfix/production`** - Urgent production fixes

### Feature Branch Naming

Follow this pattern for new features:

```bash
# Service-specific features
feature/<service-name>/<description>

# Examples:
feature/user-service/add-2fa
feature/application-service/improve-file-validation
feature/evaluation-service/add-bulk-scoring
feature/frontend/add-excel-export

# Cross-service features
feature/shared/update-logging-format

# Bug fixes
fix/<service-name>/<description>
fix/gateway-service/cors-headers
fix/frontend/csrf-token-refresh

# Hotfixes (urgent production fixes)
hotfix/<description>
hotfix/fix-login-timeout
hotfix/fix-file-upload-500
```

### Workflow

```bash
# Development of new functionality
git checkout develop
git pull origin develop
git checkout -b feature/user-service/add-2fa
# ... make changes ...
git add .
git commit -m "feat(user): add two-factor authentication"
git push origin feature/user-service/add-2fa
# Create Pull Request to develop

# Hotfix urgent
git checkout main
git checkout -b hotfix/fix-login-bug
# ... make changes ...
git commit -m "fix(user): resolve login timeout issue"
git push origin hotfix/fix-login-bug
# Create Pull Request to main AND develop
```
