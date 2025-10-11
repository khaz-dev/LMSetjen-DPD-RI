# 🚀 Deployment Guide - LMSetjen DPD RI

Complete guide untuk deploy LMSetjen DPD RI ke production.

---

## 📋 Pre-Deployment Checklist

### ✅ Backend Checklist
- [ ] Environment variables configured
- [ ] Database migrated
- [ ] Static files collected
- [ ] Media folder configured
- [ ] DEBUG = False
- [ ] ALLOWED_HOSTS configured
- [ ] SECRET_KEY changed
- [ ] CORS settings updated
- [ ] Email settings configured
- [ ] Backup strategy in place

### ✅ Frontend Checklist
- [ ] API URL updated
- [ ] Build tested locally
- [ ] Environment variables set
- [ ] Assets optimized
- [ ] Analytics configured (if needed)
- [ ] Error tracking setup (if needed)

---

## 🖥️ Backend Deployment (Django)

### Option 1: VPS Deployment (Ubuntu)

#### 1. Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python
sudo apt install python3 python3-pip python3-venv -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y
```

#### 2. Setup PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE lmsetjen_db;
CREATE USER lmsetjen_user WITH PASSWORD 'strong_password_here';
ALTER ROLE lmsetjen_user SET client_encoding TO 'utf8';
ALTER ROLE lmsetjen_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE lmsetjen_user SET timezone TO 'Asia/Jakarta';
GRANT ALL PRIVILEGES ON DATABASE lmsetjen_db TO lmsetjen_user;
\q
```

#### 3. Setup Project

```bash
# Create project directory
sudo mkdir -p /var/www/lmsetjen
cd /var/www/lmsetjen

# Clone repository
git clone https://github.com/khaz-dev/LMSetjen-DPD-RI.git .

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
cd backend
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

#### 4. Configure Django Settings

Create `.env` file in backend directory:

```env
SECRET_KEY=your-super-secret-key-here-change-this
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DATABASE_URL=postgresql://lmsetjen_user:strong_password_here@localhost/lmsetjen_db

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Update `settings.py`:

```python
import os
from pathlib import Path

# Load environment variables
SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = os.getenv('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'lmsetjen_db',
        'USER': 'lmsetjen_user',
        'PASSWORD': 'strong_password_here',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# Static files
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'

# Media files
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'
```

#### 5. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --no-input
python manage.py createsuperuser
```

#### 6. Setup Gunicorn

Create `/etc/systemd/system/gunicorn.service`:

```ini
[Unit]
Description=Gunicorn daemon for LMSetjen DPD RI
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/lmsetjen/backend
Environment="PATH=/var/www/lmsetjen/venv/bin"
ExecStart=/var/www/lmsetjen/venv/bin/gunicorn \
          --workers 3 \
          --bind unix:/var/www/lmsetjen/backend/gunicorn.sock \
          lms_api.wsgi:application

[Install]
WantedBy=multi-user.target
```

Start Gunicorn:

```bash
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl status gunicorn
```

#### 7. Setup Nginx

Create `/etc/nginx/sites-available/lmsetjen`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 100M;

    location = /favicon.ico { access_log off; log_not_found off; }

    location /static/ {
        alias /var/www/lmsetjen/backend/staticfiles/;
    }

    location /media/ {
        alias /var/www/lmsetjen/backend/media/;
    }

    location / {
        include proxy_params;
        proxy_pass http://unix:/var/www/lmsetjen/backend/gunicorn.sock;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/lmsetjen /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 8. Setup SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🌐 Frontend Deployment (React)

### Option 1: Netlify (Recommended)

#### 1. Build Locally

```bash
cd frontend
npm install
npm run build
```

#### 2. Deploy to Netlify

**Via Netlify CLI:**

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

**Via Netlify Dashboard:**
1. Go to https://app.netlify.com
2. Click "Add new site"
3. Drag and drop `dist` folder
4. Configure domain

#### 3. Environment Variables

In Netlify dashboard, add:
```
VITE_API_URL=https://api.yourdomain.com
```

### Option 2: Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option 3: Same VPS as Backend

#### 1. Build Frontend

```bash
cd /var/www/lmsetjen/frontend
npm install
npm run build
```

#### 2. Configure Nginx

Update Nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/lmsetjen/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/var/www/lmsetjen/backend/gunicorn.sock;
    }

    location /static/ {
        alias /var/www/lmsetjen/backend/staticfiles/;
    }

    location /media/ {
        alias /var/www/lmsetjen/backend/media/;
    }
}
```

---

## 🔧 Post-Deployment Tasks

### 1. Create Superuser

```bash
cd /var/www/lmsetjen/backend
source /var/www/lmsetjen/venv/bin/activate
python manage.py createsuperuser
```

### 2. Setup Cron Jobs (Optional)

```bash
crontab -e
```

Add:
```bash
# Clear expired sessions daily
0 3 * * * cd /var/www/lmsetjen/backend && /var/www/lmsetjen/venv/bin/python manage.py clearsessions
```

### 3. Setup Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup_lmsetjen.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/lmsetjen"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup database
sudo -u postgres pg_dump lmsetjen_db > $BACKUP_DIR/db_$DATE.sql

# Backup media files
tar -czf $BACKUP_DIR/media_$DATE.tar.gz /var/www/lmsetjen/backend/media

# Keep only last 7 backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
chmod +x /usr/local/bin/backup_lmsetjen.sh
```

Add to crontab:
```bash
0 2 * * * /usr/local/bin/backup_lmsetjen.sh
```

---

## 📊 Monitoring & Maintenance

### Check Application Status

```bash
# Check Gunicorn
sudo systemctl status gunicorn

# Check Nginx
sudo systemctl status nginx

# View Gunicorn logs
sudo journalctl -u gunicorn

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Update Application

```bash
cd /var/www/lmsetjen
git pull origin main

# Backend
cd backend
source /var/www/lmsetjen/venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --no-input
sudo systemctl restart gunicorn

# Frontend (if hosted on same server)
cd ../frontend
npm install
npm run build
sudo systemctl restart nginx
```

---

## 🔒 Security Hardening

### 1. Firewall Setup

```bash
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw enable
```

### 2. Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Regular Updates

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 🆘 Troubleshooting

### Gunicorn Not Starting

```bash
# Check logs
sudo journalctl -u gunicorn -n 50

# Check socket file
ls -l /var/www/lmsetjen/backend/gunicorn.sock

# Test manually
cd /var/www/lmsetjen/backend
source /var/www/lmsetjen/venv/bin/activate
gunicorn --bind 0.0.0.0:8000 lms_api.wsgi:application
```

### Nginx 502 Error

```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Check if Gunicorn is running
sudo systemctl status gunicorn

# Restart services
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

### Database Connection Error

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -U lmsetjen_user -d lmsetjen_db -h localhost
```

---

## 📞 Support

For deployment issues:
- Check logs first
- Review Nginx/Gunicorn configuration
- Verify environment variables
- Check file permissions

---

**Deployment Guide Version**: 1.0  
**Last Updated**: October 11, 2025
