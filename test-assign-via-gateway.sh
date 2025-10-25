#!/bin/bash

echo "=============================================="
echo "Test: Assign Evaluation via Gateway (simulates frontend)"
echo "=============================================="
echo ""

GATEWAY_URL="https://gateway-service-production-a753.up.railway.app"

# Step 1: Get CSRF token
echo "🛡️ Step 1: Getting CSRF token..."
CSRF_TOKEN=$(curl -s "${GATEWAY_URL}/api/auth/csrf-token" | python3 -c "import sys, json; print(json.load(sys.stdin)['csrfToken'])")
echo "✅ CSRF token: ${CSRF_TOKEN:0:20}..."
echo ""

# Step 2: Login
echo "🔐 Step 2: Logging in as admin..."
TOKEN=$(curl -s -X POST "${GATEWAY_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"email":"admision@mtn.cl","password":"Mithrandir1970."}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
echo "✅ JWT token obtained: ${TOKEN:0:20}..."
echo ""

# Step 3: Assign evaluation
echo "📧 Step 3: Assigning evaluation 3 to evaluator 124..."
ASSIGN_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/api/evaluations/3/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -d '{"evaluatorId":124,"evaluationDate":"2025-10-26"}')

echo "Response:"
echo "$ASSIGN_RESPONSE" | python3 -m json.tool
echo ""

# Check if successful
if echo "$ASSIGN_RESPONSE" | grep -q "\"success\":true"; then
  echo "✅ Assignment successful!"
  echo ""
  echo "Now check:"
  echo "1. Email inbox: jorge.gangale@mtn.cl"
  echo "2. Railway logs:"
  echo "   railway logs --service evaluation-service | grep -A 10 'Evaluation Assignment'"
  echo "   railway logs --service notification-service | grep -A 5 'evaluation-assignment'"
else
  echo "❌ Assignment failed!"
fi

echo ""
echo "=============================================="
