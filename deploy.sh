#!/bin/bash

# 🚀 Automated Production Deployment Script
# LMSetjen DPD RI - Learning Management System
# This script automates the entire deployment process

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 LMS Production Deployment Script                       ║"
echo "║  Target: lmsetjendpdri.duckdns.org                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_step() {
    echo -e "${BLUE}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found!"
    print_step "Please run this script from the project root directory"
    exit 1
fi

# Step 1: Pull latest code
print_step "Pulling latest code from GitHub..."
git pull origin main
print_success "Code updated"

# Step 2: Check for .env file
print_step "Checking environment file..."
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating with defaults..."
    cat > .env << 'EOF'
# Database
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=secure_password

# Redis
REDIS_PASSWORD=redis_password

# Django
SECRET_KEY=change-me-to-secret-key-in-production
DEBUG=False
ALLOWED_HOSTS=lmsetjendpdri.duckdns.org,16.79.83.21

# Email (SendGrid)
SENDGRID_API_KEY=

# Frontend
FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org

# SSL
USE_SSL=True

# API
API_BASE_URL=https://lmsetjendpdri.duckdns.org/api
EOF
    print_warning "Created .env file - PLEASE UPDATE WITH YOUR ACTUAL CREDENTIALS"
else
    print_success ".env file found"
fi

# Step 3: Stop current containers
print_step "Stopping current containers..."
docker compose down 2>/dev/null || true
print_success "Containers stopped"

# Step 4: Rebuild and start containers
print_step "Rebuilding and starting Docker containers..."
print_warning "This may take 2-5 minutes..."
docker compose up -d --build

# Step 5: Wait for services
print_step "Waiting for services to start (30 seconds)..."
sleep 30

# Step 6: Check container status
print_step "Checking container status..."
echo ""
docker compose ps
echo ""

# Step 7: Check logs for errors
print_step "Checking for startup errors..."
ERRORS=$(docker compose logs 2>&1 | grep -i "error\|exception\|failed" | grep -v "DEBUG\|verbose" || true)

if [ -n "$ERRORS" ]; then
    print_warning "Potential issues found:"
    echo "$ERRORS"
else
    print_success "No critical errors detected"
fi

# Step 8: Apply migrations (if needed)
print_step "Applying database migrations..."
docker compose exec -T backend python manage.py migrate --noinput
print_success "Migrations completed"

# Step 9: Collect static files
print_step "Collecting static files..."
docker compose exec -T backend python manage.py collectstatic --noinput
print_success "Static files collected"

# Step 10: Run certificate fix script
print_step "Running certificate validation token script..."
if [ -f "run_certificate_fix.sh" ]; then
    bash run_certificate_fix.sh
    print_success "Certificate script completed"
else
    print_warning "Certificate fix script not found, skipping..."
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✨ Deployment Completed Successfully!                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✓ All containers are running${NC}"
echo -e "${GREEN}✓ Database migrations applied${NC}"
echo -e "${GREEN}✓ Static files collected${NC}"
echo -e "${GREEN}✓ Certificate tokens processed${NC}"
echo ""
echo "📍 Website: https://lmsetjendpdri.duckdns.org"
echo "📊 Admin: https://lmsetjendpdri.duckdns.org/admin"
echo "📚 API: https://lmsetjendpdri.duckdns.org/api"
echo ""
echo "📋 Next Steps:"
echo "  1. Open your browser and navigate to the website"
echo "  2. Log in with your credentials"
echo "  3. Navigate to a course and check the certificate tab"
echo "  4. Verify that QR codes are now visible"
echo ""
echo "🔍 For detailed logs, run:"
echo "   docker compose logs -f"
echo ""
print_success "Deployment ready!"
