# 🐳 Docker Deployment Guide
**LMSetjen DPD RI - Learning Management System**  
**Complete Guide for Docker Container Deployment**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Quick Start](#quick-start)
5. [Development Deployment](#development-deployment)
6. [Production Deployment](#production-deployment)
7. [Configuration](#configuration)
8. [Docker Commands](#docker-commands)
9. [Troubleshooting](#troubleshooting)
10. [Performance Optimization](#performance-optimization)
11. [Security Best Practices](#security-best-practices)
12. [Backup & Recovery](#backup--recovery)

---

## 🎯 Overview

This project is now **Docker-ready** with a complete containerized deployment setup including:

- **Backend**: Django REST API with Gunicorn
- **Frontend**: React/Vite application with Nginx
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Reverse Proxy**: Nginx (production)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Nginx (Port 80/443)                 │
│                    Reverse Proxy + SSL                  │
└──────────────────┬──────────────────┬───────────────────┘
                   │                  │
         ┌─────────▼────────┐  ┌──────▼──────────┐
         │   Frontend       │  │    Backend      │
         │   React + Nginx  │  │  Django + Gun   │
         │   (Port 80)      │  │  (Port 8000)    │
         └──────────────────┘  └────────┬────────┘
                                        │
                    ┌───────────────────┼──────────────┐
                    │                   │              │
            ┌───────▼─────┐     ┌──────▼─────┐ ┌─────▼──────┐
            │  PostgreSQL │     │   Redis    │ │   Media    │
            │   (5432)    │     │   (6379)   │ │  Volumes   │
            └─────────────┘     └────────────┘ └────────────┘
```

---

## ✅ Prerequisites

### Required Software

1. **Docker** (v20.10+)
   - Download: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version`

2. **Docker Compose** (v2.0+)
   - Usually included with Docker Desktop
   - Verify: `docker-compose --version`

3. **Git** (for cloning)
   - Download: https://git-scm.com/downloads
   - Verify: `git --version`

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 10 GB free space

**Recommended (Production):**
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 50+ GB free space (with backups)
- SSD storage for database

---

## 📁 Project Structure

```
LMSetjen-DPD-RI/
├── backend/
│   ├── Dockerfile                 # Backend container definition
│   ├── .dockerignore             # Files to exclude from image
│   ├── requirements.txt          # Python dependencies
│   └── manage.py                 # Django management
│
├── frontend/
│   ├── Dockerfile                # Frontend container definition
│   ├── .dockerignore            # Files to exclude from image
│   ├── nginx.conf               # Nginx configuration
│   ├── docker-entrypoint.sh     # Startup script
│   └── package.json             # Node dependencies
│
├── docker/
│   ├── nginx/
│   │   ├── nginx.conf           # Main nginx config
│   │   ├── conf.d/
│   │   │   └── default.conf     # Server blocks
│   │   └── ssl/                 # SSL certificates (production)
│   └── postgres/
│       └── init.sql             # Database initialization
│
├── docker-compose.yml           # Development environment
├── docker-compose.prod.yml      # Production environment
├── .env.docker.example          # Environment template
├── deploy-docker.sh             # Bash deployment script
└── deploy-docker.ps1            # PowerShell deployment script
```

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/khaz-dev/LMSetjen-DPD-RI.git
cd LMSetjen-DPD-RI
```

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.docker.example .env.docker

# Edit with your configuration
nano .env.docker  # or use any text editor
```

**Required Configuration:**
- `DB_PASSWORD`: Strong database password
- `REDIS_PASSWORD`: Strong Redis password
- `SECRET_KEY`: Django secret key (50+ characters)
- `SENDGRID_API_KEY`: Your SendGrid API key
- `FROM_EMAIL`: Your sender email address

### 3. Deploy

**Windows (PowerShell):**
```powershell
.\deploy-docker.ps1
```

**Linux/macOS (Bash):**
```bash
chmod +x deploy-docker.sh
./deploy-docker.sh
```

**Manual Deployment:**
```bash
docker-compose up -d --build
```

### 4. Access Your Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **Admin Panel**: http://localhost:8000/admin
- **API Documentation**: http://localhost:8000/swagger

---

## 🛠️ Development Deployment

### Using docker-compose.yml

The development configuration includes:
- Hot reloading for backend
- Source code mounted as volumes
- Debug mode enabled
- Exposed ports for direct access

### Build Development Environment

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend

# Build without cache (fresh build)
docker-compose build --no-cache
```

### Start Services

```bash
# Start all services in background
docker-compose up -d

# Start with logs visible
docker-compose up

# Start specific services
docker-compose up -d postgres redis
docker-compose up -d backend frontend
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Execute Commands

```bash
# Django commands
docker-compose exec backend python manage.py makemigrations
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python manage.py collectstatic

# Access Django shell
docker-compose exec backend python manage.py shell

# Access database
docker-compose exec postgres psql -U lms_user -d django_lms_db

# Access Redis CLI
docker-compose exec redis redis-cli -a your_redis_password

# Access backend bash
docker-compose exec backend bash

# Access frontend bash
docker-compose exec frontend sh
```

### Stop Services

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop backend

# Stop and remove containers
docker-compose down

# Stop, remove containers, and delete volumes
docker-compose down -v
```

---

## 🏭 Production Deployment

### Using docker-compose.prod.yml

The production configuration includes:
- Optimized Docker images
- Nginx reverse proxy with SSL/TLS
- Resource limits
- Health checks
- Logging configuration
- No source code mounting

### Prerequisites for Production

1. **Domain Name**: Point your domain to server IP
2. **SSL Certificates**: Obtain SSL/TLS certificates
3. **Firewall**: Configure firewall rules
4. **Backups**: Set up automated backups

### SSL Certificate Setup

**Option 1: Let's Encrypt (Recommended)**

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/key.pem
```

**Option 2: Self-Signed (Development/Testing)**

```bash
# Create self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem \
  -subj "/CN=your-domain.com"
```

### Configure Production Environment

```bash
# Edit production environment
nano .env.docker
```

**Required Changes:**
```env
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
FRONTEND_SITE_URL=https://your-domain.com
BACKEND_SITE_URL=https://your-domain.com
SECRET_KEY=your-super-secure-random-key-minimum-50-characters
```

### Deploy to Production

```bash
# Using production compose file
docker-compose -f docker-compose.prod.yml up -d --build

# View status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Production Checklist

- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Environment variables secured
- [ ] DEBUG=False in settings
- [ ] Strong passwords set
- [ ] Firewall configured
- [ ] Backups automated
- [ ] Monitoring set up
- [ ] Logs rotation configured
- [ ] Security headers enabled

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_NAME` | PostgreSQL database name | django_lms_db | ✅ |
| `DB_USER` | Database user | lms_user | ✅ |
| `DB_PASSWORD` | Database password | - | ✅ |
| `DB_HOST` | Database host | postgres | ✅ |
| `DB_PORT` | Database port | 5432 | ✅ |
| `REDIS_URL` | Redis connection URL | - | ✅ |
| `REDIS_PASSWORD` | Redis password | - | ✅ |
| `SECRET_KEY` | Django secret key | - | ✅ |
| `DEBUG` | Django debug mode | False | ✅ |
| `ALLOWED_HOSTS` | Allowed hostnames | localhost | ✅ |
| `SENDGRID_API_KEY` | SendGrid API key | - | ✅ |
| `FROM_EMAIL` | Sender email address | - | ✅ |
| `FRONTEND_SITE_URL` | Frontend URL | http://localhost | ✅ |
| `BACKEND_SITE_URL` | Backend URL | http://localhost:8000 | ✅ |

### Service Ports

| Service | Internal Port | External Port | Description |
|---------|--------------|---------------|-------------|
| Frontend | 80 | 80 | React application |
| Backend | 8000 | 8000 | Django API |
| PostgreSQL | 5432 | 5432 | Database |
| Redis | 6379 | 6379 | Cache |
| Nginx (Prod) | 80/443 | 80/443 | Reverse proxy |

### Volume Mounts

```yaml
postgres_data:     # PostgreSQL database files
redis_data:        # Redis persistence
media_files:       # User uploaded files
static_files:      # Static assets (CSS, JS)
backend_logs:      # Application logs
```

---

## 🔧 Docker Commands

### Container Management

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Stop container
docker stop lms_backend

# Start container
docker start lms_backend

# Restart container
docker restart lms_backend

# Remove container
docker rm lms_backend

# Remove all stopped containers
docker container prune
```

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi lmsetjen-dpd-ri_backend

# Remove unused images
docker image prune

# Remove all unused images
docker image prune -a
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect lms_postgres_data

# Remove volume
docker volume rm lms_postgres_data

# Remove unused volumes
docker volume prune

# Backup volume
docker run --rm -v lms_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Restore volume
docker run --rm -v lms_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

### Network Management

```bash
# List networks
docker network ls

# Inspect network
docker network inspect lms_network

# Remove network
docker network rm lms_network

# Remove unused networks
docker network prune
```

### System Cleanup

```bash
# Remove all stopped containers, unused networks, and dangling images
docker system prune

# Remove everything including volumes
docker system prune -a --volumes

# Show disk usage
docker system df
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Problem:** `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Solution:**
```bash
# Find process using port
# Windows
netstat -ano | findstr :8000

# Linux/macOS
lsof -i :8000

# Kill the process or change port in docker-compose.yml
ports:
  - "8001:8000"  # Change external port
```

#### 2. Database Connection Failed

**Problem:** `django.db.utils.OperationalError: could not connect to server`

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Wait for database to be ready
docker-compose exec backend python manage.py wait_for_db

# Verify database credentials in .env.docker
```

#### 3. Build Failed

**Problem:** Build errors during `docker-compose build`

**Solution:**
```bash
# Clear cache and rebuild
docker-compose build --no-cache

# Check Dockerfile syntax
docker-compose config

# Verify .dockerignore doesn't exclude required files
```

#### 4. Frontend Not Loading

**Problem:** Frontend shows white screen or 404

**Solution:**
```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend

# Verify environment variables
docker-compose exec frontend env

# Check nginx configuration
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf
```

#### 5. Permission Denied Errors

**Problem:** `PermissionError: [Errno 13] Permission denied`

**Solution:**
```bash
# Fix volume permissions
docker-compose exec backend chown -R appuser:appuser /app/media
docker-compose exec backend chown -R appuser:appuser /app/logs

# On host machine
sudo chown -R $USER:$USER ./backend/media
sudo chown -R $USER:$USER ./backend/logs
```

### Health Check Commands

```bash
# Check all services
docker-compose ps

# Check specific service health
docker inspect --format='{{.State.Health.Status}}' lms_backend

# Test backend API
curl http://localhost:8000/api/health/

# Test frontend
curl http://localhost/

# Test database
docker-compose exec postgres pg_isready -U lms_user

# Test Redis
docker-compose exec redis redis-cli -a your_password ping
```

### Debugging Tips

```bash
# Access container shell
docker-compose exec backend bash
docker-compose exec frontend sh

# View container resource usage
docker stats

# Inspect container details
docker inspect lms_backend

# View container network
docker network inspect lms_network

# Export container logs
docker-compose logs backend > backend.log

# Real-time logs with timestamps
docker-compose logs -f --timestamps backend
```

---

## ⚡ Performance Optimization

### Database Optimization

**PostgreSQL Configuration** (`docker-compose.yml`):

```yaml
postgres:
  environment:
    POSTGRES_INITDB_ARGS: "-E UTF8 --data-checksums"
  command: >
    postgres
    -c shared_buffers=256MB
    -c effective_cache_size=1GB
    -c maintenance_work_mem=128MB
    -c checkpoint_completion_target=0.9
    -c wal_buffers=16MB
    -c default_statistics_target=100
    -c random_page_cost=1.1
    -c effective_io_concurrency=200
    -c work_mem=4MB
    -c min_wal_size=1GB
    -c max_wal_size=4GB
```

### Redis Optimization

```yaml
redis:
  command: >
    redis-server
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --appendonly yes
    --appendfsync everysec
```

### Backend Optimization

**Gunicorn Workers** (`docker-compose.yml`):

```yaml
command: >
  gunicorn
    --bind 0.0.0.0:8000
    --workers 4                    # CPU cores * 2 + 1
    --threads 4                    # 2-4 threads per worker
    --worker-class gthread
    --worker-connections 1000
    --max-requests 1000            # Restart worker after N requests
    --max-requests-jitter 50       # Add randomness
    --timeout 120
    --graceful-timeout 30
    --keep-alive 5
    --access-logfile -
    --error-logfile -
    --log-level info
    backend.wsgi:application
```

### Resource Limits

Add to `docker-compose.prod.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '1.0'
        memory: 1G

postgres:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 4G
      reservations:
        cpus: '1.0'
        memory: 2G

redis:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M
```

---

## 🔒 Security Best Practices

### 1. Environment Security

```bash
# Never commit .env.docker file
echo ".env.docker" >> .gitignore

# Restrict file permissions
chmod 600 .env.docker

# Use secrets management for production
# Example with Docker Secrets:
docker secret create db_password /path/to/db_password.txt
```

### 2. Container Security

```yaml
# Run containers as non-root user (already implemented)
user: appuser:appuser

# Read-only root filesystem
read_only: true

# No new privileges
security_opt:
  - no-new-privileges:true

# Drop capabilities
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE
```

### 3. Network Security

```bash
# Use internal networks for services
networks:
  lms_network:
    driver: bridge
    internal: true  # For internal-only services

# Expose only necessary ports
# Don't expose PostgreSQL and Redis in production
```

### 4. Database Security

```sql
-- Use strong passwords
-- Limit database user privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_user;
REVOKE CREATE ON SCHEMA public FROM lms_user;

-- Enable SSL connections
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

### 5. Application Security

```python
# In settings.py for production
DEBUG = False
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_HSTS_SECONDS = 31536000
```

---

## 💾 Backup & Recovery

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
# Automated backup script

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
docker-compose exec -T postgres pg_dump -U lms_user django_lms_db | \
  gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# Backup media files
docker run --rm -v lms_media_files:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/media_$DATE.tar.gz -C /data .

# Backup Redis
docker-compose exec -T redis redis-cli -a your_password SAVE
docker run --rm -v lms_redis_data:/data -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/redis_$DATE.tar.gz -C /data .

# Remove backups older than 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Restore from Backup

```bash
# Restore PostgreSQL
gunzip < postgres_backup.sql.gz | \
  docker-compose exec -T postgres psql -U lms_user django_lms_db

# Restore media files
docker run --rm -v lms_media_files:/data -v $(pwd):/backup \
  alpine tar xzf /backup/media_backup.tar.gz -C /data

# Restore Redis
docker run --rm -v lms_redis_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/redis_backup.tar.gz -C /data
docker-compose restart redis
```

### Schedule Automated Backups

**Linux (cron):**
```bash
# Edit crontab
crontab -e

# Add backup job (daily at 2 AM)
0 2 * * * /path/to/backup.sh >> /var/log/lms_backup.log 2>&1
```

**Windows (Task Scheduler):**
```powershell
# Create scheduled task
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\path\to\backup.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "LMS Backup" -Action $Action -Trigger $Trigger
```

---

## 📊 Monitoring & Logging

### View All Logs

```bash
# All services
docker-compose logs -f

# Specific service with timestamps
docker-compose logs -f --timestamps backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Since specific time
docker-compose logs --since="2025-01-01T00:00:00" backend
```

### Log Rotation

Add to `docker-compose.prod.yml`:

```yaml
backend:
  logging:
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "5"
      compress: "true"
```

### Health Monitoring

```bash
# Check service health
docker-compose ps

# Inspect health status
docker inspect --format='{{json .State.Health}}' lms_backend | jq

# Monitor resource usage
docker stats lms_backend lms_postgres lms_redis
```

### Application Monitoring Tools

**Recommended Tools:**
1. **Sentry** - Error tracking
2. **New Relic** - Application performance
3. **Datadog** - Infrastructure monitoring
4. **Prometheus + Grafana** - Metrics and visualization

---

## 🎓 Advanced Topics

### Scaling Services

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# With load balancer
# Update nginx upstream configuration
upstream backend_server {
    server backend_1:8000;
    server backend_2:8000;
    server backend_3:8000;
}
```

### Multi-Stage Deployments

```bash
# Staging environment
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Production environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build and deploy
        env:
          SSH_KEY: ${{ secrets.SSH_KEY }}
        run: |
          ssh -i $SSH_KEY user@server "cd /app && git pull && docker-compose -f docker-compose.prod.yml up -d --build"
```

---

## 📞 Support & Resources

### Documentation
- Docker Documentation: https://docs.docker.com
- Docker Compose: https://docs.docker.com/compose
- Django Documentation: https://docs.djangoproject.com
- React Documentation: https://react.dev

### Community
- GitHub Issues: https://github.com/khaz-dev/LMSetjen-DPD-RI/issues
- Stack Overflow: Tag with `docker`, `django`, `react`

### Useful Commands Reference

```bash
# Quick reference card
docker-compose up -d          # Start services
docker-compose down           # Stop services
docker-compose logs -f        # View logs
docker-compose ps             # List services
docker-compose exec backend   # Execute command
docker-compose restart        # Restart services
docker-compose build          # Rebuild images
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Docker and Docker Compose installed
- [ ] `.env.docker` configured
- [ ] SSL certificates ready (production)
- [ ] Domain DNS configured (production)
- [ ] Firewall rules set
- [ ] Backup strategy planned

### Deployment
- [ ] Build images successfully
- [ ] All services running
- [ ] Database migrated
- [ ] Static files collected
- [ ] Superuser created
- [ ] Health checks passing

### Post-Deployment
- [ ] Application accessible
- [ ] Admin panel working
- [ ] API endpoints responding
- [ ] File uploads working
- [ ] Email sending working
- [ ] SSL certificate valid (production)
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Logs being collected

---

## 🎉 Conclusion

Your LMSetjen DPD RI application is now fully containerized and ready for deployment! This Docker setup provides:

- ✅ **Isolated environments** - Development and production separation
- ✅ **Reproducible builds** - Consistent across all machines
- ✅ **Easy scaling** - Add more containers as needed
- ✅ **Simple deployment** - One command to deploy everything
- ✅ **Production-ready** - SSL, reverse proxy, health checks
- ✅ **Maintainable** - Clear structure and documentation

**Next Steps:**
1. Test locally with development setup
2. Configure production environment
3. Set up monitoring and backups
4. Deploy to production server
5. Monitor and optimize performance

**Happy Deploying! 🚀**

---

**Report Generated:** October 15, 2025  
**Project:** LMSetjen DPD RI - Learning Management System  
**Status:** ✅ Docker-Ready & Production-Ready
