# MANUAL DEPLOYMENT GUIDE - Pull Cleanup to Production

## Server Details
- **SSH Key:** `D:\Project\lms-server-key.pem`
- **Server:** `ubuntu@16.79.83.21`
- **Project Path:** `~/LMSetjen-DPD-RI`
- **Site URL:** https://lmsetjendpdri.duckdns.org/

---

## Step-by-Step Instructions

### Step 1: Connect to Server
```powershell
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
```

### Step 2: Navigate to Project Directory
```bash
cd ~/LMSetjen-DPD-RI
```

### Step 3: Check Current Status
```bash
# See what's currently on the server
git status

# Check current branch
git branch
```

### Step 4: Backup Environment Files (Important!)
```bash
# Backup .env files before pulling
cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No root .env"
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "No backend .env"
```

### Step 5: Stash Any Local Changes
```bash
# Save any local changes (just in case)
git stash save "Before cleanup pull - $(date +%Y%m%d_%H%M%S)"
```

### Step 6: Pull Cleanup Changes
```bash
# Fetch latest from GitHub
git fetch origin main

# Pull the cleanup changes
git pull origin main
```

### Step 7: Verify the Pull
```bash
# Check what was pulled
git log -3 --oneline

# Verify key files still exist
ls -lh README.md docker-compose.yml backend/manage.py frontend/package.json
```

### Step 8: Check Docker Containers
```bash
# Check if containers are running
docker compose ps

# Check container health
docker compose logs --tail=20
```

### Step 9: (Optional) Restart Containers
**Note:** This is optional since we only removed documentation and unused files
```bash
# Restart all containers
docker compose restart

# Or restart specific services
docker compose restart backend
docker compose restart frontend
docker compose restart nginx
```

### Step 10: Verify Site is Working
```bash
# Test backend health
curl http://localhost:8000/api/health/

# Test frontend
curl http://localhost/

# Check nginx
curl -I http://localhost/
```

---

## Quick Copy-Paste Commands

### All-in-One Command Sequence:
```bash
cd ~/LMSetjen-DPD-RI && \
cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null ; \
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null ; \
git stash save "Before cleanup pull - $(date +%Y%m%d_%H%M%S)" && \
git fetch origin main && \
git pull origin main && \
echo "" && \
echo "==== PULL COMPLETE ====" && \
echo "" && \
git log -3 --oneline && \
echo "" && \
docker compose ps
```

---

## What to Expect

### Files Removed (157+):
- Outdated documentation (80+ files)
- Old deployment scripts (14 files)
- Empty test files (3 files)
- Unused Python files (3 files)
- Lighthouse reports (13+ files)
- Build artifacts and temp files
- `__pycache__` directories (10)

### Files Preserved:
- ✅ All source code
- ✅ All configurations (docker-compose.yml, .env, etc.)
- ✅ All migrations
- ✅ All active documentation
- ✅ Production builds

### Expected Output:
```
From github.com:khaz-dev/LMSetjen-DPD-RI
 * branch            main       -> FETCH_HEAD
Updating <old-hash>..<new-hash>
 157 files changed, 0 insertions(+), XXXXX deletions(-)
 delete mode 100644 CLEANUP_PROJECT.ps1
 delete mode 100644 backend/api/models_optimized.py
 ... (many more deletions)
```

---

## Troubleshooting

### If pull fails due to local changes:
```bash
# See what files have local changes
git status

# View the changes
git diff

# If you want to keep local changes:
git stash save "My local changes"
git pull origin main
git stash pop

# If you want to discard local changes:
git reset --hard HEAD
git pull origin main
```

### If containers stop working:
```bash
# Check logs
docker compose logs --tail=50

# Restart all services
docker compose down
docker compose up -d

# Wait for services to start
sleep 30

# Verify
docker compose ps
```

### If .env files are missing after pull:
```bash
# Restore from backup
cp .env.backup.YYYYMMDD_HHMMSS .env
cp backend/.env.backup.YYYYMMDD_HHMMSS backend/.env
```

---

## Post-Deployment Verification

### 1. Check the website:
- Visit: https://lmsetjendpdri.duckdns.org/
- Test login
- Test course viewing

### 2. Check API:
```bash
curl https://lmsetjendpdri.duckdns.org/api/
curl https://lmsetjendpdri.duckdns.org/api/health/
```

### 3. Check logs for errors:
```bash
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
docker compose logs nginx --tail=50
```

---

## Summary

This deployment is **SAFE** because:
- ✅ Only removed documentation and unused files
- ✅ No changes to source code
- ✅ No changes to configurations
- ✅ No database migrations to run
- ✅ Containers don't need restart (but can if you want)

The cleanup makes your production server:
- 🧹 Cleaner (157+ fewer files)
- 📁 More organized
- ⚡ Easier to navigate
- 🎯 More maintainable

---

## Need Help?

If anything goes wrong:
1. Check container logs: `docker compose logs --tail=100`
2. Restore .env from backup
3. Restart containers: `docker compose restart`
4. Roll back: `git reset --hard <previous-commit-hash>`

---

**Ready to deploy!** Follow the steps above. 🚀
