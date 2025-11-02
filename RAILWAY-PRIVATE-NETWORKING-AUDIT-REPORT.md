# RAILWAY PRIVATE NETWORKING AUDIT REPORT
## Sistema de Admisiones MTN - Infraestructura Railway

**Fecha de auditoría**: 2025-11-01
**Auditor**: Railway Infrastructure Specialist (Claude Code)
**Estado general**: ⚠ WARNINGS (19 checks pasados, 0 fallidos, 5 advertencias)

---

## RESUMEN EJECUTIVO

La auditoría completa de Railway Private Networking para el sistema MTN revela que **la configuración base es sólida y correcta**, pero hay advertencias menores relacionadas con servicios no desplegados (dashboard-service y guardian-service).

### Estado General: ⚠ WARNINGS

```
✓ Verificaciones pasadas: 19/19 (100%)
✗ Verificaciones fallidas: 0
⚠ Advertencias: 5
```

**Conclusión**: El sistema está **listo para Railway Private Networking** con configuración local correcta. Las advertencias se refieren a servicios no desplegados y verificaciones manuales que deben realizarse en Railway Dashboard.

---

## HALLAZGOS DETALLADOS

### 1. RAILWAY.TOML CONFIGURATION ✓ COMPLETO

**Estado**: ✅ **CORRECTO**

#### Gateway Service
- ✅ `railway.toml` existe
- ✅ Tiene sección `[service]` con `internal_port = 8080`
- ✅ Configuración correcta para exponer puerto público

**Archivo**: `/gateway-service/railway.toml`
```toml
[build]
builder = "DOCKERFILE"

[service]
internal_port = 8080  # ✓ CORRECTO - Solo gateway debe exponerse
```

#### Backend Services
Todos los servicios backend tienen configuración correcta:

| Servicio | railway.toml | Sección [service] | Estado |
|----------|--------------|-------------------|--------|
| user-service | ✅ Existe | ✅ NO tiene | ✅ CORRECTO |
| application-service | ✅ Existe | ✅ NO tiene | ✅ CORRECTO |
| evaluation-service | ✅ Existe | ✅ NO tiene | ✅ CORRECTO |
| notification-service | ✅ Existe | ✅ NO tiene | ✅ CORRECTO |
| dashboard-service | ⚠ No encontrado | N/A | ⚠ No desplegado |
| guardian-service | ⚠ No encontrado | N/A | ⚠ No desplegado |

**Conclusión**: Backend services correctamente configurados para usar **SOLO Private Networking** (sin exposición pública directa).

---

### 2. PORT BINDING CONFIGURATION ✓ COMPLETO

**Estado**: ✅ **CORRECTO**

Todos los servicios escuchan en `0.0.0.0:PORT` (todas las interfaces), lo cual es **requisito crítico** para Railway Private Networking.

#### Verificación por servicio

```javascript
// ✅ PATRÓN CORRECTO EN TODOS LOS SERVICIOS:
server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Listening on 0.0.0.0:${PORT} (accessible via private network)`);
});
```

| Servicio | Binding | Puerto | Estado |
|----------|---------|--------|--------|
| gateway-service | `0.0.0.0` | `PORT` (8080 en Railway) | ✅ CORRECTO |
| user-service | `0.0.0.0` | `PORT` (8080 en Railway) | ✅ CORRECTO |
| application-service | `0.0.0.0` | `PORT` (8080 en Railway) | ✅ CORRECTO |
| evaluation-service | `0.0.0.0` | `PORT` (8080 en Railway) | ✅ CORRECTO |
| notification-service | `0.0.0.0` | `PORT` (8080 en Railway) | ✅ CORRECTO |
| guardian-service | `0.0.0.0` | `PORT` (8080 en Railway) | ✅ CORRECTO |

**Nota importante**: Railway inyecta automáticamente `PORT=8080` en todas las instancias. Los servicios NO deben definir esta variable manualmente.

**¿Por qué 0.0.0.0 y no 127.0.0.1?**
- `127.0.0.1`: Solo acepta conexiones locales (dentro del mismo contenedor) ❌
- `0.0.0.0`: Acepta conexiones desde cualquier interfaz de red (Private Networking + proxy de Railway) ✅

---

### 3. DATABASE CONFIGURATION ✓ COMPLETO

**Estado**: ✅ **CORRECTO**

Todos los servicios usan `DATABASE_URL` con prioridad correcta:
1. **PRIORITY 1**: `DATABASE_URL` (Railway production)
2. **PRIORITY 2**: Variables individuales (local development)

#### Patrón implementado

```javascript
// ✅ PATRÓN CORRECTO EN TODOS LOS SERVICIOS:
const dbPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false, // Railway internal network doesn't need SSL
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      query_timeout: 5000
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'Admisión_MTN_DB',
      user: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      // ... mismo pool configuration
    });
```

| Servicio | DATABASE_URL Prioridad | Fallback Variables | Estado |
|----------|------------------------|-------------------|--------|
| user-service | ✅ Sí | ✅ Sí | ✅ CORRECTO |
| application-service | ✅ Sí | ✅ Sí | ✅ CORRECTO |
| evaluation-service | ✅ Sí | ✅ Sí | ✅ CORRECTO |
| notification-service | ✅ Sí | ✅ Sí | ✅ CORRECTO |
| guardian-service | ✅ Sí | ✅ Sí | ✅ CORRECTO |

**Connection pooling**: Todos los servicios usan las mismas configuraciones de pool (max: 20, timeouts optimizados).

**SSL configuration**: Deshabilitado (`ssl: false`) para Railway internal networking (correcto, ya que Private Networking usa red interna segura).

---

### 4. GATEWAY SERVICE URL CONFIGURATION ✓ COMPLETO

**Estado**: ✅ **CORRECTO**

El gateway implementa un patrón robusto con validación de entorno y configuración dinámica.

#### Función getServiceUrl() (líneas 138-156)

```javascript
const getServiceUrl = (envVar, fallback) => {
  const val = process.env[envVar];
  const isProductionLike = process.env.NODE_ENV === 'production'
    || !!process.env.RAILWAY_STATIC_URL
    || !!process.env.RAILWAY_ENV;

  if (!val && isProductionLike) {
    logger.error(`La variable de entorno ${envVar} no está definida pero es requerida en producción.`);
    logger.error('Por favor configura las variables de entorno del Gateway en Railway.');
    process.exit(1);  // ✅ FAIL FAST - Evita usar localhost en producción
  }

  if (!val) {
    logger.warn(`La variable de entorno ${envVar} no está definida. Usando fallback para desarrollo: ${fallback}`);
    return fallback;
  }

  return val;
};
```

**Características**:
- ✅ Detecta entorno Railway automáticamente (`RAILWAY_STATIC_URL`, `RAILWAY_ENV`)
- ✅ **Fail-fast**: Termina proceso si falta variable en producción
- ✅ Fallback a localhost SOLO en desarrollo
- ✅ Logging detallado de configuración

#### Variables de entorno requeridas en Railway

```bash
# CRITICAL: Configurar estas 6 variables en Railway → gateway-service → Variables
USER_SERVICE_URL=http://user-service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080
```

**Verificación en Railway logs**: Al iniciar el gateway, debe mostrar:
```
Service URLs configured:
  USER_SERVICE: http://user-service:8080
  APPLICATION_SERVICE: http://application-service:8080
  EVALUATION_SERVICE: http://evaluation-service:8080
  NOTIFICATION_SERVICE: http://notification-service:8080
  DASHBOARD_SERVICE: http://dashboard-service:8080
  GUARDIAN_SERVICE: http://guardian-service:8080
```

---

## RECOMENDACIONES DE PRIVATE NETWORKING

### OPCIÓN 1: Usar nombre de servicio + puerto (RECOMENDADO)

```bash
USER_SERVICE_URL=http://user-service:8080
APPLICATION_SERVICE_URL=http://application-service:8080
EVALUATION_SERVICE_URL=http://evaluation-service:8080
NOTIFICATION_SERVICE_URL=http://notification-service:8080
DASHBOARD_SERVICE_URL=http://dashboard-service:8080
GUARDIAN_SERVICE_URL=http://guardian-service:8080
```

**Ventajas**:
- ✅ Simple y directo
- ✅ No requiere Railway-specific syntax
- ✅ Funciona con Railway DNS interno
- ✅ Nombres legibles y fáciles de debuggear

**Requisitos**:
- Nombres de servicios DEBEN coincidir EXACTAMENTE con los nombres en Railway Dashboard
- Case-sensitive: `user-service` ≠ `User-Service` ≠ `user_service`

### OPCIÓN 2: Usar variable RAILWAY_PRIVATE_DOMAIN

```bash
USER_SERVICE_URL=http://${{user-service.RAILWAY_PRIVATE_DOMAIN}}:8080
APPLICATION_SERVICE_URL=http://${{application-service.RAILWAY_PRIVATE_DOMAIN}}:8080
# ... etc
```

**Ventajas**:
- ✅ Railway sustituye automáticamente con el dominio interno correcto
- ✅ Resuelve problemas de nombres inconsistentes

**Desventajas**:
- Sintaxis específica de Railway (menos portable)

### OPCIÓN 3: Usar URLs públicas (FALLBACK)

```bash
USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production-xxx.up.railway.app
# ... etc
```

**Cuándo usar**:
- ⚠ Solo si Private Networking no funciona
- ⚠ Debugging temporal

**Desventajas**:
- ❌ Costos de egress ($0.10/GB)
- ❌ Mayor latencia (pasa por edge servers)
- ❌ Servicios backend quedan expuestos públicamente

---

## CONNECTION MAP

Mapa de conexiones Gateway → Backend Services (configuración esperada en Railway):

```
Gateway Service (gateway-service-production-a753.up.railway.app)
├─→ user-service:8080                [Private Network - NO público]
├─→ application-service:8080         [Private Network - NO público]
├─→ evaluation-service:8080          [Private Network - NO público]
├─→ notification-service:8080        [Private Network - NO público]
├─→ dashboard-service:8080           [Private Network - NO público]
└─→ guardian-service:8080            [Private Network - NO público]

Database (PostgreSQL)
└─→ Shared connection via DATABASE_URL (todos los servicios)
```

**Flujo de petición típico**:
```
Frontend (Vercel)
  ↓ HTTPS
Gateway (Railway - Público)
  ↓ HTTP Private Network
Backend Service (Railway - Privado)
  ↓ PostgreSQL connection pool
Database (Railway - Privado)
```

---

## PRIVATE NETWORKING CHECKLIST (MANUAL)

Estas verificaciones DEBEN realizarse en Railway Dashboard:

### Nivel de Proyecto

- [ ] **1. Private Networking habilitado**
  - Railway Dashboard → Project Settings → Networking
  - Verificar que "Private Networking" está **ENABLED**

- [ ] **2. Todos los servicios en el MISMO proyecto**
  - Verificar que los 7 servicios están en el mismo proyecto Railway
  - Si están en proyectos diferentes, Private Networking NO funcionará

### Nombres de Servicios

- [ ] **3. Verificar nombres exactos** (case-sensitive)
  - Railway Dashboard → Click en cada servicio → Settings
  - Copiar el nombre EXACTO (ejemplo: `user-service`, `application-service`)
  - Verificar que no haya guiones bajos vs guiones (`user_service` vs `user-service`)

**Nombres esperados**:
```
gateway-service         (o gateway_service)
user-service            (o user_service)
application-service     (o application_service)
evaluation-service      (o evaluation_service)
notification-service    (o notification_service)
dashboard-service       (o dashboard_service)
guardian-service        (o guardian_service)
```

### Variables de Entorno (Gateway)

- [ ] **4. Configurar URLs de servicios backend**
  - Railway Dashboard → gateway-service → Variables → Add Variable
  - Agregar las 6 variables:
    ```
    USER_SERVICE_URL=http://user-service:8080
    APPLICATION_SERVICE_URL=http://application-service:8080
    EVALUATION_SERVICE_URL=http://evaluation-service:8080
    NOTIFICATION_SERVICE_URL=http://notification-service:8080
    DASHBOARD_SERVICE_URL=http://dashboard-service:8080
    GUARDIAN_SERVICE_URL=http://guardian-service:8080
    ```

- [ ] **5. Verificar formato de URLs**
  - Todas DEBEN usar `http://` (NO `https://`)
  - Todas DEBEN terminar en `:8080`
  - Nombres DEBEN coincidir con nombres de servicios en Railway

### Exposición Pública

- [ ] **6. Gateway tiene dominio público generado**
  - Railway Dashboard → gateway-service → Settings → Networking
  - Debe tener un dominio público generado (ejemplo: `gateway-service-production-a753.up.railway.app`)

- [ ] **7. Backend services NO tienen dominio público**
  - Railway Dashboard → Cada backend service → Settings → Networking
  - **NO deben tener** "Generate Domain" (deben quedar solo en private network)
  - Si tienen dominio público, eliminarlo (opcional, pero recomendado para seguridad)

### Variables Compartidas

- [ ] **8. DATABASE_URL configurada**
  - Railway Dashboard → PostgreSQL plugin → Connect
  - Copiar variable `DATABASE_URL`
  - Debe estar automáticamente disponible en todos los servicios del proyecto

- [ ] **9. JWT_SECRET idéntico en todos los servicios**
  - Railway Dashboard → Cada servicio → Variables
  - Agregar: `JWT_SECRET=mtn_secret_key_2025_admissions`
  - CRITICAL: Debe ser **exactamente el mismo** en todos los servicios

- [ ] **10. CSRF_SECRET idéntico en servicios que usan CSRF**
  - Servicios que requieren CSRF: user-service, application-service, evaluation-service, guardian-service
  - Railway Dashboard → Cada servicio → Variables
  - Agregar: `CSRF_SECRET=<generar_con_crypto>`
  - CRITICAL: Debe ser **exactamente el mismo** en los 4 servicios

**Generar CSRF_SECRET seguro**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## TESTS DE CONECTIVIDAD

### Test 1: Health check del Gateway

```bash
curl https://gateway-service-production-a753.up.railway.app/health
```

**Respuesta esperada**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "api-gateway",
    "timestamp": "2025-11-01T21:38:59.123Z",
    "uptime": 123.456
  }
}
```

### Test 2: Health checks de backend services (vía gateway)

```bash
# User Service
curl https://gateway-service-production-a753.up.railway.app/api/users/health

# Application Service
curl https://gateway-service-production-a753.up.railway.app/api/applications/health

# Evaluation Service
curl https://gateway-service-production-a753.up.railway.app/api/evaluations/health

# Notification Service
curl https://gateway-service-production-a753.up.railway.app/api/notifications/health

# Guardian Service
curl https://gateway-service-production-a753.up.railway.app/api/guardians/health
```

**Respuesta esperada** (cada servicio):
```json
{
  "success": true,
  "status": "healthy",
  "service": "<service-name>",
  "timestamp": "..."
}
```

**Si falla con 502 Bad Gateway**:
- ❌ Private Networking no está funcionando
- ❌ Service URL incorrecta en variables del gateway
- ❌ Backend service no está desplegado o crasheó

### Test 3: Verificar logs del Gateway en Railway

Railway Dashboard → gateway-service → Logs (Deploy Logs)

Buscar en los logs de inicio:
```
Service URLs configured:
  USER_SERVICE: http://user-service:8080
  APPLICATION_SERVICE: http://application-service:8080
  EVALUATION_SERVICE: http://evaluation-service:8080
  NOTIFICATION_SERVICE: http://notification-service:8080
  DASHBOARD_SERVICE: http://dashboard-service:8080
  GUARDIAN_SERVICE: http://guardian-service:8080
```

**Problemas comunes**:

❌ **URLs todavía apuntan a localhost**:
```
USER_SERVICE: http://localhost:8082
```
→ Variables de entorno NO configuradas en Railway

❌ **URLs usan HTTPS**:
```
USER_SERVICE: https://user-service-production-xxx.up.railway.app
```
→ No está usando Private Networking, está usando URLs públicas

❌ **Gateway no inicia**:
```
ERROR: La variable de entorno USER_SERVICE_URL no está definida pero es requerida en producción.
```
→ Configurar variables de entorno en Railway

### Test 4: Verificar Private Networking está habilitado

Railway Dashboard → Project Settings → Buscar "Networking" o "Private Networking"

Debe mostrar:
```
Private Networking: ✓ Enabled
```

Si no está habilitado:
- Click en "Enable Private Networking"
- Railway re-desplegará todos los servicios (esperar 5-10 minutos)

---

## TROUBLESHOOTING

### Problema 1: "504 Gateway Timeout"

**Síntoma**: Gateway retorna 504 cuando intenta conectar a backend services.

**Causas posibles**:
1. Private Networking no habilitado en el proyecto
2. Nombres de servicios no coinciden
3. Backend service crasheó o no está desplegado
4. Timeout insuficiente en gateway

**Solución**:
```bash
# Paso 1: Verificar Private Networking habilitado
Railway Dashboard → Project Settings → Private Networking = ENABLED

# Paso 2: Verificar nombres exactos de servicios
Railway Dashboard → Click en cada servicio → Settings → Copiar nombre exacto

# Paso 3: Verificar backend service está UP
Railway Dashboard → <service> → Deployments → Latest deployment = SUCCESS

# Paso 4: Verificar logs del backend service
Railway Dashboard → <service> → Logs
Buscar: "Listening on 0.0.0.0:8080 (accessible via private network)"

# Paso 5: Si todo falla, aumentar timeout del gateway temporalmente
gateway-service/src/server.js:
proxyTimeout: 30000, // Aumentar de 15s a 30s
```

### Problema 2: "Connection refused"

**Síntoma**: Gateway muestra error "ECONNREFUSED" al intentar conectar.

**Causas posibles**:
1. Backend service no está escuchando en 0.0.0.0
2. Backend service crasheó en startup
3. Puerto incorrecto

**Solución**:
```bash
# Verificar logs del backend service
Railway Dashboard → <service> → Logs

# Buscar línea de startup:
✅ CORRECTO: "Listening on 0.0.0.0:8080 (accessible via private network)"
❌ INCORRECTO: "Listening on port 8080" (sin 0.0.0.0)

# Si falta 0.0.0.0, verificar código del servicio:
server = app.listen(PORT, '0.0.0.0', () => { ... });
```

### Problema 3: "Name or service not known"

**Síntoma**: DNS no puede resolver el nombre del servicio.

**Causas posibles**:
1. Nombre de servicio incorrecto en URL
2. Servicios en proyectos diferentes
3. Private Networking no habilitado

**Solución**:
```bash
# Paso 1: Verificar nombre EXACTO del servicio
Railway Dashboard → <service> → Settings → Service Name

# Paso 2: Actualizar variable de entorno en gateway
Debe coincidir EXACTAMENTE (case-sensitive):
USER_SERVICE_URL=http://user-service:8080  # Si Railway tiene "user-service"
USER_SERVICE_URL=http://user_service:8080  # Si Railway tiene "user_service"

# Paso 3: Verificar todos los servicios están en el MISMO proyecto
Railway Dashboard → Projects → Ver que todos los 7 servicios están listados
```

### Problema 4: "ERR_INVALID_HTTP_TOKEN"

**Síntoma**: Error de token HTTP inválido en logs.

**Causa**: Usando `https://` para URLs internas (debe ser `http://`).

**Solución**:
```bash
# Cambiar variables de entorno en Railway
❌ INCORRECTO: USER_SERVICE_URL=https://user-service:8080
✅ CORRECTO:   USER_SERVICE_URL=http://user-service:8080
```

### Problema 5: Gateway sigue retornando 301 redirect

**Síntoma**: Requests retornan 301 Moved Permanently.

**Causas posibles**:
1. URLs siguen usando formato público HTTPS
2. autoRewrite habilitado en proxy (ya está deshabilitado)

**Solución**:
```bash
# Verificar variables de entorno del gateway
Railway Dashboard → gateway-service → Variables

# Todas DEBEN ser:
http://service-name:8080

# NO:
https://service-production.up.railway.app
```

---

## VERIFICACIÓN FINAL

Después de configurar todo, ejecutar esta secuencia de verificación:

```bash
# 1. Health check del gateway
curl https://gateway-service-production-a753.up.railway.app/health
# Esperado: 200 OK

# 2. Health check de un backend service (vía gateway)
curl https://gateway-service-production-a753.up.railway.app/api/users/health
# Esperado: 200 OK (NO 502, NO 504, NO 301)

# 3. Test de endpoint protegido (con JWT)
curl -H "Authorization: Bearer <TOKEN>" \
  https://gateway-service-production-a753.up.railway.app/api/users
# Esperado: 200 OK con lista de usuarios

# 4. Test de endpoint POST (con CSRF)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "x-csrf-token: <CSRF_TOKEN>" \
  -d '{"test": "data"}' \
  https://gateway-service-production-a753.up.railway.app/api/applications
# Esperado: 200 OK (o 400/422 de validación, pero NO 502/504/301)
```

---

## PLAN DE ACCIÓN

### Fase 1: Preparación (15 minutos)

1. **Verificar servicios desplegados en Railway**
   - Acceder a Railway Dashboard
   - Confirmar que user-service, application-service, evaluation-service, notification-service, gateway-service están desplegados
   - Opcional: Desplegar dashboard-service y guardian-service si es necesario

2. **Habilitar Private Networking**
   - Railway Dashboard → Project Settings → Networking
   - Activar "Private Networking" si no está habilitado
   - Esperar 5-10 minutos si Railway redespliega servicios

3. **Verificar nombres de servicios**
   - Railway Dashboard → Click en cada servicio → Settings
   - Copiar nombres exactos (ej: `user-service` o `user_service`)
   - Documentar en una lista para referencia

### Fase 2: Configuración de Variables (10 minutos)

4. **Configurar URLs en gateway-service**
   - Railway Dashboard → gateway-service → Variables
   - Agregar las 6 variables `*_SERVICE_URL`
   - Usar formato: `http://service-name:8080`
   - Guardar (Railway auto-redesplegará)

5. **Configurar secrets compartidos**
   - Railway Dashboard → Cada servicio → Variables
   - Agregar `JWT_SECRET` (mismo valor en todos)
   - Agregar `CSRF_SECRET` (mismo valor en user, application, evaluation, guardian)
   - Generar secrets seguros con `crypto.randomBytes(32)`

### Fase 3: Verificación (15 minutos)

6. **Verificar logs del gateway**
   - Railway Dashboard → gateway-service → Logs
   - Buscar "Service URLs configured:"
   - Confirmar que todas las URLs usan `http://service-name:8080`

7. **Ejecutar tests de conectividad**
   - Test 1: Health check del gateway
   - Test 2: Health checks de backend services (vía gateway)
   - Test 3: Endpoint protegido con JWT
   - Test 4: Endpoint POST con CSRF

8. **Monitorear logs de errores**
   - Railway Dashboard → Cada servicio → Logs
   - Buscar errores de conexión, timeouts, DNS failures
   - Corregir según sección de Troubleshooting

### Fase 4: Testing de Integración (20 minutos)

9. **Test desde frontend (Vercel)**
   - Acceder a la aplicación frontend en Vercel
   - Login con usuario de prueba
   - Crear una aplicación
   - Subir documento
   - Verificar que no hay errores CORS, 502, 504

10. **Verificar métricas en Railway**
    - Railway Dashboard → Metrics
    - CPU, Memory, Network usage
    - Verificar que no hay picos anormales o crashes

---

## ROLLBACK PLAN

Si Private Networking no funciona después de seguir todos los pasos:

### Opción A: Volver a URLs públicas (Inmediato)

```bash
# En Railway → gateway-service → Variables
USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production-xxx.up.railway.app
EVALUATION_SERVICE_URL=https://evaluation-service-production-xxx.up.railway.app
NOTIFICATION_SERVICE_URL=https://notification-service-production-xxx.up.railway.app
DASHBOARD_SERVICE_URL=https://dashboard-service-production-xxx.up.railway.app
GUARDIAN_SERVICE_URL=https://guardian-service-production-xxx.up.railway.app
```

**Ventaja**: Funciona inmediatamente
**Desventaja**: Costos de egress, mayor latencia

### Opción B: Investigar con Railway Support

1. Crear ticket en Railway Support
2. Proporcionar:
   - Project ID
   - Service names
   - Logs del gateway mostrando errores de conexión
   - Configuración de variables de entorno
   - Confirmación de que Private Networking está habilitado

---

## REFERENCIAS

- [Railway Private Networking Docs](https://docs.railway.com/guides/private-networking)
- [http-proxy-middleware Docs](https://github.com/chimurai/http-proxy-middleware)
- [Railway Environment Variables](https://docs.railway.com/develop/variables)
- [PostgreSQL Connection Pooling Best Practices](https://node-postgres.com/features/pooling)

---

## CONTACTO Y SOPORTE

**Script de auditoría**: `/railway-private-networking-audit.sh`

Para ejecutar nuevamente:
```bash
cd /Users/jorgegangale/Desktop/MIcroservicios
./railway-private-networking-audit.sh
```

**Documentación relacionada**:
- `RAILWAY_PRIVATE_NETWORKING.md` - Guía de implementación
- `RAILWAY-504-ROOT-CAUSE-ANALYSIS.md` - Análisis de causas raíz de errores 504
- `RAILWAY-ENV-VARS-FIX-URFORGENT.md` - Corrección urgente de variables de entorno

---

**Fin del reporte**
**Próxima acción recomendada**: Ejecutar Fase 1 del Plan de Acción (Preparación)
