# ============================================
# Docker Deployment Script - Development (PowerShell)
# LMSetjen DPD RI - Learning Management System
# ============================================

Write-Host "`n🚀 Starting LMS Docker Deployment (Development)" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Error: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if .env.docker file exists
if (-not (Test-Path ".env.docker")) {
    Write-Host "⚠️  Warning: .env.docker not found." -ForegroundColor Yellow
    if (Test-Path ".env.docker.example") {
        Copy-Item ".env.docker.example" ".env.docker"
        Write-Host "✅ Created .env.docker from example" -ForegroundColor Green
        Write-Host "📝 Please edit .env.docker with your configuration" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "❌ Error: .env.docker.example not found" -ForegroundColor Red
        exit 1
    }
}

Write-Host "📦 Building Docker images..." -ForegroundColor Yellow
docker-compose build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build Docker images" -ForegroundColor Red
    exit 1
}

Write-Host "`n🗑️  Removing old containers (if any)..." -ForegroundColor Yellow
docker-compose down -v

Write-Host "`n🚀 Starting services..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services" -ForegroundColor Red
    exit 1
}

Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service health
Write-Host "`n🔍 Checking service health..." -ForegroundColor Yellow
$status = docker-compose ps

if ($status -match "Up") {
    Write-Host "✅ Services are running!`n" -ForegroundColor Green
    
    Write-Host "📊 Service Status:" -ForegroundColor Cyan
    docker-compose ps
    
    Write-Host "`n🌐 Access your application:" -ForegroundColor Cyan
    Write-Host "   Frontend: http://localhost" -ForegroundColor White
    Write-Host "   Backend API: http://localhost:8000" -ForegroundColor White
    Write-Host "   Admin Panel: http://localhost:8000/admin" -ForegroundColor White
    
    Write-Host "`n📝 Useful commands:" -ForegroundColor Cyan
    Write-Host "   View logs: docker-compose logs -f" -ForegroundColor White
    Write-Host "   Stop services: docker-compose down" -ForegroundColor White
    Write-Host "   Restart services: docker-compose restart" -ForegroundColor White
    Write-Host "   Execute Django commands: docker-compose exec backend python manage.py <command>" -ForegroundColor White
    
    Write-Host "`n✅ Deployment completed successfully!`n" -ForegroundColor Green
} else {
    Write-Host "❌ Some services failed to start. Check logs:" -ForegroundColor Red
    docker-compose logs
    exit 1
}
