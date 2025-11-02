# Variables de Entorno para Railway - URLs Públicas

## 📋 Configuración Inmediata

Ve a **Railway Dashboard** → **`gateway-service`** → **Variables** y añade/cambia estas variables:

---

## ✅ Variables a Configurar

Copia y pega estas variables en Railway (Reemplaza con tus URLs reales):

```bash
NODE_ENV=production

JWT_SECRET=mtn_secret_key_2025_admissions

# SERVICE URLS - USAR URLs PÚBLICAS
USER_SERVICE_URL=https://user-service-production.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
EVALUATION_SERVICE_URL=https://evaluation-service-production.up.railway.app
NOTIFICATION_SERVICE_URL=https://notification-service-production.up.railway.app
DASHBOARD_SERVICE_URL=https://dashboard-service-production.up.railway.app
GUARDIAN_SERVICE_URL=https://guardian-service-production.up.railway.app
```

---

## 🔍 Cómo Obtener las URLs Reales

1. **Ir a Railway Dashboard**
2. **Click en cada servicio** (user-service, application-service, etc.)
3. **Pestaña "Settings"** → **"Networking"**
4. **Copiar la URL** que aparece en "Public Domain"
   - Formato: `https://service-name-production-xxx.up.railway.app`
5. **Pegar en la variable correspondiente**

---

## 📝 Instrucciones Paso a Paso

### Paso 1: Ir a Railway

1. Abre Railway Dashboard
2. Click en tu proyecto "sistema-admision-mtn-backend"
3. Click en **`gateway-service`**
4. Pestaña **"Variables"**

### Paso 2: Eliminar Variables Privadas (si existen)

Busca y **ELIMINA** estas variables (si existen):
```bash
USER_SERVICE_URL=http://user-service:8080 ❌ ELIMINAR
APPLICATION_SERVICE_URL=http://application-service:8080 ❌ ELIMINAR
EVALUATION_SERVICE_URL=http://evaluation-service:8080 ❌ ELIMINAR
NOTIFICATION_SERVICE_URL=http://notification-service:8080 ❌ ELIMINAR
DASHBOARD_SERVICE_URL=http://dashboard-service:8080 ❌ ELIMINAR
GUARDIAN_SERVICE_URL=http://guardian-service:8080 ❌ ELIMINAR
```

### Paso 3: Añadir Variables Públicas

Para cada servicio:

#### 1. User Service
**Variables** → **"New Variable"**
- **Name**: `USER_SERVICE_URL`
- **Value**: `https://user-service-production.up.railway.app`
- Click **"Add"**

#### 2. Application Service
- **Name**: `APPLICATION_SERVICE_URL`
- **Value**: `https://application-service-production.up.railway.app`
- Click **"Add"**

#### 3. Evaluation Service
- **Name**: `EVALUATION_SERVICE_URL`
- **Value**: `https://evaluation-service-production.up.railway.app`
- Click **"Add"**

#### 4. Notification Service
- **Name**: `NOTIFICATION_SERVICE_URL`
- **Value**: `https://notification-service-production.up.railway.app`
- Click **"Add"**

#### 5. Dashboard Service
- **Name**: `DASHBOARD_SERVICE_URL`
- **Value**: `https://dashboard-service-production.up.railway.app`
- Click **"Add"**

#### 6. Guardian Service
- **Name**: `GUARDIAN_SERVICE_URL`
- **Value**: `https://guardian-service-production.up.railway.app`
- Click **"Add"**

---

## ⚠️ IMPORTANTE: Verificar URLs Reales

**Las URLs que pongas DEBEN ser las reales de Railway.** 

Para obtenerlas:

1. Railway Dashboard
2. Click en **`user-service`**
3. Settings → Networking
4. Copiar la URL en "Public Domain"
5. Usar esa URL exacta

Repetir para cada servicio.

---

## ✅ Verificación

Después de cambiar las variables:

1. **Esperar 1-2 minutos** (Railway re-despliega automáticamente)
2. **Probar el login** desde el frontend
3. **Si funciona** ✅ = Problema resuelto con URLs públicas
4. **Si no funciona** ❌ = Verificar que las URLs sean correctas

---

## 🔄 Rollback (si quieres volver a privadas)

Si después quieres volver a URLs privadas:

```bash
# Cambiar de:
https://service-name-production.up.railway.app

# A:
http://service-name:8080
```

Pero primero necesitamos arreglar por qué el private networking no funciona.

---

## 📝 Nota

Esto es una **solución temporal** para que funcione ahora. Después investigaremos por qué el private networking falla en Railway.

