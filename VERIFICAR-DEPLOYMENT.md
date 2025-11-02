# Verificar Deployment en Railway

## ⏱️ Estado Actual

**Cambios pusheados**: ✅  
**Railway re-desplegando**: En progreso...

---

## 🔍 Verificación Necesaria

### Paso 1: Verificar Deployment en Railway

1. Railway Dashboard → `user-service`
2. Pestaña **"Deployments"**
3. Verificar que el commit más reciente sea **`331353f`** (o más reciente)
4. Verificar que el status sea **"Success"** (no "Building" o "Failed")

**Si está "Building"**: Esperar 2-3 minutos más

**Si está "Failed"**: Ver los logs para identificar el error

---

### Paso 2: Verificar Logs del User Service

Railway → `user-service` → **Logs**

Buscar:
```
✅ SimpleCache initialized (TTL: 10min, MaxSize: 2000)
```

Si aparece, el servicio está corriendo el código nuevo con CORS.

---

### Paso 3: Probar Endpoint Directo

Desde tu terminal:

```bash
curl -X OPTIONS https://user-service-production-ab59.up.railway.app/api/auth/csrf-token \
  -H "Origin: https://admision-mtn-front.vercel.app" \
  -v
```

**Debe mostrar**:
```
< access-control-allow-origin: https://admision-mtn-front.vercel.app
< access-control-allow-methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
< access-control-allow-credentials: true
```

**Si NO muestra estos headers**, Railway aún no desplegó el código nuevo.

---

## ⏰ Tiempo Esperado

Railway tarda **2-5 minutos** en re-desplegar después de un push a GitHub.

**Checklist**:
- [ ] Wait 2 minutes desde el push
- [ ] Verificar que deployment esté en "Success"
- [ ] Verificar logs muestren el código nuevo
- [ ] Probar login nuevamente

---

## 🚨 Si el Problema Persiste Después de 5 Minutos

**Posibles causas**:

1. **Railway no detectó el cambio**: Verificar que el commit esté en GitHub
2. **Build falló**: Ver logs de Railway
3. **CORS no se aplicó**: Verificar que el código esté correcto

**Verificar que el código esté correcto**:
```bash
# Ver git log en user-service
git log -1 --oneline user-service/

# Debería mostrar:
# 331353f fix: add CORS to user-service for Vercel frontend
```

---

## 💡 Solución Temporal

**Mientras esperamos el deployment de Railway**, podemos probar si el código funciona localmente:

```bash
# En terminal local
cd user-service
npm start

# Probar CORS
curl -X OPTIONS http://localhost:8082/api/auth/csrf-token \
  -H "Origin: https://admision-mtn-front.vercel.app" \
  -v
```

**Si funciona localmente**, el problema es solo el deployment de Railway.

