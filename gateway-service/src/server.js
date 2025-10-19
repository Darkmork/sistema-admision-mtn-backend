require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

// JWT Secret - debe ser el mismo que usan los microservicios
const JWT_SECRET = process.env.JWT_SECRET || 'mtn_secret_key_2025_admissions';

// Middleware básico
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

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

// Rutas públicas que NO requieren autenticación
// IMPORTANTE: Como el middleware se aplica en /api, los paths aquí NO deben incluir /api
// Los endpoints /health de los microservicios SÍ requieren autenticación por seguridad
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
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

// Aplicar autenticación JWT a todas las rutas de API
app.use('/api', authenticateJWT);

// Health check del gateway
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: SERVICES
    }
  });
});

// Gateway status
app.get('/gateway/status', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'operational',
      version: '2.0.0',
      type: 'express-gateway',
      authentication: 'centralized-jwt',
      timestamp: new Date().toISOString()
    }
  });
});

// Configuración de proxy para cada microservicio
const proxyOptions = {
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // Propagar el token de autorización al microservicio
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }

    // Agregar información del usuario autenticado
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.userId);
      proxyReq.setHeader('X-User-Email', req.user.email);
      proxyReq.setHeader('X-User-Role', req.user.role);
    }
  },
  onError: (err, req, res) => {
    logger.error(`Proxy error for ${req.path}:`, err.message);
    res.status(502).json({
      success: false,
      error: {
        code: 'GATEWAY_ERROR',
        message: 'Error al comunicarse con el servicio',
        details: err.message
      }
    });
  },
  logLevel: 'warn'
};

// Proxy para User Service
app.use('/api/users', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.USER_SERVICE,
  pathRewrite: { '^/api/users': '/api/users' }
}));

app.use('/api/auth', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.USER_SERVICE,
  pathRewrite: { '^/api/auth': '/api/auth' }
}));

// Proxy para Application Service
app.use('/api/applications', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.APPLICATION_SERVICE,
  pathRewrite: { '^/api/applications': '/api/applications' }
}));

app.use('/api/students', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.APPLICATION_SERVICE,
  pathRewrite: { '^/api/students': '/api/students' }
}));

app.use('/api/documents', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.APPLICATION_SERVICE,
  pathRewrite: { '^/api/documents': '/api/documents' }
}));

// Proxy para Evaluation Service
app.use('/api/evaluations', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.EVALUATION_SERVICE,
  pathRewrite: { '^/api/evaluations': '/api/evaluations' }
}));

app.use('/api/interviews', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.EVALUATION_SERVICE,
  pathRewrite: { '^/api/interviews': '/api/interviews' }
}));

// Proxy para Notification Service
app.use('/api/notifications', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.NOTIFICATION_SERVICE,
  pathRewrite: { '^/api/notifications': '/api/notifications' }
}));

// Proxy para Dashboard Service
app.use('/api/dashboard', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.DASHBOARD_SERVICE,
  pathRewrite: { '^/api/dashboard': '/api/dashboard' }
}));

// Proxy para Guardian Service
app.use('/api/guardians', createProxyMiddleware({
  ...proxyOptions,
  target: SERVICES.GUARDIAN_SERVICE,
  pathRewrite: { '^/api/guardians': '/api/guardians' }
}));

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
  logger.error('Unhandled error:', err);
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
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Listening on 0.0.0.0:${PORT} (accessible publicly and via private network)`);
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
