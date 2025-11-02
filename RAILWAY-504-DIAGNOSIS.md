# Diagnóstico Error 504 en Railway

**Fecha**: 2025-01-28  
**Error**: Gateway Timeout (504)  
**Ruta afectada**: `/api/auth/csrf-token` y `/api/auth/login`

---

## 🔴 Problema

El gateway en Railway no puede conectar con los servicios backend, devolviendo error 504 (Gateway Timeout).

### Error del Frontend
```
Failed to load resource: 504
Error occurred while trying to proxy: 
gateway-service-production-a753.up.railway.app/api/auth/csrf-token
Error occurred while trying to proxy:
gateway-service-production-a753.up.railway.app/api/auth/login
```

---

## ✅ Cambios Realizados

### Commit 1: Fix Private Networking
```bash
git commit -m "fix: make guardian and dashboard services listen on 0.0.0.0"
```

**Archivos modificados**:
- `guardian-service/src/server.js` - Ahora escucha en `0.0.0.0`
- `dashboard-service/src/server.js` - Ahora escucha en `0.0.0.0`

### Estado ANTES vs DESPUÉS

#### ANTES (problemático):
```javascript
// guardian-service & dashboard-service
server = app.listen(PORT, () => {  // ❌ Escucha solo en localhost
  // ...
});
```

#### DESPUÉS (corregido):
```javascript
// guardian-service & dashboard-service
server = app.listen(PORT, '0.0.0.0', () => {  // ✅ Escucha en todas las interfaces
  logger.info(`Listening on 0.0.0.0:${PORT} (accessible via private network)`);
});
```

---

## 🔍 Causas Probables del 504

### 1. Railway aún no re-desplegó los servicios

**Estado actual en Railway**:
- Los cambios fueron pusheados hace **menos de 5 minutos**
- Railway puede tardar 2-5 minutos en re-desplegar cada servicio
- Algunos servicios pueden no haberse re-desplegado aún

**Verificación**:
1. Ir a Railway Dashboard
2. Verificar que cada servicio tenga el último commit (cc4e113)
3. Verificar que todos los servicios muestren "Deployed" (no "Building")

### 2. Variables de entorno del Gateway usan URLs públicas

**Verificar en Railway Dashboard**:
- Ir a `gateway-service` → Variables
- Revisar `USER_SERVICE_URL` y otros

**Formato INCORRECTO (público)**:
```bash
USER_SERVICE_URL=https://user-service-production.up.railway.app
```

**Formato CORRECTO (privado)**:
```bash
USER_SERVICE_URL=http://user-service:8080
```

**Verificar TODAS las variables**:
```bash
USER_SERVICE_URL=http://user-service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080
```

### 3. Servicios no están escuchando en 0.0.0.0

**Checar logs en Railway**:
```
# En cada servicio, buscar este mensaje:
✅ Listening on 0.0.0.0:8080 (accessible via private network)
```

Si no aparece, el servicio no está escuchando correctamente.

---

## 🛠️ Solución Paso a Paso

### Paso 1: Verificar Deploy en Railway

Para cada servicio (user, application, evaluation, notification, dashboard, guardian):

1. Ir a Railway Dashboard
2. Click en el servicio
3. Pestaña "Deployments"
4. Verificar que el commit más reciente sea `cc4e113` (o más reciente)
5. Verificar que el status sea "SUCCESS" (no "Building" o "Failed")

### Paso 2: Verificar Logs del Gateway

En `gateway-service` → Logs, buscar:

```
Service URLs configured:
  USER_SERVICE: http://user-service:8080  ← Debe ser PRIVADO
  APPLICATION_SERVICE: http://application-service:8080
  ...
```

Si dice `https://...railway.app`, están usando URLs públicas (incorrecto).

### Paso 3: Cambiar Variables de Entorno (si es necesario)

En Railway Dashboard → `gateway-service` → Variables:

```bash
# Eliminar estas (si existen):
USER_SERVICE_URL=https://user-service-production.up.railway.app ❌

# Añadir estas (privadas):
USER_SERVICE_URL=http://user-service:8080 ✅
APPLICATION_SERVICE_URL=http://application-service:8080 ✅
EVALUATION_SERVICE_URL=http://evaluation-service:8080 ✅
NOTIFICATION_SERVICE_URL=http://notification-service:8080 ✅
DASHBOARD_SERVICE_URL=http://dashboard-service:8080 ✅
GUARDIAN_SERVICE_URL=http://guardian-service:8080 ✅
```

### Paso 4: Forzar Re-deploy (si es necesario)

Si los servicios no se re-desplegaron automáticamente:

1. Railway Dashboard → Cada servicio
2. Click "..." (tres puntos)
3. "Redeploy"
4. Esperar 2-3 minutos

### Paso 5: Verificar Logs de cada Servicio

Buscar en los logs:

```bash
# En cada servicio (user, application, etc.):
✅ Listening on 0.0.0.0:8080 (accessible via private network)
```

Si NO aparece, el servicio está crasheando.

---

## 🧪 Testing Manual

### Probar Gateway Directamente

```bash
# Desde tu terminal:
curl https://gateway-service-production-a753.up.railway.app/health

# Debería devolver:
{"success":true,"data":{"status":"healthy","service":"api-gateway",...}}
```

### Probar Servicios Individuales (si tienen URLs públicas)

```bash
# User Service
curl https://user-service-production.up.railway.app/health

# Application Service
curl https://application-service-production.up.railway.app/health

# etc...
```

Si estos fallan con 504, significa que los servicios no están respondiendo.

---

## 📊 Verificación de URLs

### Formato de Nombre en Railway

Railway Service Name es **case-sensitive** y **debe coincidir** con la URL:

```bash
# Railway Dashboard → Settings → Service Name
# Debe ser EXACTAMENTE:
user-service
application-service
evaluation-service
notification-service
dashboard-service
guardian-service
gateway-service
```

### Private Networking

**Verificar que está habilitado**:
1. Railway Dashboard → Project Settings
2. "Private Networking" debe estar en **"ENABLED"**
3. Todos los servicios deben estar en el mismo proyecto

---

## ⏱️ Tiempo Esperado

| Acción | Tiempo |
|--------|--------|
| Push a GitHub | Inmediato |
| Railway detecta cambios | 1-2 minutos |
| Build de cada servicio | 30-60 segundos |
| Deploy de cada servicio | 30-60 segundos |
| **Total** | **5-10 minutos** |

---

## 🚨 Si el Problema Persiste

### Debugging Avanzado

1. **Verificar tiempo de despliegue**:
   - Railway Dashboard → Deployments
   - Ver hora del último deploy
   - Debe ser posterior al commit `cc4e113`

2. **Verificar logs del Gateway**:
   ```
   [Proxy error] Error occurred while trying to proxy
   ```
   Si aparece, el gateway no puede conectar.

3. **Verificar si servicios responden directamente**:
   - Si tienen URL pública, probar con curl
   - Si NO tienen URL pública (correcto), solo es accesible via private network

4. **Verificar variables de entorno**:
   - Railway → gateway-service → Variables
   - Todas las `*_SERVICE_URL` deben ser `http://service-name:8080`

---

## ✅ Checklist de Verificación

- [ ] Todos los servicios re-desplegados (commit cc4e113 o más reciente)
- [ ] Gateway service variables usan formato privado (`http://service-name:8080`)
- [ ] Private Networking habilitado en el proyecto
- [ ] Todos los servicios en el mismo proyecto de Railway
- [ ] Logs del gateway muestran "Service URLs configured" con URLs privadas
- [ ] Logs de cada servicio muestran "Listening on 0.0.0.0:8080"
- [ ] No hay errores en los logs de ningún servicio

---

## 📞 Estado Actual

**Cambios pusheados**: ✅  
**Commits**: 2 (unificación + fix 0.0.0.0)  
**Estado Railway**: Esperando re-deploy automático  
**Tiempo estimado**: 5-10 minutos desde el push

---

## 💡 Recomendación

**Esperar 5-10 minutos** y luego probar el login nuevamente. Si aún falla, verificar la checklist arriba.

