# CSS Loading Race Condition - Verification Script
# Tests that inline critical CSS is present and correctly formatted

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CSS LOADING FIX VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = "d:\Project\LMSetjen DPD RI"
$indexHtmlPath = "$rootPath\frontend\index.html"
$passCount = 0
$failCount = 0
$totalChecks = 8

function Test-Check {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    if ($Passed) {
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
        if ($Details) {
            Write-Host "   └─ $Details" -ForegroundColor Gray
        }
        return 1
    } else {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        if ($Details) {
            Write-Host "   └─ $Details" -ForegroundColor Yellow
        }
        return 0
    }
}

Write-Host "Checking: $indexHtmlPath" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $indexHtmlPath)) {
    Write-Host "❌ ERROR: index.html not found!" -ForegroundColor Red
    exit 1
}

$htmlContent = Get-Content $indexHtmlPath -Raw

# Check 1: Inline critical CSS block exists
Write-Host "CHECK 1: Inline Critical CSS Block" -ForegroundColor Cyan
$hasCriticalCssComment = $htmlContent -match "CRITICAL CSS - SPINNER FIX"
$passCount += Test-Check -TestName "Critical CSS comment present" -Passed $hasCriticalCssComment
if (-not $hasCriticalCssComment) { $failCount++ }

# Check 2: Spinner base styles inline
Write-Host "`nCHECK 2: Spinner Base Styles" -ForegroundColor Cyan
$hasSpinnerBorder = $htmlContent -match "\.spinner-border\s*\{"
$hasSpinnerSm = $htmlContent -match "\.spinner-border-sm\s*\{"
$passCount += Test-Check -TestName ".spinner-border styles inline" -Passed $hasSpinnerBorder
if (-not $hasSpinnerBorder) { $failCount++ }
$passCount += Test-Check -TestName ".spinner-border-sm styles inline" -Passed $hasSpinnerSm
if (-not $hasSpinnerSm) { $failCount++ }

# Check 3: Animation keyframes inline
Write-Host "`nCHECK 3: Animation Keyframes" -ForegroundColor Cyan
$hasKeyframes = $htmlContent -match "@keyframes spinner-border-rotate"
$passCount += Test-Check -TestName "Spinner animation keyframes present" -Passed $hasKeyframes
if (-not $hasKeyframes) { $failCount++ }

# Check 4: Consistency fixes inline
Write-Host "`nCHECK 4: Consistency Fixes" -ForegroundColor Cyan
$hasFlexShrink = $htmlContent -match "flex-shrink:\s*0\s*!important"
$hasAspectRatio = $htmlContent -match "aspect-ratio:\s*1\s*/\s*1\s*!important"
$passCount += Test-Check -TestName "Flex-shrink fix present" -Passed $hasFlexShrink
if (-not $hasFlexShrink) { $failCount++ }
$passCount += Test-Check -TestName "Aspect-ratio fix present" -Passed $hasAspectRatio
if (-not $hasAspectRatio) { $failCount++ }

# Check 5: Bootstrap preload pattern
Write-Host "`nCHECK 5: CSS Preload Pattern" -ForegroundColor Cyan
$hasBootstrapPreload = ($htmlContent -like '*rel="preload"*bootstrap*')
$passCount += Test-Check -TestName "Bootstrap CSS uses preload" -Passed $hasBootstrapPreload -Details "Non-blocking CSS loading"
if (-not $hasBootstrapPreload) { $failCount++ }

# Check 6: Font Awesome preload
Write-Host "`nCHECK 6: Icon Libraries Preload" -ForegroundColor Cyan
$hasFontAwesomePreload = ($htmlContent -like '*rel="preload"*font-awesome*')
$passCount += Test-Check -TestName "Font Awesome uses preload" -Passed $hasFontAwesomePreload -Details "Optimized icon loading"
if (-not $hasFontAwesomePreload) { $failCount++ }

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Checks: $totalChecks" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host "CSS loading race condition fix verified successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Test with hard refresh (Ctrl+Shift+R)" -ForegroundColor White
    Write-Host "2. Test with DevTools Network throttling (Slow 3G)" -ForegroundColor White
    Write-Host "3. Verify spinners appear correctly from frame 1" -ForegroundColor White
    Write-Host "4. Check Performance tab for zero FOUC" -ForegroundColor White
    exit 0
} else {
    Write-Host "⚠️ SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host "Please review the inline critical CSS in index.html" -ForegroundColor Yellow
    exit 1
}
