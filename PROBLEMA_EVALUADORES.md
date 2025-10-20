# Problema: No Aparecen Profesores en Asignación de Evaluaciones

## Descripción del Problema

Cuando intentas asignar una evaluación, no aparecen los profesores de las diferentes asignaturas en el listado. Esto impide que puedas asignar evaluadores a las postulaciones de estudiantes.

## Causa Raíz

El problema tiene **DOS CAUSAS POSIBLES**:

### 1. No hay usuarios con `canInterview = true` en la base de datos

El frontend busca usuarios con el campo `canInterview = true` para mostrarlos en la lista de evaluadores disponibles. Si no hay usuarios con este flag activado, la lista aparecerá vacía.

### 2. El endpoint `/api/users/staff` no está funcionando correctamente

El endpoint que trae la lista de profesores puede tener problemas de:
- Autenticación/autorización
- Filtros incorrectos
- Servicio caído

## Soluciones

### Solución 1: Verificar y Crear Usuarios Evaluadores

**Paso 1: Verificar si hay usuarios con canInterview=true**

```sql
-- Conectarse a la base de datos
psql -d admissions_db

-- Ver usuarios que pueden realizar entrevistas
SELECT id, email, first_name, last_name, role, can_interview
FROM users
WHERE can_interview = true;
```

**Paso 2: Si no hay usuarios, crear algunos usuarios evaluadores**

```sql
-- Crear usuario profesor de Matemáticas
INSERT INTO users (email, password_hash, first_name, last_name, role, can_interview, subjects, created_at)
VALUES (
  'profesor.matematicas@mtn.cl',
  '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',  -- Cambia esto por un hash real
  'Juan',
  'Pérez',
  'PROFESSOR',
  true,
  ARRAY['MATEMATICAS'],
  NOW()
);

-- Crear usuario profesor de Lenguaje
INSERT INTO users (email, password_hash, first_name, last_name, role, can_interview, subjects, created_at)
VALUES (
  'profesor.lenguaje@mtn.cl',
  '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',  -- Cambia esto por un hash real
  'María',
  'González',
  'PROFESSOR',
  true,
  ARRAY['LENGUAJE'],
  NOW()
);

-- Crear usuario profesor de Ciencias
INSERT INTO users (email, password_hash, first_name, last_name, role, can_interview, subjects, created_at)
VALUES (
  'profesor.ciencias@mtn.cl',
  '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',  -- Cambia esto por un hash real
  'Pedro',
  'Rodríguez',
  'PROFESSOR',
  true,
  ARRAY['CIENCIAS'],
  NOW()
);

-- Crear usuario profesor de Historia
INSERT INTO users (email, password_hash, first_name, last_name, role, can_interview, subjects, created_at)
VALUES (
  'profesor.historia@mtn.cl',
  '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',  -- Cambia esto por un hash real
  'Ana',
  'Martínez',
  'PROFESSOR',
  true,
  ARRAY['HISTORIA'],
  NOW()
);

-- Verificar que se crearon correctamente
SELECT id, email, first_name, last_name, can_interview, subjects
FROM users
WHERE can_interview = true;
```

**Paso 3: Actualizar usuarios existentes para permitir entrevistas**

Si ya tienes usuarios creados pero no tienen el flag `canInterview`:

```sql
-- Ver todos los profesores
SELECT id, email, first_name, last_name, role, can_interview
FROM users
WHERE role IN ('PROFESSOR', 'COORDINATOR');

-- Activar canInterview para un usuario específico
UPDATE users
SET can_interview = true,
    subjects = ARRAY['MATEMATICAS']  -- Ajusta según la materia
WHERE email = 'usuario@mtn.cl';

-- Activar canInterview para todos los profesores
UPDATE users
SET can_interview = true
WHERE role = 'PROFESSOR';
```

### Solución 2: Verificar el Endpoint /api/users/staff

**Verificar que el User Service esté corriendo:**

```bash
curl http://localhost:8082/health
```

**Verificar el endpoint directamente:**

```bash
# Primero necesitas un token válido
# Inicia sesión desde el frontend y copia el token de localStorage

TOKEN="tu_token_aqui"

curl "http://localhost:8080/api/users/staff?page=0&size=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Respuesta esperada:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "profesor.matematicas@mtn.cl",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": "PROFESSOR",
      "canInterview": true,
      "subjects": ["MATEMATICAS"]
    },
    ...
  ],
  "pagination": {
    "page": 0,
    "size": 10,
    "total": 4
  }
}
```

### Solución 3: Script Rápido para Crear Usuarios de Prueba

Crea un archivo `create-test-teachers.sql`:

```sql
-- Limpia usuarios de prueba anteriores (opcional)
DELETE FROM users WHERE email LIKE 'profesor.%@mtn.cl';

-- Crea 4 profesores de prueba con diferentes materias
INSERT INTO users (email, password_hash, first_name, last_name, role, can_interview, subjects, created_at) VALUES
('profesor.matematicas@mtn.cl', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Juan', 'Pérez', 'PROFESSOR', true, ARRAY['MATEMATICAS'], NOW()),
('profesor.lenguaje@mtn.cl', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'María', 'González', 'PROFESSOR', true, ARRAY['LENGUAJE'], NOW()),
('profesor.ciencias@mtn.cl', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Pedro', 'Rodríguez', 'PROFESSOR', true, ARRAY['CIENCIAS'], NOW()),
('profesor.historia@mtn.cl', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'Ana', 'Martínez', 'PROFESSOR', true, ARRAY['HISTORIA'], NOW());

-- Verifica
SELECT id, email, first_name, last_name, can_interview, subjects FROM users WHERE can_interview = true;
```

Ejecuta:

```bash
psql -d admissions_db -f create-test-teachers.sql
```

**Nota:** El password hash usado es para la contraseña `"password123"` (solo para desarrollo/testing).

## Cómo Verificar que Funcionó

1. **Desde la base de datos:**
```sql
SELECT COUNT(*) as total_evaluadores
FROM users
WHERE can_interview = true;
```

Debería devolver al menos 1 (idealmente 4+ para diferentes materias).

2. **Desde el frontend:**
- Inicia sesión como ADMIN
- Ve a la sección de "Evaluaciones" o "Asignar Evaluación"
- Deberías ver una lista de profesores disponibles para asignar

3. **Desde el API:**
```bash
# Obtén un token válido primero (desde localStorage en el navegador)
TOKEN="tu_token_aqui"

curl "http://localhost:8080/api/users/staff" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Campos Requeridos en la Tabla `users`

Para que un usuario aparezca como evaluador disponible:

- `can_interview`: **true** ✅ (OBLIGATORIO)
- `role`: 'PROFESSOR', 'COORDINATOR', o 'ADMIN' (recomendado: 'PROFESSOR')
- `subjects`: Array con las materias que puede evaluar (ej: `['MATEMATICAS', 'FISICA']`)
- `first_name`, `last_name`: Para mostrar el nombre completo
- `email`: Para identificación única

## Troubleshooting

### Problema: "No hay profesores disponibles"

**Causa:** No hay usuarios con `canInterview = true`

**Solución:** Ejecuta los scripts SQL arriba para crear usuarios evaluadores

### Problema: "Error al cargar profesores"

**Causa:** User Service no está corriendo o hay error en el endpoint

**Solución:**
1. Verifica que user-service esté corriendo: `curl http://localhost:8082/health`
2. Revisa logs del user-service: `cd /Users/jorgegangale/Desktop/MIcroservicios/user-service && npm start`
3. Verifica que el gateway esté ruteando correctamente

### Problema: "Token expirado"

**Causa:** El token JWT expiró (duración: 24 horas por defecto)

**Solución:** Cierra sesión y vuelve a iniciar sesión para obtener un token nuevo

## Próximos Pasos

1. ✅ Crear usuarios evaluadores en la base de datos
2. ✅ Verificar que `canInterview = true` para esos usuarios
3. ✅ Asignar `subjects` apropiados a cada evaluador
4. ✅ Reiniciar user-service si hiciste cambios directos en BD
5. ✅ Probar desde el frontend que aparezcan en la lista
6. ✅ Asignar una evaluación de prueba

## Contacto

Si el problema persiste después de aplicar estas soluciones, verifica:

1. **Logs del User Service:**
```bash
cd /Users/jorgegangale/Desktop/MIcroservicios/user-service
npm start
# Observa los logs para ver errores
```

2. **Logs del Gateway:**
```bash
tail -f /opt/homebrew/var/log/nginx/error.log
```

3. **Console del navegador:**
- Abre DevTools (F12)
- Ve a Network tab
- Filtra por "staff"
- Observa la respuesta del endpoint

---

**Fecha:** 2025-10-19
**Documento creado por:** Claude Code
**Relacionado con:** Sistema de Gestión de Evaluaciones - MTN
