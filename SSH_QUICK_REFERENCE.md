# SSH to Production Server - Quick Reference

## 🔑 Connection Details
- **IP**: 16.79.83.21
- **User**: ubuntu
- **Key**: D:\Project\lms-server-key.pem

---

## 🚀 Quick Connect

### PowerShell:
```powershell
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
```

### If Permission Error:
```powershell
# Fix key permissions (Windows)
icacls "D:\Project\lms-server-key.pem" /inheritance:r
icacls "D:\Project\lms-server-key.pem" /grant:r "$($env:USERNAME):(R)"
```

---

## 📝 Once Connected - Run These Commands

```bash
# 1. Go to project directory
cd ~/LMSetjen-DPD-RI

# 2. Pull latest code
git pull origin main

# 3. Run the fix script
chmod +x fix-production.sh
./fix-production.sh

# 4. Check status
docker compose -f docker-compose.prod.yml ps
```

---

## 🔧 Troubleshooting

### If Git Pull Fails:
```bash
# Check current status
git status

# Stash any local changes
git stash

# Pull again
git pull origin main
```

### If Docker Not Found:
```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker
```

---

## 📊 Useful Commands While Connected

```bash
# View all container logs
docker compose -f docker-compose.prod.yml logs -f

# View only frontend logs
docker compose -f docker-compose.prod.yml logs -f frontend

# Check container status
docker compose -f docker-compose.prod.yml ps

# Restart specific service
docker compose -f docker-compose.prod.yml restart frontend

# Stop all services
docker compose -f docker-compose.prod.yml down

# Start all services
docker compose -f docker-compose.prod.yml up -d
```

---

## 🆘 Quick Fixes

### Frontend Keeps Restarting:
```bash
cd ~/LMSetjen-DPD-RI
docker compose -f docker-compose.prod.yml logs frontend | tail -50
```

### Check Server Resources:
```bash
# Disk space
df -h

# Memory usage
free -m

# Running processes
htop  # or 'top'
```

---

## 🔌 Disconnect
```bash
exit
# or press Ctrl+D
```
