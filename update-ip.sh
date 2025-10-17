#!/bin/bash
# ============================================
# IP Address Update Script
# LMSetjen DPD RI - Learning Management System
# ============================================
# This script helps you update the EC2 public IP address
# across all configuration files when it changes.
#
# Usage: ./update-ip.sh NEW_IP_ADDRESS
# Example: ./update-ip.sh 16.79.83.21
# ============================================

# Check if IP address is provided
if [ -z "$1" ]; then
    echo "❌ Error: No IP address provided"
    echo "Usage: ./update-ip.sh NEW_IP_ADDRESS"
    echo "Example: ./update-ip.sh 16.79.83.21"
    exit 1
fi

NEW_IP=$1

# Validate IP address format (basic check)
if ! [[ $NEW_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "❌ Error: Invalid IP address format"
    echo "Please provide a valid IPv4 address (e.g., 16.79.83.21)"
    exit 1
fi

echo "🔄 Updating IP address to: $NEW_IP"
echo "================================================"

# Get current IP from .env file
CURRENT_IP=$(grep "ALLOWED_HOSTS=" .env | grep -oP '\d+\.\d+\.\d+\.\d+' | head -1)

if [ -z "$CURRENT_IP" ]; then
    echo "⚠️  Warning: Could not detect current IP address"
    echo "Proceeding with update..."
else
    echo "📍 Current IP: $CURRENT_IP"
    echo "📍 New IP: $NEW_IP"
    echo ""
fi

# Backup .env file
echo "💾 Creating backup of .env file..."
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update .env file
echo "📝 Updating .env file..."
if [ -f ".env" ]; then
    sed -i.bak "s/ALLOWED_HOSTS=localhost,127.0.0.1,[0-9.]*$/ALLOWED_HOSTS=localhost,127.0.0.1,$NEW_IP/" .env
    sed -i.bak "s#CORS_ALLOWED_ORIGINS=http://localhost:3000,http://[0-9.]*#CORS_ALLOWED_ORIGINS=http://localhost:3000,http://$NEW_IP#" .env
    sed -i.bak "s#FRONTEND_SITE_URL=http://[0-9.]*#FRONTEND_SITE_URL=http://$NEW_IP#" .env
    sed -i.bak "s#BACKEND_SITE_URL=http://[0-9.]*#BACKEND_SITE_URL=http://$NEW_IP#" .env
    rm -f .env.bak
    echo "✅ .env updated"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Update settings.py
echo "📝 Updating backend/backend/settings.py..."
if [ -f "backend/backend/settings.py" ]; then
    sed -i.bak "s#\"http://[0-9.]*\",  # Production EC2 server#\"http://$NEW_IP\",  # Production EC2 server (updated)#" backend/backend/settings.py
    rm -f backend/backend/settings.py.bak
    echo "✅ settings.py updated"
else
    echo "⚠️  backend/backend/settings.py not found - skipping"
fi

# Update create_superuser.py
echo "📝 Updating create_superuser.py..."
if [ -f "create_superuser.py" ]; then
    sed -i.bak "s#http://[0-9.]*/admin/#http://$NEW_IP/admin/#" create_superuser.py
    rm -f create_superuser.py.bak
    echo "✅ create_superuser.py updated"
else
    echo "⚠️  create_superuser.py not found - skipping"
fi

echo ""
echo "================================================"
echo "✅ IP address update complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the changes: git diff"
echo "2. Commit the changes: git add . && git commit -m \"Update IP to $NEW_IP\""
echo "3. Push to GitHub: git push origin main"
echo "4. Deploy to server:"
echo "   ssh ubuntu@$NEW_IP \"cd ~/LMSetjen-DPD-RI && git pull\""
echo "   scp .env ubuntu@$NEW_IP:~/LMSetjen-DPD-RI/.env"
echo "   ssh ubuntu@$NEW_IP \"cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml down\""
echo "   ssh ubuntu@$NEW_IP \"cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml up -d --build\""
echo ""
echo "🌐 New URLs:"
echo "   Frontend: http://$NEW_IP/"
echo "   Backend API: http://$NEW_IP/api/v1/"
echo "   Django Admin: http://$NEW_IP/admin/"
echo "   Swagger Docs: http://$NEW_IP/swagger/"
echo ""
