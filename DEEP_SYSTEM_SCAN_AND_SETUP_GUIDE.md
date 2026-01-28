# 🔍 DEEP SYSTEM SCAN & COMPLETE SETUP GUIDE
**LMSetjen DPD RI - Learning Management System**  
**Scan Date:** January 23, 2026  
**Status:** ✅ System Ready for Setup & Configuration

---

## 📊 EXECUTIVE SUMMARY

### Project Overview
- **Name:** LMSetjen DPD RI (Learning Management System - Sekretariat Jenderal DPD RI)
- **Architecture:** Full-stack Django REST + React 18
- **Status:** Phase 4.41+ Production Ready
- **Build Time:** ~30-45 minutes for complete local setup
- **Tech Stack:** Python 3.8+, Node.js 14+, PostgreSQL 15, Redis 7

---

## 🔧 CURRENT SYSTEM STATUS

### ⚠️ CRITICAL FINDINGS

#### Missing System Dependencies
- ❌ **Node.js** - NOT installed (required for frontend)
- ❌ **Python** - NOT installed (required for backend)
- ❌ **Docker** - NOT installed (required for database & cache)
- ❌ **PostgreSQL** - NOT available locally

#### Project Configuration Status
- ✅ `.env` file exists with credentials
- ✅ `backend/requirements.txt` configured (47 packages)
- ✅ `frontend/package.json` configured (40+ dependencies)
- ✅ `docker-compose.yml` ready
- ✅ Backend venv exists: `/backend/venv/`
- ✅ Frontend node_modules exists: `/frontend/node_modules/`

### Environment Configuration
- ✅ Database: PostgreSQL 15 (via Docker)
- ✅ Cache: Redis 7 (via Docker)
- ✅ Backend API: Django 4.2.7 on port 8000
- ✅ Frontend Dev: Vite on port 5173
- ✅ Admin UI: Jazzmin on port 8000/admin
- ✅ Google OAuth configured (credentials in .env)

---

## 📁 PROJECT STRUCTURE ANALYSIS

```
LMSetjen DPD RI/
├── backend/
│   ├── api/                      # REST API endpoints (views.py ~5619 lines)
│   ├── userauths/                # User model & authentication
│   ├── core/                     # Django core app
│   ├── backend/
│   │   └── settings.py           # Django settings (573 lines)
│   ├── requirements.txt           # Python dependencies (47 packages)
│   ├── manage.py                 # Django management
│   ├── venv/                     # Virtual environment (exists)
│   ├── media/                    # Uploaded files
│   ├── static/                   # CSS, JS
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── views/                # Page components (admin, instructor, student)
│   │   ├── components/           # Reusable UI components
│   │   ├── utils/                # Helpers, axios wrapper
│   │   ├── store/                # Global state (context)
│   │   └── App.jsx               # Main app with routes
│   ├── package.json              # Node dependencies (40+ packages)
│   ├── vite.config.js            # Vite build config
│   ├── node_modules/             # Dependencies (exists)
│   └── Dockerfile
├── docker-compose.yml            # Services orchestration
├── .env                          # Environment variables (configured)
└── docker/                       # Docker configurations
```

### Key Configuration Files

| File | Status | Purpose |
|------|--------|---------|
| `.env` | ✅ Active | Credentials & API keys |
| `backend/requirements.txt` | ✅ Ready | Python packages |
| `frontend/package.json` | ✅ Ready | Node packages |
| `docker-compose.yml` | ✅ Ready | Docker services |
| `backend/backend/settings.py` | ✅ Configured | Django settings |
| `frontend/.env` | ✅ Configured | Frontend config |

---

## 🎯 SETUP OPTIONS & RECOMMENDATIONS

### Option A: ⚡ HYBRID SETUP (Recommended for Development)
**Difficulty:** Easy | **Time:** 20 minutes | **Control:** High

**What:** 
- Docker for PostgreSQL + Redis (managed)
- Python venv + Django dev server (local)
- Node dev server (local)

**Advantages:**
- Easy to modify code and see changes
- Database/Redis managed automatically
- Best debugging experience
- Closest to production structure

**Disadvantages:**
- Requires Node.js, Python, Docker installed

---

### Option B: 🐳 FULL DOCKER SETUP (Easiest)
**Difficulty:** Very Easy | **Time:** 5 minutes | **Control:** Low

**What:**
- Everything containerized in Docker
- One command to start all services

**Advantages:**
- Fastest setup
- No system dependencies except Docker
- Isolated environment
- Closest to production

**Disadvantages:**
- Requires Docker Desktop
- Slower debugging
- Limited live code editing

---

### Option C: 💻 FULL LOCAL SETUP (Advanced)
**Difficulty:** Hard | **Time:** 45 minutes | **Control:** Very High

**What:**
- Python venv (local)
- Node dev server (local)
- PostgreSQL locally installed
- Redis locally installed

**Advantages:**
- No Docker overhead
- Full control

**Disadvantages:**
- Complex setup
- Need PostgreSQL & Redis installed
- Hard to replicate production

---

## 🚀 STEP-BY-STEP SETUP

### PHASE 1: Install System Dependencies

#### 1.1 Install Node.js (Windows)

**Option A: Using Chocolatey (Recommended)**
```powershell
# Run as Administrator
choco install nodejs

# Verify
node --version
npm --version
```

**Option B: Manual Download**
- Visit: https://nodejs.org/
- Download LTS version (18+)
- Run installer, follow default options
- Restart terminal and verify:
```powershell
node --version   # Should show v18.x.x or higher
npm --version    # Should show 9.x or higher
```

#### 1.2 Install Python (Windows)

**Option A: Using Chocolatey**
```powershell
# Run as Administrator
choco install python --version=3.11

# Verify
python --version
pip --version
```

**Option B: Manual Download**
- Visit: https://www.python.org/downloads/
- Download Python 3.11+ (NOT 3.12, has issues with some packages)
- **IMPORTANT:** Check "Add Python to PATH" during installation
- Restart terminal and verify:
```powershell
python --version   # Should show 3.11.x or 3.10.x
pip --version      # Should show pip 23.x or higher
```

#### 1.3 Install Docker Desktop (Windows)

**For Windows 11/10 Pro/Enterprise:**
- Visit: https://www.docker.com/products/docker-desktop
- Download and run installer
- Enable WSL 2 (Windows Subsystem for Linux) during installation
- Restart computer
- Verify:
```powershell
docker --version    # Should show Docker 24.x or higher
docker run hello-world  # Should print "Hello from Docker!"
```

**For Windows 10 Home:**
- Install WSL 2: https://docs.microsoft.com/en-us/windows/wsl/install
- Then install Docker Desktop
- Or use Docker Toolbox (alternative)

---

### PHASE 2: Verify Project Structure

```powershell
cd "D:\Project\LMSetjen DPD RI"

# Check backend
Test-Path .\backend\venv
Test-Path .\backend\requirements.txt
Test-Path .\backend\manage.py

# Check frontend
Test-Path .\frontend\package.json
Test-Path .\frontend\node_modules
Test-Path .\frontend\src

# Check environment
Test-Path .\.env
```

Expected output: All should show `True`

---

### PHASE 3: HYBRID SETUP (Recommended)

#### 3.1 Start Database & Cache

```powershell
cd "D:\Project\LMSetjen DPD RI"

# Start PostgreSQL & Redis containers
docker-compose up -d postgres redis

# Wait 10 seconds for services to be ready
Start-Sleep -Seconds 10

# Verify services are running
docker-compose ps
```

**Expected Output:**
```
CONTAINER ID    IMAGE              STATUS
xxx             postgres:15-alpine  Up (healthy)
yyy             redis:7-alpine     Up (healthy)
```

#### 3.2 Setup Backend (Terminal 1)

```powershell
cd "D:\Project\LMSetjen DPD RI\backend"

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install/update dependencies
pip install -r requirements.txt --upgrade

# Run migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser
# Follow prompts:
# Username: admin
# Email: admin@example.com
# Password: (choose strong password)

# Start development server
python manage.py runserver
```

**Expected Output:**
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

✅ Backend is now running at: http://localhost:8000

#### 3.3 Setup Frontend (Terminal 2 - NEW)

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"

# Install dependencies (skip if node_modules already exists)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

✅ Frontend is now running at: http://localhost:5173

---

### PHASE 4: Verify Everything Works

#### 4.1 Test Backend

**In PowerShell:**
```powershell
# Check backend health
curl http://localhost:8000/api/v1/

# Should return JSON with available endpoints
```

**In Browser:**
- Admin Panel: http://localhost:8000/admin
- API Docs: http://localhost:8000/api/v1/api-docs/
- Swagger UI: http://localhost:8000/api/v1/swagger/

#### 4.2 Test Frontend

**In Browser:**
- Frontend: http://localhost:5173
- Try logging in with admin credentials created in step 3.2

#### 4.3 Test Database

```powershell
# Check database connection
docker-compose exec postgres psql -U lms_user -d lms_db -c "SELECT version();"
```

#### 4.4 Test Cache

```powershell
# Check Redis connection
docker-compose exec redis redis-cli ping
# Should output: PONG
```

---

## 📊 SERVICE ENDPOINTS MAP

| Service | URL | Username | Purpose |
|---------|-----|----------|---------|
| Frontend | http://localhost:5173 | N/A | React App |
| Backend API | http://localhost:8000/api/v1/ | N/A | REST API |
| Django Admin | http://localhost:8000/admin | admin | Management |
| API Docs (Swagger) | http://localhost:8000/api/v1/swagger/ | N/A | API Documentation |
| API Docs (Redoc) | http://localhost:8000/api/v1/redoc/ | N/A | API Docs (alternative) |
| Database | localhost:5432 | lms_user | PostgreSQL |
| Cache | localhost:6379 | N/A | Redis |

---

## 🔐 ENVIRONMENT VARIABLES EXPLAINED

### Current `.env` Configuration

```dotenv
# Database
DB_NAME=lms_db
DB_USER=lms_user
DB_PASSWORD=TRMahFG4uFduZvmmWnaHNbau_6gQiAym
DB_HOST=db (Docker) or localhost (Local)
DB_PORT=5432

# Cache
REDIS_PASSWORD=YqNYfeHpLMIk7x01YqqEje08jLgHjj3Y
REDIS_HOST=redis (Docker) or localhost (Local)

# Django
SECRET_KEY=V)7#Ax)qK0!9P;#:Y!w%%u1=4~ux([AeX...
DEBUG=False (set to True for dev)
ALLOWED_HOSTS=lmsetjendpdri.duckdns.org,localhost,127.0.0.1

# Frontend URLs
FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org

# Email
SENDGRID_API_KEY=SG.yr6y_IzIRIGOOj9VdAis6A...
FROM_EMAIL=sdm@dpd.go.id

# Google OAuth
GOOGLE_CLIENT_ID=634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com
```

### For Local Development

**Modify `.env` for local setup:**
```dotenv
DEBUG=True
DB_HOST=localhost  # Changed from 'db'
REDIS_HOST=localhost  # Changed from 'redis'
FRONTEND_SITE_URL=http://localhost:5173
BACKEND_SITE_URL=http://localhost:8000
```

---

## 🛠️ COMMON TASKS

### Restart Everything Fresh

```powershell
# Stop everything
docker-compose down

# Remove all data (WARNING: deletes database)
docker-compose down -v

# Start fresh
docker-compose up -d postgres redis

# Then in backend terminal:
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Stop Services

```powershell
# Stop all Docker services
docker-compose stop

# Stop specific service
docker-compose stop postgres
docker-compose stop redis

# Kill frontend/backend servers
# In their terminals: Ctrl+C
```

### View Logs

```powershell
# Backend logs (in backend terminal)
python manage.py runserver  # Shows in terminal

# Frontend logs (in frontend terminal)
npm run dev  # Shows in terminal

# Docker logs
docker-compose logs -f postgres   # Database logs
docker-compose logs -f redis      # Cache logs
```

### Reset Database

```powershell
# WARNING: This deletes all data!

docker-compose down -v
docker-compose up -d postgres redis
cd backend
python manage.py migrate
python manage.py createsuperuser
```

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] Node.js installed: `node --version` (18+)
- [ ] Python installed: `python --version` (3.8+)
- [ ] Docker running: `docker --version`
- [ ] PostgreSQL running: `docker-compose ps` shows postgres ✓
- [ ] Redis running: `docker-compose ps` shows redis ✓
- [ ] Backend migrations applied: No errors in backend terminal
- [ ] Superuser created: Admin login works
- [ ] Frontend builds: `npm install` completes
- [ ] Frontend runs: http://localhost:5173 loads
- [ ] Backend API responds: http://localhost:8000/api/v1/ returns JSON
- [ ] Admin panel loads: http://localhost:8000/admin accepts login
- [ ] Database accessible: `docker-compose exec postgres psql...` works
- [ ] Redis responsive: `docker-compose exec redis redis-cli ping` returns PONG

---

## 🐛 TROUBLESHOOTING

### Issue: Node.js not found
**Solution:**
```powershell
# Install Node.js
choco install nodejs
# OR download from https://nodejs.org/

# Restart PowerShell and verify
node --version
```

### Issue: Python not found
**Solution:**
```powershell
# Install Python
choco install python
# OR download from https://www.python.org/

# IMPORTANT: Check "Add Python to PATH" during installation
# Restart PowerShell and verify
python --version
```

### Issue: Docker not running
**Solution:**
```powershell
# Start Docker Desktop
# Or in terminal:
wsl --install  # (Windows Subsystem for Linux)

# Then start Docker
```

### Issue: Port 5173 already in use
**Solution:**
```powershell
# Kill process on port 5173
$process = Get-NetTCPConnection -LocalPort 5173 | Select-Object -First 1
Stop-Process -Id $process.OwningProcess -Force

# OR start frontend on different port
npm run dev -- --port 3000
```

### Issue: Port 8000 already in use
**Solution:**
```powershell
# Kill process on port 8000
$process = Get-NetTCPConnection -LocalPort 8000 | Select-Object -First 1
Stop-Process -Id $process.OwningProcess -Force

# OR start backend on different port
python manage.py runserver 0.0.0.0:8001
```

### Issue: PostgreSQL connection refused
**Solution:**
```powershell
# Check if containers are running
docker-compose ps

# If not, start them
docker-compose up -d postgres redis

# Wait 10 seconds and try again
Start-Sleep -Seconds 10

# Check logs
docker-compose logs postgres
```

### Issue: ModuleNotFoundError in backend
**Solution:**
```powershell
cd backend

# Activate venv
.\venv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Try again
python manage.py runserver
```

### Issue: npm ERR! ERESOLVE unable to resolve dependency tree
**Solution:**
```powershell
cd frontend

# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# Reinstall
npm install

# If still fails, try with legacy peer deps
npm install --legacy-peer-deps
```

---

## 📚 USEFUL DOCUMENTATION LINKS

- [Django Documentation](https://docs.djangoproject.com/en/4.2/)
- [React Documentation](https://react.dev)
- [REST Framework](https://www.django-rest-framework.org/)
- [Vite Documentation](https://vitejs.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Docker Documentation](https://docs.docker.com/)

---

## 🎓 LEARNING RESOURCES

### Backend (Django/DRF)
- Project Structure: See `backend/api/` for REST endpoints
- Models: `backend/api/models.py` (~1797 lines)
- Views: `backend/api/views.py` (~5619 lines)
- Permissions: `backend/api/permissions.py` (RBAC)

### Frontend (React)
- Routes: `frontend/src/App.jsx` (lazy-loaded components)
- Components: `frontend/src/components/`
- Views: `frontend/src/views/` (organized by role)
- Utils: `frontend/src/utils/` (axios, hooks)

---

## 📞 NEXT STEPS

After successful setup:

1. **Explore Django Admin:**
   - Create users with different roles (student, teacher, admin)
   - Add courses
   - Test enrollment

2. **Test Frontend:**
   - Login with different roles
   - Try creating/viewing courses
   - Test search functionality
   - Check responsive design

3. **Review Code:**
   - Backend: `backend/api/views.py` for API logic
   - Frontend: `frontend/src/components/` for UI components
   - Configuration: `backend/backend/settings.py`

4. **Customization:**
   - Modify course structure in `backend/api/models.py`
   - Update styles in `frontend/src/` CSS files
   - Add new API endpoints in `backend/api/views.py`
   - Add new React pages in `frontend/src/views/`

---

## ✨ FINAL NOTES

- This is **Phase 4.41+** production-ready code
- Full-text search, Google OAuth, and advanced analytics included
- Responsive design (Bootstrap 5)
- JWT-based authentication
- Role-based access control (RBAC)
- Database: PostgreSQL with search indexes
- Cache: Redis for performance

**Good luck! 🚀**

