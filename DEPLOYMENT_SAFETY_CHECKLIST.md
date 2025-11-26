# Safe Deployment Checklist - Kelola Materi Feature

**Deployment Date**: November 27, 2025  
**Feature**: Course Category Management Admin (Kelola Materi)  
**Status**: ✅ Ready for Safe Deployment

---

## Pre-Deployment Verification

### ✅ Code Status
- **Git Status**: Clean working directory ✓
- **Commits**: All 5 feature commits pushed to origin/main ✓
- **Migrations**: No pending database migrations ✓
- **Build Status**: Frontend builds successfully ✓

### Recent Commits
1. `a0eda06` - Modern-form-check checkbox styling fix
2. `946464a` - Layout alignment with DashboardAdmin pattern
3. `93e1aa9` - Modern dashboard design upgrade
4. `52a0682` - Category delete functionality improvements
5. `abfddf6` - DRF pagination response format handling

---

## Deployment Steps (Safe Method)

### Phase 1: Pre-Deployment (Local Machine)

✅ **Step 1.1: Backup Current Production State**
```bash
# On your production server - Create database backup
pg_dump lms_db -U lms_user > /home/backup/lms_db_$(date +%Y%m%d_%H%M%S).sql
```

✅ **Step 1.2: Verify All Changes in Local Environment**
```bash
# Local: Verify build is clean
cd frontend && npm run build

# Local: Check no uncommitted changes
git status  # Should show clean
git log --oneline -5  # Verify commits are there
```

✅ **Step 1.3: Create Rollback Plan**
```bash
# Document current Git commit hash before deployment
git rev-parse HEAD  # Save this hash for rollback
# Example: a0eda06 (current tip)
# Previous: 52a0682 (if rollback needed)
```

---

### Phase 2: On Production Server

⚠️ **CRITICAL: Execute these steps in order - DO NOT SKIP**

#### Step 2.1: Database Backup (ESSENTIAL)
```bash
# SSH into production server
ssh your_production_server

# Create backup directory with timestamp
BACKUP_DIR="/var/backups/lms/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
sudo pg_dump lms_db -U lms_user -h localhost > $BACKUP_DIR/database.sql

# Verify backup was created
ls -lh $BACKUP_DIR/database.sql

# Also backup current code
cd /app/lms-production
sudo cp -r . $BACKUP_DIR/code_backup/
```

#### Step 2.2: Pull Latest Changes
```bash
# SSH into production server
cd /app/lms-production

# Verify we're on main branch
git branch

# Create a local tag for safe rollback
git tag -a pre-kelola-deployment-$(date +%Y%m%d_%H%M%S) -m "Pre-deployment snapshot"

# Pull latest changes
git pull origin main

# Verify the 5 commits are now in production
git log --oneline -5
```

#### Step 2.3: Backend - No Migrations Needed
```bash
# Verify no pending migrations (Category model already exists)
python manage.py showmigrations | grep api

# Optional: Show migrations for safety
python manage.py migrate --plan
```

#### Step 2.4: Frontend Build & Deploy
```bash
# Build production bundle
cd /app/lms-production/frontend
npm install  # Update dependencies if needed
npm run build

# Verify dist folder was created
ls -la dist/

# Copy to nginx serving directory
sudo cp -r dist/* /var/www/lms-frontend/
```

#### Step 2.5: Collect Static Files (Backend)
```bash
# Go to backend directory
cd /app/lms-production/backend

# Collect static files
python manage.py collectstatic --noinput
```

#### Step 2.6: Restart Services
```bash
# Restart Django application (via Docker or systemd)
# Option A: Docker Compose
docker-compose -f docker-compose.yml restart

# Option B: systemd services
sudo systemctl restart lms_backend
sudo systemctl restart nginx
sudo systemctl restart redis-server

# Verify services are running
docker-compose ps  # For Docker
# or
sudo systemctl status lms_backend nginx redis-server  # For systemd
```

#### Step 2.7: Health Check
```bash
# Wait 5-10 seconds for services to start
sleep 10

# Check backend API is responding
curl -s http://localhost:8000/api/v1/health/ | jq .

# Check frontend is being served
curl -s http://localhost/index.html | head -5

# Check Nginx is responding
curl -I http://localhost/

# Check specific endpoint
curl -s -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/api/v1/admin/category/ | jq .
```

---

### Phase 3: Post-Deployment Verification

#### Step 3.1: Test Category Management API
```bash
# Test List endpoint
curl -X GET http://your-server/api/v1/admin/category/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "count": X,
#   "results": [...]
# }
```

#### Step 3.2: Test Category Create
```bash
curl -X POST http://your-server/api/v1/admin/category/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Category",
    "image": "https://example.com/image.jpg",
    "active": true
  }'
```

#### Step 3.3: Test Frontend Admin Page
- Navigate to: `http://your-server/admin/kelola-materi/`
- Verify page loads without errors
- Test "Add Category" button
- Test search functionality
- Test edit and delete buttons

#### Step 3.4: Verify No Errors
```bash
# Check Django error logs
tail -100 /var/log/lms/django_error.log

# Check Nginx error logs
tail -100 /var/log/nginx/error.log

# Check application performance
# Monitor: Response times, CPU, memory, database connections
```

---

## Rollback Plan (If Issues Occur)

### Quick Rollback to Previous State

**If issues appear within 30 minutes of deployment:**

```bash
# SSH into production server
cd /app/lms-production

# Option 1: Git rollback (safest)
git checkout HEAD~1  # Go back to previous commit (52a0682)
git pull origin main  # Update origin reference
cd frontend && npm run build
docker-compose restart

# Option 2: Restore from backup
BACKUP_TIME="20251127_143022"  # Change to your backup time
sudo systemctl stop nginx lms_backend

# Restore database
sudo psql lms_db -U lms_user < /var/backups/lms/$BACKUP_TIME/database.sql

# Restore code
cd /app/lms-production
sudo rm -rf *
sudo cp -r /var/backups/lms/$BACKUP_TIME/code_backup/* .

# Restart services
docker-compose restart
```

---

## Risk Assessment

### Low Risk Changes
| Component | Risk | Reason |
|-----------|------|--------|
| **Backend API** | ✅ LOW | No database schema changes; Category model already exists |
| **Permissions** | ✅ LOW | Uses existing admin role permission system |
| **Frontend UI** | ✅ LOW | Isolated component; CSS-in-file |
| **Database** | ✅ LOW | No migrations needed |

### Deployment Impact
- **Zero Downtime**: Can deploy during business hours
- **User Impact**: Minimal - only affects admin panel
- **Rollback Time**: < 5 minutes with git rollback

---

## Testing Checklist

After deployment, verify:

- [ ] Admin can access `/admin/kelola-materi/` page
- [ ] Page loads stat cards showing category counts
- [ ] Search filter works
- [ ] "Add Category" button opens modal
- [ ] Category creation works
- [ ] Category edit works
- [ ] Category delete works (with confirmation)
- [ ] Delete button is disabled for categories with courses
- [ ] Form validation shows proper error messages
- [ ] Page styling matches other admin pages
- [ ] Footer is positioned correctly at bottom
- [ ] Responsive design works on mobile/tablet
- [ ] No console errors in browser
- [ ] No 500 errors in backend logs

---

## Communication Template

**For your team lead/DevOps:**

```
Subject: Deployment Ready - Kelola Materi Feature (Course Category Management)

Dear [Team Lead],

The Kelola Materi feature (course category CRUD admin interface) is ready for 
safe production deployment.

Deployment Details:
- Feature: Admin category management page with full CRUD
- Risk Level: LOW (no DB migrations, isolated feature)
- Estimated Downtime: 0 minutes (rolling restart)
- Estimated Deployment Time: 10-15 minutes
- Rollback Time: < 5 minutes

Latest Commits:
1. a0eda06 - Modern-form-check checkbox styling
2. 946464a - Layout alignment with admin dashboard
3. 93e1aa9 - Modern design implementation
4. 52a0682 - Delete functionality improvements
5. abfddf6 - API response format handling

Pre-deployment verification completed:
✓ All changes committed and tested
✓ No pending database migrations
✓ Frontend builds successfully
✓ Backup and rollback plan in place

Recommended Deployment Window: [Your preferred time]

Please review and let me know if you'd like to proceed.

Best regards,
[Your Name]
```

---

## Success Indicators

After deployment, you should see:

✅ **Admin can manage course categories**
```
- View all categories with statistics
- Add new categories
- Edit existing categories
- Delete categories (unless they have courses)
- Search and filter categories
- Visual feedback and error messages
```

✅ **No system errors**
```
- Backend API responding with 200/201/204 status codes
- No 500 errors in logs
- No console errors in browser
- Database connections stable
```

✅ **Feature meets requirements**
```
- Modern design matching admin dashboard
- Professional checkbox styling in modals
- Proper footer positioning
- Responsive on all devices
- Smooth animations and transitions
```

---

## Support & Troubleshooting

**If issues occur during deployment:**

1. **Check nginx error logs**: `tail -100 /var/log/nginx/error.log`
2. **Check Django logs**: `tail -100 /var/log/lms/django_error.log`
3. **Verify services running**: `docker-compose ps` or `systemctl status`
4. **Quick rollback**: `git checkout HEAD~1` + `docker-compose restart`
5. **Contact Support**: Provide error logs and deployment timestamp

---

**Prepared by**: Copilot  
**Date**: November 27, 2025  
**Approval Status**: ⏳ Awaiting approval
