# LMSetjen DPD RI - Comprehensive Deployment Guide

> **Complete deployment solution** for deploying LMSetjen DPD RI from local machine to staging/production server.

## 📋 Overview

This deployment guide provides **two powerful deployment scripts** that enable you to:

1. **Deploy from Local to Production** (`deploy-to-staging.ps1`) - PowerShell script running on your local Windows machine
2. **Deploy on Production Server** (`deploy-on-staging.sh`) - Bash script running ON the production/staging server itself

Each script supports **three deployment modes** for different scenarios:

| Mode | Use Case | Speed | Data Preservation |
|------|----------|-------|-------------------|
| **full-clean-build** | Fresh start, reset everything | 🐢 10-15 min | ❌ Data lost |
| **update-only** | Update code only | ⚡ 2-3 min | ✅ Data kept |
| **update-with-data-refresh** | Update code + database migration | 🐾 3-5 min | ✅ Data migrated |

---

## 🚀 Quick Start

### Local Machine (Windows)

```powershell
# Navigate to project root
cd "d:\Project\LMSetjen DPD RI"

# Deploy to staging with update mode
.\deploy-to-staging.ps1 -Mode update-only -Verbose

# Or full clean rebuild
.\deploy-to-staging.ps1 -Mode full-clean-build
```

### Production Server (via SSH)

```bash
# Connect to staging server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Navigate to project
cd /root/lmsetjendpdri

# Make script executable (first time only)
chmod +x deploy-on-staging.sh

# Deploy/update on this server
./deploy-on-staging.sh --mode update-only

# Or full rebuild
./deploy-on-staging.sh --mode full-clean-build
```

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Your Local Machine (Windows)                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ deploy-to-staging.ps1                               │  │
│  │ • Backs up local database                           │  │
│  │ • Syncs project files via SCP                       │  │
│  │ • Executes deployment commands via SSH             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │ SSH: root@165.245.191.216
                     │
┌────────────────────▼──────────────────────────────────────────┐
│  Production Server (165.245.191.216) - lms.khaz.app          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Docker Containers:                                   │    │
│  │ • Django Backend (port 8001)                         │    │
│  │ • React Frontend (port 5174)                         │    │
│  │ • PostgreSQL Database                               │    │
│  │ • Redis Cache                                        │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ deploy-on-staging.sh (runs ON server)               │    │
│  │ • Pull latest code from git                          │    │
│  │ • Backup database automatically                      │    │
│  │ • Rebuild Docker containers                          │    │
│  │ • Run migrations and initialization                  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Script 1: Deploy to Staging (Local Machine)

### Location
```
d:\Project\LMSetjen DPD RI\deploy-to-staging.ps1
```

### Features
- ✅ SSH connection testing
- ✅ Automatic project synchronization
- ✅ Database backup before deployment
- ✅ Multi-mode deployment support
- ✅ Health check and status reporting
- ✅ Comprehensive error handling

### Prerequisites
```
✅ Docker & Docker Compose installed locally
✅ Git installed and configured
✅ SSH key at: c:\Users\khair\khaz
✅ SSH access to: root@165.245.191.216
✅ PowerShell 5.0+
```

### Usage

#### Mode 1: Full Clean Build
```powershell
.\deploy-to-staging.ps1 -Mode full-clean-build -Verbose
```

**What it does:**
- Stops all containers on production server
- Removes containers and volumes  
- Cleans Docker images
- Pulls latest code from git
- Builds Docker images from scratch
- Starts fresh containers with initialized database

**When to use:** When you want a completely fresh deployment or to reset the environment

**Duration:** ~10-15 minutes

---

#### Mode 2: Update Only
```powershell
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

**What it does:**
- Pulls latest code from git
- Rebuilds Docker images (with cache)
- Restarts containers
- Preserves all existing data

**When to use:** Normal code updates, bug fixes, feature deployments (DAILY)

**Duration:** ~2-3 minutes

---

#### Mode 3: Update with Data Copy
```powershell
.\deploy-to-staging.ps1 -Mode update-with-data-copy -Verbose
```

**What it does:**
- Backs up local PostgreSQL database
- Backs up remote database
- Syncs code to production
- Restarts containers
- Runs migrations on production
- Collects static files

**When to use:** When you want to sync local development data to production

**Duration:** ~2-4 minutes

---

### Parameters

```powershell
-Mode <string>              # Required: full-clean-build, update-only, update-with-data-copy
-Verbose <switch>           # Optional: Show detailed output
-SSHKeyPath <string>        # Optional: Path to SSH key (default: c:\Users\khair\khaz)
-StagingServerIP <string>   # Optional: Server IP (default: 165.245.191.216)
-StagingDomain <string>     # Optional: Domain name (default: lms.khaz.app)
```

### Examples

```powershell
# Update production with latest code (RECOMMENDED DAILY)
.\deploy-to-staging.ps1 -Mode update-only

# Full clean rebuild with verbose output
.\deploy-to-staging.ps1 -Mode full-clean-build -Verbose

# Update with data copy and custom SSH key
.\deploy-to-staging.ps1 -Mode update-with-data-copy -SSHKeyPath "c:\path\to\key"

# Deploy to different server
.\deploy-to-staging.ps1 -Mode update-only -StagingServerIP "192.168.1.100"
```

---

## 🔧 Script 2: Deploy on Production Server

### Location
```
/root/lmsetjendpdri/deploy-on-staging.sh
```

**Note:** This is a Bash script that runs ON the production server itself (after SSH-ing in)

### Features
- ✅ Local deployment only (runs on same server)
- ✅ Database backup and recovery
- ✅ Project file backup
- ✅ 3 deployment modes
- ✅ Progress indication and status reporting
- ✅ Comprehensive error handling

### Prerequisites

**On Production Server:**
```
✅ Docker & Docker Compose installed
✅ Git installed and repository cloned
✅ Bash shell available
✅ SSH access for initial setup
```

### Usage

```bash
# First time: make script executable
chmod +x /root/lmsetjendpdri/deploy-on-staging.sh
```

#### Mode 1: Full Clean Build
```bash
./deploy-on-staging.sh --mode full-clean-build
```

**What it does:**
- Backs up database and application files
- Stops and removes all containers
- Removes all volumes
- Rebuilds Docker images from scratch
- Starts fresh containers with new database

**When to use:** Complete fresh start, after major issues

**Duration:** ~8-12 minutes

---

#### Mode 2: Update Only (RECOMMENDED)
```bash
./deploy-on-staging.sh --mode update-only
```

**What it does:**
- Pulls latest code from git
- Rebuilds Docker images (with cache)
- Restarts containers
- Keeps all existing data
- Runs migrations (if any)

**When to use:** Regular code updates, daily deployments

**Duration:** ~2-3 minutes

---

#### Mode 3: Update with Data Refresh
```bash
./deploy-on-staging.sh --mode update-with-data-refresh --verbose
```

**What it does:**
- Creates database backup
- Pulls latest code
- Rebuilds Docker images
- Restarts containers  
- Runs all database migrations
- Initializes default users
- Collects static files

**When to use:** When database schema has changed, major updates

**Duration:** ~3-5 minutes

---

### Parameters

```bash
--mode <mode>               # Required: full-clean-build, update-only, update-with-data-refresh
--verbose                   # Optional: Show detailed output
--help                      # Show help message
```

### Examples

```bash
# Normal daily update (RECOMMENDED)
./deploy-on-staging.sh --mode update-only

# Full clean rebuild
./deploy-on-staging.sh --mode full-clean-build

# Update with database refresh (verbose)
./deploy-on-staging.sh --mode update-with-data-refresh --verbose

# Show help
./deploy-on-staging.sh --help
```

---

## 📊 Deployment Workflow Examples

### Scenario 1: Daily Deployment (Most Common)

```powershell
# Step 1: On your local machine
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-only

# Step 2: Wait ~3 minutes, application is updated on production
# Done! ✅
```

**Total Time:** 2-3 minutes  
**Data:** Latest code, all existing data preserved

---

### Scenario 2: Deploy with Data Reset (Monthly)

```powershell
# On local machine
.\deploy-to-staging.ps1 -Mode full-clean-build

# Wait 15 minutes for completion
```

**Total Time:** 10-15 minutes  
**Data:** ❌ All data reset to fresh database

---

### Scenario 3: Emergency Updates on Production Server

```bash
# SSH to production
ssh -i c:\Users\khair\khaz root@165.245.191.216

# On production server
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-only

# Done! ✅
```

**Total Time:** 2-3 minutes  
**Use Case:** Quick fix without going through local machine

---

## 🔐 Security Considerations

### SSH Key Management
```bash
# SSH key location
c:\Users\khair\khaz

# Test connection
ssh -i c:\Users\khair\khaz root@165.245.191.216 "echo OK"
```

### Environment Variables
- Production `.env` file should have different values than local
- `SECRET_KEY` should be strong and unique per environment
- `DEBUG=False` on production
- Use separate database for production

### Database Backups
Both scripts automatically create backups:
```bash
# Backups stored at
/root/lmsetjendpdri/backups/lmsdb_backup_*.sql
/root/lmsetjendpdri/backups/app_backup_*.tar.gz
```

### Firewall Rules
Ensure ports are accessible:
```
SSH: 22 (for deployment)
HTTP: 80 (web traffic)
HTTPS: 443 (secure web traffic)
```

---

## 🐛 Troubleshooting

### SSH Connection Failed

```powershell
# Verify SSH key exists
Test-Path "c:\Users\khair\khaz"

# Test SSH manually
ssh -i c:\Users\khair\khaz root@165.245.191.216 "echo OK"
```

### Docker Build Failed

```bash
# SSH to server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Check logs
docker-compose logs backend

# Rebuild with verbose output
docker-compose build --no-cache 2>&1 | tail -50
```

### Container Won't Start

```bash
# View full logs
docker-compose logs -f backend

# Check resource usage
docker stats

# Restart container
docker-compose restart backend

# Full reset (use with caution!)
docker-compose down -v
docker-compose up -d
```

### Database Migration Error

```bash
# SSH to server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Check database
docker exec lms_backend python manage.py migrate --noinput

# View recent logs
docker-compose logs -f backend
```

---

## 📈 Monitoring & Maintenance

### Health Checks

```bash
# SSH to production
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Check application health
curl http://localhost:8001/api/v1/health/

# Check containers
docker-compose ps

# View recent logs
docker-compose logs --tail=100 backend
```

### Common Commands

```bash
# Access database
docker exec -it lms_backend psql -U postgres -d lmsdb

# Clear cache
docker exec -it lms_redis redis-cli FLUSHALL

# View logs
docker-compose logs -f backend

# Restart service
docker-compose restart backend

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

---

## ✅ Deployment Checklist

### Before Deployment
- [ ] Code committed to git
- [ ] SSH key is accessible and working
- [ ] Production server is accessible
- [ ] Sufficient disk space on server (check: `df -h`)
- [ ] All containers are stopped cleanly on previous deployment

### During Deployment
- [ ] Monitor deployment progress
- [ ] Keep terminal session open
- [ ] Watch for error messages
- [ ] Note deployment start/end time

### After Deployment
- [ ] Application is running (`curl http://lms.khaz.app/api/v1/health/`)
- [ ] All containers are UP (`docker-compose ps`)
- [ ] No ERROR messages in logs (`docker-compose logs`)
- [ ] Test key features in browser
- [ ] Notify team of successful deployment
- [ ] Document any issues encountered

---

## 📚 Additional Resources

### Documentation Files in Project
- `DEPLOYMENT_SCRIPTS_GUIDE.md` - This file (comprehensive guide)
- `DEPLOYMENT_QUICK_REFERENCE.md` - Quick lookup and commands
- `DEPLOYMENT_SOLUTION_SUMMARY.md` - Feature overview

### Project Structure
```
d:\Project\LMSetjen DPD RI\
├── deploy-to-staging.ps1       ← Local machine script
├── deploy-on-staging.sh         ← Production server script
├── docker-compose.yml           ← Docker configuration
├── .env                         ← Environment variables
├── backend/                     ← Django backend
└── frontend/                    ← React frontend
```

### Quick Command Reference

```powershell
# Deploy from local to production
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-only
```

```bash
# Deploy on production server itself
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-only
```

---

## 🎯 Next Steps

1. **Read** [DEPLOYMENT_QUICK_REFERENCE.md](./DEPLOYMENT_QUICK_REFERENCE.md) for daily use
2. **Make first deployment:** `.\deploy-to-staging.ps1 -Mode update-only`
3. **Verify application** is accessible at `lms.khaz.app`
4. **SSH to production** and verify: `./deploy-on-staging.sh --mode update-only`
5. **Test the application** manually
6. **Set up regular deployment** schedule (daily/weekly)

---

**Version:** 1.0 - Production Ready  
**Last Updated:** May 2026  
**Status:** ✅ Complete and tested


## 📋 Overview

This deployment guide provides **two powerful deployment scripts** that enable you to:

1. **Deploy from Local to Staging** (`deploy-to-staging.ps1`) - PowerShell script running on your local Windows machine
2. **Deploy from Staging to Development** (`deploy-on-staging.sh`) - Bash script running on the staging server

Each script supports **three deployment modes** for different scenarios:

| Mode | Use Case | Speed | Data Preservation |
|------|----------|-------|-------------------|
| **full-clean-build** | Fresh start, reset everything | 🐢 Slowest | ❌ Data lost |
| **update-only** | Update code only | 🐇 Medium | ✅ Data kept |
| **update-with-data-copy** | Update code + sync data | 🐾 Medium | ✅ Data synced |

---

## 🚀 Quick Start

### Local Machine (Windows)

```powershell
# Navigate to project root
cd "d:\Project\LMSetjen DPD RI"

# Deploy to staging with update mode
.\deploy-to-staging.ps1 -Mode update-only -Verbose

# Or full clean rebuild
.\deploy-to-staging.ps1 -Mode full-clean-build
```

### Staging Server (via SSH)

```bash
# Connect to staging server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Navigate to project
cd /root/lmsetjendpdri

# Make script executable
chmod +x deploy-on-staging.sh

# Deploy to development
./deploy-on-staging.sh --mode update-only

# Or copy database from staging to development
./deploy-on-staging.sh --mode update-with-db-copy --dev-host localhost
```

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Local Machine (Windows)                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ deploy-to-staging.ps1                                   │  │
│  │ • Backs up local database                               │  │
│  │ • Syncs project files via SCP                           │  │
│  │ • Executes deployment commands via SSH                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────────────────────┘
                     │
                     │ SSH: root@165.245.191.216
                     │
┌────────────────────▼──────────────────────────────────────────────┐
│  Staging Server (165.245.191.216)                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Docker: lms.khaz.app (kms.khaz.app)                      │    │
│  │ • Flask / Django backend                                 │    │
│  │ • React frontend                                          │    │
│  │ • PostgreSQL database                                    │    │
│  │ • Redis cache                                             │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ deploy-on-staging.sh                                     │    │
│  │ • Backs up production database                           │    │
│  │ • Syncs project files to /dev instance                   │    │
│  │ • Manages Docker containers                              │    │
│  └──────────────────────────────────────────────────────────┘    │
│                       │                                           │
│                       │ (Optional: SSH to another server)         │
│                       ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Docker: Development Instance (port 5174/8002)            │    │
│  │ • Separate database                                      │    │
│  │ • Separate Redis cache                                   │    │
│  │ • Test environment for code changes                      │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Script 1: Deploy to Staging (Local Machine)

### Location
```
d:\Project\LMSetjen DPD RI\deploy-to-staging.ps1
```

### Features
- ✅ SSH connection testing
- ✅ Automatic project synchronization
- ✅ Database backup before deployment
- ✅ Multi-mode deployment support
- ✅ Health check and status reporting
- ✅ Comprehensive error handling

### Prerequisites
```
✅ Docker & Docker Compose installed locally
✅ Git installed and configured
✅ SSH key at: c:\Users\khair\khaz
✅ SSH access to: root@165.245.191.216
✅ PowerShell 5.0+
```

### Usage

#### Mode 1: Full Clean Build
```powershell
.\deploy-to-staging.ps1 -Mode full-clean-build -Verbose
```

**What it does:**
- Stops all containers on staging
- Removes containers and volumes
- Cleans Docker images
- Pulls latest code from git
- Builds Docker images from scratch
- Starts fresh containers with initialized database

**When to use:** When you want a completely fresh deployment or to reset the environment

**Duration:** ~10-15 minutes

---

#### Mode 2: Update Only
```powershell
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

**What it does:**
- Pulls latest code from git
- Rebuilds Docker images (with cache)
- Restarts containers
- Preserves all existing data

**When to use:** Normal code updates, bug fixes, feature deployments

**Duration:** ~3-5 minutes

---

#### Mode 3: Update with Data Copy
```powershell
.\deploy-to-staging.ps1 -Mode update-with-data-copy -Verbose
```

**What it does:**
- Backs up local PostgreSQL database
- Backs up remote database
- Syncs code to staging
- Restarts containers
- Runs migrations on staging
- Collects static files

**When to use:** When you want to sync local development data to staging

**Duration:** ~2-4 minutes

---

### Parameters

```powershell
-Mode <string>              # Required: full-clean-build, update-only, update-with-data-copy
-Verbose <switch>           # Optional: Show detailed output
-SSHKeyPath <string>        # Optional: Path to SSH key (default: c:\Users\khair\khaz)
-StagingServerIP <string>   # Optional: Server IP (default: 165.245.191.216)
-StagingDomain <string>     # Optional: Domain name (default: lms.khaz.app)
```

### Examples

```powershell
# Update staging with latest code
.\deploy-to-staging.ps1 -Mode update-only

# Full clean rebuild with verbose output
.\deploy-to-staging.ps1 -Mode full-clean-build -Verbose

# Update with data copy and custom SSH key
.\deploy-to-staging.ps1 -Mode update-with-data-copy -SSHKeyPath "c:\path\to\key"

# Deploy to different server
.\deploy-to-staging.ps1 -Mode update-only -StagingServerIP "192.168.1.100"
```

### Output Example

```
╔═══════════════════════════════════════════════════════════════════╗
║   LMSetjen DPD RI - Deploy to Staging Server                     ║
║   Deployment Mode: update-only                                   ║
╚═══════════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Testing SSH Connection to Staging Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Target: root@165.245.191.216
✅ SSH connection established

... [more output] ...

✅ Deployment completed successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Deployment Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Access your application:
  Frontend:  https://lms.khaz.app
  Backend API: https://lms.khaz.app/api/v1/
  Admin Panel: https://lms.khaz.app/admin/
  API Docs: https://lms.khaz.app/api/v1/swagger/
```

---

## 🔧 Script 2: Deploy on Staging (On Staging Server)

### Location
```
/root/lmsetjendpdri/deploy-on-staging.sh
```

### Features
- ✅ Local or remote development deployment
- ✅ Database backup and export
- ✅ File synchronization via SCP
- ✅ SSH connection testing
- ✅ Progress indication and status reporting
- ✅ Comprehensive error handling

### Prerequisites

**On Staging Server:**
```
✅ Docker & Docker Compose installed
✅ Git installed
✅ SSH access to development server (if remote deployment)
✅ Bash shell
```

**On Development Server (if remote):**
```
✅ Docker & Docker Compose installed
✅ SSH server running
✅ Project directory (will be created if needed)
```

### Usage

```bash
chmod +x /root/lmsetjendpdri/deploy-on-staging.sh
```

#### Mode 1: Full Clean Build (Local)
```bash
./deploy-on-staging.sh --mode full-clean-build
```

**What it does:**
- Backs up staging database
- Initializes local development environment at `/root/lmsetjendpdri-dev`
- Copies all project files
- Stops and removes existing containers
- Rebuilds images from scratch
- Starts fresh development environment

**When to use:** Complete fresh start for development testing

**Duration:** ~8-12 minutes

---

#### Mode 2: Update Only
```bash
./deploy-on-staging.sh --mode update-only
```

**What it does:**
- Syncs latest code from staging
- Rebuilds Docker images (with cache)
- Restarts containers
- Keeps existing development data

**When to use:** Regular code updates during development

**Duration:** ~2-3 minutes

---

#### Mode 3: Update with Database Copy
```bash
./deploy-on-staging.sh --mode update-with-db-copy
```

**What it does:**
- Backs up staging database
- Exports staging database to SQL file
- Syncs code to development
- Starts development containers
- Restores staging database to development
- Runs migrations
- Collects static files

**When to use:** Sync production/staging data to development for testing

**Duration:** ~3-5 minutes (depending on database size)

---

### Parameters

```bash
--mode <mode>               # Required: full-clean-build, update-only, update-with-db-copy
--dev-host <host>          # Optional: Dev server IP/hostname (default: localhost)
--dev-port <port>          # Optional: SSH port (default: 22)
--dev-user <user>          # Optional: SSH user (default: root)
--verbose                   # Optional: Show detailed output
--help                      # Show help message
```

### Examples

```bash
# Local deployment (same server)
./deploy-on-staging.sh --mode update-only

# Remote deployment to another server
./deploy-on-staging.sh --mode update-only --dev-host 192.168.1.100

# Full clean build with verbose output
./deploy-on-staging.sh --mode full-clean-build --verbose

# Deploy to custom SSH port
./deploy-on-staging.sh --mode update-only --dev-host dev.example.com --dev-port 2222

# Update with database copy (verbose)
./deploy-on-staging.sh --mode update-with-db-copy --verbose
```

### Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LMSetjen DPD RI - Staging to Development Deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Mode: update-only
ℹ️  Target: Local deployment

→ Testing SSH connection to development server
   Local deployment (no SSH test needed)

→ Backing up staging database
✅ Staging database backed up

... [deployment progress] ...

✅ Update deployment completed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Deployment Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Local development deployment completed
ℹ️  Access on this server:
  Frontend:  http://localhost:5174 (or http://IP:5174)
  Backend API: http://localhost:8001/api/v1/
  Admin Panel: http://localhost:8001/admin/
  API Docs: http://localhost:8001/api/v1/swagger/
```

---

## 📊 Deployment Workflow Examples

### Scenario 1: Daily Local Development to Staging
```powershell
# On your local machine at end of day
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-only
```

**Time:** 3-5 minutes  
**Data:** Latest code, preserves staging data

---

### Scenario 2: Testing in Development Environment
```powershell
# On local machine
.\deploy-to-staging.ps1 -Mode update-only

# Then SSH to staging
ssh -i c:\Users\khair\khaz root@165.245.191.216

# On staging server
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-with-db-copy
```

**Result:** Development environment has latest code + staging database

**Time:** 5-8 minutes total

---

### Scenario 3: Fresh Environment Reset
```powershell
# On local machine
.\deploy-to-staging.ps1 -Mode full-clean-build

# Wait 15 minutes, then SSH to staging
ssh -i c:\Users\khair\khaz root@165.245.191.216

# On staging, deploy clean dev environment
./deploy-on-staging.sh --mode full-clean-build
```

**Result:** Both staging and development fully reset

**Time:** 25-30 minutes total

---

### Scenario 4: Database Sync from Local to Development
```powershell
# Ensure local development is running with latest data
docker-compose up -d

# Deploy local changes + copy data to staging
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-with-data-copy

# Now deploy staging data to development
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-with-db-copy
```

**Result:** Development has exact copy of staging + latest code

**Time:** 6-10 minutes total

---

## 🔐 Security Considerations

### SSH Key Management
```bash
# SSH key location (required)
c:\Users\khair\khaz

# Permissions (on Linux/Mac)
chmod 600 ~/.ssh/id_rsa

# Test connection
ssh -i c:\Users\khair\khaz root@165.245.191.216 "echo OK"
```

### Environment Variables
- Never commit `.env` file to git
- Keep production secrets secure
- Use different `SECRET_KEY` for each environment
- Enable `DEBUG=False` on production

### Database Backups
Both scripts automatically backup databases before deployment:
```bash
# Backups stored at
/root/backups/lmsdb_pre_dev_*.sql
/root/backups/lmsdb_pre_staging_*.sql
```

### Firewall Rules
Ensure ports are accessible:
```
SSH: 22 (staging server)
Frontend: 5174 (development, 80/443 production)
Backend: 8001 (development, 80/443 production)
```

---

## 🐛 Troubleshooting

### SSH Connection Failed

```powershell
# Check SSH key exists
Test-Path "c:\Users\khair\khaz"

# Test SSH manually
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Check key permissions (if on Linux/Mac)
ssh-keygen -y -f c:\Users\khair\khaz
```

### Docker Build Failed

```bash
# SSH to server
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri

# Check logs
docker-compose logs backend

# Rebuild with verbose output
docker-compose build --no-cache 2>&1 | tail -50
```

### Database Migration Error

```bash
# SSH to server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Check database status
docker exec lms_backend python manage.py migrate --noinput

# Reset migrations (use with caution!)
docker exec lms_backend python manage.py migrate api zero
docker exec lms_backend python manage.py migrate --noinput
```

### Container Won't Start

```bash
# View full logs
docker-compose logs -f backend

# Check resource usage
docker stats

# Restart specific service
docker-compose restart backend

# Or full reset
docker-compose down -v
docker-compose up -d
```

---

## 📈 Monitoring & Maintenance

### Health Checks

```bash
# SSH to staging
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Check application health
curl http://localhost:8001/api/v1/health/

# Check containers
docker-compose ps

# View recent logs
docker-compose logs --tail=100 backend
```

### Database Maintenance

```bash
# Access database
docker exec -it lms_backend psql -U postgres -d lmsdb

# Useful commands
\dt                    # List tables
\du                    # List users
SELECT COUNT(*) FROM api_course;  # Count courses

# Backup database
docker exec lms_backend pg_dump -U postgres lmsdb > backup.sql

# Restore database
cat backup.sql | docker exec -i lms_backend psql -U postgres -d lmsdb
```

### Clear Cache

```bash
# Access Redis
docker exec -it lms_redis redis-cli

# Clear all cache
FLUSHALL

# Exit
exit
```

---

## 📝 Common Deployment Tasks

### Update Code Only

```powershell
# On local machine
.\deploy-to-staging.ps1 -Mode update-only
```

### Reset Everything

```powershell
# On local machine
.\deploy-to-staging.ps1 -Mode full-clean-build

# Confirm when prompted
```

### Check Deployment Status

```bash
# On staging server
docker-compose ps
docker-compose logs --tail=50
```

### Emergency Rollback

```bash
# Restore from backup
docker exec lms_backend pg_restore -U postgres -d lmsdb < /root/backups/lmsdb_backup.sql

# Restart container
docker-compose restart backend
```

---

## 📞 Support & Debugging

### Enable Verbose Output

```powershell
# Add -Verbose flag to any command
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

```bash
# Add --verbose flag
./deploy-on-staging.sh --mode update-only --verbose
```

### Check Log Files

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Redis logs
docker-compose logs -f redis

# System logs (on server)
tail -f /var/log/syslog  # Ubuntu
journalctl -f             # SystemD
```

### Performance Analysis

```bash
# Check Docker resource usage
docker stats

# Check server resources
htop

# Check disk space
df -h

# Check database size
docker exec lms_backend du -sh /var/lib/postgresql/data
```

---

## ✅ Deployment Checklist

### Before Deployment
- [ ] Run local tests and verify code
- [ ] Commit changes to git
- [ ] Ensure SSH key is accessible
- [ ] Verify SSH connection to server
- [ ] Backup important data locally
- [ ] Check server disk space (`df -h`)
- [ ] Check server is accessible

### During Deployment
- [ ] Monitor deployment progress
- [ ] Watch for error messages
- [ ] Keep terminal session open (SSH)
- [ ] Note deployment start time

### After Deployment
- [ ] Verify application is running (`curl http://lms.khaz.app/api/v1/health/`)
- [ ] Check all containers are up (`docker-compose ps`)
- [ ] Review logs for warnings (`docker-compose logs`)
- [ ] Test key features in browser
- [ ] Update team about deployment
- [ ] Document any changes made

---

## 📚 Additional Resources

### Documentation Files
- [DEPLOYMENT_GUIDE_UBUNTU.md](../docs/DEPLOYMENT_GUIDE_UBUNTU.md) - Full deployment guide
- [docker-compose.yml](../docker-compose.yml) - Docker configuration
- [.env](./.env) - Environment variables template
- [requirements.txt](./backend/requirements.txt) - Python dependencies

### Project Structure
```
d:\Project\LMSetjen DPD RI\
├── deploy-to-staging.ps1      ← Local machine deployment script
├── deploy-on-staging.sh         ← Staging server deployment script
├── docker-compose.yml           ← Docker configuration
├── .env                         ← Environment variables
├── backend/                     ← Django backend
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/                    ← React frontend
    ├── package.json
    └── Dockerfile.dev
```

### Quick Command Reference

```powershell
# Local deployment (Windows)
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-only
```

```bash
# Staging deployment (Linux)
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-only
```

---

## 🎯 Next Steps

1. **Copy scripts to your project** (already done if reading this)
2. **Test SSH connection** from local machine
3. **Make first deployment** using `update-only` mode
4. **Verify application** is accessible at `lms.khaz.app`
5. **Deploy to development** using staging script
6. **Monitor logs** and fix any issues
7. **Iterate** on code and re-deploy as needed

---

**Last Updated:** May 2026  
**Version:** 1.0 - Production Ready  
**Support:** Check logs, refer to troubleshooting section, or review Docker documentation
