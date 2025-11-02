# ✅ Fix CORS Completado

## Problema

El gateway estaba haciendo redirect (301) en lugar de proxy, causando que el navegador llame directamente al `user-service`. El `user-service` no tenía CORS configurado, bloqueando las requests.

---

## Solución Implementada

**Agregar CORS a `user-service`**:

1. ✅ Instalado `cors` (ya estaba en dependencies)
2. ✅ Configurado CORS en `user-service/src/app.js`
3. ✅ Commit y push a GitHub

**Configuración de CORS**:
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://admision-mtn-front.vercel.app',  // ← Frontend de Vercel
  process.env.CORS_ORIGIN || process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token'],
  exposedHeaders: ['x-request-id']
}));
```

---

## Próximos Pasos

1. **Esperar**: Railway re-desplegará automáticamente el `user-service` (2-3 minutos)
2. **Probar**: El login debería funcionar ahora

---

## ¿Por Qué Funcionará?

**Antes**:
```
Frontend → Gateway → Redirect → user-service (sin CORS) → ❌ Bloqueado
```

**Ahora**:
```
Frontend → Gateway → Redirect → user-service (con CORS) → ✅ Funciona
```

El `user-service` ahora acepta requests desde `https://admision-mtn-front.vercel.app`.

---

## Nota

Esto es una solución temporal. **El problema real es que el gateway hace redirects en lugar de proxying**. Esto significa que:
- El gateway no está haciendo su trabajo de proxy
- Las requests van directo a los servicios backend
- Por eso necesitamos CORS en cada servicio

**Solución permanente**: Arreglar el gateway para que haga proxy correctamente, sin redirects.

