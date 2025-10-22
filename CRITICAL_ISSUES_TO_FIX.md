# ⚠️ PROBLEMAS CRÍTICOS A RESOLVER EN PRODUCCIÓN

## 🔴 URGENTE: Gateway no hace proxy correctamente

### Problema
El gateway-service está haciendo **REDIRECT** en vez de **PROXY** a los microservicios, causando errores de CORS y pérdida de credenciales/headers.

**Síntomas:**
- Frontend recibe error: `redirected from gateway-service to notification-service`
- CORS error: `No 'Access-Control-Allow-Origin' header`
- 504 Gateway Timeout cuando intenta hacer proxy
- Los servicios backend no son accesibles a través del gateway

### Workaround temporal implementado
**Frontend modificado para llamar directamente a los microservicios** (bypasea el gateway):
- Archivo: `Admision_MTN_front/services/api.ts` líneas 42-47
- Rutas `/api/email/*` → Llaman directamente a `https://notification-service-production-3411.up.railway.app`
- Esto NO es escalable ni seguro para producción

### Solución requerida
**Arreglar el gateway para que haga PROXY en vez de REDIRECT:**

1. **Verificar configuración de http-proxy-middleware** en `gateway-service/src/server.js`
2. **Revisar las opciones del proxy:**
   ```javascript
   const makeProxy = (target, path = '', additionalOptions = {}) => {
     return createProxyMiddleware({
       target,
       changeOrigin: true,
       xfwd: true,
       followRedirects: false,  // ⚠️ IMPORTANTE: NO seguir redirects
       pathRewrite: {
         [`^${path}`]: path  // Mantener el path original
       },
       onProxyReq: (proxyReq, req, res) => {
         // Asegurar que los headers se mantengan
       },
       onError: (err, req, res) => {
         console.error('Proxy error:', err);
         res.status(502).json({ error: 'Bad Gateway' });
       }
     });
   };
   ```

3. **Verificar variables de entorno del gateway:**
   ```bash
   # Deben ser URLs públicas (temporalmente):
   NOTIFICATION_SERVICE_URL=https://notification-service-production-3411.up.railway.app
   USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app
   # etc...
   ```

4. **Probar que el proxy funciona:**
   ```bash
   curl -X POST https://gateway-service-production-a753.up.railway.app/api/email/send-verification \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","firstName":"Test"}'

   # Debería devolver respuesta del notification-service SIN redirect
   ```

### Estado actual
- ⚠️ **Temporal**: Frontend bypasea el gateway para endpoints de email
- ❌ **Permanente**: El gateway no funciona para hacer proxy
- 🎯 **Objetivo**: Restaurar arquitectura correcta con gateway funcionando

---

## 🟡 IMPORTANTE: Private Networking no funciona en Railway

### Problema
Los servicios **NO pueden comunicarse** usando Private Networking de Railway (URLs internas como `http://service-name:8080`).

**Síntomas:**
- Gateway devuelve 504 Gateway Timeout
- Error: `Error occurred while trying to proxy: gateway-service.../api/...`
- Servicios backend no son accesibles desde el gateway usando nombres internos

### Workaround temporal
**Usar URLs públicas** en vez de Private Networking:
```bash
# En vez de:
NOTIFICATION_SERVICE_URL=http://notification-service:8080

# Usar:
NOTIFICATION_SERVICE_URL=https://notification-service-production-3411.up.railway.app
```

### Solución requerida
**Investigar y habilitar Private Networking correctamente:**

1. **Verificar que todos los servicios están en el MISMO proyecto de Railway**
2. **Verificar nombres exactos de servicios:**
   - En Railway Dashboard, copiar el nombre EXACTO del servicio
   - Usar ese nombre en las URLs: `http://nombre-exacto:8080`
   - Railway es case-sensitive: `notification-service` ≠ `Notification-Service`

3. **Verificar que todos los servicios escuchan en 0.0.0.0:**
   ```javascript
   // CORRECTO:
   server.listen(PORT, '0.0.0.0', () => { ... });

   // INCORRECTO (no funciona en Railway):
   server.listen(PORT, 'localhost', () => { ... });
   ```

4. **Probar conectividad interna:**
   - Railway Shell → service A
   - `curl http://service-b:8080/health`
   - Debería responder sin errores

5. **Considerar alternativa:**
   - Si Private Networking no funciona, documentar el uso de URLs públicas
   - Implementar autenticación service-to-service (API keys internas)

### Estado actual
- ⚠️ **Temporal**: Usando URLs públicas para comunicación entre servicios
- ❌ **Ideal**: Private Networking no configurado/funcionando
- 🎯 **Objetivo**: Migrar a Private Networking para seguridad y performance

---

## 📝 PENDIENTE: Cleanup del frontend

### Problema
Frontend tiene código temporal que debe ser removido una vez se arregle el gateway.

### Archivos a modificar:
1. **`Admision_MTN_front/services/api.ts`** - Líneas 42-47
   - Remover el bypass directo a notification-service
   - Restaurar uso del gateway para todas las rutas

2. **Código a eliminar:**
   ```javascript
   // TEMPORARY: Use notification-service directly for email endpoints
   // This bypasses the gateway which is having redirect issues
   if (config.url && config.url.includes('/api/email/')) {
       runtimeBaseURL = 'https://notification-service-production-3411.up.railway.app';
       console.log('📧 Using direct notification-service URL for email endpoint');
   }
   ```

3. **Restaurar a:**
   ```javascript
   // Use gateway for all routes
   const runtimeBaseURL = getApiBaseUrl();
   ```

---

## 🎯 Plan de acción (Orden recomendado)

### Fase 1: Investigación (1-2 horas)
1. [ ] Investigar por qué http-proxy-middleware está haciendo redirect
2. [ ] Revisar logs del gateway cuando intenta hacer proxy
3. [ ] Verificar configuración de Private Networking en Railway
4. [ ] Probar conectividad manual entre servicios

### Fase 2: Corrección del Gateway (2-3 horas)
1. [ ] Modificar configuración de http-proxy-middleware
2. [ ] Ajustar opciones de proxy (followRedirects, pathRewrite, etc.)
3. [ ] Probar proxy desde gateway a cada microservicio
4. [ ] Verificar que headers y credentials se mantienen

### Fase 3: Private Networking (opcional, 1-2 horas)
1. [ ] Configurar nombres internos correctos en Railway
2. [ ] Actualizar variables de entorno con URLs internas
3. [ ] Probar conectividad entre servicios
4. [ ] Si falla, documentar y mantener URLs públicas con autenticación

### Fase 4: Cleanup del Frontend (30 minutos)
1. [ ] Remover código temporal de api.ts
2. [ ] Probar flujo completo end-to-end
3. [ ] Deploy a producción

---

## 📊 Impacto en producción

### Riesgos actuales (con workaround):
- 🟡 **Media**: Servicios expuestos públicamente sin gateway
- 🟡 **Media**: Arquitectura no sigue el diseño original
- 🟢 **Baja**: Sistema funciona correctamente para usuarios finales

### Beneficios de la corrección:
- ✅ Arquitectura limpia y mantenible
- ✅ Seguridad mejorada (servicios detrás del gateway)
- ✅ Control centralizado de CORS, rate limiting, auth
- ✅ Performance mejorada (Private Networking es más rápido)

---

## 🔍 Debugging útil

### Verificar que el gateway está redirigiendo:
```bash
curl -v -X POST https://gateway-service-production-a753.up.railway.app/api/email/send-test \
  -H "Content-Type: application/json" \
  -d '{"to":"test@test.com","subject":"Test"}'

# Buscar en output:
# < HTTP/2 302 (REDIRECT - MAL)
# < HTTP/2 200 (OK - BIEN)
# < Location: https://notification-service... (REDIRECT - MAL)
```

### Verificar Private Networking:
```bash
# Desde Railway Shell del gateway:
curl http://notification-service:8080/health
# Debería responder con status healthy

# Si falla:
ping notification-service
# Verificar que resuelve el DNS interno
```

### Logs del gateway:
```bash
railway logs -s gateway-service | grep -i "proxy\|error\|redirect"
```

---

## 📅 Fecha de registro
**2025-10-22 19:45 UTC**

## 👤 Responsable
Pendiente asignar

## 🏷️ Tags
`#critical` `#gateway` `#railway` `#private-networking` `#cors` `#architecture` `#technical-debt`
