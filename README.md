# 🎓 LMSetjen DPD RI - Learning Management System# 🚀 DJANGO REACT LMS - QUICK START GUIDE



**Platform Pembelajaran Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia****Project Status:** ✅ Production Ready  

**Last Updated:** October 10, 2025

[![Django](https://img.shields.io/badge/Django-4.x-green.svg)](https://www.djangoproject.com/)

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)---

[![Python](https://img.shields.io/badge/Python-3.8+-yellow.svg)](https://www.python.org/)

[![License](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)## 📁 PROJECT STRUCTURE



---```

Django React LMS/

## 📋 Daftar Isi├── backend/          # Django REST API

├── frontend/         # React Application

- [Tentang Proyek](#-tentang-proyek)└── reports/          # Trial Reports (4 PDF-ready HTML files)

- [Fitur Utama](#-fitur-utama)```

- [Teknologi](#-teknologi)

- [Instalasi](#-instalasi)---

- [Penggunaan](#-penggunaan)

- [Struktur Proyek](#-struktur-proyek)## 🏃 QUICK START

- [Deployment](#-deployment)

- [Kontribusi](#-kontribusi)### Backend (Django)

- [Lisensi](#-lisensi)```bash

cd backend

---python -m venv venv

venv\Scripts\activate      # Windows

## 📖 Tentang Proyeksource venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

LMSetjen DPD RI adalah platform Learning Management System (LMS) yang dirancang khusus untuk mendukung pengembangan kompetensi pegawai Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia.python manage.py runserver

```

### Tujuan**URL:** http://localhost:8000

- 🎯 Menyediakan platform pembelajaran online yang modern dan user-friendly

- 📚 Memfasilitasi pengembangan skill dan kompetensi pegawai### Frontend (React)

- 🔄 Mendukung pembelajaran mandiri dan kolaboratif```bash

- 📊 Menyediakan sistem evaluasi dan sertifikasicd frontend

npm install

---npm run dev

```

## ✨ Fitur Utama**URL:** http://localhost:5173



### Untuk Peserta Didik---

- ✅ **Pendaftaran & Autentikasi** - Sistem registrasi dan login yang aman dengan JWT

- 📚 **Katalog Kursus** - Browse dan filter kursus berdasarkan kategori## 🔑 KEY FILES

- 🎥 **Video Learning** - Streaming video pembelajaran berkualitas tinggi

- 📝 **Quiz & Assessment** - Sistem kuis dengan berbagai tipe pertanyaan### Backend

- 🏆 **Sertifikat Digital** - Sertifikat otomatis setelah menyelesaikan kursus- `backend/manage.py` - Django management

- ⭐ **Review & Rating** - Beri rating dan ulasan untuk kursus- `backend/requirements.txt` - Python dependencies

- 💬 **Q&A Forum** - Tanya jawab dengan instruktur dan peserta lain- `backend/db.sqlite3` - Database

- ❤️ **Wishlist** - Simpan kursus favorit untuk dipelajari nanti- `backend/.env` - Environment variables

- 📊 **Dashboard Progress** - Tracking progres pembelajaran real-time

### Frontend

### Untuk Instruktur- `frontend/package.json` - NPM dependencies

- 📖 **Manajemen Kursus** - Create, edit, dan manage kursus- `frontend/vite.config.js` - Vite configuration

- 🎬 **Upload Konten** - Upload video, dokumen, dan materi pembelajaran- `frontend/src/` - React source code

- 📋 **Curriculum Builder** - Atur struktur pembelajaran dengan drag-and-drop

- ❓ **Quiz Creator** - Buat kuis dengan berbagai tipe pertanyaan---

- 👥 **Student Management** - Monitor progres dan performa peserta

- 💬 **Q&A Management** - Jawab pertanyaan dari peserta## 📊 TRIAL REPORTS

- 📊 **Analytics Dashboard** - Statistik enrollment dan completion rate

**Location:** `reports/` folder

### Untuk Administrator

- 👤 **User Management** - Kelola user, role, dan permissions### Available Reports (4 versions):

- 📚 **Course Approval** - Approve dan manage semua kursus1. **Laporan_Uji_Coba_Independen_ID.html** (Indonesian)

- 📊 **System Analytics** - Dashboard lengkap dengan statistik platform2. **Independent_Trial_Report_EN.html** (English)

- 🔧 **System Configuration** - Pengaturan sistem dan konfigurasi3. **Laporan_Uji_Coba_Terbatas_PKSDM_ID.html** (Indonesian - Internal)

4. **Limited_Trial_Report_PKSDM_EN.html** (English - Internal)

---

### Convert to PDF:

## 🛠️ Teknologi1. Open HTML file in browser

2. Press `Ctrl + P` (or `Cmd + P`)

### Backend3. Select "Save as PDF"

- **Django 4.x** - Web framework Python4. Save

- **Django REST Framework** - RESTful API development

- **SQLite** - Database (development)---

- **PostgreSQL** - Database (production ready)

- **JWT** - JSON Web Token authentication## 🛠️ COMMON COMMANDS

- **Pillow** - Image processing

- **django-cors-headers** - CORS handling### Backend

```bash

### Frontend# Create migrations

- **React 18** - JavaScript library untuk UIpython manage.py makemigrations

- **Vite** - Build tool dan dev server

- **React Router** - Client-side routing# Apply migrations

- **Bootstrap 5** - CSS frameworkpython manage.py migrate

- **Axios** - HTTP client

- **React Player** - Video player component# Create superuser

- **React DnD** - Drag and drop functionalitypython manage.py createsuperuser

- **Zustand** - State management

# Collect static files

---python manage.py collectstatic

```

## 🚀 Instalasi

### Frontend

### Prasyarat```bash

- Python 3.8 atau lebih tinggi# Development

- Node.js 16.x atau lebih tingginpm run dev

- npm atau yarn

- Git# Production build

npm run build

### Clone Repository

```bash# Preview production build

git clone https://github.com/khaz-dev/LMSetjen-DPD-RI.gitnpm run preview

cd LMSetjen-DPD-RI

```# Lint code

npm run lint

### Setup Backend (Django)```



1. **Masuk ke direktori backend**---

```bash

cd backend## 🎯 FEATURES

```

- ✅ User Authentication (JWT)

2. **Buat virtual environment**- ✅ Course Management

```bash- ✅ Video Streaming

# Windows- ✅ Quiz System with Certificates

python -m venv venv- ✅ Q&A Forum

venv\Scripts\activate- ✅ Review & Rating

- ✅ Wishlist & Cart

# Mac/Linux- ✅ Dashboard Analytics

python3 -m venv venv- ✅ Mobile Responsive

source venv/bin/activate

```---



3. **Install dependencies**## 📝 RECENT UPDATES

```bash

pip install -r requirements.txt### ✅ Completed (October 2025)

```1. ✅ Cleaned 218+ console.log statements

2. ✅ Removed 80+ unnecessary files (~566MB)

4. **Setup database**3. ✅ Generated 4 professional trial reports

```bash4. ✅ Optimized project structure

python manage.py makemigrations

python manage.py migrate---

```

## 🔧 TECH STACK

5. **Buat superuser (admin)**

```bash### Backend

python manage.py createsuperuser- Django 4.x

```- Django REST Framework

- SQLite / PostgreSQL

6. **Jalankan development server**- JWT Authentication

```bash

python manage.py runserver### Frontend

```- React 18

- Vite

Backend akan berjalan di: **http://localhost:8000**- React Router

- Zustand (State Management)

### Setup Frontend (React)- Bootstrap 5



1. **Buka terminal baru dan masuk ke direktori frontend**---

```bash

cd frontend## 📞 SUPPORT

```

For questions or issues:

2. **Install dependencies**1. Check `PROJECT_CLEANUP_REPORT.md`

```bash2. Review `reports/README.md`

npm install3. Check Django/React documentation

# atau

yarn install---

```

**Project Status:** ✅ PRODUCTION READY  

3. **Jalankan development server****Last Cleanup:** October 10, 2025

```bash
npm run dev
# atau
yarn dev
```

Frontend akan berjalan di: **http://localhost:5173**

---

## 💻 Penggunaan

### Akses Aplikasi

1. **Landing Page**: http://localhost:5173
2. **Admin Panel**: http://localhost:8000/admin
3. **API Documentation**: http://localhost:8000/api/

### Default Credentials

Setelah membuat superuser, gunakan kredensial tersebut untuk login.

### Testing

1. **Registrasi sebagai Student** - Klik "Daftar" di landing page
2. **Login** - Masuk dengan kredensial yang dibuat
3. **Browse Kursus** - Jelajahi katalog kursus
4. **Enroll Kursus** - Daftar ke kursus yang diinginkan
5. **Mulai Belajar** - Akses materi pembelajaran

---

## 📁 Struktur Proyek

```
LMSetjen-DPD-RI/
├── backend/                    # Django Backend
│   ├── api/                    # API endpoints
│   │   ├── models.py          # Database models
│   │   ├── serializers.py     # API serializers
│   │   ├── views.py           # API views
│   │   └── urls.py            # URL routing
│   ├── lms_api/               # Project settings
│   │   ├── settings.py        # Django settings
│   │   ├── urls.py            # Root URLs
│   │   └── wsgi.py            # WSGI config
│   ├── media/                 # Uploaded files
│   ├── manage.py              # Django management
│   └── requirements.txt       # Python dependencies
│
├── frontend/                   # React Frontend
│   ├── public/                # Public assets
│   ├── src/
│   │   ├── assets/            # Images, fonts, etc
│   │   ├── components/        # Reusable components
│   │   ├── layouts/           # Layout components
│   │   ├── utils/             # Utility functions
│   │   ├── views/             # Page components
│   │   │   ├── admin/         # Admin pages
│   │   │   ├── auth/          # Authentication pages
│   │   │   ├── base/          # Public pages
│   │   │   ├── instructor/    # Instructor pages
│   │   │   └── student/       # Student pages
│   │   ├── App.jsx            # Root component
│   │   └── main.jsx           # Entry point
│   ├── package.json           # NPM dependencies
│   └── vite.config.js         # Vite configuration
│
├── docs/                       # Documentation
├── reports/                    # Trial reports
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

---

## 🌐 Deployment

### Production Build

#### Backend (Django)

1. **Update settings untuk production**
```python
# backend/lms_api/settings.py
DEBUG = False
ALLOWED_HOSTS = ['your-domain.com']
```

2. **Setup PostgreSQL** (recommended)
```bash
pip install psycopg2-binary
```

3. **Collect static files**
```bash
python manage.py collectstatic
```

4. **Run with Gunicorn**
```bash
pip install gunicorn
gunicorn lms_api.wsgi:application
```

#### Frontend (React)

1. **Build untuk production**
```bash
npm run build
# atau
yarn build
```

2. **Deploy build folder** ke hosting (Netlify, Vercel, dll)

### Environment Variables

Buat file `.env` di backend:
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com
DATABASE_URL=postgresql://user:pass@localhost/dbname
```

---

## 🔧 Konfigurasi

### Backend Configuration

File: `backend/lms_api/settings.py`

```python
# Sesuaikan sesuai kebutuhan:
ALLOWED_HOSTS = ['localhost', '127.0.0.1']
CORS_ALLOWED_ORIGINS = ['http://localhost:5173']
```

### Frontend Configuration

File: `frontend/src/utils/axios.js`

```javascript
// Update base URL sesuai backend
const baseURL = 'http://localhost:8000/api/v1/';
```

---

## 🤝 Kontribusi

Kontribusi selalu diterima! Jika Anda ingin berkontribusi:

1. Fork repository ini
2. Buat branch baru (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

### Coding Guidelines

- Ikuti PEP 8 untuk Python code
- Gunakan ESLint rules untuk JavaScript/React
- Tulis komentar yang jelas dan deskriptif
- Update dokumentasi jika diperlukan

---

## 📝 Changelog

### Version 1.0.0 (October 2025)
- ✅ Initial release
- ✅ Complete LMS functionality
- ✅ Student, Instructor, and Admin roles
- ✅ Video streaming and quiz system
- ✅ Certificate generation
- ✅ Responsive design
- ✅ Landing page with scroll-snap sections
- ✅ Comprehensive dashboard analytics

---

## 🐛 Known Issues & Troubleshooting

### Common Issues

1. **CORS Error**
   - Pastikan backend CORS settings sudah benar
   - Check `CORS_ALLOWED_ORIGINS` di settings.py

2. **Database Migration Error**
   - Hapus migration files dan buat ulang
   - Reset database jika diperlukan

3. **Video Upload Error**
   - Check media folder permissions
   - Verify MAX_UPLOAD_SIZE settings

### Getting Help

- Check documentation di folder `docs/`
- Buat issue di GitHub repository
- Contact: khaz-dev@github.com

---

## 📄 Lisensi

Project ini dilisensikan under the MIT License - lihat file [LICENSE](LICENSE) untuk detail.

---

## 👥 Tim Pengembang

**LMSetjen DPD RI Development Team**

- Project Lead: [Your Name]
- Backend Developer: [Your Name]
- Frontend Developer: [Your Name]
- UI/UX Designer: [Your Name]

---

## 🙏 Acknowledgments

- Django Documentation
- React Documentation
- Bootstrap Team
- All contributors and supporters

---

## 📞 Kontak

- **Website**: [https://github.com/khaz-dev/LMSetjen-DPD-RI](https://github.com/khaz-dev/LMSetjen-DPD-RI)
- **Email**: khaz-dev@github.com
- **Issues**: [GitHub Issues](https://github.com/khaz-dev/LMSetjen-DPD-RI/issues)

---

<div align="center">

**⭐ Jika project ini membantu, jangan lupa untuk memberikan star! ⭐**

Made with ❤️ by LMSetjen DPD RI Team

</div>
