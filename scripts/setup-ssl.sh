#!/bin/bash

# ============================================
# SSL Certificate Setup Script
# LMSetjen DPD RI - Learning Management System
# ============================================
# This script sets up Let's Encrypt SSL certificates
# using Certbot for HTTPS access
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${1}"
EMAIL="${2}"
WEBROOT_PATH="/var/www/certbot"

# Functions
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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if domain and email are provided
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    print_error "Usage: $0 <domain> <email>"
    print_info "Example: $0 lms.example.com admin@example.com"
    exit 1
fi

print_header "SSL Certificate Setup for $DOMAIN"

# Step 1: Check if running as root or with sudo
print_info "Checking permissions..."
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root or with sudo"
    exit 1
fi
print_success "Running with proper permissions"

# Step 2: Update system packages
print_info "Updating system packages..."
apt-get update -qq
print_success "System packages updated"

# Step 3: Install Certbot
print_info "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
    print_success "Certbot installed"
else
    print_success "Certbot already installed"
fi

# Step 4: Create webroot directory
print_info "Creating webroot directory..."
mkdir -p "$WEBROOT_PATH"
chmod -R 755 "$WEBROOT_PATH"
print_success "Webroot directory created"

# Step 5: Stop nginx temporarily for certificate generation
print_info "Checking for running nginx..."
if docker ps | grep -q lms_frontend; then
    print_info "Stopping frontend container temporarily..."
    docker stop lms_frontend
    print_success "Frontend container stopped"
fi

# Step 6: Obtain SSL certificate
print_header "Obtaining SSL Certificate"
print_info "Domain: $DOMAIN"
print_info "Email: $EMAIL"
print_warning "Please ensure your domain DNS points to this server's IP!"

if certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN" \
    --preferred-challenges http; then
    print_success "SSL certificate obtained successfully!"
else
    print_error "Failed to obtain SSL certificate"
    print_info "Restarting frontend container..."
    docker start lms_frontend
    exit 1
fi

# Step 7: Set proper permissions
print_info "Setting certificate permissions..."
chmod 755 /etc/letsencrypt/live
chmod 755 /etc/letsencrypt/archive
print_success "Permissions set"

# Step 8: Create certificate info file
CERT_INFO_FILE="/etc/letsencrypt/cert-info.txt"
cat > "$CERT_INFO_FILE" << EOF
SSL Certificate Information
===========================
Domain: $DOMAIN
Email: $EMAIL
Certificate Path: /etc/letsencrypt/live/$DOMAIN/
Created: $(date)

Files:
- fullchain.pem: Full certificate chain
- privkey.pem: Private key
- cert.pem: Certificate only
- chain.pem: Certificate chain

Certificate expires in 90 days.
Auto-renewal is configured via cron.
EOF
print_success "Certificate info saved to $CERT_INFO_FILE"

# Step 9: Setup auto-renewal cron job
print_info "Setting up auto-renewal..."
CRON_CMD="0 3 * * * certbot renew --quiet --post-hook 'docker restart lms_frontend'"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | crontab -
print_success "Auto-renewal configured (runs daily at 3 AM)"

# Step 10: Display certificate information
print_header "Certificate Information"
certbot certificates

print_header "Next Steps"
echo -e "${GREEN}1. Update docker-compose.yml to expose port 443${NC}"
echo -e "${GREEN}2. Update nginx.conf with SSL configuration${NC}"
echo -e "${GREEN}3. Restart containers: docker compose down && docker compose up -d${NC}"
echo -e "${GREEN}4. Update cookie settings to use secure flag${NC}"
echo -e "${GREEN}5. Test HTTPS access: https://$DOMAIN${NC}"

print_success "SSL certificate setup completed successfully!"

# Display renewal test command
print_info "To test auto-renewal: sudo certbot renew --dry-run"
print_info "To view certificates: sudo certbot certificates"
print_info "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
