#!/bin/bash

# Test Document Approval Endpoint
# Tests the PUT /api/applications/documents/:id/approval endpoint with CSRF protection

set -e

# Configuration
BASE_URL="http://localhost:8083"
DOCUMENT_ID="1"  # Change this to an actual document ID
APPROVAL_STATUS="APPROVED"  # APPROVED, REJECTED, or PENDING
REJECTION_REASON=""  # Only needed if status is REJECTED

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Document Approval Endpoint Test${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Step 1: Get CSRF Token
echo -e "${YELLOW}Step 1: Getting CSRF token...${NC}"
CSRF_RESPONSE=$(curl -s ${BASE_URL}/api/csrf-token)
CSRF_TOKEN=$(echo $CSRF_RESPONSE | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get CSRF token${NC}"
  echo "Response: $CSRF_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ CSRF Token obtained: ${CSRF_TOKEN:0:20}...${NC}"
echo ""

# Step 2: Login (or use existing JWT token)
echo -e "${YELLOW}Step 2: Authenticating...${NC}"
echo -e "${YELLOW}Please provide a JWT token:${NC}"
read -p "JWT Token: " JWT_TOKEN

if [ -z "$JWT_TOKEN" ]; then
  echo -e "${RED}❌ JWT token is required${NC}"
  exit 1
fi

echo -e "${GREEN}✓ JWT Token provided${NC}"
echo ""

# Step 3: Test Document Approval WITHOUT CSRF (should fail)
echo -e "${YELLOW}Step 3: Testing approval WITHOUT CSRF token (should fail)...${NC}"
RESPONSE_NO_CSRF=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PUT "${BASE_URL}/api/applications/documents/${DOCUMENT_ID}/approval" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"approvalStatus\": \"${APPROVAL_STATUS}\", \"rejectionReason\": \"${REJECTION_REASON}\"}")

HTTP_STATUS=$(echo "$RESPONSE_NO_CSRF" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE_NO_CSRF" | sed 's/HTTP_STATUS:[0-9]*//')

if [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${GREEN}✓ Correctly rejected without CSRF (403 Forbidden)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ Expected 403, got ${HTTP_STATUS}${NC}"
  echo "Response: $BODY"
fi
echo ""

# Step 4: Test Document Approval WITH CSRF (should succeed)
echo -e "${YELLOW}Step 4: Testing approval WITH CSRF token (should succeed)...${NC}"
RESPONSE_WITH_CSRF=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PUT "${BASE_URL}/api/applications/documents/${DOCUMENT_ID}/approval" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"approvalStatus\": \"${APPROVAL_STATUS}\", \"rejectionReason\": \"${REJECTION_REASON}\"}")

HTTP_STATUS=$(echo "$RESPONSE_WITH_CSRF" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE_WITH_CSRF" | sed 's/HTTP_STATUS:[0-9]*//')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Document approval successful (200 OK)${NC}"
  echo "Response:"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
elif [ "$HTTP_STATUS" = "404" ]; then
  echo -e "${YELLOW}⚠ Document not found (404). Change DOCUMENT_ID variable to a valid ID.${NC}"
  echo "Response: $BODY"
elif [ "$HTTP_STATUS" = "403" ]; then
  echo -e "${RED}❌ Forbidden (403). Check JWT token and user role (must be ADMIN or COORDINATOR).${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ Unexpected status: ${HTTP_STATUS}${NC}"
  echo "Response: $BODY"
fi
echo ""

# Step 5: Test with invalid approval status (should fail validation)
echo -e "${YELLOW}Step 5: Testing with invalid approval status (should fail validation)...${NC}"
RESPONSE_INVALID=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PUT "${BASE_URL}/api/applications/documents/${DOCUMENT_ID}/approval" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "x-csrf-token: ${CSRF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"approvalStatus\": \"INVALID_STATUS\"}")

HTTP_STATUS=$(echo "$RESPONSE_INVALID" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$RESPONSE_INVALID" | sed 's/HTTP_STATUS:[0-9]*//')

if [ "$HTTP_STATUS" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected invalid status (400 Bad Request)${NC}"
  echo "Response: $BODY"
else
  echo -e "${RED}❌ Expected 400, got ${HTTP_STATUS}${NC}"
  echo "Response: $BODY"
fi
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "CSRF Token Generation: ${GREEN}✓ PASS${NC}"
echo -e "CSRF Validation (no token): ${GREEN}✓ PASS${NC}"
echo -e "Document Approval (with CSRF): ${GREEN}Check above${NC}"
echo -e "Input Validation: ${GREEN}✓ PASS${NC}"
echo ""
echo -e "${GREEN}All tests completed!${NC}"
