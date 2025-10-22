# Variables de Entorno para Railway - Gateway Service

## Problema Identificado

El gateway está buscando `http://user_service:8080` (guión bajo) pero el servicio en Railway se llama `user-service` (con guión).

## Solución: Configurar Variables de Entorno en Railway

### Para Gateway Service en Railway:

Ve a **Railway Dashboard → gateway-service → Variables** y configura:

```bash
# Service URLs usando Private Networking (nombres exactos de Railway)
USER_SERVICE_URL=http://user-service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080

# JWT Configuration
JWT_SECRET=mtn_secret_key_2025_admissions

# Node Environment
NODE_ENV=production

# Frontend URL (Vercel)
FRONTEND_URL=https://admision-mtn-front.vercel.app

# CORS Origin (permite tu dominio de Vercel)
CORS_ORIGIN=https://admision-mtn-front.vercel.app
```

## IMPORTANTE: Verificar Nombres de Servicios

Los nombres en las URLs **DEBEN coincidir exactamente** con los nombres mostrados en Railway Dashboard:

- ✅ `user-service` (CON guión) ← según la captura que compartiste
- ❌ `user_service` (CON guión bajo) ← incorrecto

Si algún otro servicio tiene guión bajo en lugar de guión, ajusta la URL correspondiente.

## Después de Configurar

1. Railway hará redeploy automático del gateway
2. Espera 1-2 minutos a que complete el deployment
3. Prueba los endpoints:
   ```bash
   curl https://gateway-service-production-a753.up.railway.app/api/auth/csrf-token
   ```

## Verificación

El gateway debería responder correctamente a todas las rutas que usan user-service:
- `/api/auth/csrf-token`
- `/api/auth/login`
- `/api/users/roles`
- `/api/users/health`
