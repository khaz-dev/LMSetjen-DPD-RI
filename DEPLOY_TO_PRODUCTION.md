# 🚀 Deploy to Production - Quick Guide

**Date**: October 19, 2025  
**Changes**: Instructor UI/UX refinements + loading optimizations

---

## 📦 What's Being Deployed

### ✅ Major Changes
- **UI/UX Refinements**: Uniform header positioning, fixed form controls, enhanced sidebar
- **Loading System**: Professional skeleton loaders, non-blocking patterns
- **New Components**: Complete skeleton loader system, MinimalLoader, InstructorPageLoader
- **CSS Improvements**: Fixed loading spinner consistency, responsive behavior
- **Documentation**: 15+ comprehensive docs, automated audit scripts

### 📊 Statistics
- **Files Modified**: 74 files
- **Lines Added**: 8,313
- **Lines Removed**: 433
- **Zero Compilation Errors**: ✅

---

## 🔄 Deployment Steps

### Option 1: Docker Production Deployment (Recommended)

#### Step 1: SSH to Production Server
```bash
ssh your-user@your-production-server
cd /path/to/LMSetjen-DPD-RI
```

#### Step 2: Pull Latest Changes
```bash
git pull origin main
```

#### Step 3: Check Docker Compose
```bash
# Verify docker-compose.prod.yml exists
ls docker-compose.prod.yml

# Check current containers
docker-compose -f docker-compose.prod.yml ps
```

#### Step 4: Build & Deploy

**Full Rebuild (Recommended for major changes)**:
```bash
# Stop current containers
docker-compose -f docker-compose.prod.yml down

# Rebuild images (no cache)
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

**Quick Deploy (for minor changes)**:
```bash
# Just restart frontend
docker-compose -f docker-compose.prod.yml restart frontend

# Check logs
docker-compose -f docker-compose.prod.yml logs -f frontend
```

#### Step 5: Verify Deployment
```bash
# Check service health
docker-compose -f docker-compose.prod.yml ps

# All should show "Up" status
# If any show "Exit" or "Restarting", check logs
```

---

### Option 2: Manual Deployment (VPS without Docker)

#### Step 1: Pull Changes
```bash
ssh your-user@your-server
cd /var/www/lmsetjen-dpd-ri  # or your project path
git pull origin main
```

#### Step 2: Update Frontend
```bash
cd frontend

# Install dependencies (if package.json changed)
npm install

# Build production bundle
npm run build

# Copy build to web server
sudo cp -r dist/* /var/www/html/
# OR if using nginx
sudo cp -r dist/* /usr/share/nginx/html/
```

#### Step 3: Restart Services
```bash
# Restart Nginx
sudo systemctl restart nginx

# If backend changed, restart Django
sudo systemctl restart gunicorn  # or your Django service name
```

---

## 🔍 Post-Deployment Verification

### 1. **Check Frontend Bundle**
```bash
# On server
ls -lh /path/to/frontend/dist/

# Look for new bundle files with updated timestamps
# Example: CourseDetail-[hash].js
```

### 2. **Test in Browser**

**IMPORTANT**: Clear browser cache first!

**Hard Refresh**:
```
Windows/Linux: Ctrl + Shift + R
Mac: Cmd + Shift + R
Or: Ctrl + F5
```

**Test Pages**:
- ✅ Dashboard: https://your-domain.com/instructor/dashboard
- ✅ Courses: https://your-domain.com/instructor/courses
- ✅ Profile: https://your-domain.com/instructor/profile
- ✅ Students: https://your-domain.com/instructor/students

**What to Check**:
- [ ] Loading spinners centered and professional
- [ ] Skeleton loaders appear (not blocking spinners)
- [ ] Header positioning consistent across pages
- [ ] Sidebar active icon white when collapsed
- [ ] No console errors (F12 → Console)

### 3. **Check Logs**

**Docker**:
```bash
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f backend
```

**Manual**:
```bash
# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Django logs (if configured)
sudo journalctl -u gunicorn -f
```

---

## 🐛 Troubleshooting

### Issue 1: Old UI Still Showing

**Cause**: Browser cache

**Solution**:
```bash
# 1. Hard refresh (Ctrl + Shift + R)
# 2. Clear browser cache completely
# 3. Test in incognito/private mode
# 4. Check if new bundle deployed:
ls -lh frontend/dist/*.js | grep $(date +%Y-%m-%d)
```

### Issue 2: 404 on JS/CSS Files

**Cause**: Static files not copied or nginx misconfigured

**Solution**:
```bash
# Check if files exist
ls frontend/dist/assets/

# Check nginx config
sudo nginx -t

# Recopy files
cd frontend
npm run build
sudo cp -r dist/* /var/www/html/  # or your nginx root

# Restart nginx
sudo systemctl restart nginx
```

### Issue 3: Blank Page / White Screen

**Cause**: JavaScript errors

**Solution**:
```bash
# 1. Open browser DevTools (F12)
# 2. Check Console tab for errors
# 3. Check Network tab for failed requests
# 4. Rebuild frontend:
cd frontend
rm -rf dist node_modules
npm install
npm run build
```

### Issue 4: Docker Container Won't Start

**Cause**: Port conflicts, resource issues

**Solution**:
```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs frontend

# Check ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8000

# Restart Docker
sudo systemctl restart docker
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📊 Deployment Checklist

### Pre-Deployment
- [x] Code committed to GitHub
- [x] All tests passing locally
- [x] Zero compilation errors
- [ ] Production .env configured
- [ ] Database backup created
- [ ] Server resources checked (disk space, memory)

### During Deployment
- [ ] SSH to production server
- [ ] Pull latest changes from GitHub
- [ ] Build Docker images (or frontend bundle)
- [ ] Start/restart services
- [ ] Monitor logs for errors

### Post-Deployment
- [ ] Clear browser cache
- [ ] Test all instructor pages
- [ ] Check for console errors
- [ ] Verify loading states working
- [ ] Test on mobile devices
- [ ] Monitor server resources
- [ ] Check error logs

---

## 🔐 Security Notes

### Before Going Live:
```bash
# 1. Change SECRET_KEY in .env
# 2. Set DEBUG=False
# 3. Update ALLOWED_HOSTS
# 4. Configure CORS properly
# 5. Enable HTTPS/SSL
# 6. Set secure cookie flags
```

---

## 📞 Quick Commands Reference

### Docker Commands
```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart specific service
docker-compose -f docker-compose.prod.yml restart frontend

# Rebuild single service
docker-compose -f docker-compose.prod.yml build --no-cache frontend
docker-compose -f docker-compose.prod.yml up -d frontend

# Stop all
docker-compose -f docker-compose.prod.yml down

# Remove volumes (CAUTION: deletes data)
docker-compose -f docker-compose.prod.yml down -v
```

### Git Commands
```bash
# Check current status
git status
git log --oneline -5

# Pull latest
git pull origin main

# Check commit
git show HEAD
```

### System Commands
```bash
# Check disk space
df -h

# Check memory
free -m

# Check CPU
top

# Check running processes
ps aux | grep python
ps aux | grep nginx
```

---

## ✅ Success Indicators

Deployment successful when:
- ✅ All Docker containers show "Up" status
- ✅ Frontend loads without errors
- ✅ New loading states visible
- ✅ Console shows no errors
- ✅ All instructor pages accessible
- ✅ Skeleton loaders working
- ✅ Sidebar active state correct

---

## 📚 Related Documentation

- `DEPLOYMENT.md` - Full deployment guide
- `DOCKER_DEPLOYMENT_GUIDE.md` - Docker-specific guide
- `AWS_DEPLOYMENT_GUIDE.md` - AWS-specific guide
- `DEPLOYMENT_COMPLETE.md` - Previous deployment record
- `docker-compose.prod.yml` - Production Docker config

---

**Deployment Script**: Use `deploy-docker.sh` for automated deployment

**Support**: Check logs and troubleshooting section above

**Rollback**: `git checkout <previous-commit>` then redeploy

---

**Last Updated**: October 19, 2025  
**Status**: Ready to Deploy  
**Version**: v2.0 - Instructor UI/UX Optimizations
