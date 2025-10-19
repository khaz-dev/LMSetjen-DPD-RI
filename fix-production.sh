#!/bin/bash
# Quick Fix Script for Production Deployment Issues
# Run this on your production server

echo "=========================================="
echo "🔧 LMS Production Deployment Quick Fix"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

echo "📋 Step 1: Checking current status..."
docker compose -f docker-compose.prod.yml ps
echo ""

echo "⏸️  Step 2: Stopping containers..."
docker compose -f docker-compose.prod.yml down
echo ""

echo "📝 Step 3: Creating HTTP-only nginx config..."
mkdir -p docker/frontend/nginx

cat > docker/frontend/nginx/default.conf << 'EOF'
server {
    listen 80;
    server_name lmsetjendpdri.duckdns.org;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_comp_level 6;
    
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /media/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }
    
    location /static/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
    }
    
    location /admin/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

echo "✅ HTTP-only config created"
echo ""

echo "🔨 Step 4: Rebuilding frontend..."
docker compose -f docker-compose.prod.yml build --no-cache frontend
echo ""

echo "🚀 Step 5: Starting all services..."
docker compose -f docker-compose.prod.yml up -d
echo ""

echo "⏳ Step 6: Waiting for services to start..."
sleep 10
echo ""

echo "📊 Step 7: Checking status..."
docker compose -f docker-compose.prod.yml ps
echo ""

echo "=========================================="
echo "✅ Quick Fix Applied!"
echo "=========================================="
echo ""
echo "🔍 Next Steps:"
echo "1. Check if frontend is running: docker compose -f docker-compose.prod.yml ps"
echo "2. View logs: docker compose -f docker-compose.prod.yml logs -f frontend"
echo "3. Test site: http://$(curl -s ifconfig.me)"
echo ""
echo "⚠️  Note: This fix disabled HTTPS temporarily"
echo "📚 To add SSL later, see: PRODUCTION_DEPLOYMENT_FIX.md"
echo ""
