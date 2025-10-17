# 🏫 Sistema de Admisión MTN - Backend

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![NGINX](https://img.shields.io/badge/NGINX-1.25+-brightgreen.svg)](https://nginx.org/)
[![Microservices](https://img.shields.io/badge/Architecture-Microservices-orange.svg)](https://microservices.io/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

Sistema backend de admisión escolar para el Colegio Monte Tabor y Nazaret (MTN) basado en arquitectura de microservicios.

## 📋 Tabla de Contenidos

- [Arquitectura](#-arquitectura)
- [Microservicios](#-microservicios)
- [Tecnologías](#-tecnologías)
- [Requisitos](#-requisitos)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API Gateway](#-api-gateway)
- [Branching Strategy](#-branching-strategy)
- [Documentación](#-documentación)
- [Contribución](#-contribución)

## 🏗️ Arquitectura

Sistema diseñado con arquitectura de microservicios, donde cada servicio es independiente, escalable y se comunica a través de un API Gateway NGINX.

```
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX API Gateway (8080)                   │
│                  Rate Limiting | CORS | Routing                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼────────┐ ┌──────▼───────┐ ┌──────▼────────┐
│ User Service   │ │ Application  │ │  Evaluation   │
│   (8082)       │ │   Service    │ │   Service     │
│ Auth & Users   │ │   (8083)     │ │   (8084)      │
└────────────────┘ └──────────────┘ └───────────────┘
        │                 │                 │
┌───────▼────────┐ ┌──────▼───────┐ ┌──────▼────────┐
│ Notification   │ │  Dashboard   │ │  Guardian     │
│   Service      │ │   Service    │ │   Service     │
│   (8085)       │ │   (8086)     │ │   (8087)      │
└────────────────┘ └──────────────┘ └───────────────┘
        │
        └──────────────────┐
                           │
                   ┌───────▼────────┐
                   │   PostgreSQL   │
                   │ Admisión_MTN_DB│
                   └────────────────┘
```

## 🔧 Microservicios

| Servicio | Puerto | Descripción | Tecnologías Clave |
|----------|--------|-------------|-------------------|
| **Gateway** | 8080 | Reverse proxy, rate limiting, routing | NGINX, Express |
| **User Service** | 8082 | Autenticación, gestión de usuarios | JWT, BCrypt, Opossum |
| **Application Service** | 8083 | Postulaciones, documentos | Multer, Joi |
| **Evaluation Service** | 8084 | Evaluaciones académicas, entrevistas | Opossum, Winston |
| **Notification Service** | 8085 | Email (SMTP), SMS (Twilio) | Nodemailer, Handlebars |
| **Dashboard Service** | 8086 | Estadísticas, analytics | Cache in-memory |
| **Guardian Service** | 8087 | Gestión de apoderados | Validación RUT |

## 💻 Tecnologías

### Core
- **Node.js** 18+ - Runtime JavaScript
- **Express** 5.1.0 - Framework web
- **PostgreSQL** 14+ - Base de datos relacional
- **NGINX** 1.25+ - API Gateway & Reverse Proxy

### Patrones & Librerías
- **Opossum** - Circuit Breakers (resilience)
- **Winston** - Structured logging
- **Joi** - Schema validation
- **Multer** - File upload handling
- **BCrypt** - Password hashing
- **JWT** - Token-based authentication
- **Nodemailer** - Email delivery
- **Handlebars** - Email templates
- **pg** - PostgreSQL client with connection pooling

### DevOps
- **Docker** - Containerization
- **docker-compose** - Multi-container orchestration
- **ESLint** - Code linting
- **Jest** - Testing framework
- **Nodemon** - Development auto-reload

## 📦 Requisitos

- **Node.js**: v18.0.0 o superior
- **npm**: v9.0.0 o superior
- **PostgreSQL**: v14.0 o superior
- **NGINX**: v1.18.0 o superior (para Gateway)
- **Docker** (opcional): v20.0 o superior

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Darkmork/sistema-admision-mtn-backend.git
cd sistema-admision-mtn-backend
```

### 2. Instalar dependencias de cada servicio

```bash
# User Service
cd user-service && npm install

# Application Service
cd ../application-service && npm install

# Evaluation Service
cd ../evaluation-service && npm install

# Notification Service
cd ../notification-service && npm install

# Dashboard Service
cd ../dashboard-service && npm install

# Guardian Service
cd ../guardian-service && npm install

# Gateway Service
cd ../gateway-service && npm install
```

### 3. Configurar base de datos PostgreSQL

```sql
CREATE DATABASE "Admisión_MTN_DB";
```

### 4. Configurar variables de entorno

Cada servicio necesita un archivo `.env`. Ejemplo para cada servicio:

```bash
# Ejemplo: user-service/.env
PORT=8082
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123
JWT_SECRET=your_secret_key_here
```

> **Nota**: Los archivos `.env` están en `.gitignore` por seguridad.

## 🎯 Uso

### Iniciar todos los servicios

#### Opción 1: Manual (desarrollo)

```bash
# Terminal 1: User Service
cd user-service && npm run dev

# Terminal 2: Application Service
cd application-service && npm run dev

# Terminal 3: Evaluation Service
cd evaluation-service && npm run dev

# Terminal 4: Notification Service
cd notification-service && npm run dev

# Terminal 5: Dashboard Service
cd dashboard-service && npm run dev

# Terminal 6: Guardian Service
cd guardian-service && npm run dev

# Terminal 7: Gateway Service
cd gateway-service && ./scripts/start-gateway.sh
```

#### Opción 2: Docker Compose (producción)

```bash
docker-compose up -d
```

### Verificar servicios

```bash
# Health checks
curl http://localhost:8082/health  # User Service
curl http://localhost:8083/health  # Application Service
curl http://localhost:8084/health  # Evaluation Service
curl http://localhost:8085/health  # Notification Service
curl http://localhost:8086/health  # Dashboard Service
curl http://localhost:8087/health  # Guardian Service
curl http://localhost:8080/gateway/status  # Gateway

# Via Gateway (recomendado)
curl http://localhost:8080/api/users/roles
```

## 📁 Estructura del Proyecto

```
sistema-admision-mtn-backend/
├── .gitignore                      # Ignorar node_modules, .env, logs
├── CLAUDE.md                       # Guía para Claude Code AI
├── README.md                       # Este archivo
├── user-service/                   # Microservicio de usuarios
│   ├── src/
│   │   ├── config/                # Database, circuit breakers
│   │   ├── controllers/           # HTTP handlers
│   │   ├── services/              # Business logic
│   │   ├── routes/                # API routes
│   │   ├── middleware/            # Auth, validation
│   │   └── index.js               # Entry point
│   ├── package.json
│   └── .env
├── application-service/            # Microservicio de postulaciones
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── server.js
│   ├── uploads/                   # Archivos subidos
│   ├── logs/                      # Application logs
│   └── package.json
├── evaluation-service/             # Microservicio de evaluaciones
├── notification-service/           # Microservicio de notificaciones
├── dashboard-service/              # Microservicio de analytics
├── guardian-service/               # Microservicio de apoderados
└── gateway-service/                # API Gateway (NGINX)
    ├── config/
    │   ├── nginx.conf             # Local config
    │   └── nginx-docker.conf      # Docker config
    ├── scripts/
    │   ├── start-gateway.sh
    │   ├── stop-gateway.sh
    │   └── test-routes.sh
    └── src/
        └── health-check.js
```

## 🌐 API Gateway

El Gateway Service (NGINX) actúa como punto de entrada único:

### Rutas

| Ruta | Servicio | Descripción |
|------|----------|-------------|
| `/api/auth/*` | User Service | Autenticación (login, register) |
| `/api/users/*` | User Service | Gestión de usuarios |
| `/api/applications/*` | Application Service | Postulaciones |
| `/api/documents/*` | Application Service | Documentos |
| `/api/evaluations/*` | Evaluation Service | Evaluaciones |
| `/api/interviews/*` | Evaluation Service | Entrevistas |
| `/api/notifications/*` | Notification Service | Notificaciones |
| `/api/email/*` | Notification Service | Emails |
| `/api/dashboard/*` | Dashboard Service | Estadísticas |
| `/api/analytics/*` | Dashboard Service | Analytics |
| `/api/guardians/*` | Guardian Service | Apoderados |

### Características

- ✅ **Rate Limiting**: 20 req/s por IP
- ✅ **Connection Pooling**: 32 conexiones keepalive por servicio
- ✅ **CORS**: Configurado para frontend
- ✅ **Timeouts**: Alineados con circuit breakers (3s/8s/10s)
- ✅ **Health Monitoring**: Checks automáticos de servicios
- ✅ **Load Balancing**: Distribución de tráfico

## 🌿 Branching Strategy

### Ramas principales

- **`main`** - Código en producción (protegida)
- **`develop`** - Rama de desarrollo principal
- **`hotfix/production`** - Fixes urgentes para producción

### Ramas de features (por servicio)

- `feature/user-service` - Cambios en User Service
- `feature/application-service` - Cambios en Application Service
- `feature/evaluation-service` - Cambios en Evaluation Service
- `feature/notification-service` - Cambios en Notification Service
- `feature/dashboard-service` - Cambios en Dashboard Service
- `feature/guardian-service` - Cambios en Guardian Service
- `feature/gateway-service` - Cambios en Gateway Service

### Workflow

```bash
# Desarrollo de nueva funcionalidad
git checkout develop
git pull origin develop
git checkout -b feature/user-service/add-2fa
# ... hacer cambios ...
git add .
git commit -m "feat(user): add two-factor authentication"
git push origin feature/user-service/add-2fa
# Crear Pull Request a develop

# Hotfix urgente
git checkout main
git checkout -b hotfix/fix-login-bug
# ... hacer cambios ...
git commit -m "fix(user): resolve login timeout issue"
git push origin hotfix/fix-login-bug
# Crear Pull Request a main Y develop
```

## 📚 Documentación

### Por servicio

Cada microservicio tiene su propio README detallado:

- [User Service README](user-service/README.md)
- [Application Service README](application-service/README.md)
- [Evaluation Service README](evaluation-service/README.md)
- [Notification Service README](notification-service/README.md)
- [Dashboard Service README](dashboard-service/README.md)
- [Guardian Service README](gateway-service/README.md)
- [Gateway Service README](gateway-service/README.md)

### Guías adicionales

- **CLAUDE.md** - Guía para desarrollo con Claude Code AI
- Incluye arquitectura, comandos comunes, patrones de código

## 🔐 Seguridad

- ✅ Variables de entorno en `.env` (no commiteadas)
- ✅ Contraseñas hasheadas con BCrypt (8 rounds)
- ✅ JWT tokens con expiración de 24h
- ✅ Rate limiting en Gateway
- ✅ CORS configurado
- ✅ Circuit breakers para evitar cascading failures
- ✅ Connection pooling para optimizar DB
- ✅ Validación de entrada (Joi)
- ✅ Sanitización de archivos subidos

## 🧪 Testing

```bash
# Ejecutar tests en un servicio
cd application-service
npm test

# Coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## 🐳 Docker

### Build individual

```bash
cd application-service
docker build -t application-service:latest .
```

### Docker Compose (todos los servicios)

```bash
# Iniciar
docker-compose up -d

# Logs
docker-compose logs -f

# Detener
docker-compose down
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'feat: agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request a `develop`

### Commit Convention

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(user): add password reset functionality
fix(application): resolve file upload error
docs(readme): update installation guide
refactor(evaluation): improve service layer
test(notification): add email service tests
chore(deps): update dependencies
```

## 📊 Estado del Proyecto

- ✅ Arquitectura de microservicios implementada
- ✅ 7 servicios funcionando
- ✅ API Gateway NGINX configurado
- ✅ Circuit breakers implementados
- ✅ Logging estructurado
- ✅ Docker support
- ✅ Documentación completa
- ⏳ Tests unitarios (en progreso)
- ⏳ CI/CD pipeline (pendiente)

## 📞 Contacto

**Equipo de Desarrollo MTN**
- Email: desarrollo@mtn.cl
- GitHub: [@Darkmork](https://github.com/Darkmork)

## 📄 Licencia

ISC - Colegio Monte Tabor y Nazaret
