# LMSetjen DPD RI - Complete Project Feature Inventory

**Last Generated**: November 2025  
**Project Type**: Full-Stack LMS (Django REST Framework + React 18)  
**Status**: Phase 4.9+ (Production-Ready with Advanced Features)

---

## 📊 Executive Summary

### Core Statistics
- **Backend API Views**: 80+ viewsets/API endpoints
- **Frontend Routes**: 30+ lazy-loaded pages
- **Database Models**: 40+ data models
- **React Components**: 50+ reusable components
- **Authentication Methods**: JWT + SSO integration
- **Search Capabilities**: Full-text search, basic search, advanced search
- **Role-Based System**: 4 user roles (student, teacher/instructor, admin, super_admin)

---

## 🎯 Feature Categories

### 1. AUTHENTICATION & USER MANAGEMENT

#### Authentication Methods
- ✅ **JWT Token-Based Auth**: `MyTokenObtainPairView` - Standard JWT with refresh tokens
- ✅ **SSO Integration**: `SSOTokenVerifyAPIView` (POST `/api/v1/sso/verify/`) - Government SSO with NIP field
- ✅ **SSO Login Redirect**: `SSOLoginRedirectAPIView` - Redirect flow for SSO providers
- ✅ **Manual Registration**: `RegisterView` (POST `/api/v1/auth/register/`)
- ✅ **Social Login Support**: Configured in settings (Google, Microsoft, etc.)

#### User Profile Management
- ✅ **Profile Retrieval/Update**: `ProfileAPIView` (GET/PUT `/api/v1/auth/profile/`)
- ✅ **Profile Picture Management**: Crop modal with file upload
- ✅ **Country/Region Selection**: Dynamic country selector component
- ✅ **Teacher Profile Conversion**: `TeacherCreateFromProfileAPIView` - Convert student to teacher
- ✅ **Teacher Profile CRUD**: `TeacherProfileAPIView`, `TeacherProfileUpdateAPIView`

#### Password Management
- ✅ **Password Reset via Email**: `PasswordResetEmailVerifyAPIView`
- ✅ **Password Change**: `PasswordChangeAPIView` - Self-service password change
- ✅ **Change Password (Authenticated)**: `ChangePasswordAPIView` - For logged-in users
- ✅ **Email Verification**: One-time tokens for password reset

#### Permission System (RBAC)
| Role | Capabilities | API Class |
|------|-------------|-----------|
| **student** | Enroll, rate, Q&A, certificates, wishlist | `IsStudentUser` |
| **teacher/instructor** | Create/edit courses, grade students, analytics | `IsTeacherUser` |
| **admin** | User management, system settings, reports | `IsAdminUser` |
| **super_admin** | Admin feature flag toggle | Admin model |

---

### 2. COURSE MANAGEMENT

#### Course Discovery & Browsing
- ✅ **Course List**: `CourseListAPIView` (GET `/api/v1/course/course-list/`) - Public course listing
- ✅ **Course Detail**: `CourseDetailAPIView` - Full course information with modules
- ✅ **Category Listing**: `CategoryListAPIView` - All course categories
- ✅ **Course Filtering**: Multiple filter options for discovery
- ✅ **Public Statistics**: `PublicStatsAPIView` - Course counts, user stats

#### Course Creation & Management (Teachers)
- ✅ **Create Course**: `CourseCreateAPIView` - New course creation with variants
- ✅ **Update Course**: `CourseUpdateAPIView` - Edit course details, pricing, visibility
- ✅ **Publish Course**: `CoursePublishAPIView` - Publish to students (status transition)
- ✅ **Delete Course**: `CourseDetailAPIView` (DELETE) - Course removal
- ✅ **Course Variants**: Create multiple pricing/content tiers (`CourseVariantDeleteAPIView`)
- ✅ **Course Modules**: Add content modules with materials and videos
- ✅ **Draft Courses**: Save progress without publishing

#### Student Course Interaction
- ✅ **Enroll in Course**: `CourseEnrollmentAPIView` (POST `/api/v1/course/enrollment/`)
- ✅ **Check Enrollment Status**: `CheckEnrollmentStatusAPIView` - Verify access
- ✅ **Student Courses List**: `StudentCourseListAPIView` - All enrolled courses
- ✅ **Student Course Details**: `StudentCourseDetailAPIView` - Detailed view with progress
- ✅ **Mark Course Complete**: `StudentCourseCompletedCreateAPIView` - Course completion
- ✅ **Course Rating**: `StudentRateCourseCreateAPIView`, `StudentRateCourseUpdateAPIView`
- ✅ **Wishlist Management**: `StudentWishListListCreateAPIView` - Save for later
- ✅ **Course Analytics**: Student progress tracking per course

---

### 3. VIDEO & LEARNING CONTENT

#### Video Management
- ✅ **Upload Videos**: `FileUploadAPIView` - Direct video uploads
- ✅ **Video Streaming**: Integration with CDN/storage (AWS S3, etc.)
- ✅ **Multiple Formats**: Support for MP4, WebM, etc.
- ✅ **Thumbnail Generation**: Auto-generated from uploaded videos

#### Video Progress Tracking
- ✅ **Track Video Progress**: `VideoProgressAPIView` (POST) - Save playback position
- ✅ **Update Progress**: `VideoProgressDetailAPIView` (PUT) - Resume from last position
- ✅ **Delete Progress**: `VideoProgressDeleteAPIView` - Reset video progress
- ✅ **Completion Validation**: Automatic detection of watched videos
- ✅ **Duration Validation**: Verify minimum watch time for completion

#### Learning Materials
- ✅ **Course Notes**: `StudentNoteCreateAPIView` - Student-created notes
- ✅ **Note Management**: `StudentNoteDetailAPIView` (CRUD) - Edit/delete personal notes
- ✅ **Study Resources**: Downloadable course materials
- ✅ **Transcript Access**: Auto-generated video transcripts

---

### 4. ASSESSMENT & QUIZZES

#### Quiz Management (Teachers)
- ✅ **Create Quizzes**: `QuizListCreateAPIView` - Teacher quiz creation
- ✅ **Edit Quiz**: `QuizDetailAPIView` (PUT/DELETE) - Update quiz settings
- ✅ **Quiz Questions**: `QuizQuestionListCreateAPIView` - Add multiple questions
- ✅ **Question Types**: Multiple choice, true/false, short answer
- ✅ **Answer Choices**: `QuizChoiceListCreateAPIView` - Define correct/incorrect options
- ✅ **Quiz Settings**: Time limits, passing score, randomization

#### Student Quiz Experience
- ✅ **Quiz List**: `StudentQuizListAPIView` - Available quizzes for enrollment
- ✅ **Quiz Details**: `StudentQuizDetailAPIView` - Questions and submission UI
- ✅ **Submit Answers**: `StudentQuizSubmitAPIView` - Grade immediately or manually
- ✅ **Quiz Attempts**: `StudentQuizAttemptsAPIView` - View attempt history
- ✅ **Score Tracking**: Automatic calculation and recording
- ✅ **Performance Analytics**: Teacher view of student performance per quiz

---

### 5. CERTIFICATION SYSTEM

#### Certificate Generation
- ✅ **Eligibility Check**: `StudentCertificateEligibilityAPIView` - Verify completion criteria
- ✅ **Generate Certificate**: `StudentCertificateGenerateAPIView` - Create and store
- ✅ **Download Certificate**: `StudentCertificateDownloadAPIView` - PDF/image download
- ✅ **Template System**: Customizable certificate designs
- ✅ **QR Code Integration**: Unique QR per certificate for validation

#### Certificate Validation
- ✅ **Validate Certificates**: `CertificateValidation` page - Public verification
- ✅ **Unique Certificate IDs**: Trackable via QR code
- ✅ **Signature/Seal**: Digital certificates with authentication
- ✅ **Reissuance**: Generate new certificates if needed
- ✅ **Certificate History**: Student access to all earned certificates

---

### 6. SEARCH & DISCOVERY

#### Basic Search
- ✅ **Course Search**: `SearchCourseAPIView` (GET `/api/v1/course/search/?search=`)
  - Title matching
  - Description search
  - Teacher name search
  - Result ranking by relevance
  - Caching via `SearchCacheManager`

#### Advanced Search (PHASE 4+)
- ✅ **Full-Text Search**: `FullTextSearchAPIView` (GET `/api/v1/course/full-text-search/`)
  - PostgreSQL full-text search with rank weighting
  - WebSearch syntax (quotes, boolean operators)
  - Pagination support
  - Execution time metrics

- ✅ **Advanced Search with Filters**: `AdvancedSearchAPIView` (POST `/api/v1/search/advanced/`)
  - Keyword search + multiple filters
  - Category filtering
  - Level filtering (Beginner, Intermediate, Advanced)
  - Rating/review filtering
  - Teacher/instructor filtering
  - Combined search criteria

- ✅ **Search Suggestions**: `AdvancedSearchSuggestionsAPIView` - Auto-complete suggestions

#### Search Analytics (PHASE 4+)
- ✅ **Trending Searches**: `TrendingSearchesAnalyticsAPIView`, `TrendingSearchesAPIView`
- ✅ **Failed Searches**: `FailedSearchesAnalyticsAPIView` - Zero-result queries
- ✅ **Search Volume**: `SearchVolumeAnalyticsAPIView` - Search frequency metrics
- ✅ **Search Statistics**: `SearchStatsAPIView` - Comprehensive search metrics
- ✅ **Course Search Metrics**: `CourseSearchMetricsAPIView` - Per-course search data
- ✅ **Search Analytics Dashboard**: `SearchAnalyticsDashboardAPIView` - Full analytics view
- ✅ **Search Analytics Summary**: `SearchAnalyticsSummaryAPIView` - High-level overview
- ✅ **Search Analytics Trends**: `SearchAnalyticsTrendAPIView` - Trend analysis

#### Filter System (PHASE 4+)
- ✅ **Filter Options**: `FilterOptionsAPIView` - All available filters
- ✅ **Category Filter**: `CategoryFilterAPIView` - Filter by course category
- ✅ **Level Filter**: `LevelFilterAPIView` - Filter by difficulty level
- ✅ **Rating Filter**: `RatingFilterAPIView` - Filter by star rating
- ✅ **Teacher Filter**: `TeacherFilterAPIView` - Filter by instructor

#### Search Database Models
- `SearchLog` model - Tracks all search queries
  - Query text, user, timestamp
  - Result count (for failed search detection)
  - Search type (basic, advanced, full-text)

---

### 7. Q&A & COMMUNITY

#### Question & Answer System
- ✅ **Create Questions**: `QuestionAnswerListCreateAPIView` (POST) - Student questions
- ✅ **List QA**: `QuestionAnswerListCreateAPIView` (GET) - Course Q&A threads
- ✅ **Send Messages**: `QuestionAnswerMessageSendAPIView` - Reply to questions
- ✅ **Thread Management**: Track answer threads per course/content
- ✅ **Answer Acceptance**: Mark answers as correct/helpful
- ✅ **Notifications**: Alert instructors to new questions

#### Teacher Q&A Management
- ✅ **View Questions**: `TeacherQuestionAnswerListAPIView` - All course questions
- ✅ **Prioritize Questions**: Mark important/urgent
- ✅ **Pin Answers**: Keep helpful answers visible

---

### 8. DASHBOARD & ANALYTICS

#### Student Dashboard
- ✅ **Student Dashboard**: `StudentDashboard` page - Overview of learning
- ✅ **My Courses**: Enrolled courses with progress bars
- ✅ **Recent Activity**: Recently watched, completed courses
- ✅ **Learning Stats**: Hours studied, courses completed, certificates earned
- ✅ **Student Summary**: `StudentSummaryAPIView` - Quick stats

#### Teacher Dashboard
- ✅ **Teacher Dashboard**: `Dashboard` (instructor) page - Course analytics
- ✅ **Course Analytics**: Student enrollment, completion rates
- ✅ **Revenue Analytics**: (If payment integrated)
- ✅ **Student Performance**: Quiz scores, video completion
- ✅ **Teaching Stats**: `TeacherSummaryAPIView` - Overview metrics

#### Admin Dashboard
- ✅ **Admin Dashboard**: System-wide analytics
- ✅ **User Statistics**: Total users, active users, roles breakdown
- ✅ **Course Statistics**: Total courses, published/draft counts
- ✅ **Enrollment Analytics**: Trends and patterns
- ✅ **System Health**: Health check endpoint (`HealthCheckAPIView`)

#### Teacher-Specific Analytics
- ✅ **Best Selling Courses**: `TeacherBestSellingCourseAPIView` - Top courses
- ✅ **Course Orders**: `TeacherCourseOrdersListAPIView` - Student enrollments
- ✅ **Student List**: `TeacherStudentsListAPIView` - View all students
- ✅ **Performance Metrics**: Per-student analytics

---

### 9. NOTIFICATIONS & MESSAGING

#### Notification System
- ✅ **Notification List**: `TeacherNotificationListAPIView` - All notifications
- ✅ **Notification Details**: `TeacherNotificationDetailAPIView` (GET/PUT)
- ✅ **Mark as Read**: Update notification status
- ✅ **Delete Notifications**: Remove old notifications
- ✅ **Email Notifications**: Integration with email backends
- ✅ **Real-time Notifications**: WebSocket support (if configured)

#### Message Types
- New enrollment notifications
- Q&A answer notifications
- Course updates notifications
- Certificate ready notifications
- System announcements

---

### 10. FILE MANAGEMENT & UPLOADS

#### File Upload System
- ✅ **File Upload**: `FileUploadAPIView` - Multi-file upload
- ✅ **Supported Types**: Videos, PDFs, images, documents
- ✅ **Storage Integration**: Local/cloud storage (AWS S3, etc.)
- ✅ **File Validation**: Size limits, type checking, virus scanning
- ✅ **CDN Integration**: Fast delivery of course materials

#### Course Materials
- ✅ **Download Materials**: Course attachments and resources
- ✅ **Bulk Download**: ZIP multiple files
- ✅ **Access Control**: Only enrolled students can download

---

## 🎨 Frontend Components & Pages

### Authentication Pages
| Page | Component | Route | Description |
|------|-----------|-------|-------------|
| Register | `Register` | `/auth/register/` | User registration |
| Login | `Login` | `/auth/login/` | User login |
| SSO Login | `SSOLogin` | `/auth/sso-login/` | SSO authentication |
| Forgot Password | `ForgotPassword` | `/auth/forgot-password/` | Password reset request |
| Create New Password | `CreateNewPassword` | `/auth/create-new-password/` | Password reset form |

### Base (Public) Pages
| Page | Component | Route | Description |
|------|-----------|-------|-------------|
| Home | `Index` | `/` | Homepage |
| Course Detail | `CourseDetail` | `/course/:id/` | Public course view |
| Search | `Search` | `/search/?query=` | Course search results |
| User Guide | `UserGuide` | `/user-guide/` | Help documentation |
| Certificate Validation | `CertificateValidation` | `/certificate/validate/` | Public certificate verification |
| Not Found | `NotFound` | `/404/` | 404 error page |

### Student Pages
| Page | Component | Route | Description |
|------|-----------|-------|-------------|
| Dashboard | `StudentDashboard` | `/student/dashboard/` | Student overview |
| Courses | `StudentCourses` | `/student/courses/` | Enrolled courses |
| Course Detail | `StudentCourseDetail` | `/student/course/:id/` | Course content player |
| Wishlist | `Wishlist` | `/student/wishlist/` | Saved courses |
| Q&A | `StudentQA` | `/student/qa/` | Course questions |
| Profile | `StudentProfile` | `/student/profile/` | User profile settings |
| Change Password | `StudentChangePassword` | `/student/change-password/` | Password update |

### Instructor (Teacher) Pages
| Page | Component | Route | Description |
|------|-----------|-------|-------------|
| Dashboard | `Dashboard` (instructor) | `/instructor/dashboard/` | Teaching overview |
| Courses | `Courses` (instructor) | `/instructor/courses/` | Manage courses |
| Create Course | `CreateCourse` (implied) | `/instructor/course/create/` | New course wizard |
| Review | `Review` | `/instructor/review/` | Student reviews |
| Students | `TeacherStudentsList` (implied) | `/instructor/students/` | View students |

### Admin Pages
| Page | Component | Route | Description |
|------|-----------|-------|-------------|
| Dashboard | `AdminDashboard` | `/admin/dashboard/` | System overview |
| Users | `AdminUsers` | `/admin/users/` | User management |
| Courses | `AdminCourses` | `/admin/courses/` | Course moderation |
| Reports | `AdminReports` | `/admin/reports/` | Analytics & reports |

### Reusable Components Library

#### Search Components
- `SearchResultsDisplay.jsx` - Display search results with filters
- `AdvancedSearchForm.jsx` - Advanced search form with multiple criteria
- `SearchSection.jsx` - Search header component
- `SearchDashboard/` - Analytics dashboard components

#### Course Components
- `CourseCard.jsx` - Reusable course card display
- `CourseDetail/` - Course detail view components
- `CourseCard.css` - Styling for course cards

#### UI Components
- `ErrorBoundary.jsx` - React error boundary
- `EmptyState.jsx` - Empty state display
- `PasswordField.jsx` - Secure password input
- `ComingSoonModal.jsx` - Feature not-ready modal
- `SEO.jsx` - SEO meta tags management
- `ThemeProvider.jsx` - Dark/light theme support

#### Advanced Components
- `ProfilePictureCropModal/` - Image cropping tool
- `CountrySelector/` - Country/region selection
- `VirtualList/` - Virtual scrolling for large lists
- `WorkflowStepper.jsx` - Multi-step form wizard

#### Analytics Components
- `Analytics/` - Dashboard charts and visualizations
  - Revenue charts
  - Student performance graphs
  - Course analytics
  - Enrollment trends

#### Skeleton Loading
- `SkeletonComponents.jsx` - Loading placeholders
  - `SkeletonPage` - Full page skeleton
  - `SkeletonStatCard` - Statistics card skeleton
  - Course skeleton
  - List skeleton

---

## 🔌 API Endpoints Summary

### Authentication Routes
```
POST /api/v1/auth/token/                    - Obtain JWT tokens
POST /api/v1/auth/token/refresh/            - Refresh JWT tokens
POST /api/v1/auth/register/                 - User registration
POST /api/v1/sso/verify/                    - SSO token verification
GET  /api/v1/sso/redirect/                  - SSO login redirect
GET  /api/v1/auth/profile/                  - Get user profile
PUT  /api/v1/auth/profile/                  - Update user profile
POST /api/v1/auth/password-reset/           - Request password reset
POST /api/v1/auth/password-change/          - Change password (auth)
POST /api/v1/auth/change-password/          - Change password (self)
```

### Course Routes
```
GET  /api/v1/course/course-list/            - List all courses
GET  /api/v1/course/:id/                    - Get course details
POST /api/v1/course/                        - Create course (teacher)
PUT  /api/v1/course/:id/                    - Update course (teacher)
DELETE /api/v1/course/:id/                  - Delete course (teacher)
POST /api/v1/course/publish/                - Publish course (teacher)
```

### Enrollment Routes
```
POST /api/v1/course/enrollment/             - Enroll in course
GET  /api/v1/course/enrollment/status/     - Check enrollment status
GET  /api/v1/student/courses/               - Student enrolled courses
GET  /api/v1/student/course/:id/            - Student course details
```

### Search Routes
```
GET  /api/v1/course/search/                 - Basic search
GET  /api/v1/course/full-text-search/       - Full-text search
POST /api/v1/search/advanced/               - Advanced search
GET  /api/v1/search/suggestions/            - Search suggestions
```

### Analytics Routes
```
GET  /api/v1/analytics/trending-searches/   - Trending searches
GET  /api/v1/analytics/failed-searches/     - Failed searches
GET  /api/v1/analytics/search-volume/       - Search volume metrics
GET  /api/v1/analytics/dashboard/           - Analytics dashboard
GET  /api/v1/filters/options/               - Available filters
```

### Quiz Routes
```
GET  /api/v1/quiz/                          - List quizzes
POST /api/v1/quiz/                          - Create quiz (teacher)
PUT  /api/v1/quiz/:id/                      - Update quiz
DELETE /api/v1/quiz/:id/                    - Delete quiz
POST /api/v1/quiz/submit/                   - Submit quiz answers (student)
GET  /api/v1/quiz/attempts/                 - Quiz attempts history
```

### Certificate Routes
```
GET  /api/v1/certificate/eligibility/       - Check eligibility
POST /api/v1/certificate/generate/          - Generate certificate
GET  /api/v1/certificate/download/:id/      - Download certificate
GET  /api/v1/certificate/validate/          - Validate certificate
```

### Q&A Routes
```
GET  /api/v1/qa/                            - List Q&A threads
POST /api/v1/qa/                            - Create question
POST /api/v1/qa/message/                    - Send answer/reply
```

### File Upload Routes
```
POST /api/v1/upload/                        - Upload file
GET  /api/v1/upload/:id/                    - Get file details
DELETE /api/v1/upload/:id/                  - Delete file
```

### Teacher Routes
```
GET  /api/v1/teacher/profile/               - Get teacher profile
PUT  /api/v1/teacher/profile/               - Update teacher profile
GET  /api/v1/teacher/courses/               - Teacher courses
GET  /api/v1/teacher/students/              - Teacher students
GET  /api/v1/teacher/notifications/         - Teacher notifications
```

---

## 📦 Database Models (Key Entities)

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `User` | User accounts | email, username, role, is_active |
| `Profile` | User profiles | user, bio, avatar, country |
| `Teacher` | Teacher/instructor | user, bio, rating, students_count |
| `Student` | Student users | user, wishlist |
| `Course` | Course offerings | title, description, price, level |
| `Module` | Course sections | course, title, order |
| `VariantItem` | Variant content | variant, title, order |
| `VideoProgress` | Video watching | student, video, duration, completion |
| `StudentNote` | Student notes | student, course, content |
| `StudentRating` | Course reviews | student, course, rating |
| `StudentCourseEnrollment` | Enrollments | student, course, date_enrolled |
| `StudentWishList` | Wishlist items | student, course |
| `QuestionAnswer` | Q&A threads | student, course, message |
| `QuestionAnswerMessage` | Q&A replies | question_answer, user, message |
| `Quiz` | Quiz objects | course, title, passing_score |
| `QuizQuestion` | Quiz questions | quiz, question_text, type |
| `QuizChoice` | Answer options | question, choice_text, is_correct |
| `StudentQuizAttempt` | Quiz submissions | student, quiz, score, date |
| `Certificate` | Certificates | student, course, qr_code, date_issued |
| `SearchLog` | Search history | query, user, result_count, timestamp |
| `Admin` | Admin settings | is_super_admin, settings |
| `Notification` | System notifications | user, title, message, is_read |

---

## 🔒 Security Features

- ✅ **JWT Authentication**: Secure token-based auth with refresh tokens
- ✅ **Password Hashing**: PBKDF2 with SHA256 (Django default)
- ✅ **CORS Protection**: Cross-Origin Resource Sharing configured
- ✅ **CSRF Protection**: Django CSRF middleware
- ✅ **Permission Checks**: Role-based access control on all endpoints
- ✅ **SSL/TLS**: HTTPS in production (configured via Nginx)
- ✅ **Rate Limiting**: Prevent abuse (configured in settings)
- ✅ **SQL Injection Protection**: Django ORM parametrized queries
- ✅ **XSS Protection**: React content escaping
- ✅ **Secure File Upload**: Type validation, size limits, virus scanning
- ✅ **Environment Variables**: Secrets in `.env` file (not in repo)

---

## 🚀 Performance Features

- ✅ **Database Indexing**: Optimized indexes on search queries
- ✅ **Query Optimization**: `select_related()`, `prefetch_related()`
- ✅ **Pagination**: Default 20 items per page (configurable)
- ✅ **Caching**: Redis cache for search results (`SearchCacheManager`)
- ✅ **Lazy Loading**: Frontend components lazy-loaded via React.lazy()
- ✅ **Code Splitting**: Vite chunks vendors separately
- ✅ **Memoization**: React.memo on all reusable components
- ✅ **Virtual Scrolling**: Large lists use VirtualList component
- ✅ **CDN Integration**: Static files served from CDN
- ✅ **Compression**: Gzip compression on HTTP responses
- ✅ **Database Connection Pool**: Connection pooling configured

---

## 🧪 Testing & Quality

### Backend Testing
- Integration tests in `test_*.py` files
- Analytics tests for search functionality
- API response validation
- Permission tests for RBAC

### Frontend Testing
- ESLint configuration for code quality
- Error boundary testing
- Component snapshot tests (manual)

### Manual Testing Guides
- User registration flow
- Course enrollment process
- Quiz submission and grading
- Certificate generation and validation

---

## 📱 Deployment Architecture

### Docker Compose Stack
```yaml
Services:
- PostgreSQL (lms_postgres) - Database
- Redis (lms_redis) - Cache & sessions
- Django (backend) - API server
- Nginx - Reverse proxy & static files
- React Frontend - Served by Nginx
```

### Environment Configuration
- `.env.example` - Configuration template
- `docker-compose.yml` - Development setup
- `docker-compose.prod.yml` - Production setup
- Nginx configuration for proxying

### Deployment Scripts
- `DEPLOY_TO_PRODUCTION.ps1` - PowerShell deployment
- `deploy-production.sh` - Bash deployment
- `deploy-cleanup.sh` - Cleanup script
- `deploy-ui-fixes.ps1` - UI updates deployment

---

## 🛠️ Development Tools & Configuration

### Backend
- Django 4.2 with Django REST Framework
- PostgreSQL database
- Redis cache
- Celery for async tasks (optional)
- pytest for testing
- Black for code formatting

### Frontend
- React 18 with Vite bundler
- Bootstrap 5 for styling
- React Router v6 for navigation
- Axios for HTTP requests
- Chart.js for analytics visualizations

### Development Workflow
```bash
# Backend
cd backend
python -m venv venv
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

---

## 📚 Documentation Files

Key documentation in project root:
- `ARCHITECTURE_DOCUMENTATION.md` - System architecture
- `API_REFERENCE.md` - Detailed API docs
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `CONTRIBUTING.md` - Development guidelines
- `CHANGELOG.md` - Version history

---

## ✨ Recent Enhancements (Phase 4.9+)

- 🔍 Advanced full-text search with PostgreSQL
- 📊 Comprehensive search analytics dashboard
- 🎯 Advanced filtering system (category, level, rating, teacher)
- 📈 Search metrics and trending analysis
- ⚡ Redis caching for search performance
- 🎨 UI/UX improvements and bug fixes
- 🔐 Enhanced security and permission checks
- 📱 Mobile-responsive design improvements
- ♿ Accessibility improvements (WCAG compliance)

---

## 🎓 Learning Paths (Future Feature Ideas)

- Guided learning paths (series of courses)
- Skill badges system
- Peer learning/study groups
- Mentor assignment
- Course prerequisites
- Adaptive learning (AI-powered recommendations)
- Gamification (leaderboards, achievements)

---

## 📞 Support & Maintenance

- System health check endpoint: `GET /api/v1/health/`
- Performance monitoring enabled
- Error logging to `django_error.log`
- Frontend error boundary with user notifications
- Support for user feedback/bug reports

---

**Generated**: November 2025  
**Maintained by**: Development Team  
**Last Review**: Phase 4.9+
