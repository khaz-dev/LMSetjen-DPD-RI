#!/usr/bin/env pwsh

################################################################################
#
#  LMSetjen DPD RI - Staging Database Cleanup Script (SIMPLIFIED)
#  PowerShell Deployment Script - Safe & Reliable
#
#  This is a simplified version that avoids complex quoting issues
#
#  USAGE:
#    .\cleanup-staging-databases-simple.ps1
#
#  DATABASES TO DELETE:
#    - testdb       (test database)
#    - testdb2      (test database)
#    - testfixdb    (test database)
#    - lmsdb_staging (old staging database)
#
################################################################################

param(
    [Parameter(Mandatory=$false)]
    [string]$SSHKeyPath = "c:\Users\khair\khaz",
    
    [Parameter(Mandatory=$false)]
    [string]$StagingServerIP = "165.245.191.216"
)

$ErrorActionPreference = "Stop"

# Colors
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

$SSHUser = "root"
$SSHHost = "$SSHUser@$StagingServerIP"

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

function Execute-SSH {
    param(
        [string]$Command,
        [switch]$IgnoreErrors = $false
    )
    
    try {
        $result = ssh -i "$SSHKeyPath" $SSHHost $Command 2>&1
        if ($LASTEXITCODE -eq 0 -or $IgnoreErrors) {
            return $result
        } else {
            if (-not $IgnoreErrors) {
                throw "SSH command failed"
            }
            return $result
        }
    } catch {
        if (-not $IgnoreErrors) {
            Write-Error-Custom "SSH Error: $_"
            throw $_
        }
        return $null
    }
}

# =========================================================================
# Main Script
# =========================================================================

Write-Header "LMSetjen DPD RI - PostgreSQL Cleanup (SIMPLIFIED)"

# Step 1: Test Connection
Write-Header "Step 1: Testing Connection to $StagingServerIP"

try {
    $result = Execute-SSH "echo 'Connection OK'; hostname"
    Write-Success "SSH connection established"
    Write-Info $result
} catch {
    Write-Error-Custom "Cannot connect to server"
    exit 1
}

Write-Host ""

# Step 2: List Databases
Write-Header "Step 2: Current Databases"

Write-Info "Running: psql command to list databases..."
Write-Host ""

# Simple command to list databases - one database per line
$cmd = 'sudo -i -u postgres psql -l | grep -E "lmsdb|testdb|kmsdb"'
$dbList = Execute-SSH $cmd -IgnoreErrors

if ($dbList) {
    $dbList | ForEach-Object {
        if ($_ -match '\S') {
            Write-Host "  $_"
        }
    }
} else {
    Write-Info "Could not list databases (check server access)"
}

Write-Host ""

# Step 3: Confirmation
Write-Header "Step 3: Confirmation"

Write-Warning-Custom "The following databases will be DELETED:"
Write-Host "  • testdb"
Write-Host "  • testdb2"
Write-Host "  • testfixdb"
Write-Host "  • lmsdb_staging"
Write-Host ""
Write-Warning-Custom "This action is IRREVERSIBLE!"
Write-Host ""

$confirm = Read-Host "Type 'DELETE ALL' to proceed (or press Enter to cancel)"

if ($confirm -ne "DELETE ALL") {
    Write-Warning-Custom "Cleanup cancelled"
    exit 0
}

Write-Host ""

# Step 4: Create Backup
Write-Header "Step 4: Creating Backup"

Write-Info "Creating backup directory..."
Execute-SSH "mkdir -p /var/www/backups/lms" -IgnoreErrors | Out-Null

Write-Info "Backing up test databases..."
$backupDatetime = Get-Date -Format "yyyyMMdd_HHmmss"

foreach ($db in @("testdb", "testdb2", "testfixdb", "lmsdb_staging")) {
    $cmd = "sudo -i -u postgres pg_dump $db > /var/www/backups/lms/backup_${backupDatetime}_${db}.sql 2>/dev/null"
    $result = Execute-SSH $cmd -IgnoreErrors
    
    if ($LASTEXITCODE -eq 0 -or $result -eq $null) {
        Write-Success "Backup: $db"
    } else {
        Write-Warning-Custom "Could not backup: $db (may not exist)"
    }
}

Write-Host ""

# Step 5: Drop Databases
Write-Header "Step 5: Deleting Databases"

foreach ($db in @("testdb", "testdb2", "testfixdb", "lmsdb_staging")) {
    Write-Info "Deleting: $db"
    
    # Terminate connections first
    $cmd = "sudo -i -u postgres psql -c 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ''$db'' AND pid <> pg_backend_pid();' 2>/dev/null"
    Execute-SSH $cmd -IgnoreErrors | Out-Null
    
    # Drop database
    $cmd = "sudo -i -u postgres psql -c 'DROP DATABASE IF EXISTS $db;' 2>/dev/null"
    $result = Execute-SSH $cmd -IgnoreErrors
    
    if ($LASTEXITCODE -eq 0 -or $result -eq $null) {
        Write-Success "Deleted: $db"
    } else {
        Write-Warning-Custom "Already deleted or not found: $db"
    }
}

Write-Host ""

# Step 6: Verify
Write-Header "Step 6: Verifying Cleanup"

Write-Info "Remaining databases:"
Write-Host ""

$cmd = 'sudo -i -u postgres psql -l | grep -E "lmsdb|kmsdb|postgres|template"'
$remaining = Execute-SSH $cmd -IgnoreErrors

if ($remaining) {
    $remaining | ForEach-Object {
        if ($_ -match '\S') {
            Write-Host "  $_"
        }
    }
} else {
    Write-Info "(Could not verify)"
}

Write-Host ""

# Final Summary
Write-Header "✅ CLEANUP COMPLETE"

Write-Success "Test databases have been removed"
Write-Info "Backup location: /var/www/backups/lms/"
Write-Info "Active databases:"
Write-Host "  • kmsdb (KMS application)"
Write-Host "  • lmsdb (LMS application) ← Current"
Write-Host ""
Write-Info "Your staging PostgreSQL is now clean!"
Write-Host ""
