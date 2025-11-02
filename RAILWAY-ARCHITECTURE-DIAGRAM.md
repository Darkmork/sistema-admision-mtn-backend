# RAILWAY ARCHITECTURE DIAGRAM
## Sistema MTN Admisiones - Private Networking

---

## NETWORK TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET (Public)                           │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                                │
│  • React + TypeScript + Vite                                        │
│  • Domain: admision-mtn-front.vercel.app                            │
│  • API Base URL: Runtime detection (getApiBaseUrl())                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   RAILWAY PROJECT (Public Zone)                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │           Gateway Service (EXPOSED PUBLICLY)                  │ │
│  │  • Domain: gateway-service-production-a753.up.railway.app     │ │
│  │  • Port: 8080 (internal_port in railway.toml)                 │ │
│  │  • Express.js + http-proxy-middleware                         │ │
│  │  • Listens on: 0.0.0.0:8080                                   │ │
│  │  • Features:                                                  │ │
│  │    - Centralized JWT authentication (commented out)           │ │
│  │    - Rate limiting (1000 req/15min per IP)                    │ │
│  │    - CORS (Vercel + localhost origins)                        │ │
│  │    - Request ID tracking (UUID)                               │ │
│  │    - Path-based routing to backend services                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                  │                                  │
│                                  │ HTTP (Private Network)           │
│                                  │                                  │
│  ┌───────────────────────────────┴──────────────────────────────┐  │
│  │             RAILWAY PRIVATE NETWORKING                        │  │
│  │         (IPv4/IPv6 internal routing)                          │  │
│  │  Format: http://service-name:8080                             │  │
│  │  DNS: Railway internal DNS resolution                         │  │
│  └───────────────────────────────┬──────────────────────────────┘  │
│                                  │                                  │
│         ┌────────────┬───────────┼───────────┬───────────┐         │
│         │            │           │           │           │         │
│         ▼            ▼           ▼           ▼           ▼         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │  User    │ │  App     │ │  Eval    │ │  Notif   │ │ Guardian ││
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │ │ Service  ││
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤│
│  │ :8080    │ │ :8080    │ │ :8080    │ │ :8080    │ │ :8080    ││
│  │ PRIVATE  │ │ PRIVATE  │ │ PRIVATE  │ │ PRIVATE  │ │ PRIVATE  ││
│  │ 0.0.0.0  │ │ 0.0.0.0  │ │ 0.0.0.0  │ │ 0.0.0.0  │ │ 0.0.0.0  ││
│  │          │ │          │ │          │ │          │ │          ││
│  │ JWT ✓    │ │ JWT ✓    │ │ JWT ✓    │ │ JWT ✓    │ │ JWT ✓    ││
│  │ CSRF ✓   │ │ CSRF ✓   │ │ CSRF ✓   │ │ CSRF ✗   │ │ CSRF ✓   ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│         │            │           │           │           │         │
│         └────────────┴───────────┴───────────┴───────────┘         │
│                                  │                                  │
│                                  │ DATABASE_URL                     │
│                                  ▼                                  │
│                       ┌──────────────────┐                          │
│                       │   PostgreSQL     │                          │
│                       │   Database       │                          │
│                       ├──────────────────┤                          │
│                       │ PRIVATE          │                          │
│                       │ Connection Pool: │                          │
│                       │ max: 20          │                          │
│                       │ idle: 30s        │                          │
│                       │ timeout: 2s      │                          │
│                       │ query: 5s        │                          │
│                       └──────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## REQUEST FLOW DIAGRAM

### Flow 1: User Login (POST /api/auth/login)

```
┌─────────┐
│ Browser │ 1. POST /login with credentials
└────┬────┘
     │ HTTPS
     ▼
┌─────────────────┐
│ Gateway         │ 2. Proxy to User Service
│ (Public)        │    - Add X-Request-ID
│ Port: 8080      │    - Forward Authorization header
└────┬────────────┘    - NO body parsing (streams)
     │ HTTP Private Network
     ▼ http://user-service:8080/api/auth/login
┌─────────────────┐
│ User Service    │ 3. Authenticate user
│ (Private)       │    - Validate credentials (bcrypt)
│ Port: 8080      │    - Query DB via circuit breaker
└────┬────────────┘    - Generate JWT token (24h exp)
     │ DATABASE_URL
     ▼
┌─────────────────┐
│ PostgreSQL      │ 4. SELECT FROM users WHERE email = ?
│ (Private)       │    - Return user record
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ User Service    │ 5. Return response
│                 │    { success: true, token: "...", user: {...} }
└────┬────────────┘
     │ HTTP Response
     ▼
┌─────────────────┐
│ Gateway         │ 6. Proxy response back
│                 │    - Add CORS headers
│                 │    - Add X-Request-ID header
└────┬────────────┘
     │ HTTPS
     ▼
┌─────────┐
│ Browser │ 7. Store token in localStorage
└─────────┘    - Set auth_token
               - Redirect to dashboard
```

### Flow 2: Create Application (POST /api/applications)

```
┌─────────┐
│ Browser │ 1. POST /api/applications
└────┬────┘    Headers: Authorization: Bearer <token>
     │          Headers: X-CSRF-Token: <csrf>
     │          Body: { studentFirstName, ... }
     ▼
┌─────────────────┐
│ Gateway         │ 2. Proxy to Application Service
│                 │    - Forward all headers
│                 │    - Stream body (no parsing)
└────┬────────────┘
     │ http://application-service:8080/api/applications
     ▼
┌─────────────────┐
│ Application Svc │ 3. Middleware chain:
│                 │    - authenticate (verify JWT)
│                 │    - validateCsrf (check token)
│                 │    - requireRole(['ADMIN', 'COORDINATOR'])
│                 │    - validate (Joi schema)
└────┬────────────┘    - controller.create()
     │
     ▼
┌─────────────────┐
│ Service Layer   │ 4. Business logic:
│                 │    - writeOperationBreaker.fire()
│                 │    - dbPool.query('INSERT INTO ...')
│                 │    - Return Application.fromDB()
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ PostgreSQL      │ 5. INSERT INTO applications
│                 │    VALUES (?, ?, ?, NOW(), NOW())
└────┬────────────┘    RETURNING *
     │
     ▼
┌─────────────────┐
│ Response        │ 6. { success: true, data: { id: 123, ... } }
└─────────────────┘
```

### Flow 3: Upload Document (POST /api/documents)

```
┌─────────┐
│ Browser │ 1. POST /api/documents
└────┬────┘    Content-Type: multipart/form-data
     │          FormData: { file, documentType, applicationId }
     ▼
┌─────────────────┐
│ Gateway         │ 2. Stream multipart to Application Service
│                 │    - NO body parsing (streams)
│                 │    - client_max_body_size: 25MB
└────┬────────────┘    - proxy_read_timeout: 60s
     │
     ▼
┌─────────────────┐
│ Application Svc │ 3. Multer middleware:
│                 │    - Parse multipart stream
│                 │    - Validate file type (PDF, JPG, PNG, DOC)
│                 │    - Validate file size (max 10MB)
│                 │    - Validate document type (VALID_DOCUMENT_TYPES)
│                 │    - Save to ./uploads/ directory
└────┬────────────┘    - Generate unique filename
     │
     ▼
┌─────────────────┐
│ Document Svc    │ 4. INSERT INTO documents
│                 │    (application_id, document_type, file_path,
│                 │     original_filename, file_size, created_at)
└────┬────────────┘    VALUES (?, ?, ?, ?, ?, NOW())
     │
     ▼
┌─────────────────┐
│ Response        │ 5. { success: true, data: { id: 456, filePath: "..." } }
└─────────────────┘
```

---

## SERVICE RESPONSIBILITIES MATRIX

| Service | Port | Public? | Auth | CSRF | Responsibilities |
|---------|------|---------|------|------|------------------|
| **Gateway** | 8080 | ✅ YES | Proxies JWT | Proxies CSRF | Routing, Rate limit, CORS |
| **User** | 8080 | ❌ NO | ✅ JWT | ✅ CSRF | Login, Register, User CRUD, RBAC |
| **Application** | 8080 | ❌ NO | ✅ JWT | ✅ CSRF | Applications, Students, Documents |
| **Evaluation** | 8080 | ❌ NO | ✅ JWT | ✅ CSRF | Evaluations, Interviews, Scheduling |
| **Notification** | 8080 | ❌ NO | ✅ JWT | ❌ NO | Email (SMTP), SMS (Twilio) |
| **Dashboard** | 8080 | ❌ NO | ✅ JWT | ❌ NO | Statistics, Analytics, Metrics |
| **Guardian** | 8080 | ❌ NO | ✅ JWT | ✅ CSRF | Guardian management, Family relations |

---

## CIRCUIT BREAKER TOPOLOGY

Each service implements 4 types of circuit breakers using Opossum:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Simple Query Breaker (Timeout: 2s, Threshold: 60%)       │ │
│  │ - Fast lookups                                            │ │
│  │ - Simple SELECTs                                          │ │
│  │ - Reset: 20s                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Medium Query Breaker (Timeout: 5s, Threshold: 50%)       │ │
│  │ - Standard queries with JOINs                             │ │
│  │ - Auth operations                                         │ │
│  │ - Reset: 30s                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Write Operation Breaker (Timeout: 3s, Threshold: 30%)    │ │
│  │ - INSERT, UPDATE, DELETE                                  │ │
│  │ - STRICT threshold (critical operations)                  │ │
│  │ - Reset: 45s                                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ External Service Breaker (Timeout: 8s, Threshold: 70%)   │ │
│  │ - SMTP (SendGrid)                                         │ │
│  │ - SMS (Twilio)                                            │ │
│  │ - Other microservices (via HTTP)                          │ │
│  │ - Reset: 120s                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Circuit States:
CLOSED (normal) → OPEN (failing, rejects immediately) → HALF_OPEN (testing) → CLOSED
```

---

## GATEWAY PROXY CONFIGURATION

### Path-based Routing

```javascript
// gateway-service/src/server.js

// USER SERVICE
/api/users/*       → http://user-service:8080/api/users/*
/api/auth/*        → http://user-service:8080/api/auth/*

// APPLICATION SERVICE
/api/applications/* → http://application-service:8080/api/applications/*
/api/students/*     → http://application-service:8080/api/students/*
/api/documents/*    → http://application-service:8080/api/documents/*

// EVALUATION SERVICE
/api/evaluations/*           → http://evaluation-service:8080/api/evaluations/*
/api/interviews/*            → http://evaluation-service:8080/api/interviews/*
/api/interviewer-schedules/* → http://evaluation-service:8080/api/interviewer-schedules/*

// NOTIFICATION SERVICE
/api/notifications/*        → http://notification-service:8080/api/notifications/*
/api/email/*                → http://notification-service:8080/api/email/*
/api/institutional-emails/* → http://notification-service:8080/api/institutional-emails/*

// DASHBOARD SERVICE
/api/dashboard/* → http://dashboard-service:8080/api/dashboard/*
/api/analytics/* → http://dashboard-service:8080/api/analytics/*

// GUARDIAN SERVICE
/api/guardians/* → http://guardian-service:8080/api/guardians/*
```

### Proxy Middleware Configuration

```javascript
const makeProxy = (target, path = '') => {
  return createProxyMiddleware({
    target,                        // Backend service URL
    changeOrigin: true,            // Change Host header
    xfwd: true,                    // Add X-Forwarded-* headers
    secure: false,                 // Allow self-signed certs (Railway internal)
    timeout: 20000,                // Client timeout (20s)
    proxyTimeout: 15000,           // Backend timeout (15s)
    followRedirects: false,        // Proxy redirects, don't follow
    autoRewrite: false,            // DISABLED (causes redirect loops)

    // Path rewriting (Express strips path, middleware restores it)
    pathRewrite: path ? (pathStr) => path + pathStr : undefined,

    onProxyReq: (proxyReq, req) => {
      // Forward headers
      proxyReq.setHeader('x-request-id', req.id);
      proxyReq.setHeader('Authorization', req.headers.authorization);
      proxyReq.setHeader('x-csrf-token', req.headers['x-csrf-token']);
      proxyReq.setHeader('X-User-Id', req.user?.userId);
      proxyReq.setHeader('X-User-Email', req.user?.email);
      proxyReq.setHeader('X-User-Role', req.user?.role);
    },

    onError: (err, req, res) => {
      // Return 502 if backend unreachable
      res.status(502).json({
        success: false,
        error: {
          code: 'GATEWAY_ERROR',
          message: 'Error al comunicarse con el servicio backend'
        }
      });
    }
  });
};
```

---

## ENVIRONMENT VARIABLES MATRIX

### Gateway Service (PUBLIC)

```bash
# Server
NODE_ENV=production
PORT=8080  # Injected by Railway automatically

# Backend Service URLs (CRITICAL - Configure in Railway)
USER_SERVICE_URL=http://user-service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080

# JWT (must match backend services)
JWT_SECRET=mtn_secret_key_2025_admissions

# CORS
CORS_ORIGIN=https://admision-mtn-front.vercel.app
```

### Backend Services (PRIVATE)

```bash
# Server
NODE_ENV=production
PORT=8080  # Injected by Railway automatically

# Database (Injected by Railway from PostgreSQL plugin)
DATABASE_URL=postgresql://user:pass@host:port/db

# JWT (MUST be identical across all services)
JWT_SECRET=mtn_secret_key_2025_admissions

# CSRF (MUST be identical in: user, application, evaluation, guardian)
CSRF_SECRET=<generated-with-crypto>  # 32 bytes base64
```

### Service-Specific Variables

**Notification Service**:
```bash
# SMTP (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<sendgrid-api-key>
SMTP_FROM=noreply@mtn.cl

# Twilio SMS
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=+56912345678
```

**Application Service**:
```bash
# File Upload
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES=5
UPLOAD_DIR=./uploads
```

**Dashboard Service**:
```bash
# Cache
CACHE_ENABLED=true
CACHE_TTL_GENERAL=180000    # 3 minutes
CACHE_TTL_ANALYTICS=900000  # 15 minutes
```

---

## SECURITY LAYERS

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Architecture                        │
└─────────────────────────────────────────────────────────────────┘

Layer 1: Network Security
├─ Railway Private Networking (backend services NOT publicly accessible)
├─ Gateway as single public entry point
└─ HTTPS termination at Railway edge

Layer 2: Gateway Security
├─ Rate limiting (1000 req/15min per IP)
├─ Helmet (security headers)
├─ CORS (whitelist origins)
├─ Request ID tracking (UUID)
└─ Compression (gzip)

Layer 3: Authentication (JWT)
├─ Token-based stateless auth
├─ 24-hour expiration
├─ HS256 algorithm
├─ Shared secret across all services
└─ Bearer token in Authorization header

Layer 4: CSRF Protection
├─ Stateless HMAC-SHA256 tokens
├─ 1-hour expiration
├─ Required for: POST, PUT, PATCH, DELETE
├─ Validated in middleware chain
└─ Shared secret in 4 services (user, application, evaluation, guardian)

Layer 5: Authorization (RBAC)
├─ Role-based access control
├─ Roles: ADMIN, COORDINATOR, APODERADO, TEACHER, PSYCHOLOGIST, CYCLE_DIRECTOR
├─ requireRole middleware
└─ Enforced at route level

Layer 6: Input Validation
├─ Joi schemas
├─ RUT validation (Chilean ID)
├─ Email/phone format validation
├─ File type/size validation (Multer)
└─ Document type validation (CHECK constraint alignment)

Layer 7: Database Security
├─ Connection pooling (max: 20)
├─ Parameterized queries (SQL injection prevention)
├─ Circuit breakers (prevent DB overload)
└─ Private networking (no public DB access)
```

---

## MONITORING & LOGGING

### Logging Strategy (Winston)

```
All Services:
├─ logs/<service-name>.log         (all logs)
├─ logs/<service-name>-error.log   (errors only)
└─ Console output (Railway captures)

Log Levels:
├─ error: Errors, exceptions, crashes
├─ warn: Warnings, deprecated usage, circuit breaker opens
├─ info: Important events (startup, DB connections, requests)
└─ debug: Detailed debugging info (disabled in production)

Structured Logging:
{
  "level": "info",
  "message": "Request processed",
  "timestamp": "2025-11-01T21:00:00.000Z",
  "requestId": "uuid-v4",
  "userId": 123,
  "duration": 120
}
```

### Railway Metrics

```
Railway Dashboard → Service → Metrics

CPU Usage:
├─ Normal: 5-15%
├─ High load: 30-60%
└─ Alert: >80%

Memory Usage:
├─ Normal: 100-200 MB
├─ High load: 300-400 MB
└─ Alert: >450 MB (Railway limit: 512 MB on free tier)

Network:
├─ Ingress: Requests from gateway
├─ Egress: Responses + DB connections
└─ Private Network: FREE (no egress cost)

Request Rate:
├─ Avg: 10-50 req/min
├─ Peak: 100-200 req/min
└─ Rate limit: 1000 req/15min per IP
```

---

## DEPLOYMENT CHECKLIST

```
[ ] 1. Code ready
    ├─ All services listen on 0.0.0.0:8080
    ├─ DATABASE_URL priority configured
    ├─ Circuit breakers implemented
    └─ Dockerfiles exist

[ ] 2. Railway Project Setup
    ├─ All 7 services in SAME project
    ├─ Private Networking ENABLED
    ├─ PostgreSQL plugin added
    └─ Service names verified (exact, case-sensitive)

[ ] 3. Environment Variables (Gateway)
    ├─ USER_SERVICE_URL=http://user-service:8080
    ├─ APPLICATION_SERVICE_URL=http://application-service:8080
    ├─ EVALUATION_SERVICE_URL=http://evaluation-service:8080
    ├─ NOTIFICATION_SERVICE_URL=http://notification-service:8080
    ├─ DASHBOARD_SERVICE_URL=http://dashboard-service:8080
    ├─ GUARDIAN_SERVICE_URL=http://guardian-service:8080
    └─ JWT_SECRET=<shared-secret>

[ ] 4. Environment Variables (All Services)
    ├─ DATABASE_URL (auto-injected from PostgreSQL plugin)
    ├─ JWT_SECRET (identical in all)
    ├─ CSRF_SECRET (identical in user, app, eval, guardian)
    ├─ NODE_ENV=production
    └─ PORT=8080 (auto-injected)

[ ] 5. Service-Specific Variables
    ├─ Notification: SMTP, Twilio
    ├─ Application: Upload settings
    └─ Dashboard: Cache settings

[ ] 6. Deploy & Verify
    ├─ All services show "Deployed" status
    ├─ Check logs for "Listening on 0.0.0.0:8080"
    ├─ Gateway shows "Service URLs configured:"
    └─ No errors in startup logs

[ ] 7. Testing
    ├─ Run test-railway-connectivity.sh
    ├─ All health checks return 200 OK
    ├─ Test from frontend (Vercel)
    └─ Monitor logs for 5-10 minutes

[ ] 8. Production Validation
    ├─ Login flow works
    ├─ Create application works
    ├─ Upload document works
    ├─ No CORS errors
    └─ No 502/504 errors
```

---

**END OF ARCHITECTURE DIAGRAM**
