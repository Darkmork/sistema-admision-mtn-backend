require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');

// HTTP/HTTPS agents with keepAlive for better connection handling
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

const app = express();
const PORT = process.env.PORT || 8080;

// JWT Secret - debe ser el mismo que usan los microservicios
const JWT_SECRET = process.env.JWT_SECRET || 'mtn_secret_key_2025_admissions';

// ==============================================
// MIDDLEWARE CONFIGURATION
// ==============================================

// Trust proxy - essential for Railway deployment and proper IP detection
app.set('trust proxy', true);

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP as we're an API gateway
  crossOriginEmbedderPolicy: false
}));

// Compression for responses
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later'
    }
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Validate trust proxy configuration for Railway deployment
  validate: { trustProxy: false } // Disable validation since we're behind Railway proxy
});

app.use(limiter);

// Request ID tracking
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});

// IMPORTANT: DO NOT parse request bodies before proxy routes!
// Body parsing will be added AFTER proxy routes for gateway's own endpoints.
// This prevents breaking the streaming proxy behavior.

// CORS configuration for frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://admision-mtn-front.vercel.app',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Allow all common headers including custom x-* headers from frontend
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-csrf-token',
    'X-CSRF-Token',
    'x-correlation-id',
    'x-request-time',
    'x-timezone',
    'x-client-type',
    'x-api-key',
    'x-request-id',
    'x-client-version',
    'x-device-id',
    'Accept',
    'Accept-Language',
    'Content-Language',
    'Origin',
    'Referer',
    'User-Agent'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'x-request-id'],
  maxAge: 600 // 10 minutes
}));

// Request logging with request ID
app.use((req, res, next) => {
  logger.info(`[${req.id}] ${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });
  console.log(`DEBUG: req.path="${req.path}" req.url="${req.url}" req.originalUrl="${req.originalUrl}"`);
  next();
});

// ==============================================
// SERVICE URL CONFIGURATION
// ==============================================

// URLs de los microservicios
// Para Railway: usa variables de entorno que apuntan a networking privado
// Para Local: usa localhost con los puertos correspondientes
const getServiceUrl = (envVar, fallback) => {
  const val = process.env[envVar];
  // Considerar que estamos en "producción" si NODE_ENV=production o si hay indicios de despliegue en Railway
  const isProductionLike = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_STATIC_URL || !!process.env.RAILWAY_ENV;

  if (!val && isProductionLike) {
    logger.error(`La variable de entorno ${envVar} no está definida pero es requerida en producción. Evitando uso del fallback (${fallback}).`);
    logger.error('Por favor configura las variables de entorno del Gateway en Railway (p. ej. USER_SERVICE_URL, APPLICATION_SERVICE_URL, etc.).');
    // Salimos con código de error para evitar que el gateway use localhost en producción
    process.exit(1);
  }

  if (!val) {
    logger.warn(`La variable de entorno ${envVar} no está definida. Usando fallback para desarrollo: ${fallback}`);
    return fallback;
  }

  return val;
};

const SERVICES = {
  USER_SERVICE: getServiceUrl('USER_SERVICE_URL', 'http://localhost:8082'),
  APPLICATION_SERVICE: getServiceUrl('APPLICATION_SERVICE_URL', 'http://localhost:8083'),
  EVALUATION_SERVICE: getServiceUrl('EVALUATION_SERVICE_URL', 'http://localhost:8084'),
  NOTIFICATION_SERVICE: getServiceUrl('NOTIFICATION_SERVICE_URL', 'http://localhost:8085'),
  DASHBOARD_SERVICE: getServiceUrl('DASHBOARD_SERVICE_URL', 'http://localhost:8086'),
  GUARDIAN_SERVICE: getServiceUrl('GUARDIAN_SERVICE_URL', 'http://localhost:8087')
};

// Log service URLs on startup for debugging
logger.info('Service URLs configured:');
Object.entries(SERVICES).forEach(([name, url]) => {
  logger.info(`  ${name}: ${url}`);
});

// Rutas públicas que NO requieren autenticación
// IMPORTANTE: Como el middleware se aplica en /api, los paths aquí NO deben incluir /api
// Los endpoints /health de los microservicios SÍ requieren autenticación por seguridad
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/public-key',
  '/auth/check-email',           // Verificar si email existe
  '/auth/send-verification',     // Enviar código de verificación
  '/auth/csrf-token',            // Obtener CSRF token
  '/students/validate-rut',      // Validar formato de RUT (público)
  '/applications/public/all',
  '/applications/stats',
  '/applications/statistics'
];

// Middleware de autenticación JWT centralizado
const authenticateJWT = (req, res, next) => {
  // Verificar si la ruta es pública
  const isPublicRoute = PUBLIC_ROUTES.some(route => req.path.startsWith(route));

  if (isPublicRoute) {
    logger.info(`Public route accessed: ${req.path}`);
    return next();
  }

  // Extraer token del header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn(`No authorization header for ${req.path}`);
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_001',
        message: 'No se proporcionó token de autenticación'
      }
    });
  }

  // Extraer token (formato: "Bearer TOKEN")
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Agregar información del usuario al request
    req.user = decoded;

    logger.info(`Authenticated user: ${decoded.email} (${decoded.role}) for ${req.path}`);
    next();
  } catch (error) {
    logger.error(`JWT verification failed for ${req.path}:`, error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_004',
          message: 'Token expirado'
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Token inválido'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_005',
        message: 'Error de autenticación'
      }
    });
  }
};

// ==============================================
// NOTE: JWT Authentication is handled by individual microservices
// Each backend service has its own authenticate middleware
// The gateway only acts as a proxy and forwards the Authorization header
// ==============================================

// Aplicar autenticación JWT a todas las rutas de API
// COMMENTED OUT: Backend services handle their own authentication
// app.use('/api', authenticateJWT);

// ==============================================
// HEALTH CHECK ENDPOINTS
// ==============================================

// Liveness probe - simple check if gateway is running
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

// Readiness probe - check if gateway is ready to serve traffic
app.get('/ready', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ready',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      services: SERVICES
    }
  });
});

// Gateway status - detailed information
app.get('/gateway/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      version: '2.1.0',
      type: 'express-gateway',
      features: {
        authentication: 'centralized-jwt',
        rateLimit: 'enabled',
        compression: 'enabled',
        security: 'helmet',
        requestTracking: 'uuid'
      },
      timestamp: new Date().toISOString(),
      services: SERVICES
    }
  });
});

// ==============================================
// PROXY CONFIGURATION (CORRECT PATTERN)
// ==============================================

/**
 * Creates a properly configured proxy middleware for streaming requests.
 * IMPORTANT: This function does NOT parse request bodies. http-proxy-middleware
 * handles streaming natively. Body parsing happens AFTER proxy routes.
 */
const makeProxy = (target, path = '', additionalOptions = {}) => {
  console.log(`[makeProxy] Creating proxy for target="${target}" path="${path}"`);

  // Determine which agent to use based on protocol
  const targetUrl = new URL(target);
  const agent = targetUrl.protocol === 'https:' ? httpsAgent : httpAgent;

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true, // Add X-Forwarded-* headers
    agent, // Use appropriate HTTP/HTTPS agent
    secure: false, // Allow self-signed certificates (for Railway internal URLs)
    timeout: 20000, // Client timeout (20s)
    proxyTimeout: 15000, // Backend timeout (15s)
    followRedirects: false, // Don't follow redirects, proxy them
    autoRewrite: true, // Rewrite the location host/port on redirects
    selfHandleResponse: false, // Let proxy handle the response (don't intercept)
    // If path is provided, prepend it back (Express strips it)
    ...(path && {
      pathRewrite: (pathStr, req) => {
        const newPath = path + pathStr;
        console.log(`[pathRewrite] "${pathStr}" → "${newPath}"`);
        return newPath;
      }
    }),

    onProxyReq: (proxyReq, req, res) => {
      // Propagar request ID para tracking distribuido
      if (req.id) {
        proxyReq.setHeader('x-request-id', req.id);
      }

      // Propagar el token de autorización al microservicio
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }

      // Propagar CSRF token (ambos formatos)
      if (req.headers['x-csrf-token']) {
        proxyReq.setHeader('x-csrf-token', req.headers['x-csrf-token']);
      }
      if (req.headers['X-CSRF-Token']) {
        proxyReq.setHeader('X-CSRF-Token', req.headers['X-CSRF-Token']);
      }

      // Agregar información del usuario autenticado (si existe)
      if (req.user) {
        proxyReq.setHeader('X-User-Id', String(req.user.userId));
        proxyReq.setHeader('X-User-Email', req.user.email);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }

      logger.debug(`[${req.id}] Proxying ${req.method} ${req.originalUrl} to ${target}`);
    },

    onProxyRes: (proxyRes, req, res) => {
      logger.info(`[${req.id}] Proxy response from ${target}: ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    },

    onError: (err, req, res) => {
      logger.error(`[${req.id}] Proxy error to ${target} for ${req.method} ${req.originalUrl}:`, {
        error: err.message,
        stack: err.stack
      });

      // Si no se han enviado headers aún, responder con 502
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: {
            code: 'GATEWAY_ERROR',
            message: 'Error al comunicarse con el servicio backend',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            target: process.env.NODE_ENV === 'development' ? target : undefined
          }
        });
      }
    },

    // Merge additional options (e.g., filter)
    ...additionalOptions
  });
};

// ==============================================
// PROXY ROUTES - Path-based routing (Express-native approach)
// ==============================================

// Proxy para User Service - /api/users and /api/auth
app.use('/api/users', makeProxy(SERVICES.USER_SERVICE, '/api/users'));
app.use('/api/auth', makeProxy(SERVICES.USER_SERVICE, '/api/auth'));

// Proxy para Application Service - /api/applications, /api/students, /api/documents
app.use('/api/applications', makeProxy(SERVICES.APPLICATION_SERVICE, '/api/applications'));
app.use('/api/students', makeProxy(SERVICES.APPLICATION_SERVICE, '/api/students'));
app.use('/api/documents', makeProxy(SERVICES.APPLICATION_SERVICE, '/api/documents'));

// Proxy para Evaluation Service - /api/evaluations, /api/interviews, /api/interviewer-schedules
app.use('/api/evaluations', makeProxy(SERVICES.EVALUATION_SERVICE, '/api/evaluations'));
app.use('/api/interviews', makeProxy(SERVICES.EVALUATION_SERVICE, '/api/interviews'));
app.use('/api/interviewer-schedules', makeProxy(SERVICES.EVALUATION_SERVICE, '/api/interviewer-schedules'));

// Proxy para Notification Service - /api/notifications, /api/email, /api/institutional-emails
app.use('/api/notifications', makeProxy(SERVICES.NOTIFICATION_SERVICE, '/api/notifications'));
app.use('/api/email', makeProxy(SERVICES.NOTIFICATION_SERVICE, '/api/email'));
app.use('/api/institutional-emails', makeProxy(SERVICES.NOTIFICATION_SERVICE, '/api/institutional-emails')); // Document review notifications

// Proxy para Dashboard Service - /api/dashboard, /api/analytics
app.use('/api/dashboard', makeProxy(SERVICES.DASHBOARD_SERVICE, '/api/dashboard'));
app.use('/api/analytics', makeProxy(SERVICES.DASHBOARD_SERVICE, '/api/analytics'));

// Proxy para Guardian Service - /api/guardians
app.use('/api/guardians', makeProxy(SERVICES.GUARDIAN_SERVICE, '/api/guardians'));

// ==============================================
// GATEWAY-SPECIFIC ROUTES (WITH BODY PARSING)
// ==============================================

// NOW we can safely parse bodies for gateway's own endpoints
// These middlewares only apply to routes defined AFTER this point
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Gateway doesn't have its own POST/PUT routes yet, but this is
// where you would add them (e.g., /gateway/admin/config)

// ==============================================
// ERROR HANDLERS
// ==============================================

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('=== UNHANDLED ERROR ===');
  console.error(err);
  console.error('Stack:', err.stack);
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    name: err.name
  });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message
    }
  });
});

// Start server
// En Railway, escuchar en 0.0.0.0 permite conexiones públicas y desde otros servicios
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`==============================================`);
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`📡 Listening on 0.0.0.0:${PORT} (accessible publicly and via private network)`);
  logger.info(`Type: Express Gateway with Centralized JWT Auth`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`==============================================`);
  logger.info(`Microservices:`);
  Object.entries(SERVICES).forEach(([name, url]) => {
    logger.info(`  - ${name}: ${url}`);
  });
  logger.info(`==============================================`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;

