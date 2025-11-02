#!/bin/bash

# ==============================================================================
# RAILWAY PRIVATE NETWORKING AUDIT SCRIPT
# Sistema de Admisiones MTN
# ==============================================================================

echo "======================================================================"
echo "🔍 RAILWAY PRIVATE NETWORKING AUDIT - Sistema MTN"
echo "======================================================================"
echo ""
echo "Fecha: $(date)"
echo "Script de auditoría completa de configuración Railway"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Función para checks
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED_CHECKS++))
    ((TOTAL_CHECKS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ==============================================================================
# 1. VERIFICAR CONFIGURACIÓN RAILWAY.TOML
# ==============================================================================

section "1. VERIFICACIÓN DE RAILWAY.TOML"

echo "Verificando railway.toml de cada servicio..."
echo ""

# Gateway Service
if [ -f "gateway-service/railway.toml" ]; then
    if grep -q "\[service\]" "gateway-service/railway.toml" && grep -q "internal_port = 8080" "gateway-service/railway.toml"; then
        check_pass "gateway-service: Tiene [service] con internal_port = 8080 (CORRECTO)"
    else
        check_fail "gateway-service: Falta [service] o internal_port = 8080"
    fi
else
    check_fail "gateway-service: railway.toml NO encontrado"
fi

# User Service
if [ -f "user-service/railway.toml" ]; then
    if grep -q "\[service\]" "user-service/railway.toml"; then
        check_warn "user-service: Tiene [service] pero NO debería (solo gateway debe exponerse)"
    else
        check_pass "user-service: NO tiene [service] (CORRECTO)"
    fi
else
    check_fail "user-service: railway.toml NO encontrado"
fi

# Application Service
if [ -f "application-service/railway.toml" ]; then
    if grep -q "\[service\]" "application-service/railway.toml"; then
        check_warn "application-service: Tiene [service] pero NO debería"
    else
        check_pass "application-service: NO tiene [service] (CORRECTO)"
    fi
else
    check_fail "application-service: railway.toml NO encontrado"
fi

# Evaluation Service
if [ -f "evaluation-service/railway.toml" ]; then
    if grep -q "\[service\]" "evaluation-service/railway.toml"; then
        check_warn "evaluation-service: Tiene [service] pero NO debería"
    else
        check_pass "evaluation-service: NO tiene [service] (CORRECTO)"
    fi
else
    check_fail "evaluation-service: railway.toml NO encontrado"
fi

# Notification Service
if [ -f "notification-service/railway.toml" ]; then
    if grep -q "\[service\]" "notification-service/railway.toml"; then
        check_warn "notification-service: Tiene [service] pero NO debería"
    else
        check_pass "notification-service: NO tiene [service] (CORRECTO)"
    fi
else
    check_fail "notification-service: railway.toml NO encontrado"
fi

# Dashboard Service
if [ -f "dashboard-service/railway.toml" ]; then
    if grep -q "\[service\]" "dashboard-service/railway.toml"; then
        check_warn "dashboard-service: Tiene [service] pero NO debería"
    else
        check_pass "dashboard-service: NO tiene [service] (CORRECTO)"
    fi
else
    check_warn "dashboard-service: railway.toml NO encontrado (servicio no desplegado)"
fi

# Guardian Service
if [ -f "guardian-service/railway.toml" ]; then
    if grep -q "\[service\]" "guardian-service/railway.toml"; then
        check_warn "guardian-service: Tiene [service] pero NO debería"
    else
        check_pass "guardian-service: NO tiene [service] (CORRECTO)"
    fi
else
    check_warn "guardian-service: railway.toml NO encontrado (servicio no desplegado)"
fi

# ==============================================================================
# 2. VERIFICAR CONFIGURACIÓN DE PUERTO EN CADA SERVICIO
# ==============================================================================

section "2. VERIFICACIÓN DE CONFIGURACIÓN DE PUERTO"

echo "Verificando que cada servicio escuche en 0.0.0.0:PORT..."
echo ""

# Gateway
if grep -q "listen(PORT, '0.0.0.0'" "gateway-service/src/server.js"; then
    check_pass "gateway-service: Escucha en 0.0.0.0"
elif grep -q "listen(PORT, '::'" "gateway-service/src/server.js"; then
    check_warn "gateway-service: Escucha en :: (IPv6). Recomendado: 0.0.0.0"
else
    check_fail "gateway-service: NO escucha en 0.0.0.0 o ::"
fi

# User
if grep -q "listen(PORT, '0.0.0.0'" "user-service/src/server.js"; then
    check_pass "user-service: Escucha en 0.0.0.0"
elif grep -q "listen(PORT, '::'" "user-service/src/server.js"; then
    check_warn "user-service: Escucha en :: (IPv6). Recomendado: 0.0.0.0"
else
    check_fail "user-service: NO escucha en 0.0.0.0 o ::"
fi

# Application
if grep -q "listen(PORT, '0.0.0.0'" "application-service/src/server.js"; then
    check_pass "application-service: Escucha en 0.0.0.0"
elif grep -q "listen(PORT, '::'" "application-service/src/server.js"; then
    check_warn "application-service: Escucha en :: (IPv6). Recomendado: 0.0.0.0"
else
    check_fail "application-service: NO escucha en 0.0.0.0 o ::"
fi

# Evaluation
if grep -q "listen(PORT, '0.0.0.0'" "evaluation-service/src/server.js"; then
    check_pass "evaluation-service: Escucha en 0.0.0.0"
elif grep -q "listen(PORT, '::'" "evaluation-service/src/server.js"; then
    check_warn "evaluation-service: Escucha en :: (IPv6). Recomendado: 0.0.0.0"
else
    check_fail "evaluation-service: NO escucha en 0.0.0.0 o ::"
fi

# Notification
if grep -q "listen(PORT, '0.0.0.0'" "notification-service/src/server.js"; then
    check_pass "notification-service: Escucha en 0.0.0.0"
elif grep -q "listen(PORT, '::'" "notification-service/src/server.js"; then
    check_warn "notification-service: Escucha en :: (IPv6). Recomendado: 0.0.0.0"
else
    check_fail "notification-service: NO escucha en 0.0.0.0 o ::"
fi

# Guardian
if [ -f "guardian-service/src/server.js" ]; then
    if grep -q "listen(PORT, '0.0.0.0'" "guardian-service/src/server.js"; then
        check_pass "guardian-service: Escucha en 0.0.0.0"
    elif grep -q "listen(PORT, '::'" "guardian-service/src/server.js"; then
        check_warn "guardian-service: Escucha en :: (IPv6). Recomendado: 0.0.0.0"
    else
        check_fail "guardian-service: NO escucha en 0.0.0.0 o ::"
    fi
else
    check_warn "guardian-service: server.js no encontrado"
fi

# ==============================================================================
# 3. VERIFICAR CONFIGURACIÓN DE BASE DE DATOS
# ==============================================================================

section "3. VERIFICACIÓN DE CONFIGURACIÓN DE BASE DE DATOS"

echo "Verificando que todos los servicios usan DATABASE_URL..."
echo ""

services=("user-service" "application-service" "evaluation-service" "notification-service" "guardian-service")

for service in "${services[@]}"; do
    if [ -f "${service}/src/config/database.js" ]; then
        if grep -q "DATABASE_URL" "${service}/src/config/database.js"; then
            check_pass "${service}: Usa DATABASE_URL (prioridad correcta)"
        else
            check_fail "${service}: NO usa DATABASE_URL"
        fi
    else
        check_warn "${service}: database.js no encontrado"
    fi
done

# ==============================================================================
# 4. ANALIZAR GATEWAY SERVICE URLS
# ==============================================================================

section "4. ANÁLISIS DE GATEWAY SERVICE URLS"

echo "Analizando configuración de URLs en gateway-service/src/server.js..."
echo ""

# Extraer configuración SERVICES del gateway
if [ -f "gateway-service/src/server.js" ]; then
    echo "Configuración detectada en el código:"
    echo ""

    # Verificar que usa getServiceUrl()
    if grep -q "getServiceUrl" "gateway-service/src/server.js"; then
        check_pass "Gateway usa función getServiceUrl() para configuración dinámica"
    else
        check_fail "Gateway NO usa getServiceUrl()"
    fi

    # Verificar que tiene validación de producción
    if grep -q "isProductionLike" "gateway-service/src/server.js"; then
        check_pass "Gateway tiene validación de entorno producción"
    else
        check_warn "Gateway NO tiene validación de entorno producción"
    fi

    # Verificar que termina proceso si falta variable en producción
    if grep -q "process.exit(1)" "gateway-service/src/server.js"; then
        check_pass "Gateway termina proceso si falta variable en producción (CORRECTO)"
    else
        check_warn "Gateway NO termina proceso si falta variable en producción"
    fi

    echo ""
    echo "Variables de entorno requeridas en Railway:"
    echo "  - USER_SERVICE_URL"
    echo "  - APPLICATION_SERVICE_URL"
    echo "  - EVALUATION_SERVICE_URL"
    echo "  - NOTIFICATION_SERVICE_URL"
    echo "  - DASHBOARD_SERVICE_URL"
    echo "  - GUARDIAN_SERVICE_URL"
    echo ""

else
    check_fail "gateway-service/src/server.js NO encontrado"
fi

# ==============================================================================
# 5. VERIFICAR FORMATO DE PRIVATE NETWORKING
# ==============================================================================

section "5. RECOMENDACIONES DE PRIVATE NETWORKING"

echo "Formato correcto de URLs para Railway Private Networking:"
echo ""
echo "OPCIÓN 1 (Recomendada): Usar nombre de servicio + puerto"
echo "  USER_SERVICE_URL=http://user-service:8080"
echo "  APPLICATION_SERVICE_URL=http://application-service:8080"
echo "  EVALUATION_SERVICE_URL=http://evaluation-service:8080"
echo "  NOTIFICATION_SERVICE_URL=http://notification-service:8080"
echo "  DASHBOARD_SERVICE_URL=http://dashboard-service:8080"
echo "  GUARDIAN_SERVICE_URL=http://guardian-service:8080"
echo ""
echo "OPCIÓN 2: Usar variable RAILWAY_PRIVATE_DOMAIN"
echo "  USER_SERVICE_URL=http://\${{user-service.RAILWAY_PRIVATE_DOMAIN}}:8080"
echo "  (Railway sustituye automáticamente con el dominio interno)"
echo ""
echo "OPCIÓN 3 (Fallback): Usar URLs públicas (costos de egress)"
echo "  USER_SERVICE_URL=https://user-service-production-xxx.up.railway.app"
echo "  (Usar solo si private networking falla)"
echo ""

check_warn "CRÍTICO: Verificar en Railway que Private Networking esté habilitado"
check_warn "CRÍTICO: Todos los servicios DEBEN estar en el MISMO proyecto Railway"
check_warn "CRÍTICO: Nombres de servicios deben coincidir EXACTAMENTE (case-sensitive)"

# ==============================================================================
# 6. CHECKLIST DE RAILWAY
# ==============================================================================

section "6. CHECKLIST DE RAILWAY (Manual)"

echo "Acciones que debes verificar en Railway Dashboard:"
echo ""
echo "[ ] 1. Railway Project Settings → Private Networking = ENABLED"
echo "[ ] 2. Todos los 7 servicios están en el MISMO proyecto Railway"
echo "[ ] 3. Nombres de servicios coinciden exactamente:"
echo "       - user-service (o user_service, verificar exacto)"
echo "       - application-service"
echo "       - evaluation-service"
echo "       - notification-service"
echo "       - dashboard-service"
echo "       - guardian-service"
echo "       - gateway-service"
echo "[ ] 4. Gateway tiene variables de entorno configuradas:"
echo "       - USER_SERVICE_URL"
echo "       - APPLICATION_SERVICE_URL"
echo "       - EVALUATION_SERVICE_URL"
echo "       - NOTIFICATION_SERVICE_URL"
echo "       - DASHBOARD_SERVICE_URL"
echo "       - GUARDIAN_SERVICE_URL"
echo "[ ] 5. Todas las variables usan formato: http://service-name:8080"
echo "[ ] 6. Gateway tiene domain público generado"
echo "[ ] 7. Backend services NO tienen domain público (solo gateway)"
echo "[ ] 8. DATABASE_URL está configurada y compartida entre servicios"
echo "[ ] 9. JWT_SECRET es idéntico en todos los servicios"
echo "[ ] 10. CSRF_SECRET es idéntico en servicios que usan CSRF"
echo ""

# ==============================================================================
# 7. TESTS DE CONECTIVIDAD (Si tienes URLs)
# ==============================================================================

section "7. TESTS DE CONECTIVIDAD (Opcional)"

echo "Si tus servicios están desplegados, ejecuta estos tests:"
echo ""
echo "# Test 1: Health check del gateway"
echo "curl https://gateway-service-production-a753.up.railway.app/health"
echo ""
echo "# Test 2: Health check de cada servicio (vía gateway)"
echo "curl https://gateway-service-production-a753.up.railway.app/api/users/health"
echo "curl https://gateway-service-production-a753.up.railway.app/api/applications/health"
echo "curl https://gateway-service-production-a753.up.railway.app/api/evaluations/health"
echo "curl https://gateway-service-production-a753.up.railway.app/api/notifications/health"
echo "curl https://gateway-service-production-a753.up.railway.app/api/guardians/health"
echo ""
echo "# Test 3: Verificar logs del gateway en Railway"
echo "Debe mostrar: 'Service URLs configured:' con las URLs correctas"
echo ""

# ==============================================================================
# 8. RESUMEN FINAL
# ==============================================================================

section "8. RESUMEN DE AUDITORÍA"

echo "Total de verificaciones: $TOTAL_CHECKS"
echo -e "${GREEN}Pasadas: $PASSED_CHECKS${NC}"
echo -e "${RED}Fallidas: $FAILED_CHECKS${NC}"
echo -e "${YELLOW}Advertencias: $WARNINGS${NC}"
echo ""

# Determinar estado general
if [ $FAILED_CHECKS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}ESTADO GENERAL: ✓ OK${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}ESTADO GENERAL: ⚠ WARNINGS${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Hay advertencias que debes revisar, pero la configuración base es correcta."
    fi
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}ESTADO GENERAL: ✗ CRITICAL${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Se encontraron errores críticos que debes corregir antes de desplegar."
fi

echo ""
echo "======================================================================"
echo "Auditoría completada: $(date)"
echo "======================================================================"
echo ""
echo "Próximos pasos:"
echo "1. Revisa los errores y advertencias arriba"
echo "2. Completa el checklist de Railway (sección 6)"
echo "3. Configura las variables de entorno en Railway Dashboard"
echo "4. Despliega todos los servicios"
echo "5. Ejecuta los tests de conectividad (sección 7)"
echo ""
