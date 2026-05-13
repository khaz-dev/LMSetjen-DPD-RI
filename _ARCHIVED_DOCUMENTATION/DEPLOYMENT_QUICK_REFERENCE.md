# LMSetjen DPD RI - Deployment Scripts Quick Reference

**Quick lookup guide for deployment commands and common scenarios**

---

## 🚀 Most Common Commands

### Deploy to Production (From Local Machine)
```powershell
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-only
```

### Deploy/Update on Production Server (Logged In via SSH)
```bash
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-only
```

### Full Reset (Both Scripts)
```powershell
# On local
.\deploy-to-staging.ps1 -Mode full-clean-build

# Then SSH to production
ssh -i c:\Users\khair\khaz root@165.245.191.216
./deploy-on-staging.sh --mode full-clean-build
```

---

## 📋 All Deployment Modes

### Local to Production (PowerShell)

| Mode | Command | Duration | Use Case |
|------|---------|----------|----------|
| **Update** | `.\deploy-to-staging.ps1 -Mode update-only` | 2-3 min | Daily updates |
| **Clean** | `.\deploy-to-staging.ps1 -Mode full-clean-build` | 10-15 min | Fresh start |
| **Data** | `.\deploy-to-staging.ps1 -Mode update-with-data-copy` | 2-4 min | Sync local data |

### On Production Server (Bash)

| Mode | Command | Duration | Use Case |
|------|---------|----------|----------|
| **Update** | `./deploy-on-staging.sh --mode update-only` | 2-3 min | Daily updates |
| **Clean** | `./deploy-on-staging.sh --mode full-clean-build` | 8-12 min | Fresh start |
| **Refresh** | `./deploy-on-staging.sh --mode update-with-data-refresh` | 3-5 min | DB migrations |

---

## 🔗 Access URLs

### After Deployment

**Production (lms.khaz.app)**
- Frontend: `https://lms.khaz.app`
- Backend API: `https://lms.khaz.app/api/v1/`
- Admin: `https://lms.khaz.app/admin/`
- Docs: `https://lms.khaz.app/api/v1/swagger/`

---

## 🔧 Troubleshooting Quick Fixes

### SSH Connection Failed
```powershell
ssh -i c:\Users\khair\khaz root@165.245.191.216
```
If that fails, ensure key file exists and has correct permissions.

### Docker Build Failed
```bash
# SSH to server first
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
docker-compose logs backend
```

### Can't Access Application
```bash
curl http://localhost:8001/api/v1/health/
docker-compose ps
docker-compose logs --tail=50
```

### Database Error
```bash
docker exec lms_backend python manage.py migrate --noinput
docker-compose restart backend
```

### Clear Cache
```bash
docker exec -it lms_redis redis-cli
FLUSHALL
exit
```

---

## 📊 Deployment Timeline

### Typical Deployment Flow
```
[Local Code Change]
        ↓
[Run Deploy Script] ← 2-3 minutes
        ↓
[Production Updated] ✅
        ↓
[Test Application]
```

---

## 💾 Backup & Recovery

### Create Manual Backup
```bash
# On production server
mkdir -p /root/lmsetjendpdri/backups
docker exec lms_backend pg_dump -U postgres lmsdb > /root/lmsetjendpdri/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup
```bash
docker exec -i lms_backend psql -U postgres -d lmsdb < /root/lmsetjendpdri/backups/backup_file.sql
docker-compose restart backend
```

---

## 🔐 Server Access

### SSH to Production Server
```bash
ssh -i c:\Users\khair\khaz root@165.245.191.216
```

### Project Location on Production
```
/root/lmsetjendpdri        # Main project directory
```

### Docker Commands
```bash
docker-compose ps               # Show containers
docker-compose logs -f backend  # Watch backend logs
docker-compose restart backend  # Restart backend
docker-compose down -v          # Remove everything
docker-compose up -d            # Start all
```

---

## 📈 Common Workflows

### Daily Development Cycle
```powershell
# 1. Local development complete
# 2. Push to git
# 3. Deploy to production
.\deploy-to-staging.ps1 -Mode update-only

# 4. Test on production (lms.khaz.app)
# 5. Done!
```

### Deploy with Data Sync
```powershell
# 1. Sync local data to production
.\deploy-to-staging.ps1 -Mode update-with-data-copy
```

### Emergency Fix (Direct on Server)
```bash
# 1. SSH to production
ssh -i c:\Users\khair\khaz root@165.245.191.216

# 2. Quick update on production
./deploy-on-staging.sh --mode update-only
```

### Database Migration
```bash
# On production server
./deploy-on-staging.sh --mode update-with-data-refresh --verbose
```

---

## ⏱️ Quick Reference: Duration

| Task | Time |
|------|------|
| Update code only | 2-3 min |
| Update with rebuild | 3-5 min |
| Copy database | 3-5 min |
| Full clean rebuild | 10-15 min |
| SSH connection test | < 1 min |

---

## ✅ Pre-Deployment Checklist

```
☐ Code committed to git
☐ SSH key working
☐ Server has internet access
☐ Port 22 (SSH) accessible
☐ Sufficient disk space on server
☐ Database backups available (if needed)
```

---

## 🚨 Danger Zone (Use With Caution)

### Remove All Data
```bash
# WARNING: This deletes everything!
docker-compose down -v
docker volume prune
docker system prune -a
```

### Reset Database
```bash
# WARNING: Deletes all data!
docker exec lms_backend python manage.py migrate api zero
docker exec lms_backend python manage.py migrate
```

### Kill All Containers
```bash
docker-compose kill
docker system prune -a
```

---

## 📞 Getting Help

### Check Deployment Docs
```
d:\Project\LMSetjen DPD RI\DEPLOYMENT_SCRIPTS_GUIDE.md
```

### View Full Help
```powershell
# PowerShell help
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

```bash
# Bash help
./deploy-on-staging.sh --help
./deploy-on-staging.sh --mode update-only --verbose
```

### Enable Verbose Output
```powershell
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

```bash
./deploy-on-staging.sh --mode update-only --verbose
```

---

## 🎯 Script Features at a Glance

### deploy-to-staging.ps1 (Local Machine)
- ✅ SSH connection testing
- ✅ Auto backup before deployment
- ✅ Project file sync via SCP
- ✅ 3 deployment modes
- ✅ Health checks
- ✅ Detailed progress output
- ✅ Error handling & rollback info

### deploy-on-staging.sh (Production Server)
- ✅ Local deployment only
- ✅ Database export/import
- ✅ Application file backup
- ✅ 3 deployment modes
- ✅ Service health verification
- ✅ Comprehensive logging
- ✅ Recovery information

---

## 🔑 Important Files & Paths

```
LOCAL MACHINE:
  Script: d:\Project\LMSetjen DPD RI\deploy-to-staging.ps1
  Project: d:\Project\LMSetjen DPD RI\
  SSH Key: c:\Users\khair\khaz

PRODUCTION SERVER:
  IP: 165.245.191.216
  Project: /root/lmsetjendpdri/
  Script: /root/lmsetjendpdri/deploy-on-staging.sh
  Backups: /root/lmsetjendpdri/backups/

DEPLOYED APPLICATION:
  Domain: lms.khaz.app
  Frontend: https://lms.khaz.app
  API: https://lms.khaz.app/api/v1/
```

---

## 📅 Recommended Deployment Schedule

**Daily:**
```
./deploy-to-staging.ps1 -Mode update-only  # Deploy code changes
```

**Weekly:**
```
./deploy-to-staging.ps1 -Mode update-with-data-copy  # Sync data if needed
```

**Monthly:**
```
./deploy-to-staging.ps1 -Mode full-clean-build  # Full reset
```

**As Needed:**
```
Database backups, log cleanup, storage optimization
```

---

**Version:** 1.0 (May 2026)  
**Last Updated:** Corrected to production-only deployment  
**Status:** Ready for production use

---

## 🚀 Most Common Commands

### Deploy to Staging (From Local Machine)
```powershell
cd "d:\Project\LMSetjen DPD RI"
.\deploy-to-staging.ps1 -Mode update-only
```

### Deploy to Development (From Staging Server)
```bash
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
./deploy-on-staging.sh --mode update-only
```

### Full Reset (Both Staging & Development)
```powershell
# On local
.\deploy-to-staging.ps1 -Mode full-clean-build

# Then on staging
ssh -i c:\Users\khair\khaz root@165.245.191.216
./deploy-on-staging.sh --mode full-clean-build
```

---

## 📋 All Deployment Modes

### Local to Staging (PowerShell)

| Mode | Command | Duration | Use Case |
|------|---------|----------|----------|
| **Update** | `.\deploy-to-staging.ps1 -Mode update-only` | 3-5 min | Daily code updates |
| **Clean** | `.\deploy-to-staging.ps1 -Mode full-clean-build` | 10-15 min | Fresh start, reset |
| **Data** | `.\deploy-to-staging.ps1 -Mode update-with-data-copy` | 2-4 min | Sync local data up |

### Staging to Development (Bash)

| Mode | Command | Duration | Use Case |
|------|---------|----------|----------|
| **Update** | `./deploy-on-staging.sh --mode update-only` | 2-3 min | Daily updates |
| **Clean** | `./deploy-on-staging.sh --mode full-clean-build` | 8-12 min | Fresh start |
| **Data** | `./deploy-on-staging.sh --mode update-with-db-copy` | 3-5 min | Sync staging data |

---

## 🔗 Access URLs

### After Deployment

**Staging (lms.khaz.app)**
- Frontend: `https://lms.khaz.app`
- Backend API: `https://lms.khaz.app/api/v1/`
- Admin: `https://lms.khaz.app/admin/`
- Docs: `https://lms.khaz.app/api/v1/swagger/`

**Development (localhost or dev server)**
- Frontend: `http://localhost:5174`
- Backend API: `http://localhost:8001/api/v1/`
- Admin: `http://localhost:8001/admin/`
- Docs: `http://localhost:8001/api/v1/swagger/`

---

## 🔧 Troubleshooting Quick Fixes

### SSH Connection Failed
```powershell
ssh -i c:\Users\khair\khaz root@165.245.191.216
```
If that fails, ensure key file exists and has correct permissions.

### Docker Build Failed
```bash
# SSH to server first
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
docker-compose logs backend
```

### Can't Access Application
```bash
curl http://localhost:8001/api/v1/health/
docker-compose ps
docker-compose logs --tail=50
```

### Database Error
```bash
docker exec lms_backend python manage.py migrate --noinput
docker-compose restart backend
```

### Clear Cache
```bash
docker exec -it lms_redis redis-cli
FLUSHALL
exit
```

---

## 📊 Deployment Timeline

### Typical Deployment Flow
```
[Local Code Change]
        ↓
[Run Deploy Script] ← 2-5 minutes
        ↓
[Staging Updated] ✅
        ↓
[Test on Staging]
        ↓
[Deploy to Dev] ← 2-5 minutes
        ↓
[Development Updated] ✅
        ↓
[Full Test Cycle]
```

---

## 💾 Backup & Recovery

### Create Manual Backup
```bash
# On staging server
mkdir -p /root/backups
docker exec lms_backend pg_dump -U postgres lmsdb > /root/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup
```bash
docker exec -i lms_backend psql -U postgres -d lmsdb < /root/backups/backup_file.sql
docker-compose restart backend
```

---

## 🔐 Server Access

### SSH to Staging Server
```bash
ssh -i c:\Users\khair\khaz root@165.245.191.216
```

### Project Location on Staging
```
/root/lmsetjendpdri              # Staging/production
/root/lmsetjendpdri-dev          # Development instance
```

### Docker Commands
```bash
docker-compose ps               # Show containers
docker-compose logs -f backend  # Watch backend logs
docker-compose restart backend  # Restart backend
docker-compose down -v          # Remove everything
docker-compose up -d            # Start all
```

---

## 📈 Common Workflows

### Daily Development Cycle
```powershell
# 1. Local development complete
# 2. Push to git
# 3. Deploy to staging
.\deploy-to-staging.ps1 -Mode update-only

# 4. Test on staging (lms.khaz.app)
# 5. If OK, deploy to dev
ssh -i c:\Users\khair\khaz root@165.245.191.216
./deploy-on-staging.sh --mode update-only
```

### Deploy with Data Sync
```powershell
# 1. Sync local data to staging
.\deploy-to-staging.ps1 -Mode update-with-data-copy

# 2. Then sync staging to dev
ssh -i c:\Users\khair\khaz root@165.245.191.216
./deploy-on-staging.sh --mode update-with-db-copy
```

### Emergency Reset
```powershell
# 1. Full reset on staging
.\deploy-to-staging.ps1 -Mode full-clean-build

# 2. Full reset on dev
ssh -i c:\Users\khair\khaz root@165.245.191.216
./deploy-on-staging.sh --mode full-clean-build
```

### Database Copy Only
```bash
# SSH to staging
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Deploy dev with staging data
./deploy-on-staging.sh --mode update-with-db-copy --dev-host localhost
```

---

## ⏱️ Quick Reference: Duration

| Task | Time |
|------|------|
| Update code only | 2-3 min |
| Update with rebuild | 3-5 min |
| Copy database | 3-5 min |
| Full clean rebuild | 10-15 min |
| Full stack reset | 25-30 min |
| SSH connection test | < 1 min |

---

## ✅ Pre-Deployment Checklist

```
☐ Code committed to git
☐ SSH key working
☐ Server has internet access
☐ Port 22 (SSH) accessible
☐ Docker running locally (for local deploy)
☐ Sufficient disk space on server
☐ Database backups available
```

---

## 🚨 Danger Zone (Use With Caution)

### Remove All Data
```bash
# WARNING: This deletes everything!
docker-compose down -v
docker volume prune
docker system prune -a
```

### Reset Database
```bash
# WARNING: Deletes all data!
docker exec lms_backend python manage.py migrate api zero
docker exec lms_backend python manage.py migrate
```

### Kill All Containers
```bash
docker-compose kill
docker system prune -a
```

---

## 📞 Getting Help

### Check Deployment Docs
```
d:\Project\LMSetjen DPD RI\DEPLOYMENT_SCRIPTS_GUIDE.md
```

### View Full Help
```powershell
# PowerShell help
Get-Help .\deploy-to-staging.ps1
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

```bash
# Bash help
./deploy-on-staging.sh --help
./deploy-on-staging.sh --mode update-only --verbose
```

### Enable Verbose Output
```powershell
.\deploy-to-staging.ps1 -Mode update-only -Verbose
```

```bash
./deploy-on-staging.sh --mode update-only --verbose
```

---

## 🎯 Script Features at a Glance

### deploy-to-staging.ps1
- ✅ SSH connection testing
- ✅ Auto backup before deployment
- ✅ Project file sync via SCP
- ✅ 3 deployment modes
- ✅ Health checks
- ✅ Detailed progress output
- ✅ Error handling & rollback info

### deploy-on-staging.sh
- ✅ Local + remote deployment support
- ✅ Database export/import
- ✅ Project file synchronization
- ✅ 3 deployment modes
- ✅ Service health verification
- ✅ Comprehensive logging
- ✅ Custom SSH port support

---

## 🔑 Important Files & Paths

```
LOCAL MACHINE:
  Script: d:\Project\LMSetjen DPD RI\deploy-to-staging.ps1
  Project: d:\Project\LMSetjen DPD RI\
  SSH Key: c:\Users\khair\khaz

STAGING SERVER:
  IP: 165.245.191.216
  Project: /root/lmsetjendpdri/
  Script: /root/lmsetjendpdri/deploy-on-staging.sh
  Backups: /root/backups/
  Dev Project: /root/lmsetjendpdri-dev/

DEPLOYED SERVICES:
  Staging: lms.khaz.app (port 443/80)
  Dev: localhost:5174 & localhost:8001
```

---

## 📅 Maintenance Schedule

**Daily:**
```
./deploy-to-staging.ps1 -Mode update-only  # Deploy code changes
```

**Weekly:**
```
./deploy-to-staging.ps1 -Mode update-with-data-copy  # Sync data
```

**Monthly:**
```
./deploy-to-staging.ps1 -Mode full-clean-build  # Full reset
```

**As Needed:**
```
Database backups, log cleanup, storage optimization
```

---

**Version:** 1.0 (May 2026)  
**Last Updated:** Production deployment scripts finalized  
**Status:** Ready for production use
