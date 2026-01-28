# Google OAuth System Diagnostic Script (PowerShell)
# Run this to check all OAuth configurations on Windows

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Google OAuth System Diagnostic Tool" -ForegroundColor Cyan
Write-Host "Checking Frontend, Backend, and Configuration" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$errorCount = 0
$successCount = 0

# Helper functions
function Check-Pass {
    param([string]$message)
    Write-Host "[PASS] $message" -ForegroundColor Green
    $script:successCount++
}

function Check-Fail {
    param([string]$message)
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:errorCount++
}

function Check-Warn {
    param([string]$message)
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Info {
    param([string]$message)
    Write-Host "[INFO] $message" -ForegroundColor Blue
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SECTION 1: FRONTEND CONFIGURATION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check frontend .env
if (Test-Path "frontend\.env") {
    Check-Pass "frontend\.env file exists"
    
    $content = Get-Content "frontend\.env"
    
    if ($content | Select-String -Pattern "VITE_GOOGLE_CLIENT_ID=" -Quiet) {
        $clientId = ($content | Select-String -Pattern "VITE_GOOGLE_CLIENT_ID=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
        if ($clientId -and $clientId -ne "YOUR_GOOGLE_CLIENT_ID") {
            Check-Pass "VITE_GOOGLE_CLIENT_ID is configured: $($clientId.Substring(0, [Math]::Min(15, $clientId.Length)))..."
        }
        else {
            Check-Fail "VITE_GOOGLE_CLIENT_ID is not set or is placeholder"
        }
    }
    else {
        Check-Fail "VITE_GOOGLE_CLIENT_ID not found in frontend\.env"
    }
    
    # Check for VITE_API_URL
    if ($content | Select-String -Pattern "VITE_API_URL=" -Quiet) {
        $apiUrl = ($content | Select-String -Pattern "VITE_API_URL=(.+)" | ForEach-Object { $_.Matches.Groups[1].Value })
        if ($apiUrl) {
            Check-Pass "VITE_API_URL is configured: $apiUrl"
        }
        else {
            Check-Fail "VITE_API_URL is empty"
        }
    }
    else {
        Check-Fail "VITE_API_URL not found in frontend\.env"
    }
}
else {
    Check-Fail "frontend\.env file not found"
}

# Check index.html for Google script
if (Test-Path "frontend\index.html") {
    $htmlContent = Get-Content "frontend\index.html" -Raw
    if ($htmlContent | Select-String -Pattern "accounts.google.com/gsi/client" -Quiet) {
        Check-Pass "Google Sign-In script is included in index.html"
    }
    else {
        Check-Fail "Google Sign-In script not found in frontend\index.html"
    }
}
else {
    Check-Fail "frontend\index.html not found"
}

# Check Login.jsx structure
if (Test-Path "frontend\src\views\auth\Login.jsx") {
    Check-Pass "frontend\src\views\auth\Login.jsx exists"
    
    $jsContent = Get-Content "frontend\src\views\auth\Login.jsx" -Raw
    
    if ($jsContent | Select-String -Pattern "handleGoogleLogin" -Quiet) {
        Check-Pass "handleGoogleLogin function found"
    }
    else {
        Check-Fail "handleGoogleLogin function not found"
    }
    
    if ($jsContent | Select-String -Pattern "window.google.accounts.id" -Quiet) {
        Check-Pass "Google accounts API calls found"
    }
    else {
        Check-Fail "Google accounts API calls not found"
    }
}
else {
    Check-Fail "frontend\src\views\auth\Login.jsx not found"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SECTION 2: BACKEND CONFIGURATION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check backend .env
if (Test-Path "backend\.env") {
    Check-Pass "backend\.env file exists"
    
    $backendContent = Get-Content "backend\.env"
    
    if ($backendContent | Select-String -Pattern "GOOGLE_CLIENT_ID=" -Quiet) {
        Check-Pass "GOOGLE_CLIENT_ID found in backend\.env"
    }
    else {
        Check-Fail "GOOGLE_CLIENT_ID not found in backend\.env"
    }
    
    if ($backendContent | Select-String -Pattern "GOOGLE_CLIENT_SECRET=" -Quiet) {
        Check-Pass "GOOGLE_CLIENT_SECRET found in backend\.env"
    }
    else {
        Check-Fail "GOOGLE_CLIENT_SECRET not found in backend\.env"
    }
}
else {
    Check-Fail "backend\.env file not found"
}

# Check Django settings for CORS
if (Test-Path "backend\backend\settings.py") {
    Check-Pass "backend\backend\settings.py exists"
    
    $settingsContent = Get-Content "backend\backend\settings.py" -Raw
    
    if ($settingsContent | Select-String -Pattern "CORS_ALLOWED_ORIGINS" -Quiet) {
        Check-Pass "CORS_ALLOWED_ORIGINS configured"
        
        if ($settingsContent | Select-String -Pattern "localhost:5173" -Quiet) {
            Check-Pass "localhost:5173 in CORS_ALLOWED_ORIGINS"
        }
        else {
            Check-Fail "localhost:5173 not in CORS_ALLOWED_ORIGINS"
        }
    }
    else {
        Check-Fail "CORS_ALLOWED_ORIGINS not found"
    }
    
    if ($settingsContent | Select-String -Pattern "CORS_ALLOW_CREDENTIALS" -Quiet) {
        Check-Pass "CORS_ALLOW_CREDENTIALS configured"
    }
    else {
        Check-Fail "CORS_ALLOW_CREDENTIALS not found"
    }
    
    if ($settingsContent | Select-String -Pattern "CORS_EXPOSE_HEADERS" -Quiet) {
        Check-Pass "CORS_EXPOSE_HEADERS configured"
    }
    else {
        Check-Warn "CORS_EXPOSE_HEADERS not found (may cause issues)"
    }
    
    if ($settingsContent | Select-String -Pattern "corsheaders.middleware.CorsMiddleware" -Quiet) {
        Check-Pass "CORS middleware installed"
    }
    else {
        Check-Fail "CORS middleware not in MIDDLEWARE list"
    }
}
else {
    Check-Fail "backend\backend\settings.py not found"
}

# Check GoogleOAuthAPIView
if (Test-Path "backend\api\views.py") {
    $viewsContent = Get-Content "backend\api\views.py" -Raw
    
    if ($viewsContent | Select-String -Pattern "class GoogleOAuthAPIView" -Quiet) {
        Check-Pass "GoogleOAuthAPIView class found"
        
        if ($viewsContent | Select-String -Pattern "def options.*request" -Quiet) {
            Check-Pass "OPTIONS method defined in GoogleOAuthAPIView"
        }
        else {
            Check-Warn "OPTIONS method not found in GoogleOAuthAPIView (needed for preflight)"
        }
        
        if ($viewsContent | Select-String -Pattern "@method_decorator\(csrf_exempt" -Quiet) {
            Check-Pass "CSRF exemption configured"
        }
        else {
            Check-Fail "CSRF exemption not found"
        }
    }
    else {
        Check-Fail "GoogleOAuthAPIView class not found"
    }
}
else {
    Check-Fail "backend\api\views.py not found"
}

# Check sso_utils
if (Test-Path "backend\api\sso_utils.py") {
    Check-Pass "backend\api\sso_utils.py exists"
    
    $ssoContent = Get-Content "backend\api\sso_utils.py" -Raw
    if ($ssoContent | Select-String -Pattern "class GoogleOAuthVerifier" -Quiet) {
        Check-Pass "GoogleOAuthVerifier class found"
    }
    else {
        Check-Fail "GoogleOAuthVerifier class not found"
    }
}
else {
    Check-Fail "backend\api\sso_utils.py not found"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SECTION 3: SERVER STATUS" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Info "Checking backend connectivity..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/v1/auth/google/" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Check-Pass "Backend is running on http://localhost:8000"
}
catch {
    Check-Fail "Cannot connect to backend on http://localhost:8000"
    Check-Warn "Make sure backend is running: cd backend; python manage.py runserver"
}

# Check if frontend is running
Info "Checking frontend connectivity..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction Stop
    Check-Pass "Frontend is running on http://localhost:5173"
}
catch {
    Check-Warn "Frontend not detected on http://localhost:5173"
    Check-Warn "Make sure frontend is running: cd frontend; npm run dev"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "SECTION 4: SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Passed: $successCount" -ForegroundColor Green
Write-Host "Failed: $errorCount" -ForegroundColor Red

if ($errorCount -eq 0) {
    Write-Host ""
    Write-Host "All critical checks passed!" -ForegroundColor Green
    Write-Host "Ready to test Google OAuth login at http://localhost:5173/login"
}
else {
    Write-Host ""
    Write-Host "Some checks failed. Please review the errors above." -ForegroundColor Red
    Write-Host "Common fixes:"
    Write-Host "1. Make sure .env files are properly configured with real Google credentials"
    Write-Host "2. Verify Django middleware includes CorsMiddleware"
    Write-Host "3. Ensure both backend and frontend servers are running"
    Write-Host "4. Restart frontend dev server after changing .env files (npm run dev)"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
