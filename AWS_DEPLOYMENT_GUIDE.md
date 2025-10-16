# AWS Deployment Guide - LMSetjen DPD RI LMS

## 📋 Overview

This guide will help you deploy the LMS application to AWS using Docker and Docker Compose on an EC2 Free Tier instance.

### What You'll Get
- ✅ Django Backend API (containerized)
- ✅ PostgreSQL Database (containerized)
- ✅ Redis Cache (containerized)
- ✅ Nginx Reverse Proxy (containerized)
- ✅ All running on AWS EC2 Free Tier (t2.micro)

---

## 🆓 AWS Free Tier Requirements

### EC2 Instance
- **Type**: t2.micro (1 vCPU, 1 GB RAM)
- **Storage**: 30 GB SSD (Free Tier limit)
- **OS**: Ubuntu 22.04 LTS
- **Free Tier**: 750 hours/month (enough for 1 instance 24/7)

### Additional Services (Optional)
- **RDS PostgreSQL**: db.t3.micro (20 GB storage) - 750 hours/month
- **Elastic IP**: 1 static IP address (free when attached to running instance)
- **Data Transfer**: 15 GB outbound per month

---

## 🚀 Step-by-Step Deployment

### Phase 1: AWS Account Setup (5 minutes)

1. **Create AWS Account** (if you don't have one)
   - Go to https://aws.amazon.com/
   - Click "Create an AWS Account"
   - Provide credit card (won't be charged if you stay within Free Tier)

2. **Access AWS Console**
   - Sign in to https://console.aws.amazon.com/
   - Region: Select closest to your users (e.g., us-east-1)

---

### Phase 2: Launch EC2 Instance (10 minutes)

1. **Navigate to EC2 Dashboard**
   ```
   Services → Compute → EC2 → Launch Instance
   ```

2. **Instance Configuration**
   
   **Name**: `lms-backend-server`
   
   **Application and OS Images (Amazon Machine Image)**
   - Ubuntu Server 22.04 LTS (HVM), SSD Volume Type
   - Architecture: 64-bit (x86)
   - ✅ Free tier eligible

   **Instance Type**
   - t2.micro (1 vCPU, 1 GiB Memory)
   - ✅ Free tier eligible

   **Key Pair (login)**
   - Click "Create new key pair"
   - Name: `lms-server-key`
   - Key pair type: RSA
   - Private key format: .pem
   - **⚠️ IMPORTANT**: Download and save this file - you'll need it to connect!

   **Network Settings**
   - Click "Edit"
   - Auto-assign public IP: **Enable**
   - Firewall (security groups): Create new security group
   - Security group name: `lms-security-group`
   
   Add these rules:
   | Type | Protocol | Port Range | Source | Description |
   |------|----------|------------|--------|-------------|
   | SSH | TCP | 22 | My IP | SSH access |
   | HTTP | TCP | 80 | Anywhere (0.0.0.0/0) | Web access |
   | HTTPS | TCP | 443 | Anywhere (0.0.0.0/0) | Secure web |
   | Custom TCP | TCP | 8000 | Anywhere (0.0.0.0/0) | Django API |

   **Configure Storage**
   - Size: 30 GiB (Free Tier maximum)
   - Volume type: gp3 or gp2
   - ✅ Free tier eligible

3. **Launch Instance**
   - Click "Launch instance"
   - Wait 2-3 minutes for instance to start
   - Note down the **Public IPv4 address**

---

### Phase 3: Connect to EC2 Instance (5 minutes)

#### On Windows (PowerShell):

```powershell
# 1. Set permissions for your key file
icacls "C:\path\to\lms-server-key.pem" /inheritance:r
icacls "C:\path\to\lms-server-key.pem" /grant:r "%USERNAME%:R"

# 2. Connect via SSH
ssh -i "C:\path\to\lms-server-key.pem" ubuntu@your-ec2-public-ip
```

#### On Linux/Mac:

```bash
# 1. Set permissions
chmod 400 ~/path/to/lms-server-key.pem

# 2. Connect via SSH
ssh -i ~/path/to/lms-server-key.pem ubuntu@your-ec2-public-ip
```

---

### Phase 4: Install Docker & Docker Compose (10 minutes)

Once connected to your EC2 instance, run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y ca-certificates curl gnupg lsb-release git

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group (no need for sudo)
sudo usermod -aG docker $USER

# Apply group changes
newgrp docker

# Verify installation
docker --version
docker compose version
```

Expected output:
```
Docker version 24.x.x
Docker Compose version v2.x.x
```

---

### Phase 5: Clone Repository & Configure (5 minutes)

```bash
# Clone your repository
git clone https://github.com/khaz-dev/LMSetjen-DPD-RI.git
cd LMSetjen-DPD-RI

# Create .env file from example
cp .env.example .env

# Edit environment variables
nano .env
```

**Update these critical values in .env:**

```bash
# Generate a new secret key
SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')

# Set your EC2 public IP
ALLOWED_HOSTS=localhost,127.0.0.1,YOUR_EC2_PUBLIC_IP
BACKEND_SITE_URL=http://YOUR_EC2_PUBLIC_IP:8000
FRONTEND_SITE_URL=http://YOUR_EC2_PUBLIC_IP

# Set secure passwords
DB_PASSWORD=your_secure_db_password_here
REDIS_PASSWORD=your_secure_redis_password_here

# Email (optional)
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com
```

Save and exit (Ctrl+X, Y, Enter)

---

### Phase 6: Build and Launch (10 minutes)

```bash
# Build Docker images (first time takes 5-10 minutes)
docker compose -f docker-compose.prod.yml build

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check if containers are running
docker compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME                  STATUS              PORTS
lms_backend_prod      Up 30 seconds      8000/tcp
lms_postgres_prod     Up 30 seconds      5432/tcp
lms_redis_prod        Up 30 seconds      6379/tcp
lms_nginx_prod        Up 30 seconds      0.0.0.0:80->80/tcp
```

---

### Phase 7: Verify Deployment (5 minutes)

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Look for:
# ✅ "Running migrations..."
# ✅ "Operations to perform: 0 migrations"
# ✅ "Superuser created: admin / admin123"
# ✅ "Starting Gunicorn server..."
# ✅ "Listening at: http://0.0.0.0:8000"

# Test health endpoint
curl http://localhost:8000/api/v1/health/
```

Expected response:
```json
{"status":"healthy","service":"LMS Backend API","timestamp":"2025-10-16T..."}
```

---

### Phase 8: Access Your Application

1. **Backend API**: `http://YOUR_EC2_PUBLIC_IP:8000`
2. **API Documentation**: `http://YOUR_EC2_PUBLIC_IP:8000/api/v1/`
3. **Admin Panel**: `http://YOUR_EC2_PUBLIC_IP:8000/admin/`
   - Username: `admin`
   - Password: `admin123`

4. **Test API Endpoints**:
   ```bash
   curl http://YOUR_EC2_PUBLIC_IP:8000/api/v1/health/
   curl http://YOUR_EC2_PUBLIC_IP:8000/api/v1/course/category/
   curl http://YOUR_EC2_PUBLIC_IP:8000/api/v1/course/course-list/
   ```

---

## 🔧 Maintenance Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Restart Services
```bash
# Restart all
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Database Backup
```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U lms_user lms_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U lms_user lms_db < backup_20251016_120000.sql
```

### Stop All Services
```bash
docker compose -f docker-compose.prod.yml down
```

### Remove All Data (⚠️ Danger!)
```bash
docker compose -f docker-compose.prod.yml down -v
```

---

## 🌐 Domain Setup (Optional)

If you have a domain name:

1. **Point DNS to EC2**
   - Add A record: `@` → `YOUR_EC2_PUBLIC_IP`
   - Add A record: `www` → `YOUR_EC2_PUBLIC_IP`

2. **Update .env**
   ```bash
   ALLOWED_HOSTS=localhost,127.0.0.1,YOUR_EC2_PUBLIC_IP,yourdomain.com,www.yourdomain.com
   ```

3. **Install SSL Certificate (Let's Encrypt)**
   ```bash
   # Install Certbot
   sudo snap install --classic certbot
   
   # Get certificate
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

---

## 💰 Cost Estimation

### Free Tier (First 12 Months)
- EC2 t2.micro: **$0/month** (750 hours free)
- 30 GB Storage: **$0/month** (30 GB free)
- Data Transfer: **$0/month** (15 GB free)
- **Total: $0/month** ✅

### After Free Tier
- EC2 t2.micro: ~$8.50/month
- 30 GB Storage: ~$3/month
- Data Transfer: ~$0.09/GB
- **Total: ~$12-15/month**

---

## 🛡️ Security Best Practices

1. **Change Default Passwords**
   ```bash
   # Change admin password
   docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword admin
   ```

2. **Enable Firewall**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 8000/tcp
   sudo ufw enable
   ```

3. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Monitor Disk Space**
   ```bash
   df -h
   docker system df
   docker system prune -a  # Clean up unused images
   ```

---

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check container status
docker compose -f docker-compose.prod.yml ps

# Restart container
docker compose -f docker-compose.prod.yml restart backend
```

### Database Connection Error
```bash
# Check if PostgreSQL is running
docker compose -f docker-compose.prod.yml ps postgres

# Test database connection
docker compose -f docker-compose.prod.yml exec backend python manage.py dbshell
```

### Out of Memory
```bash
# Check memory usage
free -h
docker stats

# Reduce workers in docker-compose.prod.yml:
# --workers 2  (instead of 4)
```

### Port Already in Use
```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill process
sudo kill -9 <PID>
```

---

## 📞 Support

- **GitHub Issues**: https://github.com/khaz-dev/LMSetjen-DPD-RI/issues
- **Documentation**: Check README.md in repository
- **AWS Support**: https://aws.amazon.com/premiumsupport/

---

## ✅ Deployment Checklist

Before going live:

- [ ] EC2 instance created and running
- [ ] Security group configured (ports 22, 80, 443, 8000)
- [ ] Docker and Docker Compose installed
- [ ] Repository cloned
- [ ] .env file configured with secure passwords
- [ ] Containers built and running
- [ ] Health check endpoint responding
- [ ] Admin panel accessible
- [ ] API endpoints working
- [ ] Database backed up
- [ ] SSL certificate installed (if using domain)
- [ ] Monitoring set up (CloudWatch)
- [ ] Default admin password changed

---

**🎉 Congratulations! Your LMS is now deployed on AWS!**
