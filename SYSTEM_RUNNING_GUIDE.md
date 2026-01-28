# LMSetjen DPD RI - System is Running! ✅

## Current Status

✅ **Docker Services:**
- PostgreSQL (localhost:5432) - Running and Healthy
- Redis (localhost:6379) - Running and Healthy
- Backend Django API (localhost:8000) - Running and Healthy
- Frontend Nginx - Restarting (SSL certificate issue in dev)

✅ **Database:**
- Migrations complete
- Superuser created: `admin` / `admin123`

## Accessing the System

### Backend API (Primary Access)

**Base URL:** http://localhost:8000

#### Admin Interface
- URL: http://localhost:8000/admin/
- Username: `admin`
- Password: `admin123`

#### API Documentation (Swagger)
- URL: http://localhost:8000/api/v1/docs/

#### Key API Endpoints
```
GET  /api/v1/course/course-list/        - List courses
GET  /api/v1/course/search/?search=...  - Search courses
GET  /api/v1/analytics/dashboard/       - Analytics dashboard
POST /api/v1/sso/verify/                - SSO verification
```

### Frontend (React - Currently Offline)

The frontend container is trying to use SSL/HTTPS for a production domain. For local development, run frontend separately:

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"
npm install
npm run dev
```

This will start Vite dev server at: **http://localhost:5173**

---

## Common Commands

### Check All Services
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### View Logs
```powershell
# Backend logs
docker logs lms_backend -f

# Database logs
docker logs lms_postgres -f

# Redis logs
docker logs lms_redis -f

# Frontend logs
docker logs lms_frontend -f
```

### Access Backend Shell
```powershell
docker exec -it lms_backend bash
```

### Django Management Commands
```powershell
# Create superuser
docker exec -it lms_backend python manage.py createsuperuser

# Collect static files
docker exec lms_backend python manage.py collectstatic --noinput

# Run migrations
docker exec lms_backend python manage.py migrate

# Check database status
docker exec lms_backend python manage.py dbshell
```

---

## Quick Testing

### Test Backend API
```powershell
curl http://localhost:8000/api/v1/course/course-list/
```

### Test Admin Panel
1. Go to: http://localhost:8000/admin/
2. Login with: admin / admin123
3. You'll see the Jazzmin admin interface

### Test API Documentation
1. Go to: http://localhost:8000/api/v1/docs/
2. Browse all available endpoints
3. Try making test requests

---

## Troubleshooting

### Frontend SSL Error (Expected)
The frontend container fails because it's configured for production HTTPS. This is normal in development.
- **Solution:** Run frontend locally with `npm run dev` instead

### Backend Not Responding
```powershell
docker restart lms_backend
```

### Database Connection Issues
```powershell
# Check database is running
docker exec lms_postgres psql -U lms_user -d lms_db -c "SELECT 1"
```

### Reset Everything
```powershell
cd "D:\Project\LMSetjen DPD RI"
docker-compose down -v      # Remove containers and volumes
docker-compose up -d        # Start fresh
docker exec lms_backend python manage.py migrate
```

---

## Architecture

```
http://localhost:5173          http://localhost:8000
    (Frontend - React)             (Backend - Django)
         |                              |
         +-- Nginx (Dev Mode)    -- Django REST API
                                       |
                                       +-- PostgreSQL (Port 5432)
                                       +-- Redis (Port 6379)
```

---

## Next Steps

1. ✅ Backend is ready to use
2. 🔄 Fix frontend by running locally:
   ```powershell
   cd frontend
   npm run dev
   ```
3. Or access backend directly at: http://localhost:8000/admin/

---

## Credentials

| Component | Username | Password | URL |
|-----------|----------|----------|-----|
| Admin Panel | admin | admin123 | http://localhost:8000/admin/ |
| PostgreSQL | lms_user | lms_password | localhost:5432 |
| API Base | N/A | JWT Auth | http://localhost:8000/api/v1/ |

---

**System Status: RUNNING ✅**
Start time: 2026-01-23 07:00:00
All core services operational

