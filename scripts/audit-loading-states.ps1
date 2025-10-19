# Loading State Audit Script for Instructor Pages
# Run this script to verify all instructor pages follow the non-blocking loading standard

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "Instructor Page Loading State Audit"  -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "d:\Project\LMSetjen DPD RI"
$instructorPath = "$projectRoot\frontend\src\views\instructor"

$violations = 0
$passed = 0

Write-Host "Checking for BLOCKING PATTERNS..." -ForegroundColor Yellow
Write-Host ""

# Check 1: Fixed positioning with high z-index
Write-Host "1. Checking for full-page blocking overlays..." -ForegroundColor White
$blockingPattern = Get-ChildItem -Path $instructorPath -Filter "*.jsx" | Select-String -Pattern "position.*fixed.*zIndex.*9999"

if ($blockingPattern) {
    Write-Host "   VIOLATION: Found blocking overlay patterns" -ForegroundColor Red
    foreach ($match in $blockingPattern) {
        Write-Host "      File: $($match.Filename)" -ForegroundColor Red
        Write-Host "      Line: $($match.LineNumber)" -ForegroundColor Red
    }
    $violations++
} else {
    Write-Host "   PASSED: No blocking overlays found" -ForegroundColor Green
    $passed++
}
Write-Host ""

# Check 2: Old LoadingSpinner usage
Write-Host "2. Checking for deprecated LoadingSpinner fullPage usage..." -ForegroundColor White
$oldSpinnerPattern = Get-ChildItem -Path $instructorPath -Filter "*.jsx" | Select-String -Pattern "LoadingSpinner.*fullPage"

if ($oldSpinnerPattern) {
    Write-Host "   VIOLATION: Found deprecated LoadingSpinner usage" -ForegroundColor Red
    foreach ($match in $oldSpinnerPattern) {
        Write-Host "      File: $($match.Filename)" -ForegroundColor Red
        Write-Host "      Line: $($match.LineNumber)" -ForegroundColor Red
    }
    $violations++
} else {
    Write-Host "   PASSED: No deprecated LoadingSpinner usage" -ForegroundColor Green
    $passed++
}
Write-Host ""

# Check 3: Verify MinimalLoader is imported
Write-Host "3. Checking for MinimalLoader imports..." -ForegroundColor White
$criticalPages = @(
    "Dashboard.jsx",
    "Courses.jsx",
    "Profile.jsx",
    "Review.jsx",
    "TeacherNotification.jsx",
    "QA.jsx",
    "Students.jsx",
    "CourseQuiz.jsx",
    "CourseEdit.jsx",
    "CourseEditCurriculum.jsx"
)

$missingCount = 0
foreach ($page in $criticalPages) {
    $filePath = Join-Path $instructorPath $page
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        if ($content -match "if \((loading|uiState\.loading)") {
            if ($content -notmatch "import MinimalLoader") {
                Write-Host "   WARNING: $page missing MinimalLoader import" -ForegroundColor Yellow
                $missingCount++
            }
        }
    }
}

if ($missingCount -eq 0) {
    Write-Host "   PASSED: All pages import MinimalLoader" -ForegroundColor Green
    $passed++
} else {
    Write-Host "   VIOLATION: $missingCount pages missing MinimalLoader" -ForegroundColor Red
    $violations++
}
Write-Host ""

# Check 4: Multiple loading conditions
Write-Host "4. Checking for duplicate loading conditions..." -ForegroundColor White
$duplicateCount = 0
foreach ($page in $criticalPages) {
    $filePath = Join-Path $instructorPath $page
    if (Test-Path $filePath) {
        $content = Get-Content $filePath
        $loadingConditions = $content | Select-String -Pattern "if \((loading|uiState\.loading)" -AllMatches
        
        if ($loadingConditions.Count -gt 1) {
            Write-Host "   WARNING: $page has $($loadingConditions.Count) loading conditions" -ForegroundColor Yellow
            $duplicateCount++
        }
    }
}

if ($duplicateCount -eq 0) {
    Write-Host "   PASSED: No duplicate loading conditions" -ForegroundColor Green
    $passed++
} else {
    Write-Host "   VIOLATION: $duplicateCount pages with duplicates" -ForegroundColor Red
    $violations++
}
Write-Host ""

# Summary Report
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Summary Report
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($violations -eq 0) {
    Write-Host "ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host "Passed: $passed checks" -ForegroundColor Green
} else {
    Write-Host "VIOLATIONS FOUND: $violations" -ForegroundColor Red
    Write-Host "Passed: $passed checks" -ForegroundColor Green
    Write-Host ""
    Write-Host "Please review LOADING_STATE_STANDARDS.md" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Audit completed" -ForegroundColor Cyan
