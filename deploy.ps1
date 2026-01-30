# LMSetjen DPD RI - PowerShell Deployment Script for Windows

param(
    [string]$Command = "up"
)

# Get script directory properly
$ProjectRoot = $PSScriptRoot
if ([string]::IsNullOrEmpty($ProjectRoot)) {
    $ProjectRoot = Get-Location
}
$EnvFile = Join-Path $ProjectRoot ".env"

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Cyan = "`e[36m"
$NC = "`e[0m"

function Write-Header {
    Write-Host "`n$Cyan[DEPLOYMENT]$NC"
    Write-Host "$Cyan$($args[0])$NC`n"
}

function Write-Success {
    Write-Host "$Green✅ $($args[0])$NC"
}

function Write-ErrorMsg {
    Write-Host "$Red❌ $($args[0])$NC"
}

function Write-WarningMsg {
    Write-Host "$Yellow⚠️  $($args[0])$NC"
}

function Show-Help {
    Write-Header "LMSetjen DPD RI - Deployment Commands"
    @"
Usage: .\deploy.ps1 [command]

Commands:
  up              Start all containers (default)
  down            Stop all containers
  status          Show container status
  logs            Show recent logs
  restart         Restart all containers
  clean           Clean rebuild
  help            Show this help

Examples:
  .\deploy.ps1
  .\deploy.ps1 down
  .\deploy.ps1 status
"@
}

# Check Docker
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-ErrorMsg "Docker not found"
    exit 1
}

Write-Success "Docker: $(docker --version)"

# Check .env
if (!(Test-Path $EnvFile)) {
    Write-ErrorMsg ".env not found"
    exit 1
}

Write-Success ".env found"
Set-Location $ProjectRoot

# Execute command
switch ($Command) {
    "up" {
        Write-Header "Starting Services"
        docker-compose up -d
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Services started"
            Write-Host "`nURLs:"
            Write-Host "  Frontend: http://localhost:5174"
            Write-Host "  Backend:  http://localhost:8001`n"
        }
    }
    "down" {
        Write-Header "Stopping Services"
        docker-compose down
        Write-Success "Services stopped"
    }
    "status" {
        Write-Header "Container Status"
        docker-compose ps
    }
    "logs" {
        Write-Header "Recent Logs"
        docker-compose logs --tail=50 -f
    }
    "restart" {
        Write-Header "Restarting Services"
        docker-compose restart
        Write-Success "Services restarted"
    }
    "clean" {
        Write-Header "Clean Rebuild"
        Write-WarningMsg "This will remove all containers"
        $confirm = Read-Host "Continue? (y/N)"
        if ($confirm -eq 'y') {
            docker-compose down -v --remove-orphans
            docker-compose up -d --build
            Write-Success "Rebuild complete"
        }
    }
    "help" {
        Show-Help
    }
    default {
        Write-ErrorMsg "Unknown command: $Command"
    }
}
