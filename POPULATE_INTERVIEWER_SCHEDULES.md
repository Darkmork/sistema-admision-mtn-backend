# Poblar Horarios de Entrevistadores

Este script SQL genera automáticamente horarios disponibles para todos los usuarios con roles de entrevistador en el sistema.

## 📋 Roles Incluidos

- **TEACHER** - Entrevistadores/Profesores
- **PSYCHOLOGIST** - Psicólogos
- **CYCLE_DIRECTOR** - Directores de Ciclo

## ⏰ Configuración de Horarios

- **Días**: Lunes a Viernes (solo días laborables)
- **Horario**: 9:00 AM - 5:00 PM
- **Bloques**: 30 minutos cada uno
- **Cantidad**: 16 bloques por día (9:00-9:30, 9:30-10:00, ..., 16:30-17:00)
- **Duración**: Próximos 30 días desde hoy

## 🚀 Cómo Ejecutar

### Opción 1: Railway (Recomendado)

```bash
# Desde el directorio del proyecto
railway run psql $DATABASE_URL < POPULATE_INTERVIEWER_SCHEDULES.sql
```

### Opción 2: Local PostgreSQL

```bash
PGPASSWORD=admin123 psql -h localhost -U admin -d "Admisión_MTN_DB" -f POPULATE_INTERVIEWER_SCHEDULES.sql
```

### Opción 3: Copiar y Pegar

1. Copia el contenido del script SQL de abajo
2. Conéctate a tu base de datos
3. Pega y ejecuta

---

## 📝 Script SQL Completo

```sql
-- =====================================================
-- Poblar Horarios de Entrevistadores
-- =====================================================
-- Genera horarios para todos los usuarios con roles:
-- - TEACHER (entrevistadores)
-- - PSYCHOLOGIST (psicólogos)
-- - CYCLE_DIRECTOR (directores de ciclo)
--
-- Horarios: Lunes a Viernes, 9:00 - 17:00 hrs
-- Bloques de 30 minutos
-- Fechas: Próximas 4 semanas desde hoy
-- =====================================================

BEGIN;

-- Limpiar horarios existentes (opcional - comentar si quieres mantener los existentes)
-- DELETE FROM interviewer_schedules;

-- Insertar horarios para los próximos 30 días laborables
INSERT INTO interviewer_schedules (
    user_id,
    available_date,
    start_time,
    end_time,
    is_available,
    created_at
)
SELECT
    u.id as user_id,
    date_series::date as available_date,
    time_series as start_time,
    (time_series + interval '30 minutes')::time as end_time,
    true as is_available,
    NOW() as created_at
FROM
    -- Seleccionar usuarios con roles de entrevistadores
    users u
CROSS JOIN
    -- Generar fechas para los próximos 30 días (solo días laborables L-V)
    generate_series(
        CURRENT_DATE,
        CURRENT_DATE + interval '30 days',
        interval '1 day'
    ) as date_series
CROSS JOIN
    -- Generar bloques de tiempo de 30 minutos entre 9:00 y 17:00
    generate_series(
        time '09:00',
        time '16:30',  -- Último bloque empieza a las 16:30 y termina a las 17:00
        interval '30 minutes'
    ) as time_series
WHERE
    -- Solo usuarios con roles relevantes
    u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')

    -- Solo días laborables (1=Lunes, 5=Viernes)
    AND EXTRACT(ISODOW FROM date_series) BETWEEN 1 AND 5

    -- Excluir fechas pasadas (por si la serie incluye el día actual y ya pasó la hora)
    AND (
        date_series > CURRENT_DATE
        OR (date_series = CURRENT_DATE AND time_series > CURRENT_TIME)
    )

    -- Evitar duplicados (verificar que no exista ya ese horario)
    AND NOT EXISTS (
        SELECT 1
        FROM interviewer_schedules existing
        WHERE existing.user_id = u.id
          AND existing.available_date = date_series::date
          AND existing.start_time = time_series
    )

    -- Solo usuarios activos
    AND u.is_active = true

ORDER BY u.id, date_series, time_series;

-- Mostrar resumen de horarios creados
SELECT
    u.first_name || ' ' || u.last_name as nombre_completo,
    u.role as rol,
    COUNT(*) as total_bloques,
    MIN(isch.available_date) as primera_fecha,
    MAX(isch.available_date) as ultima_fecha,
    SUM(CASE WHEN isch.is_available THEN 1 ELSE 0 END) as bloques_disponibles,
    SUM(CASE WHEN NOT isch.is_available THEN 1 ELSE 0 END) as bloques_ocupados
FROM interviewer_schedules isch
JOIN users u ON u.id = isch.user_id
WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')
GROUP BY u.id, u.first_name, u.last_name, u.role
ORDER BY u.role, u.last_name;

COMMIT;

-- =====================================================
-- Estadísticas Finales
-- =====================================================

-- Resumen General
SELECT
    '📊 RESUMEN GENERAL' as tipo,
    COUNT(DISTINCT user_id) as total_usuarios,
    COUNT(*) as total_bloques,
    COUNT(DISTINCT available_date) as total_dias,
    MIN(available_date) as fecha_inicio,
    MAX(available_date) as fecha_fin
FROM interviewer_schedules isch
JOIN users u ON u.id = isch.user_id
WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR');

-- Horarios por día de la semana
SELECT
    '📅 POR DÍA DE SEMANA' as tipo,
    CASE EXTRACT(ISODOW FROM available_date)
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
    END as dia_semana,
    COUNT(*) as total_bloques,
    SUM(CASE WHEN is_available THEN 1 ELSE 0 END) as disponibles,
    SUM(CASE WHEN NOT is_available THEN 1 ELSE 0 END) as ocupados
FROM interviewer_schedules isch
JOIN users u ON u.id = isch.user_id
WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')
  AND available_date >= CURRENT_DATE
GROUP BY EXTRACT(ISODOW FROM available_date)
ORDER BY EXTRACT(ISODOW FROM available_date);

-- Horarios por rol
SELECT
    '👥 POR ROL' as tipo,
    u.role as rol,
    COUNT(DISTINCT u.id) as total_usuarios,
    COUNT(*) as total_bloques,
    ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT u.id), 1) as promedio_bloques_por_usuario
FROM interviewer_schedules isch
JOIN users u ON u.id = isch.user_id
WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR')
  AND isch.available_date >= CURRENT_DATE
GROUP BY u.role
ORDER BY u.role;
```

---

## 📊 Output Esperado

Después de ejecutar el script, verás:

### 1. Resumen por Usuario
```
nombre_completo        | rol            | total_bloques | primera_fecha | ultima_fecha | bloques_disponibles | bloques_ocupados
-----------------------|----------------|---------------|---------------|--------------|---------------------|------------------
Ana García             | TEACHER        | 352           | 2025-01-04   | 2025-02-03   | 352                 | 0
Carlos Pérez           | PSYCHOLOGIST   | 352           | 2025-01-04   | 2025-02-03   | 352                 | 0
...
```

### 2. Estadísticas Generales
```
tipo             | total_usuarios | total_bloques | total_dias | fecha_inicio | fecha_fin
-----------------|----------------|---------------|------------|--------------|------------
📊 RESUMEN GENERAL | 8              | 2816          | 22         | 2025-01-04   | 2025-02-03
```

### 3. Por Día de Semana
```
tipo                | dia_semana  | total_bloques | disponibles | ocupados
--------------------|-------------|---------------|-------------|----------
📅 POR DÍA DE SEMANA | Lunes       | 576           | 576         | 0
📅 POR DÍA DE SEMANA | Martes      | 576           | 576         | 0
...
```

### 4. Por Rol
```
tipo        | rol            | total_usuarios | total_bloques | promedio_bloques_por_usuario
------------|----------------|----------------|---------------|-----------------------------
👥 POR ROL  | CYCLE_DIRECTOR | 2              | 704           | 352.0
👥 POR ROL  | PSYCHOLOGIST   | 3              | 1056          | 352.0
👥 POR ROL  | TEACHER        | 3              | 1056          | 352.0
```

---

## ⚠️ Notas Importantes

1. **Duplicados**: El script NO sobrescribe horarios existentes. Solo crea horarios nuevos.
2. **Usuarios Activos**: Solo crea horarios para usuarios con `is_active = true`
3. **Días Pasados**: No crea horarios para fechas u horas ya pasadas
4. **Transacción**: Todo se ejecuta en una transacción. Si hay error, hace ROLLBACK automático.

## 🔄 Para Limpiar Todos los Horarios (Usar con Precaución)

Si necesitas empezar desde cero, descomenta esta línea en el script:

```sql
DELETE FROM interviewer_schedules;
```

**⚠️ ADVERTENCIA**: Esto eliminará TODOS los horarios existentes, incluyendo los ya ocupados con entrevistas programadas.

## 📅 Para Ajustar el Rango de Fechas

Para cambiar el número de días:

```sql
-- Cambiar de 30 a 60 días
CURRENT_DATE + interval '60 days'
```

## 🕐 Para Ajustar el Horario

Para cambiar las horas de inicio/fin:

```sql
-- Cambiar a 8:00 - 18:00
generate_series(
    time '08:00',
    time '17:30',  -- Último bloque 17:30-18:00
    interval '30 minutes'
)
```

## 📞 Soporte

Si encuentras algún problema ejecutando este script:
1. Verifica que tengas permisos de INSERT en la tabla `interviewer_schedules`
2. Verifica que existan usuarios con roles TEACHER, PSYCHOLOGIST o CYCLE_DIRECTOR
3. Revisa los logs de PostgreSQL para errores específicos

---

**Creado**: Enero 2025
**Última Actualización**: Enero 2025
**Sistema**: MTN Admission System
