# Changelog

All notable changes to LMSetjen DPD RI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- [ ] Social media authentication (Google, Facebook)
- [ ] Live streaming classes
- [ ] Group discussions
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Payment gateway integration
- [ ] Gamification features
- [ ] Advanced quiz types
- [ ] Video conferencing integration
- [ ] Automated email campaigns
- [ ] Calendar integration
- [ ] Course recommendations AI
- [ ] Plagiarism detection

---

## [1.8.0] - 2026-06-17

### Added
- 🔢 **Project versioning system** — Single source of truth `VERSION` file at root, `backend/api/version.py`, `frontend/src/utils/version.js`
- 🏷️ Version badge displayed in site Footer and Admin Dashboard → System Health tab
- 🔒 **SSL Certificate management** — Comprehensive SSL chain validation for cmb.api domain (Phase 77)
- 🔄 **Course duplication** — Full course copy with lessons, materials, quizzes (Phase 75)
- 🎨 **CSS scope isolation** — Eliminated global CSS pollution across all admin/instructor/student pages (Phase 63–73)
- 🗑️ **Professional delete confirmation dialog** — Replaces browser `confirm()` (Phase professional)

### Changed
- 🖼️ Footer now shows app version alongside copyright line
- 🩺 `GET /api/v1/health/` now returns `version` field with app version
- 🩺 `GET /api/v1/admin/system-health/` `server_information` now includes `app_version`

### Fixed
- 📋 Form `<select>` chevron visibility across multiple views (Phase 71–72)
- 🏷️ Tags not copied during course publish (Phase 7.5e critical fix)
- 🏷️ Tag selector dropdown z-index persistence (Phase x.2.1)

---

## [1.7.0] - 2026-05-01

### Added
- 📊 **Activity log API** — Full activity tracking with display components (Phase 53–65)
- 🔔 **Instructor notifications** — Real-time notifications for instructor actions (Phase 64)
- 👤 **Profile avatar auto-crop & save** — Avatar upload with auto-save after crop (Phase 62)
- 🏷️ **Course tags system** — Tag creation, assignment, display and filtering (Phase 7.5)
- 🔒 **Feedback CAPTCHA / spam prevention** — Verification modal before feedback submit (Phase 11.3)
- ✅ **Feedback verification system** — Step-sequence challenge to prevent accidental submissions

### Fixed
- 📧 Feedback API 404 resolution (Phase 11)
- 🖼️ Admin feedback modal details display (Phase 11)
- 📐 Profile row width overflow (Phase x)
- 📐 All instructor page header details row alignment (Phase x)

---

## [1.6.0] - 2026-03-01

### Added
- 🎬 **Full video player controls** — Custom controls for HTML5 and YouTube players (Phase 11.179)
- 📹 **Limited / Full mode video players** — Two modes with permission gating (Phase 40–41)
- ⏭️ **Auto-unlock at 95% video progress** — Lesson auto-unlock on near-completion (Phase 17.10)
- 🏆 **Ranking system** — Student ranking based on course completion and points (Phase 10.1)
- 📈 **Advanced search analytics** — Trending searches, failed searches, query taxonomy dashboard
- 🤖 **Course recommendations** — AI-based recommendation engine with conversion tracking

### Fixed
- 🎬 YouTube API progress tracking race condition (Phase 42.3, 42.7)
- 🎬 YouTube fullscreen exit handling (Phase 41.2)
- 🎬 Video resume seek position accuracy (Phase 34)
- ⏭️ Last lesson completion handling (Phase 43–44)
- 🔄 Video resume race condition (Phase 34+)

---

## [1.5.0] - 2026-01-01

### Added
- 💬 **Feedback system** — Student/instructor/admin feedback with moderation dashboard (Phase 11)
- 📊 **Enrollment analytics** — Monthly trend charts, category distribution, top courses
- 🧑‍💼 **Admin system health dashboard** — Django/Python versions, DB stats
- 🔐 **SSO integration** — Government SSO token exchange (Nusa DPD)
- 🏅 **Certificate generation** — Auto PDF certificate on course completion

### Fixed
- 📝 Q&A missing questions visibility (Phase qa)
- ✅ Lesson completion auto-unlock flow (Phase 12)
- 📐 Modal full-coverage structural issues (Phase modal)

---

## [1.2.0] - 2025-12-01

### Added
- 🔍 **Full-text search** — PostgreSQL `SearchVector` with websearch syntax support (Phase 4+)
- 🔍 **Advanced search** — Filters by category, level, rating, teacher
- 📊 **Search analytics** — Search logging, trending and failed-search insights
- 🎯 **Course tags** — Tagging and tag-based filtering
- 👤 **Employee sync** — Sync government employee directory via API
- 📋 **Activity logging** — Track all user actions

---

## [1.1.0] - 2025-11-01

### Added
- 🎥 **YouTube video player** — Embedded YouTube progress tracking
- 📝 **Course versioning** — Draft / published version workflow for instructors
- 📱 **Responsive improvements** — Mobile layout fixes across all pages
- 🔔 **Notification system** — In-app notifications for key events
- 📈 **Analytics dashboard** — Initial charts and KPI widgets

### Fixed
- 🎬 Video upload completion toggle
- 📐 Header alignment and card cleanup

---

## [1.0.0] - 2025-10-11

### Added
- 🎉 Initial release of LMSetjen DPD RI
- ✅ Complete Learning Management System functionality
- 👤 User authentication system with JWT
- 📚 Course management system for instructors
- 🎥 Video streaming capabilities
- 📝 Quiz and assessment system
- 🏆 Automatic certificate generation
- ⭐ Course review and rating system
- 💬 Q&A forum for student-instructor interaction
- ❤️ Wishlist functionality
- 📊 Comprehensive dashboard for students, instructors, and admins
- 🎨 Modern and responsive UI with Bootstrap 5
- 🔄 Drag-and-drop curriculum builder
- 📱 Mobile-responsive design
- 🌐 Landing page with scroll-snap sections
- 📈 Analytics and reporting system
- 🔐 Role-based access control (Student, Instructor, Admin)
- 🎬 Video compression and optimization
- 📧 Email notification system
- 🔍 Advanced course search and filtering

### Backend Features
- Django 4.x REST API
- PostgreSQL support (production ready)
- JWT authentication
- File upload handling
- CORS configuration
- Media file management

### Frontend Features
- React 18 with Vite
- React Router for navigation
- Axios for API calls
- Bootstrap 5 for styling
- Responsive layout

---

## Version History

### How to Read This Changelog

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

### How to Bump Version

1. Edit `VERSION` file at project root (e.g. `1.8.1`)
2. Edit `frontend/src/utils/version.js` — set `APP_VERSION`
3. Edit `frontend/package.json` — set `"version"`
4. Add an entry to `CHANGELOG.md`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for ways to contribute.

### Added
- 🎉 Initial release of LMSetjen DPD RI
- ✅ Complete Learning Management System functionality
- 👤 User authentication system with JWT
- 📚 Course management system for instructors
- 🎥 Video streaming capabilities
- 📝 Quiz and assessment system
- 🏆 Automatic certificate generation
- ⭐ Course review and rating system
- 💬 Q&A forum for student-instructor interaction
- ❤️ Wishlist functionality
- 📊 Comprehensive dashboard for students, instructors, and admins
- 🎨 Modern and responsive UI with Bootstrap 5
- 🔄 Drag-and-drop curriculum builder
- 📱 Mobile-responsive design
- 🌐 Landing page with scroll-snap sections
- 📈 Analytics and reporting system
- 🔐 Role-based access control (Student, Instructor, Admin)
- 🎬 Video compression and optimization
- 📧 Email notification system
- 🔍 Advanced course search and filtering

### Backend Features
- Django 4.x REST API
- SQLite database (development)
- PostgreSQL support (production ready)
- JWT authentication
- File upload handling
- CORS configuration
- Media file management
- API versioning

### Frontend Features
- React 18 with Vite
- React Router for navigation
- Axios for API calls
- React Player for video playback
- React DnD for drag-and-drop
- Bootstrap 5 for styling
- Responsive layout
- State management with Zustand
- Form validation
- Loading states and error handling

### Documentation
- Comprehensive README.md
- CONTRIBUTING.md guidelines
- LICENSE file (MIT)
- API documentation
- Trial reports
- Setup guides

### Security
- JWT token authentication
- Password hashing
- CORS protection
- Input validation
- XSS prevention
- CSRF protection

## [Unreleased]

### Planned Features
- [ ] Social media authentication (Google, Facebook)
- [ ] Live streaming classes
- [ ] Group discussions
- [ ] Advanced analytics with charts
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Payment gateway integration
- [ ] Gamification features
- [ ] Advanced quiz types
- [ ] Video conferencing integration
- [ ] Automated email campaigns
- [ ] Calendar integration
- [ ] Notification system
- [ ] Course recommendations AI
- [ ] Plagiarism detection

### Known Issues
- Video upload size limited to 100MB (configurable)
- Email notifications require SMTP configuration
- Some browsers may have scroll-snap compatibility issues

### Improvements Needed
- Performance optimization for large video files
- Better caching strategy
- Database query optimization
- API rate limiting
- Enhanced security measures
- Better error messages
- Accessibility improvements

---

## Version History

### How to Read This Changelog

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for ways to contribute.

## Support

For issues and questions:
- GitHub Issues: https://github.com/khaz-dev/LMSetjen-DPD-RI/issues
- Email: khaz-dev@github.com

---

**Full Changelog**: https://github.com/khaz-dev/LMSetjen-DPD-RI/commits/main
