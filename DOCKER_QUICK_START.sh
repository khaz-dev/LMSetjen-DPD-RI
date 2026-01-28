#!/bin/bash
#
# LMSetjen DPD RI - Docker Quick Start Script
# Usage: ./DOCKER_QUICK_START.sh [start|stop|restart|clean|logs|status]
#

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Action parameter
ACTION="${1:-start}"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  LMSetjen DPD RI - Docker Quick Start"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${NC}"
}

check_prerequisites() {
    echo -e "${BLUE}[1] Checking Prerequisites...${NC}"
    
    # Check Docker
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}  ✓ Docker installed$(docker --version | sed 's/^/  /')${NC}"
    else
        echo -e "${RED}  ✗ Docker NOT found. Install Docker.${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}  ✓ Docker Compose installed$(docker-compose --version | sed 's/^/  /')${NC}"
    else
        echo -e "${RED}  ✗ Docker Compose NOT found.${NC}"
        exit 1
    fi
    
    # Check Docker daemon
    if docker ps &> /dev/null; then
        echo -e "${GREEN}  ✓ Docker daemon running${NC}"
    else
        echo -e "${RED}  ✗ Docker daemon not running.${NC}"
        exit 1
    fi
    
    # Check .env file
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}  ⚠ .env file not found. Creating from .env.example...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}  ✓ .env created from .env.example${NC}"
        else
            echo -e "${RED}  ✗ .env.example not found${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}  ✓ .env file present${NC}"
    fi
}

check_ports() {
    echo -e "\n${BLUE}[2] Checking Port Availability...${NC}"
    
    local ports=(80 443 8000 5432 6379)
    local ports_in_use=()
    
    for port in "${ports[@]}"; do
        if nc -z 127.0.0.1 "$port" 2>/dev/null; then
            ports_in_use+=($port)
            echo -e "${RED}  ✗ Port $port already in use${NC}"
        else
            echo -e "${GREEN}  ✓ Port $port available${NC}"
        fi
    done
    
    if [ ${#ports_in_use[@]} -gt 0 ]; then
        echo -e "\n${YELLOW}  ⚠ Ports in use: ${ports_in_use[@]}${NC}"
        echo -e "  You may need to free these ports or modify docker-compose.yml${NC}"
        read -p "  Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}  Aborted.${NC}"
            exit 1
        fi
    fi
}

start_services() {
    echo -e "\n${BLUE}[3] Starting Services...${NC}"
    
    echo -e "${YELLOW}  Building and starting all containers...${NC}"
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Services started${NC}"
    else
        echo -e "${RED}  ✗ Failed to start services${NC}"
        exit 1
    fi
    
    # Wait for services
    echo -e "\n${BLUE}[4] Waiting for Services to be Ready...${NC}"
    sleep 3
    
    # Check container status
    echo -e "${YELLOW}  Checking container status...${NC}"
    local services=("postgres" "redis" "backend" "frontend")
    
    for service in "${services[@]}"; do
        if docker-compose ps "$service" 2>/dev/null | grep -q "$service"; then
            echo -e "${GREEN}    ✓ $service running${NC}"
        else
            echo -e "${RED}    ✗ $service NOT running${NC}"
        fi
    done
}

show_logs() {
    echo -e "\n${BLUE}[5] Showing Live Logs...${NC}"
    echo -e "${YELLOW}  Press Ctrl+C to stop watching logs${NC}"
    docker-compose logs -f
}

stop_services() {
    echo -e "\n${BLUE}[3] Stopping Services...${NC}"
    docker-compose stop
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Services stopped${NC}"
    else
        echo -e "${RED}  ✗ Failed to stop services${NC}"
        exit 1
    fi
}

restart_services() {
    echo -e "\n${BLUE}[3] Restarting Services...${NC}"
    docker-compose restart
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Services restarted${NC}"
        sleep 2
    else
        echo -e "${RED}  ✗ Failed to restart services${NC}"
        exit 1
    fi
}

clean_services() {
    echo -e "\n${RED}[3] Removing Containers & Volumes...${NC}"
    echo -e "${RED}  ⚠ WARNING: This will DELETE all data!${NC}"
    read -p "  Type 'yes' to confirm: " confirm
    
    if [ "$confirm" = "yes" ]; then
        docker-compose down -v
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  ✓ Cleanup complete${NC}"
        else
            echo -e "${RED}  ✗ Cleanup failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}  Aborted.${NC}"
    fi
}

show_status() {
    echo -e "\n${BLUE}[3] Service Status...${NC}"
    docker-compose ps
}

show_endpoints() {
    echo -e "\n${BLUE}[6] Access Points:${NC}"
    echo -e "  ${GREEN}Frontend:   http://localhost${NC}"
    echo -e "  ${GREEN}API:        http://localhost:8000/api/v1/${NC}"
    echo -e "  ${GREEN}Admin:      http://localhost/admin/${NC}"
    echo -e "  ${GREEN}API Docs:   http://localhost:8000/api/schema/swagger/${NC}"
    echo -e "  ${GREEN}PostgreSQL: localhost:5432 (user: lms_user)${NC}"
    echo -e "  ${GREEN}Redis:      localhost:6379${NC}"
}

show_next_steps() {
    echo -e "\n${BLUE}[7] Next Steps:${NC}"
    echo -e "  ${GREEN}1. Visit http://localhost in your browser${NC}"
    echo -e "  ${GREEN}2. Create a superuser:${NC}"
    echo -e "     ${YELLOW}docker exec -it lms_backend python manage.py createsuperuser${NC}"
    echo -e "  ${GREEN}3. View logs:${NC}"
    echo -e "     ${YELLOW}docker-compose logs -f backend${NC}"
    echo -e "  ${GREEN}4. Test API:${NC}"
    echo -e "     ${YELLOW}curl http://localhost:8000/api/v1/healthz/${NC}"
    echo -e "  ${GREEN}5. Database management:${NC}"
    echo -e "     ${YELLOW}docker exec -it lms_postgres psql -U lms_user -d lms_db${NC}"
}

# Main script
print_header

case "$ACTION" in
    start)
        check_prerequisites
        check_ports
        start_services
        show_endpoints
        echo -e "\n${YELLOW}[6] Waiting 5 seconds before showing logs...${NC}"
        sleep 5
        show_logs
        ;;
    stop)
        check_prerequisites
        stop_services
        ;;
    restart)
        check_prerequisites
        restart_services
        show_status
        show_endpoints
        ;;
    clean)
        check_prerequisites
        clean_services
        ;;
    logs)
        check_prerequisites
        show_logs
        ;;
    status)
        check_prerequisites
        show_status
        show_endpoints
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 [start|stop|restart|clean|logs|status]${NC}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services (default)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  clean   - Remove containers and volumes (WARNING: deletes data)"
        echo "  logs    - Show live logs"
        echo "  status  - Check service status"
        exit 1
        ;;
esac

print_header
echo ""

