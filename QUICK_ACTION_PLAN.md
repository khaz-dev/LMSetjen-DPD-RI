# 🚀 IMMEDIATE ACTION PLAN - STAGING DEPLOYMENT

**Priority**: CRITICAL  
**Issue**: Domain "Connection Refused" due to IP address change  
**Solution Time**: ~30 minutes  

---

## ⚡ STEP-BY-STEP (Do These NOW)

### 1️⃣ FIX DNS (5 minutes)

**Problem**: DuckDNS still points to old IP (16.79.83.21)  
**New IP**: 43.218.109.238

**What to do**:
```
1. Go to: https://www.duckdns.org
2. Login with your account
3. Find "lmsetjendpdri" in your domains
4. Change IP to: 43.218.109.238
5. Click "Update"
6. Wait 5-10 minutes for propagation
```

**Verify it worked**:
```bash
# Open CMD/PowerShell on your local machine and run:
nslookup lmsetjendpdri.duckdns.org

# Should show:
# Server:  your-dns-server
# Address: your-dns-ip
# 
# Name:    lmsetjendpdri.duckdns.org
# Address: 43.218.109.238   ← This should show NEW IP
```

---

### 2️⃣ CONNECT TO SERVER (2 minutes)

```bash
# Open PowerShell and run:
ssh -i "D:\Project\lms-server-key.pem" ubuntu@43.218.109.238

# You should see:
# Welcome to Ubuntu 20.04...
# ubuntu@ip-172-31-41-xxx:~$
```

---

### 3️⃣ CHECK CURRENT STATUS (3 minutes)

```bash
# Check if Docker is installed and running
docker --version
# Should show: Docker version 20.10.x or higher

# Check if application is running
cd ~/lmsetjen-app
docker-compose ps

# Should show:
# CONTAINER ID   IMAGE               STATUS
# xxxxx          lms_backend         Up (healthy)
# xxxxx          lms_frontend        Up (healthy)
# xxxxx          lms_postgres        Up (healthy)
# xxxxx          lms_redis           Up (healthy)
```

---

### 4️⃣ PULL LATEST CODE (2 minutes)

```bash
cd ~/lmsetjen-app
git pull origin main
```

---

### 5️⃣ RESTART SERVICES (5 minutes)

```bash
cd ~/lmsetjen-app

# Restart all containers
docker-compose restart

# Wait 30 seconds for services to be ready
sleep 30

# Verify status
docker-compose ps
```

---

### 6️⃣ VERIFY DEPLOYMENT (5 minutes)

**Test 1: Check if backend API is responding**
```bash
curl http://localhost:8000/api/v1/health/
# Should return: {"status":"ok"}
```

**Test 2: Check if frontend is responding**
```bash
curl http://localhost/health
# Should return: healthy
```

**Test 3: Test from your local machine (after DNS updates)**
```bash
# Open browser and visit:
https://lmsetjendpdri.duckdns.org

# You should see the LMS login page (no SSL errors)
```

---

## ✅ IF DNS IS TAKING TOO LONG

If DNS hasn't updated after 10 minutes, try these workarounds:

**Option A: Test directly with IP**
```bash
# In browser, visit:
https://43.218.109.238

# Or from terminal:
curl -H "Host: lmsetjendpdri.duckdns.org" https://43.218.109.238
```

**Option B: Flush local DNS cache**
```powershell
# Run as Administrator in PowerShell:
ipconfig /flushdns

# Then try domain again
```

**Option C: Use Google DNS**
```bash
nslookup lmsetjendpdri.duckdns.org 8.8.8.8
```

---

## 🔍 IF SOMETHING IS BROKEN

### Problem: Still getting "Connection Refused"

**Checklist**:
- [ ] DNS updated at DuckDNS? (Check via `nslookup`)
- [ ] Containers running? (`docker-compose ps` shows all UP)
- [ ] AWS Security Group allows port 80/443?
- [ ] Firewall on server blocking ports?

**Fix**:
```bash
# 1. Check if nginx is listening
netstat -tuln | grep LISTEN

# Should show:
# tcp  0  0 0.0.0.0:80   0.0.0.0:*  LISTEN
# tcp  0  0 0.0.0.0:443  0.0.0.0:*  LISTEN

# 2. If not, restart frontend
docker-compose restart frontend

# 3. Check logs
docker-compose logs frontend
```

### Problem: API errors (500 errors)

```bash
# Check backend logs
docker-compose logs backend | tail -100

# Common fix: Run migrations again
docker-compose exec -T backend python manage.py migrate --noinput

# Restart backend
docker-compose restart backend
```

### Problem: Frontend shows blank page

```bash
# Rebuild frontend
docker-compose build frontend
docker-compose restart frontend

# Check nginx config
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

---

## 📊 EXPECTED RESULT

After completing all steps:

✅ You can access: https://lmsetjendpdri.duckdns.org  
✅ Valid SSL certificate (no security warning)  
✅ Login page loads successfully  
✅ API responds to requests  
✅ All containers show "Up (healthy)"  

---

## 🆘 NEED HELP?

**Check these first**:

1. **DNS Issues**?
   ```bash
   nslookup lmsetjendpdri.duckdns.org
   ```

2. **Container Issues**?
   ```bash
   docker-compose ps
   docker-compose logs
   ```

3. **Port Issues**?
   ```bash
   netstat -tuln | grep LISTEN
   ```

4. **AWS Security Group Issues**?
   - Go to EC2 Dashboard
   - Click Security Groups
   - Check inbound rules allow:
     - Port 80 from 0.0.0.0/0
     - Port 443 from 0.0.0.0/0

---

## 📝 NOTES

- **Old IP**: 16.79.83.21 (no longer used)
- **New IP**: 43.218.109.238 (now active)
- **Domain**: lmsetjendpdri.duckdns.org (update DuckDNS!)
- **Server**: Ubuntu 20.04 LTS on AWS EC2
- **Framework**: Django 4.2 + React 18 + Docker Compose

---

**Expected Time to Complete**: ~1 hour (mostly waiting for DNS propagation)

**Start now and check back in 15 minutes!** ⏱️
