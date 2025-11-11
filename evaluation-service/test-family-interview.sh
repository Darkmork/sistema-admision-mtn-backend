#!/bin/bash

# Test family interview save endpoint
# This tests the PUT /api/evaluations/:id/family-interview-data endpoint

echo "🧪 Testing Family Interview Save Endpoint"
echo "=========================================="
echo ""

# Test data
EVALUATION_ID=85
GATEWAY_URL="https://gateway-service-production-a753.up.railway.app"
ENDPOINT="/api/evaluations/${EVALUATION_ID}/family-interview-data"

# Valid JWT token for Isabel Bilbao (TEACHER, ID: 165)
# Generated with: node -e "const jwt = require('jsonwebtoken'); ..."
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE2NSwicm9sZSI6IlRFQUNIRVIiLCJlbWFpbCI6ImlzYWJlbC5iaWxiYW9AZXhhbXBsZS5jb20iLCJpYXQiOjE3NjI3OTkwNzEsImV4cCI6MTc2Mjg4NTQ3MX0.aOYB5CPxiuBUYPWtnDgRJ1m5kIRYQOScE6zY1UM0vBA"

# Get CSRF token first
echo "1️⃣ Getting CSRF token..."
CSRF_RESPONSE=$(curl -s "${GATEWAY_URL}/api/auth/csrf-token" \
  -H "Authorization: Bearer ${TOKEN}")

echo "CSRF Response: ${CSRF_RESPONSE}"
CSRF_TOKEN=$(echo ${CSRF_RESPONSE} | python3 -c "import sys, json; print(json.load(sys.stdin)['csrfToken'])" 2>/dev/null || echo "")

if [ -z "$CSRF_TOKEN" ]; then
  echo "❌ Failed to get CSRF token"
  echo "Response was: ${CSRF_RESPONSE}"
  exit 1
fi

echo "✅ CSRF Token obtained: ${CSRF_TOKEN:0:20}..."
echo ""

# Test interview data
echo "2️⃣ Sending interview data..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "${GATEWAY_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-CSRF-Token: ${CSRF_TOKEN}" \
  -d '{
    "interviewData": {
      "section1": {
        "q1": {"score": 2, "text": "Test response 1"},
        "q2": {"score": 3, "text": "Test response 2"}
      },
      "section2": {
        "q1": {"score": 4, "text": "Test response 3"}
      },
      "observations": {
        "checklist": {
          "item1": true,
          "item2": false
        },
        "overallOpinion": {
          "score": 4,
          "text": "Overall test opinion"
        }
      }
    }
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo ""
echo "📊 Results:"
echo "==========="
echo "HTTP Status: ${HTTP_STATUS}"
echo ""
echo "Response Body:"
echo "${BODY}" | python3 -m json.tool 2>/dev/null || echo "${BODY}"
echo ""

# Interpret results
case ${HTTP_STATUS} in
  200|201)
    echo "✅ SUCCESS: Interview data saved successfully!"
    ;;
  401)
    echo "❌ ERROR 401: Authentication failed"
    echo "   - JWT token invalid or expired"
    ;;
  403)
    echo "❌ ERROR 403: Forbidden"
    echo "   Possible causes:"
    echo "   - User role not authorized (needs TEACHER, PSYCHOLOGIST, etc.)"
    echo "   - CSRF token invalid or expired"
    ;;
  404)
    echo "❌ ERROR 404: Evaluation not found"
    echo "   - Evaluation ID ${EVALUATION_ID} doesn't exist"
    ;;
  500)
    echo "❌ ERROR 500: Server error"
    echo "   - Check backend logs for details"
    ;;
  *)
    echo "❌ ERROR ${HTTP_STATUS}: Unexpected status code"
    ;;
esac
