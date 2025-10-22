# Deployment Manual: User Service a Railway

## Estado Actual
- ✅ Código commiteado en GitHub (main branch)
- ✅ Dockerfile configurado
- ✅ railway.toml configurado
- ⚠️ Servicio no deployado o no respondiendo

## Deployment Manual via Railway Dashboard

### 1. Acceder a Railway Dashboard
```
https://railway.app/project/cba08df0-1eed-4d91-8ce4-397f9c80cdb3
```

### 2. Buscar o Crear Servicio "user-service" o "user_service"
- Si ya existe: verificar que esté activo
- Si no existe: crear nuevo servicio desde GitHub

### 3. Configurar Variables de Entorno

En Railway Dashboard > user-service > Variables, agregar:

```bash
NODE_ENV=production
PORT=8080
JWT_SECRET=mtn_secret_key_2025_admissions
JWT_EXPIRATION_TIME=86400000
CSRF_SECRET=your_production_csrf_secret_change_this
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### 4. Configurar el Servicio

#### Root Directory (si es necesario):
```
user-service
```

#### Build Command (Railway detecta automáticamente):
```
docker build -f Dockerfile .
```

#### Start Command (Railway detecta automáticamente):
```
node src/index.js
```

### 5. Verificar Nombre del Servicio en Private Network

**CRÍTICO**: El nombre del servicio en Railway DEBE ser: `user_service` (con underscore)

Porque el gateway está configurado así:
```javascript
USER_SERVICE_URL=http://user_service:8080
```

Para verificar/cambiar el nombre:
1. Ve a Settings > Service Name
2. Cambia a: `user_service`
3. Guarda y redeploy

### 6. Deploy

Opción A: Trigger manual desde Dashboard
- Ve a Deployments > Deploy

Opción B: Push a GitHub (auto-deploy)
```bash
git push origin main
```

### 7. Verificar Logs

En Railway Dashboard > user-service > Deployments > Ver Logs

Buscar:
- ✅ "Database pool created successfully"
- ✅ "Circuit breakers initialized"  
- ✅ "User Service running on port 8080"
- ❌ Cualquier error de conexión a DB

### 8. Test del Servicio

Desde el gateway:
```bash
curl https://gateway-service-production-a753.up.railway.app/api/auth/csrf-token
```

Debería responder con:
```json
{
  "success": true,
  "csrfToken": "...",
  "expiresIn": 3600
}
```

---

## Troubleshooting

### Error: "Cannot connect to database"
- Verificar que DATABASE_URL esté configurada
- Verificar que PostgreSQL service esté corriendo en mismo proyecto

### Error: "Service not found in private network"
- Verificar nombre del servicio: debe ser `user_service`
- Verificar que Private Networking esté habilitado en el proyecto

### Error: "Port already in use"  
- Railway asigna PORT automáticamente (siempre 8080)
- No configurar PORT manualmente, dejar que Railway lo asigne

### Servicio se reinicia constantemente
- Ver logs para identificar el error
- Verificar que todas las variables de entorno estén configuradas
- Verificar que CSRF_SECRET esté configurado

---

## Checklist de Variables de Entorno

- [ ] NODE_ENV=production
- [ ] PORT=8080 (o dejar que Railway lo asigne)
- [ ] JWT_SECRET (mismo valor que gateway)
- [ ] JWT_EXPIRATION_TIME=86400000
- [ ] CSRF_SECRET (mismo valor en todos los servicios)
- [ ] DATABASE_URL (referencia a PostgreSQL Railway)

