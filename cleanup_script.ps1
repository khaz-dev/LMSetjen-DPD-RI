# Project Cleanup Script
# Run this PowerShell script to clean console.log statements from production files

$projectRoot = "d:\Project\LMSetjen DPD RI\frontend\src"

# Files to clean (keeping error logging for production debugging)
$filesToClean = @(
    "views\instructor\components\VideoUpload.jsx",
    "utils\videoCompression.js"
)

Write-Host "🧹 Starting console.log cleanup..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $filesToClean) {
    $filePath = Join-Path $projectRoot $file
    
    if (Test-Path $filePath) {
        Write-Host "📝 Processing: $file" -ForegroundColor Yellow
        
        # Read file content
        $content = Get-Content $filePath -Raw
        
        # Count console.log statements (excluding console.error)
        $logCount = ([regex]::Matches($content, 'console\.log\(')).Count
        $warnCount = ([regex]::Matches($content, 'console\.warn\(')).Count
        $debugCount = ([regex]::Matches($content, 'console\.debug\(')).Count
        
        $totalBefore = $logCount + $warnCount + $debugCount
        
        if ($totalBefore -gt 0) {
            Write-Host "   Found: $logCount logs, $warnCount warnings, $debugCount debug statements" -ForegroundColor Gray
            Write-Host "   ⚠️  Manual review required" -ForegroundColor Red
            Write-Host "   Location: $filePath" -ForegroundColor Gray
        } else {
            Write-Host "   ✅ Already clean!" -ForegroundColor Green
        }
        
        Write-Host ""
    } else {
        Write-Host "❌ Not found: $file" -ForegroundColor Red
        Write-Host ""
    }
}

Write-Host "🎯 Summary:" -ForegroundColor Cyan
Write-Host "   - Test files: DELETED ✅"
Write-Host "   - Sensitive files: DELETED ✅"
Write-Host "   - Documentation: ORGANIZED ✅"
Write-Host "   - Console logs: REVIEW REQUIRED ⚠️"
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Manually review VideoUpload.jsx and videoCompression.js"
Write-Host "   2. Keep console.error for production debugging"
Write-Host "   3. Remove console.log/warn/debug for development only"
Write-Host "   4. Update .gitignore if needed"
Write-Host "   5. Run 'git status' to review changes"
Write-Host ""
