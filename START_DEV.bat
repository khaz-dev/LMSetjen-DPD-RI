@echo off
REM ===========================================
REM Quick Start: Frontend + Backend Setup
REM LMSetjen DPD RI Development Environment
REM ===========================================

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo   LMSetjen DPD RI - Development Start Script
echo ===============================================
echo.
echo Choose your setup option:
echo.
echo 1. Docker + Local Dev (RECOMMENDED)
echo    - PostgreSQL & Redis in Docker
echo    - Backend & Frontend run locally
echo    - Best for development
echo.
echo 2. Full Docker (Production-like)
echo    - Everything in Docker containers
echo    - Slowest but most isolated
echo.
echo 3. Setup Guide Only
echo    - Show detailed setup instructions
echo.

set /p choice="Enter choice (1-3): "

if "%choice%"=="1" goto option_hybrid
if "%choice%"=="2" goto option_docker
if "%choice%"=="3" goto option_guide
echo Invalid choice. Please run again.
exit /b 1

:option_hybrid
echo.
echo ===============================================
echo   Option 1: Docker Services + Local Dev
echo ===============================================
echo.
echo Starting PostgreSQL and Redis containers...
docker-compose up -d postgres redis

if errorlevel 1 (
    echo ERROR: Docker compose failed. Make sure Docker is installed and running.
    pause
    exit /b 1
)

echo.
echo Waiting for services to initialize (10 seconds)...
timeout /t 10 /nobreak

echo.
echo BACKEND SETUP:
echo.
cd backend
call venv\Scripts\activate.bat

echo Running Django migrations...
python manage.py migrate

echo.
echo Backend is ready. In a NEW terminal window, run:
echo   cd backend
echo   venv\Scripts\activate
echo   python manage.py runserver
echo.
echo FRONTEND SETUP:
echo.
cd ..\frontend

echo Installing Node packages...
if not exist "node_modules" (
    call npm install
) else (
    echo Node packages already installed.
)

echo.
echo Frontend is ready. In a NEW terminal window, run:
echo   cd frontend
echo   npm run dev
echo.
echo ===============================================
echo Setup Complete!
echo ===============================================
echo.
echo Access the system:
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   Admin:     http://localhost:8000/admin
echo.
echo Docker services running (postgres, redis)
echo Open 2 new terminals for backend and frontend
echo.
pause
exit /b 0

:option_docker
echo.
echo ===============================================
echo   Option 2: Full Docker Setup
echo ===============================================
echo.
echo Starting all services (backend, frontend, postgres, redis)...
docker-compose up -d

if errorlevel 1 (
    echo ERROR: Docker compose failed.
    pause
    exit /b 1
)

echo.
echo Waiting for services to initialize (20 seconds)...
timeout /t 20 /nobreak

echo.
echo Creating Django superuser...
docker-compose exec -T backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser

echo.
echo ===============================================
echo Setup Complete!
echo ===============================================
echo.
echo Access the system:
echo   Frontend:  http://localhost
echo   Backend:   http://localhost:8000
echo   Admin:     http://localhost:8000/admin
echo.
echo All services running in Docker containers:
echo   - backend
echo   - frontend
echo   - postgres
echo   - redis
echo.
echo View logs:
echo   docker-compose logs -f backend
echo   docker-compose logs -f frontend
echo.
echo Stop services:
echo   docker-compose down
echo.
pause
exit /b 0

:option_guide
echo.
echo ===============================================
echo   Setup Guide
echo ===============================================
echo.
echo For detailed setup instructions, see:
echo   FRONTEND_BACKEND_SETUP_GUIDE.md
echo.
echo In VS Code:
echo   1. Open FRONTEND_BACKEND_SETUP_GUIDE.md
echo   2. Read "RECOMMENDED: Option B (Hybrid Approach)"
echo   3. Follow step-by-step instructions
echo.
echo Quick Reference:
echo.
echo Step 1: Start backend services
echo   docker-compose up -d postgres redis
echo.
echo Step 2: Setup backend (new terminal)
echo   cd backend
echo   venv\Scripts\activate
echo   python manage.py migrate
echo   python manage.py createsuperuser
echo   python manage.py runserver
echo.
echo Step 3: Setup frontend (new terminal)
echo   cd frontend
echo   npm install
echo   npm run dev
echo.
echo Step 4: Access the system
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   Admin:     http://localhost:8000/admin
echo.
pause
exit /b 0
