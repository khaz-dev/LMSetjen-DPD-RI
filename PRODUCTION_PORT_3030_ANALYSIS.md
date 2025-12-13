# 🔧 Production Port Configuration Analysis

**Date:** December 10, 2025  
**Issue:** Production server (10.20.30.176) accessible on port 3030 instead of 80/443  
**Status:** 🔴 UNREACHABLE - Requires Investigation

---

## 📊 Port Comparison Across Environments

| Component | Local Dev | Staging | Production | Status |
|-----------|-----------|---------|-----------|--------|
| Nginx/Reverse Proxy | 80, 443 | 80, 443 | **3030** ⚠️ | Port mismatch |
| Backend (Gunicorn) | 8000 | 8000 | Unknown | Check Docker |
| PostgreSQL | 5432 | 5432 | Unknown | Check Docker |
| Redis | 6379 | 6379 | Unknown | Check Docker |

---

## 🔍 Why Port 3030?

### Possible Reasons:

1. **Custom Nginx Configuration on Production**
   - Production server uses non-standard port for security
   - May be behind additional reverse proxy
   - Could be intentional for load balancing

2. **Node.js Application Server**
   - Port 3030 is common default for Node.js apps
   - Production might not be using Docker
   - Could be running React dev server or Next.js

3. **Docker Port Mapping**
   ```yaml
   # Possible docker-compose.yml configuration:
   frontend:
     ports:
       - "3030:80"  # Host:Container mapping
   ```

4. **Reverse Proxy Configuration**
   ```nginx
   # Could be HAProxy, Traefik, or another reverse proxy
   # Listening on 3030 and forwarding to internal services
   ```

5. **Development vs Production Mismatch**
   - Production deployment script different from docker-compose.yml
   - Manual deployment with custom port assignment
   - Environment-specific configuration not tracked in repo

---

## 🚨 Critical Questions to Answer

### Q1: Is Production Running Docker?
```bash
# Check from staging:
ssh ubuntu@10.20.30.176 "docker ps"

# If command fails or no response:
# → Production is NOT running Docker
# → Check what's actually running:
ps aux | grep -E "(nginx|gunicorn|node|python)"
```

### Q2: What's Listening on Port 3030?
```bash
# Check from production:
sudo netstat -tlnp | grep 3030
sudo ss -tlnp | grep 3030

# Output example:
# LISTEN  tcp  0  0  0.0.0.0:3030  0.0.0.0:*  LISTEN  pid/nginx
# → Would indicate Nginx on 3030

# If process name shows node/python:
# → Application server directly exposed
```

### Q3: Is There a docker-compose.prod.yml?
```bash
# Check for production-specific compose file:
ls -la ~/LMSetjen-DPD-RI/docker-compose*.yml

# If docker-compose.prod.yml exists:
cat docker-compose.prod.yml | grep -A 5 "ports:"
```

### Q4: What Does Environment Variable Say?
```bash
# Check application configuration:
env | grep -E "(PORT|API_|BACKEND_|FRONTEND_)"
cat ~/.env | grep -i port
cat /etc/environment | grep -i port
```

---

## 🔧 Solutions by Scenario

### Scenario A: Docker on Production, Port 3030 Intentional

**If:** `docker-compose up -d` maps ports as `3030:80`

**Solution:**
```bash
# Update docker-compose.yml to standard ports:
# Change: "3030:80" → "80:80"

# Or configure host Nginx on port 80 to proxy to 3030:
sudo tee /etc/nginx/sites-available/lms > /dev/null <<'EOF'
server {
    listen 80 default_server;
    
    location / {
        proxy_pass http://localhost:3030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo systemctl reload nginx
```

### Scenario B: Docker on Production, Port 3030 by Mistake

**If:** Production deployment script has typo/misconfiguration

**Solution:**
```bash
# Fix docker-compose.yml or .env:
cd ~/LMSetjen-DPD-RI
docker-compose down
# Edit docker-compose.yml: change "3030:80" to "80:80"
docker-compose up -d

# Verify:
curl http://10.20.30.176/health
```

### Scenario C: Not Using Docker on Production

**If:** Custom manual deployment (Nginx + Gunicorn on host)

**Solution:**
```bash
# Check Nginx config:
sudo cat /etc/nginx/nginx.conf
sudo cat /etc/nginx/sites-available/default
# Look for: listen 3030;

# If found, change to:
sudo sed -i 's/listen 3030/listen 80/g' /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx
```

### Scenario D: Behind Load Balancer on Port 3030

**If:** Production is internal, external LB on port 80/443

**Solution:**
```bash
# This is actually OK - don't change it
# Just need to:
# 1. Verify connectivity through LB
# 2. Update DNS to point to LB IP:80
# 3. Ensure backend knows real client IP via X-Forwarded-For

# Nginx configuration should already handle this if:
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

---

## 📋 Diagnostic Commands to Run on Production

### Command Set 1: Basic System Info
```bash
ssh ubuntu@10.20.30.176 <<'EOF'
echo "=== OS Info ==="
cat /etc/os-release | head -3

echo -e "\n=== Listening Ports ==="
sudo ss -tlnp | grep -E "(80|443|3030|8000)"

echo -e "\n=== Docker Status ==="
docker ps 2>/dev/null || echo "Docker not installed or not running"

echo -e "\n=== Process Check ==="
ps aux | grep -E "(nginx|gunicorn|node|python)" | grep -v grep

echo -e "\n=== Nginx Status ==="
sudo systemctl status nginx 2>/dev/null || echo "Nginx not found"
EOF
```

### Command Set 2: Check File Locations
```bash
ssh ubuntu@10.20.30.176 <<'EOF'
echo "=== Nginx Directories ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "Not standard Ubuntu"

echo -e "\n=== Docker Compose Configs ==="
find ~ -name "docker-compose*.yml" 2>/dev/null

echo -e "\n=== Application Directory ==="
ls -la ~/LMSetjen-DPD-RI/ 2>/dev/null || echo "Not found"
EOF
```

### Command Set 3: Port Connectivity
```bash
ssh ubuntu@10.20.30.176 <<'EOF'
echo "=== Port 3030 Response ==="
curl -v -m 3 http://localhost:3030/ 2>&1 | head -20

echo -e "\n=== Port 80 Response ==="
curl -v -m 3 http://localhost/ 2>&1 | head -20

echo -e "\n=== Port 8000 Response ==="
curl -v -m 3 http://localhost:8000/ 2>&1 | head -20
EOF
```

### Command Set 4: Log Analysis
```bash
ssh ubuntu@10.20.30.176 <<'EOF'
echo "=== Nginx Error Log (last 10 lines) ==="
sudo tail -10 /var/log/nginx/error.log 2>/dev/null

echo -e "\n=== Nginx Access Log (last 5 lines) ==="
sudo tail -5 /var/log/nginx/access.log 2>/dev/null

echo -e "\n=== Docker Logs (Frontend) ==="
docker logs --tail 5 lms_frontend 2>/dev/null

echo -e "\n=== Docker Logs (Backend) ==="
docker logs --tail 5 lms_backend 2>/dev/null
EOF
```

---

## 🔄 Port Mapping Scenarios

### Current State (Broken)
```
User Browser (10.20.30.176:3030)
    ↓ TIMEOUT (no response)
    ↗ (unreachable)
```

### After Fix - Scenario A (If Docker)
```
User Browser (10.20.30.176:80)
    ↓
Host Nginx (listen 80)
    ↓
Docker Container (localhost:3030)
    ↓
Nginx in Container (listen 80)
    ↓
React Frontend + Gunicorn Backend
```

### After Fix - Scenario B (If Manual Deployment)
```
User Browser (10.20.30.176:80)
    ↓
Host Nginx (listen 80)
    ↓
Gunicorn (localhost:8000)
    ↓
Django Backend
```

### After Fix - Scenario C (If Behind Load Balancer)
```
User Browser (yourdomain.com:80 via DNS)
    ↓
External Load Balancer (port 80/443)
    ↓
Production Server (10.20.30.176:3030)
    ↓
Internal Services
```

---

## 🚀 Immediate Action Plan

### Priority 1 (Must Do Today):
1. ✅ Diagnose production environment
2. ✅ Determine if Docker or manual deployment
3. ✅ Find why port 3030
4. ✅ Document findings

### Priority 2 (Tomorrow):
1. Run diagnostic commands on production
2. Identify root cause
3. Apply appropriate fix

### Priority 3 (This Week):
1. Test production endpoint accessibility
2. Verify staging server fix works
3. Create deployment runbook

---

## 📝 Quick Fix Template

Once you identify the issue, use this template:

```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@10.20.30.176

# Step 1: Identify issue (use diagnostic commands above)
# Step 2: Choose solution based on findings

# If Docker with wrong port:
cd ~/LMSetjen-DPD-RI
docker-compose down
# Edit docker-compose.yml to map "80:80" instead of "3030:80"
docker-compose up -d

# If manual deployment with wrong Nginx port:
sudo sed -i 's/listen 3030/listen 80/g' /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx

# If behind load balancer (no change needed):
# Just verify connectivity through LB

# Verify fix:
curl -v http://10.20.30.176/health
curl -v http://10.20.30.176/api/v1/health/
curl -v http://10.20.30.176/
```

---

## 🔗 Related Files

- **Main Config:** `frontend/nginx.conf` (production template)
- **Docker Compose:** `docker-compose.yml` (port mappings)
- **Quick Fix Guide:** `STAGING_NGINX_QUICK_FIX.md`
- **Full Report:** `NGINX_CONFIGURATION_DIAGNOSTIC_REPORT.md`

---

**Next Step:** Run diagnostic commands on production server to identify the port 3030 issue!
