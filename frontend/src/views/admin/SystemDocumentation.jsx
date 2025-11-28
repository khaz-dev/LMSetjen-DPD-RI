import React, { useState, useRef } from "react";
import { 
    FaBook, FaFileDownload, FaGlobe, FaServer, FaDatabase, FaShieldAlt,
    FaUsers, FaCog, FaCode, FaNetworkWired, FaDocker, FaCloud,
    FaLock, FaKey, FaUserShield, FaChartLine, FaClipboardCheck,
    FaPrint, FaLanguage, FaCheckCircle, FaInfoCircle
} from "react-icons/fa";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import "./SystemDocumentation.css";

function SystemDocumentation() {
    const [language, setLanguage] = useState("en"); // 'en' or 'id'
    const contentRef = useRef(null);

    const content = {
        en: {
            pageTitle: "System Documentation",
            pageSubtitle: "Comprehensive technical documentation and system architecture guide",
            printPDF: "Export to PDF",
            language: "Language",
            lastUpdated: "Last Updated",
            version: "Version",
            
            // Table of Contents
            tocTitle: "Table of Contents",
            sections: {
                overview: "System Overview",
                architecture: "System Architecture",
                technologies: "Technology Stack",
                features: "Core Features",
                authentication: "Authentication & Authorization",
                api: "API Documentation",
                database: "Database Schema",
                deployment: "Deployment Architecture",
                security: "Security Measures",
                roles: "User Roles & Permissions",
                maintenance: "Maintenance & Support"
            },

            // Overview
            overview: {
                title: "System Overview",
                description: "LMSetjen DPD RI is a modern Learning Management System designed specifically for the Secretariat General of the Regional Representative Council of the Republic of Indonesia. The system provides a comprehensive platform for online learning, course management, and competency development.",
                purpose: "Purpose & Objectives",
                purposeItems: [
                    "Provide a modern and user-friendly online learning platform",
                    "Facilitate skill and competency development for employees",
                    "Support self-paced and collaborative learning",
                    "Provide comprehensive evaluation and certification system",
                    "Enable efficient course content management",
                    "Track learner progress and generate analytics"
                ],
                systemInfo: "System Information",
                productionUrl: "Production URL",
                developmentFramework: "Development Framework",
                databaseSystem: "Database System",
                hostingPlatform: "Hosting Platform",
                projectStatus: "Project Status",
                statusReady: "Production Ready"
            },

            // Architecture
            architecture: {
                title: "System Architecture",
                description: "The system follows a modern microservices architecture with clear separation of concerns:",
                frontend: "Frontend Layer",
                frontendDesc: "React 18.2 with Vite bundler, providing a fast and responsive single-page application (SPA)",
                backend: "Backend Layer",
                backendDesc: "Django 4.2 with Django REST Framework, serving as RESTful API backend",
                database: "Database Layer",
                databaseDesc: "PostgreSQL for production, SQLite for development",
                caching: "Caching Layer",
                cachingDesc: "Redis for session management and application caching",
                proxy: "Reverse Proxy",
                proxyDesc: "Nginx handling SSL termination, static files, and load balancing",
                deployment: "Containerization",
                deploymentDesc: "Docker containers orchestrated via Docker Compose for consistent deployments"
            },

            // Technologies
            technologies: {
                title: "Technology Stack",
                frontend: "Frontend Technologies",
                frontendList: [
                    "React 18.2 - UI library",
                    "Vite 4.5 - Build tool & dev server",
                    "React Router 6.10 - Client-side routing",
                    "Axios - HTTP client",
                    "Bootstrap 5.3 - UI framework",
                    "Chart.js 4.4 - Data visualization",
                    "CKEditor 5 - Rich text editor",
                    "JWT Decode - Token management",
                    "SweetAlert2 - User notifications",
                    "React Icons - Icon library"
                ],
                backend: "Backend Technologies",
                backendList: [
                    "Python 3.11+ - Programming language",
                    "Django 4.2 - Web framework",
                    "Django REST Framework - API toolkit",
                    "Simple JWT - JWT authentication",
                    "Django CORS Headers - CORS management",
                    "Pillow - Image processing",
                    "Requests - HTTP library",
                    "Python Decouple - Configuration management"
                ],
                infrastructure: "Infrastructure & DevOps",
                infrastructureList: [
                    "Docker & Docker Compose - Containerization",
                    "PostgreSQL 15 - Production database",
                    "Redis 7 - Caching & session storage",
                    "Nginx 1.25 - Web server & reverse proxy",
                    "Let's Encrypt - SSL certificates",
                    "AWS EC2 - Cloud hosting",
                    "DuckDNS - Dynamic DNS service",
                    "Git & GitHub - Version control"
                ]
            },

            // Features
            features: {
                title: "Core Features",
                student: "Student Features",
                studentList: [
                    "Course browsing and search with advanced filters",
                    "Video-based learning with progress tracking",
                    "Interactive quizzes and assessments",
                    "Digital certificates upon course completion",
                    "Course reviews and ratings",
                    "Q&A forum with instructors",
                    "Wishlist for favorite courses",
                    "Real-time learning dashboard",
                    "Profile and password management",
                    "Mobile-responsive interface"
                ],
                instructor: "Instructor Features",
                instructorList: [
                    "Course creation and management",
                    "Curriculum and content organization",
                    "Video upload and streaming",
                    "Quiz creation with multiple question types",
                    "Student enrollment tracking",
                    "Performance analytics and reports",
                    "Q&A management",
                    "Review and rating monitoring",
                    "Bulk content operations",
                    "Course preview and publishing"
                ],
                admin: "Admin Features",
                adminList: [
                    "User management (CRUD operations)",
                    "Role assignment (Student/Teacher/Admin)",
                    "System-wide analytics dashboard",
                    "External user synchronization",
                    "Bulk user operations",
                    "System health monitoring",
                    "Course approval and moderation",
                    "Platform configuration",
                    "Audit logs and reporting",
                    "System documentation access"
                ]
            },

            // Authentication
            authentication: {
                title: "Authentication & Authorization",
                mechanism: "Authentication Mechanism",
                mechanismDesc: "The system uses JWT (JSON Web Tokens) for stateless authentication. Upon successful login, the backend issues access and refresh tokens that are stored securely in the browser.",
                flow: "Authentication Flow",
                flowSteps: [
                    "User submits credentials (email/password)",
                    "Backend validates credentials against database",
                    "If valid, backend generates JWT access token (5 minutes) and refresh token (7 days)",
                    "Tokens are stored in browser's local storage",
                    "Each API request includes access token in Authorization header",
                    "Backend validates token and extracts user information",
                    "If access token expires, frontend automatically uses refresh token to get new access token",
                    "User remains logged in until refresh token expires or explicit logout"
                ],
                authorization: "Role-Based Authorization",
                authorizationDesc: "The system implements comprehensive RBAC (Role-Based Access Control) with three primary roles:",
                roles: [
                    {
                        name: "Student",
                        description: "Access to learning materials, courses, quizzes, and personal dashboard"
                    },
                    {
                        name: "Teacher/Instructor",
                        description: "All student access plus course creation, content management, and student analytics"
                    },
                    {
                        name: "Admin",
                        description: "Full system access including user management, system configuration, and platform administration"
                    }
                ],
                protection: "Route Protection",
                protectionDesc: "Both frontend and backend implement dual-layer protection:",
                protectionLayers: [
                    "Frontend: PrivateRoute + RoleRoute components check authentication and role before rendering pages",
                    "Backend: JWTAuthentication + IsAdminUser/IsTeacher/IsStudent permission classes validate API access"
                ]
            },

            // API
            api: {
                title: "API Documentation",
                description: "The backend exposes a comprehensive RESTful API documented with Swagger/OpenAPI specifications.",
                baseUrl: "Base URL",
                endpoints: "Main Endpoint Groups",
                endpointsList: [
                    "/api/v1/user/ - User authentication and profile management",
                    "/api/v1/course/ - Course CRUD operations and browsing",
                    "/api/v1/student/ - Student-specific operations (enrollment, progress, wishlist)",
                    "/api/v1/teacher/ - Teacher operations (course management, analytics)",
                    "/api/v1/admin/ - Admin operations (user management, system config)"
                ],
                docs: "Interactive Documentation",
                swaggerUrl: "Swagger UI",
                redocUrl: "ReDoc UI",
                authentication: "API Authentication",
                authDesc: "All protected endpoints require Bearer token in Authorization header:",
                authExample: "Authorization: Bearer <your_jwt_access_token>"
            },

            // Database
            database: {
                title: "Database Schema",
                description: "PostgreSQL database with normalized schema design for optimal performance.",
                mainModels: "Core Models",
                modelsList: [
                    "User - User accounts with role-based access",
                    "Profile - Extended user information and preferences",
                    "Course - Course metadata, content, and configuration",
                    "Category - Course categorization",
                    "Teacher - Instructor profiles and qualifications",
                    "CourseSection - Curriculum organization",
                    "CoursePart - Individual learning units/lessons",
                    "Quiz - Assessment and quiz metadata",
                    "Question - Quiz questions with various types",
                    "Answer - Quiz answer options",
                    "EnrolledCourse - Student enrollments and progress",
                    "CompletedLesson - Lesson completion tracking",
                    "Review - Course reviews and ratings",
                    "Notification - System and user notifications",
                    "Cart - Shopping cart for paid courses",
                    "CartOrder - Order processing and history",
                    "Certificate - Digital certificates",
                    "Note - Student notes and bookmarks"
                ],
                relationships: "Key Relationships",
                relationshipsList: [
                    "User → Profile (One-to-One)",
                    "User → EnrolledCourse (One-to-Many)",
                    "Teacher → Course (One-to-Many)",
                    "Course → CourseSection (One-to-Many)",
                    "CourseSection → CoursePart (One-to-Many)",
                    "Course → Quiz (One-to-Many)",
                    "Quiz → Question (One-to-Many)",
                    "Question → Answer (One-to-Many)"
                ]
            },

            // Deployment
            deployment: {
                title: "Deployment Architecture",
                description: "Production deployment on AWS EC2 using Docker containerization.",
                components: "System Components",
                componentsList: [
                    "Frontend Container (Node + Nginx) - Serves React SPA on ports 80/443",
                    "Backend Container (Python + Django) - API server on port 8000",
                    "PostgreSQL Container - Database on port 5432",
                    "Redis Container - Caching on port 6379",
                    "Main Nginx (Host) - SSL termination and reverse proxy"
                ],
                network: "Network Configuration",
                networkDesc: "Docker bridge network enables inter-container communication. Nginx routes requests:",
                routes: [
                    "/ → Frontend container (React SPA)",
                    "/api/ → Backend container (Django API)",
                    "/admin/ → Backend Django admin",
                    "/media/ → Backend static media files",
                    "/static/ → Backend static assets"
                ],
                ssl: "SSL/TLS Configuration",
                sslDesc: "Let's Encrypt provides free SSL certificates with automatic renewal. All HTTP traffic redirects to HTTPS.",
                domain: "Domain Configuration",
                domainDesc: "DuckDNS provides dynamic DNS: lmsetjendpdri.duckdns.org → AWS EC2 Public IP"
            },

            // Security
            security: {
                title: "Security Measures",
                authentication: "Authentication Security",
                authList: [
                    "JWT-based stateless authentication",
                    "Secure password hashing with Django's PBKDF2",
                    "Password strength validation (min 8 chars, complexity requirements)",
                    "Token expiration and automatic refresh",
                    "Logout token blacklisting"
                ],
                authorization: "Authorization Security",
                authzList: [
                    "Role-based access control (RBAC)",
                    "API endpoint permission classes",
                    "Frontend route protection",
                    "Principle of least privilege"
                ],
                network: "Network Security",
                networkList: [
                    "HTTPS-only in production (SSL/TLS 1.2+)",
                    "CORS configuration limiting allowed origins",
                    "Security headers (HSTS, X-Frame-Options, etc.)",
                    "Rate limiting on sensitive endpoints"
                ],
                application: "Application Security",
                appList: [
                    "SQL injection prevention via Django ORM",
                    "XSS protection through React's JSX escaping",
                    "CSRF protection on state-changing operations",
                    "Input validation and sanitization",
                    "File upload restrictions and validation",
                    "Secure session management with Redis"
                ],
                infrastructure: "Infrastructure Security",
                infraList: [
                    "Docker container isolation",
                    "AWS security groups (firewall rules)",
                    "Regular security updates and patches",
                    "Environment variable management",
                    "Secrets management (not in version control)",
                    "Database access restrictions"
                ]
            },

            // Roles
            roles: {
                title: "User Roles & Permissions",
                description: "Detailed permission matrix for each user role:",
                student: "Student Role",
                studentPerms: [
                    "✓ Browse and search courses",
                    "✓ Enroll in courses",
                    "✓ Watch video lessons",
                    "✓ Take quizzes and assessments",
                    "✓ View own progress and certificates",
                    "✓ Add courses to wishlist",
                    "✓ Submit course reviews",
                    "✓ Participate in Q&A",
                    "✓ Edit own profile",
                    "✗ Create or edit courses",
                    "✗ Access admin functions",
                    "✗ Manage other users"
                ],
                teacher: "Teacher Role",
                teacherPerms: [
                    "✓ All student permissions",
                    "✓ Create and publish courses",
                    "✓ Edit own courses",
                    "✓ Upload course materials",
                    "✓ Create quizzes",
                    "✓ View student enrollments",
                    "✓ Access teaching analytics",
                    "✓ Manage Q&A for own courses",
                    "✓ Respond to reviews",
                    "✗ Edit other teachers' courses",
                    "✗ Access admin functions",
                    "✗ Manage users"
                ],
                admin: "Admin Role",
                adminPerms: [
                    "✓ All system access",
                    "✓ User management (create, edit, delete)",
                    "✓ Role assignment and modification",
                    "✓ Course moderation and approval",
                    "✓ System configuration",
                    "✓ View system-wide analytics",
                    "✓ Access audit logs",
                    "✓ Sync external user data",
                    "✓ Bulk operations",
                    "✓ System health monitoring",
                    "✓ Documentation access",
                    "✓ Platform-wide announcements"
                ]
            },

            // Maintenance
            maintenance: {
                title: "Maintenance & Support",
                monitoring: "System Monitoring",
                monitoringDesc: "The system includes built-in health checks and monitoring:",
                monitoringList: [
                    "Health endpoint: /api/v1/health/ - Returns system status",
                    "Database connection monitoring",
                    "Redis cache availability check",
                    "Docker container health checks",
                    "Application log aggregation"
                ],
                backup: "Backup Strategy",
                backupList: [
                    "Daily automated database backups",
                    "Media file backup to cloud storage",
                    "Configuration file version control",
                    "Disaster recovery plan documented"
                ],
                updates: "Update Procedures",
                updateList: [
                    "Git-based deployment workflow",
                    "Zero-downtime deployment using Docker",
                    "Database migrations managed by Django",
                    "Automated testing before deployment",
                    "Rollback procedures documented"
                ],
                support: "Support Resources",
                supportList: [
                    "Technical documentation in /docs folder",
                    "API documentation at /swagger and /redoc",
                    "System health dashboard for admins",
                    "Error logging and tracking",
                    "Issue tracking via GitHub"
                ],
                logs: "Log Management",
                logsList: [
                    "Application logs: backend/logs/",
                    "Access logs: nginx access logs",
                    "Error logs: nginx error logs",
                    "Database query logs (development only)",
                    "Container logs via Docker"
                ]
            }
        },

        id: {
            pageTitle: "Dokumentasi Sistem",
            pageSubtitle: "Dokumentasi teknis komprehensif dan panduan arsitektur sistem",
            printPDF: "Ekspor ke PDF",
            language: "Bahasa",
            lastUpdated: "Terakhir Diperbarui",
            version: "Versi",
            
            // Daftar Isi
            tocTitle: "Daftar Isi",
            sections: {
                overview: "Gambaran Umum Sistem",
                architecture: "Arsitektur Sistem",
                technologies: "Teknologi yang Digunakan",
                features: "Fitur Utama",
                authentication: "Autentikasi & Otorisasi",
                api: "Dokumentasi API",
                database: "Skema Database",
                deployment: "Arsitektur Deployment",
                security: "Keamanan Sistem",
                roles: "Peran & Hak Akses Pengguna",
                maintenance: "Pemeliharaan & Dukungan"
            },

            // Gambaran Umum
            overview: {
                title: "Gambaran Umum Sistem",
                description: "LMSetjen DPD RI adalah Learning Management System modern yang dirancang khusus untuk Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia. Sistem ini menyediakan platform komprehensif untuk pembelajaran online, manajemen kursus, dan pengembangan kompetensi.",
                purpose: "Tujuan & Sasaran",
                purposeItems: [
                    "Menyediakan platform pembelajaran online yang modern dan mudah digunakan",
                    "Memfasilitasi pengembangan keterampilan dan kompetensi pegawai",
                    "Mendukung pembelajaran mandiri dan kolaboratif",
                    "Menyediakan sistem evaluasi dan sertifikasi yang komprehensif",
                    "Memungkinkan manajemen konten kursus yang efisien",
                    "Melacak progres pembelajaran dan menghasilkan analitik"
                ],
                systemInfo: "Informasi Sistem",
                productionUrl: "URL Produksi",
                developmentFramework: "Framework Pengembangan",
                databaseSystem: "Sistem Database",
                hostingPlatform: "Platform Hosting",
                projectStatus: "Status Proyek",
                statusReady: "Siap Produksi"
            },

            // Arsitektur
            architecture: {
                title: "Arsitektur Sistem",
                description: "Sistem mengikuti arsitektur microservices modern dengan pemisahan yang jelas:",
                frontend: "Layer Frontend",
                frontendDesc: "React 18.2 dengan Vite bundler, menyediakan single-page application (SPA) yang cepat dan responsif",
                backend: "Layer Backend",
                backendDesc: "Django 4.2 dengan Django REST Framework, berfungsi sebagai RESTful API backend",
                database: "Layer Database",
                databaseDesc: "PostgreSQL untuk produksi, SQLite untuk pengembangan",
                caching: "Layer Caching",
                cachingDesc: "Redis untuk manajemen session dan caching aplikasi",
                proxy: "Reverse Proxy",
                proxyDesc: "Nginx menangani SSL termination, static files, dan load balancing",
                deployment: "Kontainerisasi",
                deploymentDesc: "Container Docker yang diorkestrasi melalui Docker Compose untuk deployment yang konsisten"
            },

            // Teknologi
            technologies: {
                title: "Teknologi yang Digunakan",
                frontend: "Teknologi Frontend",
                frontendList: [
                    "React 18.2 - Library UI",
                    "Vite 4.5 - Build tool & dev server",
                    "React Router 6.10 - Client-side routing",
                    "Axios - HTTP client",
                    "Bootstrap 5.3 - Framework UI",
                    "Chart.js 4.4 - Visualisasi data",
                    "CKEditor 5 - Rich text editor",
                    "JWT Decode - Manajemen token",
                    "SweetAlert2 - Notifikasi pengguna",
                    "React Icons - Library ikon"
                ],
                backend: "Teknologi Backend",
                backendList: [
                    "Python 3.11+ - Bahasa pemrograman",
                    "Django 4.2 - Web framework",
                    "Django REST Framework - API toolkit",
                    "Simple JWT - Autentikasi JWT",
                    "Django CORS Headers - Manajemen CORS",
                    "Pillow - Pemrosesan gambar",
                    "Requests - Library HTTP",
                    "Python Decouple - Manajemen konfigurasi"
                ],
                infrastructure: "Infrastruktur & DevOps",
                infrastructureList: [
                    "Docker & Docker Compose - Kontainerisasi",
                    "PostgreSQL 15 - Database produksi",
                    "Redis 7 - Caching & penyimpanan session",
                    "Nginx 1.25 - Web server & reverse proxy",
                    "Let's Encrypt - Sertifikat SSL",
                    "AWS EC2 - Cloud hosting",
                    "DuckDNS - Layanan Dynamic DNS",
                    "Git & GitHub - Version control"
                ]
            },

            // Fitur
            features: {
                title: "Fitur Utama",
                student: "Fitur Peserta Didik",
                studentList: [
                    "Pencarian dan browsing kursus dengan filter lanjutan",
                    "Pembelajaran berbasis video dengan tracking progres",
                    "Kuis interaktif dan penilaian",
                    "Sertifikat digital setelah menyelesaikan kursus",
                    "Review dan rating kursus",
                    "Forum Q&A dengan instruktur",
                    "Wishlist untuk kursus favorit",
                    "Dashboard pembelajaran real-time",
                    "Manajemen profil dan password",
                    "Antarmuka responsif mobile"
                ],
                instructor: "Fitur Instruktur",
                instructorList: [
                    "Pembuatan dan manajemen kursus",
                    "Organisasi kurikulum dan konten",
                    "Upload video dan streaming",
                    "Pembuatan kuis dengan berbagai tipe pertanyaan",
                    "Tracking pendaftaran peserta",
                    "Analitik performa dan laporan",
                    "Manajemen Q&A",
                    "Monitoring review dan rating",
                    "Operasi konten massal",
                    "Preview dan publikasi kursus"
                ],
                admin: "Fitur Administrator",
                adminList: [
                    "Manajemen pengguna (operasi CRUD)",
                    "Penetapan peran (Student/Teacher/Admin)",
                    "Dashboard analitik sistem",
                    "Sinkronisasi pengguna eksternal",
                    "Operasi pengguna massal",
                    "Monitoring kesehatan sistem",
                    "Persetujuan dan moderasi kursus",
                    "Konfigurasi platform",
                    "Audit logs dan pelaporan",
                    "Akses dokumentasi sistem"
                ]
            },

            // Autentikasi
            authentication: {
                title: "Autentikasi & Otorisasi",
                mechanism: "Mekanisme Autentikasi",
                mechanismDesc: "Sistem menggunakan JWT (JSON Web Tokens) untuk autentikasi stateless. Setelah login berhasil, backend mengeluarkan access token dan refresh token yang disimpan dengan aman di browser.",
                flow: "Alur Autentikasi",
                flowSteps: [
                    "Pengguna mengirimkan kredensial (email/password)",
                    "Backend memvalidasi kredensial terhadap database",
                    "Jika valid, backend menghasilkan JWT access token (5 menit) dan refresh token (7 hari)",
                    "Token disimpan di local storage browser",
                    "Setiap permintaan API menyertakan access token di header Authorization",
                    "Backend memvalidasi token dan mengekstrak informasi pengguna",
                    "Jika access token kadaluarsa, frontend otomatis menggunakan refresh token untuk mendapatkan access token baru",
                    "Pengguna tetap login hingga refresh token kadaluarsa atau logout eksplisit"
                ],
                authorization: "Otorisasi Berbasis Peran",
                authorizationDesc: "Sistem mengimplementasikan RBAC (Role-Based Access Control) komprehensif dengan tiga peran utama:",
                roles: [
                    {
                        name: "Student (Peserta Didik)",
                        description: "Akses ke materi pembelajaran, kursus, kuis, dan dashboard pribadi"
                    },
                    {
                        name: "Teacher/Instructor",
                        description: "Semua akses student ditambah pembuatan kursus, manajemen konten, dan analitik peserta"
                    },
                    {
                        name: "Admin (Administrator)",
                        description: "Akses penuh sistem termasuk manajemen pengguna, konfigurasi sistem, dan administrasi platform"
                    }
                ],
                protection: "Proteksi Route",
                protectionDesc: "Baik frontend maupun backend mengimplementasikan proteksi dua lapis:",
                protectionLayers: [
                    "Frontend: Komponen PrivateRoute + RoleRoute memeriksa autentikasi dan peran sebelum merender halaman",
                    "Backend: Kelas permission JWTAuthentication + IsAdminUser/IsTeacher/IsStudent memvalidasi akses API"
                ]
            },

            // API
            api: {
                title: "Dokumentasi API",
                description: "Backend menyediakan RESTful API komprehensif yang didokumentasikan dengan spesifikasi Swagger/OpenAPI.",
                baseUrl: "Base URL",
                endpoints: "Grup Endpoint Utama",
                endpointsList: [
                    "/api/v1/user/ - Autentikasi pengguna dan manajemen profil",
                    "/api/v1/course/ - Operasi CRUD kursus dan browsing",
                    "/api/v1/student/ - Operasi spesifik student (enrollment, progress, wishlist)",
                    "/api/v1/teacher/ - Operasi teacher (manajemen kursus, analitik)",
                    "/api/v1/admin/ - Operasi admin (manajemen pengguna, konfigurasi sistem)"
                ],
                docs: "Dokumentasi Interaktif",
                swaggerUrl: "Swagger UI",
                redocUrl: "ReDoc UI",
                authentication: "Autentikasi API",
                authDesc: "Semua endpoint yang dilindungi memerlukan Bearer token di header Authorization:",
                authExample: "Authorization: Bearer <your_jwt_access_token>"
            },

            // Database
            database: {
                title: "Skema Database",
                description: "Database PostgreSQL dengan desain skema ternormalisasi untuk performa optimal.",
                mainModels: "Model Utama",
                modelsList: [
                    "User - Akun pengguna dengan akses berbasis peran",
                    "Profile - Informasi dan preferensi pengguna tambahan",
                    "Course - Metadata, konten, dan konfigurasi kursus",
                    "Category - Kategorisasi kursus",
                    "Teacher - Profil dan kualifikasi instruktur",
                    "CourseSection - Organisasi kurikulum",
                    "CoursePart - Unit/pelajaran pembelajaran individual",
                    "Quiz - Metadata assessment dan kuis",
                    "Question - Pertanyaan kuis dengan berbagai tipe",
                    "Answer - Opsi jawaban kuis",
                    "EnrolledCourse - Pendaftaran dan progres peserta",
                    "CompletedLesson - Tracking penyelesaian pelajaran",
                    "Review - Review dan rating kursus",
                    "Notification - Notifikasi sistem dan pengguna",
                    "Cart - Keranjang belanja untuk kursus berbayar",
                    "CartOrder - Pemrosesan pesanan dan riwayat",
                    "Certificate - Sertifikat digital",
                    "Note - Catatan dan bookmark peserta"
                ],
                relationships: "Relasi Utama",
                relationshipsList: [
                    "User → Profile (One-to-One)",
                    "User → EnrolledCourse (One-to-Many)",
                    "Teacher → Course (One-to-Many)",
                    "Course → CourseSection (One-to-Many)",
                    "CourseSection → CoursePart (One-to-Many)",
                    "Course → Quiz (One-to-Many)",
                    "Quiz → Question (One-to-Many)",
                    "Question → Answer (One-to-Many)"
                ]
            },

            // Deployment
            deployment: {
                title: "Arsitektur Deployment",
                description: "Deployment produksi di AWS EC2 menggunakan kontainerisasi Docker.",
                components: "Komponen Sistem",
                componentsList: [
                    "Container Frontend (Node + Nginx) - Melayani React SPA pada port 80/443",
                    "Container Backend (Python + Django) - Server API pada port 8000",
                    "Container PostgreSQL - Database pada port 5432",
                    "Container Redis - Caching pada port 6379",
                    "Nginx Utama (Host) - SSL termination dan reverse proxy"
                ],
                network: "Konfigurasi Jaringan",
                networkDesc: "Jaringan bridge Docker memungkinkan komunikasi antar-container. Nginx mengarahkan permintaan:",
                routes: [
                    "/ → Container Frontend (React SPA)",
                    "/api/ → Container Backend (Django API)",
                    "/admin/ → Django admin Backend",
                    "/media/ → File media statis Backend",
                    "/static/ → Aset statis Backend"
                ],
                ssl: "Konfigurasi SSL/TLS",
                sslDesc: "Let's Encrypt menyediakan sertifikat SSL gratis dengan pembaruan otomatis. Semua trafik HTTP dialihkan ke HTTPS.",
                domain: "Konfigurasi Domain",
                domainDesc: "DuckDNS menyediakan dynamic DNS: lmsetjendpdri.duckdns.org → IP Publik AWS EC2"
            },

            // Keamanan
            security: {
                title: "Keamanan Sistem",
                authentication: "Keamanan Autentikasi",
                authList: [
                    "Autentikasi stateless berbasis JWT",
                    "Hashing password aman dengan PBKDF2 Django",
                    "Validasi kekuatan password (min 8 karakter, kompleksitas wajib)",
                    "Kadaluarsa token dan refresh otomatis",
                    "Blacklisting token saat logout"
                ],
                authorization: "Keamanan Otorisasi",
                authzList: [
                    "Role-based access control (RBAC)",
                    "Kelas permission endpoint API",
                    "Proteksi route frontend",
                    "Prinsip least privilege"
                ],
                network: "Keamanan Jaringan",
                networkList: [
                    "HTTPS-only di produksi (SSL/TLS 1.2+)",
                    "Konfigurasi CORS membatasi origin yang diizinkan",
                    "Header keamanan (HSTS, X-Frame-Options, dll.)",
                    "Rate limiting pada endpoint sensitif"
                ],
                application: "Keamanan Aplikasi",
                appList: [
                    "Pencegahan SQL injection melalui Django ORM",
                    "Proteksi XSS melalui JSX escaping React",
                    "Proteksi CSRF pada operasi mengubah state",
                    "Validasi dan sanitasi input",
                    "Pembatasan dan validasi upload file",
                    "Manajemen session aman dengan Redis"
                ],
                infrastructure: "Keamanan Infrastruktur",
                infraList: [
                    "Isolasi container Docker",
                    "AWS security groups (aturan firewall)",
                    "Update keamanan dan patch reguler",
                    "Manajemen environment variable",
                    "Manajemen secrets (tidak di version control)",
                    "Pembatasan akses database"
                ]
            },

            // Peran
            roles: {
                title: "Peran & Hak Akses Pengguna",
                description: "Matriks permission detail untuk setiap peran pengguna:",
                student: "Peran Student",
                studentPerms: [
                    "✓ Browse dan cari kursus",
                    "✓ Mendaftar di kursus",
                    "✓ Menonton pelajaran video",
                    "✓ Mengikuti kuis dan penilaian",
                    "✓ Melihat progres dan sertifikat sendiri",
                    "✓ Menambahkan kursus ke wishlist",
                    "✓ Mengirim review kursus",
                    "✓ Berpartisipasi dalam Q&A",
                    "✓ Edit profil sendiri",
                    "✗ Membuat atau edit kursus",
                    "✗ Akses fungsi admin",
                    "✗ Mengelola pengguna lain"
                ],
                teacher: "Peran Teacher",
                teacherPerms: [
                    "✓ Semua permission student",
                    "✓ Membuat dan mempublikasi kursus",
                    "✓ Edit kursus sendiri",
                    "✓ Upload materi kursus",
                    "✓ Membuat kuis",
                    "✓ Melihat pendaftaran peserta",
                    "✓ Akses analitik pengajaran",
                    "✓ Mengelola Q&A untuk kursus sendiri",
                    "✓ Merespons review",
                    "✗ Edit kursus teacher lain",
                    "✗ Akses fungsi admin",
                    "✗ Mengelola pengguna"
                ],
                admin: "Peran Admin",
                adminPerms: [
                    "✓ Akses penuh sistem",
                    "✓ Manajemen pengguna (create, edit, delete)",
                    "✓ Penetapan dan modifikasi peran",
                    "✓ Moderasi dan persetujuan kursus",
                    "✓ Konfigurasi sistem",
                    "✓ Melihat analitik sistem",
                    "✓ Akses audit logs",
                    "✓ Sinkronisasi data pengguna eksternal",
                    "✓ Operasi massal",
                    "✓ Monitoring kesehatan sistem",
                    "✓ Akses dokumentasi",
                    "✓ Pengumuman platform-wide"
                ]
            },

            // Pemeliharaan
            maintenance: {
                title: "Pemeliharaan & Dukungan",
                monitoring: "Monitoring Sistem",
                monitoringDesc: "Sistem mencakup health checks dan monitoring built-in:",
                monitoringList: [
                    "Health endpoint: /api/v1/health/ - Mengembalikan status sistem",
                    "Monitoring koneksi database",
                    "Pengecekan ketersediaan Redis cache",
                    "Health checks container Docker",
                    "Agregasi log aplikasi"
                ],
                backup: "Strategi Backup",
                backupList: [
                    "Backup database otomatis harian",
                    "Backup file media ke cloud storage",
                    "Version control file konfigurasi",
                    "Rencana disaster recovery terdokumentasi"
                ],
                updates: "Prosedur Update",
                updateList: [
                    "Workflow deployment berbasis Git",
                    "Deployment zero-downtime menggunakan Docker",
                    "Migrasi database dikelola oleh Django",
                    "Testing otomatis sebelum deployment",
                    "Prosedur rollback terdokumentasi"
                ],
                support: "Sumber Daya Dukungan",
                supportList: [
                    "Dokumentasi teknis di folder /docs",
                    "Dokumentasi API di /swagger dan /redoc",
                    "Dashboard health sistem untuk admin",
                    "Error logging dan tracking",
                    "Issue tracking via GitHub"
                ],
                logs: "Manajemen Log",
                logsList: [
                    "Log aplikasi: backend/logs/",
                    "Log akses: nginx access logs",
                    "Log error: nginx error logs",
                    "Log query database (hanya development)",
                    "Log container via Docker"
                ]
            }
        }
    };

    const t = content[language];

    const handlePrint = () => {
        window.print();
    };

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <div className="admin-page-wrapper" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AdminHeader />
            
            <section className="pt-5 pb-5 modern-dashboard" style={{ flex: 1 }}>
                <div className="container">
                    {/* Header with Controls */}
                    <div className="documentation-header no-print">
                        <div className="header-content">
                            <div className="header-text">
                                <h1 className="page-title">
                                    <FaBook className="title-icon" />
                                    {t.pageTitle}
                                </h1>
                                <p className="page-subtitle">{t.pageSubtitle}</p>
                            </div>
                            <div className="header-actions">
                                <div className="language-toggle">
                                    <FaLanguage className="lang-icon" />
                                    <select 
                                        value={language} 
                                        onChange={(e) => setLanguage(e.target.value)}
                                        className="language-select"
                                    >
                                        <option value="en">English</option>
                                        <option value="id">Bahasa Indonesia</option>
                                    </select>
                                </div>
                                <button className="btn-print" onClick={handlePrint}>
                                    <FaPrint />
                                    {t.printPDF}
                                </button>
                            </div>
                        </div>
                        
                        <div className="metadata">
                            <span className="metadata-item">
                                <FaInfoCircle />
                                {t.version}: 1.0.0
                            </span>
                            <span className="metadata-item">
                                <FaCheckCircle />
                                {t.lastUpdated}: {new Date().toLocaleDateString(language === "en" ? "en-US" : "id-ID", { 
                                    year: "numeric", 
                                    month: "long", 
                                    day: "numeric" 
                                })}
                            </span>
                        </div>
                    </div>

                    {/* Main Documentation Content */}
                    <div className="documentation-content" ref={contentRef}>
                    {/* Table of Contents */}
                    <div className="toc-section no-print">
                        <h2 className="section-title">
                            <FaClipboardCheck className="section-icon" />
                            {t.tocTitle}
                        </h2>
                        <div className="toc-grid">
                            {Object.entries(t.sections).map(([key, value]) => (
                                <button
                                    key={key}
                                    className="toc-item"
                                    onClick={() => scrollToSection(key)}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 1. System Overview */}
                    <section id="overview" className="doc-section">
                        <h2 className="section-title">
                            <FaInfoCircle className="section-icon" />
                            {t.overview.title}
                        </h2>
                        <p className="section-description">{t.overview.description}</p>
                        
                        <h3 className="subsection-title">{t.overview.purpose}</h3>
                        <ul className="feature-list">
                            {t.overview.purposeItems.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.overview.systemInfo}</h3>
                        <div className="info-grid">
                            <div className="info-card">
                                <FaGlobe className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.overview.productionUrl}</strong>
                                    <span>https://lmsetjendpdri.duckdns.org</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaCode className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.overview.developmentFramework}</strong>
                                    <span>Django 4.2 + React 18.2</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaDatabase className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.overview.databaseSystem}</strong>
                                    <span>PostgreSQL 15</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaCloud className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.overview.hostingPlatform}</strong>
                                    <span>AWS EC2</span>
                                </div>
                            </div>
                            <div className="info-card success">
                                <FaCheckCircle className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.overview.projectStatus}</strong>
                                    <span>{t.overview.statusReady}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. System Architecture */}
                    <section id="architecture" className="doc-section">
                        <h2 className="section-title">
                            <FaNetworkWired className="section-icon" />
                            {t.architecture.title}
                        </h2>
                        <p className="section-description">{t.architecture.description}</p>
                        
                        <div className="architecture-layers">
                            <div className="layer-card">
                                <h4>{t.architecture.frontend}</h4>
                                <p>{t.architecture.frontendDesc}</p>
                            </div>
                            <div className="layer-card">
                                <h4>{t.architecture.backend}</h4>
                                <p>{t.architecture.backendDesc}</p>
                            </div>
                            <div className="layer-card">
                                <h4>{t.architecture.database}</h4>
                                <p>{t.architecture.databaseDesc}</p>
                            </div>
                            <div className="layer-card">
                                <h4>{t.architecture.caching}</h4>
                                <p>{t.architecture.cachingDesc}</p>
                            </div>
                            <div className="layer-card">
                                <h4>{t.architecture.proxy}</h4>
                                <p>{t.architecture.proxyDesc}</p>
                            </div>
                            <div className="layer-card">
                                <h4>{t.architecture.deployment}</h4>
                                <p>{t.architecture.deploymentDesc}</p>
                            </div>
                        </div>
                    </section>

                    {/* 3. Technology Stack */}
                    <section id="technologies" className="doc-section">
                        <h2 className="section-title">
                            <FaCog className="section-icon" />
                            {t.technologies.title}
                        </h2>
                        
                        <h3 className="subsection-title">{t.technologies.frontend}</h3>
                        <ul className="tech-list">
                            {t.technologies.frontendList.map((tech, index) => (
                                <li key={index}>{tech}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.technologies.backend}</h3>
                        <ul className="tech-list">
                            {t.technologies.backendList.map((tech, index) => (
                                <li key={index}>{tech}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.technologies.infrastructure}</h3>
                        <ul className="tech-list">
                            {t.technologies.infrastructureList.map((tech, index) => (
                                <li key={index}>{tech}</li>
                            ))}
                        </ul>
                    </section>

                    {/* 4. Core Features */}
                    <section id="features" className="doc-section">
                        <h2 className="section-title">
                            <FaUsers className="section-icon" />
                            {t.features.title}
                        </h2>
                        
                        <h3 className="subsection-title">{t.features.student}</h3>
                        <ul className="feature-list">
                            {t.features.studentList.map((feature, index) => (
                                <li key={index}>{feature}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.features.instructor}</h3>
                        <ul className="feature-list">
                            {t.features.instructorList.map((feature, index) => (
                                <li key={index}>{feature}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.features.admin}</h3>
                        <ul className="feature-list">
                            {t.features.adminList.map((feature, index) => (
                                <li key={index}>{feature}</li>
                            ))}
                        </ul>
                    </section>

                    {/* 5. Authentication & Authorization */}
                    <section id="authentication" className="doc-section">
                        <h2 className="section-title">
                            <FaLock className="section-icon" />
                            {t.authentication.title}
                        </h2>
                        
                        <h3 className="subsection-title">{t.authentication.mechanism}</h3>
                        <p>{t.authentication.mechanismDesc}</p>

                        <h3 className="subsection-title">{t.authentication.flow}</h3>
                        <ol className="flow-list">
                            {t.authentication.flowSteps.map((step, index) => (
                                <li key={index}>{step}</li>
                            ))}
                        </ol>

                        <h3 className="subsection-title">{t.authentication.authorization}</h3>
                        <p>{t.authentication.authorizationDesc}</p>
                        <div className="role-cards">
                            {t.authentication.roles.map((role, index) => (
                                <div key={index} className="role-card">
                                    <FaUserShield className="role-icon" />
                                    <h4>{role.name}</h4>
                                    <p>{role.description}</p>
                                </div>
                            ))}
                        </div>

                        <h3 className="subsection-title">{t.authentication.protection}</h3>
                        <p>{t.authentication.protectionDesc}</p>
                        <ul className="tech-list">
                            {t.authentication.protectionLayers.map((layer, index) => (
                                <li key={index}>{layer}</li>
                            ))}
                        </ul>
                    </section>

                    {/* 6. API Documentation */}
                    <section id="api" className="doc-section">
                        <h2 className="section-title">
                            <FaCode className="section-icon" />
                            {t.api.title}
                        </h2>
                        <p className="section-description">{t.api.description}</p>
                        
                        <h3 className="subsection-title">{t.api.baseUrl}</h3>
                        <div className="code-block">
                            https://lmsetjendpdri.duckdns.org/api/v1/
                        </div>

                        <h3 className="subsection-title">{t.api.endpoints}</h3>
                        <ul className="tech-list">
                            {t.api.endpointsList.map((endpoint, index) => (
                                <li key={index}>{endpoint}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.api.docs}</h3>
                        <div className="info-grid">
                            <div className="info-card">
                                <FaBook className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.api.swaggerUrl}</strong>
                                    <span>/swagger/</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaBook className="info-icon" />
                                <div className="info-content">
                                    <strong>{t.api.redocUrl}</strong>
                                    <span>/redoc/</span>
                                </div>
                            </div>
                        </div>

                        <h3 className="subsection-title">{t.api.authentication}</h3>
                        <p>{t.api.authDesc}</p>
                        <div className="code-block">
                            {t.api.authExample}
                        </div>
                    </section>

                    {/* 7. Database Schema */}
                    <section id="database" className="doc-section">
                        <h2 className="section-title">
                            <FaDatabase className="section-icon" />
                            {t.database.title}
                        </h2>
                        <p className="section-description">{t.database.description}</p>
                        
                        <h3 className="subsection-title">{t.database.mainModels}</h3>
                        <ul className="tech-list">
                            {t.database.modelsList.map((model, index) => (
                                <li key={index}>{model}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.database.relationships}</h3>
                        <ul className="tech-list">
                            {t.database.relationshipsList.map((rel, index) => (
                                <li key={index}>{rel}</li>
                            ))}
                        </ul>
                    </section>

                    {/* 8. Deployment Architecture */}
                    <section id="deployment" className="doc-section">
                        <h2 className="section-title">
                            <FaDocker className="section-icon" />
                            {t.deployment.title}
                        </h2>
                        <p className="section-description">{t.deployment.description}</p>
                        
                        <h3 className="subsection-title">{t.deployment.components}</h3>
                        <ul className="tech-list">
                            {t.deployment.componentsList.map((component, index) => (
                                <li key={index}>{component}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.deployment.network}</h3>
                        <p>{t.deployment.networkDesc}</p>
                        <ul className="tech-list">
                            {t.deployment.routes.map((route, index) => (
                                <li key={index}>{route}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.deployment.ssl}</h3>
                        <p>{t.deployment.sslDesc}</p>

                        <h3 className="subsection-title">{t.deployment.domain}</h3>
                        <p>{t.deployment.domainDesc}</p>
                    </section>

                    {/* 9. Security Measures */}
                    <section id="security" className="doc-section">
                        <h2 className="section-title">
                            <FaShieldAlt className="section-icon" />
                            {t.security.title}
                        </h2>
                        
                        <h3 className="subsection-title">{t.security.authentication}</h3>
                        <ul className="security-list">
                            {t.security.authList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.security.authorization}</h3>
                        <ul className="security-list">
                            {t.security.authzList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.security.network}</h3>
                        <ul className="security-list">
                            {t.security.networkList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.security.application}</h3>
                        <ul className="security-list">
                            {t.security.appList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.security.infrastructure}</h3>
                        <ul className="security-list">
                            {t.security.infraList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    {/* 10. User Roles & Permissions */}
                    <section id="roles" className="doc-section">
                        <h2 className="section-title">
                            <FaKey className="section-icon" />
                            {t.roles.title}
                        </h2>
                        <p className="section-description">{t.roles.description}</p>
                        
                        <h3 className="subsection-title">{t.roles.student}</h3>
                        <ul className="permission-list">
                            {t.roles.studentPerms.map((perm, index) => (
                                <li key={index} className={perm.startsWith("✓") ? "allowed" : "denied"}>
                                    {perm}
                                </li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.roles.teacher}</h3>
                        <ul className="permission-list">
                            {t.roles.teacherPerms.map((perm, index) => (
                                <li key={index} className={perm.startsWith("✓") ? "allowed" : "denied"}>
                                    {perm}
                                </li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.roles.admin}</h3>
                        <ul className="permission-list">
                            {t.roles.adminPerms.map((perm, index) => (
                                <li key={index} className={perm.startsWith("✓") ? "allowed" : "denied"}>
                                    {perm}
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* 11. Maintenance & Support */}
                    <section id="maintenance" className="doc-section">
                        <h2 className="section-title">
                            <FaChartLine className="section-icon" />
                            {t.maintenance.title}
                        </h2>
                        
                        <h3 className="subsection-title">{t.maintenance.monitoring}</h3>
                        <p>{t.maintenance.monitoringDesc}</p>
                        <ul className="tech-list">
                            {t.maintenance.monitoringList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.maintenance.backup}</h3>
                        <ul className="tech-list">
                            {t.maintenance.backupList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.maintenance.updates}</h3>
                        <ul className="tech-list">
                            {t.maintenance.updateList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.maintenance.support}</h3>
                        <ul className="tech-list">
                            {t.maintenance.supportList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>

                        <h3 className="subsection-title">{t.maintenance.logs}</h3>
                        <ul className="tech-list">
                            {t.maintenance.logsList.map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </section>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

export default SystemDocumentation;
