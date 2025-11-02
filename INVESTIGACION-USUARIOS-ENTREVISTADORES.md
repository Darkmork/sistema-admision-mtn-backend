# 🔍 Investigación: Problemas con Usuarios Entrevistadores

## 📋 Resumen Ejecutivo

Se detectaron **inconsistencias críticas** en el manejo de usuarios entrevistadores:

1. ❌ **El código NO consulta el campo `can_interview` de la base de datos**
2. ❌ **`canInterview` se calcula dinámicamente solo basándose en roles** (hardcodeado)
3. ❌ **Al crear usuarios, NO se guarda `can_interview` en la BD**
4. ❌ **Inconsistencia entre documentación y código**: La doc dice usar `can_interview`, pero el código lo ignora

---

## 🔴 Problemas Encontrados

### Problema 1: Desconexión entre BD y Código

**Documentación dice** (en `PROBLEMA_EVALUADORES.md`):
```sql
-- Ver usuarios que pueden realizar entrevistas
SELECT id, email, first_name, last_name, role, can_interview
FROM users
WHERE can_interview = true;
```

**Código actual hace** (en `user-service/src/routes/userRoutes.js` líneas 48, 428, 620):
```javascript
canInterview: ['TEACHER', ' действительноINTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER'].includes(user.role)
```

**Resultado**: El código **ignora completamente** el campo `can_interview` de la BD y calcula el valor basándose solo en roles.

---

### Problema 2: Campo `can_interview` NO se Consulta en Queries SQL

**Lugares afectados**:

1. **`/api/users/public/school-staff`** (línea 22-24):
   ```javascript
   SELECT id, first_name as "firstName", last_name as "lastName", email, role,
          subject, rut, phone, active, email_verified as "emailVerified"
   FROM users
   ```
   ❌ **NO incluye `can_interview` en el SELECT**

2. **`/api/users/staff`** (línea ~414):
   ```javascript
   // Query similar, tampoco incluye can_interview
   ```
   ❌ **NO incluye `can_interview` en el SELECT**

3. **`/api/users/:id`** (línea 596):
   ```javascript
   SELECT id, first_name, last_name, email, role, subject, rut, phone, active, email_verified 
   FROM users WHERE id = $1
   ```
   ❌ **NO incluye `can_interview` en el SELECT**

---

### Problema 3: Campo `can_interview` NO se Guarda al Crear Usuarios

**En `POST /api/users`** (línea 639-656):
```javascript
INSERT INTO users (first_name, last_name, email, password, role, active, email_verified, rut, phone, subject, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
```
❌ **NO incluye `can_interview` en el INSERT**

**Impacto**: Aunque un admin intente crear un usuario con `canInterview: true` desde el frontend, **ese valor nunca se guarda en la BD**.

---

### Problema 4: Campo `can_interview` NO se Actualiza

**En `PUT /api/users/:id`** (línea ~680):
Necesita verificación, pero probablemente también **NO incluye `can_interview` en el UPDATE**.

**Impacto**: No se puede activar/desactivar la capacidad de entrevistar de un usuario existente.

---

### Problema 5: Endpoint de Entrevistadores No Usa `can_interview`

**En `evaluation-service/src/routes/interviewRoutes.js`** (línea 43):
```javascript
WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER')
  AND u.active = true
```
❌ **NO filtra por `can_interview = true`**

**Impacto**: Aparecen TODOS los usuarios con esos roles, incluso si `can_interview = false` en la BD.

---

### Problema 6: Array de Roles con Duplicado

**En múltiples lugares** (líneas 48, 428, 620):
```javascript
['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER']
```
❌ **'INTERVIEWER' aparece dos veces** (innecesario, pero no es crítico)

---

### Problema 7: Inconsistencia de Nombres de Roles

**En el código**:
- Se usa `'TEACHER'` en algunos lugares
- Se usa `'PROFESSOR'` en la documentación SQL
- Se usa `'INTERVIEWER'` como rol

**Necesita verificación**: ¿Cuál es el nombre correcto del rol? ¿`TEACHER` o `PROFESSOR`?

---

## 🎯 Impacto en el Sistema

### Para Administradores:
1. ❌ No pueden crear usuarios con `canInterview: true` porque el valor no se guarda
2. ❌ No pueden activar/desactivar la capacidad de entrevistar de usuarios existentes
3. ❌ La lista de entrevistadores incluye usuarios que no deberían poder entrevistar

### Para el Frontend:
1. ❌ `canInterview` siempre se calcula basándose solo en roles
2. ❌ No refleja el valor real de la BD
3. ❌ Si un admin modifica `can_interview` en la BD directamente, el frontend no lo reflejará

### Para la Lógica de Negocio:
1. ❌ No hay forma de desactivar la capacidad de entrevistar sin cambiar el rol del usuario
2. ❌ Todos los usuarios con ciertos roles pueden entrevistar automáticamente, sin control granular

---

## 📍 Archivos Afectados

### `user-service/src/routes/userRoutes.js`
- **Línea 22-24**: Query SQL no incluye `can_interview`
- **Línea 48**: Calcula `canInterview` basándose solo en roles
- **Línea ~414**: Query SQL para `/staff` no incluye `can_interview`
- **Línea 428**: Calcula `canInterview` basándose solo en roles
- **Línea 596**: Query SQL no incluye `can_interview`
- **Línea 620**: Calcula `canInterview` basándose solo en roles
- **Línea 640**: INSERT no incluye `can_interview`
- **Línea ~680**: UPDATE probablemente no incluye `can_interview` (necesita verificación)

### `evaluation-service/src/routes/interviewRoutes.js`
- **Línea 25-46**: Query SQL no filtra por `can_interview = true`
- **Línea 43**: Solo filtra por roles y `active = true`

---

## ✅ Soluciones Recomendadas

### Solución 1: Consultar `can_interview` de la BD

**Cambiar todos los SELECT para incluir `can_interview`**:
```javascript
SELECT id, first_name, last_name, email, role, subject, rut, phone, active, email_verified, can_interview
FROM users
```

### Solución 2: Usar el Valor Real de la BD

**En lugar de calcular**:
```javascript
canInterview: ['TEACHER', ...].includes(user.role)
```

**Usar el valor de la BD**:
```javascript
canInterview: user.can_interview === true || user.can_interview === 'true'
```

**Con fallback a roles** (para mantener compatibilidad):
```javascript
canInterview: user.can_interview === true || 
              (user.can_interview === null && ['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR'].includes(user.role))
```

### Solución 3: Guardar `can_interview` al Crear Usuarios

**Agregar al INSERT**:
```javascript
INSERT INTO users (..., can_interview, ...)
VALUES (..., $11, ...)
```

**Y al mapeo**:
```javascript
req.body.canInterview !== undefined ? req.body.canInterview : 
  (['TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR'].includes(req.body.role) ? true : false)
```

### Solución 4: Actualizar `can_interview` en UPDATE

**Agregar al UPDATE**:
```javascript
UPDATE users 
SET ..., can_interview = $X, ...
WHERE id = $Y
```

### Solución 5: Filtrar por `can_interview` en Endpoint de Entrevistadores

**Cambiar query en `interviewRoutes.js`**:
```javascript
WHERE u.role IN ('TEACHER', 'PSYCHOLOGIST', 'CYCLE_DIRECTOR', 'COORDINATOR', 'INTERVIEWER')
  AND u.active = true
  AND (u.can_interview = true OR u.can_interview IS NULL)  -- Agregar esto
```

---

## 🔍 Verificaciones Necesarias

1. **¿Existe la columna `can_interview` en la tabla `users`?**
   ```sql
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'can_interview';
   ```

2. **¿Qué valores tiene actualmente?**
   ```sql
   SELECT role, COUNT(*) as total, 
          COUNT(can_interview) as with_flag, 
          COUNT(*) FILTER (WHERE can_interview = true) as enabled
   FROM users
   WHERE role IN ('TEACHER', 'PSYCHOLOGIST', 'INTERVIEWER', 'CYCLE_DIRECTOR', 'COORDINATOR')
   GROUP BY role;
   ```

3. **¿Cuál es el nombre correcto del rol: `TEACHER` o `PROFESSOR`?**
   ```sql
   SELECT DISTINCT role FROM users ORDER BY role;
   ```

---

## 📊 Casos de Uso Afectados

1. **Crear usuario entrevistador desde el frontend**
   - ❌ No funciona: `canInterview` no se guarda en BD

2. **Ver lista de entrevistadores disponibles**
   - ⚠️ Funciona parcialmente: Muestra todos los usuarios con ciertos roles, ignorando `can_interview`

3. **Desactivar capacidad de entrevistar de un usuario**
   - ❌ No funciona: No hay forma de actualizar `can_interview`

4. **Filtrar entrevistadores por capacidad real**
   - ❌ No funciona: El filtro no consulta la BD

---

## 🎯 Prioridad de Corrección

### Alta Prioridad:
1. ✅ Consultar `can_interview` en todos los SELECT
2. ✅ Usar valor real de `can_interview` en lugar de calcularlo
3. ✅ Guardar `can_interview` al crear usuarios
4. ✅ Actualizar `can_interview` al modificar usuarios

### Media Prioridad:
5. ✅ Filtrar por `can_interview` en endpoint de entrevistadores
6. ✅ Eliminar duplicado 'INTERVIEWER' en arrays de roles

### Baja Prioridad:
7. ✅ Estandarizar nombres de roles (`TEACHER` vs `PROFESSOR`)

---

## 📝 Notas Adicionales

- El documento `PROBLEMA_EVALUADORES.md` menciona usar `can_interview`, pero el código nunca lo implementó completamente
- Es posible que el campo `can_interview` exista en la BD pero nunca se haya usado
- Se necesita migración SQL si el campo no existe

---

**Fecha de Investigación**: 2025-10-29  
**Estado**: 🔴 Problemas críticos encontrados - Requiere corrección  
**Impacto**: Alto - Afecta funcionalidad core del sistema

