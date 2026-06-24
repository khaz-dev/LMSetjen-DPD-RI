################################################################################
#
#  LMSetjen DPD RI - Deploy on Production Server
#  Bash Deployment Script for Linux/Ubuntu Servers
#
#  This script runs ON the production server and deploys/updates
#  the LMS application on that same server.
#
#  USAGE:
#    chmod +x deploy-on-production.sh
#    ./deploy-on-production.sh --mode full-clean-build [--verbose]
#    ./deploy-on-production.sh --mode update-only [--verbose]
#    ./deploy-on-production.sh --mode update-with-data-refresh [--verbose]
#
#  MODES:
#    full-clean-build         Full rebuild, remove containers/volumes (FRESH START)
#    update-only              Pull latest code, rebuild, keep data (NORMAL UPDATE)
#    update-with-data-refresh Update code, refresh database schema (MIGRATION)
#
#  OPTIONS:
#    --mode <mode>           Deployment mode (required)
#    --verbose               Show detailed output
#    --help                  Show help message
#
#  EXAMPLES:
#    # Normal daily update (recommended)
#    ./deploy-on-production.sh --mode update-only
#
#    # Full clean rebuild (use with caution)
#    ./deploy-on-production.sh --mode full-clean-build
#
#    # Update with database migration
#    ./deploy-on-production.sh --mode update-with-data-refresh --verbose
#
#  ASSUMPTIONS:
#    - This script runs ON the target server itself
#    - Docker installed
#    - Project directory contains this script and docker-compose.yml
#    - SSH user has sudo access or is root
#
#  DEFAULT PATHS:
#    Project: directory containing this script
#    Backups: <project>/backups
#    Logs: <project>/backend/logs
#
################################################################################

set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
# Configuration
# ════════════════════════════════════════════════════════════════════════════

# Parse arguments
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE=""
VERBOSE="${VERBOSE:-false}"

# Project configuration
PROJECT_PATH="${SCRIPT_DIR}"
DOCKER_COMPOSE_FILE="${PROJECT_PATH}/docker-compose.yml"
ENV_FILE="${PROJECT_PATH}/.env"
BACKUP_DIR="${PROJECT_PATH}/backups"

# Backup paths
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_BACKUP_FILE="${BACKUP_DIR}/lmsdb_backup_${BACKUP_TIMESTAMP}.sql"
APP_BACKUP_DIR="${BACKUP_DIR}/app_backup_${BACKUP_TIMESTAMP}"
COMPOSE_BIN=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ════════════════════════════════════════════════════════════════════════════
# Functions
# ════════════════════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${CYAN}→ $1${NC}"
}

print_verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${BLUE}   $1${NC}"
    fi
}

show_help() {
    echo ""
    echo "════════════════════════════════════════════════════════════════════════"
    echo "LMSetjen DPD RI - Server Deployment Script"
    echo "════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "USAGE:"
    echo "  ./deploy-on-production.sh --mode <mode> [OPTIONS]"
    echo ""
    echo "MODES:"
    echo "  full-clean-build          Full rebuild (removes containers/volumes)"
    echo "  update-only               Update code and rebuild (keep data)"
    echo "  update-with-data-refresh  Update code and refresh database schema"
    echo ""
    echo "OPTIONS:"
    echo "  --mode <mode>             Deployment mode (required)"
    echo "  --verbose                 Show detailed output"
    echo "  --help                    Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Normal update (recommended daily)"
    echo "  ./deploy-on-production.sh --mode update-only"
    echo ""
    echo "  # Full clean rebuild (careful with data!)"
    echo "  ./deploy-on-production.sh --mode full-clean-build"
    echo ""
    echo "  # Update with database refresh"
    echo "  ./deploy-on-production.sh --mode update-with-data-refresh --verbose"
    echo ""
    echo "PROJECT PATH:"
    echo "  ${PROJECT_PATH}"
    echo ""
    echo "BACKUPS LOCATION:"
    echo "  ${BACKUP_DIR}"
    echo ""
}

run_compose() {
    if [ "$COMPOSE_BIN" = "docker compose" ]; then
        docker compose "$@"
    else
        docker-compose "$@"
    fi
}

sync_environment_file() {
    if [ -f "${PROJECT_PATH}/.env.production" ]; then
        cp -f "${PROJECT_PATH}/.env.production" "$ENV_FILE"
        print_verbose "✓ Applied .env.production to .env"
    elif [ ! -f "$ENV_FILE" ]; then
        print_error "Neither .env.production nor .env found in: $PROJECT_PATH"
        exit 1
    else
        print_warning ".env.production not found, using existing .env"
    fi
}

load_environment() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error ".env file not found at: $ENV_FILE"
        exit 1
    fi

    get_env_value() {
        local key="$1"
        awk -F'=' -v search_key="$key" '$1 == search_key { sub(/\r$/, "", $2); print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE"
    }

    DB_NAME="$(get_env_value "DB_NAME")"
    DB_USER="$(get_env_value "DB_USER")"
    DB_PASSWORD="$(get_env_value "DB_PASSWORD")"
    DB_HOST="$(get_env_value "DB_HOST")"
    DB_PORT="$(get_env_value "DB_PORT")"

    : "${DB_NAME:?DB_NAME is required in .env}"
    : "${DB_USER:?DB_USER is required in .env}"
    : "${DB_PASSWORD:?DB_PASSWORD is required in .env}"
    : "${DB_HOST:?DB_HOST is required in .env}"
    DB_PORT="${DB_PORT:-5432}"
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                MODE="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE="true"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Validate mode
    case "$MODE" in
        full-clean-build|update-only|update-with-data-refresh)
            ;;
        *)
            print_error "Invalid mode: $MODE"
            show_help
            exit 1
            ;;
    esac
}

check_prerequisites() {
    print_step "Checking prerequisites"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker not installed"
        exit 1
    fi
    print_verbose "✓ Docker installed"
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_BIN="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_BIN="docker compose"
    else
        print_error "Docker Compose not installed"
        exit 1
    fi
    print_verbose "✓ Compose command: ${COMPOSE_BIN}"

    if ! command -v git &> /dev/null; then
        print_error "Git not installed"
        exit 1
    fi
    print_verbose "✓ Git installed"
    
    # Check project directory
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "docker-compose.yml not found at: $PROJECT_PATH"
        exit 1
    fi
    print_verbose "✓ Project directory found"
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
    print_verbose "✓ Docker daemon running"

    sync_environment_file
    load_environment
    print_verbose "✓ Environment file loaded"
    
    print_success "All prerequisites met"
}

backup_database() {
    print_step "Backing up production database"
    
    mkdir -p "$BACKUP_DIR"
    
    if run_compose exec -T backend env PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$DB_BACKUP_FILE" 2>/dev/null; then
        print_success "Database backed up to: $DB_BACKUP_FILE"
        print_verbose "Backup size: $(du -h "$DB_BACKUP_FILE" | cut -f1)"
        return 0
    else
        print_error "Database backup failed"
        return 1
    fi
}

backup_application() {
    print_step "Backing up application files"
    
    mkdir -p "$BACKUP_DIR"
    
    if tar -czf "${APP_BACKUP_DIR}.tar.gz" \
        --exclude='.git' \
        --exclude='backups' \
        --exclude='node_modules' \
        --exclude='venv' \
        --exclude='__pycache__' \
        --exclude='staticfiles' \
        -C "$(dirname "$PROJECT_PATH")" "$(basename "$PROJECT_PATH")" 2>/dev/null; then
        print_success "Application backed up to: ${APP_BACKUP_DIR}.tar.gz"
        print_verbose "Backup size: $(du -h "${APP_BACKUP_DIR}.tar.gz" | cut -f1)"
        return 0
    else
        print_warning "Application backup failed (non-critical, continuing...)"
        return 0
    fi
}

pull_latest_code() {
    print_step "Pulling latest code from git"
    
    cd "$PROJECT_PATH"

    local current_branch
    current_branch="$(git branch --show-current)"
    print_verbose "Current branch: ${current_branch}"

    git fetch origin main
    git pull --ff-only origin main

    print_success "Code pulled successfully"
}

deploy_full_clean_build() {
    print_header "DEPLOYMENT MODE: Full Clean Build"
    print_warning "This will:"
    print_warning "  - Stop all containers"
    print_warning "  - Remove containers and volumes (DATA WILL BE LOST)"
    print_warning "  - Rebuild Docker images from scratch"
    print_warning "  - Reinitialize database"
    print_warning ""
    
    read -p "Press Enter to continue or Ctrl+C to cancel: "
    
    # Backup first
    backup_database
    backup_application
    
    # Execute deployment
    print_step "Executing full clean build"
    
    cd "$PROJECT_PATH"
    
    print_verbose "Stopping containers..."
    run_compose down -v 2>/dev/null || true
    
    print_verbose "Pulling latest code..."
    pull_latest_code
    
    print_verbose "Building images from scratch..."
    run_compose build --no-cache 2>&1 | tail -20
    
    print_verbose "Starting containers..."
    run_compose up -d 2>&1 | tail -5
    
    print_verbose "Waiting for services (30 seconds)..."
    sleep 30
    
    print_verbose "Container status:"
    run_compose ps
    
    print_success "Full clean build deployment completed"
    return 0
}

deploy_update_only() {
    print_header "DEPLOYMENT MODE: Update Only"
    print_info "This will:"
    print_info "  - Pull latest code from git"
    print_info "  - Rebuild Docker images with cache"
    print_info "  - Restart containers"
    print_info "  - Keep existing data"
    print_info ""
    
    # Execute deployment
    print_step "Executing update deployment"
    
    cd "$PROJECT_PATH"
    
    print_verbose "Pulling latest code..."
    pull_latest_code
    
    print_verbose "Building images with cache..."
    run_compose build 2>&1 | tail -20
    
    print_verbose "Restarting containers..."
    run_compose down
    run_compose up -d
    
    print_verbose "Waiting for services (20 seconds)..."
    sleep 20
    
    print_verbose "Running migrations..."
    run_compose exec -T backend python manage.py migrate --noinput
    
    print_verbose "Container status:"
    run_compose ps
    
    print_success "Update deployment completed"
    return 0
}

deploy_update_with_data_refresh() {
    print_header "DEPLOYMENT MODE: Update with Data Refresh"
    print_info "This will:"
    print_info "  - Backup current database"
    print_info "  - Pull latest code from git"
    print_info "  - Rebuild Docker images"
    print_info "  - Restart containers"
    print_info "  - Run database migrations"
    print_info ""
    
    # Backup first
    backup_database
    backup_application
    
    # Execute deployment
    print_step "Executing update with data refresh"
    
    cd "$PROJECT_PATH"
    
    print_verbose "Pulling latest code..."
    pull_latest_code
    
    print_verbose "Building images..."
    run_compose build 2>&1 | tail -20
    
    print_verbose "Restarting containers..."
    run_compose down
    run_compose up -d
    
    print_verbose "Waiting for database (15 seconds)..."
    sleep 15
    
    print_verbose "Running migrations..."
    run_compose exec -T backend python manage.py migrate --noinput 2>&1 | tail -10
    
    print_verbose "Initializing default users..."
    run_compose exec -T backend python manage.py init_db --skip-if-exists 2>&1 | tail -5
    
    print_verbose "Collecting static files..."
    run_compose exec -T backend python manage.py collectstatic --noinput --clear 2>&1 | tail -5
    
    print_verbose "Container status:"
    run_compose ps
    
    print_success "Update with data refresh deployment completed"
    return 0
}

show_deployment_info() {
    print_header "Deployment Complete!"
    
    print_info "Application is now running on this server:"
    print_info "  Frontend:  https://lms.dpd.go.id"
    print_info "  Backend API: https://lms-be.dpd.go.id/api/v1/"
    print_info "  Admin Panel: https://lms-be.dpd.go.id/admin/"
    print_info "  API Docs: https://lms-be.dpd.go.id/api/v1/swagger/"
    print_info ""
    print_info "Database and backups:"
    print_info "  Backups location: ${BACKUP_DIR}"
    print_info "  Latest backup: ${DB_BACKUP_FILE}"
    print_info ""
    print_info "Useful commands:"
    print_info "  View logs: ${COMPOSE_BIN} logs -f"
    print_info "  Container status: ${COMPOSE_BIN} ps"
    print_info "  Restart backend: ${COMPOSE_BIN} restart backend"
    print_info "  Database shell: docker exec -it lms_backend psql -U postgres -d lmsdb"
    print_info ""
    print_info "Project directory:"
    print_info "  ${PROJECT_PATH}"
}

# ════════════════════════════════════════════════════════════════════════════
# Main Execution
# ════════════════════════════════════════════════════════════════════════════

main() {
    parse_arguments "$@"
    
    if [ -z "$MODE" ]; then
        print_error "Mode is required"
        show_help
        exit 1
    fi
    
    print_header "LMSetjen DPD RI - Server Deployment"
    print_info "Mode: $MODE"
    print_info "Project Path: $PROJECT_PATH"
    print_info ""
    
    # Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi
    
    # Execute deployment based on mode
    case "$MODE" in
        full-clean-build)
            deploy_full_clean_build || exit 1
            ;;
        update-only)
            deploy_update_only || exit 1
            ;;
        update-with-data-refresh)
            deploy_update_with_data_refresh || exit 1
            ;;
    esac
    
    show_deployment_info
    print_success "All deployment steps completed successfully"
}

# Run main function
main "$@"
