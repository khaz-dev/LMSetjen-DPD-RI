# MANUAL SETUP GUIDE - Since Docker is not installed

Your system has:
- ✅ Node.js v22.18.0
- ✅ Python 3.11.0
- ❌ Docker (not installed)

You have two options:

## OPTION 1: Install Docker (Recommended)

### For Windows 11/10 Pro/Enterprise:

1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
2. Run the installer
3. Enable WSL2 when prompted
4. Restart your computer
5. Verify: `docker --version`
6. Then run the setup script again: `.\SETUP_SCRIPT.ps1`

### For Windows 10 Home:

1. First install WSL2: https://docs.microsoft.com/en-us/windows/wsl/install
2. Then download Docker Desktop and install
3. Restart computer
4. Verify: `docker --version`

---

## OPTION 2: Manual Setup (Without Docker)

If you want to skip Docker and use local PostgreSQL/Redis:

### Step 1: Install PostgreSQL Locally

1. Download: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the password you set
4. Verify: `psql --version`

### Step 2: Install Redis Locally

1. Download: https://github.com/microsoftarchive/redis/releases
2. Or use: `choco install redis`
3. Verify: `redis-cli ping` (should show PONG)

### Step 3: Update .env file

Edit `D:\Project\LMSetjen DPD RI\.env`:

Change these lines:
```
DB_HOST=db              → DB_HOST=localhost
REDIS_HOST=redis        → REDIS_HOST=localhost
```

### Step 4: Setup Backend

```powershell
cd "D:\Project\LMSetjen DPD RI\backend"

# Activate venv
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run migrations (assuming PostgreSQL is running locally)
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start server
python manage.py runserver
```

### Step 5: Setup Frontend

```powershell
cd "D:\Project\LMSetjen DPD RI\frontend"

# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## Quick Check

Your environment is almost ready! You have:

```
System Requirements Status:
✅ Node.js 22.18.0     (Required for frontend)
✅ Python 3.11.0       (Required for backend)
❌ Docker              (Required for database/cache - INSTALL OR USE LOCAL)

Recommended: Install Docker Desktop (easier)
Alternative: Install PostgreSQL + Redis locally
```

---

## I Recommend Installing Docker

**Why?**
1. Easier setup
2. Matches production environment
3. No need to install PostgreSQL/Redis separately
4. Everything isolated in containers
5. Can easily reset/restart

**Time to install:** 10-15 minutes

---

## Next Steps

Choose one:

### If Installing Docker:
1. Download from https://www.docker.com/products/docker-desktop
2. Install and restart computer
3. Run: `.\SETUP_SCRIPT.ps1`
4. Follow prompts to create superuser
5. Run: `python manage.py runserver`
6. In new terminal: `npm run dev`
7. Visit: http://localhost:5173

### If Using Local Setup (PostgreSQL + Redis):
1. Install PostgreSQL and Redis locally
2. Update `.env` file to use localhost
3. Follow the manual steps above
4. Run backend: `python manage.py runserver`
5. In new terminal: `npm run dev`
6. Visit: http://localhost:5173

---

Need help? See:
- QUICK_REFERENCE_GETTING_STARTED.md
- DEEP_SYSTEM_SCAN_AND_SETUP_GUIDE.md

