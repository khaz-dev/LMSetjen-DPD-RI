# GitHub Upload Preparation Script
# Run this script to prepare your project for GitHub upload

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "   LMSetjen DPD RI - GitHub Preparation" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root
$projectRoot = "d:\Project\LMSetjen DPD RI"
$frontend = "$projectRoot\frontend"

Set-Location $projectRoot

# Function to check if git is initialized
function Check-GitInit {
    Write-Host "Checking Git initialization..." -ForegroundColor Yellow
    if (Test-Path ".git") {
        Write-Host "✓ Git repository initialized" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Git not initialized" -ForegroundColor Red
        Write-Host "  Run: git init" -ForegroundColor Yellow
        return $false
    }
}

# Function to check for sensitive files
function Check-SensitiveFiles {
    Write-Host ""
    Write-Host "Checking for sensitive files..." -ForegroundColor Yellow
    
    $sensitivePatterns = @(".env", "*.pem", "*.key", "secrets.json", "credentials.json")
    $found = $false
    
    foreach ($pattern in $sensitivePatterns) {
        $files = git ls-files | Select-String -Pattern $pattern
        if ($files) {
            Write-Host "✗ Found sensitive file: $files" -ForegroundColor Red
            $found = $true
        }
    }
    
    if (-not $found) {
        Write-Host "✓ No sensitive files in git" -ForegroundColor Green
    }
    
    return -not $found
}

# Function to verify .env is ignored
function Check-EnvIgnored {
    Write-Host ""
    Write-Host "Checking .env files..." -ForegroundColor Yellow
    
    $envFiles = Get-ChildItem -Path $projectRoot -Filter ".env*" -Recurse -ErrorAction SilentlyContinue
    
    if ($envFiles) {
        Write-Host "✓ Found .env files (checking if ignored):" -ForegroundColor Yellow
        foreach ($file in $envFiles) {
            Write-Host "  - $($file.FullName)" -ForegroundColor Gray
        }
        
        # Check if in gitignore
        $gitignoreContent = Get-Content "$projectRoot\.gitignore" -ErrorAction SilentlyContinue
        if ($gitignoreContent -match "\.env") {
            Write-Host "✓ .env files are in .gitignore" -ForegroundColor Green
            return $true
        } else {
            Write-Host "✗ .env not in .gitignore!" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "ℹ No .env files found" -ForegroundColor Cyan
        return $true
    }
}

# Function to check build
function Test-Build {
    Write-Host ""
    Write-Host "Testing frontend build..." -ForegroundColor Yellow
    Set-Location $frontend
    
    $buildResult = & npm run build 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Build successful" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ Build failed" -ForegroundColor Red
        return $false
    }
    
    Set-Location $projectRoot
}

# Function to check documentation
function Check-Documentation {
    Write-Host ""
    Write-Host "Checking documentation..." -ForegroundColor Yellow
    
    $requiredDocs = @("README.md")
    $allPresent = $true
    
    foreach ($doc in $requiredDocs) {
        if (Test-Path "$projectRoot\$doc") {
            Write-Host "✓ $doc exists" -ForegroundColor Green
        } else {
            Write-Host "✗ $doc missing" -ForegroundColor Red
            $allPresent = $false
        }
    }
    
    return $allPresent
}

# Function to show git status
function Show-GitStatus {
    Write-Host ""
    Write-Host "Git Status:" -ForegroundColor Yellow
    git status --short
}

# Function to remove test files (optional)
function Remove-TestFiles {
    Write-Host ""
    $response = Read-Host "Do you want to remove test files? (y/N)"
    
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Removing test files..." -ForegroundColor Yellow
        
        # Remove test directory
        if (Test-Path "$frontend\src\views\test") {
            Remove-Item -Path "$frontend\src\views\test" -Recurse -Force
            Write-Host "✓ Removed src/views/test/" -ForegroundColor Green
        }
        
        # Remove cursor-test.css
        if (Test-Path "$frontend\src\views\instructor\cursor-test.css") {
            Remove-Item -Path "$frontend\src\views\instructor\cursor-test.css" -Force
            Write-Host "✓ Removed cursor-test.css" -ForegroundColor Green
        }
        
        Write-Host "Test files removed" -ForegroundColor Green
    } else {
        Write-Host "Keeping test files" -ForegroundColor Cyan
    }
}

# Main execution
Write-Host "Starting GitHub preparation checks..." -ForegroundColor Cyan
Write-Host ""

$checks = @{
    "Git Initialized" = Check-GitInit
    "No Sensitive Files" = Check-SensitiveFiles
    "ENV Files Protected" = Check-EnvIgnored
    "Documentation Complete" = Check-Documentation
    "Build Successful" = Test-Build
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "           Summary Report" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

$allPassed = $true
foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "✓ $($check.Key)" -ForegroundColor Green
    } else {
        Write-Host "✗ $($check.Key)" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

if ($allPassed) {
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host "   ✓ PROJECT READY FOR GITHUB UPLOAD" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host ""
    
    # Optional: Remove test files
    Remove-TestFiles
    
    Show-GitStatus
    
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Review git status above" -ForegroundColor White
    Write-Host "2. git add ." -ForegroundColor White
    Write-Host "3. git commit -m 'Initial commit'" -ForegroundColor White
    Write-Host "4. git remote add origin <your-repo-url>" -ForegroundColor White
    Write-Host "5. git push -u origin main" -ForegroundColor White
} else {
    Write-Host "===========================================" -ForegroundColor Red
    Write-Host "   ✗ ISSUES FOUND - FIX BEFORE UPLOAD" -ForegroundColor Red
    Write-Host "===========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues marked with ✗ above" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "For detailed report, check:" -ForegroundColor Cyan
Write-Host "frontend\PRE_GITHUB_CLEANUP_REPORT.md" -ForegroundColor White
Write-Host ""
