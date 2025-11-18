# SSO Localhost Testing Script for Windows PowerShell
# Tests the complete SSO flow on localhost

param(
    [string]$SSOToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuaXAiOiIxOTk3MDExODIwMjUwNjEwMDEiLCJpYXQiOjE3NjM0NTA5MzgsImV4cCI6MTc2MzQ1NDUzOH0.KdOc7e7wnGSfQTQBSA_ebElA7s9KmDltREOpAiMoa5A"
)

# Configuration
$BackendUrl = "http://127.0.0.1:8000"
$FrontendUrl = "http://localhost:5173"
$ApiEndpoint = "$BackendUrl/api/v1/sso/verify/"

# Helper functions
function Write-Header {
    param([string]$Title)
    Write-Host "`n╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
    Write-Host "║ $Title" -ForegroundColor Blue
    Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Blue
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

# Test 1: Backend Running
function Test-BackendRunning {
    Write-Header "Test 1: Backend Service Running"
    
    Write-Info "Testing: $BackendUrl/api/v1/health/"
    
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/v1/health/" -TimeoutSec 5 -ErrorAction Stop
        Write-Success "Backend is running and responding"
        return $true
    }
    catch {
        Write-Error "Backend is not responding"
        Write-Info "Make sure Django is running:"
        Write-Host "  cd backend && python manage.py runserver 0.0.0.0:8000" -ForegroundColor Cyan
        return $false
    }
}

# Test 2: Frontend Running
function Test-FrontendRunning {
    Write-Header "Test 2: Frontend Service Running"
    
    Write-Info "Testing: $FrontendUrl/"
    
    try {
        $response = Invoke-WebRequest -Uri "$FrontendUrl/" -TimeoutSec 5 -ErrorAction Stop
        if ($response.Content -match "html") {
            Write-Success "Frontend is running and serving content"
            return $true
        }
    }
    catch {
        Write-Warning "Frontend might not be running"
        Write-Info "Start frontend with:"
        Write-Host "  cd frontend && npm run dev" -ForegroundColor Cyan
        return $false
    }
}

# Test 3: CORS Headers
function Test-CorsHeaders {
    Write-Header "Test 3: CORS Headers Configuration"
    
    Write-Info "Testing: OPTIONS request to SSO endpoint"
    
    try {
        $headers = @{
            "Origin" = $FrontendUrl
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "Content-Type"
        }
        
        $response = Invoke-WebRequest -Uri $ApiEndpoint -Method Options -Headers $headers -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.Headers["Access-Control-Allow-Origin"]) {
            Write-Success "CORS headers present"
            Write-Info "CORS Allow Origin: $($response.Headers["Access-Control-Allow-Origin"])"
            return $true
        }
    }
    catch {
        Write-Warning "CORS headers might not be configured"
        Write-Info "Check backend/backend/settings.py CORS_ALLOWED_ORIGINS"
        return $false
    }
}

# Test 4: SSO Endpoint
function Test-SsoEndpoint {
    Write-Header "Test 4: SSO Token Verification Endpoint"
    
    Write-Info "Testing: POST request with SSO token"
    Write-Info "Token: $($SSOToken.Substring(0, 30))..."
    
    try {
        $body = @{
            sso_token = $SSOToken
        } | ConvertTo-Json
        
        $headers = @{
            "Content-Type" = "application/json"
            "Origin" = $FrontendUrl
        }
        
        $response = Invoke-WebRequest -Uri $ApiEndpoint `
            -Method Post `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 5 `
            -ErrorAction Stop
        
        Write-Success "Backend successfully verified SSO token"
        Write-Info "Response Status: $($response.StatusCode)"
        
        $responseData = $response.Content | ConvertFrom-Json
        
        if ($responseData.access) {
            Write-Success "Response contains access token"
            Write-Info "Access token: $($responseData.access.Substring(0, 30))..."
        }
        
        if ($responseData.user.role) {
            Write-Success "Response contains user role: $($responseData.user.role)"
            Write-Host ($responseData | ConvertTo-Json -Depth 10 | Select-Object -First 20)
        }
        
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        Write-Error "SSO verification failed (HTTP $statusCode)"
        
        try {
            $errorResponse = $_.Exception.Response.Content.ReadAsStream()
            $reader = New-Object System.IO.StreamReader($errorResponse)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            
            Write-Info "Response:"
            Write-Host $responseBody -ForegroundColor Gray
        }
        catch { }
        
        if ($statusCode -eq 401) {
            Write-Warning "Token might be expired or invalid"
        }
        elseif ($statusCode -eq 400) {
            Write-Warning "Invalid token format"
        }
        elseif ($statusCode -eq 500) {
            Write-Error "Backend server error - check logs"
        }
        
        return $false
    }
}

# Test 5: Token Format
function Test-TokenFormat {
    Write-Header "Test 5: SSO Token Format Analysis"
    
    Write-Info "Analyzing token structure..."
    
    $parts = $SSOToken -split '\.'
    
    if ($parts.Count -eq 3) {
        Write-Success "Token has 3 parts ✓"
        Write-Info "Header: $($parts[0].Substring(0, 20))..."
        Write-Info "Payload: $($parts[1].Substring(0, 20))..."
        Write-Info "Signature: $($parts[2].Substring(0, 20))..."
        
        # Decode payload
        try {
            $payload = $parts[1]
            # Add padding if needed
            while ($payload.Length % 4) {
                $payload += "="
            }
            
            $decodedBytes = [System.Convert]::FromBase64String($payload)
            $decodedString = [System.Text.Encoding]::UTF8.GetString($decodedBytes)
            $decodedJson = $decodedString | ConvertFrom-Json
            
            Write-Success "Token payload decoded successfully"
            Write-Info "Decoded payload:"
            Write-Host ($decodedJson | ConvertTo-Json)
            
            return $true
        }
        catch {
            Write-Warning "Could not decode token payload: $_"
            return $false
        }
    }
    else {
        Write-Error "Token does not have 3 parts"
        return $false
    }
}

# Test 6: Database
function Test-Database {
    Write-Header "Test 6: Database Connection"
    
    Write-Info "Testing: Database connection from backend"
    Write-Info "To verify database manually:"
    Write-Host "  python manage.py shell" -ForegroundColor Cyan
    Write-Host "  >>> from userauths.models import User" -ForegroundColor Cyan
    Write-Host "  >>> User.objects.count()" -ForegroundColor Cyan
    
    # Try health endpoint
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/v1/health/" -TimeoutSec 5 -ErrorAction Stop
        Write-Success "Database appears to be connected"
        return $true
    }
    catch {
        Write-Error "Could not verify database connection"
        return $false
    }
}

# Test 7: Frontend Route
function Test-FrontendRoute {
    Write-Header "Test 7: Frontend SSO Route"
    
    Write-Info "URL: $FrontendUrl/sso/$SSOToken"
    Write-Info "This requires browser to test properly"
    Write-Host ""
    Write-Info "To test in browser:"
    Write-Host "  1. Open DevTools (F12)" -ForegroundColor Cyan
    Write-Host "  2. Go to Console tab" -ForegroundColor Cyan
    Write-Host "  3. Visit: $FrontendUrl/sso/$SSOToken" -ForegroundColor Cyan
    Write-Host "  4. Look for logs starting with: 🔐 SSO Login Started" -ForegroundColor Cyan
    Write-Host "  5. Check for any error messages" -ForegroundColor Cyan
}

# Print summary
function Print-Summary {
    param(
        [bool]$Test1,
        [bool]$Test2,
        [bool]$Test3,
        [bool]$Test4,
        [bool]$Test5,
        [bool]$Test6
    )
    
    Write-Header "Test Summary"
    
    Write-Host "Passed Tests:" -ForegroundColor Green
    Write-Host "  • Backend Service: $(if ($Test1) { '✓' } else { '✗' })"
    Write-Host "  • Frontend Service: $(if ($Test2) { '✓' } else { '✗' })"
    Write-Host "  • CORS Headers: $(if ($Test3) { '✓' } else { '✗' })"
    Write-Host "  • SSO Endpoint: $(if ($Test4) { '✓' } else { '✗' })"
    Write-Host "  • Token Format: $(if ($Test5) { '✓' } else { '✗' })"
    Write-Host "  • Database: $(if ($Test6) { '✓' } else { '✗' })"
    
    $passedCount = @($Test1, $Test2, $Test3, $Test4, $Test5, $Test6) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
    $totalCount = 6
    
    Write-Host ""
    if ($passedCount -eq $totalCount) {
        Write-Host "All tests passed! ✓" -ForegroundColor Green
        Write-Host "`nYou can now test SSO in browser:" -ForegroundColor Green
        Write-Host "  $FrontendUrl/sso/$SSOToken" -ForegroundColor Cyan
    }
    else {
        Write-Host "Some tests failed. Fix issues above and re-run." -ForegroundColor Yellow
    }
}

# Main execution
Write-Header "SSO Localhost Testing Suite"

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Backend: $BackendUrl"
Write-Host "  Frontend: $FrontendUrl"
Write-Host "  SSO Endpoint: $ApiEndpoint"
Write-Host ""

# Run tests
$test1 = Test-BackendRunning
$test2 = Test-FrontendRunning
$test3 = Test-CorsHeaders
$test4 = Test-SsoEndpoint
$test5 = Test-TokenFormat
$test6 = Test-Database
Test-FrontendRoute

# Print summary
Print-Summary $test1 $test2 $test3 $test4 $test5 $test6

Write-Host ""
Write-Host "For detailed debugging, see: SSO_LOCALHOST_DEBUG_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
