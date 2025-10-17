#!/bin/bash

# ============================================
# SSL Management Helper Script
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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

show_menu() {
    print_header "SSL Certificate Management"
    echo "1. View certificate information"
    echo "2. Test SSL configuration"
    echo "3. Renew certificate (manual)"
    echo "4. Test auto-renewal (dry run)"
    echo "5. Check certificate expiration"
    echo "6. View renewal logs"
    echo "7. Backup certificates"
    echo "8. Restore HTTP (remove HTTPS)"
    echo "9. View nginx SSL configuration"
    echo "0. Exit"
    echo ""
    read -p "Select an option: " choice
    echo ""
}

view_certificates() {
    print_header "SSL Certificates"
    if command -v certbot &> /dev/null; then
        sudo certbot certificates
    else
        print_error "Certbot not installed"
    fi
}

test_ssl() {
    read -p "Enter domain to test: " domain
    if [ -z "$domain" ]; then
        print_error "Domain required"
        return
    fi
    
    print_header "Testing SSL Configuration for $domain"
    
    print_info "Testing HTTPS connection..."
    if curl -sSf -I "https://$domain" > /dev/null 2>&1; then
        print_success "HTTPS connection successful"
    else
        print_error "HTTPS connection failed"
    fi
    
    print_info "Testing HTTP redirect..."
    REDIRECT=$(curl -sI "http://$domain" | grep -i "location: https")
    if [ -n "$REDIRECT" ]; then
        print_success "HTTP redirects to HTTPS"
    else
        print_warning "HTTP does not redirect to HTTPS"
    fi
    
    print_info "Checking SSL certificate..."
    echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates
    
    print_info "Online test: https://www.ssllabs.com/ssltest/analyze.html?d=$domain"
}

renew_certificate() {
    print_header "Renewing SSL Certificate"
    print_warning "This will restart the frontend container"
    read -p "Continue? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        sudo certbot renew
        docker restart lms_frontend
        print_success "Certificate renewed and container restarted"
    else
        print_info "Renewal cancelled"
    fi
}

test_renewal() {
    print_header "Testing Certificate Renewal (Dry Run)"
    sudo certbot renew --dry-run
}

check_expiration() {
    print_header "Certificate Expiration Check"
    
    if [ ! -d "/etc/letsencrypt/live" ]; then
        print_error "No certificates found"
        return
    fi
    
    for domain_dir in /etc/letsencrypt/live/*/; do
        domain=$(basename "$domain_dir")
        if [ "$domain" == "README" ]; then
            continue
        fi
        
        cert_file="$domain_dir/cert.pem"
        if [ -f "$cert_file" ]; then
            echo -e "${BLUE}Domain: $domain${NC}"
            
            EXPIRY_DATE=$(sudo openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
            EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
            NOW_EPOCH=$(date +%s)
            DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
            
            if [ $DAYS_LEFT -lt 30 ]; then
                echo -e "  ${RED}⚠️  Expires in $DAYS_LEFT days (Renewal needed!)${NC}"
            else
                echo -e "  ${GREEN}✓ Valid for $DAYS_LEFT more days${NC}"
            fi
            echo -e "  Expiry date: $EXPIRY_DATE"
            echo ""
        fi
    done
}

view_logs() {
    print_header "Certificate Renewal Logs"
    if [ -f "/var/log/letsencrypt/letsencrypt.log" ]; then
        sudo tail -n 50 /var/log/letsencrypt/letsencrypt.log
    else
        print_error "Log file not found"
    fi
}

backup_certificates() {
    print_header "Backing Up SSL Certificates"
    
    BACKUP_FILE="letsencrypt-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    BACKUP_DIR="/home/ubuntu/ssl-backups"
    
    mkdir -p "$BACKUP_DIR"
    
    print_info "Creating backup..."
    sudo tar -czf "$BACKUP_DIR/$BACKUP_FILE" /etc/letsencrypt/ 2>/dev/null
    
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        sudo chown ubuntu:ubuntu "$BACKUP_DIR/$BACKUP_FILE"
        print_success "Backup created: $BACKUP_DIR/$BACKUP_FILE"
        
        SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        print_info "Backup size: $SIZE"
    else
        print_error "Backup failed"
    fi
}

restore_http() {
    print_header "Restore HTTP Configuration"
    print_warning "This will disable HTTPS and revert to HTTP only!"
    print_warning "Your site will no longer be secure."
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Operation cancelled"
        return
    fi
    
    PROJECT_DIR="/home/ubuntu/LMSetjen-DPD-RI"
    
    print_info "Restoring nginx configuration..."
    if [ -f "$PROJECT_DIR/frontend/nginx.conf.backup"* ]; then
        BACKUP=$(ls -t "$PROJECT_DIR/frontend/nginx.conf.backup"* | head -1)
        cp "$BACKUP" "$PROJECT_DIR/frontend/nginx.conf"
        print_success "Nginx config restored"
    else
        print_error "No backup found"
    fi
    
    print_info "Updating docker-compose.yml..."
    cd "$PROJECT_DIR"
    sed -i '/- "443:443"/d' docker-compose.yml
    sed -i '/\/etc\/letsencrypt/d' docker-compose.yml
    sed -i '/\/var\/www\/certbot/d' docker-compose.yml
    
    print_info "Rebuilding frontend..."
    docker compose down frontend
    docker compose up -d --build frontend
    
    print_success "HTTP restored. HTTPS disabled."
    print_info "Don't forget to update cookie settings (remove secure flag)"
}

view_nginx_config() {
    print_header "Nginx SSL Configuration"
    docker exec lms_frontend cat /etc/nginx/conf.d/default.conf
}

# Main loop
while true; do
    show_menu
    
    case $choice in
        1) view_certificates ;;
        2) test_ssl ;;
        3) renew_certificate ;;
        4) test_renewal ;;
        5) check_expiration ;;
        6) view_logs ;;
        7) backup_certificates ;;
        8) restore_http ;;
        9) view_nginx_config ;;
        0) 
            print_success "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done
