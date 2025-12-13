# LMSetjen DPD RI - Quick Reference Card

**Last Updated**: November 2025 | **Phase**: 4.9+ | **Status**: Production-Ready

---

## 🎯 Quick Facts

| Aspect | Details |
|--------|---------|
| **Project Type** | Full-Stack LMS |
| **Backend** | Django REST Framework + PostgreSQL |
| **Frontend** | React 18 + Vite + Bootstrap 5 |
| **API Views** | 80+ endpoints |
| **Roles** | Student, Teacher, Admin, Super Admin |
| **Search Types** | Basic, Full-Text, Advanced |
| **Key Features** | Courses, Quizzes, Certificates, Analytics, Q&A |

---

## 🔑 Key Endpoints (Top 15)

```
POST   /api/v1/auth/token/              Login (JWT)
GET    /api/v1/course/course-list/      All courses
POST   /api/v1/course/                  Create course
GET    /api/v1/course/full-text-search/ Advanced search
POST   /api/v1/search/advanced/         Filter search
POST   /api/v1/course/enrollment/       Enroll in course
GET    /api/v1/student/courses/         My courses
POST   /api/v1/quiz/submit/             Submit quiz
GET    /api/v1/certificate/eligibility/ Check cert eligibility
POST   /api/v1/certificate/generate/    Generate certificate
GET    /api/v1/analytics/trending-searches/  Trending
GET    /api/v1/analytics/dashboard/     Analytics view
GET    /api/v1/teacher/students/        View students
POST   /api/v1/qa/                      Ask question
GET    /api/v1/filters/options/         Get filter options
```

---

## 📂 Core Directories

```
backend/
├── api/
│   ├── models.py         (1797 lines - Core data models)
│   ├── views.py          (5619 lines - 80+ API views)
│   ├── serializer.py     (Validation & serialization)
│   ├── permissions.py    (RBAC - IsAdminUser, IsTeacherUser, etc.)
│   ├── urls.py           (Endpoint routing)
│   └── cache_utils.py    (SearchCacheManager)
├── userauths/            (User model, authentication)
└── backend/              (Django settings)

frontend/src/
├── views/
│   ├── auth/             (Register, Login, SSO)
│   ├── base/             (Public: Home, Search, CourseDetail)
│   ├── student/          (Dashboard, Courses, Wishlist, QA)
│   ├── instructor/       (Dashboard, Courses, Reviews)
│   └── admin/            (User/Course management)
├── components/
│   ├── SearchDashboard/  (Analytics charts)
│   ├── Analytics/        (Dashboard visualizations)
│   ├── CourseCard.jsx    (Course display)
│   └── skeletons/        (Loading placeholders)
└── utils/
    ├── apiInstance       (Axios wrapper)
    └── hooks/            (useAxios, UserData context)
```

---

## 👥 User Roles & Permissions

### Student Role
✅ Enroll in courses  
✅ Watch videos (progress tracking)  
✅ Take quizzes  
✅ Rate courses  
✅ Add to wishlist  
✅ Ask questions (Q&A)  
✅ Download certificates  
❌ Create courses  
❌ View analytics  

### Teacher/Instructor Role
✅ Create & publish courses  
✅ Upload videos & materials  
✅ Create quizzes & grading  
✅ View student performance  
✅ Answer Q&A questions  
✅ Export student lists  
✅ Course analytics  
❌ Manage users (except own)  
❌ System settings  

### Admin Role
✅ Manage all users  
✅ Moderate courses  
✅ View system analytics  
✅ Manage categories & settings  
✅ View reports  
✅ User role assignment  
❌ Content moderation (moderators do)  

### Super Admin
✅ Everything Admin can do  
✅ Toggle super_admin flag  
✅ System configuration  

---

## 🔍 Search Architecture

### 1. Basic Search
```python
GET /api/v1/course/search/?search=python
# Searches: title, description, teacher name
# Returns: Ranked results + metadata
```

### 2. Full-Text Search (PostgreSQL)
```python
GET /api/v1/course/full-text-search/?search="web development"
# Supports: quotes, boolean operators (& | !)
# Returns: Ranked by relevance + execution time
```

### 3. Advanced Search with Filters
```python
POST /api/v1/search/advanced/
{
  "query": "python",
  "category_id": 5,
  "level": "Beginner",
  "min_rating": 4.0,
  "teacher_id": 10
}
# Returns: Filtered results + filter counts
```

### 4. Search Analytics
```python
GET /api/v1/analytics/trending-searches/         # Top 10 searches
GET /api/v1/analytics/failed-searches/           # Zero results
GET /api/v1/analytics/search-volume/             # Search frequency
GET /api/v1/analytics/dashboard/                 # Full dashboard
```

### 5. Filter Options
```python
GET /api/v1/filters/options/                     # All available filters
GET /api/v1/filters/category/                    # Categories only
GET /api/v1/filters/level/                       # Levels only
GET /api/v1/filters/rating/                      # Rating ranges
GET /api/v1/filters/teacher/                     # Active teachers
```

---

## 🎓 Course Workflow

### Teacher: Create Course
```
1. POST /api/v1/course/                  (Create with title, description)
2. PUT /api/v1/course/{id}/              (Add modules, videos, pricing)
3. POST /api/v1/upload/                  (Upload videos & materials)
4. POST /api/v1/quiz/                    (Create quizzes)
5. POST /api/v1/course/publish/          (Publish to students)
```

### Student: Enroll & Learn
```
1. GET /api/v1/course/course-list/       (Browse courses)
2. GET /api/v1/course/{id}/              (View course details)
3. POST /api/v1/course/enrollment/       (Enroll)
4. GET /api/v1/student/courses/          (View enrolled)
5. PUT /api/v1/video-progress/           (Track video watching)
6. POST /api/v1/quiz/submit/             (Submit quiz)
7. POST /api/v1/course-completed/        (Mark complete)
8. GET /api/v1/certificate/eligibility/  (Check if eligible)
9. POST /api/v1/certificate/generate/    (Get certificate)
```

---

## 🎬 Model Key Fields

### Course
- `title`, `description`, `price`, `level` (Beginner/Intermediate/Advanced)
- `teacher` (ForeignKey), `category` (ForeignKey)
- `status` (Draft/Published), `rating`, `total_students`

### Student
- `user` (OneToOneField), `wishlist` (ManyToMany to Course)

### StudentCourseEnrollment
- `student`, `course`, `date_enrolled`, `is_completed`

### Quiz
- `course`, `title`, `passing_score`, `time_limit`

### Certificate
- `student`, `course`, `qr_code`, `date_issued`, `valid_until`

### SearchLog
- `query` (search text), `user`, `result_count`, `timestamp`

---

## 🚀 Frontend Routes (React Router v6)

```javascript
// Auth
/auth/register/
/auth/login/
/auth/sso-login/
/auth/forgot-password/
/auth/create-new-password/

// Public
/                                // Home
/course/:id/                     // Course detail
/search/?query=...               // Search results
/user-guide/                     // Help
/certificate/validate/           // Cert verification

// Student
/student/dashboard/              // Learning overview
/student/courses/                // Enrolled courses
/student/course/:id/             // Course content player
/student/wishlist/               // Saved courses
/student/qa/                     // Questions
/student/profile/                // Profile settings
/student/change-password/        // Password change

// Instructor
/instructor/dashboard/           // Teaching overview
/instructor/courses/             // Manage courses
/instructor/course/create/       // New course wizard
/instructor/review/              // Student reviews
/instructor/students/            // View students

// Admin
/admin/dashboard/                // System overview
/admin/users/                    // User management
/admin/courses/                  // Moderation
/admin/reports/                  // Analytics

// Utility
/404/                            // Not found
```

---

## 🔐 Authentication Flow

### JWT Login
```
1. POST /api/v1/auth/token/           (email, password)
   ↓ Response: {access_token, refresh_token}
2. Store access token in localStorage
3. Add "Authorization: Bearer {token}" to requests
4. When token expires: POST /api/v1/auth/token/refresh/
```

### SSO Login
```
1. GET /api/v1/sso/redirect/          (Redirect to provider)
2. User authenticates with provider
3. Provider redirects back with code
4. POST /api/v1/sso/verify/           (Verify token + NIP)
   ↓ Response: {access_token, user_data}
5. Create/update user profile
```

---

## 🗄️ Database

### Setup
```bash
# PostgreSQL (Docker)
docker-compose up -d lms_postgres

# Migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

### Key Tables
- `users` - User accounts (email, username, role)
- `profiles` - User profiles (avatar, bio, country)
- `courses` - Course listings
- `modules` - Course sections
- `enrollment` - Student enrollments
- `quizzes` - Quiz objects
- `certificates` - Issued certificates
- `searchlog` - Search history (for analytics)

---

## 📊 Important Files

| File | Purpose |
|------|---------|
| `backend/api/models.py` | All database models (1797 lines) |
| `backend/api/views.py` | 80+ API endpoints (5619 lines) |
| `backend/api/permissions.py` | RBAC permission classes |
| `frontend/src/App.jsx` | Routes & lazy loading |
| `frontend/src/utils/apiInstance.js` | Axios wrapper |
| `frontend/src/store/ProfileContext.jsx` | User state management |
| `docker-compose.yml` | Dev environment setup |
| `.env.example` | Configuration template |

---

## ⚙️ Quick Commands

```bash
# Backend
cd backend
python manage.py runserver                    # Start API
python manage.py migrate                      # Apply migrations
python manage.py createsuperuser              # Admin user
python manage.py test api                     # Run tests

# Frontend
cd frontend
npm install                                   # Install deps
npm run dev                                   # Dev server (localhost:5173)
npm run build                                 # Production build
npm run lint                                  # Check code quality

# Docker
docker-compose up -d                          # Start all services
docker-compose down                           # Stop all services
docker-compose logs -f django                 # View Django logs
```

---

## 🐛 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| 404 on search | Check PostgreSQL full-text index: `Course.search_vector` |
| Auth fails | Verify JWT token in localStorage + refresh token valid |
| Course not showing | Check course `status="Published"` |
| Video won't play | Verify file format (MP4/WebM) + storage configured |
| Certificate won't generate | Check passing score + video completion |
| Search slow | Clear Redis cache: `redis-cli FLUSHDB` |

---

## 📞 Useful Endpoints for Testing

```bash
# Health check
curl http://localhost:8000/api/v1/health/

# Public stats
curl http://localhost:8000/api/v1/course/public-stats/

# Categories
curl http://localhost:8000/api/v1/category/

# Course list
curl http://localhost:8000/api/v1/course/course-list/

# Search (with token)
curl -H "Authorization: Bearer {token}" \
  http://localhost:8000/api/v1/course/full-text-search/?search=python

# Filter options
curl http://localhost:8000/api/v1/filters/options/
```

---

## 🎯 Next Steps / Roadmap

- [ ] Real-time notifications (WebSocket)
- [ ] Live streaming/webinars
- [ ] Peer learning groups/study circles
- [ ] AI-powered course recommendations
- [ ] Gamification (badges, leaderboards)
- [ ] Mobile app (React Native)
- [ ] Marketplace for third-party courses
- [ ] API versioning strategy (v2)

---

**Quick Links**:
- Main Doc: `PROJECT_FEATURE_INVENTORY.md`
- API Ref: `backend/api/` (See docstrings)
- Frontend: `frontend/src/App.jsx`
- Deployment: `DEPLOY_TO_PRODUCTION.ps1` or `.sh`
