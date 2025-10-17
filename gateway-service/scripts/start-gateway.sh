#!/bin/bash

# Start NGINX Gateway
# Sistema de Admisión MTN

set -e

echo "🚀 Starting NGINX API Gateway..."
echo "================================"

# Check if NGINX is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Error: NGINX is not installed"
    echo "Install with: brew install nginx"
    exit 1
fi

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONF="$PROJECT_ROOT/config/nginx.conf"

echo "📁 Project root: $PROJECT_ROOT"
echo "⚙️  Config file: $NGINX_CONF"

# Test nginx configuration
echo ""
echo "🔍 Testing NGINX configuration..."
if nginx -t -c "$NGINX_CONF"; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration has errors"
    exit 1
fi

# Check if NGINX is already running
if pgrep -x nginx > /dev/null; then
    echo ""
    echo "⚠️  NGINX is already running"
    read -p "Do you want to reload the configuration? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Reloading NGINX..."
        nginx -s reload
        echo "✅ NGINX reloaded successfully"
    fi
else
    # Start NGINX
    echo ""
    echo "▶️  Starting NGINX..."
    nginx -c "$NGINX_CONF"
    echo "✅ NGINX started successfully"
fi

echo ""
echo "🌐 Gateway running at: http://localhost:8080"
echo "🏥 Health check: http://localhost:8080/gateway/status"
echo ""
echo "📋 Service routes:"
echo "  - /api/auth          → User Service (8082)"
echo "  - /api/users         → User Service (8082)"
echo "  - /api/applications  → Application Service (8083)"
echo "  - /api/documents     → Application Service (8083)"
echo "  - /api/evaluations   → Evaluation Service (8084)"
echo "  - /api/interviews    → Evaluation Service (8084)"
echo "  - /api/notifications → Notification Service (8085)"
echo "  - /api/email         → Notification Service (8085)"
echo "  - /api/dashboard     → Dashboard Service (8086)"
echo "  - /api/analytics     → Dashboard Service (8086)"
echo "  - /api/guardians     → Guardian Service (8087)"
echo ""
echo "To stop: nginx -s stop"
echo "To reload: nginx -s reload"
