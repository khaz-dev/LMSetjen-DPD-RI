# 🚀 PRODUCTION DEPLOYMENT - QUICK COPY-PASTE COMMANDS

## Option 1: Automated Deployment (Recommended)

If you have the deploy script on the server, run:

```bash
ssh ubuntu@lmsetjen.id
bash ~/LMSetjen-DPD-RI/deploy-production-fix.sh
```

---

## Option 2: Manual Step-by-Step Deployment

### Step 1: SSH into Production Server
```bash
ssh ubuntu@lmsetjen.id
```

### Step 2: Navigate to Project
```bash
cd /home/ubuntu/LMSetjen-DPD-RI
```

### Step 3: Pull Latest Code
```bash
git pull origin main
```

**Expected output:**
```
Updating eb28a1e..de16582
Fast-forward
 fix-production-build.sh | 22 ++++++++++++++++++++++
 1 file changed, 22 insertions(+)
```

### Step 4: Install Frontend Dependencies (CRITICAL STEP)
```bash
cd frontend
npm install --prefer-offline --no-audit
```

**This will:**
- Download 1,200+ npm packages
- Install `qrcode.react` v3.1.0 (FIXES THE ERROR)
- Create `node_modules/` directory
- Takes 3-5 minutes

**Expected completion:**
```
added 1234 packages in 4m
```

### Step 5: Build Frontend Production Bundle
```bash
npm run build
```

**Expected output:**
```
✓ 124 modules transformed.
✓ built in 1.63s
```

### Step 6: Return to Project Root & Stop Services
```bash
cd ..
docker-compose down
```

**Expected output:**
```
Stopping lmsetjen-dpdri-backend-1 ... done
Stopping lmsetjen-dpdri-lms_postgres-1 ... done
Stopping lmsetjen-dpdri-lms_redis-1 ... done
```

### Step 7: Start Services
```bash
docker-compose up -d
```

**Expected output:**
```
Creating network "lmsetjen-dpdri_default" with the default driver
Creating lmsetjen-dpdri-lms_postgres-1 ... done
Creating lmsetjen-dpdri-lms_redis-1 ... done
Creating lmsetjen-dpdri-backend-1 ... done
```

### Step 8: Wait for Services to Initialize (60 seconds)
```bash
sleep 60
```

### Step 9: Verify Services Are Running
```bash
docker-compose ps
```

**Expected output:**
```
NAME                              STATUS      PORTS
lmsetjen-dpdri-backend-1          Up 2 mins   0.0.0.0:8000->8000/tcp
lmsetjen-dpdri-lms_postgres-1     Up 2 mins   0.0.0.0:5432->5432/tcp
lmsetjen-dpdri-lms_redis-1        Up 2 mins   0.0.0.0:6379->6379/tcp
```

---

## Option 3: One-Liner Deployment (Fast Track)

Copy and paste this entire command:

```bash
ssh ubuntu@lmsetjen.id << 'EOF'
cd /home/ubuntu/LMSetjen-DPD-RI && \
git pull origin main && \
cd frontend && \
npm install --prefer-offline --no-audit && \
npm run build && \
cd .. && \
docker-compose down && \
docker-compose up -d && \
sleep 60 && \
docker-compose ps
EOF
```

This will:
1. SSH into server
2. Pull latest code
3. Install dependencies
4. Build frontend
5. Restart services
6. Display status

**Total time:** ~8-10 minutes

---

## ✅ Verification After Deployment

### Check 1: Services Running
```bash
docker-compose ps
```
Should show 3 services with "Up" status ✓

### Check 2: Logs
```bash
docker-compose logs -f frontend
```
Should show Nginx running without errors

### Check 3: API Health
```bash
curl https://lmsetjen.id/api/v1/course/course-list/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```
Should return 200 with course data ✓

### Check 4: Frontend in Browser
```
https://lmsetjen.id
```
Should load without errors ✓

### Check 5: Certificate QR Codes
1. Login as student
2. Go to My Courses
3. Enroll in a course
4. Complete course
5. View certificate
6. QR code should display ✓

---

## 🔄 If Something Goes Wrong

### Check Logs
```bash
# Full logs
docker-compose logs

# Frontend only
docker-compose logs frontend

# Backend only
docker-compose logs backend

# Follow logs (real-time)
docker-compose logs -f
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild Frontend
```bash
cd /home/ubuntu/LMSetjen-DPD-RI/frontend
npm run build
cd ..
docker-compose restart
```

### Full Rollback
```bash
cd /home/ubuntu/LMSetjen-DPD-RI
git log --oneline -5         # Check commit history
git reset --hard HEAD~1      # Undo last commit
npm install
npm run build
docker-compose down && docker-compose up -d
```

---

## 📋 Summary

**What gets deployed:**
- ✅ Latest code from GitHub
- ✅ All npm dependencies (1,200+ packages including qrcode.react)
- ✅ Production frontend bundle
- ✅ Restarted backend, database, cache services

**What gets fixed:**
- ✅ Build error resolved
- ✅ Certificate QR codes working
- ✅ All features operational

**Time required:** 8-10 minutes  
**Downtime:** 1-2 minutes (during service restart)  
**Data impact:** None (database untouched)

---

**Status: READY TO DEPLOY** ✅

Choose your deployment method above and execute.
