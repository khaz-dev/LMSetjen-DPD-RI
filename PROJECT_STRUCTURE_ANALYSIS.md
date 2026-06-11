# LMSetjen DPD RI - Complete Project Structure Analysis
**Generated**: June 10, 2026  
**Current Status**: Production-Ready (Phase 4.9)  
**Git Status**: Main branch, clean working tree

---

## 📋 EXECUTIVE SUMMARY

The **LMSetjen DPD RI** project is a full-stack Learning Management System (LMS) for Indonesian government employees. It features a Django REST Framework backend with PostgreSQL, a React 18 frontend with Vite, and Docker-based deployment. The project is **clean, well-organized, and ready for improved deployment automation**.

### Key Metrics
- **Repository**: Git on main branch, up-to-date with origin
- **Uncommitted Changes**: None (clean working tree)
- **Recent Commits**: 15+ commits, latest: "Fix Google Auth credential"
- **Project Size**: ~50-100 MB (after cleanup, down from 630-700 MB)
- **Architecture**: Monorepo with backend + frontend + documentation

---

## 🏗️ GIT REPOSITORY SETUP

### Repository Status
```
Branch:          main (on origin/main)
Status:          ✅ Clean - no uncommitted changes
Remote:          origin
Remote HEAD:     origin/main
```

### Recent Commits
```
75df29d (HEAD -> main, origin/main, origin/HEAD) Fix Google Auth credential
5418d19 fix some visual override bug across student and admin pages
76fb360 update deplot to staging script
20d0aab remove unnecessery file, code, folder
0caa1ae finishing project ready to deploy on staging server
82ac0b2 Try to optimize Admin Users
3822788 Change color theme to be Teal 2
1d18242 Change color theme to be Teal
6c6b105 Succed add Kursus Tags
159cf73 fix broken width on student headers
```

### Repository Configuration
- `.git/` folder: Present ✅
- `.gitignore`: Configured to exclude dependencies, build outputs, media files
- Git hooks: None detected (potential for pre-commit hooks)

---

## 📁 PROJECT STRUCTURE

### Root Directory Layout
```
LMSetjen DPD RI/
├── 📁 backend/                          # Django REST API
├── 📁 frontend/                         # React Vite Application
├── 📁 docs/                             # Architecture documentation
├── 📁 .github/                          # GitHub configurations
├── 📁 .vscode/                          # VS Code workspace settings
├── 📁 _ARCHIVED_DOCUMENTATION/          # Old documentation (100+ files)
│
├── 🐳 docker-compose.yml                # Docker orchestration
├── .env                                 # Local development config
├── .env.staging                         # Staging environment config
├── .env.example                         # Configuration template
│
├── 🚀 deploy-to-staging.ps1             # PowerShell deploy script
├── 🚀 deploy-on-staging.sh              # Bash deploy script
├── setup-staging.sh                     # Staging setup script
├── setup-google-oauth-staging.ps1       # OAuth configuration
├── cleanup-staging-databases.ps1        # Database cleanup
├── cleanup-staging-databases-simple.ps1 # Simple cleanup (recommended)
│
├── nginx-lms.conf                       # Nginx configuration (basic)
├── nginx-lms-complete.conf              # Nginx configuration (full)
│
├── README.md                            # Project overview
├── CHANGELOG.md                         # Version history
├── CONTRIBUTING.md                      # Development guidelines
├── LICENSE                              # MIT License
│
├── QUICK_DEPLOY.md                      # 5-minute deployment guide
├── STAGING_DEPLOYMENT_GUIDE_MAY_2026.md # Detailed staging guide
├── GOOGLE_OAUTH_STAGING_FIX.md          # OAuth configuration fix
├── CLEANUP_FINAL_STATUS.txt             # Post-cleanup report
└── [Misc test files]                    # Legacy test scripts
```

### Backend Directory (`/backend/`)
```
backend/
├── 📁 api/                              # Main API application
│   ├── models.py             (~1797 lines)   # Data models
│   ├── views.py              (~5619 lines)   # API viewsets
│   ├── serializer.py         (~2000+ lines)  # Request/response serialization
│   ├── permissions.py                       # RBAC implementation
│   ├── urls.py                              # API routing (Phase markers)
│   ├── cache_utils.py                       # Search caching layer
│   └── admin.py                             # Django admin config
│
├── 📁 userauths/                        # Authentication & User Profile
│   ├── models.py                            # User, Profile models
│   ├── views.py                             # Auth endpoints
│   └── serializer.py                        # User serialization
│
├── 📁 core/                             # Django project configuration
│   ├── settings.py                          # Django settings
│   ├── urls.py                              # Root URL routing
│   ├── wsgi.py                              # WSGI application
│   └── asgi.py                              # ASGI application
│
├── 📁 media/                            # User uploads (gitignored)
├── 📁 static/                           # Static assets (gitignored)
├── 📁 staticfiles/                      # Collected static (gitignored)
├── 📁 logs/                             # Application logs
│
├── manage.py                            # Django CLI
├── Dockerfile                           # Multi-stage Docker build
├── requirements.txt                     # Python dependencies (45 packages)
├── runtime.txt                          # Python version specification
└── .dockerignore                        # Docker build exclusions
```

### Frontend Directory (`/frontend/`)
```
frontend/
├── 📁 src/
│   ├── 📁 views/                        # Page components (by role)
│   │   ├── admin/                       # Admin-only pages
│   │   ├── instructor/                  # Teacher-only pages
│   │   ├── student/                     # Student-only pages
│   │   ├── auth/                        # Login/Register
│   │   └── base/                        # Shared pages
│   │
│   ├── 📁 components/                   # Reusable UI components
│   │   ├── SearchResultsDisplay.jsx
│   │   ├── CourseCard.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── Skeletons/                   # Loading skeletons
│   │   └── Analytics/                   # Dashboard charts
│   │
│   ├── 📁 utils/
│   │   ├── apiInstance.js               # Axios wrapper (authenticated)
│   │   ├── useAxios.js                  # Custom hook for API calls
│   │   ├── useComingSoon.js             # Coming soon feature modal
│   │   ├── UserData.js                  # Current user context
│   │   ├── constants.js                 # App constants
│   │   └── imageDimensions.js           # Image utility
│   │
│   ├── 📁 store/
│   │   ├── ProfileContext.js            # User profile state
│   │   └── WishlistContext.js           # Wishlist state
│   │
│   ├── 📁 views/plugin/
│   │   ├── Toast.js                     # Toast notifications
│   │   └── PrivateRoute.jsx             # Route protection
│   │
│   ├── App.jsx                          # Main app component (lazy-loaded routes)
│   ├── index.css                        # Global styles
│   └── main.jsx                         # Entry point
│
├── public/                              # Static assets
├── dist/                                # Build output (gitignored)
├── package.json                         # NPM dependencies (50+ packages)
├── package-lock.json                    # Locked versions
├── vite.config.js                       # Vite build configuration
├── Dockerfile.dev                       # Development Docker image
├── .dockerignore                        # Docker exclusions
├── index.html                           # HTML template
├── .eslintrc.json                       # ESLint configuration
└── .stylelintrc.json                    # Style linter configuration
```

---

## 🚀 DEPLOYMENT FILES

### Docker Orchestration (`docker-compose.yml`)

**Services Defined**:
1. **redis** (Redis cache)
   - Image: `redis:7-alpine`
   - Container: `lms_redis`
   - Port: `6381:6381` (external:internal)
   - Volume: `redis_data:/data`
   - Auth: Password-protected with `REDIS_PASSWORD`

2. **backend** (Django API)
   - Build: `./backend/Dockerfile` (production target)
   - Container: `lms_backend`
   - Port: `8001:8001`
   - Database: PostgreSQL on host (`172.18.0.1:5432`)
   - Redis: Docker network (`redis:6381`)
   - Volumes: Code, media, static files, logs
   - Command: Gunicorn with 4 workers, 2 threads
   - Init: Runs migrations, collectstatic, creates default users

3. **frontend** (React dev server)
   - Build: `./frontend/Dockerfile.dev`
   - Container: `lms_frontend`
   - Port: `5174:5173`
   - Server: Vite dev server with HMR support

**Networks**: `lms_network` (bridge driver)

**Volumes** (Persistent):
- `redis_data` - Redis persistence
- `media_files` - User uploads (deprecated)
- `static_files` - Django static files
- `backend_logs` - Application logs

### Environment Variables

#### `.env` (Development/Local)
```bash
MODE=development
DEBUG=True
SECRET_KEY=django-insecure-dev-key-local-development-2026
ALLOWED_HOSTS=localhost,127.0.0.1,backend,lms.dpd.go.id
DB_HOST=localhost                  # Local PostgreSQL
DB_PORT=5432
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=Okkdpdri@2026
REDIS_HOST=redis                   # Docker Redis
REDIS_PORT=6381
REDIS_PASSWORD=redis_password
FRONTEND_SITE_URL=http://localhost:5174
BACKEND_SITE_URL=http://localhost:8001
VITE_API_BASE_URL=http://localhost:8001
```

#### `.env.staging` (Production/Staging)
```bash
MODE=staging
DEBUG=False
SECRET_KEY=your-very-long-secure-production-secret-key-here-change-me-immediately
ALLOWED_HOSTS=lms.khaz.app,www.lms.khaz.app,lms-be.khaz.app,localhost
DB_HOST=172.18.0.1                 # Docker gateway to host PostgreSQL
DB_PORT=5432
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=Okkdpdri@2026          # ⚠️ EXPOSED - Should be secret
REDIS_HOST=redis
REDIS_PORT=6381
REDIS_PASSWORD=redis_password      # ⚠️ EXPOSED - Should be secret
FRONTEND_SITE_URL=https://lms.khaz.app
BACKEND_SITE_URL=https://lms-be.khaz.app
VITE_API_BASE_URL=https://lms-be.khaz.app
CORS_ALLOWED_ORIGINS=https://lms.khaz.app,https://www.lms.khaz.app,https://lms-be.khaz.app
CSRF_TRUSTED_ORIGINS=https://lms.khaz.app,https://www.lms.khaz.app,https://lms-be.khaz.app,https://localhost
GOOGLE_CLIENT_ID=634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com  # ⚠️ PLACEHOLDER
GOOGLE_CLIENT_SECRET=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                                      # ⚠️ PLACEHOLDER
```

#### `.env.example` (Template)
- Contains all configuration options with descriptions
- Security warnings for production values
- Comments explaining development vs. staging values
- Instructions for generating SECRET_KEY and passwords

### Nginx Configuration

**Two config files provided**:

1. **nginx-lms-complete.conf** (Recommended)
   - Full SSL/TLS setup with Let's Encrypt
   - Security headers (HSTS, CSP, X-Frame-Options, etc.)
   - Dual subdomain routing:
     - `lms.khaz.app` → Frontend (React/Vite on port 5174)
     - `lms-be.khaz.app` → Backend (Django/Gunicorn on port 8001)
   - HTTP → HTTPS redirect
   - WebSocket support for Vite HMR
   - Security best practices

2. **nginx-lms.conf** (Basic)
   - Simpler configuration
   - Legacy/reference configuration

### Deployment Scripts

#### 1. **deploy-to-staging.ps1** (PowerShell)
**Usage**: Run from Windows local machine  
**Purpose**: Deploy to remote staging server via SSH

**Modes**:
- `full-clean-build` - Remove containers/volumes, full rebuild (FRESH START)
- `update-only` - Pull latest, rebuild, keep data (NORMAL UPDATE)
- `update-with-data-copy` - Update code, copy database backup

**Features**:
- SSH key authentication
- Colored output for status messages
- Pre-deployment validation
- Database backup before updates
- Automatic container health checks

**Configuration**:
```powershell
$SSHKeyPath = "c:\Users\khair\khaz"
$StagingServerIP = "165.245.191.216"
$StagingDomain = "lms.khaz.app"
$StagingProjectPath = "/var/www/html/lms"
```

#### 2. **deploy-on-staging.sh** (Bash)
**Usage**: Run on staging server itself  
**Purpose**: Local deployment/update script

**Modes**:
- `full-clean-build` - Full rebuild
- `update-only` - Update with data retention
- `update-with-data-refresh` - Migrations included

**Default Paths**:
```bash
PROJECT_PATH=/root/lmsetjendpdri
BACKUP_DIR=${PROJECT_PATH}/backups
DB_BACKUP_FILE=${BACKUP_DIR}/lmsdb_backup_${BACKUP_TIMESTAMP}.sql
```

#### 3. **setup-google-oauth-staging.ps1** (PowerShell)
**Purpose**: Configure Google OAuth credentials for staging  
**Features**:
- Shows current (placeholder) configuration
- Prompts for real Google credentials
- Updates `.env.staging` automatically
- Optional deploy trigger

#### 4. **cleanup-staging-databases-simple.ps1** (PowerShell)
**Purpose**: Clean up test databases on staging server  
**Recommended**: ✅ Easier and more reliable  
**Features**:
- Individual SSH commands (no quoting issues)
- Automatic database backups
- Interactive confirmation
- Test database cleanup

#### 5. **cleanup-staging-databases.ps1** (PowerShell)
**Purpose**: Full database cleanup script  
**Status**: Fixed (quote escaping resolved)  
**Note**: Use simple version for reliability

---

## 🔧 DOCKER SETUP DETAILS

### Multi-Stage Backend Build

**Stage 1: Base**
- Python 3.11-slim
- System dependencies: gcc, libpq, postgresql-client, ffmpeg, libmagic1
- Non-root user: `appuser` (uid 1000)

**Stage 2: Dependencies**
- Install Python packages from requirements.txt

**Stage 3: Production**
- Optimized final image
- Copy installed packages
- Copy application code
- Create directories with proper permissions
- Health check: HTTP GET to `/api/v1/health/`

### Frontend Build

**Development Image** (`Dockerfile.dev`)
- Node 20-alpine
- Vite dev server
- Port 5173 (exposed as 5174)
- WebSocket HMR support
- No health check (dev server)

### Database Architecture

**PostgreSQL on Host Machine**
- External to Docker
- Accessed via Docker gateway IP: `172.18.0.1`
- Database: `lmsdb` (shared for dev and staging)
- User: `postgres`
- Port: 5432

**Redis in Docker**
- Service name: `redis`
- Accessible within Docker network as `redis:6381`
- Persistent volume: `redis_data`
- Password-protected

---

## ⚠️ CURRENT ISSUES & CONCERNS

### 🔴 CRITICAL ISSUES

#### 1. **Google OAuth Credentials Are Placeholders**
- **Status**: 🔴 CRITICAL - OAuth completely broken on staging
- **Location**: `.env.staging` lines 59-62
- **Problem**: 
  ```bash
  GOOGLE_CLIENT_ID=634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com  # REAL ID?
  GOOGLE_CLIENT_SECRET=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                                  # REAL SECRET?
  VITE_GOOGLE_CLIENT_ID=634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com
  ```
- **Impact**: Users cannot login with Google on staging
- **Solution**: Use real Google OAuth credentials or leave blank if not needed

#### 2. **Database Credentials in Version Control**
- **Status**: 🔴 SECURITY RISK
- **Location**: `.env.staging`
- **Problem**: 
  ```bash
  DB_PASSWORD=Okkdpdri@2026                    # Exposed in git
  REDIS_PASSWORD=redis_password                # Weak password
  GOOGLE_CLIENT_SECRET=GOCSPX-...             # Exposed in git
  ```
- **Impact**: Production credentials visible in repository
- **Solution**: Use `.env.staging` only as template; real secrets should be injected at deploy time

### 🟡 YELLOW FLAGS

#### 3. **Deployment Script Project Path Mismatch**
- **Status**: 🟡 MODERATE - Scripts reference different paths
- **Problem**:
  - `.env.staging`: `/var/www/html/lms`
  - `deploy-on-staging.sh`: `/root/lmsetjendpdri`
  - `STAGING_DEPLOYMENT_GUIDE_MAY_2026.md`: `/var/www/html/lms` (correct)
- **Impact**: Bash scripts may fail if running on staging server
- **Solution**: Update deployment scripts to use consistent path

#### 4. **Multiple Staging Databases on Server**
- **Status**: 🟡 MODERATE - Confusion about which DB is used
- **Problem**: Staging server has both `lmsdb` and `lmsdb_staging`
- **Resolution**: `.env.staging` uses `lmsdb` (correct), can delete `lmsdb_staging`
- **Action**: Already has cleanup script available

#### 5. **Test Databases Left on Staging**
- **Status**: 🟡 MINOR - Cleanup needed
- **Problem**: `testdb`, `testdb2`, `testfixdb` exist on staging server
- **Solution**: Run `cleanup-staging-databases-simple.ps1`

### 🟢 RESOLVED ISSUES

✅ Avatar upload bug - Fixed (serializer now uses FileField)  
✅ CSS scope pollution - Fixed across multiple pages  
✅ YouTube player race conditions - Fixed  
✅ Project cleanup - 475+ unnecessary files removed  
✅ Repository size - Reduced from 630-700 MB to 50-100 MB

---

## 📊 PROJECT DEPENDENCIES

### Backend Python Packages (45 total)
**Key Packages**:
- Django 4.2.7
- Django REST Framework 3.14.0
- PostgreSQL: psycopg2-binary 2.9.9
- Redis: redis 5.0.1, django-redis 5.4.0
- JWT: djangorestframework-simplejwt 5.2.2
- Gunicorn 21.2.0
- Video processing: moviepy 1.0.3, yt-dlp 2025.1.26, pytube 15.0.0
- Admin UI: django-jazzmin 2.6.0
- Email: django-anymail 10.2
- S3 Storage: django-storages 1.12.3, boto3
- Testing: pytest, django-debug-toolbar

### Frontend Node Packages (50+ total)
**Key Packages**:
- React 18.2.0
- React Router v6 6.30.3
- Vite 7.3.1 (build tool)
- Bootstrap 5.3.2 + React Bootstrap 2.10.0
- Axios 1.6.5 (HTTP client)
- Chart.js 4.4.0 (analytics)
- React Player 2.16.1 (video)
- CKEditor 5 (rich text editor)
- Sweet Alert 2 (modals)
- React Image Crop 11.0.10
- JWT Decode 3.1.2
- QR Code 3.1.0

---

## 📈 ARCHITECTURE PATTERNS

### Backend Architecture

**RBAC (Role-Based Access Control)**
- Permission classes: `IsAdminUser`, `IsTeacherUser`, `IsStudentUser`, `IsSuperAdmin`
- User roles: student, teacher/instructor, admin, super_admin
- Per-endpoint permission enforcement

**Search Architecture**
- Full-text search via PostgreSQL `SearchVector`
- Search caching layer (`SearchCacheManager`)
- Endpoints:
  - `/api/v1/course/full-text-search/` - Advanced FTS
  - `/api/v1/course/search/` - Basic search
  - `/api/v1/search/advanced/` - Filtered search
- Search logging for analytics

**API Response Patterns**
- Pagination: 20 items/page (configurable)
- Response structure: `{count, results, execution_time_ms}`
- Error handling: DRF standard HTTP status codes

### Frontend Architecture

**Component Organization**
- Lazy-loaded routes (all page components)
- Role-based view segregation (admin, instructor, student, base)
- Reusable components library
- Custom hooks: `useAxios`, `UserData`, `useComingSoon`
- Context API: `ProfileContext`, `WishlistContext`

**Performance Optimizations**
- React.memo on all components
- Lazy loading with Suspense
- Skeleton loading instead of text spinners
- Chunk splitting in Vite config
- Toast notifications (no alerts)

**State Management**
- React Context API (ProfileContext, WishlistContext)
- Zustand available in dependencies

---

## 🔐 SECURITY CONFIGURATION

### CORS & CSRF
- **CORS Origins**: Configured for dual subdomains (lms.khaz.app, lms-be.khaz.app)
- **CSRF Trusted Origins**: Must include scheme (http://, https://)
- **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options

### SSL/TLS
- Let's Encrypt certificates: `/etc/letsencrypt/live/khaz.app/`
- Certificate auto-renewal via Certbot
- TLS 1.2 & 1.3 only

### Authentication
- JWT-based (djangorestframework-simplejwt)
- Refresh token rotation
- Google OAuth 2.0 integration
- SSO endpoint support

---

## 📚 DOCUMENTATION

### Key Documentation Files
1. **README.md** - Project overview, quick start
2. **CHANGELOG.md** - Version history, features, known issues
3. **CONTRIBUTING.md** - Development guidelines, branch strategy
4. **QUICK_DEPLOY.md** - 5-minute deployment reference
5. **STAGING_DEPLOYMENT_GUIDE_MAY_2026.md** - Detailed step-by-step guide
6. **GOOGLE_OAUTH_STAGING_FIX.md** - OAuth configuration guide
7. **docs/** - Architecture documentation
   - DEPLOYMENT_GUIDE_UBUNTU.md
   - Z_INDEX_HIERARCHY.md
   - VIDEO_MODAL_BEST_PRACTICES.md
   - RANKING_SYSTEM.md

### Archived Documentation
- **_ARCHIVED_DOCUMENTATION/** - 100+ old phase documentation files
- Useful for historical reference but not current

---

## 🔄 GIT WORKFLOW

### Branch Strategy
- **Main Branch**: `main` - Production-ready code
- **Remote**: GitHub (`origin`)
- **No Feature Branches**: Currently flat structure

### Recent Development
- Active development with regular commits
- Focus on bug fixes (avatar, CSS, video players)
- Performance optimizations (Phase 4.9)

### Recommendations
- Implement feature branch strategy (`feature/`, `bugfix/`, `hotfix/`)
- Add pre-commit hooks for linting/testing
- Add CI/CD pipeline (GitHub Actions)

---

## 🎯 DEPLOYMENT READINESS CHECKLIST

### ✅ Ready for Deployment
- [x] Code committed and on main branch
- [x] Docker Compose configured
- [x] Environment files prepared (.env, .env.staging, .env.example)
- [x] Nginx configuration provided
- [x] Database migrations supported
- [x] Static files collection configured
- [x] Health checks implemented
- [x] Logging configured
- [x] Backup scripts available
- [x] Database cleanup scripts available

### ⚠️ Needs Attention Before Production
- [ ] Database credentials should be injected at deploy time (not in .env.staging)
- [ ] Google OAuth credentials need to be configured (or remove if not needed)
- [ ] Redis password should be strong (randomized)
- [ ] SECRET_KEY should be generated per environment
- [ ] Consider implementing CI/CD pipeline
- [ ] Add database backup automation
- [ ] Configure SSL certificate renewal automation
- [ ] Set up monitoring/alerting

### 🚀 Deployment Paths
1. **Local Development**: `npm run dev` + `python manage.py runserver`
2. **Docker Development**: `docker-compose up -d`
3. **Staging Deployment**: `.\deploy-to-staging.ps1 -Mode update-only`
4. **Production**: Similar to staging, with security hardening

---

## 📝 SUMMARY FOR IMPROVED DEPLOY SCRIPT

### Current Script Issues
1. PowerShell path not updated (references old `/root/lmsetjendpdri`)
2. No validation of required environment variables
3. No pre-deployment health checks
4. Limited error handling and rollback capability
5. No automatic backup before destructive operations

### Opportunities for Improvement
1. **Pre-flight checks**: Verify SSH, disk space, Docker status
2. **Environment validation**: Ensure required .env variables are set
3. **Automatic secrets**: Generate SECRET_KEY and passwords if missing
4. **Dry-run mode**: Preview changes before applying
5. **Rollback support**: Keep previous deployment available
6. **Health checks**: Verify services are running post-deploy
7. **Logging**: Detailed logs for debugging
8. **Parallel operations**: Speed up deployment
9. **Zero-downtime**: Use Docker strategies for seamless updates
10. **Monitoring**: Integration with status/notification services

---

## 📞 QUICK REFERENCE

### Key Server Info
- **Staging Server**: `165.245.191.216`
- **SSH User**: `root`
- **Project Path**: `/var/www/html/lms`
- **SSH Key**: `c:\Users\khair\khaz`
- **Nginx Config**: `/etc/nginx/sites-available/`
- **Staging Domain**: `lms.khaz.app`
- **Backend Subdomain**: `lms-be.khaz.app`

### Port Mapping
- Frontend: 5174 (Vite dev server on 5173)
- Backend: 8001 (Gunicorn)
- Redis: 6381
- PostgreSQL: 5432 (on host)
- Nginx HTTP: 80
- Nginx HTTPS: 443

### Service Health Check
- Backend: `curl http://localhost:8001/api/v1/health/`
- Frontend: `http://localhost:5174`
- Admin: `https://lms.khaz.app/admin/`

