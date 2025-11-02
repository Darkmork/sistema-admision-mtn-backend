# Solución: ERR_TOO_MANY_REDIRECTS

## 🔴 Problema

Error `ERR_TOO_MANY_REDIRECTS` cuando intentas hacer login.

**Síntomas**:
```
Failed to load resource: net::ERR_TOO_MANY_REDIRECTS
gateway-service-prod...i/auth/csrf-token
gateway-service-prod...pp/api/auth/login
```

**Causa**:
El gateway ahora **SÍ puede conectar** a los servicios (ya no hay 504), pero hay un **loop de redirects infinito**.

---

## 🎯 Causa Raíz

**Los servicios backend en Railway redirigen HTTP → HTTPS automáticamente.**

Si el gateway intenta conectar vía HTTP (`http://user-service:8080`) pero Railway hace auto-redirect a HTTPS, el gateway intenta seguir el redirect, pero Railway vuelve a redirigir, creando un loop infinito.

---

## ✅ Soluciones

### Solución 1: Usar URLs HTTPS (Recomendada)

En Railway → `gateway-service` → Variables:

**Cambiar de**:
```bash
USER_SERVICE_URL=http://user-service:8080
```

**A**:
```bash
USER_SERVICE_URL=https://user-service-production.up.railway.app
```

**Aplicar a TODOS los servicios**:
```bash
USER_SERVICE_URL=https://user-service-production.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
EVALUATION_SERVICE_URL=https://evaluation-service-production.up.railway.app
NOTIFICATION_SERVICE_URL=https://notification-service-production.up.railway.app
DASHBOARD_SERVICE_URL=https://dashboard-service-production.up.railway.app
GUARDIAN_SERVICE_URL=https://guardian-service-production.up.railway.app
```

**Ventajas**:
- ✅ Funciona inmediatamente
- ✅ Usa red pública (más confiable que private networking)
- ✅ No hay loops de redirects

**Desventajas**:
- ❌ Más lento (via internet público)
- ❌ Costo de egress ($0.10/GB)

---

### Solución 2: Deshabilitar Auto-Redirects en Railway

Railway puede estar forzando HTTPS automáticamente en los servicios backend.

**Verificación**:
1. Railway Dashboard → Cada servicio backend
2. Settings → Networking
3. Ver si hay opción "Force HTTPS" o similar
4. Si está habilitado: Deshabilitar

**Nota**: Railway puede no tener esta opción visible.

---

### Solución 3: Cambiar Private Networking a Sin Puerto

En Railway → `gateway-service` → Variables:

**Cambiar de**:
```bash
USER_SERVICE_URL=http://user-service:8080
```

**A** (sin especificar puerto):
```bash
USER_SERVICE_URL=http://user-service
```

Railway puede manejar esto automáticamente.

---

### Solución 4: Deshabilitar Helmet HTTPS Redirect

Si los servicios usan Helmet con `httpsRedirectMiddleware`, puede estar forzando HTTPS.

**Verificar en cada servicio** (user-service, etc.):

```javascript
// Buscar si hay algo como:
app.use(helmet({
  httpsRedirectMiddleware: true  // ← Esto causa redirects
}));
```

**Solución**: Eliminar o deshabilitar HTTPS redirects en Helmet.

---

## 🎯 Mi Recomendación INMEDIATA

**Usar Solución 1: URLs HTTPS públicas**

1. Railway → `gateway-service` → Variables
2. Cambiar todas las URLs a HTTPS con dominios públicos
3. Esperar 1 minuto
4. Probar login

Esto funcionará inmediatamente y te permitirá continuar trabajando.

---

## 📋 Pasos Exactos para Solución 1

### Paso 1: Obtener URLs Públicas

1. Railway Dashboard
2. Click en cada servicio
3. Settings → Networking
4. Copiar la URL en "Public Domain"

Ejemplo:
- `user-service` → Public Domain: `https://user-service-production-xxx.up.railway.app`
- Copiar exactamente esa URL

### Paso 2: Configurar Gateway

Railway → `gateway-service` → Variables

**Eliminar** (si existen):
```bash
USER_SERVICE_URL=http://user-service:8080
```

**Añadir**:
```bash
USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app
```

Repetir para cada servicio.

### Paso 3: Esperar y Probar

1. Esperar 1-2 minutos (Railway re-despliega automáticamente)
2. Probar login desde frontend
3. Debería funcionar ✅

---

## 🔍 Verificación de Logs

Después de cambiar las variables, verifica los logs del gateway:

```bash
# Railway Dashboard → gateway-service → Logs

# Debe mostrar:
Service URLs configured:
  USER_SERVICE: https://user-service-production-xxx.up.railway.app
  APPLICATION_SERVICE: https://application-service-production-xxx.up.railway.app
  ...
```

Si todavía muestra `http://user-service:8080`, Railway no tomó los cambios.

---

## 🚨 Si el Problema Persiste

**Debug avanzado**:

1. **Verificar que los servicios backend responden directamente**:
   ```bash
   curl https://user-service-production-xxx.up.railway.app/health
   ```
   Debe devolver JSON, no un redirect.

2. **Verificar logs del gateway**:
   Buscar errores de conexión o timeout.

3. **Verificar logs de servicios backend**:
   Buscar si están recibiendo requests del gateway.

---

## 💡 Nota Final

Este error (ERR_TOO_MANY_REDIRECTS) es **mejor** que el 504, porque significa:
- ✅ El gateway SÍ puede alcanzar los servicios
- ✅ Los servicios SÍ están funcionando
- ✅ Solo hay un problema de configuración de URL

La solución más rápida es usar URLs HTTPS públicas.

