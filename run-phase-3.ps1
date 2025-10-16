# ============================================
# Phase 3: Connect Frontend to Backend
# Run this after Render deployment is complete
# ============================================

param(
    [Parameter(Mandatory=$false)]
    [string]$BackendURL
)

Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🔗 Phase 3: Connect Frontend to Backend                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# If no backend URL provided, ask for it
if (-not $BackendURL) {
    Write-Host "📝 Please enter your Render backend URL" -ForegroundColor Yellow
    Write-Host "   (e.g., https://lms-backend.onrender.com)`n" -ForegroundColor Gray
    $BackendURL = Read-Host "Backend URL"
}

# Validate URL
if ($BackendURL -notmatch "^https?://") {
    Write-Host "`n❌ Error: URL must start with http:// or https://" -ForegroundColor Red
    Write-Host "Example: https://lms-backend.onrender.com`n" -ForegroundColor Yellow
    exit 1
}

# Remove trailing slash
$BackendURL = $BackendURL.TrimEnd('/')

Write-Host "`n✅ Backend URL: " -NoNewline -ForegroundColor Green
Write-Host $BackendURL -ForegroundColor Cyan

# Test backend health
Write-Host "`n🧪 Testing backend connection..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$BackendURL/api/health/" -Method Get -TimeoutSec 15
    Write-Host "✅ Backend is responding!" -ForegroundColor Green
    Write-Host "   Status: $($healthCheck.status)" -ForegroundColor Gray
    Write-Host "   Service: $($healthCheck.service)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Warning: Could not connect to backend" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n   Possible reasons:" -ForegroundColor Yellow
    Write-Host "   1. Backend is still deploying (wait a few minutes)" -ForegroundColor Gray
    Write-Host "   2. Health endpoint not configured" -ForegroundColor Gray
    Write-Host "   3. URL is incorrect" -ForegroundColor Gray
    Write-Host "`n   Continue anyway? (Y/N)" -ForegroundColor Yellow
    $continue = Read-Host
    if ($continue -ne "Y" -and $continue -ne "y") {
        Write-Host "`n❌ Aborted. Fix the issue and try again.`n" -ForegroundColor Red
        exit 1
    }
}

# Navigate to frontend
Write-Host "`n📂 Navigating to frontend directory..." -ForegroundColor Yellow
if (-not (Test-Path "frontend")) {
    if (Test-Path "../frontend") {
        Set-Location ..
    } else {
        Write-Host "❌ Error: frontend directory not found!" -ForegroundColor Red
        Write-Host "   Please run this from the project root.`n" -ForegroundColor Yellow
        exit 1
    }
}

Set-Location frontend

# Add environment variable to Vercel
Write-Host "`n📝 Adding VITE_API_URL to Vercel..." -ForegroundColor Yellow
Write-Host "   This will update your production environment`n" -ForegroundColor Gray

try {
    # Create a temporary file with the value
    $BackendURL | Out-File -FilePath "temp_api_url.txt" -Encoding UTF8 -NoNewline
    
    # Add to Vercel (production)
    Write-Host "   Setting for production environment..." -ForegroundColor Gray
    Get-Content "temp_api_url.txt" | vercel env add VITE_API_URL production 2>&1 | Out-Null
    
    # Clean up
    Remove-Item "temp_api_url.txt" -ErrorAction SilentlyContinue
    
    Write-Host "✅ Environment variable added to Vercel" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not automatically add environment variable" -ForegroundColor Yellow
    Write-Host "   Please add manually in Vercel dashboard:`n" -ForegroundColor Yellow
    Write-Host "   1. Go to: https://vercel.com/dashboard" -ForegroundColor Gray
    Write-Host "   2. Select your project" -ForegroundColor Gray
    Write-Host "   3. Go to Settings → Environment Variables" -ForegroundColor Gray
    Write-Host "   4. Add: VITE_API_URL = $BackendURL`n" -ForegroundColor Gray
    
    Write-Host "   Continue with manual deployment? (Y/N)" -ForegroundColor Yellow
    $continue = Read-Host
    if ($continue -ne "Y" -and $continue -ne "y") {
        Write-Host "`n❌ Aborted.`n" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

# Redeploy frontend
Write-Host "`n🚀 Redeploying frontend to Vercel..." -ForegroundColor Yellow
Write-Host "   This will take 2-3 minutes...`n" -ForegroundColor Gray

$deployOutput = vercel --prod 2>&1
Write-Host $deployOutput

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Frontend redeployed successfully!" -ForegroundColor Green
    Write-Host "   URL: https://frontend-mtmk2t9bk-khazs-projects.vercel.app`n" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Deployment failed. Check the error above.`n" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# Wait for propagation
Write-Host "⏱️  Waiting 30 seconds for changes to propagate..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Verify the connection
Write-Host "`n🧪 Verifying full-stack connection..." -ForegroundColor Yellow
Write-Host "   Opening frontend in browser...`n" -ForegroundColor Gray

Start-Process "https://frontend-mtmk2t9bk-khazs-projects.vercel.app"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "`n📋 VERIFICATION CHECKLIST:" -ForegroundColor Cyan
Write-Host "   1. Frontend opened in your browser" -ForegroundColor Gray
Write-Host "   2. Press F12 to open DevTools" -ForegroundColor Gray
Write-Host "   3. Go to Console tab" -ForegroundColor Gray
Write-Host "   4. Check for:" -ForegroundColor Gray
Write-Host "      ✓ No CORS errors" -ForegroundColor Green
Write-Host "      ✓ API calls successful (200 OK)" -ForegroundColor Green
Write-Host "      ✓ Courses loading" -ForegroundColor Green
Write-Host "      ✓ No 404/500 errors" -ForegroundColor Green
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

Write-Host "`n✅ Is everything working correctly? (Y/N)" -ForegroundColor Yellow
$verified = Read-Host

if ($verified -eq "Y" -or $verified -eq "y") {
    Write-Host "`n🎉 SUCCESS! Frontend connected to backend!" -ForegroundColor Green
    Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ PHASE 3 COMPLETE: Frontend Connected                ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Green
    
    Write-Host "📊 Progress: 80% Complete`n" -ForegroundColor Cyan
    
    Write-Host "🎯 NEXT STEP: Run Final Lighthouse Audit (Phase 4)" -ForegroundColor Yellow
    Write-Host "   Run this command:`n" -ForegroundColor Gray
    Write-Host "   .\run-final-audit.ps1`n" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️  Issues detected. Common fixes:" -ForegroundColor Yellow
    Write-Host "   1. Wait 2-3 more minutes for Vercel propagation" -ForegroundColor Gray
    Write-Host "   2. Clear browser cache and reload" -ForegroundColor Gray
    Write-Host "   3. Check backend is 'Live' in Render dashboard" -ForegroundColor Gray
    Write-Host "   4. Verify CORS_ALLOWED_ORIGINS in backend settings`n" -ForegroundColor Gray
    
    Write-Host "   Try again? (Y/N)" -ForegroundColor Yellow
    $retry = Read-Host
    if ($retry -eq "Y" -or $retry -eq "y") {
        Write-Host "`n🔄 Rerun this script after checking the issues.`n" -ForegroundColor Cyan
    }
}

# Return to project root
Set-Location ..

Write-Host "`n✨ Phase 3 script complete! ✨`n" -ForegroundColor Green
