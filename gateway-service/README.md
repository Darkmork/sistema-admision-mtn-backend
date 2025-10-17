# Gateway Service - API Gateway

**Sistema de Admisión - Colegio Monte Tabor y Nazaret**

NGINX-based API Gateway that routes all HTTP requests to backend microservices with rate limiting, health monitoring, circuit breaker integration, and connection pooling.

---

## Overview

The Gateway Service acts as the single entry point for all client requests, providing:

- **Centralized Routing**: Routes requests to 6 backend microservices
- **Load Balancing**: Distributes traffic with health checking
- **Rate Limiting**: Protects services from abuse (20 req/s per IP)
- **Connection Pooling**: Maintains keepalive connections (32 per upstream)
- **CORS Management**: Handles cross-origin requests
- **Request Buffering**: Optimized for large file uploads (50MB)
- **Health Monitoring**: Real-time health checks for all services
- **Timeout Alignment**: Coordinated with circuit breakers (3s connect, 8s read)

---

## Architecture

```
                          ┌─────────────────────────┐
                          │   NGINX API Gateway     │
                          │     Port 8080           │
                          └───────────┬─────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    ┌─────▼─────┐             ┌──────▼──────┐           ┌───────▼────────┐
    │   User    │             │ Application │           │  Evaluation    │
    │  Service  │             │   Service   │           │    Service     │
    │  :8082    │             │   :8083     │           │    :8084       │
    └───────────┘             └─────────────┘           └────────────────┘
          │                           │                           │
          │                    ┌──────▼──────┐           ┌───────▼────────┐
          │                    │Notification │           │   Dashboard    │
          │                    │   Service   │           │    Service     │
          │                    │   :8085     │           │    :8086       │
          │                    └─────────────┘           └────────────────┘
          │                           │
          │                    ┌──────▼──────┐
          └────────────────────┤  Guardian   │
                               │   Service   │
                               │   :8087     │
                               └─────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   PostgreSQL DB       │
                          │ "Admisión_MTN_DB"     │
                          │   Port 5432           │
                          └───────────────────────┘
```

---

## Service Routing Map

| Route Pattern         | Upstream Service      | Port | Purpose                    |
|-----------------------|-----------------------|------|----------------------------|
| `/api/auth/*`         | User Service          | 8082 | Authentication & JWT       |
| `/api/users/*`        | User Service          | 8082 | User management            |
| `/api/applications/*` | Application Service   | 8083 | Student applications       |
| `/api/documents/*`    | Application Service   | 8083 | Document uploads           |
| `/api/evaluations/*`  | Evaluation Service    | 8084 | Academic evaluations       |
| `/api/interviews/*`   | Evaluation Service    | 8084 | Interview scheduling       |
| `/api/notifications/*`| Notification Service  | 8085 | Push notifications         |
| `/api/email/*`        | Notification Service  | 8085 | Email delivery             |
| `/api/dashboard/*`    | Dashboard Service     | 8086 | Statistics & metrics       |
| `/api/analytics/*`    | Dashboard Service     | 8086 | Analytics queries          |
| `/api/guardians/*`    | Guardian Service      | 8087 | Guardian management        |
| `/gateway/status`     | Gateway Health        | 8080 | Gateway health check       |

---

## Installation

### Prerequisites

- **NGINX** 1.18+ (Alpine 1.25 for Docker)
- **Node.js** 18+ (for management server)
- **npm** 9+
- **Docker** 20+ (optional, for containerized deployment)
- **curl** (for health checks)

### Install NGINX

**macOS:**
```bash
brew install nginx
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install nginx
```

**Alpine (Docker):**
```bash
apk add --no-cache nginx curl
```

### Install Node.js Dependencies

```bash
cd gateway-service
npm install
```

**Dependencies installed:**
- `express` ^5.1.0 - Management server
- `axios` ^1.7.9 - HTTP client for health checks
- `winston` ^3.18.3 - Structured logging
- `cors` ^2.8.5 - CORS middleware

---

## Configuration

### Environment Variables (.env)

```bash
# Gateway Configuration
NODE_ENV=development
PORT=3000                           # Management server port
NGINX_PORT=8080                     # NGINX gateway port
LOG_LEVEL=info

# Service URLs - Local Development
USER_SERVICE_URL=http://localhost:8082
APPLICATION_SERVICE_URL=http://localhost:8083
EVALUATION_SERVICE_URL=http://localhost:8084
NOTIFICATION_SERVICE_URL=http://localhost:8085
DASHBOARD_SERVICE_URL=http://localhost:8086
GUARDIAN_SERVICE_URL=http://localhost:8087

# Service URLs - Docker
USER_SERVICE_DOCKER_URL=http://user-service:8082
APPLICATION_SERVICE_DOCKER_URL=http://application-service:8083
EVALUATION_SERVICE_DOCKER_URL=http://evaluation-service:8084
NOTIFICATION_SERVICE_DOCKER_URL=http://notification-service:8085
DASHBOARD_SERVICE_DOCKER_URL=http://dashboard-service:8086
GUARDIAN_SERVICE_DOCKER_URL=http://guardian-service:8087

# Health Check Configuration
HEALTH_CHECK_TIMEOUT=5000
HEALTH_CHECK_INTERVAL=30000
```

### NGINX Configuration

**Two configurations available:**

1. **Local Development**: `config/nginx.conf`
   - Uses `localhost` for upstream services
   - Uses `kqueue` I/O event method (macOS/BSD)
   - Logs to `logs/` directory

2. **Docker Deployment**: `config/nginx-docker.conf`
   - Uses Docker service names for upstreams
   - Uses `epoll` I/O event method (Linux)
   - Logs to `/var/log/nginx/`

**Key NGINX Features:**

```nginx
# Worker Configuration
worker_processes auto;
worker_connections 4096;
multi_accept on;
use kqueue;                    # macOS/BSD (epoll for Linux)

# Upstream Configuration
upstream user-service {
    server localhost:8082 max_fails=2 fail_timeout=10s;
    keepalive 32;               # Keep 32 connections alive
    keepalive_requests 100;     # Reuse connections up to 100 requests
    keepalive_timeout 60s;
}

# Timeouts (aligned with circuit breakers)
proxy_connect_timeout 3s;      # Connection to backend
proxy_read_timeout 8s;         # Read from backend (5s CB + 3s margin)
proxy_send_timeout 10s;        # Send to backend
client_max_body_size 50M;      # File uploads

# Rate Limiting
limit_req_zone $binary_remote_addr zone=api_by_ip:10m rate=20r/s;
limit_req_zone $http_authorization zone=api_by_token:10m rate=100r/s;
limit_conn_zone $binary_remote_addr zone=conn_by_ip:10m;

# Compression
gzip on;
gzip_comp_level 5;
gzip_types application/json text/plain text/css application/javascript;
```

---

## Usage

### Start Gateway (Local Development)

**Option 1: Using script**
```bash
cd gateway-service
chmod +x scripts/start-gateway.sh
./scripts/start-gateway.sh
```

**Option 2: Manual start**
```bash
# Test NGINX configuration
nginx -t -c "$(pwd)/config/nginx.conf"

# Start NGINX
nginx -c "$(pwd)/config/nginx.conf"

# Start management server (optional)
npm start
```

### Stop Gateway

**Option 1: Using script**
```bash
./scripts/stop-gateway.sh
```

**Option 2: Manual stop**
```bash
# Graceful stop
nginx -s stop

# Force kill (if needed)
pkill -9 nginx
```

### Reload Configuration

```bash
# Test configuration first
nginx -t -c "$(pwd)/config/nginx.conf"

# Reload without downtime
nginx -s reload
```

### Test Gateway Routes

```bash
# Test all routes
./scripts/test-routes.sh

# Test specific route
curl http://localhost:8080/gateway/status

# Test with authentication
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:8080/api/users/me
```

---

## Docker Deployment

### Build Gateway Image

```bash
cd gateway-service
docker build -t gateway-service:latest .
```

### Run with Docker Compose

```bash
# Start all services (gateway + microservices + postgres)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f gateway

# Stop all services
docker-compose down
```

### Docker Compose Configuration

The `docker-compose.yml` orchestrates:
- **gateway**: NGINX gateway (port 8080)
- **user-service**: User management (port 8082)
- **application-service**: Applications (port 8083)
- **evaluation-service**: Evaluations (port 8084)
- **notification-service**: Notifications (port 8085)
- **dashboard-service**: Dashboard (port 8086)
- **guardian-service**: Guardians (port 8087)
- **postgres**: PostgreSQL database (port 5432)

All services connect via `mtn-network` bridge network.

---

## Health Monitoring

### Gateway Health Check

```bash
curl http://localhost:8080/gateway/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "gateway",
    "timestamp": "2025-10-16T12:00:00.000Z",
    "uptime": 3600,
    "version": "1.0.0"
  }
}
```

### All Services Health Check

**Using CLI tool:**
```bash
# Single check
node src/health-check.js

# Continuous monitoring (every 10 seconds)
node src/health-check.js --monitor
```

**Using management server API:**
```bash
# Start management server
npm start

# Check all services
curl http://localhost:3000/api/services/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-16T12:00:00.000Z",
    "totalServices": 7,
    "healthyServices": 7,
    "unhealthyServices": 0,
    "services": [
      {
        "name": "Gateway",
        "status": "healthy",
        "responseTime": "15ms"
      },
      {
        "name": "User Service",
        "status": "healthy",
        "responseTime": "42ms"
      }
      // ... all services
    ]
  }
}
```

### Individual Service Health

```bash
# User Service
curl http://localhost:8082/health

# Application Service
curl http://localhost:8083/health

# Evaluation Service
curl http://localhost:8084/health

# Notification Service
curl http://localhost:8085/health

# Dashboard Service
curl http://localhost:8086/health

# Guardian Service
curl http://localhost:8087/health
```

---

## Rate Limiting

The gateway implements multiple rate limiting strategies:

### 1. Rate Limiting by IP Address

```nginx
limit_req zone=api_by_ip burst=30 nodelay;
```

- **Limit**: 20 requests/second per IP
- **Burst**: 30 additional requests allowed
- **Mode**: `nodelay` - No queuing, immediate response

**Applied to:**
- `/api/applications/*` (submission protection)
- `/api/documents/*` (upload protection)
- `/api/email/*` (spam protection)

### 2. Rate Limiting by Token

```nginx
limit_req zone=api_by_token burst=50 nodelay;
```

- **Limit**: 100 requests/second per JWT token
- **Burst**: 50 additional requests allowed

**Applied to:**
- All authenticated routes

### 3. Connection Limiting

```nginx
limit_conn conn_by_ip 10;
```

- **Limit**: 10 concurrent connections per IP

**HTTP 429 Response (Rate Limited):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  },
  "timestamp": "2025-10-16T12:00:00.000Z"
}
```

---

## Performance Optimization

### Connection Pooling

Each upstream maintains a pool of keepalive connections:

```nginx
upstream user-service {
    server localhost:8082 max_fails=2 fail_timeout=10s;
    keepalive 32;               # Pool size
    keepalive_requests 100;     # Reuse each connection 100 times
    keepalive_timeout 60s;      # Keep connections alive for 60s
}
```

**Benefits:**
- Eliminates TCP handshake overhead
- Reduces latency by 50-70%
- Increases throughput by 20-30%

### Request Buffering

```nginx
proxy_buffer_size 8k;           # Header buffer
proxy_buffers 16 8k;            # Body buffers (128KB total)
proxy_busy_buffers_size 16k;    # Max busy buffers
```

**Benefits:**
- Handles large JSON payloads efficiently
- Prevents memory issues with large requests
- Optimized for 50MB file uploads

### Compression

```nginx
gzip on;
gzip_comp_level 5;
gzip_types application/json text/plain text/css application/javascript;
```

**Benefits:**
- Reduces bandwidth usage by 70-80% for JSON
- Faster response times for large payloads
- Minimal CPU overhead (level 5)

---

## Timeout Configuration

All timeouts are aligned with backend circuit breakers:

| Timeout Type          | Value | Purpose                              |
|-----------------------|-------|--------------------------------------|
| `proxy_connect_timeout` | 3s    | Connect to backend service           |
| `proxy_read_timeout`    | 8s    | Read response (5s CB + 3s margin)    |
| `proxy_send_timeout`    | 10s   | Send request to backend              |
| `client_body_timeout`   | 12s   | Receive request body from client     |
| `client_header_timeout` | 12s   | Receive request headers from client  |
| `send_timeout`          | 15s   | Send response to client              |
| `keepalive_timeout`     | 65s   | Keep client connection alive         |

**Document Upload Timeout:**
```nginx
location /api/documents {
    proxy_read_timeout 30s;     # Extended for large uploads
    client_max_body_size 50M;
}
```

---

## CORS Configuration

The gateway handles CORS for all routes:

```nginx
add_header 'Access-Control-Allow-Origin' 'http://localhost:5173' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, x-correlation-id, x-request-time, x-timezone, x-client-type, x-client-version' always;
add_header 'Access-Control-Allow-Credentials' 'true' always;
add_header 'Access-Control-Max-Age' '86400' always;
```

**Preflight Requests:**
```nginx
if ($request_method = 'OPTIONS') {
    add_header 'Access-Control-Allow-Origin' 'http://localhost:5173' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, x-correlation-id, x-request-time, x-timezone, x-client-type, x-client-version' always;
    add_header 'Access-Control-Max-Age' '86400' always;
    return 204;
}
```

---

## Logging

### NGINX Access Logs

**Local development:**
```bash
tail -f logs/access.log
```

**Docker:**
```bash
docker exec gateway-service tail -f /var/log/nginx/access.log
```

**Log format:**
```
192.168.1.100 - - [16/Oct/2025:12:00:00 +0000] "GET /api/users/me HTTP/1.1" 200 456 "-" "Mozilla/5.0"
```

### NGINX Error Logs

**Local development:**
```bash
tail -f logs/error.log
```

**Docker:**
```bash
docker exec gateway-service tail -f /var/log/nginx/error.log
```

### Management Server Logs

**Winston JSON logs:**
```bash
tail -f logs/gateway-service-2025-10-16.log
```

**Log entry example:**
```json
{
  "level": "info",
  "message": "Health check completed",
  "timestamp": "2025-10-16T12:00:00.000Z",
  "service": "gateway-service",
  "healthyServices": 7,
  "unhealthyServices": 0
}
```

---

## Troubleshooting

### Gateway Not Starting

**Issue**: NGINX fails to start

**Check:**
```bash
# Test configuration
nginx -t -c "$(pwd)/config/nginx.conf"

# Check if NGINX is already running
pgrep -x nginx

# Check port 8080 availability
lsof -ti:8080
```

**Solution:**
```bash
# Kill existing NGINX
pkill -9 nginx

# Fix configuration errors
nano config/nginx.conf

# Restart
./scripts/start-gateway.sh
```

### 502 Bad Gateway

**Issue**: Gateway returns 502 when accessing services

**Check:**
```bash
# Verify backend services are running
curl http://localhost:8082/health
curl http://localhost:8083/health
# ... check all services

# Check NGINX error logs
tail -f logs/error.log
```

**Common causes:**
- Backend service not running
- Backend service crashed
- Port mismatch in NGINX config
- Firewall blocking connections

**Solution:**
```bash
# Start missing services
cd user-service && node src/server.js &
cd application-service && node src/server.js &
# ... start all services

# Reload NGINX
nginx -s reload
```

### 429 Too Many Requests

**Issue**: Rate limiting triggered

**Check:**
```bash
# View NGINX error logs
tail -f logs/error.log | grep "limiting requests"
```

**Solution:**
- Implement exponential backoff in client
- Request rate limit increase
- Use authentication token (higher limit)

**Adjust rate limits:**
```nginx
# config/nginx.conf
limit_req_zone $binary_remote_addr zone=api_by_ip:10m rate=50r/s;  # Increase from 20r/s
```

### CORS Errors

**Issue**: Browser blocks requests due to CORS

**Check browser console:**
```
Access to XMLHttpRequest at 'http://localhost:8080/api/users' from origin
'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
```bash
# Verify allowed origin in config/nginx.conf
grep "Access-Control-Allow-Origin" config/nginx.conf

# Should match frontend URL exactly
add_header 'Access-Control-Allow-Origin' 'http://localhost:5173' always;

# Reload NGINX
nginx -s reload
```

### High Latency

**Issue**: Slow response times

**Check:**
```bash
# Test individual services
time curl http://localhost:8082/health
time curl http://localhost:8083/health

# Check NGINX access logs for response times
tail -f logs/access.log
```

**Solutions:**
- Increase keepalive connections: `keepalive 64;`
- Reduce timeouts if too high
- Enable compression for large payloads
- Check backend service performance

### Memory Issues

**Issue**: NGINX consuming too much memory

**Check:**
```bash
# Check NGINX processes
ps aux | grep nginx

# Check memory usage
top -pid $(pgrep -x nginx)
```

**Solutions:**
```nginx
# Reduce buffer sizes
proxy_buffers 8 4k;          # Reduce from 16 8k
worker_connections 2048;     # Reduce from 4096
```

### SSL/TLS Issues (Production)

**Issue**: HTTPS not working

**Check:**
```bash
# Test SSL certificate
openssl s_client -connect localhost:443

# Check certificate expiration
openssl x509 -in /path/to/cert.pem -noout -dates
```

**Solution:**
```nginx
# Add SSL configuration
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

---

## Development

### npm Scripts

```bash
# Start management server
npm start

# Start with auto-reload (nodemon)
npm run dev

# Start NGINX
npm run nginx:start

# Stop NGINX
npm run nginx:stop

# Reload NGINX config
npm run nginx:reload

# Run health checks
npm run health:check
```

### Adding a New Service Route

1. **Define upstream:**
```nginx
# config/nginx.conf
upstream new-service {
    server localhost:8088 max_fails=2 fail_timeout=10s;
    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;
}
```

2. **Add location block:**
```nginx
location /api/newservice {
    limit_req zone=api_by_ip burst=30 nodelay;
    limit_conn conn_by_ip 10;

    proxy_pass http://new-service;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_connect_timeout 3s;
    proxy_read_timeout 8s;
    proxy_send_timeout 10s;
}
```

3. **Reload NGINX:**
```bash
nginx -t -c "$(pwd)/config/nginx.conf"
nginx -s reload
```

4. **Test route:**
```bash
curl http://localhost:8080/api/newservice/health
```

---

## Security Considerations

### Rate Limiting

- Protects against DDoS attacks
- Prevents API abuse
- Configured per-IP and per-token

### Request Size Limits

```nginx
client_max_body_size 50M;        # Maximum request body size
client_body_buffer_size 128k;    # Buffer for request body
large_client_header_buffers 4 16k;  # Maximum header size
```

### Timeout Protection

- Prevents slowloris attacks
- Releases resources quickly
- Aligned with circuit breaker timeouts

### Header Security (Production)

```nginx
# Add these headers for production
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
```

### JWT Validation

- Gateway passes JWT tokens to backend services
- Each service validates tokens independently
- No token validation at gateway level (performance)

---

## Production Deployment

### Environment-Specific Configuration

**Staging:**
- Rate limits: 50 req/s
- Timeouts: Standard (3s/8s/10s)
- Logging: INFO level
- CORS: Staging frontend origin

**Production:**
- Rate limits: 20 req/s (stricter)
- Timeouts: Standard (3s/8s/10s)
- Logging: WARN level
- CORS: Production frontend origin
- SSL/TLS: Required (port 443)
- HTTP → HTTPS redirect

### SSL/TLS Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.mtn-admision.cl;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # SSL session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # ... rest of configuration
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name api.mtn-admision.cl;
    return 301 https://$server_name$request_uri;
}
```

### Monitoring and Alerting

**Recommended monitoring:**
- NGINX status endpoint
- Service health checks (every 30s)
- Error rate tracking
- Response time tracking
- Rate limit violations
- Circuit breaker state changes

**Alerting thresholds:**
- Error rate > 5%
- Response time > 1000ms (p95)
- Service health check failures
- Rate limit violations > 100/min
- Circuit breaker OPEN state

---

## Performance Metrics

### Expected Performance

**Throughput:**
- 10,000 requests/second (keep-alive enabled)
- 2,000 requests/second (no keep-alive)

**Latency:**
- p50: < 20ms (gateway overhead)
- p95: < 50ms
- p99: < 100ms

**Connection Pooling:**
- 32 connections per upstream (6 services = 192 total)
- Each connection reused up to 100 requests
- Connection kept alive for 60s

**Memory Usage:**
- Base: ~10-20MB (NGINX)
- Per connection: ~1-2KB
- Maximum: ~100MB (under load)

---

## API Examples

### User Authentication

```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jorge.gangale@mtn.cl",
    "password": "admin123"
  }'

# Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "jorge.gangale@mtn.cl",
      "role": "ADMIN"
    }
  }
}
```

### Get Applications

```bash
curl -X GET http://localhost:8080/api/applications \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Create Application

```bash
curl -X POST http://localhost:8080/api/applications \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentFirstName": "Juan",
    "studentPaternalLastName": "Pérez",
    "studentMaternalLastName": "González",
    "gradeApplying": "KINDER",
    "applicationYear": 2026
  }'
```

### Upload Document

```bash
curl -X POST http://localhost:8080/api/documents/upload \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@/path/to/document.pdf" \
  -F "applicationId=123" \
  -F "documentType=BIRTH_CERTIFICATE"
```

### Get Dashboard Stats

```bash
curl -X GET http://localhost:8080/api/dashboard/stats \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## Contributing

When modifying the gateway configuration:

1. **Test configuration:**
   ```bash
   nginx -t -c "$(pwd)/config/nginx.conf"
   ```

2. **Update both configs:**
   - `config/nginx.conf` (local)
   - `config/nginx-docker.conf` (Docker)

3. **Test routes:**
   ```bash
   ./scripts/test-routes.sh
   ```

4. **Document changes:**
   - Update this README
   - Update route mapping table
   - Update timeout/rate limit sections

5. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat(gateway): Add new route for X service"
   ```

---

## Related Documentation

- **NGINX Documentation**: https://nginx.org/en/docs/
- **NGINX Rate Limiting**: https://www.nginx.com/blog/rate-limiting-nginx/
- **NGINX Load Balancing**: https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/
- **Express.js**: https://expressjs.com/
- **Winston Logger**: https://github.com/winstonjs/winston
- **Docker Compose**: https://docs.docker.com/compose/

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review NGINX error logs: `tail -f logs/error.log`
3. Check service health: `node src/health-check.js`
4. Contact DevOps team

---

## License

Sistema de Admisión MTN - Internal Use Only

---

**Gateway Service v1.0.0**
*Last updated: October 2025*
