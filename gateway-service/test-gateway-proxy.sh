#!/bin/bash

# =====================================================
# Gateway Proxy Smoke Test
# =====================================================
# Tests POST/PUT/PATCH requests with JSON bodies
# through the Express gateway to verify body handling
# =====================================================

set -e

GATEWAY_URL="http://localhost:8080"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}Gateway Proxy Smoke Test${NC}"
echo "========================================"
echo ""

# Function to test endpoint
test_endpoint() {
  local method=$1
  local path=$2
  local description=$3
  local data_file=$4
  local expected_status=$5
  local csrf_token=$6

  echo -e "${YELLOW}Testing:${NC} $method $path - $description"

  if [ -n "$csrf_token" ]; then
    response=$(curl -X "$method" "${GATEWAY_URL}${path}" \
      -H 'Content-Type: application/json' \
      -H "X-CSRF-Token: $csrf_token" \
      --data-binary "@$data_file" \
      -w '\n%{http_code}' \
      -s \
      --max-time 10)
  else
    response=$(curl -X "$method" "${GATEWAY_URL}${path}" \
      -H 'Content-Type: application/json' \
      --data-binary "@$data_file" \
      -w '\n%{http_code}' \
      -s \
      --max-time 10)
  fi

  status_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$status_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} - Status: $status_code"
    echo "  Response: $(echo "$body" | head -c 100)..."
    echo ""
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} - Expected: $expected_status, Got: $status_code"
    echo "  Response: $body"
    echo ""
    return 1
  fi
}

# Function to get CSRF token
get_csrf_token() {
  echo -e "${YELLOW}Fetching CSRF token...${NC}"
  csrf_response=$(curl -s "${GATEWAY_URL}/api/auth/csrf-token")
  csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$csrf_token" ]; then
    echo -e "${RED}✗ Failed to get CSRF token${NC}"
    echo "Response: $csrf_response"
    exit 1
  fi

  echo -e "${GREEN}✓ Got CSRF token${NC}: ${csrf_token:0:20}..."
  echo ""
}

# Track results
PASSED=0
FAILED=0

# =====================================================
# Test 1: Gateway Health
# =====================================================

echo -e "${BOLD}1. Gateway Health Check${NC}"
health_response=$(curl -s "${GATEWAY_URL}/health")
if echo "$health_response" | grep -q '"status":"healthy"'; then
  echo -e "${GREEN}✓ Gateway is healthy${NC}"
  echo ""
  ((PASSED++))
else
  echo -e "${RED}✗ Gateway health check failed${NC}"
  echo "$health_response"
  echo ""
  ((FAILED++))
fi

# =====================================================
# Test 2: Get CSRF Token
# =====================================================

echo -e "${BOLD}2. CSRF Token Retrieval${NC}"
get_csrf_token
((PASSED++))

# =====================================================
# Test 3: Login with JSON Body (Special Character Password)
# =====================================================

echo -e "${BOLD}3. POST /api/auth/login (Password with '!' character)${NC}"

# Create login payload using heredoc to preserve special chars
cat <<'JSON' > /tmp/test-login.json
{
  "email": "jorge.gangale@mail.up.cl",
  "password": "SecurePass123!"
}
JSON

if test_endpoint "POST" "/api/auth/login" "User login with special chars" "/tmp/test-login.json" 200 "$csrf_token"; then
  ((PASSED++))

  # Extract token for authenticated requests
  login_response=$(curl -X POST "${GATEWAY_URL}/api/auth/login" \
    -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $csrf_token" \
    --data-binary @/tmp/test-login.json \
    -s)

  JWT_TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$JWT_TOKEN" ]; then
    echo -e "${GREEN}✓ JWT token obtained${NC}: ${JWT_TOKEN:0:30}..."
    echo ""
  else
    echo -e "${YELLOW}⚠ No JWT token in response (may be expected)${NC}"
    echo ""
  fi
else
  ((FAILED++))
fi

# =====================================================
# Test 4: POST to Application Service
# =====================================================

if [ -n "$JWT_TOKEN" ]; then
  echo -e "${BOLD}4. POST /api/applications (Authenticated)${NC}"

  cat <<'JSON' > /tmp/test-application.json
{
  "studentFirstName": "Test",
  "studentLastName": "Student",
  "studentRUT": "12345678-9",
  "birthDate": "2010-05-15",
  "desiredCycle": "PRIMARIA",
  "academicYear": 2025
}
JSON

  # Note: This may fail with 400/422 (validation) but should NOT hang/timeout
  response_code=$(curl -X POST "${GATEWAY_URL}/api/applications" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "X-CSRF-Token: $csrf_token" \
    --data-binary @/tmp/test-application.json \
    -w '%{http_code}' \
    -s \
    -o /tmp/app-response.json \
    --max-time 10)

  if [ "$response_code" -ne 000 ]; then
    echo -e "${GREEN}✓ PASS${NC} - Response received (Status: $response_code, expected 200/400/403)"
    echo "  Response: $(cat /tmp/app-response.json | head -c 100)..."
    echo ""
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} - Request timed out or connection error"
    echo ""
    ((FAILED++))
  fi
else
  echo -e "${YELLOW}⚠ Skipping authenticated tests (no JWT token)${NC}"
  echo ""
fi

# =====================================================
# Test 5: Form Data (urlencoded)
# =====================================================

echo -e "${BOLD}5. POST with application/x-www-form-urlencoded${NC}"

response_code=$(curl -X POST "${GATEWAY_URL}/api/auth/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H "X-CSRF-Token: $csrf_token" \
  --data-urlencode 'email=jorge.gangale@mail.up.cl' \
  --data-urlencode 'password=SecurePass123!' \
  -w '%{http_code}' \
  -s \
  -o /tmp/form-response.json \
  --max-time 10)

if [ "$response_code" -eq 200 ] || [ "$response_code" -eq 400 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Form data handled (Status: $response_code)"
  echo "  Response: $(cat /tmp/form-response.json | head -c 100)..."
  echo ""
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Unexpected status: $response_code"
  echo ""
  ((FAILED++))
fi

# =====================================================
# Test 6: Large JSON Body
# =====================================================

echo -e "${BOLD}6. POST with Large JSON Body (1MB)${NC}"

# Generate 1MB JSON payload
cat <<'EOF' > /tmp/large-payload.json
{
  "email": "jorge.gangale@mail.up.cl",
  "password": "SecurePass123!",
  "metadata": "
EOF

# Append 1MB of data
python3 -c "print('A' * (1024 * 1024), end='')" >> /tmp/large-payload.json

cat <<'EOF' >> /tmp/large-payload.json
"
}
EOF

response_code=$(curl -X POST "${GATEWAY_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $csrf_token" \
  --data-binary @/tmp/large-payload.json \
  -w '%{http_code}' \
  -s \
  -o /tmp/large-response.json \
  --max-time 10)

if [ "$response_code" -ne 000 ]; then
  echo -e "${GREEN}✓ PASS${NC} - Large body handled (Status: $response_code)"
  echo "  Response: $(cat /tmp/large-response.json | head -c 100)..."
  echo ""
  ((PASSED++))
else
  echo -e "${RED}✗ FAIL${NC} - Request timed out"
  echo ""
  ((FAILED++))
fi

# =====================================================
# Summary
# =====================================================

echo ""
echo "========================================"
echo -e "${BOLD}Test Summary${NC}"
echo "========================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "========================================"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}Some tests failed.${NC}"
  exit 1
fi
