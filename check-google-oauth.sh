#!/bin/bash
# Google OAuth System Diagnostic Script
# Run this to check all OAuth configurations

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Google OAuth System Diagnostic Tool                        ║"
echo "║     Checking Frontend, Backend, and Configuration              ║"
echo "╚════════════════════════════════════════════════════════════════╝"

ERROR_COUNT=0
SUCCESS_COUNT=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
check_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((SUCCESS_COUNT++))
}

check_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((ERROR_COUNT++))
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

info() {
    echo -e "${BLUE}ℹ INFO${NC}: $1"
}

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SECTION 1: FRONTEND CONFIGURATION"
echo "═══════════════════════════════════════════════════════════════"

# Check frontend .env
if [ -f "frontend/.env" ]; then
    check_pass "frontend/.env file exists"
    
    # Check for VITE_GOOGLE_CLIENT_ID
    if grep -q "VITE_GOOGLE_CLIENT_ID=" frontend/.env; then
        CLIENT_ID=$(grep "VITE_GOOGLE_CLIENT_ID=" frontend/.env | cut -d'=' -f2 | tr -d ' ')
        if [ ! -z "$CLIENT_ID" ] && [ "$CLIENT_ID" != "YOUR_GOOGLE_CLIENT_ID" ]; then
            check_pass "VITE_GOOGLE_CLIENT_ID is configured: ${CLIENT_ID:0:15}..."
        else
            check_fail "VITE_GOOGLE_CLIENT_ID is not set or is placeholder"
        fi
    else
        check_fail "VITE_GOOGLE_CLIENT_ID not found in frontend/.env"
    fi
    
    # Check for VITE_API_URL
    if grep -q "VITE_API_URL=" frontend/.env; then
        API_URL=$(grep "VITE_API_URL=" frontend/.env | cut -d'=' -f2 | tr -d ' ')
        if [ ! -z "$API_URL" ]; then
            check_pass "VITE_API_URL is configured: $API_URL"
        else
            check_fail "VITE_API_URL is empty"
        fi
    else
        check_fail "VITE_API_URL not found in frontend/.env"
    fi
else
    check_fail "frontend/.env file not found"
fi

# Check index.html for Google script
if [ -f "frontend/index.html" ]; then
    if grep -q "accounts.google.com/gsi/client" frontend/index.html; then
        check_pass "Google Sign-In script is included in index.html"
    else
        check_fail "Google Sign-In script not found in frontend/index.html"
    fi
else
    check_fail "frontend/index.html not found"
fi

# Check Login.jsx structure
if [ -f "frontend/src/views/auth/Login.jsx" ]; then
    check_pass "frontend/src/views/auth/Login.jsx exists"
    
    if grep -q "handleGoogleLogin" frontend/src/views/auth/Login.jsx; then
        check_pass "handleGoogleLogin function found"
    else
        check_fail "handleGoogleLogin function not found"
    fi
    
    if grep -q "window.google.accounts.id" frontend/src/views/auth/Login.jsx; then
        check_pass "Google accounts API calls found"
    else
        check_fail "Google accounts API calls not found"
    fi
else
    check_fail "frontend/src/views/auth/Login.jsx not found"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SECTION 2: BACKEND CONFIGURATION"
echo "═══════════════════════════════════════════════════════════════"

# Check backend .env
if [ -f "backend/.env" ]; then
    check_pass "backend/.env file exists"
    
    if grep -q "GOOGLE_CLIENT_ID=" backend/.env; then
        check_pass "GOOGLE_CLIENT_ID found in backend/.env"
    else
        check_fail "GOOGLE_CLIENT_ID not found in backend/.env"
    fi
    
    if grep -q "GOOGLE_CLIENT_SECRET=" backend/.env; then
        check_pass "GOOGLE_CLIENT_SECRET found in backend/.env"
    else
        check_fail "GOOGLE_CLIENT_SECRET not found in backend/.env"
    fi
else
    check_fail "backend/.env file not found"
fi

# Check Django settings for CORS
if [ -f "backend/backend/settings.py" ]; then
    check_pass "backend/backend/settings.py exists"
    
    if grep -q "CORS_ALLOWED_ORIGINS" backend/backend/settings.py; then
        check_pass "CORS_ALLOWED_ORIGINS configured"
        
        if grep -q "localhost:5173" backend/backend/settings.py; then
            check_pass "localhost:5173 in CORS_ALLOWED_ORIGINS"
        else
            check_fail "localhost:5173 not in CORS_ALLOWED_ORIGINS"
        fi
    else
        check_fail "CORS_ALLOWED_ORIGINS not found"
    fi
    
    if grep -q "CORS_ALLOW_CREDENTIALS" backend/backend/settings.py; then
        check_pass "CORS_ALLOW_CREDENTIALS configured"
    else
        check_fail "CORS_ALLOW_CREDENTIALS not found"
    fi
    
    if grep -q "CORS_EXPOSE_HEADERS" backend/backend/settings.py; then
        check_pass "CORS_EXPOSE_HEADERS configured"
    else
        check_warn "CORS_EXPOSE_HEADERS not found (may cause issues)"
    fi
    
    if grep -q "corsheaders.middleware.CorsMiddleware" backend/backend/settings.py; then
        check_pass "CORS middleware installed"
    else
        check_fail "CORS middleware not in MIDDLEWARE list"
    fi
else
    check_fail "backend/backend/settings.py not found"
fi

# Check GoogleOAuthAPIView
if [ -f "backend/api/views.py" ]; then
    if grep -q "class GoogleOAuthAPIView" backend/api/views.py; then
        check_pass "GoogleOAuthAPIView class found"
        
        if grep -q "def options.*request" backend/api/views.py; then
            check_pass "OPTIONS method defined in GoogleOAuthAPIView"
        else
            check_warn "OPTIONS method not found in GoogleOAuthAPIView (needed for preflight)"
        fi
        
        if grep -q "@method_decorator(csrf_exempt" backend/api/views.py; then
            check_pass "CSRF exemption configured"
        else
            check_fail "CSRF exemption not found"
        fi
    else
        check_fail "GoogleOAuthAPIView class not found"
    fi
else
    check_fail "backend/api/views.py not found"
fi

# Check sso_utils
if [ -f "backend/api/sso_utils.py" ]; then
    check_pass "backend/api/sso_utils.py exists"
    
    if grep -q "class GoogleOAuthVerifier" backend/api/sso_utils.py; then
        check_pass "GoogleOAuthVerifier class found"
    else
        check_fail "GoogleOAuthVerifier class not found"
    fi
else
    check_fail "backend/api/sso_utils.py not found"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SECTION 3: SERVER STATUS"
echo "═══════════════════════════════════════════════════════════════"

# Check if backend is running
if command -v curl &> /dev/null; then
    info "Checking backend connectivity..."
    if curl -s http://localhost:8000/api/v1/auth/google/ > /dev/null 2>&1; then
        check_pass "Backend is running on http://localhost:8000"
    else
        check_fail "Cannot connect to backend on http://localhost:8000"
        check_warn "Make sure backend is running: cd backend && python manage.py runserver"
    fi
else
    check_warn "curl not available, skipping backend connectivity check"
fi

# Check if frontend is running
if command -v curl &> /dev/null; then
    info "Checking frontend connectivity..."
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        check_pass "Frontend is running on http://localhost:5173"
    else
        check_warn "Frontend not detected on http://localhost:5173"
        check_warn "Make sure frontend is running: cd frontend && npm run dev"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SECTION 4: SUMMARY"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo -e "${GREEN}Passed:${NC} $SUCCESS_COUNT"
echo -e "${RED}Failed:${NC} $ERROR_COUNT"

if [ $ERROR_COUNT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo "Ready to test Google OAuth login at http://localhost:5173/login"
else
    echo ""
    echo -e "${RED}✗ Some checks failed. Please review the errors above.${NC}"
    echo "Common fixes:"
    echo "1. Make sure .env files are properly configured with real Google credentials"
    echo "2. Verify Django middleware includes CorsMiddleware"
    echo "3. Ensure both backend and frontend servers are running"
    echo "4. Restart frontend dev server after changing .env files (npm run dev)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
