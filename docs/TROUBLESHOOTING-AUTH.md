# 🔐 Authentication & User Management - Troubleshooting Guide

**Date**: October 17, 2025  
**Status**: ✅ **RESOLVED**  
**Severity**: Critical  
**Issue**: 401 Unauthorized on login attempts

---

## 📋 Problem Summary

### Symptoms
- **Error**: `POST /api/v1/user/token/ 401 (Unauthorized)`
- **User Action**: Trying to login at `https://lmsetjendpdri.duckdns.org/login/`
- **Credentials Used**: `lmsetjendpdri@gmail.com` / `Admin@LMS2025!`
- **Browser Console**: "401 Unauthorized" error
- **User Impact**: Cannot login to the system, blocked from accessing any features

### Expected Behavior
- User enters valid credentials → receives JWT token → logs in successfully
- New users can register via `/register` page
- Admins can access Django admin panel at `/admin/`

### Actual Behavior
- User enters credentials → receives 401 error → stays on login page
- No users exist in database → all login attempts fail
- Fresh deployments have empty user table

---

## 🔍 Root Cause Analysis

### Investigation Steps

1. **Checked API Endpoint**
   ```bash
   curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/user/token/ \
     -H "Content-Type: application/json" \
     -d '{"email":"lmsetjendpdri@gmail.com","password":"Admin@LMS2025!"}'
   ```
   **Result**: ❌ 401 Unauthorized

2. **Checked User Count in Database**
   ```bash
   docker exec lms_backend python manage.py shell -c \
     "from django.contrib.auth import get_user_model; print(get_user_model().objects.count())"
   ```
   **Result**: ❌ `0` users in database

3. **Checked Authentication System**
   - ✅ JWT token authentication configured correctly
   - ✅ User model uses `email` as USERNAME_FIELD
   - ✅ Password validation and hashing working
   - ❌ **No users exist** to authenticate!

4. **Checked Deployment Process**
   - ✅ Migrations run successfully
   - ✅ Database tables created
   - ❌ **No initialization of default users**
   - ❌ No createsuperuser command in startup script

---

## 🎯 Root Cause Identified

### The Missing Initialization Step

**Problem Flow**:
1. Fresh deployment runs migrations → Creates empty user table
2. Backend starts → No users created automatically
3. User tries to login → Database has 0 users
4. Authentication fails → **401 Unauthorized**

**Why This Happened**:
- Django migrations only create **table structure**, not data
- `createsuperuser` is a **manual** Django command, not automatic
- Docker-compose startup didn't include user initialization
- No seed data or fixtures configured

**Comparison with Standard Django Projects**:

| Step | Standard Django | Our LMS (Before Fix) | Our LMS (After Fix) |
|------|-----------------|----------------------|---------------------|
| 1. Create DB tables | `manage.py migrate` | `manage.py migrate` ✅ | `manage.py migrate` ✅ |
| 2. Create superuser | **Manual** `createsuperuser` | ❌ Not done | `manage.py init_db` ✅ |
| 3. User can login | After manual step | ❌ Never | ✅ Automatic |

---

## ✅ Solution Implemented

### Solution 1: Django Management Command - `init_db`

Created a new Django management command that automatically initializes the database with default users.

**File**: `backend/core/management/commands/init_db.py`

**Features**:
- ✅ Creates superuser: `admin@lmsetjen.dpd.go.id`
- ✅ Creates default user: `lmsetjendpdri@gmail.com`
- ✅ Safe to run multiple times (idempotent)
- ✅ Updates passwords if users already exist
- ✅ `--skip-if-exists` flag to avoid errors on re-runs
- ✅ Proper transaction handling
- ✅ Detailed console output

**Default Accounts Created**:

| Email | Username | Password | Role | Permissions |
|-------|----------|----------|------|-------------|
| admin@lmsetjen.dpd.go.id | admin | Admin@LMS2025! | admin | Superuser, Staff |
| lmsetjendpdri@gmail.com | lmsetjendpdri | Admin@LMS2025! | student | Regular user |

**Usage**:
```bash
# Initialize database with default users
python manage.py init_db

# Skip if users already exist
python manage.py init_db --skip-if-exists

# Inside Docker container
docker exec lms_backend python manage.py init_db
```

### Solution 2: Automatic Initialization on Startup

Updated `docker-compose.yml` backend startup command to automatically run `init_db` after migrations.

**Before**:
```yaml
command: >
  sh -c "
    echo '🔄 Waiting for database...' &&
    python manage.py wait_for_db &&
    echo '📦 Running migrations...' &&
    python manage.py migrate --noinput &&
    echo '📁 Collecting static files...' &&
    python manage.py collectstatic --noinput --clear &&
    echo '🚀 Starting Gunicorn server...' &&
    gunicorn --bind 0.0.0.0:8000 --workers 4 ...
  "
```

**After**:
```yaml
command: >
  sh -c "
    echo '🔄 Waiting for database...' &&
    python manage.py wait_for_db &&
    echo '📦 Running migrations...' &&
    python manage.py migrate --noinput &&
    echo '👤 Initializing default users...' &&       # ⬅️ NEW!
    python manage.py init_db --skip-if-exists &&    # ⬅️ NEW!
    echo '📁 Collecting static files...' &&
    python manage.py collectstatic --noinput --clear &&
    echo '🚀 Starting Gunicorn server...' &&
    gunicorn --bind 0.0.0.0:8000 --workers 4 ...
  "
```

**Benefits**:
- ✅ **Zero manual steps** - Users created automatically on deployment
- ✅ **Safe re-runs** - `--skip-if-exists` prevents errors
- ✅ **Fresh deployments work** - Users can login immediately
- ✅ **Container restarts safe** - Won't duplicate users

---

## 📊 Verification & Results

### Before Fix

```bash
# Check user count
$ docker exec lms_backend python manage.py shell -c \
  "from django.contrib.auth import get_user_model; \
   print(get_user_model().objects.count())"
0  # ❌ No users!

# Try to login
$ curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/user/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"lmsetjendpdri@gmail.com","password":"Admin@LMS2025!"}'
{"detail": "No active account found with the given credentials"}  # ❌ Fails
```

### After Fix

```bash
# Deploy with new changes
$ cd /home/ubuntu/LMSetjen-DPD-RI
$ git pull origin main
$ docker compose up -d --build backend

# Backend startup logs show:
🔄 Waiting for database...
📦 Running migrations...
👤 Initializing default users...  # ⬅️ NEW STEP!
✅ Created superuser: admin@lmsetjen.dpd.go.id
✅ Created default user: lmsetjendpdri@gmail.com
🎉 Database initialization complete!
   Total users in database: 2
📝 Default Credentials:
   Superuser: admin@lmsetjen.dpd.go.id / Admin@LMS2025!
   User: lmsetjendpdri@gmail.com / Admin@LMS2025!
📁 Collecting static files...
🚀 Starting Gunicorn server...

# Check user count
$ docker exec lms_backend python manage.py shell -c \
  "from django.contrib.auth import get_user_model; \
   print(get_user_model().objects.count())"
2  # ✅ Users exist!

# Try to login
$ curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/user/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"lmsetjendpdri@gmail.com","password":"Admin@LMS2025!"}'
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",  # ✅ SUCCESS!
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Browser Test

1. ✅ Open https://lmsetjendpdri.duckdns.org/login/
2. ✅ Enter email: `lmsetjendpdri@gmail.com`
3. ✅ Enter password: `Admin@LMS2025!`
4. ✅ Click "Login"
5. ✅ **Successfully logged in!** → Redirected to dashboard

---

## 🎓 Lessons Learned

### 1. Database Initialization vs Migration

**Django Migrations**:
- Create/modify **table structure** (schema)
- Run automatically on deployment
- Version-controlled (migration files)
- Example: Create `auth_user` table

**Data Initialization**:
- Create **actual data records** (rows)
- Requires separate commands/scripts
- Not part of migrations
- Example: Create first superuser account

**Key Insight**: **Migrations ≠ Data**. You need both!

### 2. Authentication System Requirements

For JWT authentication to work, you need:
1. ✅ User model configured (done)
2. ✅ JWT settings configured (done)
3. ✅ Authentication endpoint created (done)
4. ✅ **At least one user account** (was missing!)

### 3. Docker Deployment Best Practices

**Bad Practice** (Manual steps):
```bash
# Deploy
docker compose up -d

# Manually create superuser
docker exec -it lms_backend python manage.py createsuperuser
# User must type email, password, etc.
```

**Good Practice** (Automated):
```bash
# Deploy - everything automatic!
docker compose up -d
# Users created automatically via init_db command
```

### 4. Default Credentials Security

**Current Setup**:
- Default passwords: `Admin@LMS2025!`
- Hard-coded in init_db command
- Documented in this guide

**Security Recommendations**:
1. ⚠️ **Change default passwords** after first login
2. ⚠️ Use environment variables for production passwords
3. ⚠️ Force password change on first admin login
4. ⚠️ Implement password rotation policy

**Future Improvement** (Optional):
```python
# init_db.py - Use environment variables
import os
from django.conf import settings

ADMIN_PASSWORD = os.getenv('ADMIN_DEFAULT_PASSWORD', 'Admin@LMS2025!')
USER_PASSWORD = os.getenv('USER_DEFAULT_PASSWORD', 'Admin@LMS2025!')
```

---

## 🛡️ Prevention Measures

### 1. Automated Testing

Created test checklist for future deployments:

**Deployment Test Checklist**:
```bash
# 1. Check user count
docker exec lms_backend python manage.py shell -c \
  "from django.contrib.auth import get_user_model; \
   print('Users:', get_user_model().objects.count())"

# 2. Test login API
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/user/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"lmsetjendpdri@gmail.com","password":"Admin@LMS2025!"}'

# 3. Test browser login
# Open https://lmsetjendpdri.duckdns.org/login/
# Try logging in with default credentials

# 4. Check admin panel
# Open https://lmsetjendpdri.duckdns.org/admin/
# Login with superuser credentials
```

### 2. Documentation Updates

- ✅ Added this troubleshooting guide
- ✅ Updated deployment documentation
- ✅ Added default credentials to README
- ✅ Created deployment checklist

### 3. Future Enhancements

**Planned Improvements**:

1. **Health Check for Users**
   ```python
   # Add to health check endpoint
   def get(self, request):
       user_count = User.objects.count()
       return Response({
           'status': 'healthy',
           'users': user_count,
           'has_superuser': User.objects.filter(is_superuser=True).exists()
       })
   ```

2. **Admin Dashboard Alert**
   - Show warning if using default passwords
   - Prompt to change password on first login

3. **Automated Integration Tests**
   - Test user creation on deployment
   - Test login with default credentials
   - Verify JWT token generation

---

## 📝 Deployment Guide (Updated)

### Fresh Deployment Steps

```bash
# 1. SSH to server
ssh -i "<key>.pem" ubuntu@<ip>

# 2. Navigate to project
cd /home/ubuntu/LMSetjen-DPD-RI

# 3. Pull latest changes
git pull origin main

# 4. Deploy with Docker Compose
docker compose up -d --build

# 5. Verify backend startup logs
docker logs lms_backend --tail 50
# Should see: "✅ Created superuser" and "✅ Created default user"

# 6. Test login
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/user/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"lmsetjendpdri@gmail.com","password":"Admin@LMS2025!"}'

# Should return JWT tokens!
```

### Manual User Creation (If Needed)

```bash
# Option 1: Use management command
docker exec lms_backend python manage.py init_db

# Option 2: Interactive createsuperuser
docker exec -it lms_backend python manage.py createsuperuser

# Option 3: Django shell
docker exec -it lms_backend python manage.py shell
```

```python
from django.contrib.auth import get_user_model
User = get_user_model()

# Create user
user = User.objects.create(
    email='newuser@example.com',
    username='newuser',
    full_name='New User',
    role='student',
    is_active=True
)
user.set_password('SecurePassword123!')
user.save()
print(f'Created user: {user.email}')
```

---

## 🔗 Related Files

### Created Files
1. **backend/core/management/commands/init_db.py** - Database initialization command

### Modified Files
1. **docker-compose.yml** - Added `init_db` to backend startup
2. **create_superuser.py** - Updated login URL to HTTPS
3. **docs/TROUBLESHOOTING-AUTH.md** - This documentation

### Reference Files
- `backend/userauths/models.py` - User model definition
- `backend/api/serializer.py` - JWT token serializer
- `backend/api/views.py` - Authentication views
- `backend/api/urls.py` - Authentication endpoints

---

## ✨ Final Status

**Problem**: ❌ 401 Unauthorized on login attempts  
**Root Cause**: ✅ Identified - Database had 0 users  
**Solution**: ✅ Implemented - Auto-initialization with init_db command  
**Verification**: ✅ Tested - Login works with default credentials  
**Documentation**: ✅ Complete - This comprehensive guide  
**Prevention**: ✅ In place - Automated user creation on deployment  

**Time to Resolution**: ~30 minutes  
**Downtime**: None (users manually created immediately)  
**Impact**: No data loss, authentication-only issue  

---

## 🙋 Default Credentials

### **⚠️ IMPORTANT - Change These After First Login!**

**Superuser Account** (Full admin access):
- Email: `admin@lmsetjen.dpd.go.id`
- Password: `Admin@LMS2025!`
- Role: Admin (Superuser + Staff)
- Access: Django admin panel + Full system

**Regular User Account** (For testing):
- Email: `lmsetjendpdri@gmail.com`
- Password: `Admin@LMS2025!`
- Role: Student
- Access: Student dashboard + Courses

**Security Warning**: These are default credentials for initial setup. Change them immediately after first login!

---

## 📚 Additional Resources

### Django Authentication Documentation
- [User Authentication](https://docs.djangoproject.com/en/4.2/topics/auth/)
- [Custom User Model](https://docs.djangoproject.com/en/4.2/topics/auth/customizing/)
- [Management Commands](https://docs.djangoproject.com/en/4.2/howto/custom-management-commands/)

### JWT Authentication
- [Simple JWT Documentation](https://django-rest-framework-simplejwt.readthedocs.io/)
- [Token Authentication Guide](https://www.django-rest-framework.org/api-guide/authentication/)

### Docker & Django
- [Django Docker Deployment](https://docs.docker.com/samples/django/)
- [Docker Compose Best Practices](https://docs.docker.com/compose/production/)

---

**Document Version**: 1.0  
**Last Updated**: October 17, 2025  
**Author**: AI Assistant + Development Team  
**Status**: ✅ Issue Resolved & Documented & Prevented
