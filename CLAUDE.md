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

## Key Documentation Files

### Security & Deployment
- **CSRF_IMPLEMENTATION_SUMMARY.md** - Executive summary of CSRF implementation across 4 services
- **RAILWAY_DEPLOYMENT_CSRF.md** - Detailed Railway deployment guide for CSRF-protected services
- **FASE-0-ANALISIS.md** - Comprehensive architecture analysis and service inventory

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

**Recent Changes (2025-10-21)**:
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
