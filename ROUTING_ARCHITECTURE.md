# 🔀 URL Routing Architecture & Configuration Guide

## 📋 **Document Purpose**
This guide ensures all URL routes work correctly and prevents conflicts between Django backend routes and React frontend routes.

---

## 🚨 **Critical Issue Resolved**

### **Problem**
- React admin routes (`/admin/dashboard/`, `/admin/users/`) were returning 404 errors
- Nginx was proxying ALL `/admin/*` requests to Django backend
- Django backend doesn't have these routes, only has `/admin/` (Django admin panel)
- Result: 404 errors when accessing React admin pages

### **Root Cause**
**URL path conflict** between:
1. **Django Admin**: `/admin/` (Django's built-in admin panel)
2. **React Admin**: `/admin/dashboard/`, `/admin/users/` (React SPA routes)

### **Solution**
Implemented **route-specific nginx configuration** with proper order priority:
1. React admin routes are matched FIRST using regex patterns
2. Django admin routes are matched SECOND as catch-all
3. This allows both systems to coexist without conflicts

---

## 🏗️ **URL Routing Architecture**

### **1. Django Backend Routes** (Port 8000)

#### **Django Admin Panel** (Django Built-in)
```
/admin/                    → Django admin login
/admin/api/                → Django admin API management
/admin/userauths/          → Django admin user management
/admin/api/course/         → Django admin course management
```

#### **API Endpoints**
```
/api/v1/                   → API root
/api/v1/user/              → User authentication & management
/api/v1/course/            → Course management
/api/v1/student/           → Student operations
/api/v1/teacher/           → Teacher operations
/api/v1/admin/             → Admin API operations
```

#### **API Documentation**
```
/swagger/                  → Swagger UI documentation
/redoc/                    → ReDoc documentation
/swagger.json              → API schema (JSON)
```

---

### **2. React Frontend Routes** (Port 80/443 via Nginx)

#### **Public Routes**
```
/                          → Homepage
/login/                    → Login page
/register/                 → Registration page
/forgot-password/          → Password reset
/course-detail/:slug/      → Course detail page
/search/                   → Search page
```

#### **Student Routes** (Role: 'student')
```
/student/dashboard/        → Student dashboard
/student/courses/          → Enrolled courses
/student/courses/:enrollment_id/ → Course player
/student/wishlist/         → Wishlist
/student/question-answer/  → Q&A
/student/profile/          → Profile
/student/change-password/  → Change password
```

#### **Instructor Routes** (Role: 'teacher' or 'instructor')
```
/instructor/dashboard/     → Instructor dashboard
/instructor/courses/       → Course management
/instructor/create-course/ → Create new course
/instructor/edit-course/:course_id/ → Edit course
/instructor/edit-course/:course_id/curriculum/ → Edit curriculum
/instructor/edit-course/:course_id/quiz/ → Manage quizzes
/instructor/reviews/       → Student reviews
/instructor/students/      → Student management
/instructor/notifications/ → Notifications
/instructor/question-answer/ → Q&A management
/instructor/profile/       → Profile
/instructor/change-password/ → Change password
```

#### **Admin Routes** (Role: 'admin') - **REACT SPA ROUTES**
```
/admin/dashboard/          → Admin dashboard (React)
/admin/users/              → User management (React)
/admin/courses/            → Course management (React) - Future
/admin/analytics/          → Analytics (React) - Future
/admin/reports/            → Reports (React) - Future
/admin/system/             → System settings (React) - Future
/admin/profile/            → Admin profile (React) - Future
```

---

## ⚙️ **Nginx Configuration Strategy**

### **Architecture Overview**
```
User Browser
    ↓
HTTPS (Port 443) → Main Nginx Reverse Proxy (docker/nginx/conf.d/default.conf)
    ↓
    ├── /api/*              → Backend (Django) Container :8000
    ├── /admin              → Backend (Django Admin) Container :8000
    ├── /admin/dashboard/*  → Frontend (React) Container :80
    ├── /admin/users/*      → Frontend (React) Container :80
    ├── /static/*           → Static files volume
    ├── /media/*            → Media files volume
    └── /*                  → Frontend (React SPA) Container :80
        ↓
        Frontend Container Nginx (frontend/nginx.conf)
            ↓
            ├── /admin/dashboard/* → Serve index.html (React Router)
            ├── /admin/users/*     → Serve index.html (React Router)
            ├── /admin             → Proxy to backend:8000 (Django Admin)
            ├── /api/*             → Proxy to backend:8000 (API)
            └── /*                 → Serve React SPA
```

---

## 📝 **Nginx Configuration Files**

### **File 1: Main Reverse Proxy** 
**Location**: `docker/nginx/conf.d/default.conf`

**Purpose**: Entry point for all HTTPS traffic, routes to appropriate containers

**Critical Configuration**:
```nginx
# React Admin Routes - MUST BE FIRST!
location ~ ^/admin/(dashboard|users|courses|analytics|reports|system|profile)/ {
    proxy_pass http://frontend_server;  # Route to React SPA
    # ... proxy headers
}

# Django Admin - MUST BE SECOND!
location /admin {
    proxy_pass http://backend_server;   # Route to Django
    # ... proxy headers
}
```

**Why Order Matters**:
- Nginx matches location blocks from most specific to least specific
- Regex locations (`~`) are evaluated before prefix locations
- React admin routes MUST be matched before Django admin catch-all

---

### **File 2: Frontend Container Nginx**
**Location**: `frontend/nginx.conf`

**Purpose**: Serves React SPA and handles client-side routing

**Critical Configuration**:
```nginx
# React Admin Routes - Serve React SPA
location ~ ^/admin/(dashboard|users|courses|analytics|reports|system|profile)/ {
    try_files $uri $uri/ /index.html;  # React Router fallback
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}

# Django Admin - Proxy to backend
location /admin {
    proxy_pass http://backend:8000;    # Django admin panel
    # ... proxy headers
}

# React Router Catch-All - MUST BE LAST
location / {
    try_files $uri $uri/ /index.html;  # All other routes to React
    add_header Cache-Control "no-cache";
}
```

---

## 🎯 **Testing Checklist**

### **1. Django Backend Routes**
- [ ] `/admin/` → Django admin login page loads
- [ ] `/admin/api/` → Django admin API section loads
- [ ] `/api/v1/` → API root returns JSON
- [ ] `/swagger/` → Swagger UI loads
- [ ] `/redoc/` → ReDoc loads

### **2. React Admin Routes** (Must be logged in as admin)
- [ ] `/admin/dashboard/` → Admin dashboard loads
- [ ] `/admin/users/` → User management page loads
- [ ] Direct URL access works (not just navigation)
- [ ] Page refresh works (doesn't 404)
- [ ] Browser back/forward buttons work

### **3. Other React Routes**
- [ ] `/` → Homepage loads
- [ ] `/student/dashboard/` → Student dashboard (logged in as student)
- [ ] `/instructor/dashboard/` → Instructor dashboard (logged in as instructor)
- [ ] `/course-detail/test-course/` → Course detail page

### **4. Static & Media Files**
- [ ] `/static/admin/css/base.css` → Django static files load
- [ ] `/media/uploads/test.jpg` → Uploaded media files load

### **5. Error Handling**
- [ ] `/non-existent-page/` → Custom 404 page (React)
- [ ] Backend API errors return proper error responses

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: React Admin Routes Return 404**
**Symptoms**:
- `/admin/dashboard/` shows "Not Found" error
- Works when navigating from other pages, fails on direct URL access

**Solution**:
1. Check nginx configuration order
2. Ensure React admin regex location comes BEFORE Django admin location
3. Verify try_files directive includes `/index.html` fallback
4. Clear browser cache and reload

**Verification**:
```bash
# Test from command line
curl -I https://lmsetjendpdri.duckdns.org/admin/dashboard/
# Should return: HTTP/2 200 (not 404)
```

---

### **Issue 2: Django Admin Not Loading**
**Symptoms**:
- `/admin/` returns blank page or errors
- Django admin CSS/JS not loading

**Solution**:
1. Run `python manage.py collectstatic` in backend
2. Verify `/static/` location in nginx serves Django static files
3. Check volume mounts in docker-compose.yml

**Verification**:
```bash
# Check static files exist
docker exec lms_backend_prod ls -la /var/www/static/admin/

# Test static file access
curl -I https://lmsetjendpdri.duckdns.org/static/admin/css/base.css
# Should return: HTTP/2 200
```

---

### **Issue 3: Infinite Redirects or Proxy Loops**
**Symptoms**:
- Browser shows "Too many redirects" error
- Nginx logs show repeated proxy attempts

**Solution**:
1. Check for circular proxy_pass directives
2. Verify location block order (specific before general)
3. Ensure `proxy_redirect off;` is set
4. Check for conflicting rewrite rules

**Verification**:
```bash
# Check nginx config syntax
docker exec lms_nginx_prod nginx -t

# View nginx error logs
docker logs lms_nginx_prod --tail=50
```

---

### **Issue 4: React Routes Work in Dev, Fail in Production**
**Symptoms**:
- Routes work with `npm run dev` but 404 in production
- Direct URL access fails, navigation works

**Solution**:
1. Ensure production nginx has `try_files $uri $uri/ /index.html;`
2. Check that Vite build includes all routes in dist/
3. Verify react-router-dom is properly configured
4. Ensure `<BrowserRouter>` is used (not HashRouter)

**Verification**:
```bash
# Check React build output
ls -la frontend/dist/

# Test production build locally
cd frontend && npm run preview
```

---

## 📚 **Best Practices**

### **1. Adding New React Routes**

#### **For Non-Admin Routes**:
```javascript
// frontend/src/App.jsx
<Route path="/new-feature/" element={<NewFeature />} />
```
**No nginx changes needed** - Handled by catch-all `/` location

#### **For New Admin Routes**:
```javascript
// frontend/src/App.jsx
<Route path="/admin/new-admin-feature/" element={<NewAdminFeature />} />
```

**Requires nginx update**:
```nginx
# Update regex in both nginx configs
location ~ ^/admin/(dashboard|users|courses|analytics|reports|system|profile|new-admin-feature)/ {
    # ... existing config
}
```

---

### **2. Adding New Django Routes**

#### **For API Endpoints**:
```python
# backend/api/urls.py
urlpatterns = [
    path("new-endpoint/", views.NewEndpointView.as_view()),
]
```
**No nginx changes needed** - Handled by `/api/` location

#### **For Top-Level Django Routes**:
```python
# backend/backend/urls.py
urlpatterns = [
    path('new-django-route/', views.new_view),
]
```

**Requires nginx update**:
```nginx
# Add specific location block
location /new-django-route/ {
    proxy_pass http://backend_server;
    # ... proxy headers
}
```

---

### **3. Nginx Configuration Guidelines**

#### **Location Block Order** (Critical!):
```nginx
# 1. Exact matches (=)
location = /exact-path { }

# 2. Regex matches (~)
location ~ ^/admin/(dashboard|users)/ { }

# 3. Prefix matches (^~)
location ^~ /api/ { }

# 4. Regular prefix matches
location /admin { }

# 5. Catch-all (MUST BE LAST!)
location / { }
```

#### **Cache Control Strategy**:
```nginx
# React files (HTML/JS/CSS) - NO CACHE
add_header Cache-Control "no-cache, no-store, must-revalidate" always;

# Static files (images, fonts) - CACHE
add_header Cache-Control "public, immutable";
expires 1y;

# API responses - NO CACHE
add_header Cache-Control "no-cache";
```

---

## 🚀 **Deployment Checklist**

### **Before Deploying Configuration Changes**:

1. **Backup Current Configs**:
   ```bash
   docker cp lms_nginx_prod:/etc/nginx/conf.d/default.conf ~/backup/
   ```

2. **Test Locally**:
   ```bash
   # Build and test locally
   docker-compose up --build
   # Test all routes manually
   ```

3. **Validate Nginx Syntax**:
   ```bash
   # Test nginx config before applying
   docker exec lms_nginx_prod nginx -t
   ```

4. **Deploy with Zero Downtime**:
   ```bash
   # Upload new config
   scp nginx-config.conf server:/path/to/config/
   
   # Reload nginx (no downtime)
   docker exec lms_nginx_prod nginx -s reload
   
   # OR rebuild container
   docker-compose up -d --force-recreate nginx
   ```

5. **Monitor Logs**:
   ```bash
   # Watch logs during deployment
   docker logs -f lms_nginx_prod
   ```

6. **Test All Routes**:
   - Use testing checklist above
   - Test as different user roles
   - Test direct URL access AND navigation
   - Test page refresh on React routes

---

## 📊 **Troubleshooting Commands**

### **Check Nginx Configuration**:
```bash
# View current config
docker exec lms_nginx_prod cat /etc/nginx/conf.d/default.conf

# Test config syntax
docker exec lms_nginx_prod nginx -t

# Reload config without restart
docker exec lms_nginx_prod nginx -s reload
```

### **Check Container Status**:
```bash
# View running containers
docker-compose ps

# Check container logs
docker logs lms_nginx_prod --tail=100
docker logs lms_frontend_prod --tail=100
docker logs lms_backend_prod --tail=100
```

### **Test Routing**:
```bash
# Test from server (direct access)
curl -I http://localhost/admin/dashboard/
curl -I http://localhost/admin/
curl -I http://localhost/api/v1/

# Test from external (through nginx)
curl -I https://lmsetjendpdri.duckdns.org/admin/dashboard/
```

### **Debug Request Flow**:
```bash
# Enable nginx debug logging (add to config)
error_log /var/log/nginx/error.log debug;

# Watch access logs in real-time
docker exec lms_nginx_prod tail -f /var/log/nginx/access.log

# View error logs
docker exec lms_nginx_prod tail -f /var/log/nginx/error.log
```

---

## 🔒 **Security Considerations**

### **Rate Limiting**:
```nginx
# Protect admin routes with rate limiting
limit_req_zone $binary_remote_addr zone=admin:10m rate=5r/s;

location /admin/ {
    limit_req zone=admin burst=10 nodelay;
    # ... rest of config
}
```

### **Access Control**:
```nginx
# Restrict Django admin to specific IPs (optional)
location /admin/ {
    allow 1.2.3.4;  # Your IP
    deny all;
    # ... rest of config
}
```

### **Security Headers** (Already implemented):
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

## 📞 **Support & Documentation**

### **Related Documentation**:
- `RBAC_DOCUMENTATION.md` - Role-based access control
- `ADMIN_ACCESS_GUIDE.md` - Django admin usage guide
- `PRODUCTION_DEPLOYMENT_FIX.md` - Deployment troubleshooting
- `docker-compose.prod.yml` - Container orchestration

### **Key Files**:
- `frontend/src/App.jsx` - React route definitions
- `frontend/nginx.conf` - Frontend nginx configuration
- `docker/nginx/conf.d/default.conf` - Main nginx reverse proxy
- `backend/backend/urls.py` - Django URL configuration
- `backend/api/urls.py` - API endpoint configuration

---

## ✅ **Change Log**

### **2025-10-19: Fixed React Admin Route 404 Errors**
**Problem**: `/admin/dashboard/` and `/admin/users/` returning 404

**Changes Made**:
1. Updated `frontend/nginx.conf`:
   - Added regex location for React admin routes BEFORE Django admin proxy
   - Updated Django admin location from `/admin/` to `/admin` (without trailing slash)

2. Updated `docker/nginx/conf.d/default.conf`:
   - Added regex location to route React admin routes to frontend container
   - Updated Django admin location to catch remaining admin requests

3. Created comprehensive routing documentation (this file)

**Result**: All React admin routes now work correctly alongside Django admin

---

## 🎓 **Learning Resources**

### **Nginx Location Matching**:
- [Nginx Location Directive Documentation](http://nginx.org/en/docs/http/ngx_http_core_module.html#location)
- [Understanding Nginx Location Blocks](https://www.digitalocean.com/community/tutorials/nginx-location-directive)

### **React Router & SPAs**:
- [React Router Documentation](https://reactrouter.com/)
- [Configuring Nginx for Single Page Applications](https://www.digitalocean.com/community/tutorials/how-to-deploy-a-react-application-with-nginx-on-ubuntu-20-04)

### **Docker Nginx Configuration**:
- [Docker Nginx Official Image](https://hub.docker.com/_/nginx)
- [Multi-Container Application with Nginx](https://docs.docker.com/compose/networking/)

---

**Last Updated**: October 19, 2025  
**Version**: 1.0  
**Maintained By**: Development Team
