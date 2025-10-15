#!/bin/sh
# Frontend Docker Entrypoint Script

set -e

echo "🚀 Starting frontend container..."

# Replace environment variables in nginx config if needed
if [ -n "$BACKEND_URL" ]; then
    echo "📝 Configuring backend URL: $BACKEND_URL"
    sed -i "s|http://backend:8000|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
fi

echo "✅ Frontend ready!"

# Execute the main container command
exec "$@"
