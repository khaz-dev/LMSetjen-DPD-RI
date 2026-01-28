#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Quick Docker Setup & Start Script for LMSetjen DPD RI
.DESCRIPTION
    Automated setup and startup for local Docker deployment
.PARAMETER Action
    start    = Start all services
    stop     = Stop all services
    restart  = Restart all services
    clean    = Remove containers and volumes (WARNING: deletes data)
    logs     = Show live logs
    status   = Check service status
.EXAMPLE
    .\DOCKER_QUICK_START.ps1 -Action start
    .\DOCKER_QUICK_START.ps1 -Action logs
#>

param(
    [ValidateSet('start', 'stop', 'restart', 'clean', 'logs', 'status')]
    [string]$Action = 'start'
)

# Colors for output
$Green = @{ ForegroundColor = 'Green' }
$Red = @{ ForegroundColor = 'Red' }
$Yellow = @{ ForegroundColor = 'Yellow' }
$Blue = @{ ForegroundColor = 'Blue' }

function Print-Header {
    Write-Host "`n" @Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" @Blue
    Write-Host "  LMSetjen DPD RI - Docker Quick Start" @Blue
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" @Blue
}

function Check-Prerequisites {
    Write-Host "`n[1] Checking Prerequisites..." @Blue
    
    # Check Docker
    try {
        docker --version | Out-Null
        Write-Host "  ✓ Docker installed" @Green
    } catch {
        Write-Host "  ✗ Docker NOT found. Install Docker Desktop." @Red
        exit 1
    }
    
    # Check Docker Compose
    try {
        docker-compose --version | Out-Null
        Write-Host "  ✓ Docker Compose installed" @Green
    } catch {
        Write-Host "  ✗ Docker Compose NOT found." @Red
        exit 1
    }
    
    # Check Docker daemon
    try {
        docker ps | Out-Null
        Write-Host "  ✓ Docker daemon running" @Green
    } catch {
        Write-Host "  ✗ Docker daemon not running. Start Docker Desktop." @Red
        exit 1
    }
    
    # Check .env file
    if (-Not (Test-Path ".env")) {
        Write-Host "  ⚠ .env file not found. Creating from .env.example..." @Yellow
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Host "  ✓ .env created from .env.example" @Green
        } else {
            Write-Host "  ✗ .env.example not found" @Red
            exit 1
        }
    } else {
        Write-Host "  ✓ .env file present" @Green
    }
}

function Check-Ports {
    Write-Host "`n[2] Checking Port Availability..." @Blue
    
    $ports = @(80, 443, 8000, 5432, 6379)
    $portsInUse = @()
    
    foreach ($port in $ports) {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            $portsInUse += $port
            Write-Host "  ✗ Port $port already in use" @Red
        } else {
            Write-Host "  ✓ Port $port available" @Green
        }
    }
    
    if ($portsInUse.Count -gt 0) {
        Write-Host "`n  ⚠ Ports in use: $($portsInUse -join ', ')" @Yellow
        Write-Host "  You may need to free these ports or modify docker-compose.yml" @Yellow
        $response = Read-Host "  Continue anyway? (y/n)"
        if ($response -ne 'y') {
            Write-Host "  Aborted." @Red
            exit 1
        }
    }
}

function Start-Services {
    Write-Host "`n[3] Starting Services..." @Blue
    
    Write-Host "  Building and starting all containers..." @Yellow
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Services started" @Green
    } else {
        Write-Host "  ✗ Failed to start services" @Red
        exit 1
    }
    
    # Wait for services
    Write-Host "`n[4] Waiting for Services to be Ready..." @Blue
    Start-Sleep -Seconds 3
    
    # Check container status
    Write-Host "  Checking container status..." @Yellow
    $containers = docker-compose ps --services --filter "status=running"
    $expectedServices = @('postgres', 'redis', 'backend', 'frontend')
    
    foreach ($service in $expectedServices) {
        if ($containers -contains $service) {
            Write-Host "    ✓ $service running" @Green
        } else {
            Write-Host "    ✗ $service NOT running" @Red
        }
    }
}

function Show-Logs {
    Write-Host "`n[5] Showing Live Logs..." @Blue
    Write-Host "  Press Ctrl+C to stop watching logs" @Yellow
    docker-compose logs -f
}

function Stop-Services {
    Write-Host "`n[3] Stopping Services..." @Blue
    docker-compose stop
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Services stopped" @Green
    } else {
        Write-Host "  ✗ Failed to stop services" @Red
        exit 1
    }
}

function Restart-Services {
    Write-Host "`n[3] Restarting Services..." @Blue
    docker-compose restart
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Services restarted" @Green
        Start-Sleep -Seconds 2
    } else {
        Write-Host "  ✗ Failed to restart services" @Red
        exit 1
    }
}

function Clean-Services {
    Write-Host "`n[3] Removing Containers & Volumes..." @Red
    Write-Host "  ⚠ WARNING: This will DELETE all data!" @Red
    $response = Read-Host "  Type 'yes' to confirm"
    
    if ($response -eq 'yes') {
        docker-compose down -v
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Cleanup complete" @Green
        } else {
            Write-Host "  ✗ Cleanup failed" @Red
            exit 1
        }
    } else {
        Write-Host "  Aborted." @Yellow
    }
}

function Show-Status {
    Write-Host "`n[3] Service Status..." @Blue
    docker-compose ps
}

function Show-Endpoints {
    Write-Host "`n[6] Access Points:" @Blue
    Write-Host "  Frontend:   http://localhost" @Green
    Write-Host "  API:        http://localhost:8000/api/v1/" @Green
    Write-Host "  Admin:      http://localhost/admin/" @Green
    Write-Host "  API Docs:   http://localhost:8000/api/schema/swagger/" @Green
    Write-Host "  PostgreSQL: localhost:5432 (user: lms_user)" @Green
    Write-Host "  Redis:      localhost:6379" @Green
}

function Show-NextSteps {
    Write-Host "`n[7] Next Steps:" @Blue
    Write-Host "  1. Visit http://localhost in your browser" @Green
    Write-Host "  2. Create a superuser:" @Green
    Write-Host "     docker exec -it lms_backend python manage.py createsuperuser" @Yellow
    Write-Host "  3. View logs:" @Green
    Write-Host "     docker-compose logs -f backend" @Yellow
    Write-Host "  4. Test API:" @Green
    Write-Host "     curl http://localhost:8000/api/v1/healthz/" @Yellow
    Write-Host "  5. Database management:" @Green
    Write-Host "     docker exec -it lms_postgres psql -U lms_user -d lms_db" @Yellow
}

# Main script
Print-Header

switch ($Action) {
    'start' {
        Check-Prerequisites
        Check-Ports
        Start-Services
        Show-Endpoints
        Write-Host "`n[6] Waiting 5 seconds before showing logs..." @Yellow
        Start-Sleep -Seconds 5
        Show-Logs
    }
    'stop' {
        Check-Prerequisites
        Stop-Services
    }
    'restart' {
        Check-Prerequisites
        Restart-Services
        Show-Status
        Show-Endpoints
    }
    'clean' {
        Check-Prerequisites
        Clean-Services
    }
    'logs' {
        Check-Prerequisites
        Show-Logs
    }
    'status' {
        Check-Prerequisites
        Show-Status
        Show-Endpoints
    }
}

Print-Header
Write-Host ""

