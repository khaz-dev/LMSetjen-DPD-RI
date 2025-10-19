# ============================================
# Production Deployment Script (PowerShell)
# LMSetjen DPD RI - Learning Management System
# ============================================

param(
    [string]$Server = "",
    [string]$User = "",
    [switch]$FullRebuild = $false,
    [switch]$FrontendOnly = $false
)

Write-Host "`n🚀 Production Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if git is clean
Write-Host "📋 Checking git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  Warning: You have uncommitted changes!" -ForegroundColor Yellow
    Write-Host $gitStatus
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

# Show what will be deployed
Write-Host "`n📦 Latest commit:" -ForegroundColor Cyan
git log -1 --oneline
Write-Host ""

# Confirm deployment
Write-Host "🎯 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "   Full Rebuild: $FullRebuild" -ForegroundColor White
Write-Host "   Frontend Only: $FrontendOnly" -ForegroundColor White
Write-Host ""

$confirm = Read-Host "Deploy to production? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Starting deployment..." -ForegroundColor Green

# Instructions for manual deployment
if ($Server -eq "" -or $User -eq "") {
    Write-Host "`n📝 Manual Deployment Steps:" -ForegroundColor Yellow
    Write-Host "===========================`n" -ForegroundColor Yellow
    
    Write-Host "1️⃣  SSH to your production server:" -ForegroundColor White
    Write-Host "   ssh your-user@your-server" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "2️⃣  Navigate to project directory:" -ForegroundColor White
    Write-Host "   cd /path/to/LMSetjen-DPD-RI" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "3️⃣  Pull latest changes:" -ForegroundColor White
    Write-Host "   git pull origin main" -ForegroundColor Cyan
    Write-Host ""
    
    if ($FullRebuild) {
        Write-Host "4️⃣  Full rebuild (Docker):" -ForegroundColor White
        Write-Host "   docker-compose -f docker-compose.prod.yml down" -ForegroundColor Cyan
        Write-Host "   docker-compose -f docker-compose.prod.yml build --no-cache" -ForegroundColor Cyan
        Write-Host "   docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor Cyan
    } elseif ($FrontendOnly) {
        Write-Host "4️⃣  Restart frontend only:" -ForegroundColor White
        Write-Host "   docker-compose -f docker-compose.prod.yml restart frontend" -ForegroundColor Cyan
    } else {
        Write-Host "4️⃣  Quick restart:" -ForegroundColor White
        Write-Host "   docker-compose -f docker-compose.prod.yml restart" -ForegroundColor Cyan
    }
    Write-Host ""
    
    Write-Host "5️⃣  Check status:" -ForegroundColor White
    Write-Host "   docker-compose -f docker-compose.prod.yml ps" -ForegroundColor Cyan
    Write-Host "   docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "6️⃣  Clear browser cache and test:" -ForegroundColor White
    Write-Host "   - Press Ctrl + Shift + R (hard refresh)" -ForegroundColor Cyan
    Write-Host "   - Test all instructor pages" -ForegroundColor Cyan
    Write-Host "   - Check browser console (F12) for errors" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "📚 Full guide: DEPLOY_TO_PRODUCTION.md`n" -ForegroundColor Yellow
    
} else {
    # Automated deployment (if server details provided)
    Write-Host "🔄 Connecting to $User@$Server..." -ForegroundColor Yellow
    
    $commands = @(
        "cd /path/to/LMSetjen-DPD-RI",
        "git pull origin main"
    )
    
    if ($FullRebuild) {
        $commands += @(
            "docker-compose -f docker-compose.prod.yml down",
            "docker-compose -f docker-compose.prod.yml build --no-cache",
            "docker-compose -f docker-compose.prod.yml up -d"
        )
    } elseif ($FrontendOnly) {
        $commands += "docker-compose -f docker-compose.prod.yml restart frontend"
    } else {
        $commands += "docker-compose -f docker-compose.prod.yml restart"
    }
    
    $commands += "docker-compose -f docker-compose.prod.yml ps"
    
    $sshCommand = $commands -join "; "
    
    Write-Host "Executing: ssh $User@$Server '$sshCommand'" -ForegroundColor Cyan
    ssh "$User@$Server" $sshCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Deployment completed!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Deployment failed! Check logs above." -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "========================`n" -ForegroundColor Green

Write-Host "📋 Post-Deployment Checklist:" -ForegroundColor Yellow
Write-Host "  [ ] Clear browser cache (Ctrl + Shift + R)" -ForegroundColor White
Write-Host "  [ ] Test instructor dashboard" -ForegroundColor White
Write-Host "  [ ] Check all instructor pages" -ForegroundColor White
Write-Host "  [ ] Verify loading states working" -ForegroundColor White
Write-Host "  [ ] Check browser console for errors" -ForegroundColor White
Write-Host "  [ ] Test on mobile device" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Monitor logs:" -ForegroundColor Cyan
Write-Host "   docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor White
Write-Host ""

Write-Host "📞 Need help? Check DEPLOY_TO_PRODUCTION.md`n" -ForegroundColor Cyan

# Open deployment guide
$openGuide = Read-Host "Open deployment guide? (y/n)"
if ($openGuide -eq "y") {
    if (Test-Path "DEPLOY_TO_PRODUCTION.md") {
        Start-Process "DEPLOY_TO_PRODUCTION.md"
    } else {
        Write-Host "⚠️  DEPLOY_TO_PRODUCTION.md not found" -ForegroundColor Yellow
    }
}
