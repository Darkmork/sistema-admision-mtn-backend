# Solución Rápida Error 504

## 🔴 El Problema

Gateway devuelve 504 (Gateway Timeout) cuando intenta conectar con servicios backend vía private networking.

## ✅ Soluciones Inmediatas

### Opción 1: Usar URLs Públicas (Solución Inmediata)

Si las URLs privadas no funcionan, usa URLs públicas temporalmente:

```bash
# En Railway Dashboard → gateway-service → Variables

USER_SERVICE_URL=https://user-service-production.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
EVALUATION_SERVICE_URL=https://evaluation-service-production.up.railway.app
NOTIFICATION_SERVICE_URL=https://notification-service-production.up.railway.app
DASHBOARD_SERVICE_URL=https://dashboard-service-production.up.railway.app
GUARDIAN_SERVICE_URL=https://guardian-service-production.up.railway.app
```

**Ventajas**:
- ✅ Funciona inmediatamente
- ✅ No requiere configuración especial
- ✅ Los servicios deben tener URLs públicas

**Desventajas**:
- ❌ Más lento (via internet público)
- ❌ Menos seguro (públicamente accesible)
- ❌ No usa private networking

---

### Opción 2: Verificar Private Networking (Solución Correcta)

Si quieres usar private networking:

**1. Verificar Private Networking está habilitado**:
- Railway Dashboard → Project Settings
- "Private Networking" debe estar en "ENABLED"

**2. Verificar nombres de servicios**:
Los nombres en Railway deben coincidir EXACTAMENTE:

```bash
user-service
application-service
evaluation-service
notification-service
dashboard-service
guardian-service
gateway-service
```

**3. Verificar formato de URLs**:
```bash
# ✅ CORRECTO (sin https, sin .railway.app):
http://service-name:8080

# ❌ INCORRECTO:
https://service-name-production.up.railway.app
http://service-name.railway.app
http://service-name:8082
```

**4. Verificar logs del Gateway**:
Railway Dashboard → gateway-service → Logs, buscar:
```
Service URLs configured:
  USER_SERVICE: http://user-service:8080
```

---

## 🎯 Recomendación Inmediata

**Usa URLs públicas ahora** para que funcione:

1. Railway Dashboard → `gateway-service` → Variables
2. Cambia cada `*_SERVICE_URL` de privado a público
3. Esperar 1 minuto para que re-despliegue
4. Probar login

Esto funcionará inmediatamente y podrás trabajar. Luego investigamos por qué el private networking no funciona.

