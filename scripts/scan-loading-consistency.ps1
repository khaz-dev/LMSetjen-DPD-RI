# Loading Spinner Consistency Verification Script
# Scans all instructor pages to ensure consistent loading patterns

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Loading Spinner Consistency Scan" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "d:\Project\LMSetjen DPD RI"
$instructorPath = "$projectRoot\frontend\src\views\instructor"

$issues = @()
$passed = @()

Write-Host "Scanning Instructor Pages..." -ForegroundColor Yellow
Write-Host ""

# Check 1: Row classes in loading states
Write-Host "1. Checking for consistent row spacing..." -ForegroundColor White
$instructorPages = Get-ChildItem -Path $instructorPath -Filter "*.jsx" | 
    Where-Object { $_.Name -notmatch "^Partials|^components|^curriculum" }

foreach ($file in $instructorPages) {
    $content = Get-Content $file.FullName -Raw
    
    # Check if file has loading state
    if ($content -match 'if \((loading|uiState\.loading)') {
        # Check for row class
        $loadingSection = $content -match '(?s)if \((loading|uiState\.loading).*?return.*?</>'
        
        if ($content -match 'className="row"(?!\s+mt-)' -and $content -match 'minHeight.*calc\(100vh') {
            Write-Host "   WARNING: $($file.Name) - Row missing mt-0 mt-md-4" -ForegroundColor Yellow
            $issues += "$($file.Name): Row class needs mt-0 mt-md-4"
        }
    }
}

if ($issues.Count -eq 0) {
    Write-Host "   PASSED: All rows have consistent spacing" -ForegroundColor Green
    $passed += "Row spacing consistent"
}
Write-Host ""

# Check 2: Spinner sizing consistency
Write-Host "2. Checking spinner size consistency..." -ForegroundColor White
$spinnerSizes = @{}

foreach ($file in $instructorPages) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match 'if \((loading|uiState\.loading)') {
        # Extract spinner size
        if ($content -match 'spinner-border.*?width:\s*[''"]([^''"]+)[''"]') {
            $size = $matches[1]
            if (-not $spinnerSizes.ContainsKey($size)) {
                $spinnerSizes[$size] = @()
            }
            $spinnerSizes[$size] += $file.Name
        }
    }
}

if ($spinnerSizes.Count -eq 1 -and $spinnerSizes.ContainsKey('3rem')) {
    Write-Host "   PASSED: All spinners use 3rem size" -ForegroundColor Green
    $passed += "Spinner size consistent (3rem)"
} else {
    Write-Host "   WARNING: Inconsistent spinner sizes found" -ForegroundColor Yellow
    foreach ($size in $spinnerSizes.Keys) {
        Write-Host "      Size $size used in: $($spinnerSizes[$size] -join ', ')" -ForegroundColor Yellow
    }
    $issues += "Inconsistent spinner sizes"
}
Write-Host ""

# Check 3: MinHeight consistency
Write-Host "3. Checking minHeight consistency..." -ForegroundColor White
$minHeights = @{}

foreach ($file in $instructorPages) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match 'if \((loading|uiState\.loading)') {
        # Extract col minHeight
        if ($content -match 'col-lg-9.*?minHeight:\s*[''"]([^''"]+)[''"]') {
            $height = $matches[1]
            if (-not $minHeights.ContainsKey($height)) {
                $minHeights[$height] = @()
            }
            $minHeights[$height] += $file.Name
        }
    }
}

if ($minHeights.Count -eq 1 -and $minHeights.ContainsKey('60vh')) {
    Write-Host "   PASSED: All content columns use 60vh minHeight" -ForegroundColor Green
    $passed += "MinHeight consistent (60vh)"
} else {
    Write-Host "   WARNING: Inconsistent minHeight values found" -ForegroundColor Yellow
    foreach ($height in $minHeights.Keys) {
        Write-Host "      Height $height used in: $($minHeights[$height] -join ', ')" -ForegroundColor Yellow
    }
    $issues += "Inconsistent minHeight values"
}
Write-Host ""

# Check 4: Flexbox centering
Write-Host "4. Checking flexbox centering patterns..." -ForegroundColor White
$missingFlex = @()

foreach ($file in $instructorPages) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match 'if \((loading|uiState\.loading)') {
        # Check for complete flexbox pattern
        $hasDisplay = $content -match 'display:\s*[''"]flex[''"]'
        $hasAlign = $content -match 'alignItems:\s*[''"]center[''"]'
        $hasJustify = $content -match 'justifyContent:\s*[''"]center[''"]'
        
        if (-not ($hasDisplay -and $hasAlign -and $hasJustify)) {
            Write-Host "   WARNING: $($file.Name) - Incomplete flexbox centering" -ForegroundColor Yellow
            $missingFlex += $file.Name
        }
    }
}

if ($missingFlex.Count -eq 0) {
    Write-Host "   PASSED: All pages use complete flexbox centering" -ForegroundColor Green
    $passed += "Flexbox centering complete"
} else {
    $issues += "Incomplete flexbox centering in: $($missingFlex -join ', ')"
}
Write-Host ""

# Check 5: Message consistency
Write-Host "5. Checking loading message patterns..." -ForegroundColor White
$messageIssues = @()

foreach ($file in $instructorPages) {
    $content = Get-Content $file.FullName -Raw
    
    if ($content -match 'if \((loading|uiState\.loading)') {
        # Check for message in both MinimalLoader and text
        $minimalLoaderMsg = if ($content -match 'MinimalLoader message="([^"]+)"') { $matches[1] } else { $null }
        $textMsg = if ($content -match '<p className="mt-3 text-muted">([^<]+)</p>') { $matches[1] } else { $null }
        
        if ($minimalLoaderMsg -and $textMsg) {
            if ($minimalLoaderMsg -ne $textMsg) {
                Write-Host "   WARNING: $($file.Name) - Mismatched messages" -ForegroundColor Yellow
                Write-Host "      MinimalLoader: $minimalLoaderMsg" -ForegroundColor Cyan
                Write-Host "      Text: $textMsg" -ForegroundColor Cyan
                $messageIssues += $file.Name
            }
        }
    }
}

if ($messageIssues.Count -eq 0) {
    Write-Host "   PASSED: All loading messages are consistent" -ForegroundColor Green
    $passed += "Loading messages consistent"
} else {
    $issues += "Mismatched loading messages in: $($messageIssues -join ', ')"
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SCAN SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Scanned: $($instructorPages.Count) instructor pages" -ForegroundColor White
Write-Host "Passed Checks: $($passed.Count)" -ForegroundColor Green
Write-Host "Issues Found: $($issues.Count)" -ForegroundColor $(if ($issues.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($issues.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    foreach ($check in $passed) {
        Write-Host "  $check" -ForegroundColor Green
    }
} else {
    Write-Host "ISSUES DETECTED:" -ForegroundColor Yellow
    Write-Host ""
    foreach ($issue in $issues) {
        Write-Host "  $issue" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Recommendation: Review docs/fixes/loading-spinner-consistency-analysis.md" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Scan completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
