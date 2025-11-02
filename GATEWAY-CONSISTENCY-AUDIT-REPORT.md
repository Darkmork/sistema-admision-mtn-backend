# 🔍 REPORTE DE AUDITORÍA: Consistencia Gateway ↔ Microservicios

**Fecha**: 2025-01-28  
**Auditor**: GatewayConsistencyAuditor  
**Alcance**: Análisis completo de consistencia entre gateway y microservicios

---

## ✅ 1. MAPA DE SERVICIOS

| Servicio | Puerto | Framework | Base Path | Escucha en |
|----------|--------|-----------|-----------|------------|
| `gateway-service` | 8080 | Express | `/` | `0.0.0.0` ✅ |
| `user-service` | 8082 | Express | `/api` | `0.0.0.0` ✅ |
| `application-service` | 8083 | Express | `/api` | `0.0.0.0` ✅ |
| `evaluation-service` | 8084 | Express | `/api` | `0.0.0.0` ✅ |
| `notification-service` | 8085 | Express | `/api` | `0.0.0.0` ✅ |
| `dashboard-service` | 8086 | Express | `/api` | **`localhost` ❌** |
| `guardian-service` | 8087 | Express | `/api` | **`localhost` ❌** |

---

## ✅ 2. RUTAS PUBLICADAS POR EL GATEWAY

### User Service
| Método | Gateway Path | → | Servicio Target | Estado |
|--------|--------------|---|-----------------|--------|
| ALL | `/api/users/*` | → | `user-service` `/api/users/*` | ✅ OK |
| ALL | `/api/auth/*` | → | `user-service` `/api/auth/*` | ✅ OK |

### Application Service
| Método | Gateway Path | → | Servicio Target | Estado |
|--------|--------------|---|-----------------|--------|
| ALL | `/api/applications/*` | → | `application-service` `/api/applications/*` | ✅ OK |
| ALL | `/api/students/*` | → | `application-service` `/api/students/*` | ✅ OK |
| ALL | `/api/documents/*` | → | `application-service` `/api/documents/*` | ✅ OK |

### Evaluation Service
| Método | Gateway Path | → | Servicio Target | Estado |
|--------|--------------|---|-----------------|--------|
| ALL | `/api/evaluations/*` | → | `evaluation-service` `/api/evaluations/*` | ✅ OK |
| ALL | `/api/interviews/*` | → | `evaluation-service` `/api/interviews/*` | ✅ OK |
| ALL | `/api/interviewer-schedules/*` | → | `evaluation-service` `/api/interviewer-schedules/*` | ✅ OK |
| ALL | `/api/fix-schema-interviewer-schedules/*` | → | `evaluation-service` `/api/fix-schema-interviewer-schedules/*` | ✅ OK |

### Notification Service
| Método | Gateway Path | → | Servicio Target | Estado |
|--------|--------------|---|-----------------|--------|
| ALL | `/api/notifications/*` | → | `notification-service` `/api/notifications/*` | ✅ OK |
| ALL | `/api/email/*` | → | `notification-service` `/api/email/*` | ✅ OK |
| ALL | `/api/institutional-emails/*` | → | `notification-service` `/api/institutional-emails/*` | ✅ OK |

### Dashboard Service
| Método | Gateway Path | → | Servicio Target | Estado |
|--------|--------------|---|-----------------|--------|
| ALL | `/api/dashboard/*` | → | `dashboard-service` `/api/dashboard/*` | ⚠️ INACCESIBLE |
| ALL | `/api/analytics/*` | → | `dashboard-service` `/api/analytics/*` | ⚠️ INACCESIBLE |

### Guardian Service
| Método | Gateway Path | → | Servicio Target | Estado |
|--------|--------------|---|-----------------|--------|
| ALL | `/api/guardians/*` | → | `guardian-service` `/api/guardians/*` | ⚠️ INACCESIBLE |

---

## ❌ 3. INCONSISTENCIAS ENCONTRADAS

### 3.1 CRÍTICO: Servicios No Accesibles en Railway

**Problema**: `dashboard-service` y `guardian-service` escuchan en `localhost` en lugar de `0.0.0.0`

**Archivos afectados**:
- `guardian-service/src/server.js` línea 17
- `dashboard-service/src/server.js` línea 17

**Impacto**: Railway no puede acceder a estos servicios vía private networking, causando:
- Timeout 504 en todas las requests a `/api/dashboard/*` y `/api/guardians/*`
- Gateway no puede hacer proxy a estos servicios

**Evidencia**:
```javascript
// guardian-service/src/server.js:17
server = app.listen(PORT, () => {  // ❌ Sin especificar host, usa localhost
  logger.info(`Guardian Service running on port ${PORT}`);
});

// dashboard-service/src/server.js:17
server = app.listen(PORT, () => {  // ❌ Sin especificar host, usa localhost
  logger.info(`Dashboard Service running on port ${PORT}`);
});
```

---

### 3.2 Gateway: autoRewrite Puede Causar Redirect Loops

**Problema**: `autoRewrite: true` en `makeProxy` puede causar redirects infinitos si el servicio backend redirige

**Archivo**: `gateway-service/src/server.js` línea 346

**Evidencia**:
```javascript
return createProxyMiddleware({
  // ...
  autoRewrite: true, // ⚠️ Puede causar redirect loops en Railway
  // ...
});
```

**Nota**: Según reportes previos, esto causó `ERR_TOO_MANY_REDIRECTS` en producción.

---

### 3.3 Body Parsing: Configuración Correcta

**Estado**: ✅ **CORRECTO**

El gateway parsea bodies DESPUÉS de las rutas proxy (línea 452), lo cual es correcto para evitar romper el streaming:
```javascript
// Línea 66-68: Comentario correcto
// IMPORTANT: DO NOT parse request bodies before proxy routes!

// Línea 452: Body parsing DESPUÉS de proxy routes
app.use(express.json({ limit: '2mb' }));  // ✅ Solo para rutas del gateway
```

---

## 🚨 4. CAUSAS PROBABLES DE CRASH / TIMEOUT

### 4.1 CRÍTICO: Servicios Inaccesibles (Causa de 504)

**Problema**: `dashboard-service` y `guardian-service` escuchan en `localhost`

**Síntomas en Railway**:
- Gateway devuelve 504 Gateway Timeout para `/api/dashboard/*` y `/api/guardians/*`
- Logs del gateway muestran "connection refused" o timeout
- Servicios responden localmente pero no desde el gateway

**Solución**: Cambiar `app.listen(PORT)` a `app.listen(PORT, '0.0.0.0')`

---

### 4.2 REDIRECT LOOPS: autoRewrite en Gateway

**Problema**: `autoRewrite: true` puede causar loops infinitos si:
- El servicio backend redirige HTTP → HTTPS
- Railway hace auto-redirect
- El gateway intenta reescribir la URL

**Síntomas**:
- Error `ERR_TOO_MANY_REDIRECTS` en frontend
- Gateway devuelve 301/302 infinitos

**Solución**: Cambiar a `autoRewrite: false` (ya documentado pero no aplicado en código actual)

---

### 4.3 Timeout en POST: Verificar proxyTimeout

**Estado**: ✅ **RAZONABLE**

El gateway tiene `proxyTimeout: 15000` (15 segundos). Si un servicio tarda más, el gateway devuelve timeout.

**Recomendación**: Para operaciones pesadas (upload de documentos, etc.), considerar aumentar el timeout o implementar procesamiento asíncrono.

---

### 4.4 Variables de Entorno Faltantes

**Riesgo**: Servicios pueden crashear al arrancar si faltan variables críticas:
- `DATABASE_URL`: Todos los servicios la requieren
- `JWT_SECRET`: Crítico para autenticación
- `PORT`: Railway lo inyecta automáticamente

**Recomendación**: Verificar que Railway tenga todas las variables configuradas.

---

## 🔧 5. PARCHES RECOMENDADOS

### PATCH 1: Fix guardian-service - Escuchar en 0.0.0.0

**Archivo**: `guardian-service/src/server.js`

**Línea**: 17

**Cambio**:
```javascript
// ANTES:
server = app.listen(PORT, () => {
  logger.info(`Guardian Service running on port ${PORT}`);
  // ...
});

// DESPUÉS:
server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Guardian Service running on port ${PORT}`);
  logger.info(`Listening on 0.0.0.0:${PORT} (accessible via private network)`);
  // ...
});
```

**Prioridad**: 🔴 CRÍTICA (bloquea todas las requests a guardian)

---

### PATCH 2: Fix dashboard-service - Escuchar en 0.0.0.0

**Archivo**: `dashboard-service/src/server.js`

**Línea**: 17

**Cambio**:
```javascript
// ANTES:
server = app.listen(PORT, () => {
  logger.info(`Dashboard Service running on port ${PORT}`);
  // ...
});

// DESPUÉS:
server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Dashboard Service running on port ${PORT}`);
  logger.info(`Listening on 0.0.0.0:得像PORT} (accessible via private network)`);
  // ...
});
```

**Prioridad**: 🔴 CRÍTICA (bloquea todas las requests a dashboard)

---

### PATCH 3: Deshabilitar autoRewrite en Gateway (Opcional pero Recomendado)

**Archivo**: `gateway-service/src/server.js`

**Línea**: 346

**Cambio**:
```javascript
// ANTES:
return createProxyMiddleware({
  // ...
  autoRewrite: true, // Rewrite the location host/port on redirects
  // ...
});

// DESPUÉS:
return createProxyMiddleware({
  // ...
  autoRewrite: false, // DISABLED: Was causing redirect loops on Railway (301 redirecting to same URL)
  // ...
});
```

**Prioridad**: 🟡 ALTA (previene redirect loops futuros)

**Nota**: Este cambio está comentado en un commit previo pero no aplicado en el código actual.

---

## 📋 CHECKLIST FINAL

### ✅ Arquitectura Mapeada
- [x] 7 servicios identificados
- [x] Puertos mapeados
- [x] Frameworks identificados (todos Express)
- [x] Base paths identificados

### ✅ Rutas del Gateway Extraídas
- [x] 11 rutas proxy configuradas
- [x] Todos los métodos HTTP soportados
- [x] Path rewriting configurado correctamente

### ❌ Inconsistencias Detectadas
- [x] 2 servicios no escuchan en `0.0.0.0` (CRÍTICO)
- [x] `autoRewrite: true` puede causar redirect loops (MEDIO)
- [x] Body parsing correcto (sin problemas)

### 🚨 Causas de Crash/Timeout Identificadas
- [x] Servicios inaccesibles vía private networking (CRÍTICO)
- [x] Posibles redirect loops (ALTO)
- [x] Timeouts razonables pero verificables (BAJO)

### 🔧 Parches Preparados
- [x] Patch para `guardian-service` (CRÍTICO)
- [x] Patch para `dashboard-service` (CRÍTICO)
- [x] Patch opcional para `gateway-service` (ALTO)

---

## 🎯 ORDEN DE APLICACIÓN DE FIXES

1. **INMEDIATO**: Aplicar PATCH 1 y PATCH 2 (fix `0.0.0.0`)
   - Esto desbloqueará `dashboard-service` y `guardian-service`
   - Commits separados por servicio

2. **SEGUNDO**: Aplicar PATCH 3 (fix `autoRewrite`)
   - Previene redirect loops futuros
   - Ya documentado, solo necesita aplicarse

3. **VERIFICACIÓN**: Después de aplicar fixes, verificar:
   - Gateway puede hacer proxy a todos los servicios
   - No hay redirect loops en Railway
   - Health checks de todos los servicios pasan

---

## 📝 NOTAS ADICIONALES

- El gateway está bien configurado en general (body parsing correcto, CORS correcto)
- Los otros 5 servicios (user, application, evaluation, notification, gateway) están correctamente configurados
- Solo `dashboard` y `guardian` requieren fixes críticos

---

**FIN DEL REPORTE**
