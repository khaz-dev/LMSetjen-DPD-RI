#!/usr/bin/env pwsh

################################################################################
#
#  LMSetjen DPD RI - Staging Database Cleanup Script (PowerShell)
#  
#  This script removes unnecessary test databases from PostgreSQL
#  on the staging server (165.245.191.216)
#
#  USAGE:
#    .\cleanup-staging-databases.ps1
#    .\cleanup-staging-databases.ps1 -SSHKeyPath "c:\Users\khair\khaz" -StagingServerIP "165.245.191.216"
#
#  DATABASES TO REMOVE:
#    - testdb       (test database, not used)
#    - testdb2      (test database, not used)
#    - testfixdb    (test database, not used)
#    - lmsdb_staging (old/unused LMS staging database)
#
#  DATABASES TO KEEP:
#    - kmsdb        (KMS application - DO NOT DELETE)
#    - lmsdb        (LMS application - DO NOT DELETE)
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
                Write-Error-Custom "SSH command failed with exit code $LASTEXITCODE"
                return $result
            }
        }
    } catch {
        if (-not $IgnoreErrors) {
            Write-Error-Custom "SSH execution error: $_"
            throw $_
        }
    }
}

# =========================================================================
# Main Script
# =========================================================================

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor $Cyan
Write-Host "  LMSetjen DPD RI - Staging Database Cleanup" -ForegroundColor $Cyan
Write-Host "  Server: $StagingServerIP" -ForegroundColor $Cyan
Write-Host "=========================================================================" -ForegroundColor $Cyan
Write-Host ""

# Step 1: Test SSH Connection
Write-Header "Step 1: Testing SSH Connection"
Write-Info "Target: $SSHHost"

try {
    $result = Execute-SSH "echo 'SSH Connection OK'; pwd"
    Write-Success "SSH connection established"
} catch {
    Write-Error-Custom "Cannot connect to server. Check SSH key and IP address."
    exit 1
}

# Step 2: List Current Databases
Write-Header "Step 2: Current Databases on Staging Server"

$dbList = Execute-SSH "sudo -i -u postgres psql -t -c 'SELECT datname FROM pg_database WHERE datname NOT LIKE ''pg_%'' ORDER BY datname;'"
Write-Info "Databases found:"
$dbList | ForEach-Object {
    if ($_ -match '\S') {
        Write-Host "  • $_"
    }
}
Write-Info ""

# Step 3: Identify Test Databases
Write-Header "Step 3: Identifying Test Databases to Delete"

$testDbs = @("testdb", "testdb2", "testfixdb", "lmsdb_staging")
Write-Warning-Custom "The following databases will be DELETED:"
$testDbs | ForEach-Object {
    Write-Host "  • $_"
}
Write-Host ""
Write-Warning-Custom "IMPORTANT: This operation is IRREVERSIBLE!"
Write-Host ""

# Step 4: Confirmation
$confirm = Read-Host "Type 'DELETE ALL' to confirm removal"

if ($confirm -ne "DELETE ALL") {
    Write-Warning-Custom "Cleanup cancelled"
    exit 0
}

Write-Host ""

# Step 5: Prepare and Execute Cleanup
Write-Header "Step 4: Preparing Cleanup Commands"

Write-Info "Setting up cleanup on server..."
Write-Host ""

# Create backup directory
Execute-SSH "mkdir -p /var/www/backups/lms" -IgnoreErrors | Out-Null

# Create backup of test databases
Write-Info "Creating backup of test databases..."
$backupCmd = "sudo -i -u postgres bash -c 'cd /var/www/backups/lms && for db in testdb testdb2 testfixdb lmsdb_staging; do if psql -tc \"SELECT 1 FROM pg_database WHERE datname=\\`$db\" 2>/dev/null | grep -q 1; then pg_dump \"\$db\" > deleted_databases_\$(date +%Y%m%d_%H%M%S)_\$db.sql 2>/dev/null && echo \"✓ Backed up: \$db\" || echo \"✗ Failed to backup: \$db\"; fi; done'"
$backupResult = Execute-SSH $backupCmd -IgnoreErrors
Write-Info $backupResult

Write-Host ""

# Terminate connections and delete databases
Write-Info "Terminating connections to test databases..."
$terminateCmd = "sudo -i -u postgres psql -c 'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN (''testdb'', ''testdb2'', ''testfixdb'', ''lmsdb_staging'') AND pid <> pg_backend_pid();' 2>/dev/null || true"
Execute-SSH $terminateCmd -IgnoreErrors | Out-Null

Write-Info "Deleting test databases..."
Execute-SSH "sudo -i -u postgres psql -c 'DROP DATABASE IF EXISTS testdb;'" -IgnoreErrors | Out-Null
Execute-SSH "sudo -i -u postgres psql -c 'DROP DATABASE IF EXISTS testdb2;'" -IgnoreErrors | Out-Null
Execute-SSH "sudo -i -u postgres psql -c 'DROP DATABASE IF EXISTS testfixdb;'" -IgnoreErrors | Out-Null
Execute-SSH "sudo -i -u postgres psql -c 'DROP DATABASE IF EXISTS lmsdb_staging;'" -IgnoreErrors | Out-Null

Write-Success "Database deletion completed!"
Write-Host ""

Write-Host ""

# Step 6: Verify
Write-Header "Step 5: Verifying Cleanup"

$dbListAfter = Execute-SSH "sudo -i -u postgres psql -t -c 'SELECT datname FROM pg_database WHERE datname NOT LIKE ''pg_%'' ORDER BY datname;'"
Write-Info "Remaining databases:"
$dbListAfter | ForEach-Object {
    if ($_ -match '\S') {
        Write-Host "  • $_"
    }
}

Write-Header "✅ CLEANUP COMPLETE"

Write-Success "Unnecessary databases have been removed"
Write-Info "Your staging server PostgreSQL is now clean!"
Write-Info ""
Write-Info "Active databases:"
Write-Host "  • kmsdb (KMS application)"
Write-Host "  • lmsdb (LMS application - used by Docker) ← Current"
Write-Host "  • postgres (PostgreSQL system)"
Write-Info ""
Write-Info "Backup location: /var/www/backups/lms/"
Write-Host ""
