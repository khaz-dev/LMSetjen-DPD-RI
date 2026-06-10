#!/usr/bin/env pwsh

################################################################################
#
#  LMSetjen DPD RI - Google OAuth Staging Configuration Helper
#  PowerShell Script to Update and Deploy OAuth Credentials
#
#  This script helps update the .env.staging file with real Google OAuth
#  credentials and deploys to the staging server.
#
#  USAGE:
#    .\setup-google-oauth-staging.ps1
#    .\setup-google-oauth-staging.ps1 -ClientID "your-id" -ClientSecret "your-secret"
#
################################################################################

param(
    [Parameter(Mandatory=$false)]
    [string]$ClientID = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ClientSecret = "",
    
    [Parameter(Mandatory=$false)]
    [string]$StagingDomain = "lms.khaz.app",
    
    [Parameter(Mandatory=$false)]
    [switch]$DeployAfterUpdate = $false
)

$ErrorActionPreference = "Stop"

# Colors
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

# =========================================================================
# Helper Functions
# =========================================================================

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor $Cyan
    Write-Host "  $Message" -ForegroundColor $Cyan
    Write-Host "========================================================================" -ForegroundColor $Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor $Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message"
}

# =========================================================================
# Main Script
# =========================================================================

Write-Header "LMSetjen DPD RI - Google OAuth Staging Configuration"

# Step 1: Check if .env.staging exists
Write-Header "Step 1: Checking Configuration File"

$envStagingFile = ".env.staging"

if (Test-Path $envStagingFile) {
    Write-Success ".env.staging file found"
} else {
    Write-Error-Custom ".env.staging file not found in current directory"
    Write-Info "Current directory: $(Get-Location)"
    exit 1
}

# Step 2: Display current (wrong) configuration
Write-Header "Step 2: Current Configuration (PLACEHOLDER - WRONG)"

Write-Warning-Custom "Current values in .env.staging:"
Write-Host ""

$content = Get-Content $envStagingFile -Raw
$lines = $content -split "`n"

$lines | ForEach-Object {
    if ($_ -match "GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|VITE_GOOGLE_CLIENT_ID") {
        if ($_ -notmatch "^#") {
            Write-Host "  $_"
        }
    }
}

Write-Host ""
Write-Warning-Custom "These are PLACEHOLDER values and must be replaced with REAL Google OAuth credentials"
Write-Host ""

# Step 3: Get credentials from user if not provided
Write-Header "Step 3: Enter Your Google OAuth Credentials"

if (-not $ClientID) {
    Write-Info "Go to: https://console.cloud.google.com/apis/credentials"
    Write-Info "Create OAuth 2.0 Client ID for Web Application"
    Write-Info "Add authorized redirect URI: https://$StagingDomain/login"
    Write-Info ""
    
    $ClientID = Read-Host "Enter your Google Client ID (e.g., 634643...apps.googleusercontent.com)"
    
    if (-not $ClientID -or $ClientID -match "your-staging") {
        Write-Error-Custom "Invalid Client ID provided"
        exit 1
    }
}

if (-not $ClientSecret) {
    $ClientSecret = Read-Host "Enter your Google Client Secret (e.g., GOCSPX-...)" -AsSecureString
    $ClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($ClientSecret))
    
    if (-not $ClientSecret -or $ClientSecret -match "your-staging") {
        Write-Error-Custom "Invalid Client Secret provided"
        exit 1
    }
}

Write-Host ""

# Step 4: Update .env.staging
Write-Header "Step 4: Updating .env.staging"

Write-Info "Creating backup of current .env.staging..."
$backupFile = ".env.staging.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item $envStagingFile $backupFile
Write-Success "Backup created: $backupFile"

Write-Info "Updating environment variables..."

# Read current content
$content = Get-Content $envStagingFile -Raw

# Replace placeholder values with real credentials
$content = $content -replace 'GOOGLE_CLIENT_ID=your-staging-google-client-id-here', "GOOGLE_CLIENT_ID=$ClientID"
$content = $content -replace 'GOOGLE_CLIENT_SECRET=your-staging-google-client-secret-here', "GOOGLE_CLIENT_SECRET=$ClientSecret"
$content = $content -replace 'VITE_GOOGLE_CLIENT_ID=your-staging-google-client-id-here', "VITE_GOOGLE_CLIENT_ID=$ClientID"

# Write updated content
Set-Content $envStagingFile $content

Write-Success ".env.staging updated with real credentials"

# Step 5: Display updated configuration
Write-Header "Step 5: Updated Configuration (NOW CORRECT)"

Write-Success "New values in .env.staging:"
Write-Host ""

Get-Content $envStagingFile | ForEach-Object {
    if ($_ -match "GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|VITE_GOOGLE_CLIENT_ID") {
        if ($_ -notmatch "^#") {
            if ($_ -match "CLIENT_SECRET") {
                Write-Host "  $($_ -replace '=.*', '=***HIDDEN***')" -ForegroundColor $Green
            } else {
                Write-Host "  $_" -ForegroundColor $Green
            }
        }
    }
}

Write-Host ""

# Step 6: Verify format
Write-Header "Step 6: Validating Configuration"

$newContent = Get-Content $envStagingFile -Raw
$hasClientId = $newContent -match "GOOGLE_CLIENT_ID=$ClientID"
$hasClientSecret = $newContent -match "GOOGLE_CLIENT_SECRET=$ClientSecret"

if ($hasClientId -and $hasClientSecret) {
    Write-Success "Configuration is valid ✓"
} else {
    Write-Error-Custom "Configuration update failed"
    exit 1
}

Write-Host ""

# Step 7: Ask about deployment
Write-Header "Step 7: Deployment"

if ($DeployAfterUpdate) {
    $deploy = "yes"
} else {
    Write-Info "Would you like to deploy these changes to the staging server now?"
    Write-Info "This will run the deployment script and restart Docker containers."
    Write-Host ""
    $deploy = Read-Host "Deploy now? (yes/no) [default: no]"
}

if ($deploy -eq "yes") {
    Write-Header "Deploying to Staging Server"
    
    # Check if deployment script exists
    if (-not (Test-Path "deploy-to-staging.ps1")) {
        Write-Error-Custom "deploy-to-staging.ps1 not found"
        Write-Info "Current directory: $(Get-Location)"
        exit 1
    }
    
    Write-Info "Starting deployment..."
    Write-Info "Mode: update-only (preserves existing data)"
    Write-Host ""
    
    # Run deployment script
    & .\deploy-to-staging.ps1 -Mode "update-only"
    
    Write-Header "✅ DEPLOYMENT COMPLETE"
    Write-Success "Google OAuth credentials have been deployed to staging server"
    
} else {
    Write-Header "📋 Manual Deployment Instructions"
    
    Write-Info "To deploy these changes manually:"
    Write-Host ""
    Write-Host "1. Commit changes to git (if using version control)"
    Write-Host "   git add .env.staging"
    Write-Host "   git commit -m 'Update Google OAuth credentials for staging'"
    Write-Host ""
    Write-Host "2. Run deployment script:"
    Write-Host "   .\deploy-to-staging.ps1 -Mode update-only"
    Write-Host ""
    Write-Host "3. Or manually SSH and restart:"
    Write-Host "   ssh -i c:\Users\khair\khaz root@165.245.191.216"
    Write-Host "   cd /var/www/html/lms"
    Write-Host "   docker-compose down && docker-compose up -d"
    Write-Host ""
}

# Step 8: Final checklist
Write-Header "✅ NEXT STEPS - Testing"

Write-Info "After deployment, verify the fix:"
Write-Host ""
Write-Host "1. Open browser: https://$StagingDomain/login/"
Write-Host "2. Click: 'Masuk dengan Google' button"
Write-Host "3. Complete Google OAuth flow"
Write-Host "4. Should successfully log in"
Write-Host ""

Write-Info "If still having issues:"
Write-Host ""
Write-Host "1. Check Google Cloud Console:"
Write-Host "   https://console.cloud.google.com/apis/credentials"
Write-Host "   Verify redirect URI: https://$StagingDomain/login"
Write-Host ""
Write-Host "2. Check server environment:"
Write-Host "   ssh -i c:\Users\khair\khaz root@165.245.191.216"
Write-Host "   cd /var/www/html/lms"
Write-Host "   docker-compose exec backend env | grep GOOGLE"
Write-Host ""
Write-Host "3. Check browser console (F12):"
Write-Host "   Open DevTools while on $StagingDomain/login"
Write-Host "   Look for any console errors about Google"
Write-Host ""

Write-Success "Setup complete!"
Write-Host ""
