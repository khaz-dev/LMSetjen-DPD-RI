# Lighthouse Audit Script for LMSetjen DPD RI
# This script serves the production build and runs Lighthouse audit

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lighthouse Audit - LMSetjen DPD RI" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if dist folder exists
if (-Not (Test-Path "dist")) {
    Write-Host "❌ Error: dist folder not found!" -ForegroundColor Red
    Write-Host "Please run 'npm run build' first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found dist folder" -ForegroundColor Green
Write-Host ""

# Step 2: Start the server in background
Write-Host "🚀 Starting local server on port 3000..." -ForegroundColor Yellow

$serverJob = Start-Job -ScriptBlock {
    Set-Location "d:\Project\LMSetjen DPD RI\frontend"
    npx serve -s dist -l 3000
}

# Wait for server to start
Write-Host "⏳ Waiting for server to start (10 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Step 3: Test if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Error: Server is not responding!" -ForegroundColor Red
    Stop-Job -Job $serverJob
    Remove-Job -Job $serverJob
    exit 1
}

# Step 4: Run Lighthouse audit
Write-Host "🔍 Running Lighthouse audit..." -ForegroundColor Yellow
Write-Host "This may take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

try {
    npx lighthouse http://localhost:3000 `
        --output=html `
        --output=json `
        --output-path="lighthouse-report" `
        --chrome-flags="--no-sandbox --disable-dev-shm-usage" `
        --only-categories=performance,accessibility,best-practices,seo `
        --preset=desktop `
        --quiet
    
    Write-Host ""
    Write-Host "✅ Lighthouse audit completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Reports generated:" -ForegroundColor Cyan
    Write-Host "  - lighthouse-report.html" -ForegroundColor White
    Write-Host "  - lighthouse-report.json" -ForegroundColor White
    Write-Host ""
    
    # Open the report
    Write-Host "🌐 Opening report in browser..." -ForegroundColor Yellow
    Start-Process "lighthouse-report.html"
    
} catch {
    Write-Host "❌ Error running Lighthouse: $_" -ForegroundColor Red
} finally {
    # Step 5: Stop the server
    Write-Host ""
    Write-Host "🛑 Stopping server..." -ForegroundColor Yellow
    Stop-Job -Job $serverJob
    Remove-Job -Job $serverJob
    Write-Host "✅ Server stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Audit Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
