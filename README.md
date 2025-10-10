# 🚀 DJANGO REACT LMS - QUICK START GUIDE

**Project Status:** ✅ Production Ready  
**Last Updated:** October 10, 2025

---

## 📁 PROJECT STRUCTURE

```
Django React LMS/
├── backend/          # Django REST API
├── frontend/         # React Application
└── reports/          # Trial Reports (4 PDF-ready HTML files)
```

---

## 🏃 QUICK START

### Backend (Django)
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
python manage.py runserver
```
**URL:** http://localhost:8000

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```
**URL:** http://localhost:5173

---

## 🔑 KEY FILES

### Backend
- `backend/manage.py` - Django management
- `backend/requirements.txt` - Python dependencies
- `backend/db.sqlite3` - Database
- `backend/.env` - Environment variables

### Frontend
- `frontend/package.json` - NPM dependencies
- `frontend/vite.config.js` - Vite configuration
- `frontend/src/` - React source code

---

## 📊 TRIAL REPORTS

**Location:** `reports/` folder

### Available Reports (4 versions):
1. **Laporan_Uji_Coba_Independen_ID.html** (Indonesian)
2. **Independent_Trial_Report_EN.html** (English)
3. **Laporan_Uji_Coba_Terbatas_PKSDM_ID.html** (Indonesian - Internal)
4. **Limited_Trial_Report_PKSDM_EN.html** (English - Internal)

### Convert to PDF:
1. Open HTML file in browser
2. Press `Ctrl + P` (or `Cmd + P`)
3. Select "Save as PDF"
4. Save

---

## 🛠️ COMMON COMMANDS

### Backend
```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic
```

### Frontend
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

## 🎯 FEATURES

- ✅ User Authentication (JWT)
- ✅ Course Management
- ✅ Video Streaming
- ✅ Quiz System with Certificates
- ✅ Q&A Forum
- ✅ Review & Rating
- ✅ Wishlist & Cart
- ✅ Dashboard Analytics
- ✅ Mobile Responsive

---

## 📝 RECENT UPDATES

### ✅ Completed (October 2025)
1. ✅ Cleaned 218+ console.log statements
2. ✅ Removed 80+ unnecessary files (~566MB)
3. ✅ Generated 4 professional trial reports
4. ✅ Optimized project structure

---

## 🔧 TECH STACK

### Backend
- Django 4.x
- Django REST Framework
- SQLite / PostgreSQL
- JWT Authentication

### Frontend
- React 18
- Vite
- React Router
- Zustand (State Management)
- Bootstrap 5

---

## 📞 SUPPORT

For questions or issues:
1. Check `PROJECT_CLEANUP_REPORT.md`
2. Review `reports/README.md`
3. Check Django/React documentation

---

**Project Status:** ✅ PRODUCTION READY  
**Last Cleanup:** October 10, 2025
