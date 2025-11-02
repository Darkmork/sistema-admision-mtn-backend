#!/bin/bash

echo "=== TEST DE CONECTIVIDAD RAILWAY ==="
echo ""
echo "1. Probando Gateway directamente..."
curl -s https://gateway-service-production-a753.up.railway.app/health | jq '.' || echo "❌ Gateway no responde"
echo ""

echo "2. Probando endpoint específico de CSRF..."
curl -v https://gateway-service-production-a753.up.railway.app/api/auth/csrf-token 2>&1 | grep -E "(HTTP|404|502|504|timeout)"
echo ""

echo "3. Verificando variables de entorno..."
echo "Las variables del gateway en Railway deben ser:"
echo "USER_SERVICE_URL=http://user-service:8080"
echo "NOT: USER_SERVICE_URL=https://user-service-production.up.railway.app"
echo ""

