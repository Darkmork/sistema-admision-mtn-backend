# FASE 0: ANÁLISIS Y PREPARACIÓN
**Fecha**: 2025-10-20
**Objetivo**: Inventario completo de la arquitectura actual de microservicios para planificar mejoras basadas en el backend híbrido de referencia

---

## PASO 0.1: INVENTARIO DE ESTRUCTURA ACTUAL

### Resumen General

**Arquitectura**: 7 microservicios independientes + 1 gateway
**Puertos**:
- User Service: 8082
- Application Service: 8083
- Evaluation Service: 8084
- Notification Service: 8085
- Dashboard Service: 8086
- Guardian Service: 8087
- Gateway Service: 8080 (NGINX)

**Base de Datos**: PostgreSQL compartida con pools de conexión independientes
**Tecnologías Comunes**: Node.js, Express 5.1.0, PostgreSQL (pg 8.16.3)

---

### 1. USER-SERVICE (Puerto 8082)

**Descripción**: Autenticación y gestión de usuarios
**Puerto**: 8082
**Entry Point**: `src/index.js`

#### Estructura de Archivos
```
src/
├── config/
│   ├── circuitBreaker.js
│   └── database.js
├── controllers/
│   └── authController.js
├── middleware/
│   ├── authMiddleware.js
│   └── csrfMiddleware.js      ⚠️ CSRF implementado
├── routes/
│   ├── authRoutes.js
│   ├── debugRoutes.js
│   └── userRoutes.js
└── services/
    └── authService.js
```

#### Dependencias Principales
```json
{
  "bcryptjs": "^3.0.2",
  "compression": "^1.7.4",
  "cookie-parser": "^1.4.6",      ⚠️ Para CSRF cookies
  "cors": "^2.8.5",
  "dotenv": "^16.0.3",
  "express": "^5.1.0",
  "jsonwebtoken": "^9.0.2",
  "opossum": "^9.0.0",            ✅ Circuit breaker
  "pg": "^8.16.3"
}
```

#### Características Clave
- ✅ **Circuit Breaker**: Implementado con Opossum
- ✅ **CSRF Protection**: Middleware personalizado
- ✅ **JWT Authentication**: jsonwebtoken
- ✅ **Cookie Parser**: Para CSRF double-submit
- ❌ **Response Helpers**: NO encontrados
- ❌ **Logger Estructurado**: NO encontrado (winston)
- ❌ **Caché**: NO implementado

#### Patrón Detectado
```javascript
// Tiene CSRF middleware - Avanzado
// Tiene cookie-parser - Avanzado
// NO tiene utils/responseHelpers.js
// NO tiene utils/logger.js
```

---

### 2. APPLICATION-SERVICE (Puerto 8083)

**Descripción**: Gestión de postulaciones y documentos
**Puerto**: 8083
**Entry Point**: `src/server.js`

#### Estructura de Archivos
```
src/
├── app.js
├── server.js
├── config/
│   ├── circuitBreakers.js
│   └── database.js
├── controllers/
│   ├── ApplicationController.js
│   └── DocumentController.js
├── middleware/
│   ├── auth.js
│   ├── upload.js
│   └── validators.js
├── models/
│   ├── Application.js
│   └── Document.js
├── routes/
│   ├── applicationRoutes.js
│   └── documentRoutes.js
├── services/
│   ├── ApplicationService.js
│   └── DocumentService.js
└── utils/
    ├── logger.js              ✅ Logger estructurado
    ├── responseHelpers.js     ✅ Response helpers
    └── validations.js
```

#### Dependencias Principales
```json
{
  "express": "^5.1.0",
  "pg": "^8.16.3",
  "bcryptjs": "^3.0.2",
  "joi": "^17.13.3",             ✅ Validación de schemas
  "multer": "^2.0.2",            ✅ Upload de archivos
  "winston": "^3.18.3",          ✅ Logger estructurado
  "cors": "^2.8.5",
  "compression": "^1.7.5",
  "dotenv": "^16.4.7",
  "opossum": "^9.0.0",           ✅ Circuit breaker
  "axios": "^1.11.0"             ✅ HTTP client
}
```

#### Características Clave
- ✅ **Circuit Breaker**: Implementado
- ✅ **Response Helpers**: `utils/responseHelpers.js`
- ✅ **Logger Winston**: `utils/logger.js`
- ✅ **Validación Joi**: Schemas de validación
- ✅ **Multer**: Upload de documentos
- ❌ **CSRF**: NO implementado
- ❌ **Caché**: NO implementado

---

### 3. EVALUATION-SERVICE (Puerto 8084)

**Descripción**: Evaluaciones académicas y entrevistas
**Puerto**: 8084
**Entry Point**: `src/server.js`

#### Estructura de Archivos
```
src/
├── app.js
├── server.js
├── config/
│   ├── circuitBreakers.js
│   └── database.js
├── controllers/
│   ├── EvaluationController.js
│   └── InterviewController.js
├── middleware/
│   ├── auth.js
│   └── validators.js
├── models/
│   ├── Evaluation.js
│   └── Interview.js
├── routes/
│   ├── evaluationRoutes.js
│   ├── interviewRoutes.js
│   └── interviewerScheduleRoutes.js
├── services/
│   ├── EvaluationService.js
│   └── InterviewService.js
└── utils/
    ├── logger.js              ✅ Logger estructurado
    ├── responseHelpers.js     ✅ Response helpers
    └── validations.js
```

#### Dependencias Principales
```json
{
  "axios": "^1.12.2",
  "bcryptjs": "^3.0.2",
  "compression": "^1.7.5",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^5.1.0",
  "joi": "^17.13.3",             ✅ Validación
  "opossum": "^9.0.0",           ✅ Circuit breaker
  "pg": "^8.16.3",
  "winston": "^3.18.3"           ✅ Logger
}
```

#### Características Clave
- ✅ **Circuit Breaker**: Implementado
- ✅ **Response Helpers**: `utils/responseHelpers.js`
- ✅ **Logger Winston**: `utils/logger.js`
- ✅ **Validación Joi**: Schemas de validación
- ❌ **CSRF**: NO implementado
- ❌ **Caché**: NO implementado

---

### 4. NOTIFICATION-SERVICE (Puerto 8085)

**Descripción**: Notificaciones por email y SMS
**Puerto**: 8085
**Entry Point**: `src/server.js`

#### Estructura de Archivos
```
src/
├── app.js
├── server.js
├── config/
│   ├── circuitBreakers.js
│   ├── database.js
│   └── email.js               ✅ Config email
├── controllers/
│   └── NotificationController.js
├── middleware/
│   └── auth.js
├── models/
│   └── Notification.js
├── routes/
│   ├── emailRoutes.js
│   └── notificationRoutes.js
├── services/
│   ├── EmailService.js
│   ├── NotificationService.js
│   └── SMSService.js
└── utils/
    ├── logger.js              ✅ Logger estructurado
    ├── responseHelpers.js     ✅ Response helpers
    └── templateEngine.js      ✅ Templates email
```

#### Dependencias Principales
```json
{
  "express": "^5.1.0",
  "pg": "^8.16.3",
  "joi": "^17.13.3",
  "winston": "^3.18.3",          ✅ Logger
  "cors": "^2.8.5",
  "compression": "^1.7.5",
  "dotenv": "^16.4.7",
  "opossum": "^9.0.0",           ✅ Circuit breaker
  "axios": "^1.11.0",
  "nodemailer": "^6.9.16",       ✅ Email sending
  "handlebars": "^4.7.8"         ✅ Templates
}
```

#### Características Clave
- ✅ **Circuit Breaker**: Implementado
- ✅ **Response Helpers**: `utils/responseHelpers.js`
- ✅ **Logger Winston**: `utils/logger.js`
- ✅ **Nodemailer**: Envío de emails
- ✅ **Handlebars**: Template engine
- ❌ **CSRF**: NO implementado
- ❌ **Caché**: NO implementado

---

### 5. DASHBOARD-SERVICE (Puerto 8086)

**Descripción**: Estadísticas y métricas del sistema
**Puerto**: 8086
**Entry Point**: `src/server.js`

#### Estructura de Archivos
```
src/
├── app.js
├── server.js
├── config/
│   ├── cache.js               ✅ Config de caché
│   ├── circuitBreakers.js
│   └── database.js
├── controllers/
│   └── DashboardController.js
├── middleware/
│   └── auth.js
├── routes/
│   └── dashboardRoutes.js
├── services/
│   └── DashboardService.js
└── utils/
    ├── logger.js              ✅ Logger estructurado
    └── responseHelpers.js     ✅ Response helpers
```

#### Dependencias Principales
```json
{
  "express": "^5.1.0",
  "pg": "^8.16.3",
  "opossum": "^9.0.0",           ✅ Circuit breaker
  "joi": "^17.13.3",
  "winston": "^3.18.3",          ✅ Logger
  "winston-daily-rotate-file": "^5.0.0",  ✅ Log rotation
  "cors": "^2.8.5"
}
```

#### Características Clave
- ✅ **Circuit Breaker**: Implementado
- ✅ **Response Helpers**: `utils/responseHelpers.js`
- ✅ **Logger Winston**: Con rotación diaria
- ✅ **Caché**: `config/cache.js` implementado
- ❌ **CSRF**: NO implementado

---

### 6. GUARDIAN-SERVICE (Puerto 8087)

**Descripción**: Gestión de apoderados
**Puerto**: 8087
**Entry Point**: `src/server.js`

#### Estructura de Archivos
```
src/
├── app.js
├── server.js
├── config/
│   ├── circuitBreakers.js
│   └── database.js
├── controllers/
│   └── GuardianController.js
├── middleware/
│   ├── auth.js
│   └── validators.js
├── models/
│   └── Guardian.js
├── routes/
│   └── guardianRoutes.js
├── services/
│   └── GuardianService.js
└── utils/
    ├── logger.js              ✅ Logger estructurado
    ├── responseHelpers.js     ✅ Response helpers
    └── validators.js
```

#### Dependencias Principales
```json
{
  "express": "^5.1.0",
  "pg": "^8.16.3",
  "opossum": "^9.0.0",           ✅ Circuit breaker
  "joi": "^17.13.3",
  "bcryptjs": "^3.0.2",
  "winston": "^3.18.3",          ✅ Logger
  "winston-daily-rotate-file": "^5.0.0",
  "cors": "^2.8.5"
}
```

#### Características Clave
- ✅ **Circuit Breaker**: Implementado
- ✅ **Response Helpers**: `utils/responseHelpers.js`
- ✅ **Logger Winston**: Con rotación diaria
- ❌ **CSRF**: NO implementado
- ❌ **Caché**: NO implementado

---

### 7. GATEWAY-SERVICE (Puerto 8080)

**Descripción**: NGINX API Gateway - Reverse proxy
**Puerto**: 8080
**Entry Point**: `src/server.js`

#### Estructura de Archivos
```
src/
├── server.js
├── health-check.js
└── utils/
    └── logger.js              ✅ Logger estructurado
```

#### Dependencias Principales
```json
{
  "express": "^5.1.0",
  "axios": "^1.7.9",
  "winston": "^3.18.3",
  "winston-daily-rotate-file": "^5.0.0",
  "cors": "^2.8.5",
  "http-proxy-middleware": "^3.0.0",
  "jsonwebtoken": "^9.0.2",
  "dotenv": "^16.4.5"
}
```

#### Características Clave
- ✅ **Logger Winston**: Con rotación diaria
- ✅ **JWT Verification**: Verifica tokens
- ✅ **NGINX**: Reverse proxy configuration
- ✅ **Health Checks**: Endpoint de salud
- ❌ **Response Helpers**: NO (no aplica)
- ❌ **CSRF**: NO implementado

---

## PASO 0.2: IDENTIFICAR DIFERENCIAS ENTRE SERVICIOS

### Tabla Comparativa de Componentes

| Componente | User | Application | Evaluation | Notification | Dashboard | Guardian | Gateway |
|------------|------|-------------|------------|--------------|-----------|----------|---------|
| **responseHelpers.js** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **logger.js (Winston)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Circuit Breakers** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Joi Validation** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **CSRF Protection** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cache** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Log Rotation** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Compression** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

### Inconsistencias Detectadas

#### 1. Response Helpers (API Consistency)
**Estado Actual**:
- ✅ Implementado: Application, Evaluation, Notification, Dashboard, Guardian (5/7)
- ❌ Falta en: User, Gateway (2/7)

**Problema**: API responses inconsistentes entre servicios

#### 2. Logger Estructurado (Winston)
**Estado Actual**:
- ✅ Implementado: Application, Evaluation, Notification, Dashboard, Guardian, Gateway (6/7)
- ❌ Falta en: User (1/7)

**Problema**: User service usa console.log, dificulta troubleshooting

#### 3. Circuit Breakers
**Estado Actual**:
- ✅ Implementado: User, Application, Evaluation, Notification, Dashboard, Guardian (6/7)
- ❌ Falta en: Gateway (1/7 - No aplica)

**Configuración**:
- **User**: 1 circuit breaker básico
- **Otros**: Múltiples circuit breakers (queries, writes, externos)

**Problema**: User service tiene circuit breaker SIMPLE, otros servicios tienen configuraciones más sofisticadas

#### 4. CSRF Protection
**Estado Actual**:
- ✅ Implementado: User (1/7) - Con csrfMiddleware.js y cookie-parser
- ❌ Falta en: Todos los demás (6/7)

**Problema**: Solo User service tiene protección CSRF

#### 5. Caché
**Estado Actual**:
- ✅ Implementado: Dashboard (1/7)
- ❌ Falta en: Todos los demás (6/7)

**Problema**: Solo Dashboard tiene caché in-memory, otros servicios repiten queries costosas

#### 6. Log Rotation
**Estado Actual**:
- ✅ Implementado: Dashboard, Guardian, Gateway (3/7)
- ❌ Falta en: User, Application, Evaluation, Notification (4/7)

---

## PASO 0.3: COMPARACIÓN CON BACKEND HÍBRIDO

### Características del Backend Híbrido de Referencia

**Ubicación**: `/Users/jorgegangale/Library/Mobile Documents/com~apple~CloudDocs/Proyectos/Admision_MTN/Admision_MTN_backend/`

#### Patrones Avanzados Encontrados

##### 1. **Seguridad: RSA + AES Hybrid Encryption**
```javascript
// Encriptación en dos capas:
// 1. AES-256-GCM para credenciales
// 2. RSA-2048 para proteger la clave AES
function generateRSAKeyPair() { ... }
function encryptWithAES() { ... }
function decryptCredentials(req, res, next) { ... }
```

**Estado en Microservicios**: ❌ NO implementado en ningún servicio

##### 2. **Seguridad: CSRF Double-Submit Cookie Pattern**
```javascript
// CSRF con cookie + header validation
const CSRF_COOKIE_NAME = 'csrf_cookie';
const CSRF_HEADER_NAME = 'x-csrf-token';
function csrfProtection(req, res, next) { ... }
```

**Estado en Microservicios**:
- ✅ User service: Implementado
- ❌ Otros servicios: NO implementado

##### 3. **Performance: SimpleCache Class**
```javascript
class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }
  set(key, value, ttlMs = 300000) { ... }
  get(key) { ... }
  invalidate(key) { ... }
  clear() { ... }
  getStats() { return this.stats; }
}
```

**Estado en Microservicios**:
- ✅ Dashboard: Implementado (básico en config/cache.js)
- ❌ Otros servicios: NO implementado

##### 4. **Performance: Differentiated Circuit Breakers**
```javascript
// 3 tipos de circuit breakers según carga:

// 1. Simple Queries (rápidas, tolerantes)
const simpleQueryBreakerOptions = {
  timeout: 2000,
  errorThresholdPercentage: 60,
  resetTimeout: 20000
};

// 2. Medium Queries (joins, bcrypt)
const mediumQueryBreakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

// 3. Write Operations (críticas, estrictas)
const writeOperationBreakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 30,  // MÁS ESTRICTO
  resetTimeout: 45000
};
```

**Estado en Microservicios**:
- ✅ Application, Evaluation, Notification: Múltiples circuit breakers
- ⚠️ User service: 1 solo circuit breaker (sin diferenciación)
- ❌ NO hay diferenciación por tipo de operación (simple/medium/write)

##### 5. **API Consistency: Response Helpers**
```javascript
// Backend híbrido usa response helpers consistentes
function ok(data) { return { success: true, data }; }
function fail(code, message, details) {
  return { success: false, error: { code, message, details } };
}
function page(data, total, page, limit) {
  return { success: true, data, pagination: { total, page, limit } };
}
```

**Estado en Microservicios**:
- ✅ 5/7 servicios tienen responseHelpers.js
- ❌ User service NO tiene (usa respuestas ad-hoc)
- ⚠️ Gateway NO aplica (solo proxy)

---

### Matriz de Mejoras Recomendadas

| Mejora | Crítico | User | App | Eval | Notif | Dash | Guard | Gateway |
|--------|---------|------|-----|------|-------|------|-------|---------|
| **Response Helpers** | 🔴 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| **Logger Winston** | 🔴 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CSRF Protection** | 🟡 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **SimpleCache** | 🟢 | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | N/A |
| **Circuit Breakers Diff** | 🟡 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | N/A |
| **RSA+AES Encryption** | 🟢 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Log Rotation** | 🟢 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

**Leyenda**:
- 🔴 Crítico: Afecta consistencia de API o debugging
- 🟡 Importante: Mejora seguridad o resilencia
- 🟢 Nice-to-have: Optimización de performance

---

## RESUMEN EJECUTIVO DE FASE 0

### Fortalezas Actuales
1. ✅ **Arquitectura limpia**: Microservicios bien separados
2. ✅ **Circuit Breakers**: Implementados en 6/7 servicios
3. ✅ **Response Helpers**: Implementados en 5/7 servicios
4. ✅ **Logger Winston**: Implementado en 6/7 servicios
5. ✅ **Validación Joi**: Implementada en 5/7 servicios

### Debilidades Detectadas
1. ❌ **User Service**: Servicio más atrasado (falta logger, response helpers)
2. ❌ **CSRF**: Solo en User service, falta en endpoints críticos
3. ❌ **Caché**: Solo en Dashboard, queries costosas se repiten
4. ❌ **Circuit Breakers**: NO diferenciados por tipo de operación
5. ❌ **Encriptación**: NO hay RSA+AES para credenciales sensibles

### Oportunidades de Mejora (del Backend Híbrido)
1. 🎯 **SimpleCache**: Implementar en servicios con queries costosas
2. 🎯 **CSRF Protection**: Extender a todos los endpoints de escritura
3. 🎯 **Circuit Breakers Diferenciados**: Simple/Medium/Write operations
4. 🎯 **RSA+AES Encryption**: Para credenciales en User service
5. 🎯 **Response Helpers**: Estandarizar en User service

---

## PRÓXIMOS PASOS PROPUESTOS

### Opción A: Por Servicio (Completa cada servicio)
1. Completar User Service (response helpers + logger)
2. Agregar CSRF a todos los servicios
3. Agregar caché a servicios críticos
4. Mejorar circuit breakers

### Opción B: Por Característica (Aplica mejora a todos)
1. Estandarizar Response Helpers en todos
2. Implementar CSRF en todos
3. Agregar SimpleCache en servicios críticos
4. Diferenciar Circuit Breakers

### Opción C: Por Prioridad (Crítico → Importante → Nice-to-have)
1. **CRÍTICO**:
   - Response Helpers en User service
   - Logger Winston en User service
2. **IMPORTANTE**:
   - CSRF en todos los servicios
   - Circuit Breakers diferenciados
3. **NICE-TO-HAVE**:
   - SimpleCache en todos
   - RSA+AES encryption

---

## DECISIONES PENDIENTES

### 1. Orden de Implementación
¿Qué enfoque prefieres?
- [ ] Opción A: Por Servicio
- [ ] Opción B: Por Característica
- [ ] Opción C: Por Prioridad

### 2. Prioridad de Mejoras
¿Qué es más importante?
- [ ] Seguridad (CSRF, RSA+AES)
- [ ] Performance (Caché, Circuit Breakers)
- [ ] Consistencia (Response Helpers, Logger)

### 3. Alcance
¿Qué servicios actualizar?
- [ ] Solo User service (el más atrasado)
- [ ] Todos los servicios
- [ ] Solo servicios críticos (User, Application, Evaluation)

### 4. Utilidades Compartidas
¿Crear paquete npm compartido?
- [ ] Sí - Crear `@mtn/shared-utils` con responseHelpers, logger, cache, csrf
- [ ] No - Duplicar código en cada servicio

---

**Fin de FASE 0 - Análisis y Preparación**
