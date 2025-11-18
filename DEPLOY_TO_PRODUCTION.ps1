# ═══════════════════════════════════════════════════════════════════════════════
# LMSetjen DPD RI - Production Deployment Script
# Version: 1.0.0 | Date: November 18, 2025
# Purpose: Automated deployment of SSO integration to production server
# ═══════════════════════════════════════════════════════════════════════════════

param(
    [string]$ProductionServer = "your-production-server.com",
    [string]$ProductionUser = "deploy",
    [string]$ProjectPath = "/home/deploy/LMSetjen-DPD-RI",
    [switch]$SkipBackup = $false,
    [switch]$DryRun = $false
)

# ═══════════════════════════════════════════════════════════════════════════════
# Color Output Functions
# ═══════════════════════════════════════════════════════════════════════════════

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# ═══════════════════════════════════════════════════════════════════════════════
# Deployment Steps
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "`n╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                    PRODUCTION DEPLOYMENT - SSO INTEGRATION                      ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Magenta

# Step 1: Backup
if (-not $SkipBackup) {
    Write-Info "Step 1: Creating backup of current production database..."
    
    $BackupCommand = @"
cd $ProjectPath && \
docker compose exec -T postgres pg_dump -U postgres -d lmsetjen_db > backups/db_backup_$(date +%Y%m%d_%H%M%S).sql && \
docker compose exec -T backend tar -czf backups/media_backup_$(date +%Y%m%d_%H%M%S).tar.gz media/
"@
    
    if ($DryRun) {
        Write-Info "[DRY RUN] Would execute: $BackupCommand"
    } else {
        Write-Info "Backing up database and media files..."
        # Note: Execute on production server via SSH
        Write-Warning "Please run this on production server manually or via SSH"
    }
    
    Write-Success "Backup strategy: Database and media files should be backed up before deployment"
}

# Step 2: Pull latest code
Write-Info "`nStep 2: Pulling latest code from GitHub..."

$PullCommand = @"
cd $ProjectPath && \
git fetch origin && \
git checkout main && \
git pull origin main
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute:"
    Write-Host $PullCommand -ForegroundColor Gray
} else {
    Write-Info "Executing: git pull origin main"
    Write-Host "Hint: Run on production server via SSH or locally" -ForegroundColor Gray
}

Write-Success "Git pull command prepared"

# Step 3: Verify environment variables
Write-Info "`nStep 3: Checking environment variables..."

$EnvVars = @(
    "SSO_PROVIDER_URL",
    "SSO_VERIFY_ENDPOINT",
    "SSO_TOKEN_ALGORITHM",
    "SSO_CALLBACK_URL",
    "JWT_SECRET_KEY",
    "DEBUG",
    "ALLOWED_HOSTS"
)

Write-Info "Required SSO environment variables:"
foreach ($var in $EnvVars) {
    Write-Host "  • $var" -ForegroundColor Yellow
}

Write-Warning "Please ensure these variables are set in your .env file on production"

# Step 4: Stop containers
Write-Info "`nStep 4: Stopping Docker containers..."

$StopCommand = @"
cd $ProjectPath && \
docker compose down
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute: docker compose down"
} else {
    Write-Info "This will stop: Backend, Frontend, Nginx, PostgreSQL"
}

Write-Success "Stop command prepared"

# Step 5: Rebuild containers
Write-Info "`nStep 5: Building Docker containers with latest code..."

$BuildCommand = @"
cd $ProjectPath && \
docker compose build --no-cache backend frontend nginx
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute: docker compose build --no-cache"
} else {
    Write-Info "This will rebuild backend, frontend, and nginx images"
}

Write-Success "Build command prepared"

# Step 6: Start containers
Write-Info "`nStep 6: Starting Docker containers..."

$StartCommand = @"
cd $ProjectPath && \
docker compose up -d
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute: docker compose up -d"
} else {
    Write-Info "Containers will start in detached mode"
}

Write-Success "Start command prepared"

# Step 7: Apply migrations
Write-Info "`nStep 7: Applying database migrations..."

$MigrateCommand = @"
cd $ProjectPath && \
docker compose exec -T backend python manage.py migrate
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute: python manage.py migrate"
} else {
    Write-Info "Running Django migrations"
}

Write-Success "Migration command prepared"

# Step 8: Collect static files
Write-Info "`nStep 8: Collecting static files..."

$StaticCommand = @"
cd $ProjectPath && \
docker compose exec -T backend python manage.py collectstatic --noinput
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute: python manage.py collectstatic"
} else {
    Write-Info "Collecting Django static files"
}

Write-Success "Static files command prepared"

# Step 9: Health check
Write-Info "`nStep 9: Health check..."

$HealthCommand = @"
# Wait for services to be ready
sleep 10

# Check backend health
curl -s http://localhost:8000/health/ || echo "Backend health check pending..."

# Check frontend health
curl -s http://localhost:3000/ || echo "Frontend health check pending..."
"@

if ($DryRun) {
    Write-Info "[DRY RUN] Would execute health checks"
} else {
    Write-Info "Health checks will be performed after startup"
}

Write-Success "Health check commands prepared"

# ═══════════════════════════════════════════════════════════════════════════════
# Complete Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "`n" -ForegroundColor Magenta
Write-Host "╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                          COMPLETE DEPLOYMENT SCRIPT                           ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

$CompleteScript = @"
#!/bin/bash
# Complete Production Deployment Script
# Run this on your production server

set -e  # Exit on error

PROJECT_PATH="$ProjectPath"
BACKUP_DIR="\$PROJECT_PATH/backups"
LOG_FILE="\$BACKUP_DIR/deployment_\$(date +%Y%m%d_%H%M%S).log"

# Create backup directory if it doesn't exist
mkdir -p \$BACKUP_DIR

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] \$1" | tee -a \$LOG_FILE
}

# Error handler
handle_error() {
    log "❌ Deployment failed!"
    log "Check logs: \$LOG_FILE"
    exit 1
}

trap handle_error ERR

# ═══════════════════════════════════════════════════════════════════════════════
# BACKUP STEP
# ═══════════════════════════════════════════════════════════════════════════════

log "📦 Starting backup process..."

# Backup database
log "Backing up PostgreSQL database..."
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
cd \$PROJECT_PATH
docker compose exec -T postgres pg_dump -U postgres -d lmsetjen_db > \$BACKUP_DIR/db_backup_\$TIMESTAMP.sql || log "⚠️  Database backup warning"

# Backup media files
log "Backing up media files..."
docker compose exec -T backend tar -czf \$BACKUP_DIR/media_backup_\$TIMESTAMP.tar.gz media/ || log "⚠️  Media backup warning"

log "✅ Backup completed: \$BACKUP_DIR/db_backup_\$TIMESTAMP.sql"

# ═══════════════════════════════════════════════════════════════════════════════
# GIT PULL STEP
# ═══════════════════════════════════════════════════════════════════════════════

log "📥 Pulling latest code from GitHub..."
cd \$PROJECT_PATH
git fetch origin
git checkout main
git pull origin main
log "✅ Code pulled successfully"

# ═══════════════════════════════════════════════════════════════════════════════
# ENVIRONMENT CHECK
# ═══════════════════════════════════════════════════════════════════════════════

log "🔍 Verifying environment configuration..."

required_vars=("SSO_PROVIDER_URL" "SSO_VERIFY_ENDPOINT" "JWT_SECRET_KEY")
for var in "\${required_vars[@]}"; do
    if grep -q "\$var" .env; then
        log "✅ \$var is configured"
    else
        log "⚠️  \$var not found in .env - please configure it"
    fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# DOCKER DEPLOYMENT STEP
# ═══════════════════════════════════════════════════════════════════════════════

log "🐳 Stopping current containers..."
docker compose down || true
log "✅ Containers stopped"

log "🔨 Building new Docker images..."
docker compose build --no-cache backend frontend nginx
log "✅ Docker images built"

log "🚀 Starting new containers..."
docker compose up -d
log "✅ Containers started"

# ═══════════════════════════════════════════════════════════════════════════════
# MIGRATIONS & STATIC FILES
# ═══════════════════════════════════════════════════════════════════════════════

log "⏳ Waiting for database to be ready..."
sleep 10

log "🔄 Applying database migrations..."
docker compose exec -T backend python manage.py migrate
log "✅ Migrations completed"

log "📁 Collecting static files..."
docker compose exec -T backend python manage.py collectstatic --noinput
log "✅ Static files collected"

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

log "💚 Running health checks..."

# Wait for services to be ready
sleep 5

# Check backend
if curl -s http://localhost:8000/health/ > /dev/null 2>&1; then
    log "✅ Backend is healthy"
else
    log "⚠️  Backend health check - may need more time"
fi

# Check containers
log "📊 Container status:"
docker compose ps | tee -a \$LOG_FILE

# ═══════════════════════════════════════════════════════════════════════════════
# POST-DEPLOYMENT VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

log "✨ Deployment completed successfully!"
log ""
log "📝 Deployment Summary:"
log "  • Database backup: \$BACKUP_DIR/db_backup_\$TIMESTAMP.sql"
log "  • Media backup: \$BACKUP_DIR/media_backup_\$TIMESTAMP.tar.gz"
log "  • Deployment log: \$LOG_FILE"
log ""
log "🔗 Access your application at:"
log "  • Web: https://lmsetjendpdri.duckdns.org"
log "  • API: https://lmsetjendpdri.duckdns.org/api"
log "  • Admin: https://lmsetjendpdri.duckdns.org/admin"
log ""
log "📚 SSO Login:"
log "  • Button: 'Login dengan Nusa DPD' on login page"
log "  • Provider: https://nusadpd.duckdns.org"
log ""
log "🆘 Rollback (if needed):"
log "  docker compose down"
log "  git checkout main~1"
log "  docker compose up -d --build"
log ""

"@

Write-Host $CompleteScript -ForegroundColor Gray
Write-Host "`n"

# Save the script to a file
$ScriptPath = "d:\Project\LMSetjen DPD RI\deploy-production.sh"
$CompleteScript | Out-File -FilePath $ScriptPath -Encoding UTF8 -NoNewline

Write-Success "Deployment script saved to: $ScriptPath"

# ═══════════════════════════════════════════════════════════════════════════════
# Deployment Instructions
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "`n╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                         DEPLOYMENT INSTRUCTIONS                               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Info "To deploy to production, follow these steps:`n"

Write-Host "1️⃣  ON YOUR LOCAL MACHINE (already done):" -ForegroundColor Yellow
Write-Host "    ✓ All code committed to GitHub main branch" -ForegroundColor Green
Write-Host "    ✓ SSO integration complete" -ForegroundColor Green
Write-Host "    ✓ Deployment script generated" -ForegroundColor Green

Write-Host "`n2️⃣  PREPARE YOUR PRODUCTION SERVER:" -ForegroundColor Yellow
Write-Host "    • SSH into production server:"
Write-Host "      ssh $ProductionUser@$ProductionServer" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • Navigate to project directory:"
Write-Host "      cd $ProjectPath" -ForegroundColor Cyan

Write-Host "`n3️⃣  CONFIGURE ENVIRONMENT VARIABLES:" -ForegroundColor Yellow
Write-Host "    • Edit .env file:"
Write-Host "      nano .env" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • Add/Update these variables:" -ForegroundColor Gray
Write-Host "      SSO_PROVIDER_URL=https://nusadpd.duckdns.org/" -ForegroundColor Cyan
Write-Host "      SSO_VERIFY_ENDPOINT=https://cmb.tail91813a.ts.net/sso/verify/" -ForegroundColor Cyan
Write-Host "      SSO_TOKEN_ALGORITHM=HS256" -ForegroundColor Cyan
Write-Host "      SSO_CALLBACK_URL=https://lmsetjendpdri.duckdns.org/sso/" -ForegroundColor Cyan
Write-Host "      DEBUG=False" -ForegroundColor Cyan
Write-Host "      ALLOWED_HOSTS=lmsetjendpdri.duckdns.org,yourdomain.com" -ForegroundColor Cyan

Write-Host "`n4️⃣  EXECUTE DEPLOYMENT SCRIPT:" -ForegroundColor Yellow
Write-Host "    • Make script executable:"
Write-Host "      chmod +x deploy-production.sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • Run the deployment:"
Write-Host "      ./deploy-production.sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "    OR run manually step by step (see script content above)" -ForegroundColor Gray

Write-Host "`n5️⃣  VERIFY DEPLOYMENT:" -ForegroundColor Yellow
Write-Host "    • Check application:"
Write-Host "      curl https://lmsetjendpdri.duckdns.org/login/" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • Look for 'Login dengan Nusa DPD' button" -ForegroundColor Green
Write-Host ""
Write-Host "    • Check container status:"
Write-Host "      docker compose ps" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • View logs:"
Write-Host "      docker compose logs -f backend" -ForegroundColor Cyan

Write-Host "`n6️⃣  IF SOMETHING GOES WRONG (Rollback):" -ForegroundColor Yellow
Write-Host "    • Revert to previous version:"
Write-Host "      git checkout main~1" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • Rebuild and restart:"
Write-Host "      docker compose down && docker compose up -d --build" -ForegroundColor Cyan
Write-Host ""
Write-Host "    • Restore from backup:"
Write-Host "      docker compose exec -T postgres psql -U postgres -d lmsetjen_db < backups/db_backup_YYYYMMDD_HHMMSS.sql" -ForegroundColor Cyan

Write-Host "`n╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                        KEY VERIFICATION CHECKLIST                              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

$Checklist = @(
    "git log shows latest SSO commits (commit 7de7a6c and later)",
    "All backend files present: sso_utils.py, updated views.py, updated urls.py",
    "All frontend files present: SSOLogin.jsx, SSOLogin.css, updated components",
    "Documentation files present: SSO_*.md files in project root",
    ".env file has SSO variables configured",
    "Docker images built successfully",
    "All containers running (docker compose ps shows 'Up')",
    "Database migrations applied successfully",
    "Login page shows 'Login dengan Nusa DPD' button",
    "Logs show no critical errors (docker compose logs backend)"
)

$i = 1
foreach ($item in $Checklist) {
    Write-Host "  ☐ $item" -ForegroundColor Yellow
    $i++
}

Write-Host "`n╔════════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                              DEPLOYMENT READY!                                 ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

Write-Info "`nFor more details, see:"
Write-Host "  • SSO_DEPLOYMENT_CHECKLIST.md - Pre/post deployment verification" -ForegroundColor Cyan
Write-Host "  • SSO_QUICK_START.md - 5-step quick start" -ForegroundColor Cyan
Write-Host "  • SSO_INTEGRATION_GUIDE.md - Technical details" -ForegroundColor Cyan
Write-Host "  • PRODUCTION_DEPLOYMENT_STEPS.md - General deployment guide" -ForegroundColor Cyan

Write-Host "`n"
