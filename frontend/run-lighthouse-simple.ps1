# Simple Lighthouse Audit Runner
# Usage: .\run-lighthouse-simple.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lighthouse Audit Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "STEP 1: Start the server manually" -ForegroundColor Yellow
Write-Host "  Open a NEW PowerShell terminal and run:" -ForegroundColor White
Write-Host "  cd `"d:\Project\LMSetjen DPD RI\frontend`"" -ForegroundColor Green
Write-Host "  npx serve -s dist -l 3000" -ForegroundColor Green
Write-Host ""

Write-Host "STEP 2: Wait for server to start" -ForegroundColor Yellow
Write-Host "  You should see: 'Serving! Local: http://localhost:3000'" -ForegroundColor White
Write-Host ""

Write-Host "STEP 3: Press ENTER when server is ready" -ForegroundColor Yellow
Read-Host "Press ENTER to continue"

Write-Host ""
Write-Host "Testing connection to http://localhost:3000..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Server is responding!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Error: Cannot connect to server!" -ForegroundColor Red
    Write-Host "Please make sure the server is running and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "🔍 Running Lighthouse audit..." -ForegroundColor Yellow
Write-Host "This will take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

npx lighthouse http://localhost:3000 `
    --output=html `
    --output=json `
    --output-path="lighthouse-report" `
    --chrome-flags="--no-sandbox --disable-dev-shm-usage --disable-gpu" `
    --only-categories=performance,accessibility,best-practices,seo `
    --preset=desktop

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Lighthouse audit completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Reports generated:" -ForegroundColor Cyan
    Write-Host "  - lighthouse-report.html" -ForegroundColor White
    Write-Host "  - lighthouse-report.json" -ForegroundColor White
    Write-Host ""
    
    # Open the report
    Write-Host "🌐 Opening report in browser..." -ForegroundColor Yellow
    Start-Process "lighthouse-report.html"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SUCCESS! Check the HTML report" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Lighthouse audit failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Remember to stop the server (Ctrl+C in the other terminal)" -ForegroundColor Yellow
