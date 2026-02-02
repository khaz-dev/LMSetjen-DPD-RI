#!/bin/bash

################################################################################
#                                                                              #
#  LMSetjen DPD RI - Bash Deployment Script for Ubuntu Server                #
#  Equivalent to deploy.ps1 for PowerShell/Windows                           #
#                                                                              #
#  Usage: ./deploy.sh [command]                                              #
#                                                                              #
#  This script provides simple one-command deployment for Linux/Ubuntu       #
#  servers using Docker Compose.                                             #
#                                                                              #
################################################################################

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
ENV_FILE="$PROJECT_ROOT/.env"

# Colors for output
Green='\033[0;32m'
Red='\033[0;31m'
Yellow='\033[1;33m'
Cyan='\033[0;36m'
NC='\033[0m' # No Color

# ════════════════════════════════════════════════════════════════════════════
# Functions
# ════════════════════════════════════════════════════════════════════════════

write_header() {
    echo ""
    echo -e "${Cyan}[DEPLOYMENT]${NC}"
    echo -e "${Cyan}$1${NC}"
    echo ""
}

write_success() {
    echo -e "${Green}✅ $1${NC}"
}

write_error() {
    echo -e "${Red}❌ $1${NC}"
}

write_warning() {
    echo -e "${Yellow}⚠️  $1${NC}"
}

show_help() {
    write_header "LMSetjen DPD RI - Deployment Commands"
    cat << 'EOF'
Usage: ./deploy.sh [command]

Commands:
  up              Start all containers (default)
  down            Stop all containers
  status          Show container status
  logs            Show recent logs
  restart         Restart all containers
  clean           Clean rebuild (removes containers & volumes)
  help            Show this help message

Examples:
  ./deploy.sh              # Start all services
  ./deploy.sh status       # Check container status
  ./deploy.sh restart      # Restart services
  ./deploy.sh down         # Stop all services
  ./deploy.sh logs         # View logs with live follow
  ./deploy.sh clean        # Full rebuild (WARNING: removes data)
  ./deploy.sh help         # Show this help

Service URLs:
  Frontend: http://localhost:5174
  Backend:  https://lms.dpd.go.id/api/v1/
  Health:   https://lms.dpd.go.id/api/v1/health/

Default Database Credentials:
  Host:     localhost
  Port:     5432
  User:     postgres
  Password: Okkdpdri@2026
  Database: lmsdb

For more information:
  - Check .env file for configuration
  - View logs: docker-compose logs -f [backend|frontend|redis]
  - Check container status: ./deploy.sh status
EOF
}

# ════════════════════════════════════════════════════════════════════════════
# Main Script
# ════════════════════════════════════════════════════════════════════════════

# Check Docker installation
if ! command -v docker &> /dev/null; then
    write_error "Docker not found. Please install Docker first."
    exit 1
fi

write_success "Docker: $(docker --version)"

# Check Docker Compose installation
if ! command -v docker-compose &> /dev/null; then
    write_error "Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

write_success "Docker Compose: $(docker-compose --version)"

# Check .env file
if [ ! -f "$ENV_FILE" ]; then
    write_error ".env not found at $ENV_FILE"
    exit 1
fi

write_success ".env found"

# Change to project root directory
cd "$PROJECT_ROOT" || exit 1

# Get command (default to 'up')
COMMAND="${1:-up}"

# Execute command
case "$COMMAND" in
    up)
        write_header "Starting Services"
        docker-compose up -d
        if [ $? -eq 0 ]; then
            write_success "Services started"
            echo ""
            echo "URLs:"
            echo "  Frontend: http://localhost:5174"
            echo "  Backend:  https://lms.dpd.go.id/api"
            echo "  Health:   https://lms.dpd.go.id/api/v1/health/"
            echo ""
        else
            write_error "Failed to start services"
            exit 1
        fi
        ;;
    
    down)
        write_header "Stopping Services"
        docker-compose down
        if [ $? -eq 0 ]; then
            write_success "Services stopped"
        else
            write_error "Failed to stop services"
            exit 1
        fi
        ;;
    
    status)
        write_header "Container Status"
        docker-compose ps
        ;;
    
    logs)
        write_header "Recent Logs (Press Ctrl+C to exit)"
        docker-compose logs --tail=50 -f
        ;;
    
    restart)
        write_header "Restarting Services"
        docker-compose restart
        if [ $? -eq 0 ]; then
            write_success "Services restarted"
        else
            write_error "Failed to restart services"
            exit 1
        fi
        ;;
    
    clean)
        write_header "Clean Rebuild"
        write_warning "This will remove all containers and volumes"
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v --remove-orphans
            write_success "Old containers and volumes removed"
            echo ""
            write_header "Building and Starting Services"
            docker-compose up -d --build
            if [ $? -eq 0 ]; then
                write_success "Rebuild complete"
                echo ""
                echo "URLs:"
                echo "  Frontend: http://localhost:5174"
                echo "  Backend:  https://lms.dpd.go.id/api"
                echo ""
            else
                write_error "Failed to rebuild services"
                exit 1
            fi
        else
            write_warning "Clean rebuild cancelled"
        fi
        ;;
    
    help|--help|-h)
        show_help
        ;;
    
    *)
        write_error "Unknown command: $COMMAND"
        echo ""
        echo "Use './deploy.sh help' to see available commands"
        exit 1
        ;;
esac

# ════════════════════════════════════════════════════════════════════════════
# End of Script
# ════════════════════════════════════════════════════════════════════════════
