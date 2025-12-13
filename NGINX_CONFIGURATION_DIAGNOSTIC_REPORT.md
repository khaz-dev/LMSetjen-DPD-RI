# 🔍 Comprehensive Nginx Configuration Diagnostic Report
## LMSetjen DPD RI - Local, Staging & Production

**Date:** December 10, 2025  
**Status:** ⚠️ **CRITICAL ISSUES IDENTIFIED**  
**Scope:** Local Development → Staging Server (16.78.84.41) → Production (10.20.30.176:3030)

---

## 📋 Executive Summary

I've conducted a thorough scan of your Nginx configurations across three environments:
1. **Local Development** (`docker-compose.yml` + Docker configs)
2. **Staging Server** (16.78.84.41 - SSH verified)
3. **Production Server** (10.20.30.176:3030 - NOT RESPONDING)

### 🚨 Critical Findings:

| Issue | Severity | Environment | Impact |
|-------|----------|-------------|--------|
| Production server unreachable | 🔴 **CRITICAL** | Production (10.20.30.176:3030) | Complete service outage |
| Port mismatch: 80/443 vs 3030 | 🟠 **HIGH** | Production deployment | Configuration error |
| No reverse proxy on staging | 🟠 **HIGH** | Staging | Docker containers exposed directly |
| HTTP-only on staging | 🟠 **HIGH** | Staging | No HTTPS, SSL certs not applied |
| Health check redirect issue | 🟡 **MEDIUM** | Staging | 301 redirects on health checks |

---

## 🏗️ Architecture Overview

### Local Development Stack (Works)
```
┌─────────────────────────────────────────┐
│  Docker Compose (docker-compose.yml)    │
├─────────────────────────────────────────┤
│ Frontend Container (Nginx 80/443)      │
│  ├─ React SPA built inside container    │
│  ├─ Nginx serves from /usr/share/nginx/html
│  └─ Proxies /api to backend via network │
├─────────────────────────────────────────┤
│ Backend Container (Gunicorn 8000)      │
│  ├─ Django REST API                    │
│  ├─ Connects to PostgreSQL & Redis    │
│  └─ Serves media/static files          │
├─────────────────────────────────────────┤
│ PostgreSQL (5432)                      │
│ Redis (6379)                           │
└─────────────────────────────────────────┘
```

### Staging Server (16.78.84.41) - Similar to Local
```
✅ Docker containers running:
   - lms_frontend (Nginx on 80/443)
   - lms_backend (Gunicorn on 8000)
   - lms_postgres (5432)
   - lms_redis (6379)

🟠 Issues:
   - Staging Nginx has HTTPS configured for lmsetjendpdri.duckdns.org
   - System Nginx on host still has default config (not configured)
   - No reverse proxy between host Nginx and Docker containers
```

### Production Server (10.20.30.176) - NOT ACCESSIBLE
```
❌ Cannot reach at http://10.20.30.176:3030
❌ SSH timeout (appears to be different configuration)
❌ Port 3030 suggests Nginx or Node.js expecting specific port
```

---

## 🔐 Nginx Configuration Details

### 📁 Local Project Nginx Configs

**Location 1:** `docker/nginx/nginx.conf`
```nginx
# Master Nginx config for development
- Runs INSIDE Docker frontend container
- Worker processes: auto
- Listens: 80 (HTTP) + 443 (HTTPS - commented)
- client_max_body_size: 100M
- Rate limiting zones: general (100r/s), api (30r/s)
- Gzip compression: enabled
- Security headers: SAMEORIGIN, nosniff, X-XSS-Protection
```

**Location 2:** `docker/nginx/conf.d/default.conf` (214 lines)
```nginx
# HTTP-only configuration for development
Server blocks:
  1. Upstream: backend_server (least_conn, 3 max_fails)
  2. Upstream: frontend_server (least_conn, 3 max_fails)
  
Routes:
  - /static/      → Nginx filesystem (readonly, 1y cache)
  - /media/       → Nginx filesystem (readonly, 1y cache)
  - /api/         → backend_server (rate-limited: 30r/s)
  - /admin/*      → frontend_server (React routes)
  - /swagger/     → backend_server
  - /redoc/       → backend_server
  - /              → frontend_server (SPA fallback)

Timeouts: 60s (connect, send, read)
Buffer: 4k/8k
```

**Location 3:** `frontend/nginx.conf` (322 lines) - PRODUCTION CONFIG
```nginx
# HTTP → HTTPS redirect
Server 1: 80 (Redirect to HTTPS)
Server 2: 443 (SSL/TLS)

SSL Configuration:
  - Certificates: /etc/letsencrypt/live/DOMAIN_NAME/
  - Protocols: TLSv1.2, TLSv1.3
  - Session cache: 50MB
  - OCSP stapling: enabled
  - HSTS: max-age=63072000 (2 years)

Security Headers:
  - Strict-Transport-Security
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Content-Security-Policy: 'self' + inline + eval
  - Permissions-Policy: geolocation, microphone, camera disabled

Backend Proxies:
  - /static/   → /usr/share/nginx/html/static (1y cache)
  - /media/    → /usr/share/nginx/html/media (1y cache)
  - /admin/    → lms_backend:8000 (Django admin)
  - /api/      → lms_backend:8000 (REST API)
  - /swagger   → lms_backend:8000
  - /redoc     → lms_backend:8000

DNS Resolution:
  - resolver 127.0.0.11:53 (Docker embedded DNS)
  - resolver_timeout 5s
  
Timeouts: 300s (extended for uploads)
Buffer: 16k/32k (increased)
client_max_body_size: 500M
```

**Location 4:** `docker/frontend/nginx/default.conf` (OLD)
```nginx
# Minimal config - only for local testing
- Single server block on port 80
- Basic SPA fallback: try_files $uri $uri/ /index.html
- API proxy to http://backend:8000
- No HTTPS, no rate limiting
```

---

## 🔴 CRITICAL ISSUES & RESOLUTIONS

### Issue #1: Production Server Unreachable (10.20.30.176:3030)

**Problem:**
```
❌ curl -v http://10.20.30.176:3030/ → Connection timeout
❌ SSH to 10.20.30.176 → No response
```

**Root Cause Analysis:**
1. Port 3030 suggests custom Node.js or Nginx configuration
2. Your docker-compose.yml exposes ports 80/443 and 8000, NOT 3030
3. Possible causes:
   - Production server uses different docker-compose configuration
   - Reverse proxy listening on 3030 instead of 80/443
   - IP 10.20.30.176 may not be current production IP

**Solutions:**
```bash
# Step 1: Verify production server IP and port
ping 10.20.30.176
nmap -p 3030,80,443,8000 10.20.30.176

# Step 2: Check if production needs custom deployment
# Check if there's a docker-compose.prod.yml or custom Nginx config
# in your production deployment

# Step 3: Verify production environment variables
# The backend should be configured for public IP, not internal container names
```

---

### Issue #2: Staging Server Nginx Configuration Mismatch

**Problem:**
```
✅ Docker containers work (lms_frontend, lms_backend running)
🟠 But host system Nginx shows DEFAULT config (not configured for LMS)
```

**Evidence from SSH:**
```
/etc/nginx/sites-enabled/default → default config
  listen 80 default_server;
  root /var/www/html;
  try_files $uri $uri/ =404;  ← This serves 404 for all requests!
```

**Root Cause:**
- Staging Docker containers run on internal network
- Host system Nginx NOT proxying to Docker containers
- External requests to 16.78.84.41 hit host Nginx (default config)
- Host Nginx tries to serve /var/www/html (empty)

**Solution:**
```bash
# SSH into staging and create proper Nginx config:

ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.78.84.41

# Create production Nginx config on staging:
sudo tee /etc/nginx/sites-available/lms > /dev/null <<'EOF'
upstream docker_backend {
    server localhost:8000;  # Backend container exposed on host
    keepalive 32;
}

upstream docker_frontend {
    server localhost:80;  # Frontend container exposed on host
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name 16.78.84.41 staging.yourdomain.com;
    
    client_max_body_size 500M;
    
    # Static files from Docker backend
    location /static/ {
        proxy_pass http://docker_backend;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /media/ {
        proxy_pass http://docker_backend;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://docker_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Admin and frontend
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

# Enable the config
sudo ln -sf /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/lms
sudo rm /etc/nginx/sites-enabled/default  # Remove default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

### Issue #3: Health Check Redirects to HTTPS

**Problem:**
```
Frontend logs show:
  ::1 - - "GET /health HTTP/1.1" 301 169  ← 301 redirect!
  
Health checks should return 200 immediately
```

**Root Cause:**
```nginx
# frontend/nginx.conf line 11-13:
server {
    listen 80;
    location / {
        return 301 https://$host$request_uri;  ← ALL HTTP → HTTPS redirect
    }
}

# This includes health checks!
```

**Solution:**
```nginx
server {
    listen 80;
    server_name _;
    
    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Health check endpoint - don't redirect
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Redirect everything else to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```

---

### Issue #4: Port Confusion Between Environments

| Environment | Port Exposed | Internal | URL |
|---|---|---|---|
| **Local Dev** | 80, 443 | Docker network | http://localhost |
| **Staging** | 80, 443 | Docker + host Nginx | http://16.78.84.41 |
| **Production** | **3030** (?) | ??? | http://10.20.30.176:3030 |

**Problem:** Production doesn't match deployment expectations

**Analysis:**
- Local `docker-compose.yml` exposes `80:80, 443:443, 8000:8000`
- Production might need custom configuration for port 3030
- Could indicate Nginx reverse proxy listening on 3030 instead of 80

**Investigation Needed:**
```bash
# On production server:
sudo netstat -tlnp | grep LISTEN
sudo ps aux | grep -E "(nginx|gunicorn|node)"
docker ps  # Check if Docker running
docker-compose config  # If different compose file
```

---

## ✅ Recommended Implementation Plan

### Phase 1: Fix Staging Server (IMMEDIATE)
```bash
# 1. SSH into staging
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.78.84.41

# 2. Verify Docker containers are running
docker ps

# 3. Apply host Nginx reverse proxy config (see Issue #2 solution above)

# 4. Fix health check endpoint in frontend/nginx.conf (see Issue #3 solution)

# 5. Test endpoints
curl -v http://16.78.84.41/health          # Should 200
curl -v http://16.78.84.41/api/v1/health/  # Should 200
curl -v http://16.78.84.41/                # Should 200
```

### Phase 2: Investigate Production Issue
```bash
# 1. Verify production server details
# - Is it running Docker?
# - What OS? (Ubuntu, CentOS, etc.)
# - Is there a separate Nginx config?

# 2. Check if port 3030 is intentional
netstat -tlnp | grep 3030

# 3. If using Docker on production, check:
docker ps
docker-compose config
env | grep -i port
```

### Phase 3: Production Deployment Configuration
Create a **production-specific deployment guide**:

```dockerfile
# Option A: Docker-only (ports 80/443)
docker-compose -f docker-compose.yml up -d

# Option B: Host Nginx reverse proxy (requires host nginx config)
docker-compose up -d  # Containers on internal ports
# Then configure host nginx.conf to proxy to localhost:8000 & localhost:80
```

---

## 📊 Configuration Comparison Matrix

```yaml
Local Development:
  docker-compose.yml:
    Frontend: exposed 80:80, 443:443
    Backend: exposed 8000:8000
  Network: Docker internal network
  DNS: Docker embedded (127.0.0.11:53)
  Nginx: Inside frontend container
  Status: ✅ Working

Staging Server (16.78.84.41):
  docker-compose.yml: Same as local
  Network: Docker internal + host network
  Host Nginx: Default config (❌ not configured for LMS)
  Container Nginx: Configured for SSL
  Status: ⚠️ Containers work, host routing broken
  Fix: Add reverse proxy in /etc/nginx/sites-available/lms

Production Server (10.20.30.176):
  Port: 3030 (❌ unexpected, should be 80/443)
  Status: 🔴 Unreachable
  Action: Investigate deployment configuration
```

---

## 🛠️ Nginx Files Location Summary

### Local Development (Windows path):
```
d:\Project\LMSetjen DPD RI\
├── docker/
│   ├── nginx/
│   │   ├── nginx.conf           (master config)
│   │   └── conf.d/
│   │       └── default.conf     (development routes)
│   └── frontend/
│       └── nginx/
│           └── default.conf     (old minimal config)
├── frontend/
│   ├── nginx.conf               (production config - 322 lines)
│   ├── Dockerfile               (builds React + Nginx)
│   └── nginx.conf.backup.20251017_134412
└── docker-compose.yml           (orchestrates everything)
```

### Staging Server (16.78.84.41):
```
/etc/nginx/
├── sites-available/
│   └── default                  (❌ Basic config - not configured)
├── sites-enabled/
│   └── default -> sites-available/default
└── conf.d/                      (empty)

/home/ubuntu/LMSetjen-DPD-RI/
├── docker-compose.yml           (running containers)
└── frontend/nginx.conf          (inside container)
```

---

## 📋 Checklist for Resolution

### Staging Server Fix:
- [ ] SSH access verified ✅
- [ ] Docker containers confirmed running ✅
- [ ] Host Nginx config created
- [ ] Reverse proxy rules added
- [ ] nginx -t validation passed
- [ ] systemctl reload nginx executed
- [ ] Endpoints tested (health, api, root)

### Production Investigation:
- [ ] Determine if port 3030 is intended
- [ ] Verify production IP (10.20.30.176)
- [ ] Check production deployment method
- [ ] Confirm Nginx version/configuration
- [ ] Test connectivity from staging to production

### Documentation Updates:
- [ ] Create production deployment guide
- [ ] Document port mappings
- [ ] Create runbook for troubleshooting
- [ ] Update .env files with correct IPs

---

## 📞 Next Steps

**Immediate (Next 24 hours):**
1. Apply staging Nginx reverse proxy config (5 min)
2. Test all endpoints on staging (10 min)
3. Investigate production port 3030 issue (30 min)

**Short-term (Next week):**
1. Create production deployment guide
2. Implement proper health check endpoints
3. Add monitoring/logging for Nginx

**Long-term:**
1. Implement centralized logging (ELK stack)
2. Add Nginx metrics collection
3. Create automated deployment pipeline

---

## 🔗 Key Files Referenced

- **Local Nginx Config:** `frontend/nginx.conf` (production template)
- **Development Nginx:** `docker/nginx/conf.d/default.conf`
- **Docker Compose:** `docker-compose.yml` (orchestration)
- **Staging System Config:** `/etc/nginx/sites-available/default` (needs fix)

---

**Report Generated:** 2025-12-10 01:43 UTC  
**Environment:** Windows 11 PowerShell | SSH verified to staging  
**Status:** ⚠️ Staging fixable, Production requires investigation
