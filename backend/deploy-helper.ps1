# ============================================
# Quick Deployment Script for Render
# Run this after configuring Render service
# ============================================

Write-Host "`n🚀 Backend Deployment Helper" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Step 1: Check if we're in the backend directory
if (-not (Test-Path "manage.py")) {
    Write-Host "❌ Error: Not in backend directory!" -ForegroundColor Red
    Write-Host "Please run this script from the backend folder" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Backend directory confirmed" -ForegroundColor Green

# Step 2: Check for required files
$requiredFiles = @("requirements.txt", "Dockerfile", "render.yaml", ".env")
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
    }
}

# Step 3: Verify Python environment
Write-Host "`n📦 Checking Python environment..." -ForegroundColor Cyan
$pythonVersion = python --version 2>&1
Write-Host "Python: $pythonVersion" -ForegroundColor Yellow

# Step 4: Test local server (optional)
Write-Host "`n🧪 Would you like to test the server locally first? (Y/N)" -ForegroundColor Cyan
$testLocal = Read-Host

if ($testLocal -eq "Y" -or $testLocal -eq "y") {
    Write-Host "`n🔄 Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
    
    Write-Host "`n🔄 Running migrations..." -ForegroundColor Yellow
    python manage.py migrate
    
    Write-Host "`n🔄 Collecting static files..." -ForegroundColor Yellow
    python manage.py collectstatic --noinput
    
    Write-Host "`n✅ Starting local server at http://127.0.0.1:8000" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    python manage.py runserver
}

# Step 5: Git setup
Write-Host "`n📁 Git Repository Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
} else {
    Write-Host "✅ Git already initialized" -ForegroundColor Green
}

# Step 6: Generate production SECRET_KEY
Write-Host "`n🔐 Production SECRET_KEY" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "⚠️  IMPORTANT: Generate a new SECRET_KEY for production!" -ForegroundColor Yellow
Write-Host "Visit: https://djecrety.ir/" -ForegroundColor Cyan
Write-Host "Copy the generated key and add it to Render environment variables" -ForegroundColor Yellow

# Step 7: Deployment checklist
Write-Host "`n📋 Deployment Checklist" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "1. [ ] Create GitHub repository" -ForegroundColor Yellow
Write-Host "2. [ ] Push code to GitHub" -ForegroundColor Yellow
Write-Host "3. [ ] Create Render account (https://render.com)" -ForegroundColor Yellow
Write-Host "4. [ ] Deploy with Blueprint (New → Blueprint)" -ForegroundColor Yellow
Write-Host "5. [ ] Add SECRET_KEY in Render environment" -ForegroundColor Yellow
Write-Host "6. [ ] Add SENDGRID_API_KEY if available" -ForegroundColor Yellow
Write-Host "7. [ ] Wait for deployment (~5-10 minutes)" -ForegroundColor Yellow
Write-Host "8. [ ] Test health endpoint: /api/health/" -ForegroundColor Yellow
Write-Host "9. [ ] Update frontend VITE_API_URL" -ForegroundColor Yellow
Write-Host "10. [ ] Run Lighthouse audit" -ForegroundColor Yellow

# Step 8: Environment variables reference
Write-Host "`n🔧 Required Environment Variables for Render" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

$envVars = @"
# Core Settings
SECRET_KEY=<generate-at-djecrety.ir>
DEBUG=False
ALLOWED_HOSTS=.onrender.com,.vercel.app

# Database (auto-populated by render.yaml)
DATABASE_URL=<from-render-database>
USE_SQLITE_FALLBACK=False

# Frontend
FRONTEND_SITE_URL=https://frontend-mtmk2t9bk-khazs-projects.vercel.app

# CORS
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://frontend-mtmk2t9bk-khazs-projects.vercel.app

# Email (optional)
SENDGRID_API_KEY=<your-key-if-available>
FROM_EMAIL=sdm@dpd.go.id

# Security
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
"@

Write-Host $envVars -ForegroundColor Yellow

# Step 9: Quick commands
Write-Host "`n⚡ Quick Git Commands" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "git add ." -ForegroundColor Green
Write-Host "git commit -m 'Add Render deployment config'" -ForegroundColor Green
Write-Host "git branch -M main" -ForegroundColor Green
Write-Host "git remote add origin <your-github-repo-url>" -ForegroundColor Green
Write-Host "git push -u origin main" -ForegroundColor Green

# Step 10: Next steps
Write-Host "`n🎯 Next Steps" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "1. Push code to GitHub" -ForegroundColor White
Write-Host "2. Deploy to Render using Blueprint" -ForegroundColor White
Write-Host "3. Follow the DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor White
Write-Host "4. After deployment, update frontend API URL" -ForegroundColor White
Write-Host "5. Run final Lighthouse audit to verify 97-99/100 score! 🎉" -ForegroundColor White

Write-Host "`n✨ Good luck with your deployment! ✨`n" -ForegroundColor Green
