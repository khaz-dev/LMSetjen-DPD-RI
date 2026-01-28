# ===========================================
# Quick Start: Frontend + Backend Setup
# LMSetjen DPD RI Development Environment
# ===========================================

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   LMSetjen DPD RI - Development Start Script" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Choose your setup option:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Docker + Local Dev (RECOMMENDED)"
Write-Host "   - PostgreSQL & Redis in Docker"
Write-Host "   - Backend & Frontend run locally"
Write-Host "   - Best for development"
Write-Host ""
Write-Host "2. Full Docker (Production-like)"
Write-Host "   - Everything in Docker containers"
Write-Host "   - Slowest but most isolated"
Write-Host ""
Write-Host "3. Setup Guide Only"
Write-Host "   - Show detailed setup instructions"
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" { Invoke-HybridSetup }
    "2" { Invoke-DockerSetup }
    "3" { Show-SetupGuide }
    default {
        Write-Host "Invalid choice. Please run again."
        exit 1
    }
}

function Invoke-HybridSetup {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "   Option 1: Docker Services + Local Dev"
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Starting PostgreSQL and Redis containers..." -ForegroundColor Green
    
    docker-compose up -d postgres redis
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker compose failed." -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Waiting for services to initialize (10 seconds)..." -ForegroundColor Green
    Start-Sleep -Seconds 10
    
    Write-Host ""
    Write-Host "BACKEND SETUP:" -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location backend
    & .\venv\Scripts\Activate.ps1
    
    Write-Host "Running Django migrations..." -ForegroundColor Green
    python manage.py migrate
    
    Write-Host ""
    Write-Host "Backend is ready. In a NEW terminal window, run:" -ForegroundColor Green
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "   python manage.py runserver" -ForegroundColor White
    Write-Host ""
    Write-Host "FRONTEND SETUP:" -ForegroundColor Yellow
    Write-Host ""
    
    Set-Location ..\frontend
    
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing Node packages..." -ForegroundColor Green
        npm install
    } else {
        Write-Host "Node packages already installed." -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Frontend is ready. In a NEW terminal window, run:" -ForegroundColor Green
    Write-Host "   cd frontend" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "Setup Complete!" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access the system:" -ForegroundColor Yellow
    Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
    Write-Host "   Backend:   http://localhost:8000" -ForegroundColor White
    Write-Host "   Admin:     http://localhost:8000/admin" -ForegroundColor White
    Write-Host ""
    Write-Host "Docker services running (postgres, redis)" -ForegroundColor Green
    Write-Host "Open 2 new terminals for backend and frontend" -ForegroundColor Green
    Write-Host ""
    Read-Host "Press Enter to continue"
}

function Invoke-DockerSetup {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "   Option 2: Full Docker Setup"
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Starting all services..." -ForegroundColor Green
    
    docker-compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker compose failed." -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "Waiting for services to initialize (20 seconds)..." -ForegroundColor Green
    Start-Sleep -Seconds 20
    
    Write-Host ""
    Write-Host "Running Django migrations..." -ForegroundColor Green
    docker-compose exec -T backend python manage.py migrate
    
    Write-Host ""
    Write-Host "Creating Django superuser..." -ForegroundColor Green
    docker-compose exec backend python manage.py createsuperuser
    
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "Setup Complete!" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access the system:" -ForegroundColor Yellow
    Write-Host "   Frontend:  http://localhost" -ForegroundColor White
    Write-Host "   Backend:   http://localhost:8000" -ForegroundColor White
    Write-Host "   Admin:     http://localhost:8000/admin" -ForegroundColor White
    Write-Host ""
    Write-Host "All services running in Docker containers:" -ForegroundColor Green
    Write-Host "   - backend" -ForegroundColor White
    Write-Host "   - frontend" -ForegroundColor White
    Write-Host "   - postgres" -ForegroundColor White
    Write-Host "   - redis" -ForegroundColor White
    Write-Host ""
    Write-Host "View logs:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs -f backend" -ForegroundColor White
    Write-Host "   docker-compose logs -f frontend" -ForegroundColor White
    Write-Host ""
    Write-Host "Stop services:" -ForegroundColor Yellow
    Write-Host "   docker-compose down" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to continue"
}

function Show-SetupGuide {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "   Setup Guide"
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "For detailed setup instructions, see:" -ForegroundColor Yellow
    Write-Host "   FRONTEND_BACKEND_SETUP_GUIDE.md" -ForegroundColor White
    Write-Host ""
    Write-Host "In VS Code:" -ForegroundColor Green
    Write-Host "   1. Open FRONTEND_BACKEND_SETUP_GUIDE.md" -ForegroundColor White
    Write-Host "   2. Read 'RECOMMENDED: Option B (Hybrid Approach)'" -ForegroundColor White
    Write-Host "   3. Follow step-by-step instructions" -ForegroundColor White
    Write-Host ""
    Write-Host "Quick Reference:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Step 1: Start backend services" -ForegroundColor Green
    Write-Host "   docker-compose up -d postgres redis" -ForegroundColor White
    Write-Host ""
    Write-Host "Step 2: Setup backend (new terminal)" -ForegroundColor Green
    Write-Host "   cd backend" -ForegroundColor White
    Write-Host "   .\venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "   python manage.py migrate" -ForegroundColor White
    Write-Host "   python manage.py createsuperuser" -ForegroundColor White
    Write-Host "   python manage.py runserver" -ForegroundColor White
    Write-Host ""
    Write-Host "Step 3: Setup frontend (new terminal)" -ForegroundColor Green
    Write-Host "   cd frontend" -ForegroundColor White
    Write-Host "   npm install" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "Step 4: Access the system" -ForegroundColor Green
    Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
    Write-Host "   Backend:   http://localhost:8000" -ForegroundColor White
    Write-Host "   Admin:     http://localhost:8000/admin" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to continue"
}
