# 🚀 Quick Start Guide - LMSetjen DPD RI

**Get the LMS up and running in 5 minutes!**

---

## Option 1: Docker Compose (Recommended - Fastest)

### Requirements
- Docker Desktop installed ([download](https://www.docker.com/products/docker-desktop))
- Git installed

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/lmsetjen-dpdri.git
cd lmsetjen-dpdri

# 2. Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start all services
docker-compose up -d

# 4. Wait for services to start (about 30 seconds)
# Check status with:
docker-compose ps

# 5. Run database migrations
docker-compose exec backend python manage.py migrate

# 6. Create admin user
docker-compose exec backend python manage.py createsuperuser
# Follow prompts to create your account

# 7. Open in browser
# Frontend: http://localhost:3000
# Admin:    http://localhost:9000/admin/
```

**Done!** Your LMS is now running. 🎉

---

## Option 2: Local Setup (Flexible)

### Requirements
- Python 3.8+ ([download](https://www.python.org/))
- Node.js 16+ ([download](https://nodejs.org/))
- PostgreSQL 15 ([download](https://www.postgresql.org/))
- Redis 7 ([download](https://redis.io/))
- Git

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Copy environment file
cp .env.example .env

# 6. Edit .env with your database settings
# (Open .env and update DB_NAME, DB_USER, DB_PASSWORD)

# 7. Run migrations
python manage.py makemigrations
python manage.py migrate

# 8. Create admin user
python manage.py createsuperuser

# 9. Start backend server
python manage.py runserver

# Backend running at: http://localhost:8000
```

### Frontend Setup (in new terminal)

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Start development server
npm run dev

# Frontend running at: http://localhost:5173
```

**Done!** Access the application at http://localhost:5173

---

## 📝 First Steps After Setup

### 1. Login to Admin Panel
- **URL**: http://localhost:9000/admin/ (Docker) or http://localhost:8000/admin/ (Local)
- Use credentials you created during setup

### 2. Create Test Data (Optional)
```bash
# In backend terminal:
python manage.py shell

# In Python shell:
from api.models import Category, Course
from django.contrib.auth import get_user_model

User = get_user_model()

# Create test user with teacher role
teacher = User.objects.create_user(
    username='teacher1',
    email='teacher@example.com',
    password='password123',
    role='teacher'
)

# Create categories
cat1 = Category.objects.create(name='Technology', slug='technology')
cat2 = Category.objects.create(name='Business', slug='business')

# Create a sample course
course = Course.objects.create(
    title='Python Basics',
    slug='python-basics',
    teacher=teacher,
    category=cat1,
    description='Learn Python from scratch',
    level='beginner',
    price=0
)

print("Test data created!")
exit()
```

### 3. Browse Courses
- Visit http://localhost:3000
- Explore available courses
- Register as a student
- Enroll in courses

---

## 🔑 Test Credentials

After setup, use these to test different roles:

### Admin Access
- **URL**: http://localhost:9000/admin/
- **Username**: (superuser you created)
- **Password**: (password you set)

### Student Access
1. Go to http://localhost:3000
2. Click "Sign Up"
3. Create account with student role
4. Explore courses and enroll

### Teacher Access
1. Create user with `role='teacher'` in admin
2. Login with teacher account
3. Access teacher dashboard
4. Create and manage courses

---

## 🛠️ Common Commands

### Docker Commands
```bash
# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart services
docker-compose restart

# Rebuild images
docker-compose build --no-cache
```

### Backend Commands
```bash
# Create superuser
python manage.py createsuperuser

# Make migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Django shell
python manage.py shell

# Run tests
python manage.py test
```

### Frontend Commands
```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## 📊 Default Ports

| Service | Docker Port | Local Port |
|---------|------------|-----------|
| Frontend | 3000 | 5173 |
| Backend | 9000 | 8000 |
| Admin | 9000 | 8000 |
| PostgreSQL | 5433 | 5432 |
| Redis | 6380 | 6379 |

---

## ❓ Troubleshooting

### Docker Issues

**Error**: `docker: command not found`
- Solution: Install Docker Desktop

**Error**: Ports already in use
- Solution: Change ports in docker-compose.yml or stop conflicting services

**Error**: Services won't start
- Solution: 
  ```bash
  docker-compose down -v  # Remove volumes
  docker-compose up -d    # Restart
  ```

### Backend Issues

**Error**: `ModuleNotFoundError: No module named 'django'`
- Solution: Activate virtual environment and run `pip install -r requirements.txt`

**Error**: Database connection error
- Solution: Ensure PostgreSQL is running and .env has correct credentials

**Error**: `Table doesn't exist`
- Solution: Run `python manage.py migrate`

### Frontend Issues

**Error**: `Cannot find module 'react'`
- Solution: Run `npm install`

**Error**: API 404 errors
- Solution: 
  1. Check backend is running
  2. Verify VITE_API_URL in .env is correct
  3. Run migrations on backend

**Error**: CORS errors
- Solution: Ensure `CORS_ALLOWED_ORIGINS` in backend includes frontend URL

---

## 📚 Next Steps

After getting started:

1. **Read the Documentation**
   - [README.md](README.md) - Full documentation
   - [docs/](docs/) - Additional guides

2. **Explore the Code**
   - Frontend: `frontend/src/`
   - Backend: `backend/api/`

3. **Try Key Features**
   - Create courses (as teacher)
   - Enroll in courses (as student)
   - Take quizzes
   - Download certificates
   - Try search functionality

4. **Customize**
   - Update branding in `frontend/src/`
   - Modify colors in CSS files
   - Add custom pages or features

5. **Deploy**
   - See [README.md#-deployment](README.md#-deployment)
   - Follow production checklist
   - Configure domain and SSL

---

## 🆘 Still Having Issues?

1. **Check Logs**
   ```bash
   # Docker
   docker-compose logs -f

   # Local backend
   python manage.py runserver  # Shows errors in terminal
   ```

2. **Common Solutions**
   - Restart services: `docker-compose restart`
   - Clear cache: `docker-compose exec backend python manage.py shell < clear_cache.py`
   - Reset database: `docker-compose down -v && docker-compose up -d`

3. **Get Help**
   - Open GitHub Issue: [New Issue](https://github.com/YOUR_USERNAME/lmsetjen-dpdri/issues)
   - Check existing issues
   - Read troubleshooting guide

---

## 🎯 What's Next?

✅ **Setup Complete!**

Now you can:
- 👨‍🏫 Create and manage courses
- 👨‍🎓 Enroll students in courses  
- 📊 View analytics and reports
- 🔍 Search and filter courses
- 📱 Access on mobile devices
- 🚀 Deploy to production

---

<div align="center">

**Happy Learning! 🎓**

For detailed documentation, see [README.md](README.md)

</div>
