# Plan de Rollback - Migración a Private Networking

**Fecha**: 2025-01-21
**Proyecto**: Admision_MTN_Backend
**Objetivo**: Habilitar Private Networking con IPv6
**Responsable**: Claude Code

---

## 📋 Estado Actual (ANTES de los cambios)

### Variables de Entorno del Gateway (ACTUALES - FUNCIONANDO)

```bash
USER_SERVICE_URL=https://user-service-production-ab59.up.railway.app
APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
EVALUATION_SERVICE_URL=https://evaluation-service-production.up.railway.app
NOTIFICATION_SERVICE_URL=https://notification-service-production-3411.up.railway.app
DASHBOARD_SERVICE_URL=https://dashboard-service-production-4fe9.up.railway.app
GUARDIAN_SERVICE_URL=https://guardian-service-production.up.railway.app
```

### Configuración Actual de server.js

**Ubicaciones de archivos críticos:**
- `/Users/jorgegangale/Desktop/MIcroservicios/gateway-service/src/server.js`
- `/Users/jorgegangale/Desktop/MIcroservicios/user-service/src/server.js`
- `/Users/jorgegangale/Desktop/MIcroservicios/application-service/src/server.js`
- `/Users/jorgegangale/Desktop/MIcroservicios/evaluation-service/src/server.js`
- `/Users/jorgegangale/Desktop/MIcroservicios/notification-service/src/server.js`
- `/Users/jorgegangale/Desktop/MIcroservicios/dashboard-service/src/server.js`
- `/Users/jorgegangale/Desktop/MIcroservicios/guardian-service/src/server.js`

**Configuración típica actual** (IPv4):
```javascript
const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 🎯 Cambios Planificados

### 1. Actualización de server.js (IPv6)

**Cambio**: Agregar `'::'` como segundo parámetro en `app.listen()`

```javascript
// ANTES (IPv4 - por defecto)
app.listen(PORT, () => {...});

// DESPUÉS (IPv6 - requerido para Private Networking)
app.listen(PORT, '::', () => {...});
```

### 2. Actualización de Variables de Entorno del Gateway

**Cambio**: Usar formato `.railway.internal` con puerto explícito

```bash
USER_SERVICE_URL=http://user-service.railway.internal:8080
APPLICATION_SERVICE_URL=http://application-service.railway.internal:8080
EVALUATION_SERVICE_URL=http://evaluation-service.railway.internal:8080
NOTIFICATION_SERVICE_URL=http://notification-service.railway.internal:8080
DASHBOARD_SERVICE_URL=http://dashboard-service.railway.internal:8080
GUARDIAN_SERVICE_URL=http://guardian-service.railway.internal:8080
```

---

## 🔄 Procedimiento de Rollback

### Opción A: Rollback de Variables de Entorno (MÁS RÁPIDO - 2 minutos)

Si los servicios están funcionando pero el gateway no puede conectarse:

```bash
cd /Users/jorgegangale/Desktop/MIcroservicios/gateway-service

# Restaurar URLs públicas (HTTPS)
railway variables --set USER_SERVICE_URL=https://user-service-production-ab59.up.railway.app
railway variables --set APPLICATION_SERVICE_URL=https://application-service-production.up.railway.app
railway variables --set EVALUATION_SERVICE_URL=https://evaluation-service-production.up.railway.app
railway variables --set NOTIFICATION_SERVICE_URL=https://notification-service-production-3411.up.railway.app
railway variables --set DASHBOARD_SERVICE_URL=https://dashboard-service-production-4fe9.up.railway.app
railway variables --set GUARDIAN_SERVICE_URL=https://guardian-service-production.up.railway.app

# Verificar cambios
railway variables | grep SERVICE_URL

# El gateway se redesplega automáticamente
# Esperar ~2 minutos y verificar: curl https://gateway-service-production-a753.up.railway.app/health
```

### Opción B: Rollback de Código (server.js) - Solo si Opción A no funciona

Si los servicios backend no están levantando:

```bash
# 1. Restaurar desde backups
cd /Users/jorgegangale/Desktop/MIcroservicios

# Para cada servicio:
cp gateway-service/src/server.js.backup gateway-service/src/server.js
cp user-service/src/server.js.backup user-service/src/server.js
cp application-service/src/server.js.backup application-service/src/server.js
cp evaluation-service/src/server.js.backup evaluation-service/src/server.js
cp notification-service/src/server.js.backup notification-service/src/server.js
cp dashboard-service/src/server.js.backup dashboard-service/src/server.js
cp guardian-service/src/server.js.backup guardian-service/src/server.js

# 2. Hacer commit y push
cd gateway-service
git add src/server.js
git commit -m "revert: Rollback IPv6 changes - restore IPv4 binding"
git push origin main

# Repetir para cada servicio (o usar script)

# 3. Verificar deployment en Railway (automático tras push)
# Railway logs: railway logs --service <service-name>
```

### Opción C: Rollback Completo (Variables + Código)

```bash
# 1. Restaurar variables (Opción A)
# 2. Restaurar código (Opción B)
# 3. Verificar que TODO vuelva al estado inicial
```

---

## 🚨 Comandos de Emergencia

### Verificar estado de servicios en Railway

```bash
# Gateway
curl -s https://gateway-service-production-a753.up.railway.app/health | jq

# User Service (público)
curl -s https://user-service-production-ab59.up.railway.app/health | jq

# Application Service
curl -s https://application-service-production.up.railway.app/health | jq
```

### Ver logs en tiempo real

```bash
# Gateway
railway logs --service gateway-service 2>&1 | tail -50

# User Service
cd /Users/jorgegangale/Desktop/MIcroservicios/user-service
railway logs --service user-service 2>&1 | tail -50

# Buscar errores
railway logs --service <service-name> 2>&1 | grep -i "error\|fail"
```

### Forzar redespliegue

```bash
cd /Users/jorgegangale/Desktop/MIcroservicios/<service-name>

# Opción 1: Trigger redeploy sin cambios
git commit --allow-empty -m "chore: Force redeploy"
git push origin main

# Opción 2: Usar Railway CLI
railway up --service <service-name>
```

---

## 📊 Puntos de Verificación Post-Rollback

### ✅ Checklist de Validación

Después del rollback, verificar:

- [ ] **Gateway responde**: `curl https://gateway-service-production-a753.up.railway.app/health`
- [ ] **User Service responde**: `curl https://gateway-service-production-a753.up.railway.app/api/users`
- [ ] **Application Service responde**: `curl https://gateway-service-production-a753.up.railway.app/api/applications`
- [ ] **Frontend funciona**: Abrir https://admision-mtn-frontend.vercel.app y hacer login
- [ ] **Logs sin errores**: `railway logs --service gateway-service | grep -i error` (debe estar vacío)
- [ ] **Base de datos conecta**: Verificar queries funcionan en frontend

### 📈 Tiempos Esperados

- **Rollback de variables**: ~2-3 minutos (redespliegue automático del gateway)
- **Rollback de código**: ~5-7 minutos por servicio (build + deploy)
- **Rollback completo**: ~15-20 minutos (todos los servicios)

---

## 🔐 Backups Creados

Los siguientes backups fueron creados ANTES de los cambios:

```bash
/Users/jorgegangale/Desktop/MIcroservicios/gateway-service/src/server.js.backup
/Users/jorgegangale/Desktop/MIcroservicios/user-service/src/server.js.backup
/Users/jorgegangale/Desktop/MIcroservicios/application-service/src/server.js.backup
/Users/jorgegangale/Desktop/MIcroservicios/evaluation-service/src/server.js.backup
/Users/jorgegangale/Desktop/MIcroservicios/notification-service/src/server.js.backup
/Users/jorgegangale/Desktop/MIcroservicios/dashboard-service/src/server.js.backup
/Users/jorgegangale/Desktop/MIcroservicios/guardian-service/src/server.js.backup
```

**Fecha de backup**: [Se completará automáticamente al crear los backups]

---

## 📞 Contactos de Soporte

- **Railway Support**: https://railway.app/help
- **Railway Discord**: https://discord.gg/railway
- **Documentación**: https://docs.railway.com/guides/private-networking

---

## 📝 Notas Importantes

1. **Las URLs públicas SIGUEN FUNCIONANDO** - Los servicios mantienen sus dominios públicos incluso con Private Networking habilitado
2. **Rollback NO afecta base de datos** - Ningún cambio en schema o datos
3. **Frontend NO requiere cambios** - Sigue apuntando al gateway público
4. **Git historial intacto** - Todos los cambios están versionados
5. **Zero downtime posible** - Rollback de variables no requiere rebuild

---

## ✅ Estado del Rollback Plan

- [x] Plan creado y documentado
- [ ] Backups de server.js completados
- [ ] Variables de entorno documentadas
- [ ] Comandos de emergencia verificados
- [ ] Plan revisado y aprobado por usuario

---

**Creado por**: Claude Code
**Última actualización**: 2025-01-21
**Versión**: 1.0
