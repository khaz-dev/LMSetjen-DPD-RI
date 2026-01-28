# LMSetjen DPD RI - Project Setup & Requirements Guide

**Generated:** January 20, 2026  
**Based on:** Deep project scan & architecture analysis

---

## 🎯 QUICK ANSWER

**Do you need to run the backend using Python venv?**

✅ **YES, IF running locally for development**  
⚠️ **NO, IF using Docker (recommended for production)**  
✅ **YES, if you have Python installed and want pure local setup**

---

## 📊 TWO SETUP OPTIONS

### OPTION 1: DOCKER (✅ RECOMMENDED - Easiest)

**No Python venv needed. Everything containerized.**

```bash
# Prerequisites:
# - Docker Desktop installed
# - Docker Compose installed
# - 8GB+ RAM available

# Copy environment file
copy .env.example .env

# Start all services
docker-compose up -d

# Services start:
# - Backend: http://localhost:8000
# - Frontend: http://localhost/
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

**Pros:**
- No local Python installation needed
- Isolated environments
- Easy to tear down
- Production-like setup
- All dependencies in containers
- Cross-platform compatible

**Cons:**
- Requires Docker Desktop
- Slightly heavier resource usage
- Learning curve if unfamiliar with Docker

---

### OPTION 2: LOCAL DEVELOPMENT (✅ Pure Python)

**Requires Python venv - more control for development**

#### Backend Setup (with Python venv)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create .env file (or copy from .env.example)
copy .env.example .env

# Run migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser

# Start Django development server
python manage.py runserver

# Server runs at: http://localhost:8000
```

#### Frontend Setup (Node.js)

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev

# Server runs at: http://localhost:5173
```

#### Additional Services Needed Locally

**PostgreSQL Database:**
```bash
# Install PostgreSQL from:
# https://www.postgresql.org/download/

# Or use Docker just for PostgreSQL:
docker run --name lms_postgres \
  -e POSTGRES_DB=django_lms_db \
  -e POSTGRES_USER=lms_user \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15-alpine
```

**Redis Cache:**
```bash
# Install Redis from:
# https://redis.io/download

# Or use Docker just for Redis:
docker run --name lms_redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

**Pros:**
- Full control over dependencies
- Faster iteration during development
- Direct debugging
- Easier to modify code on-the-fly
- No Docker overhead

**Cons:**
- Requires Python 3.8+ installed locally
- Requires Node.js installed locally
- Need separate PostgreSQL & Redis
- More manual configuration
- Platform-specific setup steps

---

## 🏗️ PROJECT STRUCTURE

```
LMSetjen DPD RI/
│
├── backend/                    # Django REST Framework
│   ├── requirements.txt        # Python dependencies (43 packages)
│   ├── Dockerfile             # Backend container config
│   ├── manage.py              # Django CLI
│   ├── venv/                  # Virtual environment (LOCAL ONLY)
│   ├── api/                   # Main API app
│   ├── userauths/             # Authentication
│   ├── backend/               # Django settings
│   └── .env                   # Local config (gitignored)
│
├── frontend/                   # React + Vite
│   ├── package.json           # Node dependencies (35+ packages)
│   ├── Dockerfile             # Frontend container config
│   ├── src/                   # React source code
│   ├── vite.config.js         # Vite build config
│   └── node_modules/          # Node packages (LOCAL ONLY)
│
├── docker-compose.yml         # Compose orchestration
├── .env.example              # Template for environment variables
├── .env                      # Actual config (gitignored)
└── README.md                 # Project documentation
```

---

## 🔍 DETAILED BREAKDOWN

### Backend Requirements

**Python Version:** 3.8+ (3.11 recommended)

**Key Python Packages (from requirements.txt):**
```
Django==4.2.7
djangorestframework==3.14.0
djangorestframework-simplejwt==5.2.2  # JWT auth
django-cors-headers==3.14.0            # CORS support
django-redis==5.4.0                    # Redis caching
psycopg2-binary==2.9.9                 # PostgreSQL driver
gunicorn==21.2.0                       # Production WSGI
drf-yasg==1.21.7                       # API documentation
python-dotenv==1.0.0                   # Environment vars
django-anymail==10.2                   # Email sending
django-storages==1.12.3                # S3 storage
moviepy==1.0.3                         # Video processing
redis==5.0.1                           # Redis client
qrcode==7.4.2                          # QR code generation
+ 20 more...
```

**External Services:**
- PostgreSQL 15 (database)
- Redis 7 (caching)
- SendGrid (email)
- AWS S3 (optional, media storage)

### Frontend Requirements

**Node Version:** 14+ (16+ recommended)

**Key Node Packages (from package.json):**
```
react@18.2.0
react-dom@18.2.0
react-router-dom@6.10.0
axios@1.6.5                     # HTTP client
bootstrap@5.3.2                 # UI framework
chart.js@4.4.0                  # Charts
react-chartjs-2@5.2.0           # Chart wrapper
vite@latest                     # Build tool
sweetalert2@11.7.32             # Modal/alerts
react-hook-form@7.48.2          # Forms
@ckeditor/ckeditor5-react       # Rich text editor
react-player@2.16.1             # Video player
+ 15 more...
```

**Build Output:** ~500KB gzipped (optimized)

---

## ⚙️ ENVIRONMENT CONFIGURATION

### Required Environment Variables

**Copy `.env.example` to `.env` and configure:**

```bash
# Django Core
SECRET_KEY=your-super-secret-key-here
DEBUG=False                    # True for development
DJANGO_LOG_LEVEL=INFO

# Database (PostgreSQL)
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=secure_password
DB_HOST=postgres              # 'localhost' for local setup
DB_PORT=5432

# Cache (Redis)
REDIS_HOST=redis              # 'localhost' for local setup
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Security
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# URLs
FRONTEND_SITE_URL=http://localhost:3000
BACKEND_SITE_URL=http://localhost:8000

# Email (SendGrid)
SENDGRID_API_KEY=your-key
FROM_EMAIL=noreply@example.com

# AWS S3 (Optional)
AWS_ACCESS_KEY_ID=optional
AWS_SECRET_ACCESS_KEY=optional
AWS_STORAGE_BUCKET_NAME=optional
```

---

## 🚀 COMPLETE LOCAL SETUP GUIDE

### Step 1: Prerequisites Check

```bash
# Check Python version (needs 3.8+)
python --version
# Output: Python 3.11.x ✓

# Check Node.js version (needs 14+)
node --version
# Output: v18.x ✓

# Check pip
pip --version
# Output: pip x.x.x ✓
```

### Step 2: Clone & Navigate

```bash
cd d:\Project\LMSetjen\ DPD\ RI
```

### Step 3: Setup Backend with venv

```bash
# Navigate to backend
cd backend

# Create Python virtual environment
python -m venv venv

# Activate venv
# Windows:
venv\Scripts\activate
# Output: (venv) C:\path\to\backend>

# Upgrade pip (optional but recommended)
pip install --upgrade pip

# Install all Python dependencies
pip install -r requirements.txt
# This takes 2-5 minutes

# Verify installation
pip list
# Should show 43+ packages installed
```

### Step 4: Setup Database (Choose One)

**Option A: Use Docker for PostgreSQL only**
```bash
docker run --name lms_postgres \
  -e POSTGRES_DB=django_lms_db \
  -e POSTGRES_USER=lms_user \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15-alpine

# Update .env:
DB_HOST=localhost
```

**Option B: Install PostgreSQL locally**
- Download from https://www.postgresql.org/download/
- Run installer
- Create database: `createdb django_lms_db`
- Update .env with connection details

### Step 5: Setup Redis (Choose One)

**Option A: Use Docker for Redis**
```bash
docker run --name lms_redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Update .env:
REDIS_HOST=localhost
```

**Option B: Install Redis locally (Windows)**
- Download: https://github.com/microsoftarchive/redis/releases
- Run installer
- Verify: `redis-cli ping` → Should output: PONG

### Step 6: Setup Django

```bash
# Still in backend directory with venv activated

# Run migrations (creates database tables)
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser
# Follow prompts:
# Email: admin@example.com
# Full name: Admin User
# Password: (create strong password)

# Collect static files (optional for dev)
python manage.py collectstatic --noinput

# Start Django development server
python manage.py runserver

# Output:
# Starting development server at http://127.0.0.1:8000/
# Quit the server with CONTROL-C
```

**Backend is now running!** Visit http://localhost:8000/admin

### Step 7: Setup Frontend (New Terminal)

```bash
# Open NEW terminal/PowerShell window

# Navigate to frontend
cd d:\Project\LMSetjen\ DPD\ RI\frontend

# Install Node dependencies
npm install
# This takes 2-5 minutes

# Start Vite development server
npm run dev

# Output:
# ➜  Local:   http://localhost:5173/
# ➜  Press q to quit
```

**Frontend is now running!** Visit http://localhost:5173

---

## 📊 COMPARISON TABLE

| Aspect | Docker | Local Development |
|--------|--------|-------------------|
| **Python venv needed?** | ❌ No | ✅ YES |
| **Setup time** | 5 min | 20-30 min |
| **Complexity** | Simple | Moderate |
| **Resource usage** | 2-3GB RAM | 1-2GB RAM |
| **Database setup** | Automatic | Manual or Docker |
| **Redis setup** | Automatic | Manual or Docker |
| **Development speed** | Medium | Fast |
| **Production-like** | ✅ Yes | ❌ No |
| **Cross-platform** | ✅ Yes | Varies |
| **Debugging** | Harder | Easier |
| **Hot reload** | Some | Full |

---

## 🐛 TROUBLESHOOTING

### "Python not found"
```bash
# Install Python from: https://www.python.org/
# Make sure to check "Add Python to PATH"
# Restart terminal and try again
python --version
```

### "venv not activating"
```bash
# Windows - try these in order:
venv\Scripts\activate
# or
.\venv\Scripts\activate
# or (PowerShell)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1
```

### "pip install fails"
```bash
# Upgrade pip first
python -m pip install --upgrade pip

# Try installing requirements again
pip install -r requirements.txt

# If specific package fails, try:
pip install --no-cache-dir -r requirements.txt
```

### "PostgreSQL connection error"
```bash
# Check if PostgreSQL is running
# Windows: Services app - look for "postgresql-x64-15"
# macOS: brew services list | grep postgres
# Linux: sudo systemctl status postgresql

# Or verify with Docker:
docker ps | grep postgres
```

### "Redis connection refused"
```bash
# Check if Redis is running
# Windows: redis-cli ping
# Should return: PONG

# Or verify Docker:
docker ps | grep redis
```

### "Port 8000 already in use"
```bash
# Find process using port 8000
# Windows:
netstat -ano | findstr :8000

# Kill process:
taskkill /PID <PID> /F

# Or use different port:
python manage.py runserver 8001
```

### "Port 5173 already in use"
```bash
# Find process using port 5173
# Windows:
netstat -ano | findstr :5173

# Or use different port:
npm run dev -- --port 5174
```

---

## 🔄 TYPICAL DEVELOPMENT WORKFLOW

### Terminal 1: Backend
```bash
cd backend
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
python manage.py runserver
# Runs on http://localhost:8000
```

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

### Terminal 3: Optional - Database commands
```bash
# While in backend with venv activated:

# Check migrations
python manage.py showmigrations

# Create migration after model change
python manage.py makemigrations

# Apply new migrations
python manage.py migrate

# Create another superuser
python manage.py createsuperuser

# Access Django shell
python manage.py shell
```

---

## 📦 DEPENDENCY SIZES

**Backend:**
- Total dependencies: 43 packages
- Installed size: ~500MB (in venv)
- Installation time: 2-5 minutes

**Frontend:**
- Total dependencies: 35+ packages
- Installed size: ~400MB (in node_modules)
- Installation time: 2-5 minutes

**Docker Containers:**
- Backend image: ~800MB
- Frontend image: ~100MB
- PostgreSQL: ~200MB
- Redis: ~100MB
- Total: ~1.2GB

---

## ✅ FINAL CHECKLIST

### For Docker Setup:
- [ ] Docker Desktop installed
- [ ] Docker Compose installed
- [ ] Copy `.env.example` to `.env`
- [ ] Run `docker-compose up -d`
- [ ] Backend accessible at http://localhost:8000
- [ ] Frontend accessible at http://localhost/

### For Local Development Setup:
- [ ] Python 3.8+ installed
- [ ] Node.js 14+ installed
- [ ] Virtual environment created (`python -m venv venv`)
- [ ] venv activated
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] PostgreSQL running (local or Docker)
- [ ] Redis running (local or Docker)
- [ ] `.env` configured
- [ ] Migrations run (`python manage.py migrate`)
- [ ] Superuser created (`python manage.py createsuperuser`)
- [ ] Backend server running (`python manage.py runserver`)
- [ ] Frontend dependencies installed (`npm install`)
- [ ] Frontend dev server running (`npm run dev`)

---

## 🎯 RECOMMENDATION

### For Beginners/Testing:
**Use Docker** ✅
- Simpler setup
- No Python/Node conflicts
- Just 2 commands: `docker-compose up -d`
- Everything works out of the box

### For Active Development:
**Use Local Setup with Python venv** ✅
- Better debugging
- Faster iteration
- Direct code editing
- Full control

### For Production:
**Use Docker** ✅
- Consistency across environments
- Easy scaling
- Standard deployment

---

**Need Help?** Check README.md or DEPLOYMENT_GUIDE.md in project root!
