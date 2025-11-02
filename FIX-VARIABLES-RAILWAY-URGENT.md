# 🔴 FIX URGENTE - Variables de Railway

## ❌ Problema Encontrado

Tus variables tienen problemas:

```bash
# ❌ PROBLEMA 1: HTTP sin 's' (causa redirects)
USER_SERVICE_URL="http://user-service-production-ab59.up.railway.app"
NOTIFICATION_SERVICE_URL="http://notification-service-production-3411.up.railway.app"

# ❌ PROBLEMA 2: Private networking (no funciona)
DASHBOARD_SERVICE_URL="http://dashboard-service:8080"
GUARDIAN_SERVICE_URL="http://guardian-service:8080"

# ✅ CORRECTO: HTTPS
APPLICATION_SERVICE_URL="https://application-service-production.up.railway.app"
EVALUATION_SERVICE_URL="https://evaluation-service-production.up.railway.app"
```

---

## ✅ SOLUCIÓN - Cambiar TODAS a HTTPS

Ve a **Railway → gateway-service → Variables** y:

### Paso 1: ELIMINAR Private Networking

**Eliminar** estas variables:
```bash
❌ DASHBOARD_SERVICE_URL="http://dashboard-service:8080"
❌ GUARDIAN_SERVICE_URL="http://guardian-service:8080"
```

### Paso 2: Obtener URLs HTTPS de Dashboard y Guardian

1. Railway → `dashboard-service`
2. Settings → Networking
3. Buscar "Public Domain"
4. Si NO existe: Click "Generate Domain"
5. Copiar URL completa

Repetir para `guardian-service`.

### Paso 3: Actualizar Variables Existentes

Cambiar estas variables:

#### USER_SERVICE_URL
```bash
# DE:
http://user-service-production-ab59.up.railway.app

# A:
https://user-service-production-ab59.up.railway.app
```

#### NOTIFICATION_SERVICE_URL
```bash
# DE:
http://notification-service-production-3411.up.railway.app

# A:
https://notification-service-production-3411.up.railway.app
```

#### DASHBOARD_SERVICE_URL (Nueva)
```bash
https://dashboard-service-production-XXX.up.railway.app
```
(Reemplazar XXX con el código real de Railway)

#### GUARDIAN_SERVICE_URL (Nueva)
```bash
https://guardian-service-production-XXX.up.railway.app
```
(Reemplazar XXX con el código real de Railway)

---

## 📋 Configuración FINAL Correcta

Después de los cambios, TODAS deben ser HTTPS:

```bash
USER_SERVICE_URL="https://user-service-production-ab59.up.railway.app"
APPLICATION_SERVICE_URL="https://application-service-production.up.railway.app"
EVALUATION_SERVICE_URL="https://evaluation-service-production.up.railway.app"
NOTIFICATION_SERVICE_URL="https://notification-service-production-3411.up.railway.app"
DASHBOARD_SERVICE_URL="https://dashboard-service-production-XXX.up.railway.app"
GUARDIAN_SERVICE_URL="https://guardian-service-production-XXX.up.railway.app"
```

**TODAS con HTTPS (con 's')**  
**Ninguna con HTTP (sin 's')**  
**Ninguna con private networking (`:8080`)**

---

## ⏱️ Después de Cambiar

1. Esperar 1-2 minutos
2. Railway re-desplegará automáticamente
3. Probar login

**Debería funcionar**.

