# ============================================
# IP Address Update Script (PowerShell)
# LMSetjen DPD RI - Learning Management System
# ============================================
# This script helps you update the EC2 public IP address
# across all configuration files when it changes.
#
# Usage: .\update-ip.ps1 -NewIP "NEW_IP_ADDRESS"
# Example: .\update-ip.ps1 -NewIP "16.79.83.21"
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$NewIP
)

# Validate IP address format
if ($NewIP -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
    Write-Host "❌ Error: Invalid IP address format" -ForegroundColor Red
    Write-Host "Please provide a valid IPv4 address (e.g., 16.79.83.21)" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔄 Updating IP address to: $NewIP" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Get current IP from .env file
$CurrentIP = (Get-Content .env | Select-String "ALLOWED_HOSTS=" | ForEach-Object { 
    if ($_ -match '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}') { 
        $matches[0] 
    }
}) | Select-Object -First 1

if ($CurrentIP) {
    Write-Host "📍 Current IP: $CurrentIP" -ForegroundColor Yellow
    Write-Host "📍 New IP: $NewIP" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "⚠️  Warning: Could not detect current IP address" -ForegroundColor Yellow
    Write-Host "Proceeding with update..." -ForegroundColor Yellow
    Write-Host ""
}

# Backup .env file
$BackupName = ".env.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "💾 Creating backup of .env file: $BackupName" -ForegroundColor Cyan
Copy-Item .env $BackupName

# Update .env file
Write-Host "📝 Updating .env file..." -ForegroundColor Cyan
if (Test-Path .env) {
    $envContent = Get-Content .env
    $envContent = $envContent -replace 'ALLOWED_HOSTS=localhost,127\.0\.0\.1,[\d.]+', "ALLOWED_HOSTS=localhost,127.0.0.1,$NewIP"
    $envContent = $envContent -replace 'CORS_ALLOWED_ORIGINS=http://localhost:3000,http://[\d.]+', "CORS_ALLOWED_ORIGINS=http://localhost:3000,http://$NewIP"
    $envContent = $envContent -replace 'FRONTEND_SITE_URL=http://[\d.]+', "FRONTEND_SITE_URL=http://$NewIP"
    $envContent = $envContent -replace 'BACKEND_SITE_URL=http://[\d.]+', "BACKEND_SITE_URL=http://$NewIP"
    $envContent | Set-Content .env
    Write-Host "✅ .env updated" -ForegroundColor Green
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}

# Update settings.py
Write-Host "📝 Updating backend/backend/settings.py..." -ForegroundColor Cyan
$settingsPath = "backend\backend\settings.py"
if (Test-Path $settingsPath) {
    $settingsContent = Get-Content $settingsPath
    $settingsContent = $settingsContent -replace '"http://[\d.]+",\s*# Production EC2 server', "`"http://$NewIP`",  # Production EC2 server (updated)"
    $settingsContent | Set-Content $settingsPath
    Write-Host "✅ settings.py updated" -ForegroundColor Green
} else {
    Write-Host "⚠️  $settingsPath not found - skipping" -ForegroundColor Yellow
}

# Update create_superuser.py
Write-Host "📝 Updating create_superuser.py..." -ForegroundColor Cyan
if (Test-Path "create_superuser.py") {
    $superuserContent = Get-Content "create_superuser.py"
    $superuserContent = $superuserContent -replace 'http://[\d.]+/admin/', "http://$NewIP/admin/"
    $superuserContent | Set-Content "create_superuser.py"
    Write-Host "✅ create_superuser.py updated" -ForegroundColor Green
} else {
    Write-Host "⚠️  create_superuser.py not found - skipping" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "✅ IP address update complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Review the changes: git diff" -ForegroundColor White
Write-Host "2. Commit the changes: git add . ; git commit -m `"Update IP to $NewIP`"" -ForegroundColor White
Write-Host "3. Push to GitHub: git push origin main" -ForegroundColor White
Write-Host "4. Deploy to server:" -ForegroundColor White
Write-Host "   scp -i `"D:\Project\lms-server-key.pem`" .env ubuntu@${NewIP}:~/LMSetjen-DPD-RI/.env" -ForegroundColor Gray
Write-Host "   ssh -i `"D:\Project\lms-server-key.pem`" ubuntu@$NewIP `"cd ~/LMSetjen-DPD-RI && git pull`"" -ForegroundColor Gray
Write-Host "   ssh -i `"D:\Project\lms-server-key.pem`" ubuntu@$NewIP `"cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml down`"" -ForegroundColor Gray
Write-Host "   ssh -i `"D:\Project\lms-server-key.pem`" ubuntu@$NewIP `"cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml up -d --build`"" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 New URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://$NewIP/" -ForegroundColor White
Write-Host "   Backend API: http://$NewIP/api/v1/" -ForegroundColor White
Write-Host "   Django Admin: http://$NewIP/admin/" -ForegroundColor White
Write-Host "   Swagger Docs: http://$NewIP/swagger/" -ForegroundColor White
Write-Host ""
