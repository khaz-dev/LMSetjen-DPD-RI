# 🎓 LMSetjen DPD RI - Learning Management System

[![Django](https://img.shields.io/badge/Django-4.2-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-yellow.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://www.docker.com/)

A comprehensive **full-stack Learning Management System** designed for the Indonesian government's **Secretariat General of the Regional Representative Council (Setjen DPD RI)**. Built with Django REST Framework and React 18 with full-text search, analytics, and role-based access control.

**🌐 Indonesian Government | 📚 E-Learning | 🚀 Production Ready**

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Docker Setup](#-docker-setup)
- [Environment Configuration](#-environment-configuration)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

---

## ✨ Features

### For Students
- ✅ **User Authentication** - Secure registration and JWT-based login
- 📚 **Course Catalog** - Browse and filter courses by category and level
- 🎥 **Video Streaming** - High-quality video content delivery
- 📝 **Quizzes & Assessments** - Multiple question types with automatic grading
- 🏆 **Digital Certificates** - Auto-generated certificates upon course completion
- ⭐ **Ratings & Reviews** - Share feedback and rate courses
- 💬 **Q&A Forum** - Interactive discussions with instructors and peers
- ❤️ **Wishlist** - Save favorite courses for later
- 📊 **Learning Dashboard** - Real-time progress tracking

### For Instructors
- 📖 **Course Management** - Create and manage course content
- 🎬 **Content Upload** - Upload videos, documents, and learning materials
- 📋 **Curriculum Builder** - Organize learning structure with drag-and-drop
- ❓ **Quiz Creator** - Create quizzes with various question types
- 👥 **Student Management** - Monitor student progress and performance
- 💬 **Q&A Management** - Respond to student questions
- 📊 **Analytics Dashboard** - Enrollment and completion statistics

### For Administrators
- 👤 **User Management** - Manage users, roles, and permissions
- 📚 **Course Approval** - Approve and manage all platform courses
- 📊 **System Analytics** - Comprehensive platform statistics
- 🔧 **System Configuration** - Manage settings and configurations
- 🔐 **Security Management** - User authentication and authorization
- 📈 **Advanced Analytics** - Trending searches, user behavior analysis

### Technical Features
- 🔍 **Full-Text Search** - PostgreSQL FTS with websearch syntax support
- 📊 **Advanced Analytics** - Dashboard with insights and metrics
- 🎯 **RBAC** - Role-Based Access Control (Student, Teacher, Admin, SuperAdmin)
- 🔐 **Google OAuth 2.0** - SSO integration with FEDCM support
- 🛡️ **JWT Authentication** - Stateless, secure API authentication
- 📱 **Responsive Design** - Mobile-friendly UI with Bootstrap 5
- 🐳 **Docker Ready** - Full Docker Compose setup for development and production
- 🚀 **Performance Optimized** - Lazy loading, code splitting, caching

---

## 🛠️ Tech Stack

### Backend
- **Django 4.2** - Python web framework
- **Django REST Framework** - RESTful API development
- **PostgreSQL 15** - Production-ready database
- **Redis 7** - Caching and session management
- **Gunicorn** - WSGI HTTP Server
- **JWT Authentication** - Secure API endpoints
- **SendGrid** - Email service integration

### Frontend
- **React 18** - JavaScript UI library
- **Vite** - Next-generation build tool
- **React Router v6** - Client-side routing
- **Bootstrap 5** - CSS framework
- **Axios** - HTTP client
- **ChartJS** - Data visualization
- **React Player** - Video player component
- **React Context API** - State management

### DevOps & Tools
- **Docker & Docker Compose** - Containerization
- **Nginx** - Reverse proxy and static file serving
- **Git** - Version control

---

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended)
- OR **Python 3.8+**, **Node.js 16+**, **PostgreSQL 15**, **Redis 7**
- **Git**

### Option 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/lmsetjen-dpdri.git
cd lmsetjen-dpdri

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser
```

Access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9000/api/v1/
- **Admin Panel**: http://localhost:9000/admin/

### Option 2: Local Development Setup

#### Backend (Django)
```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

Backend: http://localhost:8000

#### Frontend (React)
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with API URL

# Start development server
npm run dev
```

Frontend: http://localhost:5173

---

## 💻 Installation

### From Source

#### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/lmsetjen-dpdri.git
cd lmsetjen-dpdri
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database and OAuth settings

# Initialize database
python manage.py makemigrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput

# Run server
python manage.py runserver 0.0.0.0:8000
```

#### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env - set VITE_API_URL to your backend URL

# Development
npm run dev

# Production build
npm run build
npm run preview
```

---

## 🐳 Docker Setup

### Development with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Stop services
docker-compose down
```

### Available Ports
- **Frontend**: 3000 (HTTP), 3443 (HTTPS)
- **Backend API**: 9000
- **PostgreSQL**: 5433
- **Redis**: 6380
- **Nginx**: 3000 (proxies to frontend and backend)

### Service Health Checks
All services have health checks configured. Check status:
```bash
docker-compose ps
```

---

## 🔧 Environment Configuration

### Backend (.env)

Create `backend/.env` from template:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,example.com

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=lms_database
DB_USER=lms_user
DB_PASSWORD=secure_password
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@example.com

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/login

# Security
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3443
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3443
```

### Frontend (.env)

Create `frontend/.env` from template:

```env
VITE_API_URL=http://localhost:9000/api/v1
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_APP_NAME=LMSetjen DPD RI
VITE_APP_ENVIRONMENT=development
```

---

## 📁 Project Structure

```
lmsetjen-dpdri/
│
├── backend/                          # Django REST Backend
│   ├── api/                          # API app
│   │   ├── models.py                 # Database models (~1800 lines)
│   │   ├── views.py                  # API viewsets (~5600 lines)
│   │   ├── serializers.py            # Request/response serialization
│   │   ├── permissions.py            # RBAC permissions
│   │   ├── urls.py                   # API routing
│   │   └── cache_utils.py            # Search caching
│   ├── userauths/                    # User authentication
│   │   ├── models.py                 # User model, profile
│   │   ├── views.py                  # Auth endpoints
│   │   └── serializers.py            # Auth serializers
│   ├── backend/                      # Project settings
│   │   ├── settings.py               # Django configuration
│   │   ├── urls.py                   # Root URL routing
│   │   └── wsgi.py                   # WSGI configuration
│   ├── manage.py                     # Django management script
│   ├── requirements.txt              # Python dependencies
│   ├── Dockerfile                    # Backend container
│   ├── .env.example                  # Environment template
│   └── media/                        # User uploads (gitignored)
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── components/               # Reusable components
│   │   │   ├── Analytics/            # Dashboard charts
│   │   │   ├── CourseCard.jsx        # Course display
│   │   │   └── ...
│   │   ├── views/                    # Page components
│   │   │   ├── admin/                # Admin pages
│   │   │   ├── instructor/           # Instructor pages
│   │   │   ├── student/              # Student pages
│   │   │   └── base/                 # Public pages
│   │   ├── utils/
│   │   │   ├── axios.js              # API client
│   │   │   ├── constants.js          # App constants
│   │   │   └── hooks.js              # Custom hooks
│   │   ├── App.jsx                   # Root component
│   │   └── main.jsx                  # Entry point
│   ├── public/                       # Static assets
│   ├── index.html                    # HTML template
│   ├── vite.config.js                # Vite configuration
│   ├── package.json                  # NPM dependencies
│   ├── Dockerfile                    # Frontend container
│   ├── Dockerfile.prod               # Production image
│   ├── nginx.conf                    # Nginx configuration
│   └── .env.example                  # Environment template
│
├── docker-compose.yml                # Docker composition
├── nginx.conf                        # Nginx main config
├── .gitignore                        # Git ignore rules
├── LICENSE                           # MIT License
└── README.md                         # This file
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:9000/api/v1
```

### Authentication
All API endpoints use JWT Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:9000/api/v1/course/course-list/
```

### Key Endpoints

#### Authentication
- `POST /auth/login/` - User login
- `POST /auth/register/` - User registration
- `POST /auth/google/` - Google OAuth login
- `POST /auth/refresh/` - Refresh JWT token

#### Courses
- `GET /course/course-list/` - List all courses
- `POST /course/course-list/` - Create new course (Teacher)
- `GET /course/{id}/` - Get course details
- `POST /course/{id}/enroll/` - Enroll in course
- `GET /course/full-text-search/` - Full-text search

#### Analytics
- `GET /analytics/dashboard/` - Dashboard metrics
- `GET /analytics/trending-searches/` - Trending search terms
- `GET /analytics/failed-searches/` - Zero-result searches

#### User
- `GET /user/profile/` - Get user profile
- `PUT /user/profile/` - Update profile
- `GET /user/wishlist/` - Get wishlist

See [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for complete reference.

---

## 🔧 Development

### Code Style & Linting

#### Backend (Python)
```bash
# Format code (Black)
black backend/

# Lint code (Flake8)
flake8 backend/

# Type checking (Mypy)
mypy backend/
```

#### Frontend (JavaScript/React)
```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Testing

#### Backend
```bash
# Run tests
python manage.py test

# With coverage
coverage run --source='.' manage.py test
coverage report
```

#### Frontend
```bash
# Currently uses ESLint for code quality
npm run lint
```

### Common Commands

#### Backend
```bash
# Migrations
python manage.py makemigrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic

# Django shell
python manage.py shell

# Clear cache
python manage.py shell < backend/clear_cache.py
```

#### Frontend
```bash
# Development
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Lint check
npm run lint
```

#### Docker
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f [service]

# Rebuild images
docker-compose build --no-cache

# Remove volumes (caution: deletes data)
docker-compose down -v
```

---

## 🚀 Deployment

### Production Checklist

- [ ] Update `SECRET_KEY` in backend settings
- [ ] Set `DEBUG=False`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Setup PostgreSQL (not SQLite)
- [ ] Configure email (SendGrid, etc)
- [ ] Setup Google OAuth credentials
- [ ] Enable HTTPS/SSL
- [ ] Configure domain in CORS settings
- [ ] Set up backups for database

### Docker Production Deployment

```bash
# Build production images
docker-compose build

# Deploy with proper env
docker-compose -f docker-compose.yml up -d

# Verify health
docker-compose ps
docker-compose exec backend python manage.py migrate
```

### Nginx Configuration

The included `nginx.conf` handles:
- SSL/TLS termination
- Frontend static serving
- API reverse proxy
- Gzip compression
- Security headers

### Backup & Maintenance

```bash
# Database backup
docker-compose exec postgres pg_dump -U lms_user lms_database > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U lms_user lms_database < backup.sql
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Error
```
Error: could not translate host name "postgres" to address
```
**Solution**: Ensure PostgreSQL service is running and configured in `.env`

#### 2. CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Update `CORS_ALLOWED_ORIGINS` in backend settings matching your frontend URL

#### 3. API 404 Not Found
```
GET /api/v1/course/course-list/ 404 Not Found
```
**Solution**: Verify backend is running and migrations are applied

#### 4. Video Upload Fails
```
413 Payload Too Large
```
**Solution**: Increase `CLIENT_MAX_BODY_SIZE` in nginx.conf

#### 5. Static Files Not Loading
```
404 for /static/... resources
```
**Solution**: Run `python manage.py collectstatic` and restart services

### Debug Mode

#### Backend Logging
```python
# View logs
docker-compose logs -f backend

# Enable more verbose logging in settings.py
LOGGING = {
    'version': 1,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'DEBUG'}
}
```

#### Frontend Debugging
```javascript
// Enable verbose logging
localStorage.setItem('DEBUG', '*');

// Browser DevTools - F12 for console and network tabs
```

### Health Checks

```bash
# Check backend health
curl http://localhost:9000/api/v1/health/

# Check Redis
docker-compose exec redis redis-cli ping

# Check PostgreSQL
docker-compose exec postgres pg_isready -U lms_user

# Docker service status
docker-compose ps
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Guidelines

- Follow existing code style and patterns
- Write clear commit messages
- Update documentation for new features
- Test your changes locally
- Link related issues in PR description

### Code Standards

- **Python**: Follow PEP 8, use type hints where possible
- **JavaScript/React**: Follow ESLint configuration
- **Commit Messages**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Documentation**: Update README and relevant docs

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

```
MIT License - You are free to use, modify, and distribute this software
```

---

## 📞 Support & Contact

### Getting Help

1. **Documentation**: Check [docs/](docs/) folder
2. **Issues**: Search [GitHub Issues](https://github.com/YOUR_USERNAME/lmsetjen-dpdri/issues)
3. **FAQ**: See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

### Reporting Issues

When reporting bugs, please include:
- Detailed description of the issue
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, browser, versions)
- Error logs if applicable

### Contact Information

- **GitHub Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/lmsetjen-dpdri/issues)
- **Email**: your-email@example.com
- **Organization**: Setjen DPD RI

---

## 🙏 Acknowledgments

- [Django Documentation](https://docs.djangoproject.com/)
- [React Documentation](https://react.dev/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- All contributors and the open-source community

---

<div align="center">

**⭐ If you find this project helpful, please give it a star! ⭐**

Made with ❤️ for Indonesian Government Employee Development

[GitHub](https://github.com/YOUR_USERNAME/lmsetjen-dpdri) • [Issues](https://github.com/YOUR_USERNAME/lmsetjen-dpdri/issues) • [Discussions](https://github.com/YOUR_USERNAME/lmsetjen-dpdri/discussions)

</div>

---

**Last Updated**: January 2026 | **Status**: Production Ready ✅
