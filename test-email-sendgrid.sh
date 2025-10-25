#!/bin/bash

echo "=============================================="
echo "Test: SendGrid Email Delivery"
echo "=============================================="
echo ""

NOTIFICATION_URL="https://notification-service-production-3411.up.railway.app"

# Test 1: Send to jorge.gangale@mtn.cl
echo "📧 Test 1: Sending test email to jorge.gangale@mtn.cl..."
RESPONSE1=$(curl -s -X POST "${NOTIFICATION_URL}/api/institutional-emails/evaluation-assignment/3" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluatorEmail": "jorge.gangale@mtn.cl",
    "evaluatorName": "Jorge Gangale",
    "studentName": "Test Student",
    "evaluationType": "MATHEMATICS_EXAM",
    "applicationId": 2
  }')

echo "Response:"
echo "$RESPONSE1" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE1"
echo ""

MESSAGE_ID1=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('messageId', 'N/A'))" 2>/dev/null)
echo "Message ID: $MESSAGE_ID1"
echo ""

# Test 2: Send to alternative email (replace with your personal email)
read -p "¿Deseas enviar un email de prueba a otro correo? (gmail, outlook, etc.) [y/n]: " SEND_ALT

if [ "$SEND_ALT" = "y" ] || [ "$SEND_ALT" = "Y" ]; then
  read -p "Ingresa el email destino: " ALT_EMAIL

  echo ""
  echo "📧 Test 2: Sending test email to $ALT_EMAIL..."
  RESPONSE2=$(curl -s -X POST "${NOTIFICATION_URL}/api/institutional-emails/evaluation-assignment/999" \
    -H "Content-Type: application/json" \
    -d "{
      \"evaluatorEmail\": \"$ALT_EMAIL\",
      \"evaluatorName\": \"Test User\",
      \"studentName\": \"Test Student\",
      \"evaluationType\": \"MATHEMATICS_EXAM\",
      \"applicationId\": 2
    }")

  echo "Response:"
  echo "$RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE2"
  echo ""

  MESSAGE_ID2=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin).get('data', {}).get('messageId', 'N/A'))" 2>/dev/null)
  echo "Message ID: $MESSAGE_ID2"
  echo ""
fi

echo ""
echo "=============================================="
echo "📋 Next Steps:"
echo "=============================================="
echo "1. Check SPAM folder in email inbox"
echo "2. Check SendGrid Activity:"
echo "   https://app.sendgrid.com/email_activity"
echo "   Search for messageId: $MESSAGE_ID1"
echo ""
echo "3. Verify domain authentication:"
echo "   https://app.sendgrid.com/settings/sender_auth"
echo "   Make sure mtn.cl domain is verified"
echo ""
echo "4. Check email stats:"
echo "   https://app.sendgrid.com/stats/activity"
echo ""
echo "=============================================="
