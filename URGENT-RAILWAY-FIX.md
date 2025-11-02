# 🔴 URGENTE: Fix Error ERR_TOO_MANY_REDIRECTS

## El Problema

Railway está haciendo auto-redirects HTTP → HTTPS, creando un loop infinito.

**Error**: `ERR_TOO_MANY_REDIRECTS`

---

## ✅ Solución INMEDIATA

### Paso 1: Ve a Railway Dashboard

1. Abre [Railway Dashboard](https://railway.app)
2. Click en tu proyecto
3. Click en **`gateway-service`**

### Paso 2: Ve a Variables

1. Pestaña **"Variables"**
2. Busca todas las variables que dicen `*_SERVICE_URL`

### Paso 3: ELIMINA Variables Privadas (si existen)

Busca y **ELIMINA** estas variables (una por una):
```bash
❌ USER_SERVICE_URL=http://user-service:8080
❌ APPLICATION_SERVICE_URL=http://application-service:8080
❌ EVALUATION_SERVICE_URL=http://evaluation-service:8080
❌ NOTIFICATION_SERVICE_URL=http://notification-service:8080
❌ DASHBOARD_SERVICE_URL=http://dashboard-service:8080
❌ GUARDIAN_SERVICE_URL=http://guardian-service:8080
```

**Cómo eliminarlas**:
- Click en el ícono de basura (🗑️) al lado de cada variable
- Confirmar eliminación

### Paso 4: Obtener URLs Públicas de los Servicios

Para cada servicio backend:

1. Railway Dashboard
2. Click en el servicio (ej: `user-service`)
3. Click en **"Settings"**
4. Click en **"Networking"**
5. Busca **"Public Domain"**
6. **Copia la URL** completa (ej: `https://user-service-production-xxx.up.railway.app`)

**Repetir para cada servicio**.

### Paso 5: Añadir URLs HTTPS Públicas

En `gateway-service` → Variables → "New Variable":

**Para cada servicio**:

#### 1. User Service
- **Name**: `USER_SERVICE_URL`
- **Value**: `https://user-service-production-xxx.up.railway.app` (la URL que copiaste)
- Click **"Add"**

#### 2. Application Service
- **Name**: `APPLICATION_SERVICE_URL`
- **Value**: `https://application-service-production-xxx.up.railway.app`
- Click **"Add"**

#### 3. Evaluation Service
- **Name**: `EVALUATION_SERVICE_URL`
- **Value**: `https://evaluation-service-production-xxx.up.railway.app`
- Click **"Add"**

#### 4. Notification Service
- **Name**: `NOTIFICATION_SERVICE_URL`
- **Value**: `https://notification-service-production-xxx.up.railway.app`
- Click **"Add"**

#### 5. Dashboard Service
- **Name**: `DASHBOARD_SERVICE_URL`
- **Value**: `https://dashboard-service-production-xxx.up.railway.app`
- Click **"Add"**

#### 6. Guardian Service
- **Name**: `GUARDIAN_SERVICE_URL`
- **Value**: `https://guardian-service-production-xxx.up.railway.app`
- Click **"Add"**

---

## ⚠️ IMPORTANTE

**Asegúrate de usar HTTPS (NO HTTP)**:
```bash
# ✅ CORRECTO:
https://user-service-production-xxx.up.railway.app

# ❌ INCORRECTO:
http://user-service-production-xxx.up.railway.app
```

---

## ✅ Verificación

Después de cambiar las variables:

1. Esperar 1-2 minutos (Railway re-despliega automáticamente)
2. Probar login desde frontend
3. Debería funcionar ✅

---

## 🔍 Si No Tienes URLs Públicas

Si algún servicio NO tiene "Public Domain" en Settings → Networking:

1. Ve a Railway Dashboard
2. Click en el servicio
3. **Settings** → **Networking**
4. Click **"Generate Domain"**
5. Esperar 30 segundos
6. Copiar la URL generada

---

## 📝 Ejemplo de Configuración Final

Después de configurar, las variables deberían verse así:

```bash
# En Railway → gateway-service → Variables:

USER_SERVICE_URL=https://user-service-production-abc123.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production-def456.up.railway.app
EVALUATION_SERVICE_URL=https://evaluation-service-production-ghi789.up.railway.app
NOTIFICATION_SERVICE_URL=https://notification-service-production-jkl012.up.railway.app
DASHBOARD_SERVICE_URL=https://dashboard-service-production-mno345.up.railway.app
GUARDIAN_SERVICE_URL=https://guardian-service-production-pqr678.up.railway.app
```

**NOTA**: Los códigos (abc123, def456, etc.) serán diferentes en tu Railway.

---

## 🎯 Después de Esto

Una vez que funcione con URLs HTTPS públicas, el error `ERR_TOO_MANY_REDIRECTS` desaparecerá y podrás hacer login.

El problema era que Railway estaba forzando HTTPS automáticamente y creando redirects infinitos. Usando URLs HTTPS directas, evitamos ese problema.

