# Railway Volume Setup para Application Service

Este servicio necesita almacenamiento persistente para guardar documentos subidos por los usuarios.

## Configuración del Volume en Railway

### 1. Crear el Volume

1. Ve al **Railway Dashboard** → Tu proyecto → `application-service`
2. Click en la pestaña **"Variables"**
3. En la sección **"Volumes"**, click en **"+ New Volume"**
4. Configura:
   - **Mount Path**: `/app/uploads`
   - **Name**: (se genera automáticamente, ej: `application_uploads`)

### 2. Configurar el Start Command

El Volume se monta con permisos de root (755), pero la aplicación corre con un usuario diferente. Necesitamos dar permisos de escritura antes de iniciar la app.

1. Ve a **Settings** → **Deploy** → **Start Command**
2. Configura el siguiente comando:

```bash
mkdir -p $RAILWAY_VOLUME_MOUNT_PATH && chmod -R 777 $RAILWAY_VOLUME_MOUNT_PATH && node src/server.js
```

**Explicación del comando:**
- `mkdir -p $RAILWAY_VOLUME_MOUNT_PATH`: Asegura que el directorio existe
- `chmod -R 777 $RAILWAY_VOLUME_MOUNT_PATH`: Da permisos completos de lectura/escritura
- `node src/server.js`: Inicia la aplicación

### 3. Variables de Entorno (Automáticas)

Railway configura automáticamente estas variables cuando montas un Volume:
- `RAILWAY_VOLUME_NAME`: Nombre del volume
- `RAILWAY_VOLUME_MOUNT_PATH`: Ruta donde se monta (ej: `/app/uploads`)

**No necesitas configurarlas manualmente.**

### 4. Redeploy

Después de configurar el Volume y el Start Command:
1. Click en **"Redeploy"** o espera el siguiente deploy automático
2. Verifica en los logs que aparezca:
   ```
   ✓ Created upload directory: /app/uploads with permissions 777
   ✓ Upload directory verified writable: /app/uploads
   ✓ Using upload directory: /app/uploads
   ```

## Verificación

Una vez desplegado, puedes verificar que funciona:

1. **Verifica los logs**:
   ```bash
   railway logs --service application-service | grep -i "upload directory"
   ```

2. **Verifica el endpoint de diagnóstico**:
   ```bash
   curl https://your-app.railway.app/api/applications/debug/system-info | jq '.uploadDirectory'
   ```

   Deberías ver:
   ```json
   {
     "exists": true,
     "isDirectory": true,
     "permissions": "777",
     "writeTest": {
       "canWrite": true
     }
   }
   ```

## Alternativas (Opcional)

Si prefieres almacenamiento externo en lugar de un Volume:

### AWS S3
- Más escalable
- No depende de Railway
- Requiere configurar credenciales AWS

### Cloudinary
- Específico para imágenes/documentos
- API simple
- Plan gratuito disponible

### Google Cloud Storage
- Similar a S3
- Integración con Google Cloud

## Troubleshooting

### Error: "EACCES: permission denied"
- **Causa**: El Volume no tiene permisos de escritura
- **Solución**: Verifica que el Start Command incluya `chmod -R 777 $RAILWAY_VOLUME_MOUNT_PATH`

### Error: "Upload directory not writable"
- **Causa**: El directorio no existe o no se puede escribir
- **Solución**: Verifica que el Volume esté correctamente montado en `/app/uploads`

### Los archivos se pierden después de un deploy
- **Causa**: Estás usando `/tmp` en lugar del Volume
- **Solución**: Verifica que `RAILWAY_VOLUME_MOUNT_PATH` esté configurado

### El Volume no aparece en Runtime
- **Causa**: El Volume solo está disponible en runtime, no en build time
- **Solución**: No intentes acceder al Volume durante el proceso de build

## Capacidad del Volume

- **Plan Hobby**: 1 GB incluido
- **Plan Pro**: 5 GB incluido
- **Expansión**: Puedes aumentar la capacidad desde el Dashboard

## Backups

Considera habilitar backups automáticos del Volume en el Dashboard de Railway:
- Ve a **Settings** → **Volumes** → **Backups**
- Configura frecuencia y retención

---

**Última actualización**: 2025-10-23
**Commit relacionado**: 0013279 (temporal /tmp fix), próximo commit implementará Volume correctamente
