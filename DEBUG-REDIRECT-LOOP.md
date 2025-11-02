# Debug: ERR_TOO_MANY_REDIRECTS con URLs HTTPS Públicas

## El Problema

Tienes URLs HTTPS públicas configuradas en Railway:
```bash
USER_SERVICE_URL=https://user-service-production.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
...
```

Pero aún tienes `ERR_TOO_MANY_REDIRECTS`.

---

## 🔍 Diagnóstico - Posibles Causas

### Causa 1: Gateway Está Redirigiendo (Muy Probable)

Railway puede estar detrás de un load balancer o proxy que fuerza HTTPS, y el gateway está redirigiendo.

**Verificar**:
Railway → `gateway-service` → Logs

Buscar:
```
Service URLs configured:
  USER_SERVICE: https://...
```

**Si muestra URLs correctas pero aún así falla**, el problema es el gateway mismo.

---

### Causa 2: Request Loops Entre Servicios

Si el gateway llama a un servicio A, y el servicio A llama al gateway, creas un loop.

**Verificar**:
- Logs de gateway-service
- Buscar requests circulares

---

### Causa 3: Railway Settings

Railway puede tener configuraciones que fuerzan redirects:

1. Railway Dashboard → `gateway-service`
2. Settings → "Generate Domain"
3. Ver si hay opciones de "Force HTTPS" o similar

**Si existe una opción de "Force HTTPS" o "HTTPS Redirect"**:
- Deshabilitarla temporalmente
- Probar login

---

### Causa 4: CORS Causando Redirects

CORS issues pueden manifestarse como redirects en algunos navegadores.

**Verificar**:
- Abrir Developer Tools (F12)
- Pestaña Network
- Buscar requests a `/api/auth/csrf-token`
- Ver si hay errores de CORS

---

### Causa 5: Headers Incorrectos en los Servicios Backend

Si los servicios backend tienen headers de redirect, pueden estar causando el loop.

**Verificar logs de user-service en Railway**:
```bash
# Railway Dashboard → user-service → Logs
# Buscar si hay:
Location: https://...
```

---

## ✅ Soluciones a Probar

### Solución 1: Verificar Variables en Railway

**Railway Dashboard → gateway-service → Variables**

**Verificar que TODAS las URLs son HTTPS (no HTTP)**:

```bash
# ✅ CORRECTO:
USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app

# ❌ INCORRECTO (esto causa redirects):
USER_SERVICE_URL=http://user-service-production-xxx.up.railway.app
```

**Si ves alguna URL con `http://`**, cambiar a `https://`.

---

### Solución 2: Simplificar URLs

Prueba sin el path completo:

**Railway → gateway-service → Variables**

```bash
# Cambiar de:
USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app

# A (sin paths):
USER_SERVICE_URL=user-service-production-xxx.up.railway.app
```

(Esto NO debería funcionar, pero prueba para descartar).

---

### Solución 3: Verificar que Servicios Responden Directamente

**Probar cada servicio directamente**:

```bash
# User Service
curl https://user-service-production-xxx.up.railway.app/health

# Debe devolver JSON:
{"status":"UP","service":"user-service",...}
```

**Si devuelve un redirect 301/302**, ese servicio tiene el problema.

---

### Solución 4: Temporalmente Deshabilitar Helmet en Gateway

Si Helmet tiene `httpsRedirectMiddleware`, puede estar causando redirects.

**gateway-service/src/server.js**:

```javascript
// Buscar:
app.use(helmet({
  // ...config
}));

// Temporalmente comentar Helmet:
// app.use(helmet({...}));
```

Commit, push, esperar deploy, probar.

**NO recomendado para producción**, pero sirve para debugging.

---

### Solución 5: Ver Logs en Tiempo Real

**Railway Dashboard → gateway-service → Logs**:

Mientras intentas hacer login, observa los logs en tiempo real.

**Busca**:
```
[Proxy error] ...
Service URLs configured:
Redirecting to: ...
```

Esto te mostrará exactamente qué está causando el redirect.

---

## 🎯 Plan de Acción Inmediata

### Paso 1: Ver Logs del Gateway Ahora Mismo

Railway → `gateway-service` → Logs

**Copiar y pegar aquí** las últimas 20 líneas de logs.

---

### Paso 2: Ver Logs del User Service

Railway → `user-service` → Logs

**Copiar y pegar aquí** las últimas 20 líneas de logs.

---

### Paso 3: Captura de Pantalla de Variables

Railway → `gateway-service` → Variables

**Hacer screenshot** de todas las variables `*_SERVICE_URL`.

---

## 💡 Lo Más Probable

**El problema es que Railway está redirigiendo en el gateway mismo**, no en los servicios backend.

**Solución temporal**: Bypassear el gateway completamente desde el frontend.

En el frontend, cambiar de:
```javascript
// Frontend code:
const API_URL = 'https://gateway-service-production-a753.up.railway.app';

// A:
const API_URL = 'https://user-service-production-xxx.up.railway.app';
```

Esto NO es una solución permanente, pero funcionará inmediatamente.

---

## 🔥 Solución Último Recurso

**Si NADA funciona**:

1. Crear un nuevo servicio en Railway
2. Deploy código del gateway ahí
3. Configurar variables desde cero
4. Probar

Esto descarta cualquier configuración corrupta de Railway.

