# Express API Gateway - MTN Admission System

## Overview

This is a production-ready Express-based API Gateway that serves as the entry point for the MTN microservices architecture. It provides centralized JWT authentication, request proxying, security middleware, observability, and health monitoring.

**Version:** 2.1.0
**Type:** Express Gateway with Centralized JWT Auth
**Deployment:** Supports local development and Railway cloud deployment

---

## Architecture

The gateway acts as a reverse proxy that:

1. **Receives** all incoming HTTP requests from clients (frontend, mobile apps, etc.)
2. **Authenticates** requests using centralized JWT validation
3. **Routes** requests to appropriate microservices
4. **Proxies** requests with full body and header forwarding
5. **Aggregates** responses back to clients

```
Client Request
      ↓
API Gateway (Port 8080)
 ├── Authentication (JWT)
 ├── Rate Limiting
 ├── Security Headers (Helmet)
 ├── Request ID Tracking
 └── Proxy to Services
      ├── User Service (Port 8082)
      ├── Application Service (Port 8083)
      ├── Evaluation Service (Port 8084)
      ├── Notification Service (Port 8085)
      ├── Dashboard Service (Port 8086)
      └── Guardian Service (Port 8087)
```

---

## Key Features

### 1. Security

- **Helmet**: Security HTTP headers (XSS, clickjacking protection)
- **CORS**: Configurable origin restrictions
- **Rate Limiting**: 1000 requests per 15 minutes per IP
- **JWT Authentication**: Centralized token validation
- **Trust Proxy**: Proper IP detection behind Railway/NGINX

### 2. Observability

- **Request ID Tracking**: UUID v4 for distributed tracing
- **Structured Logging**: Winston with daily rotation
- **Request/Response Logging**: All proxy operations logged
- **Error Tracking**: Detailed error logs with stack traces

### 3. Performance

- **Compression**: Gzip/deflate for responses
- **Connection Pooling**: Persistent connections to backends
- **Timeouts**: Configurable proxy and client timeouts (15s default)

### 4. Reliability

- **Health Endpoints**: `/health` (liveness), `/ready` (readiness)
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Error Handling**: 404, 502, 500 with standardized responses
- **Body Re-streaming**: Fixes Express body parser + proxy integration

---

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL (if services require it)

### Setup

```bash
# Install dependencies
npm ci

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start in development mode
npm run dev

# Or start in production mode
npm start
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Gateway port | `8080` |
| `NODE_ENV` | Environment | `development` or `production` |
| `JWT_SECRET` | Shared secret for JWT validation | `mtn_secret_key_2025_admissions` |

### Service URLs (Local Development)

| Variable | Description | Default |
|----------|-------------|---------|
| `USER_SERVICE_URL` | User/Auth service | `http://localhost:8082` |
| `APPLICATION_SERVICE_URL` | Application service | `http://localhost:8083` |
| `EVALUATION_SERVICE_URL` | Evaluation service | `http://localhost:8084` |
| `NOTIFICATION_SERVICE_URL` | Notification service | `http://localhost:8085` |
| `DASHBOARD_SERVICE_URL` | Dashboard service | `http://localhost:8086` |
| `GUARDIAN_SERVICE_URL` | Guardian service | `http://localhost:8087` |

### Service URLs (Railway Production)

For Railway deployment, use private networking URLs:

```bash
USER_SERVICE_URL=http://user_service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080
```

**Note:** Service names must match EXACTLY with Railway service names.

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `*` |
| `LOG_LEVEL` | Winston log level | `info` |

---

## API Routes

### Health Check Endpoints

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/health` | Liveness probe | No |
| GET | `/ready` | Readiness probe | No |
| GET | `/gateway/status` | Gateway information | No |

### Proxied Routes

All `/api/*` routes are proxied to backend services after JWT authentication.

| Prefix | Target Service | Auth | CSRF Required |
|--------|----------------|------|---------------|
| `/api/auth/*` | User Service | Public for login/register | No |
| `/api/users/*` | User Service | Yes | Yes (write ops) |
| `/api/students/*` | Application Service | Yes | Yes (write ops) |
| `/api/applications/*` | Application Service | Yes | Yes (write ops) |
| `/api/documents/*` | Application Service | Yes | Yes (write ops) |
| `/api/evaluations/*` | Evaluation Service | Yes | Yes (write ops) |
| `/api/interviews/*` | Evaluation Service | Yes | Yes (write ops) |
| `/api/notifications/*` | Notification Service | Yes | Yes (write ops) |
| `/api/dashboard/*` | Dashboard Service | Yes | No (read-only) |
| `/api/analytics/*` | Dashboard Service | Yes | No (read-only) |
| `/api/guardians/*` | Guardian Service | Yes | Yes (write ops) |

### Public Routes (No Authentication)

These routes are accessible without JWT:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/verify-email`
- `GET /api/auth/public-key`
- `GET /api/auth/check-email`
- `POST /api/auth/send-verification`
- `GET /api/auth/csrf-token`
- `POST /api/students/validate-rut`
- `GET /api/applications/public/all`
- `GET /api/applications/stats`
- `GET /api/applications/statistics`

---

## Proxy Configuration

### How Body Forwarding Works

**Problem:** Express parses JSON bodies, which consumes the request stream. `http-proxy-middleware` needs the raw stream to forward to backends.

**Solution:** We re-serialize the parsed body and write it to the proxy request:

```javascript
const fixRequestBody = (proxyReq, req) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return;
  }

  const contentType = proxyReq.getHeader('Content-Type');
  const writeBody = (bodyData) => {
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  };

  if (contentType && contentType.includes('application/json')) {
    writeBody(JSON.stringify(req.body));
  }
};
```

### Headers Forwarded

The gateway automatically forwards:

- `Authorization`: JWT token
- `x-csrf-token` / `X-CSRF-Token`: CSRF protection
- `x-request-id`: For distributed tracing
- `X-User-Id`, `X-User-Email`, `X-User-Role`: Decoded from JWT

### Timeouts

- **Proxy Timeout**: 15 seconds (configurable)
- **Client Timeout**: 15 seconds (configurable)

---

## Testing

### Run Smoke Tests

```bash
# Start gateway
npm run dev

# In another terminal, run smoke tests
npm run smoke
```

### Expected Output

```
==============================================
  Gateway Smoke Tests
  Base URL: http://localhost:8080
==============================================

✓ Health check endpoint returns 200 OK
✓ Readiness check endpoint returns 200 OK
✓ Gateway status endpoint returns correct information
✓ CORS headers are present
✓ Rate limit headers are present
ℹ   Rate limit: 1000 requests per window
✓ Request ID is propagated correctly
✓ Security headers (Helmet) are present
✓ 404 handler works correctly
✓ Protected routes require authentication

==============================================
  Results: 9 passed, 0 failed
==============================================
```

### Manual Testing

```bash
# Test health check
curl http://localhost:8080/health

# Test protected route (should return 401)
curl http://localhost:8080/api/users

# Test public route
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test with JWT (replace TOKEN with actual JWT)
curl http://localhost:8080/api/users \
  -H "Authorization: Bearer TOKEN"
```

---

## Railway Deployment

### 1. Configuration

Ensure `railway.toml` exists:

```toml
[build]
builder = "DOCKERFILE"

[deploy]
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### 2. Environment Variables

Set in Railway dashboard:

```bash
NODE_ENV=production
JWT_SECRET=your_production_secret_here

# Service URLs using Private Networking
USER_SERVICE_URL=http://user_service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
# ... (other services)

# CORS Origins (Railway frontend domain)
CORS_ORIGIN=https://your-frontend.railway.app
```

### 3. Private Networking

1. Enable Private Networking in Railway project settings
2. Ensure all services are in the same project
3. Service names in URLs must match Railway service names **exactly** (case-sensitive)

### 4. Public Domain

1. Only the gateway needs a public domain
2. Generate domain in Railway: `gateway-service` > Settings > Networking > Generate Domain
3. Backend services should NOT have public domains

### 5. Deployment

```bash
# Option 1: Auto-deploy via GitHub
git push origin main

# Option 2: Manual deploy via Railway CLI
railway up
```

### 6. Verify Deployment

```bash
# Test health check
curl https://your-gateway.railway.app/health

# Test gateway status
curl https://your-gateway.railway.app/gateway/status
```

---

## Troubleshooting

### Issue: Rate Limiter Error "ERR_ERL_PERMISSIVE_TRUST_PROXY"

**Solution:** This is fixed in v2.1.0. We disable the validation:

```javascript
rateLimit({
  // ...
  validate: { trustProxy: false }
});
```

### Issue: POST Requests Hang or Return "Empty reply from server"

**Cause:** Express body parser consumed the stream, and proxy can't re-read it.

**Solution:** Use the `fixRequestBody()` function to re-serialize and write the body:

```javascript
fixRequestBody(proxyReq, req);
```

### Issue: 502 Bad Gateway

**Possible Causes:**

1. Backend service not running
2. Incorrect service URL
3. Backend service crashed
4. Network timeout

**Debug Steps:**

```bash
# Check if service is running
curl http://localhost:8083/health

# Check gateway logs
tail -f logs/gateway.log

# Check service logs
tail -f ../application-service/logs/application.log

# Test direct connection to service
curl http://localhost:8083/api/students
```

### Issue: CORS Blocked

**Solution:** Add frontend origin to `CORS_ORIGIN` in `.env`:

```bash
CORS_ORIGIN=http://localhost:5173,https://your-app.railway.app
```

### Issue: JWT Authentication Fails

**Possible Causes:**

1. JWT_SECRET mismatch between gateway and services
2. Token expired
3. Token malformed

**Debug Steps:**

```bash
# Check JWT_SECRET is the same across all services
echo $JWT_SECRET

# Verify token structure
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq

# Test with a fresh token from login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### Issue: Request ID Not Propagated

**Solution:** Ensure you're using the latest version with `x-request-id` forwarding:

```javascript
if (req.id) {
  proxyReq.setHeader('x-request-id', req.id);
}
```

---

## Development

### Adding a New Service

1. **Add service URL to environment variables:**

```bash
# .env
NEW_SERVICE_URL=http://localhost:8088
```

2. **Update service configuration in server.js:**

```javascript
const SERVICES = {
  // ... existing services
  NEW_SERVICE: getServiceUrl('NEW_SERVICE_URL', 'http://localhost:8088')
};
```

3. **Create proxy route:**

```javascript
app.use(makeProxy(SERVICES.NEW_SERVICE, {
  filter: (pathname) => pathname.startsWith('/api/newservice')
}));
```

4. **Update health check (if needed):**

Edit `src/health-check.js` to include the new service.

### Adding a Public Route

Add the route to the `PUBLIC_ROUTES` array:

```javascript
const PUBLIC_ROUTES = [
  // ... existing routes
  '/newservice/public-endpoint'
];
```

**Note:** The path should NOT include `/api` prefix.

---

## Monitoring

### Logs

Logs are stored in `logs/` directory:

- `gateway-service.log` - All logs
- `gateway-service-error.log` - Errors only

### Log Format

```json
{
  "level": "info",
  "message": "[request-id] GET /api/users",
  "timestamp": "2025-10-21T12:00:00.000Z",
  "ip": "127.0.0.1",
  "userAgent": "Mozilla/5.0..."
}
```

### Metrics

Check gateway status for runtime metrics:

```bash
curl http://localhost:8080/gateway/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "operational",
    "version": "2.1.0",
    "type": "express-gateway",
    "features": {
      "authentication": "centralized-jwt",
      "rateLimit": "enabled",
      "compression": "enabled",
      "security": "helmet",
      "requestTracking": "uuid"
    },
    "timestamp": "2025-10-21T12:00:00.000Z",
    "services": {
      "USER_SERVICE": "http://localhost:8082",
      "APPLICATION_SERVICE": "http://localhost:8083",
      ...
    }
  }
}
```

---

## Best Practices

### 1. Environment Variables

- Never commit `.env` files
- Use Railway dashboard for production secrets
- Document all required variables

### 2. Error Handling

- Always return standardized JSON error responses
- Include error codes for client-side handling
- Log errors with context (request ID, user, etc.)

### 3. Security

- Keep `JWT_SECRET` secure and rotate periodically
- Use HTTPS in production
- Restrict CORS origins (no wildcards in production)
- Monitor rate limit violations

### 4. Performance

- Enable compression for large responses
- Use connection pooling for backend services
- Monitor response times and set appropriate timeouts

### 5. Deployment

- Test locally before deploying to Railway
- Use Railway Private Networking for service-to-service communication
- Only expose gateway publicly
- Monitor logs after deployment

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start gateway in production mode |
| `npm run dev` | Start gateway in development mode (nodemon) |
| `npm run smoke` | Run smoke tests |
| `npm run health:check` | Check health of all services |
| `npm test` | Run Jest tests (if available) |

---

## License

UNLICENSED - MTN Development Team

---

## Support

For issues or questions:

1. Check logs: `tail -f logs/gateway-service.log`
2. Run smoke tests: `npm run smoke`
3. Check service health: `npm run health:check`
4. Review this documentation
5. Contact MTN Development Team

---

## Changelog

### v2.1.0 (2025-10-21)

**Fixed:**

- Rate limiter validation error with `trust proxy: true`
- POST request body not being forwarded to backend services
- CSRF token headers not being propagated
- Request ID tracking not working end-to-end

**Added:**

- `fixRequestBody()` function to re-serialize Express-parsed bodies
- Request ID tracking with UUID v4
- Helmet security headers
- Compression middleware
- `/ready` endpoint for readiness checks
- Comprehensive smoke tests
- Detailed documentation

**Changed:**

- Increased timeout from 10s to 15s
- Improved logging with request IDs
- Updated health check responses

### v2.0.0 (Previous)

- Initial Express gateway implementation
- Centralized JWT authentication
- Basic proxy configuration
- CORS support

---

## Contributing

When contributing to the gateway:

1. Test all changes locally with smoke tests
2. Ensure all services can communicate through the gateway
3. Update documentation for any new features
4. Add smoke tests for new functionality
5. Test deployment to Railway staging environment

