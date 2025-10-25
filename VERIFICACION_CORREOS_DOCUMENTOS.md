# ✅ Verificación: Correos de Documentos vs Correos de Cambio de Estado

## 📋 RESUMEN

Hay **2 funcionalidades diferentes** de envío de correos en el sistema:

### 1️⃣ **Revisión de Documentos** (YA EXISTÍA - Funcionando)
### 2️⃣ **Cambio de Estado** (RECIÉN IMPLEMENTADO)

---

## 1️⃣ REVISIÓN DE DOCUMENTOS

### Backend: `/api/institutional-emails/document-review/:applicationId`

**Ubicación**: `/notification-service/src/routes/institutionalEmailRoutes.js` (líneas 9-170)

**Estado**: ✅ **YA IMPLEMENTADO** (desde antes)

**Cuándo se envía**:
- Cuando el admin/coordinator revisa documentos
- Aprueba o rechaza documentos específicos

**Entrada esperada**:
```json
{
  "approvedDocuments": ["Certificado de Nacimiento", "Notas 2024"],
  "rejectedDocuments": ["Foto del Estudiante"],
  "allApproved": false
}
```

**Plantillas de correo** (3 variantes):

#### a) Todos Aprobados
```
Asunto: ✅ Documentos Aprobados - Colegio MTN

Estimado/a Jorge Gangale,

Nos complace informarle que todos los documentos de su postulación
han sido revisados y aprobados.

📋 Documentos Aprobados:
✓ Certificado de Nacimiento
✓ Notas 2024
✓ Foto del Estudiante

Puede continuar con el siguiente paso del proceso de admisión.
```

#### b) Algunos Aprobados, Algunos Rechazados
```
Asunto: ⚠️ Revisión de Documentos - Acción Requerida - Colegio MTN

Estimado/a Jorge Gangale,

Hemos revisado los documentos de su postulación. Algunos documentos
han sido aprobados, pero otros requieren ser actualizados.

✅ Documentos Aprobados:
✓ Certificado de Nacimiento
✓ Notas 2024

❌ Documentos Rechazados (requieren actualización):
✗ Foto del Estudiante

Por favor, ingrese al sistema y vuelva a subir los documentos
rechazados con las correcciones necesarias.
```

#### c) Solo Rechazados
```
Asunto: ❌ Documentos Requieren Actualización - Colegio MTN

Estimado/a Jorge Gangale,

Hemos revisado los documentos de su postulación y algunos
requieren ser actualizados.

❌ Documentos Rechazados (requieren actualización):
✗ Foto del Estudiante
✗ Certificado de Bautismo

Por favor, ingrese al sistema y vuelva a subir estos documentos
con las correcciones necesarias.
```

---

## 2️⃣ CAMBIO DE ESTADO DE POSTULACIÓN

### Backend: `/api/institutional-emails/status-update/:applicationId`

**Ubicación**: `/notification-service/src/routes/institutionalEmailRoutes.js` (líneas 217-469)

**Estado**: ✅ **RECIÉN IMPLEMENTADO** (hoy)

**Cuándo se envía**:
- Cuando el admin/coordinator cambia el estado de una postulación
- Se llama automáticamente desde `ApplicationService.updateApplicationStatus()`

**Entrada esperada**:
```json
{
  "newStatus": "APPROVED",
  "notes": "Excelente desempeño en evaluaciones"
}
```

**Plantillas de correo** (7 estados):

#### Estado: SUBMITTED
```
Asunto: ✅ Postulación Recibida - Colegio MTN

Estimado/a Jorge Gangale,

Hemos recibido exitosamente la postulación de María González.

📋 Estado Actual: Postulación Recibida

Nuestro equipo de admisiones revisará la documentación y nos
pondremos en contacto con usted para los siguientes pasos del proceso.
```

#### Estado: UNDER_REVIEW
```
Asunto: 🔍 Postulación en Revisión - Colegio MTN

Estimado/a Jorge Gangale,

La postulación de María González se encuentra actualmente en
proceso de revisión.

📋 Estado Actual: En Revisión

Nuestro equipo está evaluando la documentación presentada.
Le notificaremos sobre cualquier actualización o requerimiento adicional.
```

#### Estado: INTERVIEW_SCHEDULED
```
Asunto: 📅 Entrevista Programada - Colegio MTN

Estimado/a Jorge Gangale,

Nos complace informarle que hemos programado una entrevista para
la postulación de María González.

📋 Estado Actual: Entrevista Programada

Recibirá próximamente los detalles de fecha, hora y lugar de la entrevista.
```

#### Estado: APPROVED
```
Asunto: 🎉 ¡Postulación Aprobada! - Colegio MTN

Estimado/a Jorge Gangale,

¡Tenemos excelentes noticias! La postulación de María González
ha sido APROBADA.

📋 Estado Actual: Aprobada

Felicitaciones por este logro. Próximamente recibirá información
sobre los siguientes pasos para formalizar la matrícula.

¡Bienvenidos a la familia MTN!
```

#### Estado: REJECTED
```
Asunto: Resultado de Postulación - Colegio MTN

Estimado/a Jorge Gangale,

Lamentamos informarle que, tras evaluar la postulación de
María González, no ha sido posible aprobarla en esta oportunidad.

📋 Estado Actual: No Aprobada

Esta decisión se basa en diversos criterios del proceso de admisión.
Agradecemos sinceramente su interés en nuestro colegio.
```

#### Estado: WAITLIST
```
Asunto: ⏳ Postulación en Lista de Espera - Colegio MTN

Estimado/a Jorge Gangale,

La postulación de María González ha sido incluida en nuestra
lista de espera.

📋 Estado Actual: Lista de Espera

Esto significa que su postulación cumple con nuestros requisitos,
pero actualmente no contamos con cupos disponibles.
```

#### Estado: ARCHIVED
```
Asunto: 📁 Postulación Archivada - Colegio MTN

Estimado/a Jorge Gangale,

La postulación de María González ha sido archivada.

📋 Estado Actual: Archivada
```

---

## 🔄 FLUJO COMPLETO EN EL FRONTEND

### Dashboard Admin → Gestión de Postulantes → Información Detallada

```
┌──────────────────────────────────────────────────────────────┐
│ 1. CAMBIO DE ESTADO (ApplicationStatusChanger.tsx)          │
│    - Usuario cambia estado                                   │
│    - Frontend: applicationService.updateApplicationStatus()  │
│    - Backend: ApplicationService.updateApplicationStatus()   │
│    - Backend: llama a notification-service/status-update     │
│    - ✉️ CORREO DE CAMBIO DE ESTADO                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 2. REVISIÓN DE DOCUMENTOS (???)                              │
│    - Usuario aprueba/rechaza documentos                      │
│    - Frontend: ??? (COMPONENTE A IDENTIFICAR)                │
│    - Backend: ??? (ENDPOINT A IDENTIFICAR)                   │
│    - Backend: llama a notification-service/document-review   │
│    - ✉️ CORREO DE REVISIÓN DE DOCUMENTOS                    │
└──────────────────────────────────────────────────────────────┘
```

---

## ❓ PREGUNTA: ¿DÓNDE ESTÁ EL COMPONENTE DE REVISIÓN DE DOCUMENTOS?

Necesito encontrar:

### En el Frontend:
1. ¿Qué componente muestra la información detallada del estudiante con documentos?
2. ¿Dónde está el botón "Enviar notificación al apoderado" o "Aprobar/Rechazar documentos"?
3. ¿Qué función se llama cuando se aprueba/rechaza un documento?

### En el Backend:
1. ¿Existe un endpoint en `application-service` que llame a `/document-review`?
2. ¿O se llama directamente desde el frontend?

---

## 🔍 BÚSQUEDA NECESARIA

Para verificar la concordancia, necesito:

### Frontend:
```bash
# Buscar componente que muestre documentos y permita aprobar/rechazar
grep -r "approveDocument\|rejectDocument\|document.*review" src/components/
grep -r "institutional-emails/document-review" src/
grep -r "Enviar notificación\|Aprobar documento" src/components/
```

### Backend:
```bash
# Buscar llamadas al endpoint de document-review
grep -r "institutional-emails/document-review" application-service/
grep -r "document-review" application-service/src/services/
```

---

## ✅ CONCLUSIÓN ACTUAL

### LO QUE FUNCIONA:

1. **Cambio de Estado** ✅
   - Frontend: `ApplicationStatusChanger.tsx`
   - Backend: `ApplicationService.updateApplicationStatus()`
   - Notification: `/api/institutional-emails/status-update`
   - **IMPLEMENTADO HOY** - Listo para usar

2. **Revisión de Documentos** ✅ (parcial)
   - Notification: `/api/institutional-emails/document-review`
   - **YA EXISTÍA** - Endpoint disponible
   - ❓ **FALTA**: Componente frontend que lo use

---

## 🎯 PRÓXIMOS PASOS

1. **Identificar el componente frontend** que maneja la revisión de documentos
2. **Verificar si ese componente llama** al endpoint `/document-review`
3. **Si no lo hace**, implementar la integración
4. **Probar el flujo completo** en producción

---

## 📝 INFORMACIÓN ADICIONAL NECESARIA

**Pregunta para el usuario**:

> En el Dashboard de Admin → Gestión de Postulantes → Información Detallada del Estudiante → Documentos:
>
> 1. ¿Cómo se aprueba/rechaza un documento actualmente?
> 2. ¿Hay un botón "Enviar notificación al apoderado"?
> 3. ¿O se envía el correo automáticamente al aprobar/rechazar?
> 4. ¿Qué nombre tiene ese componente/modal?

---

**Fin del documento**
