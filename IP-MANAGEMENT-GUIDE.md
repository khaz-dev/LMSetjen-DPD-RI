# IP Address Management Guide
# LMSetjen DPD RI - Learning Management System

## Overview
This guide explains how to manage and update the EC2 public IP address when it changes.

## Current IP Address
**Production Server**: `16.79.83.21`

## When Does the IP Change?
Your EC2 instance's public IPv4 address changes when:
- The instance is stopped and started (not just restarted)
- The instance is terminated and recreated
- You manually release and allocate a new Elastic IP

## Files That Contain IP Configuration

### 1. Root `.env` File
Location: `/.env`
Contains:
- `ALLOWED_HOSTS` - Django allowed hosts
- `CORS_ALLOWED_ORIGINS` - CORS configuration
- `FRONTEND_SITE_URL` - Frontend URL
- `BACKEND_SITE_URL` - Backend URL

### 2. Django Settings
Location: `/backend/backend/settings.py`
Contains:
- `CORS_ALLOWED_ORIGINS` list (hardcoded fallback)

### 3. Superuser Script
Location: `/create_superuser.py`
Contains:
- Admin URL in the success message

## How to Update IP Address

### Option 1: Automated Script (Recommended)

#### Windows (PowerShell):
```powershell
.\update-ip.ps1 -NewIP "16.79.83.21"
```

#### Linux/Mac (Bash):
```bash
chmod +x update-ip.sh
./update-ip.sh 16.79.83.21
```

The script will:
1. Validate the IP address format
2. Backup your current `.env` file
3. Update all configuration files
4. Show you the next deployment steps

### Option 2: Manual Update

If you prefer to update manually:

1. **Update `.env` file:**
```bash
ALLOWED_HOSTS=localhost,127.0.0.1,YOUR_NEW_IP
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://YOUR_NEW_IP
FRONTEND_SITE_URL=http://YOUR_NEW_IP
BACKEND_SITE_URL=http://YOUR_NEW_IP
```

2. **Update `backend/backend/settings.py`:**
```python
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    # ... other origins ...
    "http://YOUR_NEW_IP",  # Production EC2 server
])
```

3. **Update `create_superuser.py`:**
```python
print(f"\n🔗 Login at: http://YOUR_NEW_IP/admin/")
```

## Deployment After IP Update

### Step 1: Commit and Push Changes
```bash
git add .
git commit -m "Update IP address to YOUR_NEW_IP"
git push origin main
```

### Step 2: Copy .env to Server
```bash
# Windows PowerShell:
scp -i "D:\Project\lms-server-key.pem" .env ubuntu@YOUR_NEW_IP:~/LMSetjen-DPD-RI/.env

# Linux/Mac:
scp -i ~/lms-server-key.pem .env ubuntu@YOUR_NEW_IP:~/LMSetjen-DPD-RI/.env
```

### Step 3: Pull Latest Code on Server
```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && git pull origin main"
```

### Step 4: Rebuild and Restart Containers
```bash
# Stop all containers
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml down"

# Rebuild with new configuration
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml build --no-cache frontend backend"

# Start all containers
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml up -d"
```

### Step 5: Verify Deployment
```bash
# Check container status
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml ps"

# Check logs
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml logs --tail=50"
```

## Testing After Update

1. **Frontend**: http://YOUR_NEW_IP/
2. **Backend API**: http://YOUR_NEW_IP/api/v1/health/
3. **Django Admin**: http://YOUR_NEW_IP/admin/
4. **Swagger Docs**: http://YOUR_NEW_IP/swagger/
5. **ReDoc**: http://YOUR_NEW_IP/redoc/

## Preventing IP Changes (Optional)

To avoid future IP changes, consider:

### Option 1: Elastic IP (Recommended)
1. In AWS EC2 Console → Elastic IPs
2. Allocate new Elastic IP address
3. Associate it with your EC2 instance
4. The IP will remain static even if instance restarts

**Note**: AWS charges for Elastic IPs that are not associated with a running instance.

### Option 2: Use a Domain Name
1. Register a domain (e.g., via Route 53, Namecheap, etc.)
2. Point domain to your EC2 IP
3. Update configuration to use domain instead of IP:
   - `ALLOWED_HOSTS=your-domain.com`
   - `FRONTEND_SITE_URL=https://your-domain.com`
   - `BACKEND_SITE_URL=https://your-domain.com`
4. Set up SSL certificate (Let's Encrypt)

## Troubleshooting

### Issue: Can't access the server after IP change
**Solution**: 
- Update your local SSH config or key permissions
- Check EC2 security group allows SSH (port 22) from your IP
- Verify the new IP is correct in AWS Console

### Issue: CORS errors after IP change
**Solution**:
- Make sure `.env` file is updated on the server
- Rebuild the frontend container with new IP
- Clear browser cache

### Issue: Static files not loading
**Solution**:
- Rebuild frontend: `docker compose -f docker-compose.prod.yml build --no-cache frontend`
- Restart nginx: `docker compose -f docker-compose.prod.yml restart nginx`

## Quick Reference Commands

```bash
# Check current IP on server
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "curl ifconfig.me"

# View current configuration
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cat ~/LMSetjen-DPD-RI/.env | grep SITE_URL"

# Restart specific service
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml restart frontend"

# View frontend logs
ssh -i "D:\Project\lms-server-key.pem" ubuntu@YOUR_NEW_IP "cd ~/LMSetjen-DPD-RI && docker compose -f docker-compose.prod.yml logs --tail=100 frontend"
```

## Support
If you encounter issues after updating the IP address, check:
1. Container logs for errors
2. Nginx configuration
3. Django settings
4. Security group rules in AWS

---

**Last Updated**: October 17, 2025  
**Current IP**: 16.79.83.21
