#!/bin/bash

# ============================================
# Production Deployment Simulation Script
# LMSetjen DPD RI - Linux/Mac
# ============================================

echo "=================================================="
echo "🚀 Production Deployment Simulation Setup"
echo "LMSetjen DPD RI"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check PostgreSQL
echo -e "${YELLOW}Step 1: Checking PostgreSQL Connection${NC}"
echo "==========================================="

if pg_isready -h localhost -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is running on localhost:5432${NC}"
else
    echo -e "${RED}❌ PostgreSQL is NOT running on localhost:5432${NC}"
    echo "   Please start PostgreSQL and try again"
    echo "   Mac: brew services start postgresql"
    echo "   Linux: sudo systemctl start postgresql"
    exit 1
fi

# Step 2: Test database connection
echo ""
echo -e "${YELLOW}Step 2: Testing Database Credentials${NC}"
echo "==========================================="

if PGPASSWORD="Okkdpdri2026" psql -h localhost -U postgres -d postgres -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${YELLOW}⚠️  Could not connect with password 'Okkdpdri2026'${NC}"
    echo "   Update DB_PASSWORD in .env if needed"
fi

# Step 3: Create .env file if not exists
echo ""
echo -e "${YELLOW}Step 3: Creating Environment File${NC}"
echo "==========================================="

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << 'EOF'
# Django
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# URLs
FRONTEND_SITE_URL=http://localhost:3000
BACKEND_SITE_URL=http://localhost:9000

# PostgreSQL on HOST
DB_ENGINE=django.db.backends.postgresql
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=Okkdpdri2026
DB_HOST=localhost
DB_PORT=5432

# Redis in Docker
REDIS_URL=redis://:redis_password@redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Email & OAuth
SENDGRID_API_KEY=your-key
FROM_EMAIL=noreply@example.com
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/login

# Logging
DJANGO_LOG_LEVEL=INFO
VITE_API_BASE_URL=/api
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Step 4: Stop existing containers
echo ""
echo -e "${YELLOW}Step 4: Stopping Existing Containers${NC}"
echo "==========================================="

docker-compose down -v > /dev/null 2>&1
echo -e "${GREEN}✅ Containers stopped${NC}"

# Step 5: Start production simulation
echo ""
echo -e "${YELLOW}Step 5: Starting Production Simulation${NC}"
echo "==========================================="

echo "Starting Docker containers..."
docker-compose -f docker-compose.production.yml up -d

# Wait for containers to start
echo "Waiting for services to be ready..."
sleep 10

# Step 6: Check container status
echo ""
echo -e "${YELLOW}Step 6: Checking Container Status${NC}"
echo "==========================================="

docker-compose -f docker-compose.production.yml ps

# Step 7: Test services
echo ""
echo -e "${YELLOW}Step 7: Testing Services${NC}"
echo "==========================================="

# Test backend
if curl -s http://localhost:9000/api/v1/health/ > /dev/null; then
    echo -e "${GREEN}✅ Backend is running on port 9000${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is starting... (may take a minute)${NC}"
fi

# Test frontend
if curl -s http://localhost:3000/ > /dev/null; then
    echo -e "${GREEN}✅ Frontend is running on port 3000${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is starting... (may take a minute)${NC}"
fi

# Step 8: Display summary
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Production Simulation Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "📍 Access your application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:9000"
echo ""
echo "🗄️  Database:"
echo "   Host:     localhost"
echo "   User:     postgres"
echo "   Password: Okkdpdri2026"
echo "   Port:     5432"
echo ""
echo "📊 Docker Services:"
echo "   Backend:  lms_backend_prod (Gunicorn on :8000)"
echo "   Frontend: lms_frontend_prod (Node serve on :80)"
echo "   Redis:    lms_redis_prod (Cache)"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:      docker-compose -f docker-compose.production.yml logs -f"
echo "   Stop services:  docker-compose -f docker-compose.production.yml down"
echo "   View status:    docker-compose -f docker-compose.production.yml ps"
echo "   Backend shell:  docker-compose -f docker-compose.production.yml exec backend bash"
echo ""
echo "🔍 Verify Database Connection:"
echo "   docker-compose -f docker-compose.production.yml exec backend python manage.py dbshell"
echo ""
echo "=================================================="
echo "Next: Open http://localhost:3000 in your browser!"
echo "=================================================="
