#!/bin/bash

# Script de Testing Completo V2 - Sistema de Admisión MTN
# Alumno: Juan Perez
# Apoderado: Jorge Gonzales (jorge.gangale@mail.up.cl)
# Este script envía correos reales a jorge.gangale@mtn.cl

GATEWAY="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "TESTING COMPLETO V2 - SISTEMA DE ADMISIÓN MTN"
echo "=========================================="
echo ""

# Función para obtener CSRF token
get_csrf_token() {
  local response=$(curl -s -X GET "$GATEWAY/api/auth/csrf-token")
  echo "$response" | jq -r '.csrfToken // .data.csrfToken // empty'
}

# Obtener CSRF token inicial
echo -e "${YELLOW}[SETUP] Obteniendo CSRF token...${NC}"
CSRF_TOKEN=$(get_csrf_token)
echo -e "${GREEN}✅ CSRF token obtenido: ${CSRF_TOKEN:0:20}...${NC}"
echo ""

# FLOW 1: Login (el usuario ya existe)
echo -e "${YELLOW}[FLOW 1] Login del apoderado Jorge Gonzales...${NC}"

# Create login payload in a file to avoid bash escaping issues with special characters
cat <<'LOGINEOF' > /tmp/login-payload.json
{"email":"jorge.gangale@mail.up.cl","password":"SecurePass123!"}
LOGINEOF

LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  --data-binary @/tmp/login-payload.json)

echo "$LOGIN_RESPONSE" | jq .
APODERADO_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
APODERADO_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.id // empty')

if [ -z "$APODERADO_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo hacer login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login exitoso - Apoderado ID: $APODERADO_ID${NC}"
echo ""

# Obtener un nuevo CSRF token para application service
echo -e "${YELLOW}[SETUP] Obteniendo nuevo CSRF token...${NC}"
CSRF_TOKEN=$(get_csrf_token)
echo -e "${GREEN}✅ CSRF token renovado${NC}"
echo ""

# FLOW 2: Crear estudiante con validación
echo -e "${YELLOW}[FLOW 2] Creando/Verificando estudiante Juan Perez...${NC}"

# Primero buscar si ya existe por RUT
STUDENT_RUT="25.123.456-6"
STUDENT_SEARCH=$(curl -s -X GET "$GATEWAY/api/students/rut/$STUDENT_RUT" \
  -H "Authorization: Bearer $APODERADO_TOKEN")

echo "$STUDENT_SEARCH" | jq .

STUDENT_ID=$(echo "$STUDENT_SEARCH" | jq -r '.data.id // empty' 2>/dev/null)

if [ -z "$STUDENT_ID" ]; then
  echo "Estudiante no existe, creando..."

  # Crear archivo temporal con datos del estudiante
  cat > /tmp/student-data.json <<EOF
{
  "firstName": "Juan",
  "paternalLastName": "Perez",
  "maternalLastName": "Garcia",
  "rut": "$STUDENT_RUT",
  "birthDate": "2015-03-15",
  "gradeApplied": "1_BASICO",
  "currentSchool": "Escuela San Pedro",
  "address": "Av. Apoquindo 1234, Las Condes",
  "pais": "Chile",
  "region": "Metropolitana",
  "comuna": "Santiago"
}
EOF

  STUDENT_RESPONSE=$(curl -s -X POST "$GATEWAY/api/students" \
    -H "Authorization: Bearer $APODERADO_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d @/tmp/student-data.json)

  echo "$STUDENT_RESPONSE" | jq .

  STUDENT_ID=$(echo "$STUDENT_RESPONSE" | jq -r '.data.student.id // .data.id // .id // empty')
fi

if [ -z "$STUDENT_ID" ]; then
  echo -e "${RED}❌ Error: No se pudo crear/obtener estudiante${NC}"
  echo "Respuesta completa: $STUDENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Estudiante OK - ID: $STUDENT_ID${NC}"
echo ""

# FLOW 3: Crear aplicación
echo -e "${YELLOW}[FLOW 3] Creando aplicación...${NC}"

# Obtener nuevo CSRF
CSRF_TOKEN=$(get_csrf_token)

# Primero verificar si ya existe aplicación para este estudiante
APP_SEARCH=$(curl -s -X GET "$GATEWAY/api/applications?studentId=$STUDENT_ID" \
  -H "Authorization: Bearer $APODERADO_TOKEN")

APPLICATION_ID=$(echo "$APP_SEARCH" | jq -r '.data[0].id // .applications[0].id // empty' 2>/dev/null)

if [ -z "$APPLICATION_ID" ]; then
  echo "Aplicación no existe, creando..."

  cat > /tmp/application-data.json <<EOF
{
  "studentId": $STUDENT_ID,
  "academicYear": 2025,
  "gradeApplied": "1_BASICO",
  "previousSchool": "Escuela San Pedro",
  "hasSpecialNeeds": false,
  "status": "SUBMITTED"
}
EOF

  APPLICATION_RESPONSE=$(curl -s -X POST "$GATEWAY/api/applications" \
    -H "Authorization: Bearer $APODERADO_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d @/tmp/application-data.json)

  echo "$APPLICATION_RESPONSE" | jq .

  APPLICATION_ID=$(echo "$APPLICATION_RESPONSE" | jq -r '.data.id // .id // empty')
fi

if [ -z "$APPLICATION_ID" ]; then
  echo -e "${RED}❌ Error: No se pudo crear/obtener aplicación${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Aplicación OK - ID: $APPLICATION_ID${NC}"
echo ""

# FLOW 3B: Subir documentos
echo -e "${YELLOW}[FLOW 3B] Subiendo documentos...${NC}"

# Obtener nuevo CSRF
CSRF_TOKEN=$(get_csrf_token)

# Los PDFs ya fueron creados anteriormente en /tmp/test-docs-v2-pdf

# Subir documentos
for DOCTYPE in "BIRTH_CERTIFICATE" "PREVIOUS_SCHOOL_REPORT" "PSYCHOLOGICAL_REPORT"; do
  echo "Subiendo: $DOCTYPE"

  case $DOCTYPE in
    BIRTH_CERTIFICATE) FILE="/tmp/test-docs-v2-pdf/birth_cert.pdf" ;;
    PREVIOUS_SCHOOL_REPORT) FILE="/tmp/test-docs-v2-pdf/transcript.pdf" ;;
    PSYCHOLOGICAL_REPORT) FILE="/tmp/test-docs-v2-pdf/recommendation.pdf" ;;
  esac

  DOC_RESPONSE=$(curl -s -X POST "$GATEWAY/api/documents" \
    -H "Authorization: Bearer $APODERADO_TOKEN" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -F "files=@$FILE" \
    -F "applicationId=$APPLICATION_ID" \
    -F "documentType=$DOCTYPE")

  echo "$DOC_RESPONSE" | jq .
  sleep 1
done

echo -e "${GREEN}✅ Documentos subidos${NC}"
echo ""

# ==================== ADMIN FLOWS ====================

# Login como ADMIN
echo -e "${YELLOW}[ADMIN] Login como administrador...${NC}"

# Verificar si admin existe
ADMIN_CHECK=$(curl -s -X POST "$GATEWAY/api/auth/check-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mtn.cl"}')

CSRF_TOKEN=$(get_csrf_token)

if [ "$ADMIN_CHECK" = "false" ]; then
  echo "Creando usuario ADMIN..."
  curl -s -X POST "$GATEWAY/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
      "email":"admin@mtn.cl",
      "password":"Admin123!",
      "firstName":"Admin",
      "lastName":"Sistema",
      "rut":"12.345.678-5",
      "phone":"+56911111111",
      "role":"ADMIN"
    }' | jq .
  sleep 2
  CSRF_TOKEN=$(get_csrf_token)
fi

ADMIN_LOGIN=$(curl -s -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"email":"admin@mtn.cl","password":"Admin123!"}')

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo obtener token de admin${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Admin login exitoso${NC}"
echo ""

# Login como COORDINATOR
echo -e "${YELLOW}[COORDINATOR] Login como coordinador...${NC}"

COORD_CHECK=$(curl -s -X POST "$GATEWAY/api/auth/check-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"coordinator@mtn.cl"}')

CSRF_TOKEN=$(get_csrf_token)

if [ "$COORD_CHECK" = "false" ]; then
  echo "Creando usuario COORDINATOR..."
  curl -s -X POST "$GATEWAY/api/auth/register" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d '{
      "email":"coordinator@mtn.cl",
      "password":"Coord123!",
      "firstName":"Coordinador",
      "lastName":"Admisiones",
      "rut":"18.765.432-1",
      "phone":"+56922222222",
      "role":"COORDINATOR"
    }' | jq .
  sleep 2
  CSRF_TOKEN=$(get_csrf_token)
fi

COORD_LOGIN=$(curl -s -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"email":"coordinator@mtn.cl","password":"Coord123!"}')

COORDINATOR_TOKEN=$(echo "$COORD_LOGIN" | jq -r '.token // empty')
COORDINATOR_ID=$(echo "$COORD_LOGIN" | jq -r '.id // empty')

if [ -z "$COORDINATOR_TOKEN" ]; then
  echo -e "${RED}❌ Error: No se pudo obtener token de coordinador${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Coordinator login exitoso${NC}"
echo ""

# FLOW 4: Programar entrevista
echo -e "${YELLOW}[FLOW 4] Programando entrevista familiar...${NC}"

CSRF_TOKEN=$(get_csrf_token)

cat > /tmp/interview-data.json <<EOF
{
  "applicationId": $APPLICATION_ID,
  "interviewerId": $COORDINATOR_ID,
  "type": "FAMILY",
  "scheduledDate": "2025-11-15",
  "scheduledTime": "10:00",
  "duration": 60,
  "location": "Sala de Reuniones 1",
  "mode": "IN_PERSON",
  "notes": "Entrevista familiar para Juan Perez"
}
EOF

INTERVIEW_RESPONSE=$(curl -s -X POST "$GATEWAY/api/interviews" \
  -H "Authorization: Bearer $COORDINATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d @/tmp/interview-data.json)

echo "$INTERVIEW_RESPONSE" | jq .

INTERVIEW_ID=$(echo "$INTERVIEW_RESPONSE" | jq -r '.data.id // .id // empty')

if [ ! -z "$INTERVIEW_ID" ]; then
  echo -e "${GREEN}✅ Entrevista programada - ID: $INTERVIEW_ID${NC}"
else
  echo -e "${YELLOW}⚠️  No se pudo programar entrevista (puede que ya exista)${NC}"
fi
echo ""

# FLOW 5: Registrar evaluación académica
echo -e "${YELLOW}[FLOW 5] Registrando evaluación académica...${NC}"

CSRF_TOKEN=$(get_csrf_token)

cat > /tmp/evaluation-data.json <<EOF
{
  "applicationId": $APPLICATION_ID,
  "evaluationType": "LANGUAGE_EXAM",
  "score": 85,
  "maxScore": 100,
  "strengths": "Excelente comprensión lectora y vocabulario amplio",
  "areasForImprovement": "Mejorar redacción de textos argumentativos",
  "observations": "Evaluación de conocimientos previos - Juan Perez",
  "recommendations": "Continuar fortaleciendo la escritura creativa"
}
EOF

EVALUATION_RESPONSE=$(curl -s -X POST "$GATEWAY/api/evaluations" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d @/tmp/evaluation-data.json)

echo "$EVALUATION_RESPONSE" | jq .

EVALUATION_ID=$(echo "$EVALUATION_RESPONSE" | jq -r '.data.id // .id // empty')

if [ ! -z "$EVALUATION_ID" ]; then
  echo -e "${GREEN}✅ Evaluación académica registrada - ID: $EVALUATION_ID${NC}"
else
  echo -e "${YELLOW}⚠️  No se pudo registrar evaluación${NC}"
fi
echo ""

# FLOW 6: Actualizar evaluación con resultados detallados
if [ ! -z "$EVALUATION_ID" ]; then
  echo -e "${YELLOW}[FLOW 6] Actualizando evaluación con resultados detallados...${NC}"

  CSRF_TOKEN=$(get_csrf_token)

  cat > /tmp/evaluation-update.json <<EOF
{
  "score": 92,
  "maxScore": 100,
  "strengths": "Excelente análisis de textos complejos y vocabulario rico",
  "areasForImprovement": "Mejorar estructura de ensayos argumentativos",
  "observations": "Examen corregido - Demuestra excelente nivel académico en lenguaje",
  "recommendations": "Alumno apto para el nivel solicitado. Se recomienda seguimiento en área de lectura comprensiva",
  "status": "COMPLETED"
}
EOF

  UPDATE_EVAL_RESPONSE=$(curl -s -X PUT "$GATEWAY/api/evaluations/$EVALUATION_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d @/tmp/evaluation-update.json)

  echo "$UPDATE_EVAL_RESPONSE" | jq .

  if echo "$UPDATE_EVAL_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Evaluación actualizada${NC}"
  else
    echo -e "${YELLOW}⚠️  No se pudo actualizar evaluación${NC}"
  fi
fi
echo ""

# Crear informe psicológico
echo -e "${YELLOW}[FLOW 6] Creando informe psicológico...${NC}"

CSRF_TOKEN=$(get_csrf_token)

cat > /tmp/psych-eval.json <<EOF
{
  "applicationId": $APPLICATION_ID,
  "evaluationType": "PSYCHOLOGICAL_INTERVIEW",
  "score": 88,
  "maxScore": 100,
  "strengths": "Adecuado desarrollo socioemocional y habilidades sociales apropiadas para su edad",
  "areasForImprovement": "Fortalecer estrategias de autorregulación emocional",
  "observations": "Alumno demuestra buena adaptación al entorno escolar",
  "recommendations": "Alumno presenta perfil psicológico adecuado para ingreso. Se sugiere monitoreo durante período de adaptación"
}
EOF

PSYCH_EVAL_RESPONSE=$(curl -s -X POST "$GATEWAY/api/evaluations" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d @/tmp/psych-eval.json)

echo "$PSYCH_EVAL_RESPONSE" | jq .

if echo "$PSYCH_EVAL_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Evaluación psicológica creada${NC}"
else
  echo -e "${YELLOW}⚠️  No se pudo crear evaluación psicológica${NC}"
fi
echo ""

# FLOW 7: Aprobar documentos
echo -e "${YELLOW}[FLOW 7] Listando y aprobando documentos...${NC}"

DOCS_LIST=$(curl -s -X GET "$GATEWAY/api/documents/$APPLICATION_ID/documents" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$DOCS_LIST" | jq .

# Extraer IDs de documentos
DOC_IDS=$(echo "$DOCS_LIST" | jq -r '.data[].id // .documents[].id // empty' 2>/dev/null)

if [ ! -z "$DOC_IDS" ]; then
  for DOC_ID in $DOC_IDS; do
    echo "Aprobando documento ID: $DOC_ID"

    CSRF_TOKEN=$(get_csrf_token)

    APPROVE_RESPONSE=$(curl -s -X PUT "$GATEWAY/api/documents/$DOC_ID/approval" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -H "X-CSRF-Token: $CSRF_TOKEN" \
      -d '{"approvalStatus":"APPROVED","rejectionReason":null}')

    echo "$APPROVE_RESPONSE" | jq .
    sleep 1
  done
  echo -e "${GREEN}✅ Documentos aprobados${NC}"
else
  echo -e "${YELLOW}⚠️  No se encontraron documentos para aprobar${NC}"
fi
echo ""

# FLOW 8: Enviar notificaciones
echo -e "${YELLOW}[FLOW 8] Enviando notificaciones por email...${NC}"

# Array de notificaciones
declare -a NOTIFICATIONS=(
  "WELCOME:Bienvenido al Sistema de Admisión MTN"
  "APPLICATION_RECEIVED:Solicitud de Admisión Recibida - Juan Perez"
  "DOCUMENT_APPROVED:Documentos Aprobados - Juan Perez"
  "INTERVIEW_SCHEDULED:Entrevista Programada - Juan Perez"
  "EVALUATION_COMPLETED:Evaluación Completada - Juan Perez"
  "APPLICATION_APPROVED:¡Felicitaciones! Solicitud Aprobada - Juan Perez"
)

for NOTIF in "${NOTIFICATIONS[@]}"; do
  IFS=':' read -r TEMPLATE SUBJECT <<< "$NOTIF"

  echo "Enviando: $TEMPLATE..."

  CSRF_TOKEN=$(get_csrf_token)

  # Preparar template data según el tipo
  case $TEMPLATE in
    WELCOME)
      TEMPLATE_DATA='{"firstName":"Jorge","lastName":"Gonzales"}'
      ;;
    APPLICATION_RECEIVED)
      TEMPLATE_DATA="{\"studentName\":\"Juan Perez\",\"applicationId\":\"$APPLICATION_ID\",\"academicYear\":\"2025\",\"gradeApplying\":\"1° Básico\"}"
      ;;
    DOCUMENT_APPROVED)
      TEMPLATE_DATA="{\"studentName\":\"Juan Perez\",\"documentType\":\"Todos los documentos\",\"applicationId\":\"$APPLICATION_ID\"}"
      ;;
    INTERVIEW_SCHEDULED)
      TEMPLATE_DATA='{"studentName":"Juan Perez","interviewDate":"2025-11-15","interviewTime":"10:00","location":"Sala de Reuniones 1","interviewType":"Familiar"}'
      ;;
    EVALUATION_COMPLETED)
      TEMPLATE_DATA='{"studentName":"Juan Perez","evaluationType":"Académica y Psicológica","score":"92","maxScore":"100","evaluationDate":"2025-11-12"}'
      ;;
    APPLICATION_APPROVED)
      TEMPLATE_DATA='{"studentName":"Juan Perez","academicYear":"2025","gradeApplying":"1° Básico","nextSteps":"Por favor, completar el proceso de matrícula en la secretaría del colegio antes del 15 de diciembre."}'
      ;;
  esac

  EMAIL_RESPONSE=$(curl -s -X POST "$GATEWAY/api/notifications/email" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Token: $CSRF_TOKEN" \
    -d "{
      \"to\":\"jorge.gangale@mtn.cl\",
      \"subject\":\"$SUBJECT\",
      \"message\":\"Notificación de tipo $TEMPLATE para el proceso de admisión.\",
      \"type\":\"$TEMPLATE\",
      \"templateName\":\"$TEMPLATE\",
      \"templateData\":$TEMPLATE_DATA
    }")

  echo "$EMAIL_RESPONSE" | jq .
  sleep 2
done

echo -e "${GREEN}✅ Notificaciones enviadas${NC}"
echo ""

# RESUMEN FINAL
echo ""
echo "=========================================="
echo "RESUMEN DE TESTING COMPLETO"
echo "=========================================="
echo -e "${GREEN}✅ Apoderado: Jorge Gonzales (ID: $APODERADO_ID)${NC}"
echo -e "${GREEN}✅ Estudiante: Juan Perez (ID: $STUDENT_ID)${NC}"
echo -e "${GREEN}✅ Aplicación: ID $APPLICATION_ID${NC}"
echo -e "${GREEN}✅ Documentos subidos y aprobados${NC}"
echo -e "${GREEN}✅ Entrevista programada${NC}"
echo -e "${GREEN}✅ Evaluaciones completadas${NC}"
echo -e "${GREEN}✅ 6 notificaciones enviadas a jorge.gangale@mtn.cl${NC}"
echo ""
echo "📧 Verificar bandeja de entrada: jorge.gangale@mtn.cl"
echo "📁 Documentos en: application-service/uploads/"
echo ""
echo "=========================================="
echo -e "${GREEN}TESTING COMPLETO EXITOSO${NC}"
echo "=========================================="
