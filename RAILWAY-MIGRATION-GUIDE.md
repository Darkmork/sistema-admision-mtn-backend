# Railway Database Schema Migration Guide

## Resumen

Este documento explica cómo actualizar la base de datos de Railway para que tenga el mismo schema que la base de datos local, permitiendo que el código funcione sin problemas de compatibilidad.

## Problema Identificado

Las bases de datos local y Railway tienen schemas diferentes:

### Columnas Faltantes en Railway:

**documents table:**
- ❌ `approval_status` (VARCHAR(50), DEFAULT 'PENDING')
- ❌ `approved_by` (BIGINT, FK a users)
- ❌ `approval_date` (TIMESTAMP)
- ❌ `rejection_reason` (TEXT)

**students table:**
- ❌ `pais`, `region`, `comuna`
- ❌ `admission_preference`, `target_school`, `age`
- ❌ Campos de categorías especiales (employee_child, alumni_child, inclusion_student)

**guardians table:**
- ❌ `profession`, `workplace`

**applications table:**
- ❌ `deleted_at`, `is_archived`

**parents table:**
- ❌ `workplace`

## Opciones de Migración

### Opción 1: Ejecutar Script de Migración (RECOMENDADO)

Este es el enfoque más seguro - **agrega las columnas faltantes sin perder datos**.

#### Paso 1: Conectarse a Railway

Usando Railway CLI:
```bash
railway login
cd /Users/jorgegangale/Desktop/MIcroservicios
railway link  # Selecciona tu proyecto
railway connect postgres
```

#### Paso 2: Ejecutar el Script

```bash
railway run psql -f railway-schema-migration.sql
```

O manualmente:
```bash
# Copiar contenido de railway-schema-migration.sql
railway connect postgres
# Pegar el contenido del script en psql
```

#### Paso 3: Verificar

```bash
railway run psql -c "\d documents"
railway run psql -c "\d students"
```

### Opción 2: Backup y Restore desde Local (DESTRUCTIVO)

⚠️ **ADVERTENCIA**: Esto **ELIMINARÁ todos los datos actuales en Railway**.

#### Paso 1: Hacer Backup de Railway (por seguridad)

```bash
# Desde Railway
railway run pg_dump > railway-backup-$(date +%Y%m%d).sql
```

#### Paso 2: Exportar Schema Local

```bash
# Desde local
PGPASSWORD=admin123 pg_dump -h localhost -U admin -d "Admisión_MTN_DB" \
  --schema-only --no-owner --no-acl > local-schema.sql
```

#### Paso 3: Aplicar a Railway

```bash
# CUIDADO: Esto elimina todas las tablas existentes
railway run psql -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
railway run psql -f local-schema.sql
```

### Opción 3: Código Compatible con Ambos Schemas (YA IMPLEMENTADO)

✅ **Esta es la opción que ya aplicamos** en los últimos commits:
- Removimos columnas de approval de las queries
- Hacemos queries condicionales solo con columnas que existen en ambas BDs
- El sistema funciona en ambos ambientes

**Ventaja**: No requiere cambios en la BD
**Desventaja**: No podemos usar features de aprobación de documentos hasta migrar

## Recomendación

**Para desarrollo inmediato**: Mantener código compatible (Opción 3 - ya implementado)
**Para producción**: Ejecutar migración (Opción 1) para tener todas las features disponibles

## Estado Actual (2025-10-22)

✅ El sistema **YA ESTÁ FUNCIONANDO** en Railway con el código compatible:
- Application 49 creada exitosamente
- Student 56, Father 99, Mother 100, Guardian 32, Supporter 32 creados
- Solo falta ejecutar la migración para habilitar features de aprobación de documentos

## Después de Migrar

Una vez ejecutada la migración, puedes:

1. **Restaurar código de aprobación** en `getApplicationById()`:
```javascript
// Volver a agregar estas columnas a la query:
d.approval_status,
d.approved_by,
d.approval_date,
d.rejection_reason
```

2. **Habilitar features de admin**:
- Aprobación/rechazo de documentos
- Tracking de quién aprobó qué
- Razones de rechazo

3. **Usar campos adicionales de estudiantes**:
- Categorías especiales (empleado, ex-alumno, inclusión)
- Localización (país, región, comuna)
- Preferencias de admisión

## Contacto y Soporte

Si tienes dudas al ejecutar la migración, revisa:
1. Logs de Railway: `railway logs`
2. Estado de la BD: `railway run psql -c "\dt"`
3. Verificar columnas: `railway run psql -c "\d [table_name]"`
