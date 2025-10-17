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

- **Gateway Service**: NGINX reverse proxy with rate limiting, CORS, connection pooling, and health monitoring
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

### Gateway (NGINX) Management

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

# Test all routes
./scripts/test-routes.sh

# Health check all services
node src/health-check.js
# OR continuous monitoring: node src/health-check.js --monitor
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
├── middleware/       # Authentication, validation, file upload
├── utils/            # Logger, helpers, validators
├── exceptions/       # Custom error classes
├── app.js            # Express app configuration
└── server.js         # Entry point with graceful shutdown
```

**Key principle**: Routes → Controllers → Services → Models → Database

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

### File Upload (Multer)

Application Service handles file uploads:

```javascript
// Supported formats: PDF, JPG, PNG, GIF, DOC, DOCX
// Max file size: 10MB
// Max files per request: 5
// Storage: ./uploads/ directory
// Filename sanitization: automatic
```

Document types: BIRTH_CERTIFICATE, ID_CARD, TRANSCRIPT, RECOMMENDATION_LETTER, MEDICAL_CERTIFICATE, etc.

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
- **Notification Service**: SMTP_HOST, SMTP_USER, SMTP_PASSWORD, TWILIO_* (SMS)
- **Application Service**: MAX_FILE_SIZE, MAX_FILES, UPLOAD_DIR
- **Dashboard Service**: CACHE_ENABLED, CACHE_TTL_*

## Gateway Configuration

### NGINX Routing

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
