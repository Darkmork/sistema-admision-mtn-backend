#!/bin/bash

echo "=============================================="
echo "Railway Private Networking Test Script"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

GATEWAY_URL="https://gateway-service-production-a753.up.railway.app"
NOTIFICATION_URL="https://notification-service-production-3411.up.railway.app"

echo "Step 1: Testing direct notification-service endpoint..."
echo "------------------------------------------------------"
DIRECT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$NOTIFICATION_URL/api/institutional-emails/document-review/1" \
  -H "Content-Type: application/json" \
  --data '{"approvedDocuments":["Test.pdf"],"rejectedDocuments":[],"allApproved":true}' \
  --max-time 10)

DIRECT_HTTP_CODE=$(echo "$DIRECT_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
DIRECT_BODY=$(echo "$DIRECT_RESPONSE" | grep -v "HTTP_CODE")

if [ "$DIRECT_HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Direct notification-service: OK (HTTP $DIRECT_HTTP_CODE)${NC}"
  echo "Response: $DIRECT_BODY" | jq '.' 2>/dev/null || echo "$DIRECT_BODY"
else
  echo -e "${RED}❌ Direct notification-service: FAILED (HTTP $DIRECT_HTTP_CODE)${NC}"
  echo "Response: $DIRECT_BODY"
fi

echo ""
echo "Step 2: Testing gateway proxy to notification-service..."
echo "------------------------------------------------------"
GATEWAY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$GATEWAY_URL/api/institutional-emails/document-review/2" \
  -H "Content-Type: application/json" \
  --data '{"approvedDocuments":["Doc1.pdf","Doc2.pdf"],"rejectedDocuments":[],"allApproved":true}' \
  --max-time 15)

GATEWAY_HTTP_CODE=$(echo "$GATEWAY_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
GATEWAY_BODY=$(echo "$GATEWAY_RESPONSE" | grep -v "HTTP_CODE")

echo ""
if [ "$GATEWAY_HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅✅✅ SUCCESS! Gateway proxy working with private networking!${NC}"
  echo "HTTP Code: $GATEWAY_HTTP_CODE"
  echo "Response: $GATEWAY_BODY" | jq '.' 2>/dev/null || echo "$GATEWAY_BODY"
  echo ""
  echo -e "${GREEN}Private networking is WORKING correctly!${NC}"
elif [ "$GATEWAY_HTTP_CODE" = "301" ]; then
  echo -e "${RED}❌ FAILED: Gateway returning 301 redirect${NC}"
  echo "HTTP Code: $GATEWAY_HTTP_CODE"
  echo ""
  echo -e "${YELLOW}This means private networking is NOT configured yet.${NC}"
  echo ""
  echo "Action required:"
  echo "1. Go to Railway dashboard → gateway-service → Variables"
  echo "2. Update NOTIFICATION_SERVICE_URL to:"
  echo "   http://notification-service.railway.internal:8080"
  echo "3. Or use Railway variable reference:"
  echo "   http://\${{notification-service.RAILWAY_PRIVATE_DOMAIN}}:8080"
  echo "4. Save and redeploy gateway-service"
  echo ""
  echo "See RAILWAY_PRIVATE_NETWORKING.md for full configuration guide."
elif [ -z "$GATEWAY_HTTP_CODE" ]; then
  echo -e "${RED}❌ FAILED: Request timeout or no response${NC}"
  echo ""
  echo "Possible causes:"
  echo "1. Gateway cannot reach notification-service"
  echo "2. Service URL is incorrect"
  echo "3. Services not listening on IPv6 (::)"
else
  echo -e "${RED}❌ FAILED: Unexpected HTTP code${NC}"
  echo "HTTP Code: $GATEWAY_HTTP_CODE"
  echo "Response: $GATEWAY_BODY"
fi

echo ""
echo "=============================================="
echo "Test Complete"
echo "=============================================="
