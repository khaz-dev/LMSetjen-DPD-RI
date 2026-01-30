# LMSetjen DPD RI - Ubuntu Production Deployment Guide

**Domain:** `lms.dpd.go.id`  
**Server OS:** Ubuntu 20.04 LTS (or later)  
**Web Server:** Apache 2.4 with SSL/TLS  
**Date:** January 2026  
**Status:** Production Ready

---

## 📋 Quick Start

### Prerequisites Checklist

Before starting, ensure you have:

- [ ] Ubuntu 20.04 LTS or later installed
- [ ] SSH access to production server
- [ ] Root or sudo privileges
- [ ] Domain `lms.dpd.go.id` pointing to server IP
- [ ] SSL certificate (Let's Encrypt or similar)
- [ ] PostgreSQL 17 installed on server
- [ ] Docker and Docker Compose installed
- [ ] Git installed
- [ ] At least 10GB free disk space
- [ ] Minimum 4GB RAM (8GB recommended)

### One-Command Deployment

```bash
# Connect to production server
ssh ubuntu@lms.dpd.go.id

# Clone the repository
git clone https://github.com/khaz-dev/LMSetjen-DPD-RI.git /home/ubuntu/lmsetjen-app
cd /home/ubuntu/lmsetjen-app

# Run deployment script
chmod +x scripts/deploy-ubuntu.sh
./scripts/deploy-ubuntu.sh fresh
```

That's it! The script handles everything else.

---

## 🏗️ What the Deployment Script Does

### Automated Phases

1. **Prerequisite Checks** (Phase 0)
   - Verifies Ubuntu OS
   - Checks for required tools (Docker, PostgreSQL, Git, etc.)
   - Validates disk space and database connectivity

2. **Environment Verification** (Phase 1)
   - Validates `.env.production` configuration
   - Checks all required variables present
   - Verifies domain and port settings

3. **Safety Backups** (Phase 2)
   - Backs up PostgreSQL database
   - Backs up media files
   - Saves Docker Compose configuration
   - Creates rollback point

4. **Code Deployment** (Phase 3)
   - Clones or updates from GitHub (main branch)
   - Verifies branch and commit
   - Logs deployment commit for reference

5. **Container Build** (Phase 4)
   - Builds frontend Docker image
   - Builds backend Docker image
   - Optimizes layer caching

6. **Container Start** (Phase 5)
   - Starts all Docker services
   - Shows container status

7. **Database Setup** (Phase 6)
   - Runs Django migrations
   - Collects static files
   - Initializes database schema

8. **Health Checks** (Phase 7)
   - Verifies backend API health
   - Checks frontend accessibility
   - Tests database connectivity

9. **Feature Verification** (Phase 8)
   - Tests key API endpoints
   - Verifies search system
   - Confirms all systems operational

---

## 📁 Directory Structure on Production Server

```
/home/ubuntu/lmsetjen-app/
├── scripts/
│   └── deploy-ubuntu.sh          ← Main deployment script
├── backend/                       ← Django application
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env                       ← Dev config (not used in prod)
│   └── ...
├── frontend/                      ← React application
│   ├── src/
│   ├── public/
│   ├── dist/                      ← Built assets (after build)
│   └── .env.production            ← Production env config
├── docker/
├── .env.production                ← Production environment variables
├── docker-compose.production.yml  ← Container configuration
├── backups/                       ← Automatic backups directory
│   ├── deployment_20260130_*.log
│   ├── database_*.sql.gz
│   └── media_*.tar.gz
└── README.md
```

---

## 🔧 Configuration: .env.production

The `.env.production` file should contain:

```bash
# Database Configuration
DB_NAME=lms_db
DB_USER=postgres
DB_NAME=<secure_password>
DB_HOST=localhost
DB_PORT=5432

# Django Settings
DEBUG=False
SECRET_KEY=<random_secure_key>
ALLOWED_HOSTS=lms.dpd.go.id,www.lms.dpd.go.id
DJANGO_LOG_LEVEL=INFO

# URLs
FRONTEND_SITE_URL=https://lms.dpd.go.id
BACKEND_SITE_URL=https://lms.dpd.go.id
VITE_API_BASE_URL=http://localhost:8001

# Redis (Docker internal)
REDIS_URL=redis://:redis_password@redis:6381/0

# OAuth & External Services
GOOGLE_CLIENT_ID=<your_client_id>
GOOGLE_CLIENT_SECRET=<your_client_secret>
GOOGLE_OAUTH_REDIRECT_URI=https://lms.dpd.go.id/auth/google/

# Email Configuration (optional)
SENDGRID_API_KEY=<optional>
FROM_EMAIL=noreply@lms.dpd.go.id
```

### Key Changes from Development

| Setting | Development | Production |
|---------|-------------|-----------|
| `DEBUG` | `True` | `False` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | `lms.dpd.go.id,www.lms.dpd.go.id` |
| `FRONTEND_SITE_URL` | `http://localhost:3000` | `https://lms.dpd.go.id` |
| `BACKEND_SITE_URL` | `http://localhost:9000` | `https://lms.dpd.go.id` |
| `SECURE_SSL_REDIRECT` | `False` | `True` |

---

## 🐳 Docker Compose Configuration

The `docker-compose.production.yml` orchestrates:

### Backend Service
- Image: Django application with Gunicorn
- Port: 8001 (internal, proxied by Apache)
- Database: PostgreSQL (host machine)
- Cache: Redis (Docker)

### Frontend Service
- Image: Node.js with 'serve' package
- Port: 5174 (internal, proxied by Apache)
- Static files: Built React app

### Redis Service
- Image: redis:7-alpine
- Port: 6380 (internal only)
- Used for caching and sessions

### PostgreSQL
- Runs on host machine (not Docker)
- Port: 5432
- Database: `lms_db`

---

## 🌐 Apache Configuration

Apache acts as a reverse proxy, handling SSL/TLS and routing requests.

### Apache Virtual Host Configuration

Create `/etc/apache2/sites-available/lms.dpd.go.id.conf`:

```apache
<VirtualHost *:80>
    ServerName lms.dpd.go.id
    ServerAlias www.lms.dpd.go.id
    
    # Redirect HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

<VirtualHost *:443>
    ServerName lms.dpd.go.id
    ServerAlias www.lms.dpd.go.id
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/lms.dpd.go.id/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/lms.dpd.go.id/privkey.pem
    SSLProtocol TLSv1.2 TLSv1.3
    SSLCipherSuite HIGH:!aNULL:!MD5
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyRequests Off
    
    # Frontend (React app on port 5174)
    ProxyPass / http://localhost:5174/
    ProxyPassReverse / http://localhost:5174/
    
    # Backend API (Django on port 8001)
    ProxyPass /api http://localhost:8001/api
    ProxyPassReverse /api http://localhost:8001/api
    
    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/(.*)$ "ws://localhost:5174/$1" [P,L]
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/lms.dpd.go.id-error.log
    CustomLog ${APACHE_LOG_DIR}/lms.dpd.go.id-access.log combined
</VirtualHost>
```

### Enable Apache Modules and Site

```bash
# Enable required modules
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod rewrite
sudo a2enmod ssl
sudo a2enmod headers

# Enable the site
sudo a2ensite lms.dpd.go.id.conf

# Disable default site if needed
sudo a2dissite 000-default.conf

# Test configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

---

## 🔐 SSL/TLS Certificate Setup

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-apache

# Generate certificate
sudo certbot certonly --apache -d lms.dpd.go.id -d www.lms.dpd.go.id

# Auto-renewal (automatic with certbot)
sudo systemctl enable certbot.timer
```

### Manual Certificate

If using a custom certificate:

1. Place fullchain.pem at: `/etc/letsencrypt/live/lms.dpd.go.id/fullchain.pem`
2. Place privkey.pem at: `/etc/letsencrypt/live/lms.dpd.go.id/privkey.pem`
3. Restart Apache

---

## 📊 Deployment Modes

### Fresh Installation

```bash
./scripts/deploy-ubuntu.sh fresh
```

Installs everything from scratch:
- Clones repository
- Builds images
- Creates database
- Runs migrations
- Starts all services

### Update Existing System

```bash
./scripts/deploy-ubuntu.sh update
```

Updates running system:
- Pulls latest code from main branch
- Backs up current state
- Rebuilds images
- Applies migrations
- Restarts services
- Health checks

### Emergency Rollback

```bash
./scripts/deploy-ubuntu.sh rollback
```

Reverts to previous working version:
- Restores code to last commit
- Rebuilds containers
- Restarts services
- Verifies health

### Dry Run (Test)

```bash
./scripts/deploy-ubuntu.sh update --dry-run
```

Tests deployment without making changes:
- Validates configuration
- Checks prerequisites
- Shows what would happen
- No containers modified

---

## 📈 Monitoring and Maintenance

### Check Deployment Status

```bash
# View running containers
docker ps

# Check container logs
docker logs lms_backend_prod
docker logs lms_frontend_prod
docker logs lms_redis_prod

# View deployment logs
tail -f /home/ubuntu/lmsetjen-app/backups/deployment_*.log
```

### Database Backups

Automatic backups are created in `/home/ubuntu/lmsetjen-app/backups/`:

```bash
# List backups
ls -lh /home/ubuntu/lmsetjen-app/backups/

# Manual backup
pg_dump -U postgres lms_db > ~/lms_db_backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U postgres lms_db < ~/lms_db_backup_20260130.sql
```

### Monitoring API Health

```bash
# Check backend health
curl https://lms.dpd.go.id/api/v1/health/

# Check frontend
curl https://lms.dpd.go.id

# Monitor logs
docker logs -f lms_backend_prod
```

---

## 🆘 Troubleshooting

### Issue: Deployment Script Fails

**Solution:**
1. Check logs: `cat /home/ubuntu/lmsetjen-app/backups/deployment_*.log`
2. Verify prerequisites: `./scripts/deploy-ubuntu.sh --help`
3. Run rollback: `./scripts/deploy-ubuntu.sh rollback`
4. Check disk space: `df -h`

### Issue: Backend Returning 502 Bad Gateway

**Cause:** Backend container crashed or not running

**Solution:**
```bash
# Check container status
docker ps | grep backend

# View backend logs
docker logs lms_backend_prod

# Restart backend
docker-compose -f docker-compose.production.yml restart backend
```

### Issue: SSL Certificate Expired

**Solution:**
```bash
# Renew certificate
sudo certbot renew

# If manual certificate, replace files:
# /etc/letsencrypt/live/lms.dpd.go.id/fullchain.pem
# /etc/letsencrypt/live/lms.dpd.go.id/privkey.pem
sudo systemctl restart apache2
```

### Issue: Database Connection Error

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
psql -U postgres -d lms_db

# Check Docker environment variables
docker-compose -f docker-compose.production.yml config | grep DB_
```

### Issue: Frontend Not Loading

**Solution:**
```bash
# Check frontend container
docker logs lms_frontend_prod

# Rebuild frontend
docker-compose -f docker-compose.production.yml build frontend
docker-compose -f docker-compose.production.yml up -d frontend

# Clear browser cache
```

---

## 🚀 Scheduled Deployment Updates

### Set Up Automatic Deployments (Optional)

Create a cron job for regular updates:

```bash
# Edit crontab
sudo crontab -e

# Add this line for weekly updates (Sunday 2 AM)
0 2 * * 0 cd /home/ubuntu/lmsetjen-app && ./scripts/deploy-ubuntu.sh update >> backups/cron_deployment.log 2>&1
```

### Manual Deployment Trigger

```bash
# SSH to server and deploy
ssh ubuntu@lms.dpd.go.id
cd /home/ubuntu/lmsetjen-app
./scripts/deploy-ubuntu.sh update
```

---

## 📝 Maintenance Checklist

- [ ] Verify domain DNS points to correct IP
- [ ] SSL certificate installed and valid
- [ ] PostgreSQL user and database created
- [ ] Docker and Docker Compose installed
- [ ] `.env.production` configured with secure values
- [ ] Apache virtual host configured
- [ ] Apache modules enabled
- [ ] Firewall allows ports 80, 443
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured
- [ ] Incident response plan documented

---

## 📞 Support

For issues with:
- **Deployment Script:** Check `DEPLOYMENT_SCRIPTS_AUDIT.md`
- **Configuration:** Check `.env.production` setup
- **Docker Issues:** Check Docker logs
- **Apache Issues:** Check `/var/log/apache2/error.log`
- **Database Issues:** Check PostgreSQL logs

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
