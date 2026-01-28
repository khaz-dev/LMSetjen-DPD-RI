# LMSetjen DPD RI - Complete System Running Guide

## Current Status ✅

**Backend:** Running on Docker  
- API: http://localhost:8000/api/v1/
- Admin: http://localhost:8000/admin/
- Docs: http://localhost:8000/api/v1/docs/

**Database & Cache:** Running in Docker  
- PostgreSQL: localhost:5432
- Redis: localhost:6379

**Frontend:** Ready to start locally

---

## Quick Start - Run Everything Now

### Terminal 1: Start Backend (Already Running)
```powershell
docker ps  # Verify backend is running
```

Backend should show as healthy.

### Terminal 2: Start Frontend

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"
npm install
npm run dev
```

The frontend will start at: **http://localhost:5173**

---

## Access Points

| Component | URL | Login | Status |
|-----------|-----|-------|--------|
| **Admin Panel** | http://localhost:8000/admin/ | admin / admin123 | ✅ Running |
| **API Docs** | http://localhost:8000/api/v1/docs/ | No login needed | ✅ Running |
| **Frontend App** | http://localhost:5173 | Via UI | 🔄 Starting |
| **Database** | localhost:5432 | lms_user / lms_password | ✅ Running |

---

## Full Running Workflow

### Step 1: Verify All Docker Services

```powershell
docker ps
```

Should show:
```
lms_backend    (running - healthy)
lms_postgres   (running - healthy)
lms_redis      (running - healthy)
```

### Step 2: Start Frontend (New Terminal)

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"
npm run dev
```

Wait for:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

### Step 3: Access the Application

Open your browser and go to:
- **Frontend:** http://localhost:5173
- **Backend Admin:** http://localhost:8000/admin/

---

## Development Workflow

### Terminal 1: Backend (Docker)
```powershell
# Check status
docker ps

# View logs
docker logs lms_backend -f

# Restart if needed
docker restart lms_backend
```

### Terminal 2: Frontend (Local Development)
```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"
npm run dev
```

Hot reload enabled! Changes to React files will auto-refresh.

### Terminal 3: Optional - Database Shell
```powershell
docker exec -it lms_postgres psql -U lms_user -d lms_db
```

---

## System Architecture

```
http://localhost:5173                http://localhost:8000
    React App (Vite)                  Django Backend (Gunicorn)
         |                                    |
         +-- Webpack Dev Server      -- REST API
              (Hot Reload)                   |
                                      +-- PostgreSQL (5432)
                                      +-- Redis (6379)
```

---

## Common Commands

### Frontend

```powershell
# Development
npm run dev                 # Start dev server with hot reload

# Build for production
npm run build              # Build optimized bundle

# Testing
npm run lint               # Check code quality
```

### Backend

```powershell
# Django Admin
docker exec -it lms_backend python manage.py createsuperuser

# Run migrations
docker exec lms_backend python manage.py migrate

# Collect static files
docker exec lms_backend python manage.py collectstatic --noinput

# View logs
docker logs lms_backend -f

# Database management
docker exec -it lms_postgres psql -U lms_user -d lms_db
```

### Docker

```powershell
# View all services
docker ps -a

# View logs
docker logs lms_backend -f
docker logs lms_postgres -f
docker logs lms_redis -f

# Restart services
docker restart lms_backend
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

---

## Credentials

| Service | Username | Password | Host |
|---------|----------|----------|------|
| Admin Panel | admin | admin123 | http://localhost:8000/admin/ |
| PostgreSQL | lms_user | lms_password | localhost:5432 |
| Frontend | [Register via UI] | [Create password] | http://localhost:5173 |

---

## Troubleshooting

### Frontend Not Starting

```powershell
# Clear node_modules and reinstall
cd frontend
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Backend 404 Errors

```powershell
# Restart backend
docker restart lms_backend

# View logs
docker logs lms_backend -f
```

### Database Connection Error

```powershell
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart database
docker restart lms_postgres
```

### Static Files Not Loading in Admin

```powershell
# Collect static files
docker exec lms_backend python manage.py collectstatic --noinput

# Restart backend
docker restart lms_backend
```

---

## What's Running Now

✅ **Backend API** - Django REST Framework with Gunicorn  
✅ **Database** - PostgreSQL 15 with LMS data  
✅ **Cache** - Redis 7 for sessions and caching  
✅ **Admin Panel** - Jazzmin admin interface  
✅ **API Documentation** - Swagger/ReDoc  
🔄 **Frontend** - Ready to start with npm run dev  

---

## Next Steps

1. **Start Frontend:**
   ```powershell
   cd "D:\Project\LMSetjen DPD RI\frontend"
   npm run dev
   ```

2. **Open in Browser:**
   - Frontend: http://localhost:5173
   - Admin: http://localhost:8000/admin/

3. **Login to Admin:**
   - Username: `admin`
   - Password: `admin123`

4. **Explore the System:**
   - Create courses
   - Enroll users
   - Check analytics
   - View API documentation

---

**System Ready! 🚀**

All core services are running. Just start the frontend and you're good to go!

