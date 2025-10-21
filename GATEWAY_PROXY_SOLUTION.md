# Solución Temporal: Gateway Proxy Issue

## Problema Identificado

El problema del gateway proxy es complejo y requiere más investigación. **El endpoint `/auth/check-email` funciona perfectamente cuando se accede directamente al user-service.**

### Problema Técnico

1. **Express body parser** - Cuando `express.json()` parsea el body, `http-proxy-middleware` pierde acceso al raw body stream
2. **Path rewriting** - Express elimina el prefijo del path cuando usas `app.use('/api/auth', ...)`, causando que el backend reciba `/check-email` en lugar de `/api/auth/check-email`

### Estado Actual

✅ **USER-SERVICE FUNCIONANDO:**
```bash
$ curl -X POST http://localhost:8082/api/auth/check-email \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

false  # ✅ Funciona correctamente
```

⚠️ **GATEWAY PROXY CON ISSUES:**
```bash
$ curl -X POST http://localhost:8080/api/auth/check-email \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

Error: Cannot POST /check-email  # ❌ Path incorrecto
```

## Soluciones Intentadas

1. ❌ Reescribir body en onProxyReq - Causó hang
2. ❌ Remover express.json() - Path rewriting incorrecto
3. ❌ Simplificar pathRewrite - Mismo issue

## Recomendación

**OPCIÓN A: Usar directamente los servicios sin gateway (temporal)**

Para testing inmediato, acceder directamente a:
- User Service: http://localhost:8082
- Application Service: http://localhost:8083
- Evaluation Service: http://localhost:8084

**OPCIÓN B: Migrar a express-http-proxy**

Reemplazar `http-proxy-middleware` con `express-http-proxy`:

```bash
npm install express-http-proxy
```

```javascript
const proxy = require('express-http-proxy');

app.use('/api/auth', proxy('http://localhost:8082', {
  proxyReqPathResolver: (req) => {
    return '/api/auth' + req.url;
  },
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    // Copiar headers
    return proxyReqOpts;
  }
}));
```

**OPCIÓN C: Usar NGINX real (producción)**

Para producción, usar NGINX real en lugar de Express gateway.

## Próximos Pasos

1. Ejecutar testing directo a servicios (sin gateway)
2. Documentar resultados
3. Investigar migración a express-http-proxy o NGINX real

##Estado

- ✅ Endpoints corregidos (HTTP methods)
- ✅ User-service funcionando
- ⚠️ Gateway requiere arquitectura diferente
