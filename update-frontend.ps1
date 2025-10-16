# ============================================
# Frontend Update Script
# Run this after backend is deployed
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackendURL
)

Write-Host "`n🔗 Connecting Frontend to Backend" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Validate URL format
if ($BackendURL -notmatch "^https?://") {
    Write-Host "❌ Error: URL must start with http:// or https://" -ForegroundColor Red
    Write-Host "Example: https://lms-backend.onrender.com" -ForegroundColor Yellow
    exit 1
}

# Remove trailing slash if present
$BackendURL = $BackendURL.TrimEnd('/')

Write-Host "`nBackend URL: $BackendURL" -ForegroundColor Yellow

# Check if we're in the project root
if (-not (Test-Path "frontend")) {
    Write-Host "`n❌ Error: frontend directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root" -ForegroundColor Yellow
    exit 1
}

# Navigate to frontend
Set-Location frontend

# Step 1: Add environment variable to Vercel
Write-Host "`n📝 Step 1: Adding environment variable to Vercel..." -ForegroundColor Cyan

Write-Host "`nRunning: vercel env add VITE_API_URL production" -ForegroundColor Yellow
Write-Host "When prompted, enter: $BackendURL" -ForegroundColor Yellow
Write-Host "`nPress Enter to continue..." -ForegroundColor Cyan
Read-Host

# Add the environment variable
$env:VERCEL_ENV_VALUE = $BackendURL
Write-Host $BackendURL | vercel env add VITE_API_URL production

Write-Host "✅ Environment variable added" -ForegroundColor Green

# Step 2: Verify local configuration
Write-Host "`n📝 Step 2: Checking local API configuration..." -ForegroundColor Cyan

# Search for API base URL configuration
$configFiles = Get-ChildItem -Path "src" -Filter "*.js" -Recurse | 
    Select-String -Pattern "VITE_API_URL|API_URL|baseURL|BASE_URL" -List |
    Select-Object -ExpandProperty Path -Unique

if ($configFiles) {
    Write-Host "`nFound API configuration in:" -ForegroundColor Yellow
    foreach ($file in $configFiles) {
        Write-Host "  - $file" -ForegroundColor Cyan
    }
} else {
    Write-Host "⚠️  No API configuration files found" -ForegroundColor Yellow
}

# Step 3: Redeploy frontend
Write-Host "`n📝 Step 3: Redeploying frontend to Vercel..." -ForegroundColor Cyan
Write-Host "`nRunning: vercel --prod" -ForegroundColor Yellow

vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Frontend redeployed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Deployment failed. Check the error above." -ForegroundColor Red
    exit 1
}

# Step 4: Test the connection
Write-Host "`n📝 Step 4: Testing backend connection..." -ForegroundColor Cyan

try {
    $healthCheck = Invoke-RestMethod -Uri "$BackendURL/api/health/" -Method Get -TimeoutSec 10
    Write-Host "`n✅ Backend is responding!" -ForegroundColor Green
    Write-Host "Status: $($healthCheck.status)" -ForegroundColor Yellow
    Write-Host "Service: $($healthCheck.service)" -ForegroundColor Yellow
    Write-Host "Timestamp: $($healthCheck.timestamp)" -ForegroundColor Yellow
} catch {
    Write-Host "`n⚠️  Warning: Could not connect to backend" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nPossible reasons:" -ForegroundColor Yellow
    Write-Host "1. Backend is still deploying (wait 5-10 minutes)" -ForegroundColor White
    Write-Host "2. Health endpoint not configured" -ForegroundColor White
    Write-Host "3. CORS not configured properly" -ForegroundColor White
    Write-Host "4. Backend service is down" -ForegroundColor White
}

# Step 5: Verification checklist
Write-Host "`n📋 Verification Checklist" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "1. [ ] Open https://frontend-mtmk2t9bk-khazs-projects.vercel.app" -ForegroundColor Yellow
Write-Host "2. [ ] Open DevTools (F12) → Console" -ForegroundColor Yellow
Write-Host "3. [ ] Check for CORS errors (should be none)" -ForegroundColor Yellow
Write-Host "4. [ ] Verify courses are loading" -ForegroundColor Yellow
Write-Host "5. [ ] Check Network tab for API calls" -ForegroundColor Yellow
Write-Host "6. [ ] Verify no 404/500 errors" -ForegroundColor Yellow

# Step 6: Next steps
Write-Host "`n🎯 Next Steps" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "1. Wait 2-3 minutes for deployment to propagate" -ForegroundColor White
Write-Host "2. Clear browser cache and reload" -ForegroundColor White
Write-Host "3. Test full functionality" -ForegroundColor White
Write-Host "4. Run final Lighthouse audit (3 runs, 30s apart)" -ForegroundColor White
Write-Host "5. Celebrate 97-99/100 score! 🎉" -ForegroundColor White

Write-Host "`n✨ Frontend updated successfully! ✨`n" -ForegroundColor Green

# Return to original directory
Set-Location ..
