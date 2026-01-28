# ✅ INSTALLATION VERIFICATION CHECKLIST

**Project:** LMSetjen DPD RI  
**Date:** January 23, 2026  
**Last Updated:** Just Now

---

## 📋 SYSTEM REQUIREMENTS CHECK

### Before You Start

- [ ] **Windows 10/11 or Mac/Linux** - Supported OS
- [ ] **Administrator Access** - Needed for some installs
- [ ] **Internet Connection** - For downloading packages
- [ ] **~5GB Disk Space** - For Docker images & dependencies
- [ ] **~8GB RAM Minimum** - For comfortable development

---

## 🛠️ DEPENDENCY INSTALLATION

### Node.js Installation

**Verify Node.js:**
```powershell
node --version
# Expected: v18.x.x or higher
# ✅ If you see version: SUCCESS
# ❌ If error: Install from https://nodejs.org/
```

**Verify npm:**
```powershell
npm --version
# Expected: 9.x.x or higher
# ✅ If you see version: SUCCESS
```

- [ ] **Node.js installed** - `node --version` works
- [ ] **npm installed** - `npm --version` works
- [ ] **Node version 14+** - (18+ recommended)
- [ ] **npm version 8+** - (9+ recommended)

### Python Installation

**Verify Python:**
```powershell
python --version
# Expected: Python 3.8 - 3.11
# ✅ If you see version: SUCCESS
# ❌ If error: Install from https://www.python.org/
```

**Verify pip:**
```powershell
pip --version
# Expected: pip 23.x or higher
# ✅ If you see version: SUCCESS
```

- [ ] **Python installed** - `python --version` works
- [ ] **Python version 3.8+** - (3.11 recommended)
- [ ] **pip installed** - `pip --version` works
- [ ] **pip version 22+**

### Docker Installation

**Verify Docker:**
```powershell
docker --version
# Expected: Docker 24.x or higher
# ✅ If you see version: SUCCESS
# ❌ If error: Install from https://www.docker.com/

docker run hello-world
# ✅ If prints "Hello from Docker!": SUCCESS
# ❌ If error: Start Docker Desktop or install WSL2
```

- [ ] **Docker installed** - `docker --version` works
- [ ] **Docker running** - `docker run hello-world` succeeds
- [ ] **Docker Compose installed** - Usually included
- [ ] **WSL2 enabled** - (Windows only, usually auto-installed)

---

## 🏗️ PROJECT STRUCTURE VERIFICATION

**Run this in PowerShell:**
```powershell
cd "D:\Project\LMSetjen DPD RI"

# Check directories exist
Test-Path .\backend              # Should show: True
Test-Path .\frontend             # Should show: True
Test-Path .\docker               # Should show: True

# Check key files
Test-Path .\docker-compose.yml   # Should show: True
Test-Path .\backend\manage.py    # Should show: True
Test-Path .\frontend\package.json # Should show: True
Test-Path .\.env                 # Should show: True
```

**All should return `True`**

- [ ] Backend folder exists
- [ ] Frontend folder exists
- [ ] docker-compose.yml exists
- [ ] .env file exists
- [ ] manage.py exists
- [ ] package.json exists

---

## 📦 BACKEND SETUP VERIFICATION

### Virtual Environment

```powershell
cd "D:\Project\LMSetjen DPD RI\backend"

# Check if venv exists
Test-Path .\venv                 # Should show: True

# Activate it
.\venv\Scripts\Activate.ps1

# Should see (venv) in prompt now
# ✅ If "(venv)" appears: SUCCESS
# ❌ If error: Run: python -m venv venv
```

- [ ] Backend venv folder exists
- [ ] Can activate venv - `.\venv\Scripts\Activate.ps1`
- [ ] (venv) shows in PowerShell prompt

### Python Dependencies

```powershell
# Make sure venv is activated (you should see "(venv)" in prompt)
pip list | grep Django

# Expected output:
# Django           4.2.7
# djangorestframework  3.14.0
```

**If you don't see these packages:**
```powershell
# Reinstall requirements
pip install -r requirements.txt --upgrade
```

- [ ] Django 4.2.7 installed
- [ ] djangorestframework 3.14.0 installed
- [ ] psycopg2-binary installed
- [ ] All packages from requirements.txt installed

### Django Configuration

```powershell
# Make sure venv is activated
cd backend

# Check Django setup
python manage.py check

# Expected: "System check identified no issues (0 silenced)."
# ✅ If success: SUCCESS
# ❌ If errors: Check logs and fix issues
```

- [ ] `python manage.py check` shows no errors
- [ ] Django can connect to settings
- [ ] All apps are configured correctly

---

## 🐳 DOCKER SERVICES VERIFICATION

### Start Services

```powershell
cd "D:\Project\LMSetjen DPD RI"

# Start containers
docker-compose up -d postgres redis

# Wait 10 seconds
Start-Sleep -Seconds 10

# Check status
docker-compose ps

# Expected output shows:
# - lms_postgres: Up (healthy)
# - lms_redis: Up (healthy)
```

**If containers not healthy:**
```powershell
docker-compose logs postgres  # Check database logs
docker-compose logs redis     # Check cache logs
docker-compose down           # Stop all
docker-compose up -d postgres redis  # Restart
```

- [ ] PostgreSQL container running
- [ ] PostgreSQL shows "(healthy)" status
- [ ] Redis container running
- [ ] Redis shows "(healthy)" status
- [ ] Both containers accessible

### Database Connection

```powershell
# Test PostgreSQL connection
docker-compose exec postgres psql -U lms_user -d lms_db -c "SELECT version();"

# Should print PostgreSQL version
# ✅ If success: SUCCESS
# ❌ If error: Check containers are healthy
```

- [ ] Can connect to PostgreSQL
- [ ] Database credentials work
- [ ] Database "lms_db" exists
- [ ] Database user "lms_user" exists

### Cache Connection

```powershell
# Test Redis connection
docker-compose exec redis redis-cli ping

# Should print: PONG
# ✅ If PONG: SUCCESS
# ❌ If error: Check container is running
```

- [ ] Can connect to Redis
- [ ] Redis responds to ping
- [ ] Redis password works
- [ ] Cache is accessible

---

## 💻 FRONTEND SETUP VERIFICATION

### Dependencies Installation

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"

# Check if node_modules exists
Test-Path .\node_modules         # Should show: True

# If not, install
npm install

# Verify key packages
npm list react
npm list react-router-dom
npm list axios
npm list bootstrap
```

- [ ] node_modules folder exists
- [ ] React 18.2.0 installed
- [ ] React Router 6.10.0 installed
- [ ] Axios 1.6.5 installed
- [ ] Bootstrap 5.3.2 installed
- [ ] No npm errors during install

### Vite Configuration

```powershell
# Check vite config exists
Test-Path .\vite.config.js      # Should show: True

# Test build (optional)
npm run build

# Should complete without errors
# ✅ If build succeeds: SUCCESS
# ❌ If errors: Check npm output
```

- [ ] vite.config.js exists
- [ ] npm run build completes
- [ ] dist folder created after build
- [ ] No build errors

### Environment Configuration

```powershell
# Check .env exists
Test-Path .\.env                # Should show: True

# Check critical variables
$env = Get-Content .\.env | ConvertFrom-StringData
$env.VITE_API_URL
# Should show: http://localhost:8000

$env.VITE_GOOGLE_CLIENT_ID
# Should show: 634643429020-...
```

- [ ] frontend/.env file exists
- [ ] VITE_API_URL is set
- [ ] VITE_GOOGLE_CLIENT_ID is set
- [ ] All required variables present

---

## 🗄️ DATABASE & MIGRATIONS VERIFICATION

### Run Migrations

```powershell
cd "D:\Project\LMSetjen DPD RI\backend"

# Activate venv
.\venv\Scripts\Activate.ps1

# Run migrations
python manage.py migrate

# Expected: "Running migrations..." followed by success messages
# ✅ If success: SUCCESS
# ❌ If errors: Check database connection and Django setup
```

- [ ] Migrations run without errors
- [ ] No "NO such table" errors
- [ ] All apps migrated successfully
- [ ] Database schema created

### Verify Database Tables

```powershell
# Connect to database and check tables
docker-compose exec postgres psql -U lms_user -d lms_db -c "\dt"

# Should show list of tables:
# - api_course
# - api_enrollment
# - userauths_user
# - (many more)
```

- [ ] Database has created tables
- [ ] api_course table exists
- [ ] userauths_user table exists
- [ ] All expected tables present

---

## 👤 SUPERUSER CREATION VERIFICATION

### Create Admin Account

```powershell
cd "D:\Project\LMSetjen DPD RI\backend"

# Activate venv
.\venv\Scripts\Activate.ps1

# Create superuser
python manage.py createsuperuser

# Follow the prompts:
# Username: admin (or your choice)
# Email: admin@example.com (or any email)
# Password: (type and confirm - won't echo)

# Expected: "Superuser created successfully"
# ✅ If success: SUCCESS
```

- [ ] Superuser creation runs
- [ ] Username chosen and confirmed
- [ ] Email provided
- [ ] Password set and confirmed
- [ ] Success message shown

### Verify Login Works

```powershell
# In Django admin (you'll test this in browser)
# After starting server, go to: http://localhost:8000/admin

# Try logging in with credentials you just created
# ✅ If login succeeds: SUCCESS
# ❌ If login fails: Check username/password
```

- [ ] Can access Django admin
- [ ] Superuser login works
- [ ] Admin dashboard loads

---

## ✅ FINAL STARTUP TEST

### Backend Startup

```powershell
cd "D:\Project\LMSetjen DPD RI\backend"

# Activate venv
.\venv\Scripts\Activate.ps1

# Start server
python manage.py runserver

# Expected output:
# Starting development server at http://127.0.0.1:8000/
# Quit the server with CONTROL-C

# ✅ If you see this: BACKEND READY
# ❌ If errors: Check all previous steps
```

- [ ] Backend server starts
- [ ] No errors in console
- [ ] Shows "Starting development server..."
- [ ] Can press Ctrl+C to stop

### Frontend Startup

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"

# Start dev server
npm run dev

# Expected output:
#   VITE v4.x.x ready in xxx ms
#   ➜  Local:   http://localhost:5173/
#   ➜  press h to show help

# ✅ If you see this: FRONTEND READY
# ❌ If errors: Check npm dependencies
```

- [ ] Frontend dev server starts
- [ ] Shows Vite startup message
- [ ] Local URL shows: http://localhost:5173
- [ ] Can press 'h' for help

### Browser Access Test

**Keep both servers running and test in browser:**

```
Frontend:  http://localhost:5173       ✅ Should load React app
Backend:   http://localhost:8000       ✅ Should show API
Admin:     http://localhost:8000/admin ✅ Should show login
Swagger:   http://localhost:8000/api/v1/swagger/ ✅ Should show API docs
```

- [ ] Frontend loads at localhost:5173
- [ ] Backend API responds at localhost:8000
- [ ] Admin login accessible
- [ ] API documentation loads

### Login Test

```
1. Go to http://localhost:5173/login (or click Login button)
2. Enter your admin credentials:
   - Username: admin (or your superuser name)
   - Password: (what you set during createsuperuser)
3. Click Login

✅ If you see dashboard: SUCCESS
❌ If error: Check credentials and CORS settings
```

- [ ] Login page loads
- [ ] Can enter credentials
- [ ] Login redirects to dashboard
- [ ] Dashboard shows after login

---

## 🎉 ALL CHECKS COMPLETE?

If all items are checked:

✅ **You're ready to go!**

Your LMSetjen DPD RI system is:
- ✅ Properly installed
- ✅ Fully configured
- ✅ Running and accessible
- ✅ Ready for development

---

## 🆘 ISSUES?

If any step failed:

1. **Check the error message carefully**
   - It usually tells you what's wrong

2. **Review the relevant section**
   - Go back to the section that failed
   - Follow troubleshooting steps

3. **Check the documentation**
   - `DEEP_SYSTEM_SCAN_AND_SETUP_GUIDE.md` - Full setup
   - `COMPREHENSIVE_TECHNICAL_ANALYSIS.md` - Technical details
   - `README.md` - Project overview

4. **Check logs**
   - Backend: View terminal output
   - Frontend: View npm console
   - Docker: `docker-compose logs -f`

---

**Setup Date:** January 23, 2026  
**System Status:** ✅ Ready  
**Next Action:** Start building! 🚀

