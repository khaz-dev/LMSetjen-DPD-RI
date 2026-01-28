# 🚀 QUICK REFERENCE - GET UP & RUNNING IN 30 MINUTES

**LMSetjen DPD RI**  
**Status:** ✅ Ready to Setup  
**Date:** January 23, 2026

---

## ⚡ THE 3-STEP PROCESS

### STEP 1: Install Requirements (5 min)
```powershell
# Windows: Run these ONE TIME

# Install Node.js (if needed)
choco install nodejs

# Install Python (if needed)
choco install python

# Install Docker (if needed)
# Download from: https://www.docker.com/products/docker-desktop
```

### STEP 2: Run Automated Setup (15 min)
```powershell
# Go to project root
cd "D:\Project\LMSetjen DPD RI"

# Run setup script
.\SETUP_SCRIPT.ps1

# This will:
# ✅ Check all dependencies
# ✅ Start Docker services (PostgreSQL + Redis)
# ✅ Install Python packages
# ✅ Install Node packages
# ✅ Run database migrations
```

### STEP 3: Start Services (10 min)

**Terminal 1 - Backend:**
```powershell
cd backend
.\venv\Scripts\Activate.ps1

# Create admin user (one-time)
python manage.py createsuperuser
# Follow prompts - remember the password!

# Start server
python manage.py runserver
# Wait for: "Starting development server at http://127.0.0.1:8000/"
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
# Wait for: "VITE v4.x.x ready"
```

---

## 🌐 WHAT YOU'LL SEE

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:5173 | ✅ React App |
| Backend | http://localhost:8000 | ✅ API Server |
| Admin Panel | http://localhost:8000/admin | ✅ Django Admin |
| API Docs | http://localhost:8000/api/v1/swagger/ | ✅ Documentation |

---

## 🔑 LOGIN CREDENTIALS

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | *You created this* |

**Where to login:**
1. Frontend: http://localhost:5173/login
2. Admin: http://localhost:8000/admin

---

## 📝 BASIC TROUBLESHOOTING

### ❌ "Node not found"
```powershell
choco install nodejs
```

### ❌ "Python not found"
```powershell
choco install python
```

### ❌ "Docker not running"
```powershell
# Start Docker Desktop manually
# Or ensure WSL2 is installed on Windows
```

### ❌ "Port 5173 already in use"
```powershell
npm run dev -- --port 3000
```

### ❌ "Port 8000 already in use"
```powershell
python manage.py runserver 8001
```

### ❌ "Database connection refused"
```powershell
docker-compose ps  # Check if running
docker-compose up -d postgres redis  # Start if needed
```

---

## 📚 NEXT STEPS

After everything is running:

1. **Explore the Admin Panel:**
   - http://localhost:8000/admin
   - Create test users
   - Create test courses

2. **Test Frontend:**
   - Visit http://localhost:5173
   - Try logging in
   - Explore course listings

3. **Review Code:**
   - Backend API: `backend/api/views.py`
   - Frontend UI: `frontend/src/views/`

4. **Make Changes:**
   - Modify code and see live changes
   - API auto-reloads on save
   - Frontend auto-reloads on save

---

## 🛑 COMMON GOTCHAS

✅ **Virtual Environment Matters**
- Always activate venv before running backend: `.\venv\Scripts\Activate.ps1`
- Check if (venv) appears in prompt

✅ **Docker Needs Time**
- PostgreSQL takes ~5-10 seconds to become healthy
- Wait before running migrations

✅ **Migrations Are Important**
- Always run: `python manage.py migrate`
- This creates database tables

✅ **Port Numbers Matter**
- Frontend: 5173 (not 3000!)
- Backend: 8000
- PostgreSQL: 5432
- Redis: 6379

✅ **CORS Errors**
- These happen when frontend/backend URLs don't match
- Check `.env` file CORS settings

---

## 🚀 YOU'RE READY!

Everything is configured and ready to go. Just:
1. Run the setup script
2. Start backend server
3. Start frontend server
4. Visit http://localhost:5173

**Questions?** See the full guides:
- **Setup Guide:** `DEEP_SYSTEM_SCAN_AND_SETUP_GUIDE.md`
- **Technical Details:** `COMPREHENSIVE_TECHNICAL_ANALYSIS.md`
- **Project Overview:** `README.md`

---

**Happy coding! 🎉**

