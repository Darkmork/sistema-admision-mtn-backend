#!/bin/bash

# ==============================================================================
# RAILWAY CONNECTIVITY TEST SCRIPT
# Sistema de Admisiones MTN
# ==============================================================================

echo "======================================================================"
echo "🧪 RAILWAY CONNECTIVITY TESTS - Sistema MTN"
echo "======================================================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# URLs base (actualizar según tu deployment)
GATEWAY_URL="https://gateway-service-production-a753.up.railway.app"

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Función para tests
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local method="${4:-GET}"
    local data="$5"

    ((TOTAL_TESTS++))

    echo -n "Testing $name... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED_TESTS++))

        # Mostrar respuesta si es JSON y corta
        if [ ${#body} -lt 500 ]; then
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_status)"
        ((FAILED_TESTS++))
        echo "Response: $body"
    fi

    echo ""
}

# ==============================================================================
# TEST SUITE
# ==============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. GATEWAY HEALTH CHECKS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Gateway /health" "$GATEWAY_URL/health" "200"
test_endpoint "Gateway /ready" "$GATEWAY_URL/ready" "200"
test_endpoint "Gateway /gateway/status" "$GATEWAY_URL/gateway/status" "200"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. BACKEND SERVICE HEALTH CHECKS (VIA GATEWAY)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "NOTE: These tests verify Private Networking connectivity."
echo "Expected: 200 OK (NOT 502 Bad Gateway, NOT 504 Timeout)"
echo ""

# User Service
echo "--- User Service ---"
test_endpoint "User Service Health" "$GATEWAY_URL/api/users/health" "200"

# Application Service
echo "--- Application Service ---"
test_endpoint "Application Service Health" "$GATEWAY_URL/api/applications/health" "200"

# Evaluation Service
echo "--- Evaluation Service ---"
test_endpoint "Evaluation Service Health" "$GATEWAY_URL/api/evaluations/health" "200"

# Notification Service
echo "--- Notification Service ---"
test_endpoint "Notification Service Health" "$GATEWAY_URL/api/notifications/health" "200"

# Guardian Service (if deployed)
echo "--- Guardian Service ---"
test_endpoint "Guardian Service Health" "$GATEWAY_URL/api/guardians/health" "200"

# Dashboard Service (if deployed)
echo "--- Dashboard Service ---"
test_endpoint "Dashboard Service Health" "$GATEWAY_URL/api/dashboard/health" "200"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. PUBLIC ENDPOINTS (NO AUTH REQUIRED)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "Get CSRF Token" "$GATEWAY_URL/api/auth/csrf-token" "200"
test_endpoint "Check Email Endpoint" "$GATEWAY_URL/api/auth/check-email" "200" "POST" '{"email":"test@example.com"}'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. ERROR HANDLING TESTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_endpoint "404 Not Found" "$GATEWAY_URL/api/nonexistent" "404"
test_endpoint "Unauthorized Access" "$GATEWAY_URL/api/users" "401"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. CORS HEADERS TEST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -n "Testing CORS headers... "
cors_headers=$(curl -s -I -X OPTIONS \
  -H "Origin: https://admision-mtn-front.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  "$GATEWAY_URL/api/auth/login" | grep -i "access-control")

if [ -n "$cors_headers" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    echo "$cors_headers"
else
    echo -e "${RED}✗ FAIL${NC} (No CORS headers found)"
fi

echo ""

# ==============================================================================
# RESULTS
# ==============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}ALL TESTS PASSED ✓${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Private Networking is working correctly!"
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}SOME TESTS FAILED ✗${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo ""
    echo "1. Check Railway logs:"
    echo "   Railway Dashboard → gateway-service → Logs"
    echo "   Search for: 'Service URLs configured:'"
    echo ""
    echo "2. Verify Private Networking is enabled:"
    echo "   Railway Dashboard → Project Settings → Networking"
    echo ""
    echo "3. Verify service environment variables:"
    echo "   Railway Dashboard → gateway-service → Variables"
    echo "   Check: USER_SERVICE_URL, APPLICATION_SERVICE_URL, etc."
    echo ""
    echo "4. Check backend service logs:"
    echo "   Railway Dashboard → <service> → Logs"
    echo "   Look for: 'Listening on 0.0.0.0:8080'"
    echo ""
    echo "5. If 502 Bad Gateway errors:"
    echo "   - Backend service may be down or crashed"
    echo "   - Service URL variable may be incorrect"
    echo "   - Private Networking may not be enabled"
    echo ""
    echo "6. If 504 Gateway Timeout errors:"
    echo "   - Backend service may be slow to respond"
    echo "   - Database connection issues"
    echo "   - Increase proxyTimeout in gateway config"
    echo ""
    exit 1
fi
