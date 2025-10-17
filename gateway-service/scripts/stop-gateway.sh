#!/bin/bash

# Stop NGINX Gateway
# Sistema de Admisión MTN

set -e

echo "🛑 Stopping NGINX API Gateway..."
echo "================================"

# Check if NGINX is running
if pgrep -x nginx > /dev/null; then
    echo "▶️  Sending stop signal to NGINX..."
    nginx -s stop

    # Wait a moment and check
    sleep 2

    if pgrep -x nginx > /dev/null; then
        echo "⚠️  NGINX still running, force killing..."
        pkill -9 nginx
    fi

    echo "✅ NGINX stopped successfully"
else
    echo "ℹ️  NGINX is not running"
fi

# Clean up pid file if exists
if [ -f "nginx.pid" ]; then
    rm nginx.pid
    echo "🧹 Cleaned up PID file"
fi

echo "✅ Gateway stopped"
