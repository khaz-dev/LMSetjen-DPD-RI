# Deploy Script Improvement Recommendations
**For**: Improved `deploy-to-staging.ps1` and `deploy-on-staging.sh`  
**Date**: June 10, 2026

---

## 🎯 CURRENT SCRIPT LIMITATIONS

### `deploy-to-staging.ps1` (PowerShell - Remote)
| Issue | Severity | Impact |
|-------|----------|--------|
| No environment variable validation | 🟡 Medium | Deploys with missing/invalid config |
| No pre-deployment health checks | 🟡 Medium | Deployment fails silently |
| Path hardcoded (old value) | 🔴 High | Scripts may fail |
| No rollback capability | 🔴 High | Cannot recover from bad deployment |
| Error messages not informative | 🟡 Medium | Hard to debug failures |
| No backup before destructive ops | 🔴 High | Data loss risk |
| No dry-run mode | 🟡 Medium | Cannot preview changes |
| SSH timeout not configurable | 🟡 Medium | May fail on slow networks |

### `deploy-on-staging.sh` (Bash - Local on Server)
| Issue | Severity | Impact |
|-------|----------|--------|
| Path mismatch: references `/root/lmsetjendpdri` | 🔴 High | Script fails if run on server |
| Backup path not created | 🟡 Medium | Backups fail silently |
| No health checks after deploy | 🟡 Medium | Don't know if it actually works |
| Limited error handling | 🟡 Medium | Hard to debug |
| No validation of .env file | 🟡 Medium | May deploy with bad config |

---

## 🚀 RECOMMENDED IMPROVEMENTS

### 1. **PRE-DEPLOYMENT VALIDATION**

#### What to Check
```powershell
# SSH Connectivity
- SSH key accessible and readable
- SSH connection to server works
- sudo access available (if needed)

# Environment Files
- .env.staging exists and readable
- All required variables set (not empty)
- No placeholder values:
  - SECRET_KEY should not contain "your-"
  - Passwords should not contain "change-me"
  - Google credentials should not be "your-staging-"

# Target Server Health
- Disk space > 5GB available
- Docker daemon running
- Docker Compose installed
- Project directory exists and accessible
- Previous database backup exists (safety check)

# Code Quality
- Git working tree clean (no uncommitted changes)
- Branch is up-to-date with origin
- No sensitive files in commit

# Docker Readiness
- docker-compose.yml valid YAML
- All required images available/will build
- Network isolation properly configured
```

#### Implementation
```powershell
function Validate-Environment {
    Write-Header "🔍 Validating environment..."
    
    $errors = @()
    
    # Check SSH access
    if (-not (Test-Path $SSHKeyPath)) {
        $errors += "SSH key not found: $SSHKeyPath"
    }
    
    # Check .env.staging
    if (-not (Test-Path ".env.staging")) {
        $errors += ".env.staging not found"
    } else {
        $envContent = Get-Content ".env.staging" -Raw
        if ($envContent -match "your-staging-") {
            $errors += ".env.staging contains placeholder values (your-staging-*)"
        }
        if ($envContent -match "REDIS_PASSWORD=redis_password") {
            $errors += "⚠️ Redis using default weak password"
        }
    }
    
    if ($errors.Count -gt 0) {
        Write-Error-Custom "Environment validation failed:"
        $errors | ForEach-Object { Write-Error-Custom "  • $_" }
        exit 1
    }
    
    Write-Success "Environment validation passed ✓"
}
```

---

### 2. **BACKUP STRATEGY**

#### Automatic Backups
```powershell
function Backup-Production {
    param($BackupDir)
    
    Write-Header "📦 Creating backups..."
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    
    # Database backup
    Write-Info "Backing up database..."
    $dbBackup = "$BackupDir/lmsdb_backup_$timestamp.sql"
    ssh -i $SSHKeyPath $SSHHost "docker exec lms_backend pg_dump -U postgres -d lmsdb > $dbBackup 2>/dev/null"
    
    # Docker volumes backup (optional but recommended)
    Write-Info "Backing up Docker volumes..."
    ssh -i $SSHKeyPath $SSHHost "tar -czf $BackupDir/docker_volumes_$timestamp.tar.gz /var/lib/docker/volumes/lms* 2>/dev/null"
    
    Write-Success "Backups created: $BackupDir/lmsdb_backup_$timestamp.sql"
}

function Cleanup-OldBackups {
    param($BackupDir, $RetentionDays = 30)
    
    Write-Info "Cleaning up backups older than $RetentionDays days..."
    
    ssh -i $SSHKeyPath $SSHHost "find $BackupDir -name 'lmsdb_backup_*.sql' -mtime +$RetentionDays -delete 2>/dev/null"
    ssh -i $SSHKeyPath $SSHHost "find $BackupDir -name 'docker_volumes_*.tar.gz' -mtime +$RetentionDays -delete 2>/dev/null"
    
    Write-Success "Old backups cleaned up"
}
```

---

### 3. **HEALTH CHECKS**

#### Post-Deployment Verification
```powershell
function Test-ContainerHealth {
    Write-Header "🏥 Running health checks..."
    
    $maxAttempts = 12  # 60 seconds with 5s interval
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Info "Checking backend health (attempt $attempt/$maxAttempts)..."
        
        $response = ssh -i $SSHKeyPath $SSHHost `
            "curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/api/v1/health/"
        
        if ($response -eq "200" -or $response -eq "301") {
            Write-Success "Backend responding (HTTP $response) ✓"
            break
        }
        
        if ($attempt -lt $maxAttempts) {
            Write-Info "Still starting... waiting 5 seconds"
            Start-Sleep -Seconds 5
        }
    }
    
    if ($response -ne "200" -and $response -ne "301") {
        Write-Error-Custom "Backend health check failed (HTTP $response)"
        Write-Warning-Custom "Checking container logs..."
        ssh -i $SSHKeyPath $SSHHost "docker-compose -f /var/www/html/lms/docker-compose.yml logs backend | tail -50"
        exit 1
    }
}

function Test-DatabaseConnection {
    Write-Header "🗄️ Testing database connection..."
    
    $dbCheck = ssh -i $SSHKeyPath $SSHHost `
        "docker exec lms_backend python manage.py dbshell <<< 'SELECT 1;' 2>&1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database connection verified ✓"
    } else {
        Write-Error-Custom "Database connection failed"
        Write-Error-Custom $dbCheck
        exit 1
    }
}

function Test-FrontendAccess {
    Write-Header "🌐 Testing frontend accessibility..."
    
    $frontendCheck = curl -s -o /dev/null -w "%{http_code}" "https://lms.khaz.app/"
    
    if ($frontendCheck -eq "200" -or $frontendCheck -eq "301") {
        Write-Success "Frontend accessible (HTTP $frontendCheck) ✓"
    } else {
        Write-Warning-Custom "Frontend health check returned HTTP $frontendCheck"
        Write-Warning-Custom "This may be normal if DNS hasn't propagated"
    }
}
```

---

### 4. **DRY-RUN MODE**

#### Preview Changes Without Applying
```powershell
function Execute-Deploy {
    param(
        [string]$Mode,
        [bool]$DryRun = $false
    )
    
    if ($DryRun) {
        Write-Header "🔍 DRY-RUN MODE - No changes will be applied"
    }
    
    # Show what will happen
    Write-Info "Deployment plan for mode: $Mode"
    Write-Info "  1. Connect to server: $SSHHost"
    Write-Info "  2. Backup existing data"
    Write-Info "  3. Pull latest code from git"
    Write-Info "  4. Build Docker images"
    Write-Info "  5. Stop and remove old containers"
    Write-Info "  6. Start new containers"
    Write-Info "  7. Run database migrations"
    Write-Info "  8. Collect static files"
    Write-Info "  9. Verify health"
    
    if ($DryRun) {
        Write-Header "DRY-RUN COMPLETE - No changes made"
        return
    }
    
    # Continue with actual deployment...
}

# Usage
Execute-Deploy -Mode "update-only" -DryRun $true  # Preview first
Execute-Deploy -Mode "update-only" -DryRun $false # Then deploy
```

---

### 5. **ROLLBACK CAPABILITY**

#### Quick Rollback to Previous Version
```powershell
function Rollback-Deployment {
    param($BackupDir)
    
    Write-Header "⏮️  Rolling back to previous deployment..."
    
    # Get latest backup
    $latestBackup = ssh -i $SSHKeyPath $SSHHost `
        "ls -t $BackupDir/docker_volumes_*.tar.gz 2>/dev/null | head -1"
    
    if (-not $latestBackup) {
        Write-Error-Custom "No backup found for rollback"
        exit 1
    }
    
    Write-Info "Using backup: $latestBackup"
    
    # Stop containers
    ssh -i $SSHKeyPath $SSHHost "cd /var/www/html/lms && docker-compose down"
    
    # Restore volumes
    ssh -i $SSHKeyPath $SSHHost `
        "cd /var/lib/docker/volumes && tar -xzf $latestBackup"
    
    # Start containers
    ssh -i $SSHKeyPath $SSHHost "cd /var/www/html/lms && docker-compose up -d"
    
    Write-Success "Rollback complete - previous version restored ✓"
}
```

---

### 6. **ERROR HANDLING & LOGGING**

#### Comprehensive Error Handling
```powershell
function Log-Deployment {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logFile = "deployment-$(Get-Date -Format 'yyyyMMdd').log"
    
    "$timestamp [$Level] $Message" | Tee-Object -FilePath $logFile -Append
}

$ErrorActionPreference = "Continue"
$Global:DeploymentErrors = @()

trap {
    $errorMsg = $_.Exception.Message
    Write-Error-Custom "FATAL ERROR: $errorMsg"
    Log-Deployment "ERROR: $errorMsg" "ERROR"
    
    Write-Warning-Custom "Capturing state for debugging..."
    
    # Capture diagnostics
    $diag = ssh -i $SSHKeyPath $SSHHost "cd /var/www/html/lms && docker-compose logs --tail=100"
    Log-Deployment "Container logs: $diag" "DEBUG"
    
    Write-Header "⚠️  Deployment failed - Review logs in: $logFile"
    exit 1
}
```

---

### 7. **IMPROVED MODE HANDLING**

#### More Flexible Deployment Modes
```powershell
[ValidateSet(
    "full-clean-build",      # Everything from scratch
    "update-only",           # Code + config only
    "update-with-migration", # Code + database migrations
    "update-with-rollback",  # Code + auto-rollback on failure
    "hotfix",                # Quick patch (no migrations)
    "verify-only"            # Health check without changes
)]
[string]$Mode
```

---

### 8. **CONFIGURATION MANAGEMENT**

#### Safe Environment Variable Handling
```powershell
function Setup-Environment {
    Write-Header "⚙️  Setting up environment..."
    
    # Read .env.staging
    $envVars = Get-Content ".env.staging" | Where-Object { $_ -and -not $_.StartsWith("#") } | ConvertFrom-StringData
    
    # Validate required variables
    $required = @("MODE", "DEBUG", "SECRET_KEY", "DB_NAME", "DB_USER", "REDIS_HOST")
    
    $missing = @()
    $required | ForEach-Object {
        if (-not $envVars[$_] -or $envVars[$_] -match "^(your-|change-|placeholder)") {
            $missing += $_
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Error-Custom "Missing or placeholder environment variables:"
        $missing | ForEach-Object { Write-Error-Custom "  • $_" }
        exit 1
    }
    
    # Generate missing secrets
    if (-not $envVars["SECRET_KEY"] -or $envVars["SECRET_KEY"] -match "insecure-dev") {
        Write-Warning-Custom "Generating new SECRET_KEY..."
        $newSecret = Invoke-Expression "python -c `"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())`""
        # Update .env.staging with new value
    }
    
    Write-Success "Environment setup complete ✓"
}
```

---

## 📋 RECOMMENDED SCRIPT STRUCTURE

```
deploy-to-staging.ps1
├── Parameter parsing & validation
├── Configuration loading
├── Pre-deployment checks
│   ├── SSH access
│   ├── Environment variables
│   ├── Server health
│   └── Code quality
├── Backup creation
├── Deployment execution
│   ├── Code pull
│   ├── Build phase
│   ├── Migrate phase
│   └── Start phase
├── Health verification
├── Logging & reporting
└── Success/Failure handling
```

---

## 💡 BEST PRACTICES

### ✅ DO
- [ ] Always backup before destructive operations
- [ ] Validate all inputs before execution
- [ ] Provide rollback capability
- [ ] Log everything to a file
- [ ] Use dry-run mode for preview
- [ ] Check health after deployment
- [ ] Handle errors gracefully
- [ ] Provide clear error messages
- [ ] Use consistent naming conventions
- [ ] Document all modes and options

### ❌ DON'T
- [ ] Expose credentials in output
- [ ] Use hardcoded paths (use variables)
- [ ] Assume services are running
- [ ] Skip validation for speed
- [ ] Deploy without backups
- [ ] Exit silently on errors
- [ ] Use generic error messages
- [ ] Trust user input without validation
- [ ] Create temporary files without cleanup
- [ ] Run with elevated privileges unnecessarily

---

## 📊 PERFORMANCE IMPROVEMENTS

### Parallel Operations
```powershell
# Run multiple checks in parallel instead of sequentially
$jobs = @()
$jobs += Start-Job -ScriptBlock { Test-DatabaseConnection }
$jobs += Start-Job -ScriptBlock { Test-FrontendAccess }
$jobs += Start-Job -ScriptBlock { Test-DiskSpace }

$jobs | Wait-Job
$jobs | Receive-Job
```

### Progressive Output
```powershell
# Use progress bars instead of waiting silently
$progress = @{
    Activity = "Deploying to production"
    Status = "Building Docker images"
    PercentComplete = 33
}
Write-Progress @progress
```

---

## 🎯 PRIORITY FIXES (In Order)

1. **🔴 CRITICAL** - Fix path references (currently hardcoded incorrectly)
2. **🔴 CRITICAL** - Add validation for .env.staging variables
3. **🔴 CRITICAL** - Add backup before deployment
4. **🟡 HIGH** - Add health checks post-deployment
5. **🟡 HIGH** - Add rollback capability
6. **🟡 MEDIUM** - Add dry-run mode
7. **🟡 MEDIUM** - Add comprehensive logging
8. **🟢 NICE-TO-HAVE** - Add parallel operations
9. **🟢 NICE-TO-HAVE** - Add monitoring integration
10. **🟢 NICE-TO-HAVE** - Add automatic secret generation

---

## 📚 REFERENCE TEMPLATES

### PowerShell Header Template
```powershell
#Requires -Version 5.1

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("full-clean-build", "update-only", "update-with-migration")]
    [string]$Mode,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$script:LogFile = "deployment-$(Get-Date -Format 'yyyyMMdd').log"

# Functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp [$Level] $Message" | Tee-Object -FilePath $script:LogFile -Append
}

# Main execution
Write-Log "Starting deployment..."
try {
    # Your deployment logic
} catch {
    Write-Log "Deployment failed: $_" "ERROR"
    exit 1
}
```

### Bash Header Template
```bash
#!/bin/bash
set -eo pipefail

MODE="${1:-update-only}"
DRY_RUN="${2:-false}"
LOG_FILE="deployment-$(date +%Y%m%d).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }

# Your deployment logic
log "Starting deployment..."
```

---

This roadmap provides a comprehensive framework for improving your deployment scripts with production-grade reliability and safety features.

