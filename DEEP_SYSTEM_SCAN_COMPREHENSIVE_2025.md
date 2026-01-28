# LMSetjen DPD RI - Comprehensive Deep System Scan (2025)

**Document Generated:** January 20, 2026  
**System Status:** Phase 4.41+ Production Ready  
**Last Updated:** Ongoing Development  

---

## 📋 Executive Summary

**LMSetjen DPD RI** is an enterprise-grade **Learning Management System (LMS)** designed specifically for Indonesian government employees. The system is built with Django REST Framework (backend) and React 18 (frontend), deployed via Docker Compose orchestrating PostgreSQL, Redis, and nginx.

### Core Mission
Provide a comprehensive online learning platform for:
- Course creation and management by instructors
- Student enrollment, learning progress tracking, and certification
- Administrative oversight and analytics
- Q&A discussions and community engagement
- Multi-role access control (Student, Instructor, Admin)

### Technology Stack
| Component | Technology | Version |
|-----------|-----------|---------|
| Backend | Django | 4.2 |
| API Framework | Django REST Framework | Latest |
| Frontend | React | 18 |
| Build Tool | Vite | Latest |
| Database | PostgreSQL | 15-alpine |
| Cache | Redis | 7-alpine |
| Web Server | nginx | Latest |
| Search | PostgreSQL Full-Text Search | Built-in |
| Auth | JWT (simplejwt) | Token-based |

---

## 🏗️ ARCHITECTURE OVERVIEW

### 1. Backend Architecture (Django)

```
backend/
├── manage.py                 # Django CLI
├── requirements.txt          # Python dependencies
├── Dockerfile               # Production container
├── backend/                 # Settings & URL routing
│   ├── settings.py          # Django configuration (547 lines)
│   ├── urls.py              # Main URL routing
│   └── wsgi.py              # WSGI app entry
├── userauths/               # User authentication & profiles
│   ├── models.py            # User, Profile, OrganizationUnit, Position (241 lines)
│   ├── serializers.py       # JWT token creation, registration
│   └── urls.py              # Auth endpoints
├── api/                     # Main application logic
│   ├── models.py            # Course, Teacher, Category, Student data (2210 lines)
│   ├── views.py             # API endpoints & business logic (6246 lines)
│   ├── serializers.py       # Request/response validation (1529 lines)
│   ├── permissions.py       # Role-based access control (175 lines)
│   ├── urls.py              # API route definitions
│   └── cache_utils.py       # Search caching layer
└── core/                    # App configuration
```

### 2. Frontend Architecture (React + Vite)

```
frontend/
├── src/
│   ├── App.jsx              # Main router (431 lines, lazy-loaded routes)
│   ├── main.jsx             # React DOM entry
│   ├── views/               # Page components by role
│   │   ├── auth/            # Register, Login, SSO, Password Reset
│   │   ├── base/            # Public pages (Index, Search, CourseDetail)
│   │   ├── student/         # Student dashboard, courses, QA, wishlist
│   │   ├── instructor/      # Teacher dashboard, course creation, grading
│   │   ├── admin/           # System admin pages
│   │   └── partials/        # Shared layout components
│   ├── components/          # Reusable UI components
│   │   ├── SearchResultsDisplay.jsx
│   │   ├── CourseCard.jsx
│   │   ├── ErrorBoundary.jsx
│   │   ├── Skeletons/       # Loading states
│   │   ├── Analytics/       # Dashboard charts
│   │   └── ThemeProvider.jsx
│   ├── layouts/             # Route wrappers
│   │   ├── PrivateRoute.jsx # Authentication check
│   │   ├── RoleRoute.jsx    # Role-based access
│   │   └── MainWrapper.jsx
│   ├── store/               # Global state management
│   │   ├── Context.jsx      # ProfileContext, WishlistContext
│   │   └── profile state
│   ├── utils/               # Helper functions
│   │   ├── axios.js         # HTTP client (useAxios)
│   │   ├── useAxios.js      # Axios hook with JWT refresh
│   │   ├── auth.js          # Token management
│   │   ├── constants.js     # API_BASE_URL, defaults
│   │   └── dayjs.js         # Date formatting (moment.js)
│   └── styles/              # Global CSS
│       ├── performance.css
│       ├── index.css
│       └── accessibility-fixes.css
└── vite.config.js           # Build optimization
```

### 3. Database Schema (PostgreSQL)

#### Core Models:

**User (userauths.User)** - Extended Django User
```python
Fields:
  - email (unique, primary)
  - full_name
  - role: ENUM['student', 'teacher', 'admin']
  - nip: Government employee ID (SSO)
  - external_id: External system user ID
  - golongan: Employee grade
  - kelas_jabatan: Position class
  - timezone: User timezone
  - refresh_token: JWT refresh token storage
  - last_sync_date: SSO sync timestamp
```

**Teacher (api.Teacher)** - Instructor profile
```python
Fields:
  - user: OneToOne(User)
  - full_name
  - image: URL field
  - bio, about: Text fields
  - social links: facebook, twitter, linkedin
  - country
Methods:
  - students(): Count unique enrolled students
  - courses(): Get instructor's courses
  - review(): Count courses taught
  - create_from_profile(): Factory from Profile
```

**Category (api.Category)** - Course categorization
```python
Fields:
  - title: Unique category name
  - image: URL field
  - slug: Unique URL slug
  - active: Boolean flag
Methods:
  - course_count(): Number of courses in category
```

**Course (api.Course)** - Core course model
```python
Fields:
  - category: FK(Category)
  - teacher: FK(Teacher)
  - title, description: Text fields
  - image, file: URL fields (no local storage)
  - level: ENUM['Beginner', 'Intermediate', 'Advanced']
  - platform_status: ENUM['Draft', 'Published', etc.]
  - teacher_course_status: ENUM
  - featured: Boolean
  - course_id: ShortUUID (6-char unique ID)
  - slug: Unique URL slug
  - date: Creation timestamp
  - search_vector: PostgreSQL SearchVectorField (PHASE 4+)
Indexes:
  - GinIndex on search_vector for full-text search
Methods:
  - completion percentage per student
  - related lessons, quizzes, reviews
Relations:
  - Many EnrolledCourse (students)
  - Many Lesson (curriculum)
  - Many Quiz (assessments)
  - Many Review (ratings)
  - Many QuestionAnswer (discussions)
```

**EnrolledCourse (api.EnrolledCourse)** - Student enrollment tracking
```python
Fields:
  - course: FK(Course)
  - user: FK(User)
  - teacher: FK(Teacher)
  - enrollment_id: ShortUUID (6-char unique)
  - date: Enrollment timestamp
Methods:
  - lectures(): Get course lessons
  - completed_lesson(): Count completed
  - curriculum(): Get course sections
  - note(): Get student notes
  - question_answer(): Get Q&A
  - review(): Get student rating
  - completion_percentage(): Calculate progress
  - is_course_completed(): Boolean check
  - quiz_results(): Get quiz data
  - are_all_quizzes_passed(): Boolean check
  - is_certificate_eligible(): Check cert requirements
  - get_or_create_certificate(): Certificate generation
```

**Lesson (api.Lesson)** - Course curriculum content
```python
Fields:
  - course: FK(Course)
  - course_module: FK(CourseModule)
  - title, description: Text
  - video_url: URL field
  - video_duration: Calculated from video
  - lesson_id: ShortUUID
  - number: Lesson ordering
  - active: Boolean
Methods:
  - completed students tracking
  - duration calculation
```

**Quiz (api.Quiz)** - Course assessments
```python
Fields:
  - course: FK(Course)
  - title, description: Text
  - quiz_id: ShortUUID
  - passing_score: Required percentage
  - date: Creation timestamp
Relations:
  - Many QuizQuestion
  - Many QuizResult
```

**SearchLog (api.SearchLog)** - PHASE 4 Analytics
```python
Fields:
  - user: FK(User)
  - query: Search string
  - results_count: Number found
  - course_id: Filtered course (if any)
  - date: Search timestamp
Methods:
  - trending_searches(): Most popular queries
  - failed_searches(): Zero-result queries
  - analytics aggregation
```

**Notification (api.Notification)** - User alerts
```python
Fields:
  - user: FK(User)
  - type: ENUM['New Order', 'Review', 'Question', etc.]
  - read: Boolean flag
  - date: Timestamp
```

**Certificate (api.Certificate)** - Student completion proof
```python
Fields:
  - enrollment: FK(EnrolledCourse)
  - code: Unique certificate code
  - date: Generation timestamp
  - validation_token: For external verification
  - signature: Teacher signature (optional)
```

---

## 🔑 AUTHENTICATION & AUTHORIZATION

### JWT Authentication Flow

#### 1. Normal Login
```
POST /api/v1/auth/token/
Request:
  {
    "email": "user@example.com",
    "password": "secure_password"
  }

Response:
  {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 42,
      "email": "user@example.com",
      "full_name": "User Name",
      "role": "student",
      "nip": "20000420202506100008",
      "teacher_id": 0,
      "is_super_admin": false
    }
  }

Tokens stored in:
  - Cookies (access_token, refresh_token)
  - LocalStorage (backup)
  - SessionStorage (current session)
```

#### 2. SSO (Single Sign-On) Integration
```
GET /api/v1/sso/login/<sso_token>/

Endpoint: /api/v1/sso/verify/
Method: POST
Request:
  {
    "sso_token": "external_jwt_token"
  }

Process:
  1. Verify external SSO token signature
  2. Extract user data (nip, email, full_name)
  3. Find or create User in LMS
  4. Generate LMS JWT tokens
  5. Redirect with LMS tokens

Response:
  {
    "access": "lms_jwt_token",
    "refresh": "lms_jwt_token",
    "user": { ... }
  }

SSO Fields Mapped:
  - nip → User.nip (Government employee ID)
  - email → User.email
  - full_name → User.full_name
  - role → User.role (from external system)
```

#### 3. Token Refresh
```
POST /api/v1/auth/token/refresh/
Request:
  {
    "refresh": "refresh_token_value"
  }

Response:
  {
    "access": "new_access_token"
  }

Frontend Auto-Refresh:
  - useAxios interceptor checks token expiration
  - Refreshes before sending request if needed
  - Stores new token automatically
```

### Role-Based Access Control (RBAC)

#### User Roles (Field: User.role)

**1. Student (`student`)**
- Can browse all published courses
- Can enroll in courses
- Can track learning progress
- Can submit quizzes
- Can ask Q&A questions
- Can rate courses
- Can create/download certificates
- Cannot create courses
- Cannot view other students' data

**2. Instructor/Teacher (`teacher` / `instructor`)**
- Can create and manage courses
- Can view enrolled students
- Can grade quizzes
- Can view student progress
- Can respond to Q&A
- Can see course analytics
- Cannot access admin panel (unless admin role)

**3. Admin (`admin`)**
- Can view system analytics
- Can manage users (create, disable, sync)
- Can manage categories
- Can view all courses
- Can view all enrollments
- Can generate system reports
- Full system access

**4. Super Admin (Flag: Admin.is_super_admin)**
- All admin permissions + system configuration
- Can manage platform settings
- Can perform data exports
- Can manage other admins

#### Permission Classes (backend/api/permissions.py)

```python
class IsAdminUser(permissions.BasePermission):
    """Only admin users"""
    - Checks: user.role == 'admin'
    - Usage: permission_classes = [IsAdminUser]

class IsTeacherUser(permissions.BasePermission):
    """Only teacher/instructor users"""
    - Checks: user.role in ['teacher', 'instructor']
    - Usage: permission_classes = [IsTeacherUser]

class IsStudentUser(permissions.BasePermission):
    """Only student users"""
    - Checks: user.role == 'student'
    - Usage: permission_classes = [IsStudentUser]

class IsOwnerOrAdmin(permissions.BasePermission):
    """Only object owner or admin"""
    - Checks: user is object owner OR user is admin
    - Usage: permission_classes = [IsOwnerOrAdmin]
```

#### Frontend Access Control

**PrivateRoute** - Authentication wrapper
```jsx
<PrivateRoute>
  <ComponentName />
</PrivateRoute>
// Redirects to /login/ if not authenticated
```

**RoleRoute** - Role-based wrapper
```jsx
<RoleRoute allowedRoles={["student", "teacher"]}>
  <ComponentName />
</RoleRoute>
// Shows 404 if user role not allowed
```

**Usage Pattern:**
```jsx
<Route
  path="/student/dashboard/"
  element={
    <PrivateRoute>
      <RoleRoute allowedRoles={["student"]}>
        <StudentDashboard />
      </RoleRoute>
    </PrivateRoute>
  }
/>
```

---

## 📡 API ENDPOINTS (Complete Reference)

### Authentication Endpoints

| Method | Endpoint | Purpose | Auth | Status |
|--------|----------|---------|------|--------|
| POST | `/api/v1/auth/token/` | Login with email/password | None | 201 |
| POST | `/api/v1/auth/token/refresh/` | Refresh JWT token | RefreshToken | 200 |
| POST | `/api/v1/auth/register/` | Register new user | None | 201 |
| POST | `/api/v1/auth/password-reset/` | Request password reset | None | 200 |
| POST | `/api/v1/auth/password-change/` | Change password | JWT | 200 |
| GET | `/api/v1/auth/profile/` | Get user profile | JWT | 200 |
| PUT | `/api/v1/auth/profile/` | Update user profile | JWT | 200 |
| POST | `/api/v1/sso/verify/` | Verify SSO token | None | 201 |
| GET | `/api/v1/sso/login/<sso_token>/` | SSO login redirect | None | Redirect |

### Course Management Endpoints

| Method | Endpoint | Purpose | Role | Auth |
|--------|----------|---------|------|------|
| GET | `/api/v1/course/course-list/` | List all courses | Public | None |
| POST | `/api/v1/course/` | Create new course | Teacher | JWT |
| GET | `/api/v1/course/<slug>/` | Get course details | Public | None |
| PUT | `/api/v1/course/<id>/` | Update course | Teacher | JWT |
| DELETE | `/api/v1/course/<id>/` | Delete course | Teacher | JWT |
| POST | `/api/v1/course/publish/` | Publish course | Teacher | JWT |
| GET | `/api/v1/course/category/` | List categories | Public | None |

### Search & Filter Endpoints (PHASE 4+)

| Method | Endpoint | Purpose | Features |
|--------|----------|---------|----------|
| GET | `/api/v1/course/search/?search=query` | Basic search | Ranked by title/desc |
| GET | `/api/v1/course/full-text-search/?search=query` | Full-text search | PostgreSQL FTS, websearch syntax |
| POST | `/api/v1/search/advanced/` | Advanced search | Filters: category, level, rating, teacher |
| GET | `/api/v1/filters/options/` | Get filter options | Categories, levels, teachers |
| GET | `/api/v1/course/trending-searches/` | Trending queries | PHASE 4.3+ |
| GET | `/api/v1/analytics/failed-searches/` | Zero-result queries | PHASE 4.3+ |

### Enrollment Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/v1/course/enroll/` | Enroll in course | JWT (student) |
| GET | `/api/v1/course/check-enrollment/<course_id>/<user_id>/` | Check enrollment status | None |
| GET | `/api/v1/student/courses/` | List student's courses | JWT (student) |
| GET | `/api/v1/student/course/<id>/` | Get student course details | JWT (student) |
| POST | `/api/v1/course/mark-complete/` | Mark course complete | JWT (student) |

### Quiz & Assessment Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/quiz/` | List quizzes | None |
| POST | `/api/v1/quiz/` | Create quiz | JWT (teacher) |
| GET | `/api/v1/quiz/<id>/` | Get quiz details | None |
| POST | `/api/v1/quiz/submit/` | Submit quiz answers | JWT (student) |
| GET | `/api/v1/quiz/results/` | Get quiz results | JWT |

### Certificate Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/certificate/eligibility/<user_id>/<course_id>/` | Check certificate eligibility | JWT |
| POST | `/api/v1/certificate/generate/` | Generate certificate | JWT (student) |
| GET | `/api/v1/certificate/validate/<code>/` | Validate certificate | None |
| GET | `/api/v1/certificate/<id>/` | Download certificate | JWT |

### Q&A Discussion Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/qa/<course_id>/` | List questions | None |
| POST | `/api/v1/qa/` | Create question | JWT (student) |
| GET | `/api/v1/qa/<qa_id>/` | Get question details | None |
| POST | `/api/v1/qa/<qa_id>/message/` | Reply to question | JWT |
| GET | `/api/v1/qa/<qa_id>/messages/` | Get all replies | None |

### Analytics Endpoints (Admin)

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| GET | `/api/v1/analytics/dashboard/` | Dashboard stats | Admin |
| GET | `/api/v1/analytics/enrollment/` | Enrollment trends | Admin |
| GET | `/api/v1/analytics/trending-searches/` | Popular searches | Admin |
| GET | `/api/v1/analytics/failed-searches/` | Zero-result queries | Admin |
| GET | `/api/v1/statistics/public-stats/` | Public platform stats | Public |

### File Upload Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/v1/file-upload/` | Upload file (course media) | JWT (teacher) |
| GET | `/api/v1/media/<file_id>/` | Download uploaded file | Based on permissions |

### Teacher/Instructor Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/teacher/students/` | List enrolled students | JWT (teacher) |
| GET | `/api/v1/teacher/courses/` | List teacher's courses | JWT (teacher) |
| GET | `/api/v1/teacher/dashboard/` | Teacher dashboard data | JWT (teacher) |
| GET | `/api/v1/teacher/analytics/` | Course analytics | JWT (teacher) |

### Admin Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/admin/users/` | List all users | JWT (admin) |
| POST | `/api/v1/admin/users/sync/` | Sync users from external system | JWT (admin) |
| GET | `/api/v1/admin/sync-status/` | Get sync progress | JWT (admin) |
| GET | `/api/v1/admin/courses/` | Manage all courses | JWT (admin) |
| GET | `/api/v1/admin/analytics/` | System analytics | JWT (admin) |

---

## 🔍 SEARCH & ANALYTICS ARCHITECTURE (PHASE 4+)

### Full-Text Search Implementation

#### PostgreSQL SearchVector
```python
# In Course model
search_vector = SearchVectorField(null=True, blank=True)

# Indexed with GIN (Generalized Inverted Index)
class Meta:
    indexes = [
        GinIndex(fields=['search_vector']),
    ]
```

#### Search Endpoints

**1. Basic Search**
```
GET /api/v1/course/search/?search=python

Response:
  {
    "count": 5,
    "results": [
      {
        "id": 1,
        "title": "Python Programming Basics",
        "description": "Learn Python...",
        "teacher": { ... },
        "rating": 4.5,
        "enrollment_count": 125
      }
    ]
  }
```

**2. Full-Text Search (PHASE 4)**
```
GET /api/v1/course/full-text-search/?search=python

Features:
  - PostgreSQL websearch syntax support
  - Boolean operators: AND, OR, NOT
  - Quote support: "exact phrase"
  - Advanced ranking with SearchRank
  - Cached results for performance

Example Queries:
  - "python web" = contains both words
  - "python | java" = python OR java
  - "python -advanced" = python NOT advanced
  - "programming language" = exact phrase
```

**3. Advanced Search**
```
POST /api/v1/search/advanced/

Request:
  {
    "search": "python",
    "category_id": 1,
    "level": "Beginner",
    "min_rating": 4,
    "teacher_id": 5,
    "sort": "-rating"
  }

Filters Applied:
  - Full-text search on title/description
  - Category filtering
  - Level (Beginner, Intermediate, Advanced)
  - Minimum rating threshold
  - Specific teacher
  - Custom sorting

Response: Paginated results with applied filters
```

### Cache Layer (cache_utils.py)

```python
SearchCacheManager:
  - cache_search_results: 300s TTL
  - Caches expensive FTS queries
  - Key: hash(search_query, filters)
  - Reduces database load

TrendingCacheManager:
  - cache_trending_searches: 600s TTL
  - Aggregates popular queries
  - Expires frequently
```

### Search Logging (analytics)

**SearchLog Model:**
```python
Fields:
  - user: FK(User)
  - query: Search string
  - results_count: Number found
  - course_id: Filtered course (if any)
  - date: Search timestamp

Methods:
  - trending_searches(): Top 20 queries by frequency
  - failed_searches(): Zero-result queries
  - analytics_by_category(): Search trends per category
```

**Trending Searches Endpoint:**
```
GET /api/v1/analytics/trending-searches/

Response:
  {
    "trending": [
      { "query": "python", "count": 342 },
      { "query": "web development", "count": 287 },
      { "query": "django", "count": 165 }
    ],
    "failed": [
      { "query": "nonexistent course", "count": 12 },
      { "query": "typo query", "count": 8 }
    ]
  }
```

### Analytics Dashboard (Admin)

**Endpoint:** `GET /api/v1/analytics/dashboard/`

**Data Includes:**
- Total users, courses, enrollments
- Active learners (last 7/30 days)
- Course completion rate
- Average rating per course
- Revenue metrics (if applicable)
- Search trends
- Platform health metrics

---

## 🎨 FRONTEND ARCHITECTURE

### Route Structure (App.jsx)

**Lazy Loading Strategy:**
- All route components lazy-loaded for optimal performance
- Suspense fallback with centered spinner
- Chunk code splitting by route

**Route Categories:**

#### 1. Auth Routes (Public)
```jsx
/register/                    Register new account
/login/                       Login with email/password
/sso/:sso_token/             SSO login from external system
/forgot-password/            Forgot password form
/create-new-password/        Reset password link
```

#### 2. Base Routes (Public/Shared)
```jsx
/                            Home page / course listing
/course-detail/:slug/        Course detail view
/search/                     Search results page
/user-guide/                 Help/documentation
/certificate/validate/:token/ Certificate validation
```

#### 3. Student Routes (Private, role: student)
```jsx
/student/dashboard/          Dashboard with enrolled courses
/student/courses/            My courses list
/student/courses/:id/        Course learning interface
/student/wishlist/           Saved for later courses
/student/qa/                 Q&A forum
/student/profile/            User profile / settings
/student/change-password/    Password change
```

#### 4. Instructor Routes (Private, role: teacher/instructor)
```jsx
/instructor/dashboard/       Teacher dashboard
/instructor/courses/         My created courses
/instructor/courses/create/  Create new course
/instructor/courses/:id/edit/ Edit course
/instructor/courses/:id/curriculum/ Manage curriculum
/instructor/courses/:id/quiz/ Manage quizzes
/instructor/students/        View enrolled students
/instructor/review/          Student reviews
/instructor/qa/              Q&A management
/instructor/profile/         Teacher profile
```

#### 5. Admin Routes (Private, role: admin)
```jsx
/admin/dashboard/            System admin dashboard
/admin/users/                Manage all users
/admin/courses/              Manage all courses
/admin/material/             Content management
/admin/documentation/        System documentation
```

### Component Structure

#### View Components (views/ directory)

**By Role:**
- `views/auth/` - Authentication pages
- `views/base/` - Public pages
- `views/student/` - Student pages (Dashboard, Courses, QA, Wishlist, etc.)
- `views/instructor/` - Teacher pages
- `views/admin/` - Admin pages

**Key Student Views:**
- Dashboard.jsx - Overview of enrolled courses
- Courses.jsx - List of enrolled courses
- CourseDetail.jsx - Learning interface (video player, lessons)
- QA.jsx - Q&A discussions
- Wishlist.jsx - Saved courses
- Profile.jsx - User profile settings

**Key Instructor Views:**
- Dashboard.jsx - Teaching overview
- Courses.jsx - Course management
- CourseCreate.jsx - Create new course with rich editor
- CourseEdit.jsx - Edit course details
- CourseEditCurriculum.jsx - Manage lessons/modules
- CourseQuiz.jsx - Quiz management
- Students.jsx - Manage enrolled students

**Key Admin Views:**
- DashboardAdmin.jsx - System analytics
- UsersAdmin.jsx - User management with pagination
- KelolaMaterialAdmin.jsx - Content management
- SystemDocumentation.jsx - System documentation

#### Reusable Components (components/ directory)

**Common UI Components:**
- SearchResultsDisplay.jsx - Display search results
- CourseCard.jsx - Course preview card
- ErrorBoundary.jsx - Error handling wrapper
- ThemeProvider.jsx - Theme configuration
- Skeletons/ - Loading state skeletons
  - SkeletonPage.jsx
  - SkeletonStatCard.jsx
  - etc.

**Feature Components:**
- Analytics/ - Dashboard charts and graphs
- CourseQuiz/ - Quiz interface
- StudentCourseLecture/ - Video player + transcript
- Sidebar/ - Navigation sidebar

#### Layout Components (layouts/ directory)

**PrivateRoute.jsx**
```jsx
// Wrapper requiring authentication
// Redirects to /login/ if no JWT token
<PrivateRoute>
  <ProtectedComponent />
</PrivateRoute>
```

**RoleRoute.jsx**
```jsx
// Wrapper checking user role
// Shows 404 if role not allowed
<RoleRoute allowedRoles={["student", "teacher"]}>
  <RoleSpecificComponent />
</RoleRoute>
```

**MainWrapper.jsx**
- Wraps all pages with Header + Sidebar + Footer

### State Management

#### ProfileContext
```javascript
useContext(ProfileContext)

Provides:
  - profile: Current user profile object
  - setProfile: Update profile
  - Updates on user data changes
```

#### WishlistContext
```javascript
useContext(WishlistContext)

Provides:
  - wishlist: Array of wishlist items
  - addToWishlist: Add course
  - removeFromWishlist: Remove course
  - refetchWishlist: Refresh from API
```

### Custom Hooks

**useAxios Hook**
```javascript
// Authenticated HTTP client
const response = await useAxios.get('/api/v1/course/course-list/');
const response = await useAxios.post('/api/v1/course/enroll/', data);

Features:
  - JWT token auto-inclusion
  - Auto token refresh on expiration
  - Error handling
  - Request/response interceptors
  - FormData support
```

**UserData Hook**
```javascript
const userData = UserData();

Returns:
  {
    user_id: number,
    email: string,
    full_name: string,
    role: 'student' | 'teacher' | 'admin',
    nip: string (for SSO),
    teacher_id: number,
    is_super_admin: boolean
  }
```

**useEnrollment Hook**
```javascript
const { isEnrolled, enrollmentId, handleEnrollment } = useEnrollment(courseId, userId);

Manages:
  - Enrollment status checking
  - Course enrollment process
  - Navigation after enrollment
```

**useComingSoon Hook**
```javascript
const handleClick = useComingSoon('Feature Name');

Shows modal for not-yet-implemented features
```

### Styling Approach

**Bootstrap 5 Integration**
- Global utilities: d-flex, gap, align-items-*, etc.
- Responsive breakpoints: col-lg-*, col-md-*, col-12
- Built-in grid system

**Custom CSS**
- Per-page CSS files (QA.css, CourseDetail.css, etc.)
- Global styles in /styles/
- CSS variables for theming
- Flexbox layouts with proper constraints

**Performance Optimization CSS**
- performance.css: Instructor sidebar optimizations
- accessibility-fixes.css: A11y improvements
- input-hover-fix.css: Input state fixes

### Performance Features

**Code Splitting:**
- Vite chunk splitting for vendors
- Lazy-loaded route components
- Suspense boundaries with fallbacks

**Memoization:**
```jsx
// Components wrapped with React.memo to prevent re-renders
export default React.memo(ComponentName);
```

**Skeleton Loaders:**
- Visual loading indicators instead of "loading..." text
- Better perceived performance
- SkeletonPage, SkeletonStatCard, etc.

---

## 📊 DATABASE & STORAGE

### PostgreSQL Database

**Connection:**
```
Host: postgres (Docker container name)
Port: 5432
Database: django_lms_db
User: lms_user
Auth: Password
```

**Features Used:**
- Full-Text Search (SearchVectorField, SearchVector, GinIndex)
- Relationships (ForeignKey, OneToOne, ManyToMany)
- Indexes for common queries
- Signals for auto-updates

**Backup & Restore:**
```bash
# Backup
pg_dump -U lms_user django_lms_db > backup.sql

# Restore
psql -U lms_user django_lms_db < backup.sql
```

### Redis Cache

**Connection:**
```
Host: redis (Docker container name)
Port: 6379
Auth: Password (REDIS_PASSWORD env var)
DB: 0 (default)
```

**Usage:**
- Search result caching (300s)
- Trending searches aggregation (600s)
- Session caching
- API rate limiting

**Cache Patterns:**
```python
@cache_search_results(timeout=300)
def search_endpoint(query):
    # Results cached for 5 minutes
    pass

@cache_suggestions(timeout=600)
def trending_endpoint():
    # Trending data cached for 10 minutes
    pass
```

### Media Storage

**File Handling:**
- Course images: URLField (external storage)
- Course videos: URLField (external storage)
- No local file uploads (uses external storage provider)
- Media files served via nginx or CDN

**Media URL Construction:**
```javascript
// frontend/src/utils/constants.js
getMediaUrl(path) {
  if (path?.startsWith('http')) return path;  // Already full URL
  return `${API_BASE_URL}/media/${path}`;     // Construct media URL
}
```

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### Docker Compose Stack

```yaml
Services:
  postgres:15-alpine
    - PostgreSQL database
    - Port: 5432
    - Volume: postgres_data
    - Health check: pg_isready

  redis:7-alpine
    - Redis cache
    - Port: 6379
    - Volume: redis_data
    - Auth: REDIS_PASSWORD

  backend (Django):
    - Port: 8000
    - Environment: DB, Redis, Django settings
    - Depends on: postgres, redis
    - Restart: unless-stopped

  frontend (React):
    - Port: 3000
    - Vite dev server or static files
    - Environment: API_BASE_URL

  nginx:
    - Port: 80, 443
    - Static file serving
    - API routing to Django
    - SSL/TLS termination
```

### Environment Variables (.env)

```bash
# Database
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=secure_password
DB_HOST=postgres
DB_PORT=5432

# Redis
REDIS_PASSWORD=redis_password
REDIS_URL=redis://:redis_password@redis:6379/0

# Django
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Frontend
FRONTEND_SITE_URL=https://your-domain.com
BACKEND_SITE_URL=https://your-domain.com

# Email (SendGrid)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@your-domain.com

# AWS S3 (if using)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_STORAGE_BUCKET_NAME=...

# SSO Integration
SSO_SECRET_KEY=your-sso-secret
SSO_PUBLIC_KEY=your-sso-public-key
```

### Production Deployment Scripts

**Main Script:** `DEPLOY_TO_PRODUCTION.ps1` (PowerShell)
- Builds Docker images
- Pushes to registry
- Deploys to production server
- Runs migrations
- Restarts containers

**Staging Scripts:**
- `DEPLOY_STAGING.sh` - Deploy to staging environment
- `deploy-production.sh` - Alternative production deployment
- `deploy-search-update.ps1` - Search feature updates

### Nginx Configuration

**Key Features:**
- Static file serving for React app
- API proxy to Django (http://backend:8000)
- SSL/TLS termination
- Gzip compression
- Cache headers optimization

---

## 🔄 DATA FLOW & WORKFLOWS

### 1. Course Creation Workflow (Instructor)

```
Frontend:
  1. Instructor clicks "Create Course"
  2. Fill form: title, description, category, level
  3. Upload course image (image URL)
  4. Submit

Backend:
  1. POST /api/v1/course/
  2. Validate with CourseEditSerializer
  3. Create Course object
  4. Set platform_status='Draft'
  5. Return course_id, slug

Frontend:
  6. Navigate to course edit
  7. Add curriculum (modules, lessons)
  8. Upload video URLs
  9. Create quizzes
  10. Add course materials

Backend:
  11. POST /api/v1/course/lesson/
  12. POST /api/v1/course/quiz/
  13. Update curriculum structure

Frontend:
  14. Publish course
  15. POST /api/v1/course/publish/

Backend:
  16. Validate course has curriculum
  17. Set platform_status='Published'
  18. Create search_vector for FTS
  19. Trigger notification to admins
```

### 2. Student Enrollment Workflow

```
Frontend (Public Pages):
  1. Student browses courses
  2. Clicks "Enroll" button
  3. Redirects to login if not authenticated

Backend:
  4. Check user authentication (JWT)
  5. Check if already enrolled
  6. POST /api/v1/course/enroll/
  7. Create EnrolledCourse record
  8. Create Notification for student
  9. Return enrollment_id

Frontend:
  10. Show success toast
  11. Redirect to /student/courses/{enrollment_id}/
  12. Load course learning interface
  
Backend (Learning):
  13. GET /api/v1/student/course/{id}/ - Course details + progress
  14. Student watches video
  15. PUT /api/v1/video-progress/ - Track watch progress
  16. Student completes lesson
  17. POST /api/v1/course/mark-lesson-complete/
  18. Student takes quiz
  19. POST /api/v1/quiz/submit/ - Submit answers
  20. Calculate score, update QuizResult
  21. Student completes course
  22. POST /api/v1/course/mark-complete/
  23. Set is_course_completed=True
  24. Check certificate eligibility
```

### 3. Certificate Generation Workflow

```
Frontend:
  1. Student completes course
  2. Clicks "Get Certificate"
  3. Check eligibility
  4. GET /api/v1/certificate/eligibility/{user_id}/{course_id}/

Backend:
  5. Get enrollment
  6. Check all lessons completed
  7. Check all quizzes passed
  8. If eligible:
  9.   - POST /api/v1/certificate/generate/
  10.  - Create Certificate object
  11.  - Generate PDF with student info
  12.  - Create unique validation_token
  13.  - Return certificate_id + download_url

Frontend:
  14. Show download button
  15. User downloads PDF certificate

Validation:
  16. Certificate holder shares link
  17. GET /api/v1/certificate/validate/{token}/
  18. Backend verifies certificate
  19. Shows certificate details (student, course, date, instructor)
```

### 4. Search & Discovery Workflow

```
Frontend:
  1. User enters search query
  2. Debounce 300ms
  3. POST /api/v1/search/advanced/
  
Backend:
  4. Log search in SearchLog model
  5. Run full-text search on Course.search_vector
  6. Apply filters if provided:
     - category_id
     - level
     - min_rating
     - teacher_id
  7. Rank results using SearchRank
  8. Check cache (SearchCacheManager)
  9. If cache miss: query database
  10. Cache results for 5 minutes
  11. Return paginated results

Frontend:
  12. Display search results
  13. Show filters on sidebar
  14. Allow sorting (relevance, rating, newest)
  15. User clicks result → Course detail page

Analytics:
  16. Background job aggregates searches
  17. TrendingCacheManager generates trending list
  18. Admin views trending searches
```

### 5. Q&A Discussion Workflow

```
Frontend (Student):
  1. Student views course Q&A tab
  2. GET /api/v1/qa/{course_id}/
  3. Display list of questions
  4. Student clicks "Ask Question"
  5. Modal opens with form
  6. Fill title + description
  7. POST /api/v1/qa/create/

Backend:
  8. Create QuestionAnswer object
  9. Set user=student, course=course
  10. Create notification for teacher
  11. Return qa_id

Frontend:
  12. Refresh Q&A list
  13. New question appears
  14. Student/others click question
  15. View conversation modal
  16. GET /api/v1/qa/{qa_id}/messages/

Backend:
  17. Get all messages for this question
  18. Return with pagination

Frontend:
  19. Display message thread
  20. Instructor/student types reply
  21. POST /api/v1/qa/{qa_id}/message/
  22. Body: message content, user_id

Backend:
  23. Create QAMessage object
  24. Notify question asker if reply from instructor
  25. Return message

Frontend:
  26. Add message to thread
  27. Auto-scroll to new message
  28. Update reply count
```

---

## 🔐 SECURITY FEATURES

### JWT Token Security

**Token Generation:**
- Access token: 15-minute expiration
- Refresh token: 7-day expiration
- Stored securely in httpOnly cookies (not accessible by JavaScript)

**Token Refresh:**
- useAxios interceptor auto-refreshes before expiration
- Prevents token expiration during active sessions
- Smooth UX with no interruption

**Token Claims:**
```python
{
  "user_id": 42,
  "email": "user@example.com",
  "full_name": "User Name",
  "role": "student",
  "nip": "20000420202506100008",
  "teacher_id": 0,
  "is_super_admin": false,
  "exp": 1234567890,  # Expiration timestamp
  "iat": 1234567890   # Issued at timestamp
}
```

### CSRF Protection

**Backend Configuration:**
- CSRF middleware enabled for session-based auth
- CSRF tokens required for state-changing operations
- JWT auth endpoints marked with `@csrf_exempt` (safe due to token-based auth)

**Frontend Implementation:**
- useAxios handles CSRF tokens automatically
- Axios includes CSRF token in headers for session-based requests

### Role-Based Access Control (RBAC)

**Permission Enforcement:**
- All endpoints check user role
- Permission classes validate before processing
- 403 Forbidden returned for unauthorized access

**Example Enforcement:**
```python
@method_decorator(csrf_exempt, name='dispatch')
class StudentWishListListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [AllowAny]  # Auth optional for listing
    
    def create(self, request, *args, **kwargs):
        # Only allow students to add to wishlist
        if request.user.role != 'student':
            return Response({"error": "Only students can add to wishlist"}, 
                          status=status.HTTP_403_FORBIDDEN)
        # Process wishlist addition
```

### Data Validation

**Serializer Validation:**
```python
# All input data validated through DRF serializers
class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ['title', 'description', 'category', 'level']
    
    def validate_title(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Title too short")
        return value
```

### SSO Integration Security

**Token Verification:**
- SSO tokens verified using configured public key
- Signature validation prevents token forgery
- Expiration check prevents replay attacks
- NIP extraction prevents impersonation

```python
def verify_sso_token(sso_token):
    try:
        payload = jwt.decode(
            sso_token, 
            settings.SSO_PUBLIC_KEY,
            algorithms=['HS256']  # Use appropriate algorithm
        )
        # Validate payload contains required fields
        nip = payload['nip']
        email = payload['email']
        return payload
    except jwt.ExpiredSignatureError:
        raise ValidationError("SSO token expired")
    except jwt.InvalidSignatureError:
        raise ValidationError("Invalid SSO signature")
```

---

## 📈 PERFORMANCE OPTIMIZATION (PHASE 4.9+)

### Frontend Optimization

**Code Splitting:**
- Vite chunk splitting with vendor optimization
- Route-level code splitting with lazy loading
- ~50-60KB gzipped initial bundle

**Image Optimization:**
- URL-based image storage (external CDN/S3)
- Lazy loading images below fold
- Responsive image sizes

**Component Optimization:**
- React.memo() memoization for pure components
- useCallback for event handlers
- Suspense boundaries for async components

### Backend Optimization

**Database Optimization:**
- GinIndex on search_vector for fast FTS
- Proper indexes on frequently queried fields
- Query optimization with select_related/prefetch_related

**Caching:**
- Redis caching for search results (300s TTL)
- Trending searches cache (600s TTL)
- HTTP caching headers on static content

**API Optimization:**
- Pagination (default 20 items per page)
- Disable pagination for search endpoints
- Response compression with GZipMiddleware

### Search Performance

**Full-Text Search Index:**
```python
# Automatic search_vector updates via signals
@receiver(post_save, sender=Course)
def update_course_search_vector(sender, instance, created, **kwargs):
    # Update search_vector with title + description
    # GinIndex enables fast queries
```

**Query Optimization:**
```python
# Optimized search query
courses = Course.objects.annotate(
    search=SearchVector('title', weight='A') + 
           SearchVector('description', weight='B')
).filter(
    search=SearchQuery(query_text, search_type='websearch')
).annotate(
    rank=SearchRank(F('search'), SearchQuery(query_text))
).order_by('-rank')[:20]
```

---

## 🐛 ERROR HANDLING & DEBUGGING

### Frontend Error Handling

**Error Boundaries:**
```jsx
<ErrorBoundary>
  <ComponentWithPotentialError />
</ErrorBoundary>
// Catches and displays error UI
```

**API Error Handling:**
```javascript
try {
  const response = await useAxios.post('/api/v1/course/enroll/', data);
  // Success handling
} catch (error) {
  Toast().fire({
    icon: 'error',
    title: error.response?.data?.error || 'Failed to enroll'
  });
}
```

### Backend Error Logging

**Log Files:**
- `/backend/logs/django.log` - Application logs
- `/backend/logs/django_error.log` - Error logs
- `/backend/logs/access.log` - Nginx access logs

**Error Response Format:**
```python
{
  "error": "Descriptive error message",
  "detail": "Additional context",
  "field_errors": {  # For validation errors
    "title": ["This field is required"]
  }
}
```

### Debugging Tools

**Django Admin:**
- Jazzmin admin interface (enhanced Django admin)
- Browse all data models
- Manual data management
- Query execution

**Performance Monitoring:**
- `performance-test-*.json` - Backend performance metrics
- `integration_test_report.json` - Integration test results
- Query count/timing analysis

---

## 📝 KEY FILES INVENTORY

### Backend Core Files

| File | Size | Purpose |
|------|------|---------|
| `backend/api/models.py` | 2210 lines | Database models (Course, Teacher, Student, etc.) |
| `backend/api/views.py` | 6246 lines | API endpoints & business logic |
| `backend/api/serializers.py` | 1529 lines | Request/response validation |
| `backend/backend/settings.py` | 547 lines | Django configuration |
| `backend/api/permissions.py` | 175 lines | Role-based access control |
| `backend/userauths/models.py` | 241 lines | User model & authentication |

### Frontend Core Files

| File | Size | Purpose |
|------|------|---------|
| `frontend/src/App.jsx` | 431 lines | Main router & lazy-loaded routes |
| `frontend/src/views/student/QA.jsx` | 900+ lines | Q&A page with modals |
| `frontend/src/views/student/CourseDetail.jsx` | 1000+ lines | Learning interface |
| `frontend/src/views/instructor/CourseCreate.jsx` | 1200+ lines | Course creation with rich editor |
| `frontend/src/utils/useAxios.js` | 50 lines | HTTP client hook |
| `frontend/src/utils/auth.js` | 80 lines | Token management |

### Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration |
| `backend/Dockerfile` | Django container image |
| `.env` | Environment variables |
| `nginx-fixed.conf` | Web server configuration |
| `backend/requirements.txt` | Python dependencies |
| `frontend/package.json` | Node dependencies |
| `frontend/vite.config.js` | Build configuration |

---

## 🔄 DEVELOPMENT WORKFLOW

### Local Development Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev  # Vite dev server on :5173
```

**URLs:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Django Admin: http://localhost:8000/admin

### Testing

**Backend Tests:**
- Integration tests in `/backend/test_*.py`
- Regression test reports in `regression_test_report.json`
- Run: `python manage.py test`

**Frontend Testing:**
- ESLint for code quality
- Manual testing (no Jest currently)

### Database Migrations

```bash
# Generate migration
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Load sample data
python manage.py loaddata fixtures/sample_data.json
```

### Building for Production

```bash
# Frontend build
npm run build  # Creates dist/ folder

# Backend production checks
python manage.py check --deploy

# Create Docker image
docker-compose build

# Deploy
docker-compose up -d
```

---

## 🎯 CURRENT DEVELOPMENT STATUS

### Completed Features (Phase 4.41+)

✅ **Core LMS:**
- User authentication (JWT + SSO)
- Role-based access control
- Course creation & management
- Student enrollment & progress tracking
- Lesson curriculum management
- Quiz/assessment system
- Certificate generation
- Course ratings & reviews

✅ **Search & Analytics (Phase 4+):**
- Full-text search on PostgreSQL
- Advanced search with filters
- Search result caching
- Trending searches analytics
- Failed searches monitoring
- Admin analytics dashboard

✅ **Community Features:**
- Q&A discussion forum
- Question-answer threading
- Course ratings
- Student reviews
- Wishlist functionality

✅ **UI/UX (Phase 4.40+):**
- Responsive design for mobile
- Skeleton loading screens
- Error boundaries
- Toast notifications
- Modal dialogs for actions
- Smooth animations

✅ **Deployment:**
- Docker Compose orchestration
- PostgreSQL + Redis setup
- nginx web server configuration
- Production scripts
- SSL/TLS ready

### In Development / Planned

🔄 **Performance Enhancements:**
- Advanced caching strategies
- CDN integration for media
- Database query optimization

🔄 **Features in Development:**
- Live instructor support
- Student progress notifications
- Batch operations for admin
- Advanced reporting

---

## 📞 SUPPORT & MAINTENANCE

### Common Issues & Solutions

**Issue: Courses not appearing in search**
- Solution: Verify search_vector is updated (check signals)
- Check: `Course.objects.filter(search_vector__isnull=True)`
- Fix: Reindex: `python manage.py search_reindex`

**Issue: JWT token expiration**
- Solution: useAxios auto-refreshes, clear cookies if stuck
- Logout then login again
- Check token expiration time in browser cookies

**Issue: 404 on media files**
- Solution: Check media URL configuration
- Verify external storage is accessible
- Check nginx static file paths

**Issue: Slow search queries**
- Solution: Verify GinIndex exists on search_vector
- Check cache is working (Redis connection)
- Monitor query performance: `/backend/performance-test-*.json`

### Maintenance Tasks

**Weekly:**
- Monitor error logs
- Check disk usage on servers
- Verify backups completed

**Monthly:**
- Clean up old cache entries
- Review search trends
- Update dependencies

**Quarterly:**
- Performance testing
- Database optimization
- Security audit

---

## 📚 DOCUMENTATION & REFERENCES

**Documentation Files:**
- `README.md` - Project overview
- `CONTRIBUTING.md` - Development guidelines
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `PROJECT_FEATURE_INVENTORY.md` - Complete feature list
- `QUICK_REFERENCE_CARD.md` - API quick reference

**Phase Reports:**
- `PHASE_4_*.md` - Feature implementation reports
- `FINAL_IMPLEMENTATION_SUMMARY.md` - Overall status
- `SESSION_COMPLETION_REPORT_*.md` - Session summaries

---

## ✨ KEY TAKEAWAYS

### Architecture Highlights

1. **Scalable Backend:**
   - RESTful API with ~80+ endpoints
   - PostgreSQL with full-text search
   - Redis caching layer
   - JWT token authentication
   - Role-based access control

2. **Modern Frontend:**
   - React 18 with lazy loading
   - Vite for fast builds
   - Responsive Bootstrap 5 design
   - Global state with Context API
   - Custom hooks for logic reuse

3. **Production Ready:**
   - Docker Compose orchestration
   - nginx web server
   - SSL/TLS support
   - Automated deployment scripts
   - Comprehensive logging

4. **Feature Rich:**
   - Complete LMS functionality
   - Advanced search with analytics
   - Community Q&A
   - Certificate generation
   - Multi-role system

5. **Performance Optimized (Phase 4.9+):**
   - Code splitting & lazy loading
   - Redis caching
   - Database indexing
   - Response compression
   - Image optimization

### Next Steps for Development

1. **Quick Wins:**
   - Add more analytics visualizations
   - Implement live chat support
   - Add batch operations for admin

2. **Medium Term:**
   - Mobile app (React Native/Flutter)
   - Advanced reporting tools
   - Gamification features

3. **Long Term:**
   - AI-powered course recommendations
   - Virtual classroom integration
   - Marketplace for course materials

---

**End of Comprehensive Deep System Scan**  
**Generated:** January 20, 2026  
**System Version:** Phase 4.41+  
**Status:** Production Ready ✅
