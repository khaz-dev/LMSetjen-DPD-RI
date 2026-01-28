@echo off
REM ============================================
REM LMSetjen DPD RI - Setup Script (Batch)
REM Hybrid Setup: Docker + Local Dev Servers
REM ============================================

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════════╗
echo ║  LMSetjen DPD RI - Setup Script           ║
echo ║  Hybrid Setup: Docker + Local Dev         ║
echo ╚════════════════════════════════════════════╝
echo.

REM ============================================
REM PHASE 1: Check Dependencies
REM ============================================

echo 🔍 PHASE 1: Checking Dependencies...
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js NOT found
    echo    Install from: https://nodejs.org/
    echo    Or run: choco install nodejs
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo ✅ Node.js found: %NODE_VER%

REM Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm NOT found
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo ✅ npm found: %NPM_VER%

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python NOT found
    echo    Install from: https://www.python.org/
    echo    Or run: choco install python
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VER=%%i
echo ✅ Python found: %PYTHON_VER%

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker NOT found
    echo    Install from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VER=%%i
echo ✅ Docker found: %DOCKER_VER%

echo.
echo ✅ All dependencies installed!
echo.

REM ============================================
REM PHASE 2: Start Docker Services
REM ============================================

echo 🐳 PHASE 2: Starting Docker Services...
echo.

cd /d "%~dp0"

echo    Starting PostgreSQL and Redis...
docker-compose up -d postgres redis

if %errorlevel% neq 0 (
    echo ❌ Failed to start Docker services
    pause
    exit /b 1
)

echo ✅ Docker services starting...
echo.
echo    ⏳ Waiting 15 seconds for services to become healthy...
timeout /t 15 /nobreak

echo ✅ Services should be healthy now
echo.

REM ============================================
REM PHASE 3: Setup Backend
REM ============================================

echo 🐍 PHASE 3: Setting up Backend...
echo.

cd /d "%~dp0backend"

if exist "venv" (
    echo    ✅ Virtual environment found
) else (
    echo    📦 Creating virtual environment...
    python -m venv venv
)

echo    Activating virtual environment...
call .\venv\Scripts\activate.bat

echo    Installing Python dependencies...
pip install -r requirements.txt -q

echo ✅ Dependencies installed
echo.

echo    Running database migrations...
python manage.py migrate

echo ✅ Migrations completed
echo.

REM ============================================
REM PHASE 4: Setup Frontend
REM ============================================

echo ⚛️  PHASE 4: Setting up Frontend...
echo.

cd /d "%~dp0frontend"

if exist "node_modules" (
    echo    ✅ Dependencies already installed
) else (
    echo    📦 Installing Node dependencies ^(this may take a few minutes^)...
    npm install -q
    if !errorlevel! neq 0 (
        echo    ⚠️  Trying with legacy peer deps...
        npm install --legacy-peer-deps -q
    )
)

echo ✅ Dependencies installed
echo.

REM ============================================
REM PHASE 5: Display Next Steps
REM ============================================

cls
echo.
echo ✅ Setup Complete!
echo.
echo ╔════════════════════════════════════════════╗
echo ║            NEXT STEPS                      ║
echo ╚════════════════════════════════════════════╝
echo.
echo 1️⃣  CREATE SUPERUSER ^(in SAME terminal^):
echo    cd backend
echo    python manage.py createsuperuser
echo    ^(Follow the prompts^)
echo.
echo 2️⃣  START BACKEND ^(in SAME terminal after superuser^):
echo    python manage.py runserver
echo.
echo 3️⃣  START FRONTEND ^(in NEW TERMINAL^):
echo    cd frontend
echo    npm run dev
echo.
echo 📍 Access Points After Starting Services:
echo    Frontend:     http://localhost:5173
echo    Backend API:  http://localhost:8000/api/v1/
echo    Admin Panel:  http://localhost:8000/admin
echo    API Docs:     http://localhost:8000/api/v1/swagger/
echo.
echo 🛠️  Service Status:
docker-compose ps
echo.
echo 📚 For more information, see: DEEP_SYSTEM_SCAN_AND_SETUP_GUIDE.md
echo.

pause

