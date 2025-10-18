#!/bin/sh
# Frontend Docker Entrypoint Script

set -e

echo "🚀 Starting frontend container..."

# Replace DOMAIN_NAME placeholder in nginx SSL config
if [ -n "$DOMAIN_NAME" ]; then
    echo "📝 Configuring SSL for domain: $DOMAIN_NAME"
    sed -i "s/DOMAIN_NAME/$DOMAIN_NAME/g" /etc/nginx/conf.d/default.conf
else
    echo "⚠️  DOMAIN_NAME not set, using default: lmsetjendpdri.duckdns.org"
    sed -i "s/DOMAIN_NAME/lmsetjendpdri.duckdns.org/g" /etc/nginx/conf.d/default.conf
fi

# Replace environment variables in nginx config if needed
if [ -n "$BACKEND_URL" ]; then
    echo "📝 Configuring backend URL: $BACKEND_URL"
    sed -i "s|http://backend:8000|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
fi

echo "✅ Frontend ready!"

# Execute the main container command
exec "$@"
