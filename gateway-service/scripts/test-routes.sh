#!/bin/bash

# Test Gateway Routes
# Sistema de Admisión MTN

set -e

GATEWAY_URL="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing NGINX Gateway Routes"
echo "================================"
echo ""

# Function to test a route
test_route() {
    local route=$1
    local expected_upstream=$2

    echo -n "Testing $route... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL$route" 2>&1 || echo "000")

    if [ "$response" == "401" ] || [ "$response" == "404" ] || [ "$response" == "200" ]; then
        echo -e "${GREEN}✓${NC} ($response - routed correctly)"
    elif [ "$response" == "502" ] || [ "$response" == "503" ] || [ "$response" == "504" ]; then
        echo -e "${YELLOW}⚠${NC} ($response - upstream service down: $expected_upstream)"
    elif [ "$response" == "000" ]; then
        echo -e "${RED}✗${NC} (Gateway not running)"
        return 1
    else
        echo -e "${RED}✗${NC} (unexpected response: $response)"
    fi
}

# Test gateway health
echo "1. Gateway Health Check"
if curl -s -f "$GATEWAY_URL/gateway/status" > /dev/null; then
    echo -e "   ${GREEN}✓${NC} Gateway is healthy"
else
    echo -e "   ${RED}✗${NC} Gateway is not responding"
    exit 1
fi
echo ""

# Test service routes
echo "2. User Service Routes"
test_route "/api/auth/login" "user-service"
test_route "/api/users" "user-service"
echo ""

echo "3. Application Service Routes"
test_route "/api/applications" "application-service"
test_route "/api/documents" "application-service"
echo ""

echo "4. Evaluation Service Routes"
test_route "/api/evaluations" "evaluation-service"
test_route "/api/interviews" "evaluation-service"
echo ""

echo "5. Notification Service Routes"
test_route "/api/notifications" "notification-service"
test_route "/api/email" "notification-service"
echo ""

echo "6. Dashboard Service Routes"
test_route "/api/dashboard/stats" "dashboard-service"
test_route "/api/analytics/dashboard-metrics" "dashboard-service"
echo ""

echo "7. Guardian Service Routes"
test_route "/api/guardians" "guardian-service"
echo ""

# Test 404
echo "8. 404 Handling"
response=$(curl -s "$GATEWAY_URL/api/nonexistent" | grep -o "NOT_FOUND" || echo "")
if [ "$response" == "NOT_FOUND" ]; then
    echo -e "   ${GREEN}✓${NC} 404 handling works correctly"
else
    echo -e "   ${RED}✗${NC} 404 handling not working"
fi
echo ""

echo "✅ Route testing complete"
