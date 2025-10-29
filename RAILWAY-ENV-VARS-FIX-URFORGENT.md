# 🔴 URGENTE: Corregir Variables de Entorno en Railway

## Problemas Detectados en los Logs

### ❌ Problema 1: USER_SERVICE_URL usa HTTP en lugar de HTTPS
**Log actual**:
```
USER_SERVICE: http://user-service-production-ab59.up.railway.app
```

**Debe ser**:
```
USER_SERVICE: https://user-service-production-ab59.up.railway.app
```

### ❌ Problema 2: DASHBOARD_SERVICE y GUARDIAN_SERVICE usan Private Networking (no funciona)
**Log actual**:
```
DASHBOARD_SERVICE: http://dashboard-service:8080
GUARDIAN_SERVICE: http://guardian-service:8080
```

**Deben ser URLs públicas HTTPS** (obtener desde Railway Dashboard).

### ❌ Problema 3: NOTIFICATION_SERVICE_URL usa HTTP en lugar de HTTPS
**Log actual**:
```
NOTIFICATION_SERVICE: http://notification-service-production-3411.up.railway.app
```

---

## ✅ Solución: Corregir Variables en Railway

### Paso 1: Abrir Railway Dashboard
1. Ir a [Railway Dashboard](https://railway.app)
2. Seleccionar tu proyecto
3. Click en **`gateway-service`**

### Paso 2: Ir a Variables
1. Click en la pestaña **"Variables"**
2. Buscar todas las variables `*_SERVICE_URL`

### Paso 3: Corregir Cada Variable

#### 1. USER_SERVICE_URL
- **Nombre**: `USER_SERVICE_URL`
- **Cambiar de**: `http://user-service-production-ab59.up.railway.app`
- **Cambiar a**: `https://user-service-production-ab59.up.railway.app`
- **Acción**: Click en el lápiz (✏️), cambiar `http://` por `https://`, guardar

#### 2. NOTIFICATION_SERVICE_URL
- **Nombre**: `NOTIFICATION_SERVICE_URL`
- **Cambiar de**: `http://notification-service-production-3411.up.railway.app`
- **Cambiar a**: `https://notification-service-production-3411.up.railway.app`
- **Acción**: Click en el lápiz (✏️), cambiar `http://` por `https://`, guardar

#### 3. DASHBOARD_SERVICE_URL
**Primero, obtener la URL pública**:
1. Railway Dashboard → `dashboard-service`
2. Settings → Networking
3. Buscar "Public Domain"
4. Copiar la URL completa (ej: `https://dashboard-service-production-xxx.up.railway.app`)

**Luego, actualizar la variable**:
- **Nombre**: `DASHBOARD_SERVICE_URL`
- **Cambiar de**: `http://dashboard-service:8080`
- **Cambiar a**: `https://dashboard-service-production-xxx.up.railway.app` (la URL que copiaste)
- **Acción**: Click en el lápiz (✏️), reemplazar el valor completo, guardar

#### 4. GUARDIAN_SERVICE_URL
**Primero, obtener la URL pública**:
1. Railway Dashboard → `guardian-service`
2. Settings → Networking
3. Buscar "Public Domain"
4. Copiar la URL completa (ej: `https://guardian-service-production-xxx.up.railway.app`)

**Luego, actualizar la variable**:
- **Nombre**: `GUARDIAN_SERVICE_URL`
- **Cambiar de**: `http://guardian-service:8080`
- **Cambiar a**: `https://guardian-service-production-xxx.up.railway.app` (la URL que copiaste)
- **Acción**: Click en el lápiz (✏️), reemplazar el valor completo, guardar

---

## ✅ Verificación

Después de cambiar las variables, Railway reiniciará automáticamente el `gateway-service`.

**Verificar en los logs** (Railway → gateway-service → Logs):
```
Service URLs configured:
  USER_SERVICE: https://user-service-production-ab59.up.railway.app ✅
  APPLICATION_SERVICE: https://application-service-production.up.railway.app ✅
  EVALUATION_SERVICE: https://evaluation-service-production.up.railway.app ✅
  NOTIFICATION_SERVICE: https://notification-service-production-3411.up.railway.app ✅
  DASHBOARD_SERVICE: https://dashboard-service-production-xxx.up.railway.app ✅
  GUARDIAN_SERVICE: https://guardian-service-production-xxx.up.railway.app ✅
```

**Todas deben empezar con `https://`** y **todas deben ser URLs públicas** (terminan en `.up.railway.app`).

---

## 🎯 Resultado Esperado

Después de estos cambios:
1. ✅ No habrá redirects HTTP → HTTPS (todos los servicios ya usan HTTPS)
2. ✅ No habrá problemas de private networking (todos usan URLs públicas)
3. ✅ El gateway podrá hacer proxy correctamente a todos los servicios
4. ✅ El login debería funcionar sin errores CORS o redirects

---

## ⏱️ Tiempo Estimado

- Cambiar variables: **2-3 minutos**
- Railway re-deploy automático: **1-2 minutos**
- **Total: 3-5 minutos**

---

## 🔍 Si Sigue Fallando

Después de cambiar las variables, esperar 3-5 minutos y probar el login nuevamente.

Si aún falla, verificar en los logs del `gateway-service` que todas las URLs estén correctas.

