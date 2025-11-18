#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# LMSetjen DPD RI - Production Deployment Script
# Version: 1.0.0 | Date: November 18, 2025
# Purpose: Automated deployment of SSO integration to production server
#
# USAGE:
#   chmod +x deploy-production.sh
#   ./deploy-production.sh
#
# This script will:
#   1. Backup database and media files
#   2. Pull latest code from GitHub
#   3. Verify environment configuration
#   4. Rebuild Docker containers
#   5. Apply database migrations
#   6. Perform health checks
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit immediately on error

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

PROJECT_PATH="${PROJECT_PATH:-.}"
BACKUP_DIR="${PROJECT_PATH}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${BACKUP_DIR}/deployment_${TIMESTAMP}.log"
DB_NAME="${DB_NAME:-lmsetjen_db}"
DB_USER="${DB_USER:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

log() {
    local message="$1"
    local timestamp=$(date +'%Y-%m-%d %H:%M:%S')
    echo -e "${CYAN}[${timestamp}]${NC} ${message}" | tee -a "${LOG_FILE}"
}

log_success() {
    local message="$1"
    log "${GREEN}✅ ${message}${NC}"
}

log_info() {
    local message="$1"
    log "${BLUE}ℹ️  ${message}${NC}"
}

log_warning() {
    local message="$1"
    log "${YELLOW}⚠️  ${message}${NC}"
}

log_error() {
    local message="$1"
    log "${RED}❌ ${message}${NC}"
}

print_header() {
    local title="$1"
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} ${title}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════════╝${NC}\n"
}

# ═══════════════════════════════════════════════════════════════════════════════
# ERROR HANDLING
# ═══════════════════════════════════════════════════════════════════════════════

cleanup() {
    log_warning "Deployment interrupted or failed"
    log_info "Logs saved to: ${LOG_FILE}"
}

trap cleanup EXIT

handle_error() {
    log_error "$1"
    log_info "Deployment failed. Check logs: ${LOG_FILE}"
    exit 1
}

trap 'handle_error "An error occurred during deployment"' ERR

# ═══════════════════════════════════════════════════════════════════════════════
# PRE-DEPLOYMENT CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "PRE-DEPLOYMENT CHECKS"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    handle_error "Docker is not installed"
fi
log_success "Docker is installed"

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    handle_error "Docker Compose is not available"
fi
log_success "Docker Compose is available"

# Check if git is installed
if ! command -v git &> /dev/null; then
    handle_error "Git is not installed"
fi
log_success "Git is installed"

# Check project directory
if [ ! -d "${PROJECT_PATH}" ]; then
    handle_error "Project directory not found: ${PROJECT_PATH}"
fi
log_success "Project directory found: ${PROJECT_PATH}"

# Check docker-compose.yml exists
if [ ! -f "${PROJECT_PATH}/docker-compose.yml" ]; then
    handle_error "docker-compose.yml not found in ${PROJECT_PATH}"
fi
log_success "docker-compose.yml found"

# Create backup directory
mkdir -p "${BACKUP_DIR}"
log_success "Backup directory ready: ${BACKUP_DIR}"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: BACKUP
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 1: BACKUP DATABASE & MEDIA"

cd "${PROJECT_PATH}"

log_info "Checking if PostgreSQL container is running..."
if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
    log_info "Backing up PostgreSQL database..."
    if docker compose exec -T postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" > "${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"; then
        DB_BACKUP_SIZE=$(du -h "${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql" | cut -f1)
        log_success "Database backup created: ${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql (${DB_BACKUP_SIZE})"
    else
        log_warning "Could not backup database (it might not be running yet)"
    fi
else
    log_warning "PostgreSQL container not running - skipping database backup"
fi

log_info "Checking if backend container is running..."
if docker compose ps backend 2>/dev/null | grep -q "Up"; then
    log_info "Backing up media files..."
    if docker compose exec -T backend tar -czf - media/ > "${BACKUP_DIR}/media_backup_${TIMESTAMP}.tar.gz"; then
        MEDIA_BACKUP_SIZE=$(du -h "${BACKUP_DIR}/media_backup_${TIMESTAMP}.tar.gz" | cut -f1)
        log_success "Media backup created: ${BACKUP_DIR}/media_backup_${TIMESTAMP}.tar.gz (${MEDIA_BACKUP_SIZE})"
    else
        log_warning "Could not backup media files"
    fi
else
    log_warning "Backend container not running - skipping media backup"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: GIT PULL
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 2: PULL LATEST CODE FROM GITHUB"

log_info "Current commit:"
git log -1 --oneline 2>&1 | tee -a "${LOG_FILE}"

log_info "Fetching from origin..."
if git fetch origin; then
    log_success "Fetched latest code from GitHub"
else
    handle_error "Failed to fetch from GitHub"
fi

log_info "Checking out main branch..."
if git checkout main; then
    log_success "Checked out main branch"
else
    handle_error "Failed to checkout main branch"
fi

log_info "Pulling latest changes..."
if git pull origin main; then
    log_success "Pulled latest changes"
else
    handle_error "Failed to pull from origin/main"
fi

log_info "Latest commit:"
git log -1 --oneline 2>&1 | tee -a "${LOG_FILE}"

# Verify SSO code is present
if [ ! -f "backend/api/sso_utils.py" ]; then
    handle_error "SSO integration files not found - pull may have failed"
fi
log_success "SSO integration files verified"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: ENVIRONMENT VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 3: ENVIRONMENT CONFIGURATION CHECK"

if [ ! -f ".env" ]; then
    log_warning ".env file not found - will use docker-compose defaults"
else
    log_success ".env file found"
    
    # Check for critical SSO variables
    REQUIRED_VARS=("SSO_PROVIDER_URL" "SSO_VERIFY_ENDPOINT" "JWT_SECRET_KEY")
    
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env; then
            log_success "${var} is configured in .env"
        else
            log_warning "${var} not found in .env - please add it"
        fi
    done
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: STOP CURRENT DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 4: STOP CURRENT CONTAINERS"

log_info "Current running containers:"
docker compose ps 2>&1 | tee -a "${LOG_FILE}"

log_info "Stopping containers (this may take a minute)..."
if docker compose down; then
    log_success "Containers stopped successfully"
else
    log_warning "Error stopping containers - continuing anyway"
fi

sleep 2

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: BUILD NEW IMAGES
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 5: BUILD DOCKER IMAGES"

log_info "Building Docker images (this may take 5-10 minutes)..."
if docker compose build --no-cache backend frontend nginx; then
    log_success "Docker images built successfully"
else
    handle_error "Failed to build Docker images"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: START NEW CONTAINERS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 6: START NEW CONTAINERS"

log_info "Starting containers in detached mode..."
if docker compose up -d; then
    log_success "Containers started successfully"
else
    handle_error "Failed to start containers"
fi

log_info "Waiting for services to be ready (30 seconds)..."
sleep 30

log_info "Container status:"
docker compose ps 2>&1 | tee -a "${LOG_FILE}"

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: DATABASE MIGRATIONS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 7: DATABASE MIGRATIONS"

log_info "Waiting for database to be ready..."
sleep 10

log_info "Applying database migrations..."
if docker compose exec -T backend python manage.py migrate; then
    log_success "Database migrations applied successfully"
else
    handle_error "Failed to apply database migrations"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: STATIC FILES
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 8: COLLECT STATIC FILES"

log_info "Collecting Django static files..."
if docker compose exec -T backend python manage.py collectstatic --noinput; then
    log_success "Static files collected successfully"
else
    log_warning "Warning collecting static files - continuing"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: HEALTH CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "STEP 9: HEALTH CHECKS"

log_info "Waiting for services to be ready..."
sleep 10

log_info "Checking backend health..."
if curl -s http://localhost:8000/health/ > /dev/null 2>&1; then
    log_success "Backend is responding"
else
    log_warning "Backend health check - service may still be starting"
fi

log_info "Checking if frontend is responsive..."
if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    log_success "Frontend is responding"
else
    log_warning "Frontend may still be starting - this is normal"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL STATUS
# ═══════════════════════════════════════════════════════════════════════════════

print_header "DEPLOYMENT SUMMARY"

log_success "Deployment completed successfully!"

echo -e "\n${GREEN}📊 DEPLOYMENT DETAILS:${NC}"
echo "  • Database backup: ${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql"
echo "  • Media backup: ${BACKUP_DIR}/media_backup_${TIMESTAMP}.tar.gz"
echo "  • Deployment log: ${LOG_FILE}"
echo ""
echo -e "${GREEN}🔗 ACCESS YOUR APPLICATION:${NC}"
echo "  • Web: https://lmsetjendpdri.duckdns.org"
echo "  • API: https://lmsetjendpdri.duckdns.org/api"
echo "  • Admin: https://lmsetjendpdri.duckdns.org/admin"
echo ""
echo -e "${GREEN}📚 SSO LOGIN:${NC}"
echo "  • Button: 'Login dengan Nusa DPD' on login page"
echo "  • Provider: https://nusadpd.duckdns.org"
echo ""
echo -e "${GREEN}📋 USEFUL COMMANDS:${NC}"
echo "  • View logs: docker compose logs -f backend"
echo "  • Restart services: docker compose restart"
echo "  • Check status: docker compose ps"
echo ""
echo -e "${YELLOW}🆘 ROLLBACK (if something goes wrong):${NC}"
echo "  docker compose down"
echo "  git checkout main~1"
echo "  docker compose up -d --build"
echo "  docker compose exec -T backend python manage.py migrate"
echo ""
echo -e "${GREEN}✅ Deployment verification checklist:${NC}"
echo "  ☐ All containers are running (docker compose ps)"
echo "  ☐ No errors in logs (docker compose logs backend)"
echo "  ☐ Login page shows 'Login dengan Nusa DPD' button"
echo "  ☐ Can access admin panel"
echo "  ☐ API endpoints respond correctly"
echo ""

log_success "Full deployment log available at: ${LOG_FILE}"
