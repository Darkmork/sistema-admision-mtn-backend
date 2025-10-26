# 🔄 Punto de Rollback - 25 de Octubre 2025

## Fecha y Hora
**Creado:** 2025-10-25 23:20 CLT
**Último trabajo completado:** Soporte completo para entrevistas CYCLE_DIRECTOR con 2 entrevistadores

---

## Estado del Sistema - FUNCIONANDO ✅

### Frontend (Vercel)
**Repositorio:** `Admision_MTN_front`
**Branch:** `main`
**Último commit:** `3d4373d` - "fix(frontend): corregir problema de zona horaria en visualización de fechas"

**Funcionalidades completadas:**
1. ✅ Entrevistas FAMILY con 2 entrevistadores (funcionando perfectamente)
2. ✅ Entrevistas CYCLE_DIRECTOR con 2 entrevistadores (funcionando igual que FAMILY)
3. ✅ Horarios comunes entre ambos entrevistadores
4. ✅ Visualización correcta de fechas sin desfase de zona horaria
5. ✅ Validación de segundo entrevistador requerido para FAMILY y CYCLE_DIRECTOR
6. ✅ FormData preserva secondInterviewerId al cambiar tipo de entrevista

**Archivos clave modificados:**
- `components/interviews/InterviewForm.tsx` - Soporte CYCLE_DIRECTOR (líneas 414, 832, 936, 945, 948, 967, 972, 1000)
- `components/interviews/InterviewTable.tsx` - Fix zona horaria (líneas 151-173)
- `components/interviews/InterviewOverview.tsx` - Fix zona horaria (líneas 127-142)
- `components/interviews/InterviewDashboard.tsx` - Fix zona horaria (líneas 309-313)
- `components/interviews/EnhancedInterviewCalendar.tsx` - Fix zona horaria (líneas 518-533)
- `components/interviews/StudentDetailPage.tsx` - Fix zona horaria (líneas 221-225, 383-389)

### Backend (Railway)
**Repositorio:** `sistema-admision-mtn-backend`
**Branch:** `main`
**Último commit:** `cafe555` - "feat(evaluation): add SQL script to update interviews type constraint for CYCLE_DIRECTOR"

**Funcionalidades completadas:**
1. ✅ InterviewService acepta secondInterviewerId en INSERT (línea 94)
2. ✅ Joi validator acepta secondInterviewerId como opcional (línea 36)
3. ✅ Base de datos Railway actualizada con constraint para CYCLE_DIRECTOR
4. ✅ Entrevistas CYCLE_DIRECTOR se crean exitosamente con 2 entrevistadores

**Archivos clave modificados:**
- `evaluation-service/src/services/InterviewService.js` - Soporte segundo entrevistador (líneas 87-102)
- `evaluation-service/src/middleware/validators.js` - Validación secondInterviewerId (línea 36)
- `evaluation-service/scripts/add-cycle-director-type.sql` - Script de migración ejecutado

### Base de Datos (Railway Postgres)
**Constraint actualizado:**
```sql
CHECK (type IN ('FAMILY', 'STUDENT', 'DIRECTOR', 'PSYCHOLOGIST', 'ACADEMIC', 'CYCLE_DIRECTOR'))
```

**Columnas relevantes en tabla `interviews`:**
- `interviewer_user_id` (INTEGER, FK a users)
- `second_interviewer_id` (INTEGER, FK a users, puede ser NULL)
- `type` (VARCHAR, con CHECK constraint)
- `scheduled_date` (DATE)
- `scheduled_time` (TIME)

---

## Problemas Resueltos

### 1. Error 400 al crear CYCLE_DIRECTOR
- **Causa:** Constraint de BD en Railway no incluía 'CYCLE_DIRECTOR'
- **Solución:** Ejecutado script SQL para actualizar constraint
- **Commit:** `cafe555`

### 2. Fechas con desfase de un día
- **Síntoma:** Entrevista del lunes 03/11 aparecía como domingo 02/11 21:00
- **Causa:** `new Date('2024-11-03')` interpreta como UTC, al convertir a CLT (UTC-3) cambia día
- **Solución:** Parsear manualmente fecha: `new Date(year, month-1, day)`
- **Commit:** `3d4373d`

### 3. Common time slots no se mostraban para CYCLE_DIRECTOR
- **Causa:** Línea 414 de InterviewForm.tsx limpiaba `secondInterviewerId` al cambiar tipo
- **Solución:** Cambiar condición a `!= FAMILY && != CYCLE_DIRECTOR`
- **Commit:** `6037f03`

### 4. Segundo entrevistador no se guardaba en BD
- **Causa:** INSERT no incluía columna `second_interviewer_id`
- **Solución:** Agregado a query INSERT en InterviewService.js
- **Commit:** `447651d`

---

## Cómo Hacer Rollback

### Si necesitas revertir el frontend:
```bash
cd "/Users/jorgegangale/Library/Mobile Documents/com~apple~CloudDocs/Proyectos/Admision_MTN/Admision_MTN_front"
git log --oneline -10  # Ver últimos commits
git revert 3d4373d     # Revertir fix de zona horaria
git revert 49580d6     # Revertir soporte CYCLE_DIRECTOR en UI
git revert 6037f03     # Revertir preservación de secondInterviewerId
git push origin main
```

### Si necesitas revertir el backend:
```bash
cd /Users/jorgegangale/Desktop/MIcroservicios
git log --oneline -10
git revert cafe555     # Revertir constraint CYCLE_DIRECTOR (solo elimina script, no afecta BD)
git revert 9db0d2a     # Revertir validator secondInterviewerId
git revert 447651d     # Revertir INSERT con segundo entrevistador
git push origin main
railway up --service evaluation-service  # Redesplegar
```

### Si necesitas revertir la base de datos:
```bash
cat <<'EOF' | railway connect Postgres
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_type_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_type_check
CHECK (type IN ('FAMILY', 'STUDENT', 'DIRECTOR', 'PSYCHOLOGIST', 'ACADEMIC'));
EOF
```

---

## Variables de Entorno Críticas (Railway)

```bash
# evaluation-service
NODE_ENV=production
JWT_SECRET=mtn_secret_key_2025_admissions
DATABASE_URL=${{Postgres.DATABASE_URL}}
CSRF_SECRET=<mismo-en-todos-los-servicios>
PORT=8080

# gateway-service
EVALUATION_SERVICE_URL=http://evaluation-service:8080
```

---

## Testing Manual Realizado ✅

1. ✅ Crear entrevista FAMILY con 2 entrevistadores → Exitoso
2. ✅ Crear entrevista CYCLE_DIRECTOR con 2 entrevistadores → Exitoso
3. ✅ Horarios comunes se muestran correctamente
4. ✅ Fechas se visualizan sin desfase de zona horaria
5. ✅ Validación requiere segundo entrevistador para FAMILY y CYCLE_DIRECTOR
6. ✅ Cambiar tipo de entrevista preserva selección de entrevistadores

---

## Próximo Trabajo

**Tarea:** Mostrar entrevistas creadas en el calendario global

**Estado actual:**
- Las entrevistas se crean correctamente en la BD
- Aparecen en listados y tablas
- **NO aparecen en el calendario global** ← A TRABAJAR

**Archivos a revisar:**
- `/components/interviews/InterviewCalendar.tsx`
- `/components/interviews/EnhancedInterviewCalendar.tsx`
- Servicios de obtención de entrevistas para el calendario

---

## Commits Relevantes (Orden Cronológico)

1. `447651d` - feat(evaluation): add support for second interviewer in interview creation
2. `9db0d2a` - fix(evaluation): make secondInterviewerId optional in interview validation schema
3. `6037f03` - fix(frontend): preserve secondInterviewerId when changing to CYCLE_DIRECTOR interview type
4. `49580d6` - feat(frontend): make CYCLE_DIRECTOR interviews work exactly like FAMILY interviews
5. `3d4373d` - fix(frontend): corregir problema de zona horaria en visualización de fechas
6. `cafe555` - feat(evaluation): add SQL script to update interviews type constraint for CYCLE_DIRECTOR

---

## Contacto y Notas

**Sistema:** Admisión MTN (Colegio Monte Tabor y Nazaret)
**Arquitectura:** Microservicios (Gateway + 6 servicios backend)
**Frontend:** React + TypeScript + Vite (Vercel)
**Backend:** Node.js + Express + PostgreSQL (Railway)

**Nota importante:** Este punto de rollback documenta un estado ESTABLE y FUNCIONANDO del sistema. Todas las funcionalidades mencionadas han sido probadas y están operativas en producción.
