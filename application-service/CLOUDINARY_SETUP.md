# Configuración de Cloudinary para Almacenamiento de Documentos

Esta guía te ayudará a migrar de almacenamiento local/Railway Volume a Cloudinary para almacenamiento escalable en la nube.

## Ventajas de Cloudinary

✅ **Persistente**: Los archivos nunca se pierden, incluso con redeploys
✅ **Escalable**: Sin límites de disco, crece con tu aplicación
✅ **CDN Global**: Entrega rápida de archivos desde cualquier parte del mundo
✅ **Transformaciones**: Redimensionar imágenes, convertir formatos, etc.
✅ **Económico**: Plan gratuito generoso (25 GB storage + 25 GB bandwidth/mes)

## Paso 1: Crear Cuenta en Cloudinary

1. Ve a https://cloudinary.com/users/register_free
2. Regístrate con tu email (plan gratuito, no requiere tarjeta)
3. Completa el proceso de verificación de email
4. Una vez en el Dashboard, anota:
   - **Cloud Name** (ej: `dmtn12345`)
   - **API Key** (ej: `123456789012345`)
   - **API Secret** (ej: `abcdef1234567890_ABCDEF`)

## Paso 2: Instalar Dependencias

```bash
cd application-service
npm install cloudinary multer-storage-cloudinary
```

## Paso 3: Configurar Variables de Entorno

### Local (`.env`)

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=tu_cloud_name_aqui
CLOUDINARY_API_KEY=tu_api_key_aqui
CLOUDINARY_API_SECRET=tu_api_secret_aqui

# Optional: Disable Railway Volume (if you want to switch completely)
# RAILWAY_VOLUME_MOUNT_PATH=
```

### Railway Dashboard

1. Ve a tu proyecto → `application-service` → **Variables**
2. Agrega las siguientes variables:
   ```
   CLOUDINARY_CLOUD_NAME=tu_cloud_name_aqui
   CLOUDINARY_API_KEY=tu_api_key_aqui
   CLOUDINARY_API_SECRET=tu_api_secret_aqui
   ```
3. Click en **Add** para cada una

**IMPORTANTE**: Usa las credenciales del Dashboard de Cloudinary, NO las de ejemplo.

## Paso 4: Actualizar Middleware de Upload

Ahora necesitas modificar `src/middleware/upload.js` para usar Cloudinary en lugar de almacenamiento local:

```javascript
// src/middleware/upload.js
const multer = require('multer');
const { createCloudinaryStorage } = require('../services/CloudinaryService');
const logger = require('../utils/logger');

// Use Cloudinary storage if configured, otherwise fallback to local
let storage;
const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
                      process.env.CLOUDINARY_API_KEY &&
                      process.env.CLOUDINARY_API_SECRET;

if (useCloudinary) {
  logger.info('Using Cloudinary for file storage');
  storage = createCloudinaryStorage('mtn_documents');
} else {
  logger.warn('Cloudinary not configured, using local storage');
  // ... tu configuración actual de almacenamiento local
}

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logger.warn(`File upload rejected: ${file.mimetype}`);
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PDF, JPG, PNG, GIF, DOC, DOCX`), false);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
    files: parseInt(process.env.MAX_FILES || '5')
  }
});

module.exports = {
  upload,
  VALID_DOCUMENT_TYPES: [
    'BIRTH_CERTIFICATE',
    'GRADES_2023',
    'GRADES_2024',
    'GRADES_2025_SEMESTER_1',
    'PERSONALITY_REPORT_2024',
    'PERSONALITY_REPORT_2025_SEMESTER_1',
    'STUDENT_PHOTO',
    'BAPTISM_CERTIFICATE',
    'PREVIOUS_SCHOOL_REPORT',
    'MEDICAL_CERTIFICATE',
    'PSYCHOLOGICAL_REPORT'
  ]
};
```

## Paso 5: Actualizar DocumentService (Opcional)

Si quieres guardar la URL de Cloudinary en la base de datos en lugar del path local:

```javascript
// src/services/DocumentService.js

// Cuando guardas un documento, el campo file_path ahora contendrá la URL de Cloudinary:
// Ejemplo: https://res.cloudinary.com/dmtn12345/raw/upload/v1234567890/mtn_documents/timestamp-filename.pdf

// Multer con Cloudinary storage automáticamente proporciona:
// - file.path: URL completa del archivo en Cloudinary
// - file.filename: public_id del archivo

async create(data) {
  const query = `
    INSERT INTO documents (
      application_id, document_type, file_path, file_name,
      file_size, mime_type, uploaded_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
  `;

  const result = await db.query(query, [
    data.applicationId,
    data.documentType,
    data.filePath,  // Ahora es la URL de Cloudinary
    data.fileName,
    data.fileSize,
    data.mimeType,
    data.uploadedBy
  ]);

  return Document.fromDB(result.rows[0]);
}
```

## Paso 6: Actualizar Controller (si es necesario)

El controller no necesita cambios significativos, pero asegúrate de usar la URL de Cloudinary:

```javascript
// src/controllers/DocumentController.js

async uploadDocument(req, res) {
  try {
    const { applicationId } = req.params;
    const { documentType } = req.body;
    const file = req.file;

    if (!file) {
      return fail(res, 'NO_FILE', 'No file uploaded', 400);
    }

    // Con Cloudinary:
    // - file.path es la URL completa: https://res.cloudinary.com/...
    // - file.filename es el public_id: mtn_documents/timestamp-filename

    const document = await DocumentService.create({
      applicationId: parseInt(applicationId),
      documentType,
      filePath: file.path,  // URL de Cloudinary
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user.userId
    });

    return ok(res, document);
  } catch (error) {
    logger.error('Error uploading document', error);
    return fail(res, 'UPLOAD_ERROR', 'Error uploading document', 500);
  }
}
```

## Paso 7: Probar Localmente

1. **Inicia el servicio**:
   ```bash
   npm run dev
   ```

2. **Verifica los logs**:
   ```
   info: Using Cloudinary for file storage
   info: Cloudinary configured: dmtn12345
   ```

3. **Sube un documento** de prueba desde el frontend o Postman

4. **Verifica en Cloudinary Dashboard**:
   - Ve a https://cloudinary.com/console/media_library
   - Deberías ver tu archivo en la carpeta `mtn_documents/`

## Paso 8: Deploy a Railway

1. **Commit los cambios**:
   ```bash
   git add .
   git commit -m "feat: Implement Cloudinary storage for documents"
   git push origin main
   ```

2. **Verifica el deploy** en Railway Dashboard

3. **Prueba** subiendo un documento desde el frontend en producción

## Eliminación de Archivos

Para eliminar archivos de Cloudinary cuando se elimine un documento:

```javascript
// src/controllers/DocumentController.js

const { deleteFile, extractPublicId } = require('../services/CloudinaryService');

async deleteDocument(req, res) {
  try {
    const { id } = req.params;

    // Get document info before deleting
    const document = await DocumentService.getById(id);

    if (!document) {
      return fail(res, 'NOT_FOUND', 'Document not found', 404);
    }

    // Delete from Cloudinary
    if (document.filePath && document.filePath.includes('cloudinary.com')) {
      const publicId = extractPublicId(document.filePath);
      if (publicId) {
        await deleteFile(publicId);
      }
    }

    // Delete from database
    await DocumentService.delete(id);

    return ok(res, { message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Error deleting document', error);
    return fail(res, 'DELETE_ERROR', 'Error deleting document', 500);
  }
}
```

## Descargar Archivos

Los usuarios pueden descargar directamente usando la URL de Cloudinary. No necesitas endpoint especial:

```javascript
// Frontend
const downloadDocument = (documentUrl, fileName) => {
  const link = document.createElement('a');
  link.href = documentUrl;  // URL de Cloudinary
  link.download = fileName;
  link.target = '_blank';
  link.click();
};
```

## Migración de Archivos Existentes (Opcional)

Si ya tienes archivos en Railway Volume o local, puedes migrarlos a Cloudinary:

```javascript
// scripts/migrate-to-cloudinary.js
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function migrateFiles() {
  const documents = await db.query('SELECT * FROM documents WHERE file_path NOT LIKE \'%cloudinary%\'');

  for (const doc of documents.rows) {
    const localPath = doc.file_path;

    if (fs.existsSync(localPath)) {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(localPath, {
          folder: 'mtn_documents',
          resource_type: 'auto'
        });

        // Update database
        await db.query(
          'UPDATE documents SET file_path = $1 WHERE id = $2',
          [result.secure_url, doc.id]
        );

        console.log(`Migrated: ${doc.file_name} -> ${result.secure_url}`);
      } catch (error) {
        console.error(`Error migrating ${doc.file_name}:`, error);
      }
    }
  }

  console.log('Migration complete');
  process.exit(0);
}

migrateFiles();
```

## Troubleshooting

### Error: "Cloudinary configuration incomplete"
- **Causa**: Falta alguna variable de entorno
- **Solución**: Verifica que `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, y `CLOUDINARY_API_SECRET` estén configuradas

### Error: "Invalid signature"
- **Causa**: `CLOUDINARY_API_SECRET` incorrecto
- **Solución**: Verifica que el API Secret sea correcto (cópialo nuevamente del Dashboard)

### Error: "Folder not found"
- **No es un error**: Cloudinary crea la carpeta automáticamente en el primer upload

### Los archivos no aparecen en Media Library
- **Causa**: Los archivos tipo "raw" (PDF, DOC) están en una sección diferente
- **Solución**: En Cloudinary Dashboard, ve a **Media Library** → **Filter** → **Resource Type: Raw**

## Costos

**Plan Gratuito**:
- 25 GB de almacenamiento
- 25 GB de bandwidth/mes
- Transformaciones ilimitadas
- CDN incluido

**Plan Paid** (si superas el gratuito):
- ~$99/mes por 100 GB storage + 100 GB bandwidth
- Se puede escalar según necesites

## Alternativa: AWS S3

Si prefieres AWS S3, revisa `AWS_S3_SETUP.md` (próximamente).

---

**Última actualización**: 2025-10-23
**Autor**: Claude Code
**Soporte**: Consulta la documentación oficial de Cloudinary: https://cloudinary.com/documentation
