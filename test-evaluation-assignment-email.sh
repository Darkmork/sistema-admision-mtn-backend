#!/bin/bash

echo "=============================================="
echo "Test: Evaluation Assignment Email Flow"
echo "=============================================="
echo ""

# Configuration
GATEWAY_URL="${GATEWAY_URL:-https://gateway-service-production-a753.up.railway.app}"
APPLICATION_ID=2
EVALUATION_TYPE="MATHEMATICS_EXAM"
EVALUATOR_EMAIL="jorge.gangale@mtn.cl"

echo "📋 Configuration:"
echo "  Gateway: $GATEWAY_URL"
echo "  Application ID: $APPLICATION_ID"
echo "  Evaluation Type: $EVALUATION_TYPE"
echo "  Evaluator Email: $EVALUATOR_EMAIL"
echo ""

# Step 1: Get CSRF token (needed for login)
echo "🛡️ Step 1: Getting CSRF token for login..."
CSRF_RESPONSE=$(curl -s -X GET "${GATEWAY_URL}/api/auth/csrf-token")

CSRF_TOKEN=$(echo $CSRF_RESPONSE | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
  echo "❌ Failed to get CSRF token!"
  echo "Response: $CSRF_RESPONSE"
  exit 1
fi

echo "✅ CSRF token obtained"
echo ""

# Step 2: Login as admin to get JWT token
echo "🔐 Step 2: Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -d '{
    "email": "admision@mtn.cl",
    "password": "Mithrandir1970."
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful! Token obtained"
echo ""

# Step 3: Find evaluator ID by email
echo "🔍 Step 3: Finding evaluator ID for $EVALUATOR_EMAIL..."
USERS_RESPONSE=$(curl -s -X GET "${GATEWAY_URL}/api/users" \
  -H "Authorization: Bearer $TOKEN")

EVALUATOR_ID=$(echo $USERS_RESPONSE | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    users = data.get('data', [])
    for user in users:
        if user.get('email') == '$EVALUATOR_EMAIL':
            print(user.get('id'))
            break
except:
    pass
")

if [ -z "$EVALUATOR_ID" ]; then
  echo "❌ Could not find evaluator with email $EVALUATOR_EMAIL"
  echo "Available users response: $USERS_RESPONSE"
  exit 1
fi

echo "✅ Evaluator ID found: $EVALUATOR_ID"
echo ""

# Step 4: Check for existing evaluations
echo "📊 Step 4: Checking for existing evaluations for application $APPLICATION_ID..."
EXISTING_EVALS=$(curl -s -X GET "${GATEWAY_URL}/api/evaluations/application/${APPLICATION_ID}" \
  -H "Authorization: Bearer $TOKEN")

echo "Existing evaluations:"
echo "$EXISTING_EVALS" | python3 -m json.tool 2>/dev/null || echo "$EXISTING_EVALS"
echo ""

# Step 5: Create evaluation if it doesn't exist
echo "📝 Step 5: Creating evaluation..."
CREATE_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/api/evaluations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "{
    \"applicationId\": $APPLICATION_ID,
    \"evaluatorId\": $EVALUATOR_ID,
    \"evaluationType\": \"$EVALUATION_TYPE\",
    \"score\": 0,
    \"maxScore\": 100,
    \"status\": \"PENDING\",
    \"strengths\": \"\",
    \"areasForImprovement\": \"\",
    \"observations\": \"\",
    \"recommendations\": \"\"
  }")

echo "Create evaluation response:"
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Extract evaluation ID
EVALUATION_ID=$(echo $CREATE_RESPONSE | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data.get('success') and data.get('data'):
        print(data['data'].get('id', ''))
except:
    pass
")

if [ -z "$EVALUATION_ID" ]; then
  echo "⚠️ Failed to create evaluation (might already exist)"
  echo "Trying to find existing evaluation with same type..."

  EVALUATION_ID=$(echo "$EXISTING_EVALS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    evals = data.get('data', [])
    for ev in evals:
        if ev.get('evaluationType') == '$EVALUATION_TYPE':
            print(ev.get('id', ''))
            break
except:
    pass
")

  if [ -z "$EVALUATION_ID" ]; then
    echo "❌ Could not find or create evaluation"
    exit 1
  fi

  echo "✅ Found existing evaluation ID: $EVALUATION_ID"
fi

echo "✅ Using evaluation ID: $EVALUATION_ID"
echo ""

# Step 6: Assign evaluation to evaluator (this should trigger email)
echo "📧 Step 6: Assigning evaluation to evaluator (THIS SHOULD SEND EMAIL)..."
ASSIGN_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/api/evaluations/${EVALUATION_ID}/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d "{
    \"evaluatorId\": $EVALUATOR_ID,
    \"evaluationDate\": \"$(date -u +%Y-%m-%d)\"
  }")

echo "Assign response:"
echo "$ASSIGN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ASSIGN_RESPONSE"
echo ""

# Check if assignment was successful
if echo "$ASSIGN_RESPONSE" | grep -q "Evaluación asignada exitosamente"; then
  echo "✅ SUCCESS! Evaluation assigned successfully!"
  echo ""
  echo "📬 Email should have been sent to the evaluator"
  echo ""
  echo "Next steps:"
  echo "1. Check the evaluator's email inbox"
  echo "2. Check notification-service logs for email delivery confirmation"
  echo "3. Check Railway notification-service logs for: '✅ Email notification sent'"
  echo ""
  echo "To check Railway logs:"
  echo "  railway logs --service notification-service | grep -A 5 'evaluation-assignment'"
else
  echo "❌ Assignment failed or unexpected response"
fi

echo ""
echo "=============================================="
echo "Test Complete"
echo "=============================================="
