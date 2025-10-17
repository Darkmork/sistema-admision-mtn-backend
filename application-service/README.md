# Application Service

Microservicio de gestión de postulaciones y documentos para el Sistema de Admisión MTN.

## Descripción

Este microservicio maneja toda la lógica relacionada con:
- Creación, consulta, actualización y eliminación de postulaciones de estudiantes
- Carga, aprobación y gestión de documentos adjuntos
- Estadísticas de postulaciones
- Cambios de estado en el proceso de admisión

## Tecnologías

- **Node.js** 18+
- **Express** 5.1.0
- **PostgreSQL** con connection pooling
- **Opossum** para circuit breakers
- **Multer** para carga de archivos
- **Joi** para validación de datos
- **Winston** para logging

## Estructura del Proyecto

```
application-service/
├── src/
│   ├── config/           # Configuración (DB, circuit breakers)
│   ├── routes/           # Definición de rutas HTTP
│   ├── controllers/      # Controladores HTTP
│   ├── services/         # Lógica de negocio
│   ├── models/           # Modelos de datos
│   ├── middleware/       # Middlewares (auth, upload, validators)
│   ├── utils/            # Utilidades (logger, validations)
│   ├── exceptions/       # Excepciones personalizadas
│   ├── app.js            # Configuración de Express
│   └── server.js         # Punto de entrada del servidor
├── tests/                # Tests unitarios y de integración
├── uploads/              # Archivos subidos
├── logs/                 # Archivos de log
├── .env                  # Variables de entorno
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Instalación

### Prerequisitos

- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### Pasos

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
Editar `.env` con tus valores:
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Admisión_MTN_DB
DB_USERNAME=admin
DB_PASSWORD=admin123

# Server
PORT=8083
NODE_ENV=development
```

3. **Iniciar en modo desarrollo**:
```bash
npm run dev
```

4. **Iniciar en modo producción**:
```bash
npm start
```

## API Endpoints

### Applications

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/api/applications` | Listar postulaciones | ✅ |
| GET | `/api/applications/:id` | Obtener postulación por ID | ✅ |
| POST | `/api/applications` | Crear postulación | ✅ |
| PUT | `/api/applications/:id` | Actualizar postulación | ✅ |
| PATCH | `/api/applications/:id/status` | Cambiar estado | ✅ ADMIN/COORDINATOR |
| PUT | `/api/applications/:id/archive` | Archivar postulación | ✅ ADMIN |
| GET | `/api/applications/stats` | Estadísticas | ❌ |

### Documents

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/api/applications/documents` | Subir documentos | ✅ |
| GET | `/api/applications/:applicationId/documents` | Listar documentos | ✅ |
| GET | `/api/documents/:id/download` | Descargar documento | ✅ |
| GET | `/api/applications/documents/view/:id` | Ver documento inline | ✅ |
| PUT | `/api/applications/documents/:id/approval` | Aprobar/rechazar documento | ✅ ADMIN/COORDINATOR |
| DELETE | `/api/applications/documents/:id` | Eliminar documento | ✅ ADMIN |

## Circuit Breakers

El servicio implementa 4 tipos de circuit breakers:

| Tipo | Timeout | Error Threshold | Reset Time | Uso |
|------|---------|-----------------|------------|-----|
| Simple | 2s | 60% | 20s | Queries simples |
| Medium | 5s | 50% | 30s | Queries complejas |
| Write | 3s | 30% | 45s | Operaciones de escritura |
| External | 8s | 70% | 120s | Servicios externos |

## Testing

```bash
# Tests unitarios
npm test

# Tests con coverage
npm test -- --coverage

# Tests en modo watch
npm run test:watch
```

## Linting

```bash
# Ejecutar ESLint
npm run lint

# Auto-fix
npm run lint:fix
```

## Docker

### Build

```bash
docker build -t application-service:latest .
```

### Run

```bash
docker-compose up -d
```

## Health Check

```bash
curl http://localhost:8083/health
```

Respuesta:
```json
{
  "success": true,
  "service": "application-service",
  "status": "healthy",
  "timestamp": "2025-10-15T00:00:00.000Z"
}
```

## Logging

Los logs se guardan en:
- `logs/combined.log` - Todos los logs
- `logs/error.log` - Solo errores
- `logs/exceptions.log` - Excepciones no capturadas
- `logs/rejections.log` - Promesas rechazadas

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| NODE_ENV | Entorno de ejecución | development |
| PORT | Puerto del servidor | 8083 |
| DB_HOST | Host de PostgreSQL | localhost |
| DB_PORT | Puerto de PostgreSQL | 5432 |
| DB_NAME | Nombre de la base de datos | Admisión_MTN_DB |
| DB_USERNAME | Usuario de la base de datos | admin |
| DB_PASSWORD | Contraseña de la base de datos | admin123 |
| DB_POOL_MAX | Máximo de conexiones | 20 |
| JWT_SECRET | Secret para JWT | required |
| UPLOAD_DIR | Directorio de uploads | ./uploads |
| MAX_FILE_SIZE | Tamaño máximo de archivo | 10485760 (10MB) |
| MAX_FILES | Máximo de archivos por request | 5 |
| CORS_ORIGIN | Origen permitido para CORS | http://localhost:5173 |

## Troubleshooting

### Puerto en uso
```bash
lsof -ti:8083 | xargs kill -9
```

### Problemas de conexión a DB
```bash
# Verificar que PostgreSQL esté corriendo
pg_isready -h localhost -p 5432

# Verificar credenciales
PGPASSWORD=admin123 psql -h localhost -U admin -d "Admisión_MTN_DB" -c "SELECT 1"
```

### Limpiar uploads
```bash
rm -rf uploads/*
```

## Licencia

ISC
