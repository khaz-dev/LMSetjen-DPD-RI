# Complete Frontend + Backend Setup Guide

**Project:** LMSetjen DPD RI  
**Date:** January 21, 2026  
**Status:** Production Ready (Phase 4.41+)

---

## 🚀 Quick Overview

This is a **full-stack learning management system**:
- **Frontend:** React 18 + Vite (port 5173 in dev, 80 in production)
- **Backend:** Django 4.2 + DRF (port 8000)
- **Database:** PostgreSQL 15 (port 5432)
- **Cache:** Redis 7 (port 6379)

You have **3 setup options**:
1. **Option A: Docker (Easiest, 5 min)** - All services containerized
2. **Option B: Local Venv + Docker Services (Best for development, 15 min)** - Dev server locally, DB/Redis in Docker
3. **Option C: Full Local (Most control, 30 min)** - Everything local including PostgreSQL/Redis

---

## 📋 Technology Stack Breakdown

### Frontend Requirements
- **Node.js:** 14+ (18+ recommended)
- **npm:** 8+
- **Packages:** 40+ dependencies in `package.json`
- **Build Tool:** Vite (modern, fast)
- **Key Libraries:**
  - React 18.2.0
  - React Router v6 (routing)
  - Axios (HTTP client)
  - Bootstrap 5.3.2 (UI)
  - Chart.js (data visualization)
  - SweetAlert2 (modals)
  - Zustand (state management)

### Backend Requirements
- **Python:** 3.8+
- **Django:** 4.2.7
- **Database Driver:** psycopg2-binary
- **Packages:** 47 dependencies in `requirements.txt`
- **Key Libraries:**
  - Django REST Framework 3.14.0
  - JWT authentication (simplejwt)
  - PostgreSQL integration
  - Redis caching
  - CORS support

### Infrastructure Requirements
- **PostgreSQL:** 15
- **Redis:** 7
- **Docker:** For Option A & B

---

## 🎯 RECOMMENDED: Option B (Hybrid Approach)

### Why Option B?
✅ Fast development (no Docker overhead on frontend)  
✅ Easy debugging with local code  
✅ Hot reload works perfectly  
✅ Simple database/cache setup (Docker handles it)  
✅ Production-ready (same services as Docker)

### Setup Time: ~15-20 minutes

### Step 1: Start Backend Services (Docker)

```bash
# Navigate to project root
cd "D:\Project\LMSetjen DPD RI"

# Start PostgreSQL and Redis using Docker Compose
docker-compose up -d postgres redis

# Wait 10 seconds for services to initialize
# Verify services are running
docker-compose ps
```

**Verification:**
```bash
# Check PostgreSQL is running
psql -U lms_user -h localhost -d django_lms_db -c "SELECT version();"

# Check Redis is running
redis-cli -h localhost ping
# Should return: PONG
```

### Step 2: Setup Backend (Django)

```bash
# Navigate to backend
cd backend

# Activate venv
venv\Scripts\activate

# Install requirements (if not done already)
pip install -r requirements.txt

# Run migrations to create database tables
python manage.py migrate

# Create superuser for admin panel
python manage.py createsuperuser
# Follow prompts:
# Username: admin
# Email: admin@example.com
# Password: (your choice)
# Password (again): (confirm)

# Start Django development server (Terminal 1)
python manage.py runserver
```

**Output should show:**
```
Using Redis for caching and sessions
Performing system checks...
System check identified no issues (0 silenced).
Starting development server at http://127.0.0.1:8000/
```

✅ Backend is running at: **http://localhost:8000**  
✅ Admin panel at: **http://localhost:8000/admin**

### Step 3: Setup Frontend (React)

```bash
# NEW TERMINAL - Navigate to frontend
cd "D:\Project\LMSetjen DPD RI\frontend"

# Install Node packages
npm install
# This will take 2-3 minutes

# Start development server (Terminal 2)
npm run dev
```

**Output should show:**
```
  VITE v4.4.5  ready in 456 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

✅ Frontend is running at: **http://localhost:5173**

---

## 🏃 Daily Development Workflow

### Terminal Setup (3 terminals total):

**Terminal 1 - Backend:**
```bash
cd "D:\Project\LMSetjen DPD RI\backend"
venv\Scripts\activate
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd "D:\Project\LMSetjen DPD RI\frontend"
npm run dev
```

**Terminal 3 - Docker Monitor (Optional):**
```bash
cd "D:\Project\LMSetjen DPD RI"
docker-compose ps
```

### Accessing the System:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api/v1/
- **Admin Panel:** http://localhost:8000/admin (use superuser credentials)

---

## 🐳 Alternative: Option A (Docker - Fastest)

If you want everything containerized (production-like):

```bash
# Navigate to project root
cd "D:\Project\LMSetjen DPD RI"

# Copy environment file
copy .env.example .env

# Start all services
docker-compose up -d

# Wait 20-30 seconds for all services to start

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Verify all services running
docker-compose ps
```

**Access Points:**
- Frontend: http://localhost (port 80)
- Backend: http://localhost:8000
- Admin: http://localhost:8000/admin

**Advantages:**
- Production-like environment
- All services isolated in containers
- Easy to reset (delete volumes)
- No local PostgreSQL/Redis installation needed

**Disadvantages:**
- Docker overhead
- File changes require container rebuild
- Harder to debug

---

## 📊 Port Reference

| Service | Port | Local Dev | Docker |
|---------|------|-----------|--------|
| **Frontend (React)** | 5173 | ✅ Vite dev server | ❌ N/A |
| **Frontend (Nginx)** | 80 | ❌ N/A | ✅ Production |
| **Backend (Django)** | 8000 | ✅ runserver | ✅ Gunicorn |
| **PostgreSQL** | 5432 | Shared (Docker) | Container |
| **Redis** | 6379 | Shared (Docker) | Container |
| **Admin Panel** | 8000 | http://localhost:8000/admin | Same |

---

## 🛠️ Common Commands

### Frontend Commands

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run linting
npm run lint

# Optimize images before build
npm run optimize-images

# View installed packages
npm list
```

### Backend Commands

```bash
# Start development server
python manage.py runserver

# Create database tables from models
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Make changes to database
python manage.py makemigrations

# Collect static files for production
python manage.py collectstatic

# Django shell (Python console with Django context)
python manage.py shell

# Run tests
python manage.py test

# Clear cache
python manage.py shell
# Then: from django.core.cache import cache; cache.clear()
```

### Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f redis

# Check service status
docker-compose ps

# Remove all containers and volumes
docker-compose down -v

# Rebuild images
docker-compose build
```

---

## 📁 Key Project Files

### Frontend Structure
```
frontend/
├── src/
│   ├── views/              # Page components (by role)
│   ├── components/         # Reusable UI components
│   ├── utils/              # Axios wrapper, hooks
│   ├── store/              # Zustand state management
│   ├── styles/             # Global CSS
│   ├── App.jsx             # Main component with routes
│   └── main.jsx            # Entry point
├── public/                 # Static assets
├── package.json            # Dependencies
├── vite.config.js          # Vite build config
└── .env.example            # Environment template
```

### Backend Structure
```
backend/
├── api/                    # Main LMS app (6000+ lines)
│   ├── views.py            # API endpoints
│   ├── models.py           # Database models
│   ├── serializers.py      # Request/response
│   └── urls.py             # Route definitions
├── userauths/              # User authentication
├── backend/                # Django settings
│   └── settings.py         # Configuration
├── venv/                   # Python virtual environment
├── requirements.txt        # Python dependencies
├── manage.py               # Django CLI
└── .env.example            # Environment template
```

---

## 🔍 Environment Configuration

### Frontend (.env not used, set in vite.config.js)
- Default API: `http://localhost:8000`
- Configurable in `frontend/src/utils/apiInstance.js`

### Backend (.env file)

Create `.env` file from `.env.example`:

```bash
# Copy template
copy .env.example .env
```

Key variables:
```env
# Development mode (auto-reload enabled)
DEBUG=True

# Database (for Docker: use "postgres" as host)
DB_HOST=localhost
DB_USER=lms_user
DB_PASSWORD=your_password
DB_NAME=django_lms_db

# Redis (for Docker: use "redis" as host)
REDIS_HOST=localhost
REDIS_PORT=6379

# Frontend URL (for redirects, emails)
FRONTEND_SITE_URL=http://localhost:5173

# Backend URL
BACKEND_SITE_URL=http://localhost:8000
```

---

## ✅ Verification Checklist

### After Starting Backend:

- [ ] Django development server starts (no errors)
- [ ] `http://localhost:8000` shows Django message
- [ ] `http://localhost:8000/admin` shows login page
- [ ] Can login with superuser credentials
- [ ] Console shows "Using Redis for caching and sessions"
- [ ] File changes trigger auto-reload

### After Starting Frontend:

- [ ] Vite dev server starts (shows local address)
- [ ] `http://localhost:5173` shows React app
- [ ] Can see login/register pages
- [ ] Network tab shows API calls to `http://localhost:8000`
- [ ] File changes trigger hot reload (no refresh needed)
- [ ] No console errors

### Backend API Endpoints to Test:

```bash
# Test basic connectivity
curl http://localhost:8000/api/v1/course/course-list/

# Should return JSON with courses
# If authentication required, will show proper error

# Login endpoint
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

---

## 🐛 Troubleshooting

### Frontend Issues

**Issue: "npm: command not found"**
- Solution: Install Node.js from nodejs.org

**Issue: Port 5173 already in use**
- Solution: Kill process or use different port
  ```bash
  npm run dev -- --port 3000
  ```

**Issue: API calls fail with CORS error**
- Solution: Check backend CORS_ALLOWED_ORIGINS in `.env`
  ```env
  CORS_ALLOWED_ORIGINS=http://localhost:5173
  ```

### Backend Issues

**Issue: "ModuleNotFoundError: No module named 'django'"**
- Solution: Activate venv and reinstall
  ```bash
  venv\Scripts\activate
  pip install -r requirements.txt
  ```

**Issue: "Connection refused" on localhost:5432**
- Solution: Start PostgreSQL container
  ```bash
  docker-compose up -d postgres redis
  ```

**Issue: "redis.exceptions.ConnectionError"**
- Solution: Start Redis container
  ```bash
  docker-compose up -d redis
  ```

### Database Issues

**Issue: "No such table: api_course"**
- Solution: Run migrations
  ```bash
  python manage.py migrate
  ```

**Issue: Need to reset database**
- Solution: Delete volume and restart
  ```bash
  docker-compose down -v
  docker-compose up -d postgres redis
  python manage.py migrate
  ```

---

## 📈 Performance Tips

### Frontend
- Vite automatically code-splits components
- Images are optimized at build time
- Use lazy loading for routes (already configured)
- Clear browser cache if seeing old content (Ctrl+Shift+Delete)

### Backend
- Django ORM queries are cached by Redis
- Search results cached for 5 minutes
- Database connections pooled
- Gunicorn handles 4 worker threads in production

### Database
- Full-text search indexed in PostgreSQL
- Regular database backups recommended
- Query logs available in `backend/logs/`

---

## 🚢 Deployment Notes

This setup also works for production:

**Environment:** Change `.env` to:
```env
DEBUG=False
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

**Then use:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📞 Next Steps

1. **Choose setup option:** Recommend Option B (Hybrid)
2. **Start backend services:** `docker-compose up -d postgres redis`
3. **Setup backend:** Run migrations + start server
4. **Setup frontend:** `npm install && npm run dev`
5. **Verify both running:** Check ports and access pages
6. **Start developing!**

**Estimated total time: 15-20 minutes**

---

Generated: January 21, 2026  
Project: LMSetjen DPD RI  
Status: ✅ Production Ready
