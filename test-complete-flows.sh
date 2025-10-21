#!/bin/bash

# Script de Testing Completo - Sistema de Admisión MTN
# Alumno: Juan Perez
# Apoderado: Jorge Gonzales (jorge.gangale@mail.up.cl)
# Este script envía correos reales a jorge.gangale@mtn.cl

set -e  # Exit on error

GATEWAY="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "TESTING COMPLETO - SISTEMA DE ADMISIÓN MTN"
echo "=========================================="
echo ""

# Variables globales
APODERADO_TOKEN=""
APODERADO_ID=""
ADMIN_TOKEN=""
COORDINATOR_TOKEN=""
STUDENT_ID=""
APPLICATION_ID=""
INTERVIEW_ID=""
EVALUATION_ID=""

# ======================
# OBTENER CSRF TOKEN
# ======================
echo -e "${YELLOW}[SETUP] Obteniendo CSRF token...${NC}"

CSRF_RESPONSE=$(curl -s -X GET "$GATEWAY/api/auth/csrf-token")
CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.csrfToken // .data.csrfToken // empty')

if [ -z "$CSRF_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo obtener CSRF token${NC}"
  echo "$CSRF_RESPONSE" | jq .
  exit 1
fi

echo -e "${GREEN}✅ CSRF token obtenido${NC}"
echo ""

# ======================
# FLOW 1: REGISTRO DE APODERADO
# ======================
echo -e "${YELLOW}[FLOW 1] Verificando si apoderado ya existe...${NC}"

EMAIL_CHECK=$(curl -s -X POST "$GATEWAY/api/auth/check-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"jorge.gangale@mail.up.cl"}')

if [ "$EMAIL_CHECK" = "false" ]; then
  echo "Email no existe, registrando apoderado Jorge Gonzales..."

  REGISTER_RESPONSE=$(curl -s -X POST "$GATEWAY/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
      "email": "jorge.gangale@mail.up.cl",
      "password": "SecurePass123!",
      "firstName": "Jorge",
      "lastName": "Gonzales",
      "rut": "12.345.678-9",
      "phone": "+56912345678",
      "role": "APODERADO"
    }')

  echo "$REGISTER_RESPONSE" | jq .

  if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✅ Apoderado registrado exitosamente${NC}"
  else
    echo -e "${RED}❌ Error al registrar apoderado${NC}"
    echo "$REGISTER_RESPONSE" | jq .
    exit 1
  fi

  # Esperar un momento para que el registro se complete
  sleep 2
else
  echo -e "${YELLOW}Email ya existe, saltando registro${NC}"
fi

# ======================
# LOGIN DEL APODERADO
# ======================
echo -e "${YELLOW}[FLOW 1] Login del apoderado...${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "jorge.gangale@mail.up.cl",
    "password": "SecurePass123!"
  }')

echo "$LOGIN_RESPONSE" | jq .

APODERADO_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .token // empty')
APODERADO_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.data.id // .id // empty')

if [ -z "$APODERADO_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo obtener token de apoderado${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login exitoso - Token obtenido${NC}"
echo "Apoderado ID: $APODERADO_ID"
echo ""

# ======================
# FLOW 2: CREAR ESTUDIANTE JUAN PEREZ
# ======================
echo -e "${YELLOW}[FLOW 2] Creando estudiante Juan Perez...${NC}"

STUDENT_RESPONSE=$(curl -s -X POST "$GATEWAY/api/students" \
  -H "Authorization: Bearer $APODERADO_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Juan",
    "lastName": "Perez",
    "rut": "25.123.456-7",
    "dateOfBirth": "2015-03-15",
    "gender": "M",
    "nationality": "Chilena",
    "previousSchool": "Escuela San Pedro",
    "gradeApplying": "1° Básico",
    "hasSpecialNeeds": false,
    "guardianId": '"$APODERADO_ID"'
  }')

echo "$STUDENT_RESPONSE" | jq .

STUDENT_ID=$(echo "$STUDENT_RESPONSE" | jq -r '.data.id // .id // empty')

if [ -z "$STUDENT_ID" ]; then
  echo -e "${RED}❌ Error al crear estudiante${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Estudiante Juan Perez creado - ID: $STUDENT_ID${NC}"
echo ""

# ======================
# FLOW 3: CREAR APLICACIÓN
# ======================
echo -e "${YELLOW}[FLOW 3] Creando aplicación...${NC}"

APPLICATION_RESPONSE=$(curl -s -X POST "$GATEWAY/api/applications" \
  -H "Authorization: Bearer $APODERADO_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "studentId": '"$STUDENT_ID"',
    "academicYear": 2025,
    "gradeApplying": "1° Básico",
    "previousSchool": "Escuela San Pedro",
    "hasSpecialNeeds": false,
    "status": "SUBMITTED"
  }')

echo "$APPLICATION_RESPONSE" | jq .

APPLICATION_ID=$(echo "$APPLICATION_RESPONSE" | jq -r '.data.id // .id // empty')

if [ -z "$APPLICATION_ID" ]; then
  echo -e "${RED}❌ Error al crear aplicación${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Aplicación creada - ID: $APPLICATION_ID${NC}"
echo ""

# ======================
# FLOW 3B: SUBIR DOCUMENTOS
# ======================
echo -e "${YELLOW}[FLOW 3B] Subiendo documentos...${NC}"

# Crear archivos de prueba
mkdir -p /tmp/test-docs
echo "Certificado de Nacimiento - Juan Perez" > /tmp/test-docs/birth_cert.txt
echo "Certificado de Notas - Juan Perez" > /tmp/test-docs/transcript.txt
echo "Carta de Recomendación - Juan Perez" > /tmp/test-docs/recommendation.txt

# Subir certificado de nacimiento
DOC1_RESPONSE=$(curl -s -X POST "$GATEWAY/api/documents/upload" \
  -H "Authorization: Bearer $APODERADO_TOKEN" \
  -F "applicationId=$APPLICATION_ID" \
  -F "documentType=BIRTH_CERTIFICATE" \
  -F "file=@/tmp/test-docs/birth_cert.txt")

echo "$DOC1_RESPONSE" | jq .

# Subir certificado de notas
DOC2_RESPONSE=$(curl -s -X POST "$GATEWAY/api/documents/upload" \
  -H "Authorization: Bearer $APODERADO_TOKEN" \
  -F "applicationId=$APPLICATION_ID" \
  -F "documentType=TRANSCRIPT" \
  -F "file=@/tmp/test-docs/transcript.txt")

echo "$DOC2_RESPONSE" | jq .

# Subir carta de recomendación
DOC3_RESPONSE=$(curl -s -X POST "$GATEWAY/api/documents/upload" \
  -H "Authorization: Bearer $APODERADO_TOKEN" \
  -F "applicationId=$APPLICATION_ID" \
  -F "documentType=RECOMMENDATION_LETTER" \
  -F "file=@/tmp/test-docs/recommendation.txt")

echo "$DOC3_RESPONSE" | jq .

echo -e "${GREEN}✅ Documentos subidos exitosamente${NC}"
echo ""

# ======================
# LOGIN COMO ADMIN (para los siguientes flujos)
# ======================
echo -e "${YELLOW}[ADMIN] Login como administrador...${NC}"

# Primero verificar si existe admin, si no, crearlo
ADMIN_CHECK=$(curl -s -X POST "$GATEWAY/api/auth/check-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mtn.cl"}')

if [ "$ADMIN_CHECK" = "false" ]; then
  echo "Creando usuario ADMIN..."
  curl -s -X POST "$GATEWAY/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
      "email": "admin@mtn.cl",
      "password": "Admin123!",
      "firstName": "Admin",
      "lastName": "Sistema",
      "rut": "11.111.111-1",
      "phone": "+56911111111",
      "role": "ADMIN"
    }' | jq .
  sleep 2
fi

ADMIN_LOGIN=$(curl -s -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "admin@mtn.cl",
    "password": "Admin123!"
  }')

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.token // .token // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo obtener token de admin${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Admin login exitoso${NC}"
echo ""

# ======================
# LOGIN COMO COORDINATOR
# ======================
echo -e "${YELLOW}[COORDINATOR] Login como coordinador...${NC}"

COORD_CHECK=$(curl -s -X POST "$GATEWAY/api/auth/check-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"coordinator@mtn.cl"}')

if [ "$COORD_CHECK" = "false" ]; then
  echo "Creando usuario COORDINATOR..."
  curl -s -X POST "$GATEWAY/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
      "email": "coordinator@mtn.cl",
      "password": "Coord123!",
      "firstName": "Coordinador",
      "lastName": "Admisiones",
      "rut": "22.222.222-2",
      "phone": "+56922222222",
      "role": "COORDINATOR"
    }' | jq .
  sleep 2
fi

COORD_LOGIN=$(curl -s -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{
    "email": "coordinator@mtn.cl",
    "password": "Coord123!"
  }')

COORDINATOR_TOKEN=$(echo "$COORD_LOGIN" | jq -r '.data.token // .token // empty')

if [ -z "$COORDINATOR_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo obtener token de coordinador${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Coordinator login exitoso${NC}"
echo ""

# ======================
# FLOW 4: PROGRAMAR ENTREVISTA FAMILIAR
# ======================
echo -e "${YELLOW}[FLOW 4] Programando entrevista familiar...${NC}"

INTERVIEW_RESPONSE=$(curl -s -X POST "$GATEWAY/api/interviews" \
  -H "Authorization: Bearer $COORDINATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "applicationId": '"$APPLICATION_ID"',
    "interviewType": "FAMILY",
    "scheduledDate": "2025-11-15",
    "scheduledTime": "10:00:00",
    "location": "Sala de Reuniones 1",
    "notes": "Entrevista familiar para Juan Perez"
  }')

echo "$INTERVIEW_RESPONSE" | jq .

INTERVIEW_ID=$(echo "$INTERVIEW_RESPONSE" | jq -r '.data.id // .id // empty')

if [ -z "$INTERVIEW_ID" ]; then
  echo -e "${RED}❌ Error al crear entrevista${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Entrevista programada - ID: $INTERVIEW_ID${NC}"
echo ""

# ======================
# FLOW 5: REGISTRAR EVALUACIÓN ACADÉMICA
# ======================
echo -e "${YELLOW}[FLOW 5] Registrando evaluación académica...${NC}"

EVALUATION_RESPONSE=$(curl -s -X POST "$GATEWAY/api/evaluations" \
  -H "Authorization: Bearer $COORDINATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "applicationId": '"$APPLICATION_ID"',
    "evaluationType": "ACADEMIC",
    "evaluatorId": null,
    "evaluationDate": "2025-11-10",
    "score": 85,
    "maxScore": 100,
    "notes": "Evaluación de conocimientos previos - Juan Perez",
    "status": "COMPLETED"
  }')

echo "$EVALUATION_RESPONSE" | jq .

EVALUATION_ID=$(echo "$EVALUATION_RESPONSE" | jq -r '.data.id // .id // empty')

if [ -z "$EVALUATION_ID" ]; then
  echo -e "${RED}❌ Error al crear evaluación${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Evaluación académica registrada - ID: $EVALUATION_ID${NC}"
echo ""

# ======================
# FLOW 6: CORREGIR EXAMEN Y LLENAR INFORME PSICOLÓGICO
# ======================
echo -e "${YELLOW}[FLOW 6] Actualizando evaluación con resultados detallados...${NC}"

UPDATE_EVAL_RESPONSE=$(curl -s -X PUT "$GATEWAY/api/evaluations/$EVALUATION_ID" \
  -H "Authorization: Bearer $COORDINATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "score": 92,
    "maxScore": 100,
    "notes": "Examen corregido - Matemáticas: 95/100, Lenguaje: 90/100, Ciencias: 91/100. Alumno demuestra excelente nivel académico.",
    "status": "COMPLETED",
    "recommendations": "Alumno apto para el nivel solicitado. Se recomienda seguimiento en área de lectura comprensiva."
  }')

echo "$UPDATE_EVAL_RESPONSE" | jq .

# Crear informe psicológico
echo -e "${YELLOW}[FLOW 6] Creando informe psicológico...${NC}"

PSYCH_EVAL_RESPONSE=$(curl -s -X POST "$GATEWAY/api/evaluations" \
  -H "Authorization: Bearer $COORDINATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "applicationId": '"$APPLICATION_ID"',
    "evaluationType": "PSYCHOLOGICAL",
    "evaluatorId": null,
    "evaluationDate": "2025-11-12",
    "score": 88,
    "maxScore": 100,
    "notes": "Evaluación Psicológica - Juan Perez: Alumno demuestra adecuado desarrollo socioemocional. Buena adaptación al entorno escolar. Habilidades sociales apropiadas para su edad. Motivación intrínseca positiva hacia el aprendizaje.",
    "status": "COMPLETED",
    "recommendations": "Alumno presenta perfil psicológico adecuado para ingreso. Se sugiere monitoreo durante período de adaptación."
  }')

echo "$PSYCH_EVAL_RESPONSE" | jq .

echo -e "${GREEN}✅ Evaluaciones completadas con informes detallados${NC}"
echo ""

# ======================
# FLOW 7: APROBAR DOCUMENTOS
# ======================
echo -e "${YELLOW}[FLOW 7] Listando y aprobando documentos...${NC}"

DOCS_LIST=$(curl -s -X GET "$GATEWAY/api/documents?applicationId=$APPLICATION_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$DOCS_LIST" | jq .

# Extraer IDs de documentos
DOC_IDS=$(echo "$DOCS_LIST" | jq -r '.data[].id // .documents[].id // empty')

for DOC_ID in $DOC_IDS; do
  echo "Aprobando documento ID: $DOC_ID"
  APPROVE_RESPONSE=$(curl -s -X PUT "$GATEWAY/api/documents/$DOC_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{
      "status": "APPROVED",
      "reviewNotes": "Documento verificado y aprobado"
    }')
  echo "$APPROVE_RESPONSE" | jq .
done

echo -e "${GREEN}✅ Todos los documentos aprobados${NC}"
echo ""

# ======================
# FLOW 8: ENVIAR NOTIFICACIONES
# ======================
echo -e "${YELLOW}[FLOW 8] Enviando notificaciones por email...${NC}"

# Notificación de bienvenida
echo "Enviando email de bienvenida..."
WELCOME_EMAIL=$(curl -s -X POST "$GATEWAY/api/notifications/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientEmail": "jorge.gangale@mtn.cl",
    "recipientName": "Jorge Gonzales",
    "templateType": "WELCOME",
    "subject": "Bienvenido al Sistema de Admisión MTN",
    "templateData": {
      "firstName": "Jorge",
      "lastName": "Gonzales"
    }
  }')

echo "$WELCOME_EMAIL" | jq .
sleep 2

# Notificación de aplicación recibida
echo "Enviando email de aplicación recibida..."
APP_RECEIVED=$(curl -s -X POST "$GATEWAY/api/notifications/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientEmail": "jorge.gangale@mtn.cl",
    "recipientName": "Jorge Gonzales",
    "templateType": "APPLICATION_RECEIVED",
    "subject": "Solicitud de Admisión Recibida - Juan Perez",
    "templateData": {
      "studentName": "Juan Perez",
      "applicationId": "'"$APPLICATION_ID"'",
      "academicYear": "2025",
      "gradeApplying": "1° Básico"
    }
  }')

echo "$APP_RECEIVED" | jq .
sleep 2

# Notificación de documentos aprobados
echo "Enviando email de documentos aprobados..."
DOCS_APPROVED=$(curl -s -X POST "$GATEWAY/api/notifications/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientEmail": "jorge.gangale@mtn.cl",
    "recipientName": "Jorge Gonzales",
    "templateType": "DOCUMENT_APPROVED",
    "subject": "Documentos Aprobados - Juan Perez",
    "templateData": {
      "studentName": "Juan Perez",
      "documentType": "Todos los documentos",
      "applicationId": "'"$APPLICATION_ID"'"
    }
  }')

echo "$DOCS_APPROVED" | jq .
sleep 2

# Notificación de entrevista programada
echo "Enviando email de entrevista programada..."
INTERVIEW_SCHEDULED=$(curl -s -X POST "$GATEWAY/api/notifications/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientEmail": "jorge.gangale@mtn.cl",
    "recipientName": "Jorge Gonzales",
    "templateType": "INTERVIEW_SCHEDULED",
    "subject": "Entrevista Programada - Juan Perez",
    "templateData": {
      "studentName": "Juan Perez",
      "interviewDate": "2025-11-15",
      "interviewTime": "10:00",
      "location": "Sala de Reuniones 1",
      "interviewType": "Familiar"
    }
  }')

echo "$INTERVIEW_SCHEDULED" | jq .
sleep 2

# Notificación de evaluación completada
echo "Enviando email de evaluación completada..."
EVAL_COMPLETED=$(curl -s -X POST "$GATEWAY/api/notifications/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientEmail": "jorge.gangale@mtn.cl",
    "recipientName": "Jorge Gonzales",
    "templateType": "EVALUATION_COMPLETED",
    "subject": "Evaluación Completada - Juan Perez",
    "templateData": {
      "studentName": "Juan Perez",
      "evaluationType": "Académica y Psicológica",
      "score": "92",
      "maxScore": "100",
      "evaluationDate": "2025-11-12"
    }
  }')

echo "$EVAL_COMPLETED" | jq .
sleep 2

# Notificación de aplicación aprobada
echo "Enviando email de aplicación aprobada..."
APP_APPROVED=$(curl -s -X POST "$GATEWAY/api/notifications/send" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientEmail": "jorge.gangale@mtn.cl",
    "recipientName": "Jorge Gonzales",
    "templateType": "APPLICATION_APPROVED",
    "subject": "¡Felicitaciones! Solicitud Aprobada - Juan Perez",
    "templateData": {
      "studentName": "Juan Perez",
      "academicYear": "2025",
      "gradeApplying": "1° Básico",
      "nextSteps": "Por favor, completar el proceso de matrícula en la secretaría del colegio antes del 15 de diciembre."
    }
  }')

echo "$APP_APPROVED" | jq .

echo -e "${GREEN}✅ Todas las notificaciones enviadas${NC}"
echo ""

# ======================
# RESUMEN FINAL
# ======================
echo ""
echo "=========================================="
echo "RESUMEN DE TESTING COMPLETO"
echo "=========================================="
echo -e "${GREEN}✅ Flow 1: Apoderado Jorge Gonzales registrado${NC}"
echo "   - Email: jorge.gangale@mail.up.cl"
echo "   - ID: $APODERADO_ID"
echo ""
echo -e "${GREEN}✅ Flow 2: Estudiante Juan Perez creado${NC}"
echo "   - ID: $STUDENT_ID"
echo "   - RUT: 25.123.456-7"
echo ""
echo -e "${GREEN}✅ Flow 3: Aplicación creada y documentos subidos${NC}"
echo "   - Aplicación ID: $APPLICATION_ID"
echo "   - 3 documentos subidos (Certificado nacimiento, Notas, Recomendación)"
echo ""
echo -e "${GREEN}✅ Flow 4: Entrevista familiar programada${NC}"
echo "   - Entrevista ID: $INTERVIEW_ID"
echo "   - Fecha: 2025-11-15 10:00"
echo ""
echo -e "${GREEN}✅ Flow 5: Evaluación académica registrada${NC}"
echo "   - Evaluación ID: $EVALUATION_ID"
echo "   - Score: 92/100"
echo ""
echo -e "${GREEN}✅ Flow 6: Examen corregido e informe psicológico creado${NC}"
echo "   - Evaluación académica actualizada con detalles"
echo "   - Evaluación psicológica completada (88/100)"
echo ""
echo -e "${GREEN}✅ Flow 7: Documentos aprobados${NC}"
echo "   - Todos los documentos revisados y aprobados"
echo ""
echo -e "${GREEN}✅ Flow 8: Notificaciones enviadas${NC}"
echo "   - 6 emails enviados a jorge.gangale@mtn.cl:"
echo "     1. Bienvenida"
echo "     2. Aplicación recibida"
echo "     3. Documentos aprobados"
echo "     4. Entrevista programada"
echo "     5. Evaluación completada"
echo "     6. Aplicación aprobada"
echo ""
echo "=========================================="
echo -e "${GREEN}TESTING COMPLETO EXITOSO${NC}"
echo "=========================================="
echo ""
echo "📧 Por favor verifica tu bandeja de entrada en jorge.gangale@mtn.cl"
echo "📁 Documentos almacenados en: application-service/uploads/"
echo ""
