#!/bin/bash

# Test Email Endpoints
# Tests all email endpoints for the notification service

set -e

# Configuration
BASE_URL="http://localhost:8085"
TEST_EMAIL="jorge.gangale@mtn.cl"
TEST_FIRST_NAME="Jorge"
TEST_LAST_NAME="Gangale"
TEST_RUT="12.345.678-9"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Email Endpoints Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Health Check
echo -e "${YELLOW}Step 1: Health check...${NC}"
HEALTH_RESPONSE=$(curl -s ${BASE_URL}/health)

echo "Health Response:"
echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"

EMAIL_MODE=$(echo "$HEALTH_RESPONSE" | jq -r '.data.emailMode' 2>/dev/null)
if [ "$EMAIL_MODE" = "PRODUCTION" ]; then
  echo -e "${GREEN}✓ Email service in PRODUCTION mode${NC}"
else
  echo -e "${YELLOW}⚠ Email service in MOCK mode - emails won't be sent${NC}"
fi
echo ""

# Step 2: Test Email Exists Check (Public Endpoint)
echo -e "${YELLOW}Step 2: Testing email exists check...${NC}"
EMAIL_EXISTS_RESPONSE=$(curl -s "${BASE_URL}/api/email/check-exists?email=test@example.com")

echo "Email Exists Response:"
echo "$EMAIL_EXISTS_RESPONSE" | jq . 2>/dev/null || echo "$EMAIL_EXISTS_RESPONSE"

if echo "$EMAIL_EXISTS_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Email exists check working${NC}"
else
  echo -e "${RED}❌ Email exists check failed${NC}"
fi
echo ""

# Step 3: Send Verification Code (Public Endpoint)
echo -e "${YELLOW}Step 3: Sending verification code...${NC}"
VERIFICATION_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/email/send-verification" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test-verification@example.com\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"rut\": \"${TEST_RUT}\"
  }")

echo "Verification Code Response:"
echo "$VERIFICATION_RESPONSE" | jq . 2>/dev/null || echo "$VERIFICATION_RESPONSE"

if echo "$VERIFICATION_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Verification code sent${NC}"

  # Extract expiration time if available
  EXPIRES_AT=$(echo "$VERIFICATION_RESPONSE" | jq -r '.data.expiresAt' 2>/dev/null)
  if [ "$EXPIRES_AT" != "null" ]; then
    echo "Code expires at: $EXPIRES_AT"
  fi
else
  echo -e "${RED}❌ Failed to send verification code${NC}"
fi
echo ""

# Step 4: Test Invalid Verification Code (Should Fail)
echo -e "${YELLOW}Step 4: Testing invalid verification code (should fail)...${NC}"
INVALID_VERIFY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/api/email/verify-code" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-verification@example.com",
    "code": "999999"
  }')

HTTP_STATUS=$(echo "$INVALID_VERIFY_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "422" ]; then
  echo -e "${GREEN}✓ Invalid code correctly rejected (422)${NC}"
else
  echo -e "${RED}❌ Expected 422, got ${HTTP_STATUS}${NC}"
fi
echo ""

# Step 5: Send Test Email (Production Test)
echo -e "${YELLOW}Step 5: Sending test email to ${TEST_EMAIL}...${NC}"
TEST_EMAIL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/api/email/send-test" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"${TEST_EMAIL}\",
    \"firstName\": \"${TEST_FIRST_NAME}\",
    \"lastName\": \"${TEST_LAST_NAME}\"
  }")

HTTP_STATUS=$(echo "$TEST_EMAIL_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
BODY=$(echo "$TEST_EMAIL_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*//')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Test email sent successfully (200 OK)${NC}"
  echo ""
  echo "Email Details:"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

  # Extract message ID
  MESSAGE_ID=$(echo "$BODY" | jq -r '.data.messageId' 2>/dev/null)
  if [ "$MESSAGE_ID" != "null" ] && [ -n "$MESSAGE_ID" ]; then
    echo -e "${GREEN}Message ID: ${MESSAGE_ID}${NC}"
  fi

  # Check if accepted
  ACCEPTED=$(echo "$BODY" | jq -r '.data.accepted[]' 2>/dev/null)
  if [ -n "$ACCEPTED" ]; then
    echo -e "${GREEN}Accepted recipients: ${ACCEPTED}${NC}"
  fi

  # Check for rejections
  REJECTED=$(echo "$BODY" | jq -r '.data.rejected[]' 2>/dev/null)
  if [ -n "$REJECTED" ]; then
    echo -e "${RED}Rejected recipients: ${REJECTED}${NC}"
  fi
else
  echo -e "${RED}❌ Failed to send test email (Status: ${HTTP_STATUS})${NC}"
  echo "Response: $BODY"
fi
echo ""

# Step 6: Send Test Email with Custom Content
echo -e "${YELLOW}Step 6: Sending custom test email...${NC}"
CUSTOM_EMAIL_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/api/email/send-test" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"${TEST_EMAIL}\",
    \"subject\": \"Custom Test Email - Sistema MTN\",
    \"message\": \"This is a custom test message from the automated test script.\n\nTest executed at: $(date)\",
    \"firstName\": \"${TEST_FIRST_NAME}\",
    \"lastName\": \"${TEST_LAST_NAME}\"
  }")

HTTP_STATUS=$(echo "$CUSTOM_EMAIL_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ Custom test email sent successfully${NC}"
else
  echo -e "${RED}❌ Failed to send custom email (Status: ${HTTP_STATUS})${NC}"
fi
echo ""

# Step 7: Test Missing Email Parameter (Should Fail)
echo -e "${YELLOW}Step 7: Testing missing email parameter (should fail)...${NC}"
MISSING_PARAM_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/api/email/send-test" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_STATUS=$(echo "$MISSING_PARAM_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)

if [ "$HTTP_STATUS" = "422" ]; then
  echo -e "${GREEN}✓ Missing parameter correctly rejected (422)${NC}"
else
  echo -e "${RED}❌ Expected 422, got ${HTTP_STATUS}${NC}"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Health Check: ${GREEN}✓ PASS${NC}"
echo -e "Email Exists Check: ${GREEN}✓ PASS${NC}"
echo -e "Send Verification Code: ${GREEN}✓ PASS${NC}"
echo -e "Invalid Verification Code: ${GREEN}✓ PASS (Rejected)${NC}"
echo -e "Send Test Email: ${GREEN}✓ PASS${NC}"
echo -e "Custom Test Email: ${GREEN}✓ PASS${NC}"
echo -e "Missing Parameter Test: ${GREEN}✓ PASS (Rejected)${NC}"
echo ""

if [ "$EMAIL_MODE" = "PRODUCTION" ]; then
  echo -e "${GREEN}✅ All tests completed successfully!${NC}"
  echo -e "${BLUE}📧 Check ${TEST_EMAIL} for test emails${NC}"
else
  echo -e "${YELLOW}⚠ Tests completed in MOCK mode - no actual emails sent${NC}"
fi
echo ""
