# 🚨 Production Deployment Fix - SSL & Database Issues

**Issue Found**: 
1. Frontend container restarting due to missing SSL certificates
2. PostgreSQL healthcheck using wrong database name

---

## 🔧 Quick Fix Commands

Run these commands on your production server:

```bash
# 1. Stop all containers
docker compose -f docker-compose.prod.yml down

# 2. Check your .env file for database name
cat .env | grep DB_NAME

# 3. If DB_NAME is different from "lms_user", you need to either:
#    a) Fix the healthcheck in docker-compose.prod.yml
#    OR
#    b) Update .env to match expected database name

# 4. For SSL certificates, you have 2 options:
```

---

## Option A: Disable HTTPS Temporarily (Quick Fix)

This will get your site running on HTTP first, then you can add SSL later.

### Step 1: Update Frontend Nginx Config

On your server, edit the frontend nginx config to remove SSL:

```bash
cd ~/LMSetjen-DPD-RI

# Create a temporary HTTP-only config
cat > docker/frontend/nginx/default.conf.http-only << 'EOF'
server {
    listen 80;
    server_name lmsetjendpdri.duckdns.org;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_comp_level 6;
    
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
    
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /media/ {
        proxy_pass http://backend:8000;
    }
    
    location /static/ {
        proxy_pass http://backend:8000;
    }
}
EOF

# Backup current config
cp docker/frontend/nginx/default.conf docker/frontend/nginx/default.conf.backup

# Replace with HTTP-only version
cp docker/frontend/nginx/default.conf.http-only docker/frontend/nginx/default.conf
```

### Step 2: Fix PostgreSQL Healthcheck

Edit `docker-compose.prod.yml`:

```bash
nano docker-compose.prod.yml
```

Find the postgres healthcheck section and change it from:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
```

To:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
```

### Step 3: Rebuild and Start

```bash
# Rebuild frontend with new config
docker compose -f docker-compose.prod.yml build --no-cache frontend

# Start everything
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# Monitor logs
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## Option B: Generate SSL Certificates (Proper Fix)

If you want HTTPS working, you need to generate Let's Encrypt certificates:

### Step 1: Install Certbot

```bash
sudo apt update
sudo apt install certbot -y
```

### Step 2: Stop Nginx Temporarily

```bash
docker compose -f docker-compose.prod.yml stop nginx frontend
```

### Step 3: Generate Certificate

```bash
sudo certbot certonly --standalone \
  -d lmsetjendpdri.duckdns.org \
  --non-interactive \
  --agree-tos \
  -m your-email@example.com
```

### Step 4: Copy Certificates to Docker Volume

```bash
# Create letsencrypt directory if doesn't exist
sudo mkdir -p /etc/letsencrypt

# Verify certificates exist
sudo ls -la /etc/letsencrypt/live/lmsetjendpdri.duckdns.org/
```

### Step 5: Update docker-compose.prod.yml

Add volume mount for frontend service:

```yaml
frontend:
  # ... existing config ...
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

### Step 6: Restart Services

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

---

## 🔍 Verification

### Check Frontend is Running

```bash
# Should show "Up" status
docker compose -f docker-compose.prod.yml ps frontend

# Check logs (should NOT show SSL errors)
docker compose -f docker-compose.prod.yml logs frontend | tail -20
```

### Check Database Connection

```bash
# Should NOT show "database does not exist" errors
docker compose -f docker-compose.prod.yml logs postgres | grep FATAL | tail -5
```

### Test Site

**HTTP (Option A)**:
```
http://your-server-ip
```

**HTTPS (Option B)**:
```
https://lmsetjendpdri.duckdns.org
```

---

## 📊 Expected Results

### Before Fix:
```
lms_frontend_prod   Restarting (1) 49 seconds ago
lms_postgres_prod   FATAL:  database "lms_user" does not exist
```

### After Fix:
```
lms_frontend_prod   Up 2 minutes (healthy)
lms_postgres_prod   Up 3 minutes (healthy)
```

---

## 🆘 If Still Having Issues

### Frontend Still Crashing?

```bash
# Check nginx config syntax
docker compose -f docker-compose.prod.yml exec frontend nginx -t

# View full logs
docker compose -f docker-compose.prod.yml logs frontend --tail=100
```

### Database Issues?

```bash
# Check what databases exist
docker compose -f docker-compose.prod.yml exec postgres psql -U lms_user -l

# Check .env database name
grep DB_NAME .env
```

---

## 🎯 Recommended Approach

**For fastest deployment (5 minutes)**:
1. Use **Option A** (HTTP-only)
2. Fix database healthcheck
3. Get site running
4. Add SSL later with Option B

**For production-ready (30 minutes)**:
1. Use **Option B** (with SSL)
2. Fix database healthcheck
3. Complete setup properly

---

## 📝 After Applying Fix

Once frontend is running:

1. Access your site (HTTP or HTTPS depending on option chosen)
2. Clear browser cache (Ctrl + Shift + R)
3. Test instructor pages
4. Verify new UI/UX improvements are live

---

**Need help?** Run these diagnostic commands:

```bash
# Full system status
docker compose -f docker-compose.prod.yml ps

# Check all logs
docker compose -f docker-compose.prod.yml logs --tail=50

# Test database connection
docker compose -f docker-compose.prod.yml exec backend python manage.py dbshell

# Test frontend nginx
docker compose -f docker-compose.prod.yml exec frontend nginx -t
```
