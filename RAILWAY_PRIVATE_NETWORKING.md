# Railway Private Networking Configuration Guide

## Overview

Este documento explica cómo configurar Railway private networking para permitir comunicación interna entre microservicios sin usar URLs públicas.

## ¿Por qué Private Networking?

- **Costo**: La red privada NO tiene costo de egress ($0.10/GB en red pública)
- **Seguridad**: Los servicios backend no quedan expuestos públicamente
- **Performance**: Comunicación directa IPv6 sin pasar por edge servers
- **Simplicidad**: No requiere configuración de firewall o IP whitelisting

## Requisitos Técnicos Implementados ✅

### 1. Todos los servicios escuchan en IPv6 (::)

Los siguientes archivos han sido actualizados para escuchar en `::` en lugar de `0.0.0.0`:

- ✅ `gateway-service/src/server.js` - Línea 493
- ✅ `user-service/src/index.js` - Línea 131
- ✅ `application-service/src/server.js` - Línea 29
- ✅ `evaluation-service/src/server.js` - Línea 18
- ✅ `notification-service/src/server.js` - Línea 23

**Código implementado:**
```javascript
server.listen(PORT, '::', () => {
  console.log(`Service running on port ${PORT}`);
  console.log(`Listening on :: (IPv4/IPv6) - Railway private networking enabled`);
});
```

### 2. Gateway configurado para proxy HTTP interno

El gateway usa `http-proxy-middleware` que soporta URLs internas cuando están configuradas correctamente.

## Configuración de Variables de Entorno en Railway

### Paso 1: Identificar los nombres de servicio

En Railway dashboard, verifica el nombre exacto de cada servicio. Los nombres pueden tener guiones o guiones bajos. Ejemplos:
- `notification-service` (con guión)
- `notification_service` (con guión bajo)

**IMPORTANTE**: El nombre debe ser EXACTO, case-sensitive.

### Paso 2: Configurar Gateway Service

Ve a `gateway-service` → Variables → Add las siguientes variables:

```bash
# Formato: http://SERVICE-NAME.railway.internal:PORT
# Nota: Usar http:// NO https://

USER_SERVICE_URL=http://user-service.railway.internal:8080
APPLICATION_SERVICE_URL=http://application-service.railway.internal:8080
EVALUATION_SERVICE_URL=http://evaluation-service.railway.internal:8080
NOTIFICATION_SERVICE_URL=http://notification-service.railway.internal:8080
DASHBOARD_SERVICE_URL=http://dashboard-service.railway.internal:8080
GUARDIAN_SERVICE_URL=http://guardian-service.railway.internal:8080
```

**Alternativa con variables de Railway (recomendado):**

```bash
# Usando RAILWAY_PRIVATE_DOMAIN de cada servicio
USER_SERVICE_URL=http://${{user-service.RAILWAY_PRIVATE_DOMAIN}}:8080
APPLICATION_SERVICE_URL=http://${{application-service.RAILWAY_PRIVATE_DOMAIN}}:8080
EVALUATION_SERVICE_URL=http://${{evaluation-service.RAILWAY_PRIVATE_DOMAIN}}:8080
NOTIFICATION_SERVICE_URL=http://${{notification-service.RAILWAY_PRIVATE_DOMAIN}}:8080
DASHBOARD_SERVICE_URL=http://${{dashboard-service.RAILWAY_PRIVATE_DOMAIN}}:8080
GUARDIAN_SERVICE_URL=http://${{guardian-service.RAILWAY_PRIVATE_DOMAIN}}:8080
```

### Paso 3: Verificar PORT variable

Railway inyecta automáticamente `PORT=8080` para todos los servicios. NO configures esta variable manualmente.

### Paso 4: Verificar que Private Networking está habilitado

Railway habilita private networking por defecto en todos los proyectos. Para verificar:

1. Ve a Project Settings
2. Busca "Private Networking" - debe estar ON
3. Cada servicio debe tener una variable `RAILWAY_PRIVATE_DOMAIN` automática

## Testing de Conectividad

### Test 1: Verificar que servicios escuchan en IPv6

Después del deploy, revisa los logs de cada servicio. Debes ver:

```
✅ Service running on port 8080
✅ Listening on :: (IPv4/IPv6) - Railway private networking enabled
```

### Test 2: Probar endpoint directo del notification-service

```bash
# Debe funcionar (URL pública)
curl -X POST https://notification-service-production-3411.up.railway.app/api/institutional-emails/document-review/1 \
  -H "Content-Type: application/json" \
  --data '{"approvedDocuments":["Test.pdf"],"rejectedDocuments":[],"allApproved":true}'
```

### Test 3: Probar a través del gateway

```bash
# Debe funcionar SIN redirect 301
curl -v -X POST https://gateway-service-production-a753.up.railway.app/api/institutional-emails/document-review/1 \
  -H "Content-Type: application/json" \
  --data '{"approvedDocuments":["Test.pdf"],"rejectedDocuments":[],"allApproved":true}'

# Buscar en la respuesta:
# HTTP/2 200 OK (NO 301 Moved Permanently)
```

## Troubleshooting

### Problema: "Connection refused" o timeout

**Causa**: Servicio no está escuchando en IPv6

**Solución**:
1. Verificar logs del servicio - debe mostrar "Listening on ::"
2. Verificar que el código tenga `server.listen(PORT, '::', ...)`
3. Redeploy del servicio

### Problema: "Name or service not known"

**Causa**: Nombre de servicio incorrecto en URL

**Solución**:
1. Ve a Railway dashboard
2. Copia el nombre EXACTO del servicio
3. Actualiza variable de entorno: `http://NOMBRE-EXACTO.railway.internal:8080`
4. Guarda y redeploy del gateway

### Problema: Gateway sigue retornando 301 redirect

**Causas posibles**:
1. Variable de entorno sigue usando URL pública (https://)
2. Gateway no se ha redeployado después de cambiar variables
3. Private networking no está habilitado en el proyecto

**Solución**:
1. Verificar variables de entorno del gateway - deben ser `http://...railway.internal:8080`
2. En Railway dashboard, click "Redeploy" en gateway-service
3. Verificar Project Settings → Private Networking = ON

### Problema: "ERR_INVALID_HTTP_TOKEN"

**Causa**: Usando `https://` en lugar de `http://` para URL interna

**Solución**: Cambiar todas las URLs internas a `http://` (sin 's')

## Rollback Plan

Si private networking no funciona, puedes volver a usar URLs públicas:

```bash
# En gateway-service variables:
NOTIFICATION_SERVICE_URL=https://notification-service-production-3411.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production-xxxx.up.railway.app
# ... etc
```

**Nota**: Con URLs públicas habrá costo de egress y posiblemente redirects 301.

## Checklist de Implementación

- [x] Código actualizado - todos los servicios escuchan en `::`
- [x] Commit y push a GitHub
- [ ] Variables de entorno configuradas en Railway gateway-service
- [ ] Gateway redeployado después de cambiar variables
- [ ] Test de conectividad pasó (sin 301 redirect)
- [ ] Endpoint de institutional-emails funcional desde frontend

## Referencias

- [Railway Private Networking Docs](https://docs.railway.com/guides/private-networking)
- [http-proxy-middleware Docs](https://github.com/chimurai/http-proxy-middleware)

## Contacto y Soporte

Si tienes problemas después de seguir esta guía:

1. Revisa los logs de Railway para cada servicio
2. Verifica que las variables de entorno estén correctamente configuradas
3. Asegúrate de que todos los servicios se han redeployado después de los cambios de código
