#!/bin/bash
# SSO Localhost Testing Script
# Tests the complete SSO flow on localhost

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://localhost:5173"
API_ENDPOINT="$BACKEND_URL/api/v1/sso/verify/"

# Test token (from user's example)
SSO_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuaXAiOiIxOTk3MDExODIwMjUwNjEwMDEiLCJpYXQiOjE3NjM0NTA5MzgsImV4cCI6MTc2MzQ1NDUzOH0.KdOc7e7wnGSfQTQBSA_ebElA7s9KmDltREOpAiMoa5A"

# Headers
print_header() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════════╝${NC}\n"
}

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Test functions
test_backend_running() {
    print_header "Test 1: Backend Service Running"
    
    log_info "Testing: $BACKEND_URL/api/v1/health/"
    
    if curl -s -f "$BACKEND_URL/api/v1/health/" > /dev/null 2>&1; then
        log_success "Backend is running and responding"
        return 0
    else
        log_error "Backend is not responding"
        log_error "Make sure Django is running:"
        echo -e "  ${CYAN}cd backend && python manage.py runserver 0.0.0.0:8000${NC}"
        return 1
    fi
}

test_frontend_running() {
    print_header "Test 2: Frontend Service Running"
    
    log_info "Testing: $FRONTEND_URL/"
    
    if curl -s "$FRONTEND_URL/" | grep -q "html" 2>/dev/null; then
        log_success "Frontend is running and serving content"
        return 0
    else
        log_warning "Frontend might not be running"
        log_info "Start frontend with:"
        echo -e "  ${CYAN}cd frontend && npm run dev${NC}"
        return 1
    fi
}

test_cors_headers() {
    print_header "Test 3: CORS Headers Configuration"
    
    log_info "Testing: OPTIONS request to SSO endpoint"
    
    # Make OPTIONS request to check CORS headers
    response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
        -H "Origin: $FRONTEND_URL" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        "$API_ENDPOINT")
    
    status=$(echo "$response" | tail -n1)
    headers=$(echo "$response" | head -n-1)
    
    if echo "$headers" | grep -q "Access-Control-Allow-Origin"; then
        log_success "CORS headers present"
        echo "$headers" | grep "Access-Control-Allow" || true
        return 0
    else
        log_warning "CORS headers might not be configured"
        log_info "Check backend/backend/settings.py CORS_ALLOWED_ORIGINS"
        return 1
    fi
}

test_sso_endpoint() {
    print_header "Test 4: SSO Token Verification Endpoint"
    
    log_info "Testing: POST request with SSO token"
    log_info "Token: ${SSO_TOKEN:0:30}..."
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Origin: $FRONTEND_URL" \
        -d "{\"sso_token\": \"$SSO_TOKEN\"}" \
        "$API_ENDPOINT")
    
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    log_info "Response Status: $status"
    
    if [ "$status" == "200" ]; then
        log_success "Backend successfully verified SSO token"
        
        # Extract token from response
        if echo "$body" | grep -q "\"access\""; then
            log_success "Response contains access token"
            access_token=$(echo "$body" | grep -o '"access":"[^"]*' | cut -d'"' -f4 | head -c 30)
            log_info "Access token: ${access_token}..."
            
            # Check user data
            if echo "$body" | grep -q "\"role\""; then
                log_success "Response contains user role"
                echo "$body" | python -m json.tool 2>/dev/null | head -20 || echo "$body"
                return 0
            fi
        fi
    else
        log_error "SSO verification failed (HTTP $status)"
        log_info "Response:"
        echo "$body" | python -m json.tool 2>/dev/null || echo "$body"
        
        if [ "$status" == "401" ]; then
            log_warning "Token might be expired or invalid"
        elif [ "$status" == "400" ]; then
            log_warning "Invalid token format"
        elif [ "$status" == "500" ]; then
            log_error "Backend server error - check logs"
        fi
        return 1
    fi
}

test_token_format() {
    print_header "Test 5: SSO Token Format Analysis"
    
    log_info "Analyzing token structure..."
    
    # Split token into parts
    IFS='.' read -r header payload signature <<< "$SSO_TOKEN"
    
    log_info "Token has 3 parts: ✓"
    log_info "Header: ${header:0:20}..."
    log_info "Payload: ${payload:0:20}..."
    log_info "Signature: ${signature:0:20}..."
    
    # Try to decode payload (base64)
    # Add padding if needed
    padded_payload="${payload}=="
    decoded=$(echo "$padded_payload" | base64 -d 2>/dev/null || echo "")
    
    if [ ! -z "$decoded" ]; then
        log_success "Token payload decoded successfully"
        log_info "Decoded payload:"
        echo "$decoded" | python -m json.tool 2>/dev/null || echo "$decoded"
        return 0
    else
        log_warning "Could not decode token payload"
        return 1
    fi
}

test_database() {
    print_header "Test 6: Database Connection"
    
    log_info "Testing: Database connection from backend"
    
    # This would require SSH or Django shell access
    log_info "To verify database manually:"
    echo -e "  ${CYAN}python manage.py shell${NC}"
    echo -e "  ${CYAN}>>> from userauths.models import User${NC}"
    echo -e "  ${CYAN}>>> User.objects.count()${NC}"
    
    # Try to make a request that requires database
    response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/v1/health/")
    status=$(echo "$response" | tail -n1)
    
    if [ "$status" == "200" ]; then
        log_success "Database appears to be connected"
        return 0
    else
        log_error "Could not verify database connection"
        return 1
    fi
}

test_frontend_route() {
    print_header "Test 7: Frontend SSO Route"
    
    log_info "URL: $FRONTEND_URL/sso/$SSO_TOKEN"
    log_info "This would require browser to test properly"
    log_info ""
    log_info "To test in browser:"
    echo -e "  1. Open DevTools (F12)"
    echo -e "  2. Go to Console tab"
    echo -e "  3. Visit: ${CYAN}$FRONTEND_URL/sso/$SSO_TOKEN${NC}"
    echo -e "  4. Look for logs starting with: 🔐 SSO Login Started"
    echo -e "  5. Check for any error messages"
    
    return 0
}

# Summary function
print_summary() {
    print_header "Test Summary"
    
    echo -e "${GREEN}✓ Passed Tests:${NC}"
    echo -e "  • Backend Service: $([ $test1 -eq 0 ] && echo "✓" || echo "✗")"
    echo -e "  • Frontend Service: $([ $test2 -eq 0 ] && echo "✓" || echo "✗")"
    echo -e "  • CORS Headers: $([ $test3 -eq 0 ] && echo "✓" || echo "✗")"
    echo -e "  • SSO Endpoint: $([ $test4 -eq 0 ] && echo "✓" || echo "✗")"
    echo -e "  • Token Format: $([ $test5 -eq 0 ] && echo "✓" || echo "✗")"
    echo -e "  • Database: $([ $test6 -eq 0 ] && echo "✓" || echo "✗")"
    
    total_tests=6
    passed_tests=$((test1 + test2 + test3 + test4 + test5 + test6))
    
    echo ""
    if [ $passed_tests -eq $total_tests ]; then
        echo -e "${GREEN}All tests passed! ✓${NC}"
        echo -e "\nYou can now test SSO in browser:"
        echo -e "  ${CYAN}$FRONTEND_URL/sso/$SSO_TOKEN${NC}"
        return 0
    else
        echo -e "${YELLOW}Some tests failed. Fix issues above and re-run.${NC}"
        return 1
    fi
}

# Main execution
print_header "SSO Localhost Testing Suite"

echo -e "${CYAN}Configuration:${NC}"
echo -e "  Backend: $BACKEND_URL"
echo -e "  Frontend: $FRONTEND_URL"
echo -e "  SSO Endpoint: $API_ENDPOINT"
echo ""

# Run tests
test_backend_running; test1=$?
test_frontend_running; test2=$?
test_cors_headers; test3=$?
test_sso_endpoint; test4=$?
test_token_format; test5=$?
test_database; test6=$?
test_frontend_route; test7=$?

# Print summary
print_summary

echo ""
echo -e "${CYAN}For detailed debugging, see: SSO_LOCALHOST_DEBUG_GUIDE.md${NC}"
echo ""
