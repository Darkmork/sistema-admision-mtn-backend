# Guía de Deployment para Railway - CSRF + JWT

## ⚠️ VARIABLES DE ENTORNO CRÍTICAS

Para que la implementación de CSRF + JWT funcione correctamente en Railway, **DEBES** configurar las siguientes variables de entorno en **CADA SERVICIO**:

### Variables Requeridas:

#### 1. **CSRF_SECRET** (CRÍTICO - NUEVO)
```bash
CSRF_SECRET=<tu-clave-secreta-csrf-muy-segura>
```

**Importante:**
- ✅ DEBE ser la **MISMA** en todos los servicios (application, evaluation, guardian, user)
- ✅ Mínimo 32 caracteres aleatorios
- ✅ Usar caracteres seguros (letras, números, símbolos)
- ❌ NO usar el valor por defecto del código
- ❌ NO compartir públicamente

**Generación recomendada:**
```bash
# Opción 1: OpenSSL
openssl rand -base64 32

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 2. **JWT_SECRET** (YA EXISTE - VERIFICAR)
```bash
JWT_SECRET=<tu-clave-secreta-jwt-muy-segura>
```

**Importante:**
- ✅ DEBE ser la **MISMA** en todos los servicios
- ✅ Diferentes de los valores actuales en .env local
- ✅ Mantener en secreto

---

## 📋 CHECKLIST DE DEPLOYMENT EN RAILWAY

### Paso 1: Configurar Variables en Railway Dashboard

Para **CADA** servicio (user-service, application-service, evaluation-service, guardian-service):

1. Ve al servicio en Railway Dashboard
2. Click en "Variables"
3. Agrega/Verifica estas variables:

```env
# Seguridad (CRÍTICO)
CSRF_SECRET=<mismo-valor-en-todos-los-servicios>
JWT_SECRET=<mismo-valor-en-todos-los-servicios>

# Base de datos (Railway provee DATABASE_URL automáticamente)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Configuración del entorno
NODE_ENV=production
PORT=<puerto-del-servicio>

# Logging
LOG_LEVEL=info
```

### Paso 2: Verificar Servicios Afectados

Los siguientes servicios tienen **NUEVOS ENDPOINTS** que deben ser accesibles:

#### User Service
- ✅ `GET /api/csrf-token` - Endpoint público para obtener tokens CSRF
- ✅ Middleware CSRF implementado (listo para usar en rutas)

#### Application Service
- ✅ `GET /api/csrf-token` - Endpoint público para obtener tokens CSRF
- ✅ Rutas protegidas con CSRF: 6 rutas (POST, PUT, PATCH, DELETE)

#### Evaluation Service
- ✅ `GET /api/csrf-token` - Endpoint público para obtener tokens CSRF
- ✅ Rutas protegidas con CSRF: 18 rutas en 3 archivos
  - evaluationRoutes: 9 rutas
  - interviewRoutes: 4 rutas
  - interviewerScheduleRoutes: 5 rutas

#### Guardian Service
- ✅ `GET /api/csrf-token` - Endpoint público para obtener tokens CSRF
- ✅ Rutas protegidas con CSRF: 3 rutas (POST, PUT, DELETE)

### Paso 3: Testing Post-Deployment

Después del deployment, verifica que funciona correctamente:

#### Test 1: Generación de CSRF Tokens
```bash
# User Service
curl https://your-user-service.railway.app/api/csrf-token

# Application Service
curl https://your-application-service.railway.app/api/csrf-token

# Evaluation Service
curl https://your-evaluation-service.railway.app/api/csrf-token

# Guardian Service
curl https://your-guardian-service.railway.app/api/csrf-token
```

**Respuesta esperada:**
```json
{
  "success": true,
  "csrfToken": "1234567890.abc123...",
  "expiresIn": 3600
}
```

#### Test 2: Validación de CSRF (debe fallar sin token)
```bash
curl -X POST https://your-application-service.railway.app/api/applications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
```

**Respuesta esperada (403 Forbidden):**
```json
{
  "success": false,
  "error": "CSRF validation failed: Token missing",
  "code": "CSRF_VALIDATION_FAILED"
}
```

#### Test 3: Validación exitosa (con ambos tokens)
```bash
# Primero obtener CSRF token
CSRF_TOKEN=$(curl -s https://your-service.railway.app/api/csrf-token | jq -r '.csrfToken')

# Luego hacer la petición con ambos tokens
curl -X POST https://your-application-service.railway.app/api/applications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"validData":"here"}'
```

---

## 🔒 CONSIDERACIONES DE SEGURIDAD

### 1. **Tokens CSRF**
- ✅ Expiran en 1 hora
- ✅ Son stateless (no requieren almacenamiento en servidor)
- ✅ Validación basada en HMAC-SHA256
- ✅ Protegen contra ataques CSRF

### 2. **Orden de Middleware (Defense in Depth)**
```javascript
authenticate → validateCsrf → requireRole → validate → controller
```
- Primero valida JWT
- Luego valida CSRF
- Después valida roles
- Finalmente valida datos de entrada

### 3. **Métodos HTTP Protegidos**
- ✅ POST, PUT, PATCH, DELETE requieren CSRF token
- ✅ GET y OPTIONS NO requieren CSRF token (safe methods)

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: "CSRF validation failed: Token missing"
**Causa:** Frontend no está enviando el header `x-csrf-token`

**Solución:**
1. Frontend debe obtener token: `GET /api/csrf-token`
2. Incluir en cada petición de mutación:
   ```javascript
   headers: {
     'Authorization': `Bearer ${jwtToken}`,
     'x-csrf-token': csrfToken,
     'Content-Type': 'application/json'
   }
   ```

### Problema 2: "CSRF validation failed: Invalid signature"
**Causa:** `CSRF_SECRET` diferente entre servicios o cambió después de generar el token

**Solución:**
1. Verificar que `CSRF_SECRET` sea idéntico en todos los servicios
2. Si cambiaste `CSRF_SECRET`, obtén un nuevo token CSRF

### Problema 3: "CSRF validation failed: Token expired"
**Causa:** Token CSRF tiene más de 1 hora

**Solución:**
- Obtener un nuevo token con `GET /api/csrf-token`
- Considerar implementar refresh automático en frontend

### Problema 4: Servicios usando valor por defecto
**Causa:** Variable `CSRF_SECRET` no configurada en Railway

**Solución:**
- Verificar en Railway Dashboard → Variables
- Asegurarse que esté presente en TODOS los servicios
- Reiniciar servicios después de agregar variable

---

## 📊 RESUMEN DE CAMBIOS

### Archivos Creados (4):
- `user-service/src/middleware/csrfMiddleware.js`
- `application-service/src/middleware/csrfMiddleware.js`
- `evaluation-service/src/middleware/csrfMiddleware.js`
- `guardian-service/src/middleware/csrfMiddleware.js`

### Archivos Modificados (9):
- `user-service/src/index.js`
- `user-service/.env`
- `application-service/src/app.js`
- `application-service/src/routes/applicationRoutes.js`
- `evaluation-service/src/app.js`
- `evaluation-service/src/routes/evaluationRoutes.js`
- `evaluation-service/src/routes/interviewRoutes.js`
- `evaluation-service/src/routes/interviewerScheduleRoutes.js`
- `guardian-service/src/app.js`
- `guardian-service/src/routes/guardianRoutes.js`

### Variables de Entorno Agregadas (4 servicios):
- `CSRF_SECRET` en user-service/.env
- `CSRF_SECRET` en application-service/.env
- `CSRF_SECRET` en evaluation-service/.env
- `CSRF_SECRET` en guardian-service/.env

### Total de Rutas Protegidas: 27
- Application-Service: 6 rutas
- Evaluation-Service: 18 rutas
- Guardian-Service: 3 rutas

---

## ✅ DEPLOYMENT FINAL CHECKLIST

Antes de hacer deploy a Railway:

- [ ] `CSRF_SECRET` configurado en Railway (application-service)
- [ ] `CSRF_SECRET` configurado en Railway (evaluation-service)
- [ ] `CSRF_SECRET` configurado en Railway (guardian-service)
- [ ] `CSRF_SECRET` configurado en Railway (user-service)
- [ ] `JWT_SECRET` verificado en todos los servicios
- [ ] Todos los servicios redeployados después de agregar variables
- [ ] Test de generación de tokens CSRF exitoso
- [ ] Test de validación CSRF exitoso
- [ ] Frontend actualizado para usar CSRF tokens
- [ ] Documentación de API actualizada

---

## 📚 RECURSOS ADICIONALES

### Frontend Integration
El frontend necesita:

1. **Obtener CSRF Token antes de mutaciones:**
```javascript
const getCsrfToken = async () => {
  const response = await fetch('https://your-service.railway.app/api/csrf-token');
  const data = await response.json();
  return data.csrfToken;
};
```

2. **Incluir en headers de todas las mutaciones:**
```javascript
const csrfToken = await getCsrfToken();

fetch('https://your-service.railway.app/api/applications', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'x-csrf-token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

3. **Implementar cache/refresh de CSRF tokens:**
```javascript
let csrfToken = null;
let tokenExpiry = null;

const getCachedCsrfToken = async () => {
  const now = Date.now();

  if (!csrfToken || !tokenExpiry || now > tokenExpiry) {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    csrfToken = data.csrfToken;
    tokenExpiry = now + (data.expiresIn * 1000) - 60000; // Refresh 1 min before expiry
  }

  return csrfToken;
};
```

---

**Última actualización:** 2025-10-20
**Implementado por:** Claude Code
**Versión:** 1.0.0
