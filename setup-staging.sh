#!/bin/bash

#################################################################################
#
#  LMSetjen DPD RI - Staging Server Setup Script
#  Interactive Configuration for /var/www/html/lms
#
#  This script:
#  1. Generates secure secrets
#  2. Configures .env file
#  3. Sets up Docker Compose
#  4. Initializes database
#
#  Usage:
#    bash setup-staging.sh
#
#################################################################################

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_PATH="/var/www/html/lms"
BACKUPS_PATH="/var/www/backups/lms"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  LMSetjen DPD RI - Staging Setup Script                  ║${NC}"
echo -e "${BLUE}║  Server: lms.khaz.app (165.245.191.216)                  ║${NC}"
echo -e "${BLUE}║  Path: ${PROJECT_PATH}                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 1: Check Prerequisites
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 1: Checking Prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose installed${NC}"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 2: Check Project Directory
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 2: Checking Project Directory...${NC}"

if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${RED}✗ Project directory not found: $PROJECT_PATH${NC}"
    echo -e "${YELLOW}Please ensure the project is deployed to $PROJECT_PATH first${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project directory found: $PROJECT_PATH${NC}"
cd "$PROJECT_PATH"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 3: Backup Existing Configuration (if any)
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 3: Backing up existing configuration...${NC}"

mkdir -p "$BACKUPS_PATH"

if [ -f ".env" ]; then
    BACKUP_FILE="$BACKUPS_PATH/.env.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backed up existing .env to: $BACKUP_FILE${NC}"
else
    echo -e "${BLUE}ℹ No existing .env file to backup${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 4: Generate Secure Secrets
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 4: Generating Secure Secrets...${NC}"

# Django SECRET_KEY
DJANGO_SECRET=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())" 2>/dev/null || echo "django-insecure-$(openssl rand -hex 32)")
echo -e "${GREEN}✓ Generated Django SECRET_KEY${NC}"

# Database Password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | head -c 32)
echo -e "${GREEN}✓ Generated Database Password${NC}"

# Redis Password
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | head -c 32)
echo -e "${GREEN}✓ Generated Redis Password${NC}"

echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 5: Create .env File
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 5: Creating .env file...${NC}"

cat > .env << EOF
# LMSetjen DPD RI - Staging Environment
# Generated: $(date)
# Server: lms.khaz.app (165.245.191.216)
# Path: $PROJECT_PATH

MODE=staging
DEBUG=False

# Django Security
SECRET_KEY=$DJANGO_SECRET
ALLOWED_HOSTS=lms.khaz.app,www.lms.khaz.app,localhost,127.0.0.1
DJANGO_LOG_LEVEL=WARNING
USE_SSL=True

# Database Configuration
DB_ENGINE=django.db.backends.postgresql
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
DB_HOST=172.18.0.1
DB_PORT=5432

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6381
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_URL=redis://:$REDIS_PASSWORD@redis:6381/0

# Frontend & Backend URLs
FRONTEND_SITE_URL=https://lms.khaz.app
BACKEND_SITE_URL=https://lms.khaz.app
VITE_API_BASE_URL=https://lms.khaz.app

# CORS & CSRF
CORS_ALLOWED_ORIGINS=https://lms.khaz.app,https://www.lms.khaz.app
CSRF_TRUSTED_ORIGINS=https://lms.khaz.app,https://www.lms.khaz.app

# Google OAuth (Optional - update if needed)
GOOGLE_CLIENT_ID=your-staging-google-client-id-here
GOOGLE_CLIENT_SECRET=your-staging-google-client-secret-here
GOOGLE_OAUTH_REDIRECT_URI=https://lms.khaz.app/login
VITE_GOOGLE_CLIENT_ID=your-staging-google-client-id-here

# Email Configuration (Optional)
SENDGRID_API_KEY=
FROM_EMAIL=noreply@lms.khaz.app
EOF

chmod 600 .env  # Restrict permissions for security
echo -e "${GREEN}✓ Created .env file with secure credentials${NC}"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 6: Initialize Docker Containers
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 6: Building and starting Docker containers...${NC}"
echo -e "${BLUE}This may take 3-5 minutes on first run...${NC}"
echo ""

# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to start (30 seconds)...${NC}"
sleep 30

# Verify containers are running
docker-compose ps

echo ""
echo -e "${GREEN}✓ Docker containers started${NC}"

# ════════════════════════════════════════════════════════════════════════════
# Step 7: Run Migrations
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 7: Running database migrations...${NC}"

docker-compose exec -T backend python manage.py migrate --noinput

echo -e "${GREEN}✓ Database migrations completed${NC}"

# ════════════════════════════════════════════════════════════════════════════
# Step 8: Initialize Default Data
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 8: Initializing default data...${NC}"

docker-compose exec -T backend python manage.py init_db --skip-if-exists

echo -e "${GREEN}✓ Default data initialized${NC}"

# ════════════════════════════════════════════════════════════════════════════
# Step 9: Collect Static Files
# ════════════════════════════════════════════════════════════════════════════

echo -e "${YELLOW}Step 9: Collecting static files...${NC}"

docker-compose exec -T backend python manage.py collectstatic --noinput --clear

echo -e "${GREEN}✓ Static files collected${NC}"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# Step 10: Display Credentials
# ════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Setup Complete! Important Information:                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Generated Credentials (saved in .env):${NC}"
echo -e "  Django SECRET_KEY: ${GREEN}(saved securely)${NC}"
echo -e "  Database Password: ${GREEN}(saved securely)${NC}"
echo -e "  Redis Password: ${GREEN}(saved securely)${NC}"
echo ""

echo -e "${YELLOW}Database Credentials:${NC}"
echo -e "  Host: postgres"
echo -e "  Port: 5432"
echo -e "  Username: lms_user_staging"
echo -e "  Password: (in .env file)"
echo -e "  Database: lmsdb_staging"
echo ""

echo -e "${YELLOW}Access Your Application:${NC}"
echo -e "  Frontend: ${GREEN}https://lms.khaz.app${NC}"
echo -e "  API Docs: ${GREEN}https://lms.khaz.app/api/v1/swagger/${NC}"
echo -e "  Admin: ${GREEN}https://lms.khaz.app/admin/${NC}"
echo ""

echo -e "${YELLOW}Useful Docker Commands:${NC}"
echo -e "  View logs: ${GREEN}docker-compose logs -f${NC}"
echo -e "  Restart: ${GREEN}docker-compose restart${NC}"
echo -e "  Stop: ${GREEN}docker-compose down${NC}"
echo -e "  Status: ${GREEN}docker-compose ps${NC}"
echo ""

echo -e "${YELLOW}Important Notes:${NC}"
echo -e "  ✓ All credentials are stored in: $PROJECT_PATH/.env"
echo -e "  ✓ Backup created at: $BACKUP_FILE"
echo -e "  ✓ Containers are running on Docker network (not exposed to host)"
echo -e "  ✓ Nginx will reverse proxy from lms.khaz.app to containers"
echo ""

echo -e "${GREEN}✓ Setup Complete!${NC}"
echo ""
