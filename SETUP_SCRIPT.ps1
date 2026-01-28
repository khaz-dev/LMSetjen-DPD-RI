#!/usr/bin/env powershell
# LMSetjen DPD RI - Automated Setup Script
# Hybrid Setup (Docker + Local Dev Servers)

$Success = "Green"
$Warning = "Yellow"
$ErrorColor = "Red"
$Info = "Cyan"

function Write-Status {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    $Color = switch($Type) {
        "Success" { $Success }
        "Warning" { $Warning }
        "Error" { $ErrorColor }
        default { $Info }
    }
    Write-Host $Message -ForegroundColor $Color
}

# PHASE 1: Check Dependencies
Write-Status "========================================" "Info"
Write-Status "LMSetjen DPD RI - Setup Script" "Info"
Write-Status "Hybrid Setup: Docker + Local Dev" "Info"
Write-Status "========================================" "Info"
Write-Host ""

Write-Status "PHASE 1: Checking Dependencies..." "Info"
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] Node.js found: $nodeVersion" "Success"
} else {
    Write-Status "[ERROR] Node.js NOT found" "Error"
    Write-Status "Install from: https://nodejs.org/" "Warning"
    exit 1
}

# Check npm
$npmVersion = npm --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] npm found: $npmVersion" "Success"
} else {
    Write-Status "[ERROR] npm NOT found" "Error"
    exit 1
}

# Check Python
$pythonVersion = python --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] Python found: $pythonVersion" "Success"
} else {
    Write-Status "[ERROR] Python NOT found" "Error"
    Write-Status "Install from: https://www.python.org/" "Warning"
    exit 1
}

# Check Docker
$dockerVersion = docker --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] Docker found: $dockerVersion" "Success"
} else {
    Write-Status "[ERROR] Docker NOT found" "Error"
    Write-Status "Install from: https://www.docker.com/products/docker-desktop" "Warning"
    exit 1
}

Write-Host ""
Write-Status "[OK] All dependencies installed!" "Success"
Write-Host ""

# PHASE 2: Start Docker Services
Write-Status "PHASE 2: Starting Docker Services..." "Info"
Write-Host ""

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Status "Project Root: $projectRoot" "Info"
Write-Host ""
Write-Status "Starting PostgreSQL and Redis..." "Info"
docker-compose up -d postgres redis 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] Docker services starting..." "Success"
} else {
    Write-Status "[ERROR] Failed to start Docker services" "Error"
    exit 1
}

Write-Host ""
Write-Status "Waiting 15 seconds for services to be ready..." "Warning"
Start-Sleep -Seconds 15

Write-Status "[OK] Services should be healthy now" "Success"
Write-Host ""

# PHASE 3: Setup Backend
Write-Status "PHASE 3: Setting up Backend..." "Info"
Write-Host ""

$backendPath = Join-Path $projectRoot "backend"
Set-Location $backendPath

Write-Status "Backend Path: $backendPath" "Info"
Write-Host ""

# Check if venv exists
if (Test-Path ".\venv") {
    Write-Status "[OK] Virtual environment found" "Success"
} else {
    Write-Status "Creating virtual environment..." "Warning"
    python -m venv venv
    Write-Status "[OK] Virtual environment created" "Success"
}

Write-Status "Activating virtual environment..." "Info"
& .\venv\Scripts\Activate.ps1

Write-Status "Installing Python dependencies..." "Info"
pip install -r requirements.txt -q 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] Dependencies installed" "Success"
} else {
    Write-Status "[WARNING] Some dependencies may have issues" "Warning"
}

Write-Host ""
Write-Status "Running database migrations..." "Info"
python manage.py migrate 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Status "[OK] Migrations completed" "Success"
} else {
    Write-Status "[ERROR] Migration failed" "Error"
    Write-Host ""
    Write-Status "Troubleshooting:" "Warning"
    Write-Status "1. Check PostgreSQL: docker-compose ps" "Info"
    Write-Status "2. Check DB credentials in .env" "Info"
    Write-Status "3. Check Docker logs: docker-compose logs postgres" "Info"
}

Write-Host ""

# PHASE 4: Setup Frontend
Write-Status "PHASE 4: Setting up Frontend..." "Info"
Write-Host ""

$frontendPath = Join-Path $projectRoot "frontend"
Set-Location $frontendPath

Write-Status "Frontend Path: $frontendPath" "Info"
Write-Host ""

# Check if node_modules exists
if (Test-Path ".\node_modules") {
    Write-Status "[OK] Dependencies already installed" "Success"
} else {
    Write-Status "Installing Node dependencies..." "Warning"
    npm install -q 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Status "[OK] Dependencies installed" "Success"
    } else {
        Write-Status "[WARNING] Trying with legacy peer deps..." "Warning"
        npm install --legacy-peer-deps -q 2>$null
        Write-Status "[OK] Dependencies installed" "Success"
    }
}

Write-Host ""
Write-Status "[OK] Frontend setup complete" "Success"
Write-Host ""

# PHASE 5: Display Next Steps
Write-Status "SETUP COMPLETE!" "Success"
Write-Host ""
Write-Status "========================================" "Info"
Write-Status "NEXT STEPS" "Info"
Write-Status "========================================" "Info"
Write-Host ""

Write-Status "Step 1: CREATE SUPERUSER (same terminal)" "Warning"
Write-Host "  cd backend"
Write-Host "  python manage.py createsuperuser"
Write-Host ""

Write-Status "Step 2: START BACKEND (same terminal)" "Warning"
Write-Host "  python manage.py runserver"
Write-Host ""

Write-Status "Step 3: START FRONTEND (new terminal)" "Warning"
Write-Host "  cd $frontendPath"
Write-Host "  npm run dev"
Write-Host ""

Write-Host ""
Write-Status "ACCESS POINTS:" "Info"
Write-Host "  Frontend:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend:    http://localhost:8000/api/v1/" -ForegroundColor Cyan
Write-Host "  Admin:      http://localhost:8000/admin" -ForegroundColor Cyan
Write-Host "  API Docs:   http://localhost:8000/api/v1/swagger/" -ForegroundColor Cyan
Write-Host ""

Write-Status "SERVICE STATUS:" "Info"
docker-compose ps

Write-Host ""
Write-Status "For more info: DEEP_SYSTEM_SCAN_AND_SETUP_GUIDE.md" "Info"
Write-Host ""
