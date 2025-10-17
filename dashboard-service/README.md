# Dashboard Service

Microservicio de estadísticas y métricas del sistema de admisión MTN. Proporciona analytics en tiempo real, dashboards interactivos y métricas agregadas del sistema.

## Características

- 📊 **Estadísticas generales** - Total de postulaciones, entrevistas, evaluaciones
- 📈 **Analytics avanzados** - Tendencias temporales, distribución de estados, tasas de conversión
- 🎯 **Métricas administrativas** - Tasas de completitud, promedios de calificaciones, top evaluadores
- 💾 **Cache in-memory** - Respuestas ultra-rápidas con TTL configurable
- 🛡️ **Circuit Breakers** - 4 categorías (Simple 2s, Medium 5s, Heavy 10s, Write 3s)
- 🔐 **Autenticación JWT** con RBAC
- 📝 **Logs estructurados** con Winston
- 🐳 **Docker** listo para producción

## Requisitos

- Node.js 18+
- PostgreSQL 12+

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar en desarrollo
npm run dev

# Iniciar en producción
npm start
```

## Configuración

### Variables de Entorno

```bash
# Server
NODE_ENV=development
PORT=8086

# Database (priority: DATABASE_URL > individual vars)
DATABASE_URL=postgresql://admin:admin123@localhost:5432/Admisión_MTN_DB
# OR
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123

# JWT
JWT_SECRET=your_secure_jwt_secret_here

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=5000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Cache
CACHE_ENABLED=true
CACHE_TTL_STATS=300000      # 5 min for general stats
CACHE_TTL_ANALYTICS=600000  # 10 min for analytics

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Docker

```bash
# Construir imagen
docker build -t dashboard-service .

# Iniciar con docker-compose
docker-compose up -d

# Ver logs
docker-compose logs -f dashboard-service

# Detener
docker-compose down
```

## API Endpoints

### Dashboard

```
GET /api/dashboard/stats                  # Estadísticas generales (ADMIN, COORDINATOR, TEACHER, PSYCHOLOGIST, CYCLE_DIRECTOR)
GET /api/dashboard/admin/stats            # Estadísticas administrativas (ADMIN, COORDINATOR)
GET /api/dashboard/cache/stats            # Estadísticas de cache (ADMIN)
POST /api/dashboard/cache/clear           # Limpiar cache (ADMIN)
```

### Analytics

```
GET /api/analytics/dashboard-metrics      # Métricas completas del dashboard (ADMIN, COORDINATOR)
GET /api/analytics/status-distribution    # Distribución de estados (ADMIN, COORDINATOR, TEACHER)
GET /api/analytics/temporal-trends        # Tendencias temporales últimos 30 días (ADMIN, COORDINATOR)
```

### Health Check

```
GET /health  # Estado del servicio
```

## Ejemplos de Uso

### Obtener Token JWT (desde User Service)

```bash
# Login
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jorge.gangale@mtn.cl",
    "password": "admin123"
  }'

# Guardar el token que se retorna
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Estadísticas Generales

```bash
curl http://localhost:8086/api/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "success": true,
#   "data": {
#     "totalApplications": 245,
#     "applicationsByStatus": [
#       { "status": "SUBMITTED", "count": 120 },
#       { "status": "UNDER_REVIEW", "count": 85 },
#       { "status": "APPROVED", "count": 30 },
#       { "status": "REJECTED", "count": 10 }
#     ],
#     "applicationsByGrade": [
#       { "grade": "1° Básico", "count": 50 },
#       { "grade": "2° Básico", "count": 45 }
#     ],
#     "recentApplications": 32,
#     "totalInterviews": 180,
#     "interviewsByStatus": [...],
#     "totalEvaluations": 215
#   }
# }
```

### Estadísticas Administrativas

```bash
curl http://localhost:8086/api/dashboard/admin/stats \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "success": true,
#   "data": {
#     "conversionRate": "25.50",
#     "averageScores": [
#       { "evaluationType": "MATHEMATICS_EXAM", "averageScore": "75.30", "averageMaxScore": "100.00" },
#       { "evaluationType": "LANGUAGE_EXAM", "averageScore": "82.15", "averageMaxScore": "100.00" }
#     ],
#     "documentCompletionRate": "68.20",
#     "interviewCompletionRate": "92.40",
#     "applicationsPerMonth": [
#       { "month": "2025-01", "count": 45 },
#       { "month": "2025-02", "count": 67 }
#     ]
#   }
# }
```

### Analytics Dashboard Completo

```bash
curl http://localhost:8086/api/analytics/dashboard-metrics \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "success": true,
#   "data": {
#     "applicationsTrend": [
#       { "month": "2024-11", "total": 45, "approved": 12, "rejected": 3 },
#       { "month": "2024-12", "total": 67, "approved": 18, "rejected": 5 }
#     ],
#     "scoresDistribution": [
#       {
#         "evaluationType": "MATHEMATICS_EXAM",
#         "minScore": "45.00",
#         "maxScore": "100.00",
#         "avgScore": "75.30",
#         "stddevScore": "12.45",
#         "count": 85
#       }
#     ],
#     "interviewTypes": [
#       { "type": "FAMILY_INTERVIEW", "count": 95 },
#       { "type": "STUDENT_INTERVIEW", "count": 85 }
#     ],
#     "topEvaluators": [
#       { "name": "María González", "email": "maria.gonzalez@mtn.cl", "evaluationCount": 45 }
#     ]
#   }
# }
```

### Distribución de Estados

```bash
curl http://localhost:8086/api/analytics/status-distribution \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "success": true,
#   "data": [
#     { "status": "SUBMITTED", "count": 120, "percentage": "48.98" },
#     { "status": "UNDER_REVIEW", "count": 85, "percentage": "34.69" },
#     { "status": "APPROVED", "count": 30, "percentage": "12.24" },
#     { "status": "REJECTED", "count": 10, "percentage": "4.08" }
#   ]
# }
```

### Tendencias Temporales (Últimos 30 días)

```bash
curl http://localhost:8086/api/analytics/temporal-trends \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "success": true,
#   "data": [
#     { "date": "2025-10-15", "applications": 12, "approved": 3, "rejected": 1, "underReview": 8 },
#     { "date": "2025-10-16", "applications": 8, "approved": 2, "rejected": 0, "underReview": 6 }
#   ]
# }
```

### Estadísticas de Cache

```bash
curl http://localhost:8086/api/dashboard/cache/stats \
  -H "Authorization: Bearer $TOKEN"

# Response:
# {
#   "success": true,
#   "data": {
#     "enabled": true,
#     "totalKeys": 5,
#     "activeKeys": 5,
#     "expiredKeys": 0,
#     "memoryUsage": 52428800
#   }
# }
```

### Limpiar Cache

```bash
# Limpiar todo el cache
curl -X POST http://localhost:8086/api/dashboard/cache/clear \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Limpiar cache con patrón específico
curl -X POST http://localhost:8086/api/dashboard/cache/clear \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "analytics"}'

# Response:
# {
#   "success": true,
#   "data": {
#     "message": "Cache cleared successfully",
#     "pattern": "analytics"
#   }
# }
```

## Métricas Disponibles

### General Stats

| Métrica | Descripción | Cache TTL |
|---------|-------------|-----------|
| `totalApplications` | Total de postulaciones | 5 min |
| `applicationsByStatus` | Postulaciones por estado | 5 min |
| `applicationsByGrade` | Postulaciones por grado | 5 min |
| `recentApplications` | Postulaciones últimos 7 días | 5 min |
| `totalInterviews` | Total de entrevistas | 5 min |
| `interviewsByStatus` | Entrevistas por estado | 5 min |
| `totalEvaluations` | Total de evaluaciones | 5 min |

### Admin Stats

| Métrica | Descripción | Cache TTL |
|---------|-------------|-----------|
| `conversionRate` | Tasa de conversión (submitted → approved) | 3 min |
| `averageScores` | Promedios por tipo de evaluación | 3 min |
| `documentCompletionRate` | Tasa de completitud de documentos | 3 min |
| `interviewCompletionRate` | Tasa de completitud de entrevistas | 3 min |
| `applicationsPerMonth` | Postulaciones por mes (año actual) | 3 min |

### Analytics Dashboard

| Métrica | Descripción | Cache TTL |
|---------|-------------|-----------|
| `applicationsTrend` | Tendencia últimos 12 meses | 10 min |
| `scoresDistribution` | Distribución de puntajes por tipo | 10 min |
| `interviewTypes` | Distribución de tipos de entrevista | 10 min |
| `topEvaluators` | Top 10 evaluadores por volumen | 10 min |

### Status Distribution

| Métrica | Descripción | Cache TTL |
|---------|-------------|-----------|
| `status` | Estado de la postulación | 10 min |
| `count` | Cantidad en ese estado | 10 min |
| `percentage` | Porcentaje del total | 10 min |

### Temporal Trends

| Métrica | Descripción | Cache TTL |
|---------|-------------|-----------|
| `date` | Fecha | 15 min |
| `applications` | Total de postulaciones ese día | 15 min |
| `approved` | Aprobadas ese día | 15 min |
| `rejected` | Rechazadas ese día | 15 min |
| `underReview` | En revisión ese día | 15 min |

## Circuit Breakers

El servicio implementa 4 categorías de circuit breakers:

### 1. Simple Query Breaker (2s timeout)

- **Uso**: Consultas rápidas de lookup
- **Timeout**: 2000ms
- **Error Threshold**: 60%
- **Reset Timeout**: 20s

**Endpoints protegidos:**
- `/api/analytics/status-distribution`

### 2. Medium Query Breaker (5s timeout)

- **Uso**: Consultas estándar con joins moderados
- **Timeout**: 5000ms
- **Error Threshold**: 50%
- **Reset Timeout**: 30s

**Endpoints protegidos:**
- `/api/dashboard/stats`
- `/api/dashboard/admin/stats`

### 3. Heavy Query Breaker (10s timeout)

- **Uso**: Analytics complejos con agregaciones pesadas
- **Timeout**: 10000ms
- **Error Threshold**: 40%
- **Reset Timeout**: 60s

**Endpoints protegidos:**
- `/api/analytics/dashboard-metrics`
- `/api/analytics/temporal-trends`

### 4. Write Operation Breaker (3s timeout)

- **Uso**: Operaciones de escritura (actualmente solo cache)
- **Timeout**: 3000ms
- **Error Threshold**: 30%
- **Reset Timeout**: 45s

**Operaciones protegidas:**
- Cache clear operations

## Cache

El servicio utiliza cache in-memory con TTL configurable:

### Configuración

```bash
CACHE_ENABLED=true              # Habilitar/deshabilitar cache
CACHE_TTL_STATS=300000          # 5 min para stats generales
CACHE_TTL_ANALYTICS=600000      # 10 min para analytics
```

### Cache Keys

| Key | Endpoint | TTL |
|-----|----------|-----|
| `dashboard:stats:general` | `/api/dashboard/stats` | 5 min |
| `dashboard:stats:admin` | `/api/dashboard/admin/stats` | 3 min |
| `analytics:dashboard:metrics` | `/api/analytics/dashboard-metrics` | 10 min |
| `analytics:status:distribution` | `/api/analytics/status-distribution` | 10 min |
| `analytics:temporal:trends` | `/api/analytics/temporal-trends` | 15 min |

### Cache Management

```bash
# Ver estadísticas
curl http://localhost:8086/api/dashboard/cache/stats \
  -H "Authorization: Bearer $TOKEN"

# Limpiar todo
curl -X POST http://localhost:8086/api/dashboard/cache/clear \
  -H "Authorization: Bearer $TOKEN"

# Limpiar por patrón
curl -X POST http://localhost:8086/api/dashboard/cache/clear \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pattern": "analytics"}'
```

## Logs

Los logs se guardan en:

- `logs/dashboard-service-*.log` - Todos los logs
- `logs/dashboard-service-error-*.log` - Solo errores

Formato JSON estructurado con Winston.

```bash
# Ver logs en tiempo real
tail -f logs/dashboard-service-*.log

# Ver solo errores
tail -f logs/dashboard-service-error-*.log

# Buscar por patrón
grep "Circuit Breaker" logs/dashboard-service-*.log
```

## Testing

```bash
# Unit tests
npm test

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Base de Datos

El servicio consume las siguientes tablas:

- `applications` - Postulaciones
- `interviews` - Entrevistas
- `evaluations` - Evaluaciones
- `users` - Usuarios (para top evaluadores)

No crea ni modifica datos, solo lectura.

## Seguridad

- ✅ Autenticación JWT requerida
- ✅ RBAC (diferentes niveles de acceso)
- ✅ CORS configurado
- ✅ Usuario no-root en Docker
- ✅ Circuit breakers para protección
- ✅ Rate limiting (recomendado en NGINX)

## Performance

**Connection Pooling:**
- 20 conexiones máximo
- Idle timeout: 30s
- Connection timeout: 2s
- Query timeout: 5s (ajustable por breaker)

**Cache:**
- In-memory cache con TTL
- Hit rate esperado: 70-90%
- Latencia cache hit: <1ms
- Latencia cache miss: 50-500ms (según query)

**Expected Response Times:**

| Endpoint | Cache Hit | Cache Miss | Circuit Breaker |
|----------|-----------|------------|-----------------|
| `/api/dashboard/stats` | <1ms | 100-200ms | Medium (5s) |
| `/api/dashboard/admin/stats` | <1ms | 150-300ms | Medium (5s) |
| `/api/analytics/dashboard-metrics` | <1ms | 500-1000ms | Heavy (10s) |
| `/api/analytics/status-distribution` | <1ms | 50-100ms | Simple (2s) |
| `/api/analytics/temporal-trends` | <1ms | 300-800ms | Heavy (10s) |

## Troubleshooting

### Puerto 8086 en uso

```bash
# Encontrar proceso
lsof -ti:8086

# Matar proceso
lsof -ti:8086 | xargs kill -9
```

### Error de conexión a base de datos

```bash
# Verificar que PostgreSQL está corriendo
psql -h localhost -U admin -d "Admisión_MTN_DB" -c "SELECT 1"

# Verificar credenciales en .env
cat .env | grep DB_
```

### Cache no funciona

- Verificar que `CACHE_ENABLED=true`
- Revisar logs para errores
- Verificar memoria disponible

### Circuit breaker abierto

- Esperar el reset timeout (20s-60s según breaker)
- Verificar logs para errores de base de datos
- Revisar que las queries no sean demasiado lentas

## Contribuir

1. Fork el proyecto
2. Crear branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push al branch (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## Licencia

Propietario: Colegio Monte Tabor y Nazaret

## Contacto

Equipo de Desarrollo MTN - admision@mtn.cl
