Write-Host "================================================"
Write-Host "Production Deployment Simulation Setup"
Write-Host "LMSetjen DPD RI - Windows"
Write-Host "================================================"
Write-Host ""

# Step 1: Check PostgreSQL
Write-Host "Step 1: Checking PostgreSQL Connection" -ForegroundColor Yellow

if (Get-Service -Name "PostgreSQL*" | Where-Object {$_.Status -eq "Running"}) {
    Write-Host "OK - PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "WARNING - PostgreSQL may not be running" -ForegroundColor Yellow
}

# Step 2: Create .env file
Write-Host ""
Write-Host "Step 2: Creating Environment File" -ForegroundColor Yellow

$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env..." -ForegroundColor Yellow
    $content = @"
# Django
SECRET_KEY=django-insecure-change-this
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# URLs
FRONTEND_SITE_URL=http://localhost:3000
BACKEND_SITE_URL=http://localhost:9000

# PostgreSQL on HOST
DB_ENGINE=django.db.backends.postgresql
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=Okkdpdri2026
DB_HOST=host.docker.internal
DB_PORT=5432

# Redis in Docker
REDIS_URL=redis://:redis_password@redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Logging
DJANGO_LOG_LEVEL=INFO
VITE_API_BASE_URL=/api
"@
    Set-Content -Path $envFile -Value $content
    Write-Host "OK - .env created" -ForegroundColor Green
} else {
    Write-Host "OK - .env exists" -ForegroundColor Green
}

# Step 3: Stop existing containers
Write-Host ""
Write-Host "Step 3: Stopping Existing Containers" -ForegroundColor Yellow
docker-compose down -v 2>&1 | Out-Null
Write-Host "OK - Containers stopped" -ForegroundColor Green

# Step 4: Start production simulation
Write-Host ""
Write-Host "Step 4: Starting Production Simulation" -ForegroundColor Yellow
Write-Host "Starting Docker containers..." -ForegroundColor Cyan

docker-compose -f docker-compose.production.yml up -d

Write-Host "OK - Containers starting" -ForegroundColor Green
Write-Host "Waiting 15 seconds for services..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Step 5: Check status
Write-Host ""
Write-Host "Step 5: Container Status" -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml ps

# Step 6: Test services
Write-Host ""
Write-Host "Step 6: Testing Services" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:9000/api/v1/health/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    Write-Host "OK - Backend running on port 9000" -ForegroundColor Green
} catch {
    Write-Host "WAIT - Backend starting (check back in 1 min)" -ForegroundColor Yellow
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    Write-Host "OK - Frontend running on port 3000" -ForegroundColor Green
} catch {
    Write-Host "WAIT - Frontend starting (check back in 1 min)" -ForegroundColor Yellow
}

# Step 7: Summary
Write-Host ""
Write-Host "================================================"
Write-Host "SETUP COMPLETE!"
Write-Host "================================================"
Write-Host ""
Write-Host "Access your application:"
Write-Host "  Frontend: http://localhost:3000"
Write-Host "  Backend:  http://localhost:9000"
Write-Host ""
Write-Host "Database:"
Write-Host "  Host:     localhost"
Write-Host "  User:     postgres"
Write-Host "  Password: Okkdpdri2026"
Write-Host "  Port:     5432"
Write-Host ""
Write-Host "Useful Commands:"
Write-Host "  View logs:    docker-compose -f docker-compose.production.yml logs -f"
Write-Host "  Stop:         docker-compose -f docker-compose.production.yml down"
Write-Host "  Status:       docker-compose -f docker-compose.production.yml ps"
Write-Host ""
Write-Host "Next: Open http://localhost:3000"
Write-Host "================================================"
