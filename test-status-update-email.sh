#!/bin/bash

##############################################################################
# Test Script: Status Update Email Notification
# Purpose: Verify that changing application status sends email notification
##############################################################################

set -e  # Exit on error

echo "=================================================="
echo "🧪 TEST: Status Update Email Notification Flow"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GATEWAY_URL="http://localhost:8080"
APPLICATION_SERVICE_URL="http://localhost:8083"
NOTIFICATION_SERVICE_URL="http://localhost:8085"

# Test data
TEST_EMAIL="jorge.gangale@mail.up.cl"
APPLICATION_ID=1  # Update this with a real application ID from your DB

echo "📋 Test Configuration:"
echo "   Gateway URL: $GATEWAY_URL"
echo "   Application Service: $APPLICATION_SERVICE_URL"
echo "   Notification Service: $NOTIFICATION_SERVICE_URL"
echo "   Test Email: $TEST_EMAIL"
echo "   Application ID: $APPLICATION_ID"
echo ""

##############################################################################
# Step 1: Health Checks
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -n "Checking Application Service... "
if curl -s "$APPLICATION_SERVICE_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ UP${NC}"
else
    echo -e "${RED}✗ DOWN${NC}"
    echo "Error: Application Service is not running on $APPLICATION_SERVICE_URL"
    exit 1
fi

echo -n "Checking Notification Service... "
if curl -s "$NOTIFICATION_SERVICE_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ UP${NC}"
else
    echo -e "${RED}✗ DOWN${NC}"
    echo "Error: Notification Service is not running on $NOTIFICATION_SERVICE_URL"
    exit 1
fi

echo ""

##############################################################################
# Step 2: Login and Get Token
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Authentication"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Login as admin (adjust credentials as needed)
echo "Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jorge.gangale@mail.up.cl",
    "password": "Admin123!"
  }')

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}✗ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

##############################################################################
# Step 3: Get CSRF Token
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Get CSRF Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CSRF_RESPONSE=$(curl -s "$GATEWAY_URL/api/auth/csrf-token" \
  -H "Authorization: Bearer $TOKEN")

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | jq -r '.data.csrfToken // .csrfToken // empty')

if [ -z "$CSRF_TOKEN" ] || [ "$CSRF_TOKEN" == "null" ]; then
    echo -e "${RED}✗ Failed to get CSRF token${NC}"
    echo "Response: $CSRF_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ CSRF token obtained${NC}"
echo "CSRF Token: ${CSRF_TOKEN:0:30}..."
echo ""

##############################################################################
# Step 4: Get Current Application Status
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Get Current Application Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

APP_RESPONSE=$(curl -s "$GATEWAY_URL/api/applications/$APPLICATION_ID" \
  -H "Authorization: Bearer $TOKEN")

CURRENT_STATUS=$(echo "$APP_RESPONSE" | jq -r '.data.status // empty')
STUDENT_NAME=$(echo "$APP_RESPONSE" | jq -r '.data.student.firstName // "Unknown"')
APPLICANT_EMAIL=$(echo "$APP_RESPONSE" | jq -r '.data.applicantUser.email // empty')

if [ -z "$CURRENT_STATUS" ]; then
    echo -e "${RED}✗ Failed to get application${NC}"
    echo "Response: $APP_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Application found${NC}"
echo "   Current Status: $CURRENT_STATUS"
echo "   Student Name: $STUDENT_NAME"
echo "   Applicant Email: $APPLICANT_EMAIL"
echo ""

##############################################################################
# Step 5: Update Application Status (Triggers Email)
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Update Application Status → UNDER_REVIEW"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Determine new status (cycle through statuses for testing)
if [ "$CURRENT_STATUS" == "UNDER_REVIEW" ]; then
    NEW_STATUS="INTERVIEW_SCHEDULED"
elif [ "$CURRENT_STATUS" == "INTERVIEW_SCHEDULED" ]; then
    NEW_STATUS="APPROVED"
elif [ "$CURRENT_STATUS" == "APPROVED" ]; then
    NEW_STATUS="UNDER_REVIEW"
else
    NEW_STATUS="UNDER_REVIEW"
fi

echo "Changing status from $CURRENT_STATUS → $NEW_STATUS"
echo ""

UPDATE_RESPONSE=$(curl -s -X PATCH "$GATEWAY_URL/api/applications/$APPLICATION_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"$NEW_STATUS\",
    \"notes\": \"Test de envío automático de correo - $(date +'%Y-%m-%d %H:%M:%S')\"
  }")

# Check if update was successful
SUCCESS=$(echo "$UPDATE_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ Status updated successfully${NC}"
    UPDATED_STATUS=$(echo "$UPDATE_RESPONSE" | jq -r '.data.status')
    echo "   New Status: $UPDATED_STATUS"
else
    echo -e "${RED}✗ Failed to update status${NC}"
    echo "Response: $UPDATE_RESPONSE"
    exit 1
fi

echo ""

##############################################################################
# Step 6: Check Application Service Logs for Email Call
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📧 Expected behavior:"
echo "   1. Application Service should call Notification Service"
echo "   2. Notification Service should send email to: $APPLICANT_EMAIL"
echo "   3. Email subject should match the new status: $NEW_STATUS"
echo ""

echo -e "${YELLOW}⚠️  Check the following logs:${NC}"
echo ""
echo "   Application Service logs:"
echo "   ${BLUE}tail -f /Users/jorgegangale/Desktop/MIcroservicios/application-service/logs/*.log${NC}"
echo ""
echo "   Notification Service logs:"
echo "   ${BLUE}tail -f /Users/jorgegangale/Desktop/MIcroservicios/notification-service/logs/*.log${NC}"
echo ""

echo "Look for these log messages:"
echo "   ✓ Application Service: '📧 Calling notification service...'"
echo "   ✓ Notification Service: '📧 Sending status update email...'"
echo "   ✓ Notification Service: '✅ Status update email sent...'"
echo ""

##############################################################################
# Step 7: Test Direct Notification Endpoint (Optional)
##############################################################################

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 7: Test Direct Notification Endpoint (Optional)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Do you want to test the notification endpoint directly? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Calling notification service directly..."

    NOTIF_RESPONSE=$(curl -s -X POST "$NOTIFICATION_SERVICE_URL/api/institutional-emails/status-update/$APPLICATION_ID" \
      -H "Content-Type: application/json" \
      -d "{
        \"newStatus\": \"$NEW_STATUS\",
        \"notes\": \"Test directo del endpoint de notificaciones\"
      }")

    EMAIL_SENT=$(echo "$NOTIF_RESPONSE" | jq -r '.data.emailSent // false')
    RECIPIENT=$(echo "$NOTIF_RESPONSE" | jq -r '.data.recipient // "unknown"')

    if [ "$EMAIL_SENT" == "true" ]; then
        echo -e "${GREEN}✓ Email sent successfully${NC}"
        echo "   Recipient: $RECIPIENT"
    else
        echo -e "${YELLOW}⚠️  Email may not have been sent${NC}"
        echo "Response: $NOTIF_RESPONSE"
    fi
fi

echo ""
echo "=================================================="
echo "✅ Test completed!"
echo "=================================================="
echo ""
echo "Summary:"
echo "   - Application ID: $APPLICATION_ID"
echo "   - Status changed: $CURRENT_STATUS → $NEW_STATUS"
echo "   - Expected recipient: $APPLICANT_EMAIL"
echo ""
echo "Next steps:"
echo "   1. Check your email inbox for: $APPLICANT_EMAIL"
echo "   2. Review service logs for detailed information"
echo "   3. If no email received, check SMTP configuration"
echo ""
