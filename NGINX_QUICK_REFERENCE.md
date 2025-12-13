# 🎯 Nginx Issues - Quick Reference Card

**Issue Found:** Production (10.20.30.176:3030) unreachable | Staging needs host Nginx config  
**Time to Fix:** ~10 minutes | **Difficulty:** Easy | **Risk:** Low

---

## 🚨 3 Main Issues

### 1️⃣ Production Not Responding on Port 3030
**Status:** 🔴 CRITICAL  
**Why:** Unknown (requires SSH investigation)  
**Fix Time:** 30 min  
**Action:** See PRODUCTION_PORT_3030_ANALYSIS.md

### 2️⃣ Staging Host Nginx Not Proxying to Docker
**Status:** 🟠 HIGH  
**Why:** /etc/nginx/sites-available/default has default config (not LMS config)  
**Fix Time:** 5 min  
**Action:** Apply STAGING_NGINX_QUICK_FIX.md

### 3️⃣ Health Checks Redirecting to HTTPS
**Status:** 🟡 MEDIUM  
**Why:** All HTTP requests redirect to HTTPS (even health checks)  
**Fix Time:** 2 min  
**Action:** Add /health endpoint before redirect rule

---

## ⚡ Quick Fix (5 Minutes)

### For Staging Server:
```bash
# 1. SSH in
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.78.84.41

# 2. Backup current config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak

# 3. Create reverse proxy config
sudo tee /etc/nginx/sites-available/lms > /dev/null <<'EOF'
upstream docker_backend {
    server localhost:8000 max_fails=3 fail_timeout=30s;
}

upstream docker_frontend {
    server localhost:80 max_fails=3 fail_timeout=30s;
}

server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 500M;
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    location /static/ {
        proxy_pass http://docker_backend;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 1y;
        access_log off;
    }
    
    location /media/ {
        proxy_pass http://docker_backend;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        expires 1y;
    }
    
    location /api/ {
        proxy_pass http://docker_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    location / {
        proxy_pass http://docker_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 4. Enable config
sudo rm /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/lms

# 5. Test
sudo nginx -t

# 6. Reload
sudo systemctl reload nginx

# 7. Verify
curl http://16.78.84.41/health
curl http://16.78.84.41/api/v1/health/
```

---

## 📊 Nginx Config Locations

| Environment | File | Status | Issue |
|---|---|---|---|
| **Local** | `frontend/nginx.conf` | ✅ Working | None |
| **Local** | `docker-compose.yml` | ✅ Working | None |
| **Staging** | `/etc/nginx/sites-available/default` | ❌ Wrong | Default config, not LMS |
| **Staging** | `docker-compose.yml` on server | ✅ Working | Containers OK |
| **Production** | Unknown | ❌ Unknown | Port 3030 issue |

---

## 🔍 Diagnostic Commands

```bash
# Check Nginx status on staging
sudo systemctl status nginx

# View current config
sudo cat /etc/nginx/sites-enabled/default

# Test syntax
sudo nginx -t

# View error log
sudo tail -f /var/log/nginx/error.log

# Check what's listening on ports
sudo ss -tlnp | grep -E "(80|443|3030|8000)"

# Docker status
docker ps
docker logs lms_frontend | tail -10
docker logs lms_backend | tail -10

# Test connectivity
curl -v http://localhost/health
curl -v http://16.78.84.41/health
```

---

## 🎯 What Each File Does

### `docker-compose.yml` (Local)
- Orchestrates all containers
- Maps ports: 80→80, 443→443, 8000→8000
- Networks containers together
- **Status:** ✅ Correct

### `frontend/nginx.conf` (Production Template)
- Runs inside frontend Docker container
- Handles SSL/TLS
- Proxies /api to backend
- Serves React SPA
- **Status:** ✅ Correct, but health check issue

### `/etc/nginx/sites-available/default` (Staging Host)
- Currently has default Ubuntu config
- Serves 404 for everything
- **Status:** ❌ Needs replacement with reverse proxy

### New Config Needed (Staging Host)
- `/etc/nginx/sites-available/lms`
- Should proxy to Docker containers
- Should listen on 80
- **Status:** ⏳ Needs creation (see quick fix above)

---

## 📈 Health Check Architecture

### Current (Broken):
```
Browser → /health
   ↓
HTTP Server on :80 (frontend/nginx.conf)
   ↓
Redirect to HTTPS (301)
   ↓
HTTPS Server on :443
   ↓
Return 200
```
**Problem:** Health check has unnecessary redirect

### Fixed:
```
Browser → /health
   ↓
HTTP Server on :80 (frontend/nginx.conf)
   ↓
Return 200 immediately
   ↓
No redirect
```

---

## ✅ Verification Steps

After applying fixes, run these in order:

```bash
# 1. Verify Nginx config syntax
sudo nginx -t
# Expected: "syntax is ok" and "test is successful"

# 2. Check service is running
sudo systemctl status nginx
# Expected: "active (running)"

# 3. Test health endpoint
curl http://16.78.84.41/health
# Expected: "healthy" with status 200

# 4. Test API endpoint
curl http://16.78.84.41/api/v1/health/
# Expected: JSON response with status 200

# 5. Test frontend
curl http://16.78.84.41/
# Expected: HTML response or 301 redirect (if SSL involved)

# 6. Check logs
sudo tail -20 /var/log/nginx/access.log
# Expected: GET requests with 200 status
```

---

## 🚨 Rollback Plan

If something goes wrong:

```bash
# Restore backup
sudo cp /etc/nginx/sites-available/default.bak /etc/nginx/sites-available/default
sudo rm /etc/nginx/sites-enabled/lms
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📚 Documentation Files

Read in this order:

1. **NGINX_ISSUES_EXECUTIVE_SUMMARY.md** (← Start here)
2. **STAGING_NGINX_QUICK_FIX.md** (← For immediate fix)
3. **NGINX_CONFIGURATION_DIAGNOSTIC_REPORT.md** (← For deep dive)
4. **PRODUCTION_PORT_3030_ANALYSIS.md** (← For production issue)

---

## 💡 Key Takeaways

| Point | Detail |
|-------|--------|
| **Local** | ✅ Working fine, no changes needed |
| **Staging** | 🟠 Docker containers OK, host Nginx needs reverse proxy |
| **Production** | 🔴 Not responding, port 3030 issue must be investigated |
| **Fix Time** | 5-10 min for staging, 30 min for production investigation |
| **Risk Level** | Low (simple Nginx config change) |
| **Rollback** | Easy (backup created, can restore) |

---

## 📞 Next Steps

1. **Right Now:** Follow "Quick Fix (5 Minutes)" above for staging
2. **After Verifying:** Test all endpoints
3. **Tomorrow:** Investigate production port 3030 issue
4. **This Week:** Apply production fix

---

**Time Estimate:** 5 min (staging) + 30 min (production) = 35 min total  
**Difficulty:** Easy  
**Critical:** Yes - production needs immediate attention  
**Ready:** Yes - all solutions documented
