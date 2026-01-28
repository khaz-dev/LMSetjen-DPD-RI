# QUICK START: Frontend + Backend

**Project:** LMSetjen DPD RI | **Date:** January 21, 2026

---

## 🚀 START HERE (Hybrid - Recommended)

### 1️⃣ Start Database & Cache (1 minute)
```bash
cd "D:\Project\LMSetjen DPD RI"
docker-compose up -d postgres redis
```
✅ PostgreSQL running on 5432  
✅ Redis running on 6379

### 2️⃣ Start Backend (3 minutes - NEW TERMINAL 1)
```bash
cd backend
venv\Scripts\activate
python manage.py migrate
python manage.py createsuperuser  # Setup admin user
python manage.py runserver
```
✅ Backend running on http://localhost:8000

### 3️⃣ Start Frontend (3 minutes - NEW TERMINAL 2)
```bash
cd frontend
npm install  # Skip if node_modules exists
npm run dev
```
✅ Frontend running on http://localhost:5173

---

## 📍 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | React app |
| Backend API | http://localhost:8000/api/v1/ | REST API |
| Admin Panel | http://localhost:8000/admin | Django admin |
| API Docs | http://localhost:8000/api/docs/ | Swagger docs |

---

## 🎯 Default Credentials

**Admin User:** (created during setup)
- Username: `admin` (or your choice)
- Password: (your choice)

**Access:**
- Admin Panel: http://localhost:8000/admin
- Login with superuser credentials

---

## ⚡ Common Tasks

### Watch Logs (troubleshooting)

**Backend logs:**
```bash
cd backend
python manage.py runserver  # Shows output in terminal
```

**Frontend logs:**
```bash
cd frontend
npm run dev  # Shows output in terminal
```

**Docker logs:**
```bash
docker-compose logs -f postgres  # Database
docker-compose logs -f redis     # Cache
```

### Restart Everything

```bash
# Kill all services
docker-compose down

# Start fresh
docker-compose up -d postgres redis
# Then restart backend & frontend terminals
```

### Reset Database

```bash
# Delete all data and rebuild
docker-compose down -v
docker-compose up -d postgres redis

cd backend
python manage.py migrate
python manage.py createsuperuser
```

### Stop Services

```bash
# Stop Docker (keeps data)
docker-compose stop

# Stop completely (deletes containers)
docker-compose down

# Stop completely with data wipe
docker-compose down -v
```

---

## 🛠️ Development Workflow

### Terminal Layout (3 terminals)

```
Terminal 1: Backend
├─ cd backend
├─ venv\Scripts\activate
└─ python manage.py runserver

Terminal 2: Frontend
├─ cd frontend
└─ npm run dev

Terminal 3: Monitor (optional)
├─ docker-compose ps
├─ docker-compose logs -f
└─ Keep track of services
```

### File Changes Auto-Apply

✅ **Backend:** Changes reload automatically (watch for message in terminal)  
✅ **Frontend:** Changes hot-reload (page refreshes automatically)  
✅ **Database:** Must restart if schema changed

---

## ❌ Common Issues & Fixes

### Port Already in Use

**Issue:** `Address already in use`

**Fix:**
```bash
# Find process on port
netstat -ano | findstr :5173  # Frontend
netstat -ano | findstr :8000  # Backend

# Kill process
taskkill /PID <PID> /F
```

### Frontend Can't Connect to Backend

**Issue:** CORS error in console

**Fix:** Ensure `.env` has correct backend URL
```env
# In backend/.env
CORS_ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_SITE_URL=http://localhost:5173
```

### Node Modules Issues

**Issue:** `Module not found` error

**Fix:** Reinstall packages
```bash
cd frontend
rm -r node_modules
npm install
npm run dev
```

### Database Connection Error

**Issue:** `Connection refused localhost:5432`

**Fix:** Start PostgreSQL
```bash
docker-compose up -d postgres redis
```

### Venv Not Activated

**Issue:** `'python' is not recognized`

**Fix:** Activate venv in your terminal
```bash
cd backend
venv\Scripts\activate  # (venv) should appear in prompt
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────┐
│         Browser (User)                  │
│   http://localhost:5173                 │
└────────────┬────────────────────────────┘
             │
    ┌────────▼─────────────────────┐
    │   Frontend (React 18)        │
    │   http://localhost:5173      │
    │                              │
    │  • Vite dev server           │
    │  • Hot reload                │
    │  • SPA routing               │
    └────────┬──────────────────────┘
             │
    ┌────────▼──────────────────────────────┐
    │    Backend (Django 4.2)               │
    │    http://localhost:8000              │
    │                                       │
    │  • REST API endpoints                 │
    │  • JWT authentication                 │
    │  • Business logic                     │
    └────────┬─────────┬─────────────────────┘
             │         │
    ┌────────▼──┐  ┌───▼──────────┐
    │ PostgreSQL│  │   Redis      │
    │  15-alpine│  │  7-alpine    │
    │ :5432     │  │  :6379       │
    └───────────┘  └──────────────┘
```

---

## 🐳 Docker Services Status

```bash
# Check all services
docker-compose ps

# Expected output:
# NAME           STATUS
# lms_postgres   Up (healthy)
# lms_redis      Up (healthy)
```

---

## 📚 Project Structure

### Frontend (`frontend/`)
- **src/views/** - Page components (by role: admin, instructor, student)
- **src/components/** - Reusable UI components
- **src/utils/** - API wrapper, hooks
- **src/store/** - Global state (Zustand)
- **src/styles/** - CSS files

### Backend (`backend/`)
- **api/** - Main LMS app with 80+ endpoints
- **userauths/** - Authentication & user management
- **backend/** - Django settings
- **venv/** - Python virtual environment

---

## 🔐 Security Notes

⚠️ **Development Only:**
- DEBUG=True in .env
- Secret key in plain text
- CORS open to localhost

**Before Production:**
- Set DEBUG=False
- Generate new SECRET_KEY
- Use environment secrets
- Configure HTTPS
- Restrict CORS

---

## 📞 Useful Links

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api/v1/
- **Admin Panel:** http://localhost:8000/admin
- **API Docs:** http://localhost:8000/api/docs/
- **Django Shell:** `python manage.py shell`
- **React DevTools:** Browser extension (recommended)

---

## ✅ Checklist (First Time)

- [ ] Docker installed and running
- [ ] Python venv created in backend/
- [ ] npm packages installed in frontend/
- [ ] PostgreSQL container running
- [ ] Redis container running
- [ ] Django migrations run
- [ ] Superuser created
- [ ] Backend starts on 8000
- [ ] Frontend starts on 5173
- [ ] Can access admin panel
- [ ] Can see API in Swagger docs

---

## 🎓 Next Steps

1. **Explore the code** - Check `frontend/src/App.jsx` and `backend/api/views.py`
2. **Create a course** - Use admin panel or API
3. **Enroll a student** - Practice workflow
4. **Check the database** - Use `python manage.py shell`
5. **Read documentation** - See FRONTEND_BACKEND_SETUP_GUIDE.md

---

**Last Updated:** January 21, 2026  
**Status:** ✅ Ready to Use
