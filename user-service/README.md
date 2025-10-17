# User Service

Microservicio de autenticación y gestión de usuarios para el Sistema de Admisión MTN.

## 📁 Estructura del Proyecto

```
user-service/
├── src/
│   ├── config/          # Configuraciones (DB, Circuit Breakers)
│   │   ├── database.js
│   │   └── circuitBreaker.js
│   ├── controllers/     # Lógica de controladores HTTP
│   │   └── authController.js
│   ├── services/        # Lógica de negocio
│   │   └── authService.js
│   ├── routes/          # Definición de rutas
│   │   ├── authRoutes.js
│   │   └── userRoutes.js
│   ├── middleware/      # Middlewares (auth, validation)
│   │   └── authMiddleware.js
│   └── index.js         # Punto de entrada
├── package.json
├── .env                 # Variables de entorno
├── .gitignore
└── README.md
```

## 🚀 Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (ya está creado .env)
# Revisar y ajustar .env si es necesario

# 3. Verificar conexión a PostgreSQL
# Asegurarse de que la base de datos "Admisión_MTN_DB" existe
```

## ⚙️ Configuración

### Variables de Entorno (.env)

```bash
# Database (Local)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123

# Server
PORT=8082
NODE_ENV=development

# JWT (opcional)
JWT_SECRET=your_secret_key
JWT_EXPIRATION_TIME=86400000
```

### Railway Production

Para producción en Railway, el servicio utiliza automáticamente `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://postgres:password@host:5432/database
```

## 🏃 Ejecutar

```bash
# Modo desarrollo
npm start

# El servicio estará disponible en:
# http://localhost:8082
```

## 📚 Endpoints

### Autenticación (`/api/auth`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Iniciar sesión | ❌ |
| POST | `/api/auth/register` | Registrar nuevo APODERADO | ❌ |
| GET | `/api/auth/check` | Verificar autenticación | ✅ |
| GET | `/api/auth/check-email` | Verificar si email existe | ❌ |

### Usuarios (`/api/users`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/roles` | Obtener roles disponibles | ❌ |
| GET | `/api/users/me` | Obtener perfil actual | ✅ |
| GET | `/api/users` | Listar todos los usuarios | ✅ |
| GET | `/api/users/:id` | Obtener usuario por ID | ✅ |
| POST | `/api/users` | Crear nuevo usuario | ✅ |
| PUT | `/api/users/:id` | Actualizar usuario | ✅ |
| DELETE | `/api/users/:id` | Eliminar usuario | ✅ |

## 🧪 Testing

### Health Check

```bash
curl http://localhost:8082/health
```

### Login

```bash
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jorge.gangale@mtn.cl",
    "password": "admin123"
  }'
```

### Get Users (con token)

```bash
TOKEN="your_jwt_token_here"
curl http://localhost:8082/api/users \
  -H "Authorization: Bearer $TOKEN"
```

## 🛡️ Características de Seguridad

- **BCrypt**: Hash de contraseñas con 8 rounds (optimizado para Railway)
- **JWT**: Tokens de autenticación de 24 horas
- **Connection Pooling**: Máximo 20 conexiones concurrentes
- **Circuit Breakers**: 3 niveles (Simple, Medium, Write)
  - Simple: 2s timeout para consultas rápidas
  - Medium: 5s timeout para auth + queries complejas
  - Write: 3s timeout para mutaciones críticas

## 🔄 Arquitectura

### Separación de Responsabilidades

- **index.js**: Configuración de Express, middlewares, inicialización
- **config/**: Configuración de base de datos y circuit breakers
- **routes/**: Definición de endpoints HTTP
- **controllers/**: Manejo de requests/responses
- **services/**: Lógica de negocio pura
- **middleware/**: Autenticación y validaciones

### Circuit Breakers

El servicio incluye 3 circuit breakers diferenciados:

1. **Simple Query Breaker** (2s, 60% threshold, 20s reset)
   - Para consultas rápidas de lookup

2. **Medium Query Breaker** (5s, 50% threshold, 30s reset)
   - Para queries con joins + BCrypt (login)

3. **Write Operation Breaker** (3s, 30% threshold, 45s reset)
   - Para operaciones críticas de escritura

## 🐳 Docker (Futuro)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
EXPOSE 8082
CMD ["node", "src/index.js"]
```

## 📝 Notas

- **Puerto por defecto**: 8082
- **Base de datos**: PostgreSQL con pooling
- **Compatibilidad**: Railway (DATABASE_URL) y local (env vars individuales)
- **Logging**: Console.log simple (puede mejorarse con Winston/Pino)

## 🔧 Desarrollo con WebStorm

1. Abrir carpeta `user-service` en WebStorm
2. WebStorm detectará automáticamente el proyecto Node.js
3. Configurar Run Configuration:
   - **Name**: User Service
   - **JavaScript file**: `src/index.js`
   - **Environment variables**: From `.env` file
4. Click en Run

## 📄 Licencia

ISC
