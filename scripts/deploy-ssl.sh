#!/bin/bash

# ============================================
# SSL Configuration Deployment Script
# LMSetjen DPD RI - Learning Management System
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Get domain name
DOMAIN="${1}"
if [ -z "$DOMAIN" ]; then
    print_error "Usage: $0 <domain>"
    print_info "Example: $0 lms.example.com"
    exit 1
fi

print_header "Deploying SSL Configuration for $DOMAIN"

# Check if SSL certificate exists
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
    print_error "SSL certificate not found at $CERT_PATH"
    print_info "Please run setup-ssl.sh first to obtain a certificate"
    exit 1
fi

print_success "SSL certificate found"

# Get project directory
PROJECT_DIR="/home/ubuntu/LMSetjen-DPD-RI"
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Step 1: Backup current nginx config
print_info "Backing up current nginx configuration..."
if [ -f "frontend/nginx.conf" ]; then
    cp frontend/nginx.conf "frontend/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)"
    print_success "Backup created"
fi

# Step 2: Update nginx config with domain name
print_info "Updating nginx configuration..."
cp frontend/nginx-ssl.conf frontend/nginx.conf
sed -i "s/DOMAIN_NAME/$DOMAIN/g" frontend/nginx.conf
print_success "Nginx configuration updated"

# Step 3: Update docker-compose.yml for SSL
print_info "Updating docker-compose.yml..."
if ! grep -q "443:443" docker-compose.yml; then
    # Backup docker-compose.yml
    cp docker-compose.yml "docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Add SSL port and volumes using sed
    sed -i '/ports:/,/- "80:80"/ {
        s/- "80:80"/- "80:80"\n      - "443:443"/
    }' docker-compose.yml
    
    sed -i '/frontend:/,/healthcheck:/ {
        /depends_on:/i\    volumes:\n      - /etc/letsencrypt:/etc/letsencrypt:ro\n      - /var/www/certbot:/var/www/certbot:ro
    }' docker-compose.yml
    
    print_success "docker-compose.yml updated"
else
    print_success "docker-compose.yml already configured for SSL"
fi

# Step 4: Rebuild frontend container
print_info "Rebuilding frontend container..."
docker compose down frontend
docker compose up -d --build frontend

# Wait for container to be healthy
print_info "Waiting for container to be healthy..."
sleep 10

# Step 5: Verify HTTPS is working
print_info "Verifying HTTPS configuration..."
if curl -sSf -k "https://$DOMAIN/health" > /dev/null 2>&1; then
    print_success "HTTPS is working!"
else
    print_error "HTTPS verification failed"
    print_info "Check logs: docker logs lms_frontend"
fi

print_header "SSL Configuration Deployment Complete"
echo -e "${GREEN}✓ HTTPS is now enabled for $DOMAIN${NC}"
echo -e "${GREEN}✓ HTTP traffic will redirect to HTTPS${NC}"
echo -e "${GREEN}✓ SSL certificate will auto-renew${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Update cookie settings to use secure flag"
echo -e "2. Test access: https://$DOMAIN"
echo -e "3. Update .env files with HTTPS URLs"
echo ""
print_info "View logs: docker logs lms_frontend"
print_info "Test SSL: curl -I https://$DOMAIN"
