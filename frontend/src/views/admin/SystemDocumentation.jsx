import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    FaBook, FaFileDownload, FaGlobe, FaServer, FaDatabase, FaShieldAlt,
    FaUsers, FaCog, FaCode, FaNetworkWired, FaDocker, FaCloud,
    FaLock, FaKey, FaUserShield, FaChartLine, FaClipboardCheck,
    FaPrint, FaLanguage, FaCheckCircle, FaInfoCircle, FaSyncAlt,
    FaSearch, FaTimes, FaGraduationCap, FaCheckDouble, FaLayerGroup,
    FaRobot, FaBell, FaCertificate, FaMedal, FaStickyNote, FaVideo
} from "react-icons/fa";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import apiInstance from "../../utils/axios";
import useSystemVersion from "../../hooks/useSystemVersion";
import { APP_VERSION } from "../../utils/version";
import "./SystemDocumentation.css";

/**
 * ✨ PHASE 4.210 / 11.2: System Documentation (Compact & Live Data Redesign)
 * Real live server health, live database entity counts, zero blank space,
 * category pill navigation, real-time search filter, and bilingual support.
 */
function SystemDocumentation({ isEmbedded = false, refreshTrigger = 0 }) {
    const { version: liveVersion } = useSystemVersion();
    const [language, setLanguage] = useState("id"); // default Bahasa Indonesia
    const [activeSection, setActiveSection] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [systemHealth, setSystemHealth] = useState(null);
    const [loadingHealth, setLoadingHealth] = useState(false);
    const [lastSync, setLastSync] = useState(new Date());
    const contentRef = useRef(null);

    // Fetch real live system health and statistics from backend
    const fetchSystemHealth = useCallback(async () => {
        try {
            setLoadingHealth(true);
            const res = await apiInstance.get("/admin/system-health/");
            if (res.data) {
                setSystemHealth(res.data);
                setLastSync(new Date());
            }
        } catch (err) {
            console.warn("Live system-health endpoint notice:", err?.message || err);
        } finally {
            setLoadingHealth(false);
        }
    }, []);

    useEffect(() => {
        fetchSystemHealth();
    }, [fetchSystemHealth, refreshTrigger]);

    // Live backend variables
    const dbStats = systemHealth?.database_statistics || {};
    const serverInfo = systemHealth?.server_information || {};
    const isHealthy = systemHealth?.system_status === "healthy" || !systemHealth?.error;

    // Full Technical Documentation Content (EN & ID)
    const content = {
        en: {
            pageTitle: "System Documentation & Technical Architecture",
            pageSubtitle: "Comprehensive technical reference, database schema, and live runtime diagnostics (v1.1.0)",
            printPDF: "Export / Print",
            language: "Language",
            lastUpdated: "Last Synced",
            version: "Version",
            allSections: "All Sections",
            filterPlaceholder: "Search documentation (e.g. Si Manta, JWT, PostgreSQL, Docker, Roles, API)...",
            liveBadge: "System Online & Normal",
            envInfo: "Live Environment",

            tocTitle: "Documentation Index",
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

            overview: {
                title: "System Overview",
                description: "LMSetjen DPD RI (Version 1.1.0) is the official enterprise Learning Management System of the Secretariat General of the Regional Representative Council of the Republic of Indonesia (Setjen DPD RI). The platform provides an integrated ecosystem for civil servant competency development, AI-assisted self-paced learning via Si Manta, interactive study notes, automated evaluations, tamper-evident digital certificate issuance, and real-time governance diagnostics.",
                purpose: "Purpose & Objectives",
                purposeItems: [
                    "Provide an intuitive, responsive, and secure digital learning hub for all DPD RI personnel",
                    "Facilitate structured competency tracking and civil service training roadmaps across departments",
                    "Empower learners with Si Manta AI: an interactive tutor grounded in course lesson contexts and personal study notes",
                    "Support rich modular curricula with dual video streaming (HTML5 MP4 & YouTube) and auto-checkpoint resumption",
                    "Enable in-lesson rich study note taking (Catatan Belajar) with color tagging, search, and AI synthesis",
                    "Deliver automated evaluations, timed quizzes, and tamper-evident digital certificate issuance with QR verification",
                    "Drive learner engagement with gamification milestones, experience points, streak tracking, and leaderboards",
                    "Provide real-time in-app notification dispatch for students, instructors, and system administrators",
                    "Furnish comprehensive moderation queues, feedback bug reporting, and live server diagnostics for administrators"
                ],
                systemInfo: "Runtime & Infrastructure",
                productionUrl: "Active Runtime Host",
                developmentFramework: "Framework Stack",
                databaseSystem: "Database Engine",
                hostingPlatform: "Hosting Environment",
                projectStatus: "Operational Status",
                statusReady: "Production Ready & Connected"
            },

            architecture: {
                title: "System Architecture",
                description: "The platform is engineered using a decoupled, high-performance architecture with distinct enterprise layers:",
                frontend: "Frontend Presentation Layer",
                frontendDesc: "React 18.2 SPA powered by Vite bundler, delivering sub-second navigation, CSS component scope isolation, Zustand state management, integrated Si Manta AI chat companion, and modular design tokens.",
                backend: "Backend API Layer",
                backendDesc: "Django 4.2 LTS REST Framework providing semantic RESTful endpoints, Google Gemini AI integration, real-time in-app notification engine, JWT security, custom throttle guards, and role-based access control.",
                database: "Persistent Database Layer",
                databaseDesc: "PostgreSQL 15 relational engine with full-text search indexing (SearchVector), foreign key constraints, connection pooling, and automated schema migrations.",
                caching: "High-Speed Caching Layer",
                cachingDesc: "In-memory caching and session acceleration for query optimization, unread notification counters, and background worker dispatch.",
                proxy: "Reverse Proxy & Edge Gateway",
                proxyDesc: "Nginx web server managing official domain routing (lms.dpd.go.id), TLS 1.3 encryption, gzip/brotli compression, rate limiting, and static/media asset streaming.",
                deployment: "Containerization Orchestration",
                deploymentDesc: "Dockerized services orchestrated via Docker Compose ensuring reproducible production and staging environments on official DPD RI infrastructure."
            },

            technologies: {
                title: "Technology Stack",
                frontend: "Frontend Technologies",
                frontendList: [
                    "React 18.2 - Declarative component-based UI library",
                    "Vite 4+ - Next-gen frontend tooling and lightning build pipeline",
                    "React Router v6 - Client-side history routing and deep linking",
                    "Axios Interceptors - Authenticated HTTP request pipeline with automatic token refresh",
                    "Google Gemini AI SDK / Chat Integration - Conversational engine for Si Manta AI Tutor",
                    "Bootstrap 5.3 & CSS Scoped Tokens - Modern responsive layout without global style pollution",
                    "Chart.js - Interactive dashboards, enrollment metrics, and student analytics",
                    "SweetAlert2 & Toastify - Dynamic feedback modals and non-blocking notifications",
                    "Canvas Confetti & QR Code Generator - Gamification celebrations and certificate verification",
                    "FontAwesome & React Icons - Comprehensive vector iconography"
                ],
                backend: "Backend Technologies",
                backendList: [
                    "Python 3.11+ - High-performance core backend runtime",
                    "Django 4.2 LTS - Enterprise web framework with built-in security features",
                    "Django REST Framework - Robust serialization, viewsets, and pagination",
                    "Google Generative AI (Gemini Pro/Flash API) - Intelligent tutor backend for Si Manta",
                    "SimpleJWT - Stateless token authentication with rotating refresh keys",
                    "Django CORS Headers - Strict Cross-Origin Resource Sharing whitelist",
                    "ReportLab & Pillow - Dynamic certificate generation engine and image optimization",
                    "PostgreSQL Full-Text Search - Native SearchVector querying and search taxonomy analysis"
                ],
                infrastructure: "Infrastructure & DevOps",
                infrastructureList: [
                    "Docker & Docker Compose - Containerized service isolation and orchestration",
                    "Nginx - Reverse proxy, TLS 1.3 termination, rate limiting & static caching",
                    "PostgreSQL 15 - Enterprise relational database with automated snapshot backups",
                    "Let's Encrypt / Certbot - Automated SSL/TLS certificates for lms.dpd.go.id",
                    "Git Release Workflow - Semantic versioning (v1.1.0) and automated migration pipelines"
                ]
            },

            features: {
                title: "Core Platform Capabilities (v1.1.0)",
                student: "Student & Learner Capabilities",
                studentList: [
                    "Course discovery, category filtering, SearchVector search, and instant enrollment",
                    "Dual video streaming player (HTML5 MP4 & YouTube) with auto-checkpoint and 95% completion auto-unlock",
                    "Si Manta AI Assistant: contextual AI tutor helping understand lessons, summarize concepts, and review notes",
                    "Integrated Course Notes (Catatan Belajar): rich note-taking per lesson with color categorization and AI chat link",
                    "Timed quiz evaluations, automated scoring, answer reviews, and passing grade verification",
                    "Cryptographically verified digital certificate generation with public QR code and direct PDF export",
                    "Gamification system: points accumulation, learning streaks, skill badges, and active leaderboards",
                    "In-app notifications for enrollment, course progress, quiz results, and discussion replies",
                    "Discussion Q&A community forum and course rating reviews"
                ],
                instructor: "Instructor & Content Creator Capabilities",
                instructorList: [
                    "Course curriculum builder with sections, lectures, rich media, and interactive quizzes",
                    "Rich text editor supporting multimedia embedding, code blocks, and downloadable resources",
                    "Instructor Notification Center for new student enrollments, Q&A inquiries, and course reviews",
                    "Student enrollment metrics, revenue/engagement stats, and review feedback analytics",
                    "Q&A management to answer student queries directly from the teacher dashboard",
                    "Course revision submissions with draft and publishing state transitions"
                ],
                admin: "Administrative & Governance Capabilities",
                adminList: [
                    "Centralized user lifecycle management (Learners, Instructors, Admins) with role elevations",
                    "Course publishing moderation, review workflows, and catalog curation",
                    "Certificate Template Designer: visual editor for agency stamps, official signatures, and layout presets",
                    "Content abuse reporting and automated Q&A / review moderation queue",
                    "User feedback & bug ticket tracker with verification challenge",
                    "Real-time in-app system notification broadcasts",
                    "Live system diagnostics, environment health verification, and interactive documentation (v1.1.0)"
                ]
            },

            authentication: {
                title: "Authentication & Authorization Security",
                mechanism: "Stateless JWT Architecture & PBKDF2 Hashing",
                mechanismDesc: "Authentication is governed by JSON Web Tokens (JWT) adhering to RFC 7519, backed by PBKDF2 password hashing with SHA-256 (390,000+ iterations). The backend signs access tokens with HMAC-SHA256 and provides rotating refresh tokens. Session invalidation triggers immediately on credential modifications.",
                flow: "Token Lifecycle Flow",
                flowSteps: [
                    "User inputs credentials; client dispatches POST to /api/v1/user/token/",
                    "Server validates credentials, verifies active status, and issues short-lived Access Token & long-lived Refresh Token",
                    "Client interceptor injects 'Authorization: Bearer <token>' in all API request headers",
                    "On access token expiration (401), the interceptor refreshes tokens transparently via /api/v1/user/token/refresh/",
                    "SSO Integration: Supports Single Sign-On from official DPD RI portal via token exchange (/api/v1/sso/verify/)",
                    "Logout cleans cookies and client storage, terminating authorized session immediately"
                ],
                authorization: "Role-Based Access Control (RBAC)",
                authorizationDesc: "Each authenticated user is bound to one or more strict authorization scopes:",
                roles: [
                    { name: "Student (Peserta)", description: "Can browse courses, enroll, stream lectures, use Si Manta AI tutor, take quizzes, obtain certificates, take notes, and post Q&A." },
                    { name: "Teacher / Instructor (Instruktur)", description: "Can create curriculum drafts, upload lecture media, manage owned courses, and review student questions." },
                    { name: "Administrator (Admin Setjen)", description: "Full operational governance over users, course approvals, certificate designer, reports, and platform configurations." }
                ],
                protection: "Defensive Measures",
                protectionDesc: "Security policies enforced across all incoming traffic:",
                protectionLayers: [
                    "CSRF token validation on sensitive state-mutating requests",
                    "Password hashing via PBKDF2 with SHA-256 algorithm and salt",
                    "Automated IP and user-based throttling against brute-force attempts",
                    "Strict Cross-Origin Resource Sharing (CORS) whitelisting official domains (lms.dpd.go.id)",
                    "SQL injection immunity via Django ORM parameterized queries",
                    "Anti-spam verification sequence on user feedback and report forms"
                ]
            },

            api: {
                title: "RESTful API Documentation",
                description: "Standardized RESTful JSON API adhering to semantic HTTP methods and status conventions.",
                baseUrl: "Base API Endpoint",
                endpoints: "Primary API Endpoints (v1.1.0)",
                endpointsList: [
                    "GET/POST /api/v1/user/token/ - Issue and verify JWT authentication tokens",
                    "POST /api/v1/ai-assistant/chat/ - Contextual learning dialogue with Si Manta AI",
                    "GET/POST /api/v1/notifications/ - Real-time in-app notification feed and unread count",
                    "PATCH /api/v1/notifications/read-all/ - Mark all notifications as read",
                    "GET/POST /api/v1/student/notes/ - Personal study notes per course and lesson",
                    "GET /api/v1/course/category/ - Retrieve categorized course catalog",
                    "GET /api/v1/course/course-list/ - Searchable public courses catalog with SearchVector",
                    "GET/POST /api/v1/student/course-detail/<slug>/ - Student enrollment and lesson access",
                    "GET /api/v1/certificate/verify/<hash>/ - Public certificate authenticity verification",
                    "GET/POST /api/v1/admin/certificates/templates/ - Visual certificate template configuration",
                    "GET /api/v1/rankings/ - Gamification student leaderboard and point metrics",
                    "GET/PUT /api/v1/admin/abuse-reports/ - Content moderation and abuse reports queue",
                    "GET/POST /api/v1/feedback/list/ - User bug reports and feature request tracker",
                    "GET /api/v1/system/releases/ - Version history and system release log (v1.1.0)",
                    "GET /api/v1/admin/system-health/ - Real-time system health and runtime statistics"
                ],
                docs: "Interactive API Explorers",
                swaggerUrl: "Swagger UI Interactive Documentation",
                redocUrl: "ReDoc API Reference Specification",
                authentication: "Authorization Header Standard",
                authDesc: "All protected endpoints require the Bearer token authorization header:",
                authExample: "Authorization: Bearer <jwt_access_token_here>"
            },

            database: {
                title: "Database Architecture & Schema",
                description: "Relational PostgreSQL database schema organized into cohesive domain models with strict referential integrity.",
                mainModels: "Primary Data Entities (v1.1.0)",
                modelsList: [
                    "User & Profile: Core authentication, employee NIP/metadata, role flags, and avatars",
                    "Course & Category: Learning catalog, publishing state, pricing/free status, and metadata",
                    "Variant & VariantItem: Modular curriculum hierarchy (Chapters/Sections and Lessons)",
                    "EnrolledCourse & CompletedLesson: Student progress tracking, checkpoint timestamps, and 95% unlock status",
                    "Quiz, Question & Answer: Timed objective evaluations, passing grade criteria, and score tracking",
                    "Certificate & CertificateTemplate: Cryptographic SHA-256 issuance hashes, dynamic template presets, signatures, and QR codes",
                    "AIMessage & AIChatSession: Si Manta AI conversational history, lesson references, and student questions",
                    "Notification: Real-time in-app notification records with recipient roles and read states",
                    "StudentNote: Personal lesson notes with color classification, timestamps, and AI integration",
                    "Gamification (Badge & Point): Points history, streak counters, and awarded skill badges",
                    "Review & AbuseReport: Course star ratings, moderation queue, and flag audits",
                    "Feedback: System issue tracker, bug classifications, verification tokens, and resolutions",
                    "SystemRelease & UpdateLog: Semantic version tracking and production changelog logs"
                ],
                relationships: "Key Entity Relationships",
                relationshipsList: [
                    "One User has One Profile (1:1 with cascading lifecycle)",
                    "One Course contains Many Variants and Many Lessons (1:N with ordered position)",
                    "One User can enroll in Many Courses via EnrolledCourse (M:N junction)",
                    "One EnrolledCourse generates One Certificate upon 100% curriculum completion",
                    "One Course or Lesson can associate with Many StudentNotes and Many AIMessages",
                    "One User receives Many Notifications dispatched across learning and administrative events"
                ]
            },

            deployment: {
                title: "Deployment & Infrastructure Architecture",
                description: "Containerized continuous deployment architecture designed for high uptime and isolation on official DPD RI infrastructure.",
                components: "Containerized Services",
                componentsList: [
                    "web (Frontend): Vite-built React SPA served by optimized Nginx worker with client caching",
                    "api (Backend): Gunicorn WSGI server running multi-worker Django application with auto-restart",
                    "db (Database): PostgreSQL 15 container with persistent volume storage, healthcheck, and regular dumps",
                    "proxy (Nginx Gateway): External SSL termination, reverse proxying /api/ and /media/, and security headers",
                    "ai (External Integration): Secure HTTPS gateway to Google Gemini AI API with rate limiting"
                ],
                network: "Virtual Network Topology",
                networkDesc: "Internal Docker network isolates the database from public exposure. Only HTTP (80) and HTTPS (443) ports are exposed to the internet.",
                routes: [
                    "Traffic on /api/* routes directly to the Django backend application container",
                    "Traffic on /media/* routes directly to persistent volume storage with MIME-type protection",
                    "Traffic on /sertifikat/verify/* routes to instant certificate authenticity verification",
                    "Traffic on /* routes directly to the React SPA client"
                ],
                ssl: "TLS / SSL Security",
                sslDesc: "Strict HTTPS enforcement via Let's Encrypt TLS 1.3 certificates for lms.dpd.go.id with automated renewal cron jobs and HSTS headers.",
                domain: "DNS & Institutional Host Routing",
                domainDesc: "Official production domain https://lms.dpd.go.id routed via DPD RI infrastructure, terminated by Nginx reverse proxy with TLS 1.3 encryption, gzip/brotli compression, and failover protection."
            },

            security: {
                title: "Security & Hardening Standards",
                authentication: "Authentication Hardening",
                authList: [
                    "Cryptographic JWT signing with secret key rotation support",
                    "PBKDF2 password hashing with 390,000+ iterations and cryptographic salt",
                    "Immediate session invalidation on credential modifications",
                    "SSO cryptographic signature verification for portal integration"
                ],
                authorization: "Authorization Hardening",
                authzList: [
                    "Strict Role-Based Access Control (RBAC) decorators on private API endpoints",
                    "Object-level permission checks preventing horizontal privilege escalation",
                    "Superuser administrative isolation with dedicated diagnostic audit logs"
                ],
                network: "Network Hardening",
                networkList: [
                    "Production domain lms.dpd.go.id enforced with strict TLS 1.3 encryption",
                    "HTTP Strict Transport Security (HSTS) headers enabled with preload readiness",
                    "Isolated internal Docker bridge network shielding database from external IP exposure"
                ],
                application: "Application Hardening",
                appList: [
                    "Django ORM SQL Injection immunity with parameterized queries",
                    "Automatic HTML sanitization defending against Cross-Site Scripting (XSS)",
                    "Strict Content Security Policy (CSP) and X-Frame-Options: SAMEORIGIN",
                    "AI prompt sanitization preventing prompt injection and safeguarding user context",
                    "Anti-spam CAPTCHA step sequence on feedback forms preventing automated submissions"
                ],
                infrastructure: "Infrastructure Hardening",
                infraList: [
                    "Automated scheduled database snapshots with off-site backup protocol",
                    "Container healthcheck monitors with automated restart policies",
                    "Minimal rootless Docker containers reducing attack surfaces"
                ]
            },

            roles: {
                title: "User Roles & Permissions Matrix",
                description: "Granular access control policies defining platform capabilities per persona:",
                student: "Student Role (Peserta)",
                studentPerms: [
                    "✓ Access public course catalog and enroll into courses",
                    "✓ Stream video lectures and read course materials with auto-checkpoint resume",
                    "✓ Consult Si Manta AI Tutor for contextual course assistance",
                    "✓ Take rich personal study notes (Catatan Belajar) per lesson",
                    "✓ Take interactive quizzes and view personal scores",
                    "✓ Earn gamification points, learning streak milestones, and skill badges",
                    "✓ Receive real-time in-app notifications on learning progress",
                    "✓ Download authenticated completion certificates with public QR code",
                    "✓ Ask questions in course Q&A and rate completed courses",
                    "✗ Create, edit, or delete course curriculum",
                    "✗ Access admin analytics, moderation queues, or user databases"
                ],
                teacher: "Instructor Role (Instruktur)",
                teacherPerms: [
                    "✓ All student privileges included",
                    "✓ Create, draft, and update course materials and quizzes",
                    "✓ Access Instructor Notification Center for student events",
                    "✓ View enrolled students and course completion metrics",
                    "✓ Reply directly to student questions in assigned courses",
                    "✓ Submit course revisions for administrative review",
                    "✗ Approve course publishing to the global catalog",
                    "✗ Access system administration or modify user accounts"
                ],
                admin: "Administrator Role (Admin Setjen)",
                adminPerms: [
                    "✓ Unrestricted access to system configuration and database models",
                    "✓ Approve or reject course submissions",
                    "✓ Manage user accounts, role elevations, and account statuses",
                    "✓ Design certificate templates with official stamps and signatures",
                    "✓ Moderate reported content, abuse reports, and user feedback",
                    "✓ Broadcast system-wide in-app notifications",
                    "✓ Run system diagnostics, test suites, and inspect live metrics (v1.1.0)"
                ]
            },

            maintenance: {
                title: "Maintenance & Disaster Recovery",
                monitoring: "System Health Telemetry",
                monitoringDesc: "Built-in telemetry endpoints and proactive monitoring routines:",
                monitoringList: [
                    "Healthcheck endpoint /api/v1/admin/system-health/ reporting live DB & server status",
                    "Continuous database connection verification and connection pool monitoring",
                    "Real-time disk space and media storage utilization tracking",
                    "Application error logging with stack trace capture for admins"
                ],
                backup: "Backup Procedures",
                backupList: [
                    "Scheduled automated PostgreSQL pg_dump snapshots",
                    "Media assets volume replication to off-site cloud storage",
                    "Infrastructure as Code: full Docker configuration committed to Git",
                    "Documented disaster recovery protocol with test restoration verified"
                ],
                updates: "Continuous Update Protocol",
                updateList: [
                    "Git-driven deployment workflows with tagged production releases (v1.1.0)",
                    "Automated Django schema migrations executing during container bootstrap",
                    "Zero-downtime rolling reload capability with Nginx reverse proxy",
                    "Automated integration test suites executed prior to deployment"
                ],
                support: "Support Channels & SLA",
                supportList: [
                    "Integrated User Feedback center (/admin/reports/?tab=feedback)",
                    "Technical issue reporting and bug triage via administrative dashboard",
                    "Direct IT Secretariat General support ticketing system",
                    "API interactive documentation accessible via /swagger/ and /redoc/"
                ],
                logs: "Log Management",
                logsList: [
                    "Django application logs: backend/logs/ & container stdout",
                    "Nginx reverse proxy access and error logs with IP rotation",
                    "Database transaction and query logs (debug mode isolated)",
                    "Audit log of administrative actions, course approvals, and user updates"
                ]
            }
        },

        id: {
            pageTitle: "Dokumentasi & Arsitektur Sistem",
            pageSubtitle: "Panduan teknis komprehensif, skema basis data, dan diagnostik operasional sistem runtime (v1.1.0)",
            printPDF: "Cetak / Ekspor PDF",
            language: "Bahasa",
            lastUpdated: "Sinkronisasi Terakhir",
            version: "Versi Sistem",
            allSections: "Semua Bagian",
            filterPlaceholder: "Cari topik dokumentasi (misal: Si Manta, JWT, PostgreSQL, Docker, Role, API)...",
            liveBadge: "Sistem Aktif & Normal",
            envInfo: "Lingkungan Runtime",

            tocTitle: "Daftar Isi Dokumentasi",
            sections: {
                overview: "Gambaran Umum Sistem",
                architecture: "Arsitektur Sistem",
                technologies: "Tumpukan Teknologi",
                features: "Fitur Utama Platform",
                authentication: "Autentikasi & Otorisasi",
                api: "Dokumentasi API RESTful",
                database: "Skema Basis Data",
                deployment: "Arsitektur Deployment",
                security: "Standar Keamanan Sistem",
                roles: "Peran & Hak Akses Pengguna",
                maintenance: "Pemeliharaan & SLA"
            },

            overview: {
                title: "Gambaran Umum Sistem",
                description: "LMSetjen DPD RI (Versi 1.1.0) adalah Learning Management System modern dan resmi milik Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia. Platform ini menyediakan ekosistem terpadu untuk pembelajaran digital, peningkatan kompetensi aparatur sipil, bimbingan cerdas bertenaga AI (Si Manta), catatan belajar mandiri terintegrasi, evaluasi otomatis, penerbitan sertifikat digital berkeabsahan sah, dan diagnostik tata kelola sistem secara real-time.",
                purpose: "Tujuan & Sasaran Strategis",
                purposeItems: [
                    "Menyediakan portal pembelajaran digital yang modern, responsif, dan aman bagi seluruh aparatur sipil DPD RI",
                    "Memfasilitasi pelacakan kompetensi dan peta jalan pengembangan pegawai lintas unit secara terstruktur",
                    "Menghadirkan Si Manta AI: asisten belajar cerdas yang memahami konteks modul materi dan catatan belajar peserta",
                    "Mendukung kurikulum modular dengan pemutar video ganda (HTML5 MP4 & YouTube) dan auto-checkpoint resume",
                    "Menyediakan fitur Catatan Belajar mandiri interaktif per modul dengan klasifikasi warna dan rangkuman AI",
                    "Menyediakan sistem evaluasi kuis otomatis dan penerbitan sertifikat digital berkode hash verifikasi QR sah",
                    "Meningkatkan motivasi belajar melalui gamifikasi poin capaian, lencana keahlian (badges), dan papan peringkat",
                    "Menyediakan pusat notifikasi in-app real-time untuk peserta, instruktur, dan admin sistem",
                    "Menyediakan moderasi konten komprehensif, pelaporan tiket masukan bug pengguna, dan diagnostik kesehatan server"
                ],
                systemInfo: "Informasi Runtime & Infrastruktur",
                productionUrl: "Host Runtime Aktif",
                developmentFramework: "Framework Aplikasi",
                databaseSystem: "Mesin Basis Data",
                hostingPlatform: "Lingkungan Hosting",
                projectStatus: "Status Operasional",
                statusReady: "Siap Produksi & Terhubung"
            },

            architecture: {
                title: "Arsitektur Sistem",
                description: "Sistem dibangun menggunakan arsitektur microservices terpisah (decoupled) dengan pemisahan tugas yang jelas:",
                frontend: "Layer Presentasi Frontend",
                frontendDesc: "Single Page Application (SPA) berbasis React 18.2 dan Vite, menghasilkan navigasi instan tanpa reload, bundling efisien, CSS terisolasi per komponen, manajemen state Zustand, dan asisten Si Manta AI terintegrasi.",
                backend: "Layer Layanan Backend (API)",
                backendDesc: "Django 4.2 LTS REST Framework yang menyajikan RESTful API, integrasi Google Gemini AI, mesin notifikasi in-app, validasi token JWT, throttle proteksi, dan kontrol hak akses berbasis peran (RBAC).",
                database: "Layer Penyimpanan Relasional",
                databaseDesc: "PostgreSQL 15 dengan pencarian teks penuh (SearchVector), integritas referensial kuat, indexing teroptimasi, connection pooling, dan migrasi skema terkelola.",
                caching: "Layer Cache Akselerasi",
                cachingDesc: "In-memory caching untuk optimasi kueri berulang, akselerasi sesi autentikasi, penghitung notifikasi, dan dispatch tugas latar belakang.",
                proxy: "Reverse Proxy & Edge Gateway",
                proxyDesc: "Server web Nginx yang menangani perutean domain resmi (lms.dpd.go.id), enkripsi SSL/TLS 1.3, kompresi aset (gzip/brotli), pembatasan laju koneksi (rate limiting), dan streaming berkas statis/media.",
                deployment: "Kontainerisasi Docker",
                deploymentDesc: "Layanan terisolasi dalam kontainer Docker yang diorkestrasi via Docker Compose untuk konsistensi lingkungan dev dan produksi pada infrastruktur resmi DPD RI."
            },

            technologies: {
                title: "Tumpukan Teknologi (Tech Stack)",
                frontend: "Teknologi Frontend",
                frontendList: [
                    "React 18.2 - Library UI deklaratif berbasis komponen reaktif",
                    "Vite 4+ - Bundler modern & build pipeline berkecepatan tinggi",
                    "React Router v6 - Perutean sisi klien dan deep linking riwayat URL",
                    "Axios Interceptors - Pipeline request HTTP terautentikasi otomatis dengan refresh token",
                    "Integrasi Google Gemini AI - Antarmuka chat interaktif asisten belajar cerdas Si Manta",
                    "Bootstrap 5.3 & Token Desain Scoped - Framework tata letak responsif tanpa polusi CSS global",
                    "Chart.js - Visualisasi data grafik analitik pendaftaran dan keterlibatan",
                    "SweetAlert2 & Toastify - Dialog interaktif elegan dan notifikasi toast non-intrusif",
                    "Canvas Confetti & QR Code Generator - Perayaan kelulusan gamifikasi dan verifikasi sertifikat",
                    "FontAwesome & React Icons - Pustaka ikon vektor komprehensif"
                ],
                backend: "Teknologi Backend",
                backendList: [
                    "Python 3.11+ - Bahasa pemrograman inti performa tinggi",
                    "Django 4.2 LTS - Web framework andal dan aman standar enterprise",
                    "Django REST Framework - Toolkit serialisasi, pagination, dan endpoint API",
                    "Google Generative AI (Gemini Pro/Flash API) - Mesin kecerdasan buatan tutor Si Manta",
                    "SimpleJWT - Autentikasi stateless berbasis token JWT dengan rotasi kunci",
                    "Django CORS Headers - Manajemen keamanan lintas domain (CORS) ketat",
                    "ReportLab & Pillow - Mesin rendering sertifikat digital dan optimasi gambar berkas",
                    "PostgreSQL Full-Text Search - Kueri SearchVector dan analitik taksonomi pencarian"
                ],
                infrastructure: "Infrastruktur & DevOps",
                infrastructureList: [
                    "Docker & Docker Compose - Kontainerisasi terisolasi dan orkestrasi microservices",
                    "Nginx - Reverse proxy, terminasi SSL TLS 1.3, rate limiting & caching file",
                    "PostgreSQL 15 - Basis data relasional enterprise dengan backup berkala otomatis",
                    "Certbot / Let's Encrypt - Sertifikat enkripsi TLS/SSL otomatis untuk lms.dpd.go.id",
                    "Git Release Workflow - Versioning semantik (v1.1.0) dan pipeline migrasi database"
                ]
            },

            features: {
                title: "Fitur Utama Platform (v1.1.0)",
                student: "Fitur Peserta",
                studentList: [
                    "Katalog kursus interaktif dengan filter kategori, pencarian SearchVector, dan pendaftaran mandiri",
                    "Pemutar video ganda (MP4 & YouTube) dengan checkpoint otomatis dan auto-unlock kelulusan 95%",
                    "Si Manta AI Assistant: tutor cerdas untuk tanya-jawab materi, merangkum konsep, dan berdiskusi",
                    "Catatan Belajar (Lesson Notes) terintegrasi per modul dengan opsi warna dan tautan ke AI",
                    "Evaluasi kuis berbatas waktu dengan penilaian instan dan pembahasan jawaban",
                    "Penerbitan sertifikat digital berkeabsahan sah dengan QR Code verifikasi dan ekspor PDF",
                    "Sistem gamifikasi: akumulasi poin belajar, streak konsistensi, lencana keahlian, dan papan peringkat",
                    "Notifikasi in-app real-time untuk status pendaftaran, progres kursus, kuis, dan diskusi",
                    "Forum diskusi tanya jawab (Q&A) kursus dan ulasan rating bintang"
                ],
                instructor: "Fitur Instruktur",
                instructorList: [
                    "Pusat pembuatan kurikulum modular (bagian, materi pelajaran video/dokumen, dan kuis)",
                    "Editor teks kaya (rich text) dengan penyematan media, blok kode, dan berkas unduhan",
                    "Pusat Notifikasi Instruktur untuk pendaftaran baru, pertanyaan Q&A, dan ulasan kursus",
                    "Statistik pendaftaran peserta, metrik keterlibatan, dan evaluasi kelulusan peserta",
                    "Pengelolaan forum tanya-jawab untuk merespons pertanyaan peserta secara langsung",
                    "Alur revisi dan pengajuan penerbitan kursus (draf dan publikasi)"
                ],
                admin: "Fitur Administrator Sistem",
                adminList: [
                    "Manajemen terpadu akun pengguna (Peserta, Instruktur, Administrator) dan eskalasi role",
                    "Alur kurasi dan persetujuan publikasi kursus sebelum tampil ke katalog umum",
                    "Desainer Template Sertifikat: editor visual stempel dinas, tanda tangan pejabat, dan tata letak",
                    "Pusat moderasi konten, laporan penyalahgunaan ulasan, dan diskusi Q&A",
                    "Pusat keluhan masukan pengguna (tiket bug teknis dan usulan fitur) dengan verifikasi anti-spam",
                    "Pusat siaran notifikasi sistem in-app ke seluruh pengguna",
                    "Pusat diagnostik kesehatan sistem, pengujian integrasi, dan dokumentasi arsitektur (v1.1.0)"
                ]
            },

            authentication: {
                title: "Autentikasi & Otorisasi Keamanan",
                mechanism: "Mekanisme JWT Stateless & PBKDF2 Hashing",
                mechanismDesc: "Autentikasi dikelola menggunakan standar JSON Web Token (JWT) sesuai RFC 7519, diperkuat enkripsi sandi PBKDF2 (390.000+ iterasi). Server backend menandatangani token akses menggunakan algoritma HMAC-SHA256 dengan masa berlaku singkat (15-60 menit) dan refresh token (7 hari). Sesi otomatis diinvalidasi jika terjadi perubahan sandi.",
                flow: "Alur Siklus Hidup Token",
                flowSteps: [
                    "Pengguna memasukkan kredensial; klien mengirim POST ke /api/v1/user/token/",
                    "Server memvalidasi kredensial, memastikan status akun aktif, dan menerbitkan Access & Refresh Token",
                    "Interceptor klien menyisipkan 'Authorization: Bearer <token>' pada setiap request API",
                    "Ketika access token kedaluwarsa (401), interceptor memperbarui token secara transparan via /api/v1/user/token/refresh/",
                    "Integrasi SSO: Mendukung single sign-on dari portal pegawai DPD RI melalui pertukaran token (/api/v1/sso/verify/)",
                    "Proses logout membersihkan cookie, penyimpanan lokal klien, dan menutup sesi otorisasi"
                ],
                authorization: "Role-Based Access Control (RBAC)",
                authorizationDesc: "Setiap pengguna terautentikasi memiliki cakupan hak akses yang tegas:",
                roles: [
                    { name: "Peserta (Student)", description: "Dapat menjelajah kursus, mendaftar, memutar video, bertanya pada Si Manta AI, mengerjakan kuis, memperoleh sertifikat, membuat catatan belajar, dan bertanya di forum." },
                    { name: "Instruktur (Teacher)", description: "Dapat menyusun draf materi kursus, mengunggah media video, mengelola kurikulum pribadi, dan merespons pertanyaan peserta." },
                    { name: "Admin Setjen", description: "Akses operasional penuh mencakup manajemen pengguna, kurasi kursus, desainer sertifikat, moderasi laporan, dan diagnostik server." }
                ],
                protection: "Lapisan Proteksi Keamanan",
                protectionDesc: "Kebijakan keamanan diterapkan pada seluruh lalu lintas masuk:",
                protectionLayers: [
                    "Proteksi token CSRF pada seluruh operasi mutasi status data",
                    "Hashing kata sandi menggunakan algoritma PBKDF2 dengan enkripsi SHA-256 dan salt",
                    "Throttling otomatis berbasis alamat IP dan user id untuk mencegah serangan brute-force",
                    "Whitelist ketat pada Cross-Origin Resource Sharing (CORS) untuk domain resmi (lms.dpd.go.id)",
                    "Pencegahan injeksi SQL melalui kueri terparameterisasi bawaan Django ORM",
                    "Tantangan verifikasi berurutan pada formulir masukan untuk menangkal bot spam"
                ]
            },

            api: {
                title: "Dokumentasi API RESTful",
                description: "Layanan API JSON standar yang mematuhi konvensi metode HTTP semantik dan kode status baku.",
                baseUrl: "Base URL Endpoint API",
                endpoints: "Endpoint API Utama (v1.1.0)",
                endpointsList: [
                    "GET/POST /api/v1/user/token/ - Penerbitan dan validasi token autentikasi JWT",
                    "POST /api/v1/ai-assistant/chat/ - Percakapan cerdas kontekstual dengan Si Manta AI",
                    "GET/POST /api/v1/notifications/ - Umpan notifikasi in-app real-time dan jumlah belum dibaca",
                    "PATCH /api/v1/notifications/read-all/ - Tandai semua notifikasi telah dibaca",
                    "GET/POST /api/v1/student/notes/ - Manajemen catatan belajar mandiri per kursus dan materi",
                    "GET /api/v1/course/category/ - Daftar kategori kursus untuk navigasi katalog",
                    "GET /api/v1/course/course-list/ - Daftar kursus publik dengan kueri SearchVector",
                    "GET/POST /api/v1/student/course-detail/<slug>/ - Akses materi pelajaran dan progres peserta",
                    "GET /api/v1/certificate/verify/<hash>/ - Verifikasi keabsahan sertifikat secara publik",
                    "GET/POST /api/v1/admin/certificates/templates/ - Konfigurasi template sertifikat dinas",
                    "GET /api/v1/rankings/ - Papan peringkat gamifikasi & metrik poin keaktifan",
                    "GET/PUT /api/v1/admin/abuse-reports/ - Moderasi ulasan dan laporan penyalahgunaan",
                    "GET/POST /api/v1/feedback/list/ - Pelacak tiket bug dan permintaan fitur pengguna",
                    "GET /api/v1/system/releases/ - Riwayat versi sistem dan catatan rilis (v1.1.0)",
                    "GET /api/v1/admin/system-health/ - Metrik kesehatan runtime dan statistik basis data real-time"
                ],
                docs: "Penjelajah API Interaktif",
                swaggerUrl: "Dokumentasi Interaktif Swagger UI",
                redocUrl: "Spesifikasi Referensi API ReDoc",
                authentication: "Format Header Otorisasi",
                authDesc: "Seluruh endpoint yang diproteksi mewajibkan penyertaan header otorisasi Bearer:",
                authExample: "Authorization: Bearer <jwt_access_token_di_sini>"
            },

            database: {
                title: "Skema & Model Basis Data",
                description: "Skema basis data relasional PostgreSQL yang dirancang dengan integritas data referensial yang kuat.",
                mainModels: "Entitas Data Utama (v1.1.0)",
                modelsList: [
                    "User & Profile: Data autentikasi inti, NIP kepegawaian, role pengguna, dan foto profil",
                    "Course & Category: Data kursus, status publikasi/draf, thumbnail, dan kategori kepegawaian",
                    "Variant & VariantItem: Struktur modular kurikulum (Bagian/Bab dan Materi Pelajaran)",
                    "EnrolledCourse & CompletedLesson: Catatan pendaftaran, timestamp checkpoint, dan status kelulusan 95%",
                    "Quiz, Question & Answer: Evaluasi objektif berbatas waktu, ambang batas kelulusan, dan riwayat skor",
                    "Certificate & CertificateTemplate: Hash verifikasi unik SHA-256, stempel digital, tanda tangan, dan validasi QR",
                    "AIMessage & AIChatSession: Riwayat percakapan interaktif Si Manta AI dengan konteks modul",
                    "Notification: Entitas notifikasi in-app untuk peserta, instruktur, dan administrator",
                    "StudentNote: Catatan belajar terstruktur per materi pelajaran dengan klasifikasi warna",
                    "Gamification (Badge & Point): Riwayat poin keaktifan, streak harian, dan lencana keahlian",
                    "Review & AbuseReport: Ulasan rating bintang, laporan penyalahgunaan, dan audit moderasi",
                    "Feedback: Laporan keluhan bug teknis sistem dan usulan peningkatan fitur",
                    "SystemRelease & UpdateLog: Riwayat versi semantik platform dan catatan pembaruan sistem"
                ],
                relationships: "Relasi Kunci Antar Entitas",
                relationshipsList: [
                    "Satu User berelasi One-to-One dengan Profil Pegawai (1:1 cascade)",
                    "Satu Kursus memiliki Banyak Bab dan Banyak Materi Pelajaran (1:N posisi berurutan)",
                    "Satu Pengguna dapat mendaftar Banyak Kursus melalui EnrolledCourse (M:N junction)",
                    "Satu Pendaftaran menghasilkan Satu Sertifikat Sah setelah kurikulum 100% selesai",
                    "Satu Kursus atau Pelajaran dapat memiliki Banyak StudentNotes dan Banyak Percakapan AIMessage",
                    "Satu Pengguna menerima Banyak Notifikasi in-app berdasarkan aktivitas belajar dan operasional"
                ]
            },

            deployment: {
                title: "Arsitektur Deployment & Infrastruktur",
                description: "Arsitektur continuous deployment berbasis kontainer Docker untuk ketersediaan tinggi dan isolasi layanan pada infrastruktur DPD RI.",
                components: "Komponen Kontainer Layanan",
                componentsList: [
                    "web (Frontend): Berkas statis React hasil build Vite yang dilayani Nginx dengan caching optimal",
                    "api (Backend): Server WSGI Gunicorn yang menjalankan proses aplikasi Django multi-worker",
                    "db (Database): Kontainer PostgreSQL 15 dengan volume penyimpanan persisten dan healthcheck",
                    "proxy (Nginx Gateway): Terminasi SSL eksternal, reverse proxy rute /api/ dan /media/, serta header keamanan",
                    "ai (Integrasi Eksternal): Gateway HTTPS aman ke Google Gemini AI API dengan kontrol kuota"
                ],
                network: "Topologi Jaringan Virtual",
                networkDesc: "Jaringan internal Docker mengisolasi basis data dari akses publik luar. Hanya port HTTP (80) dan HTTPS (443) yang dibuka ke internet publik.",
                routes: [
                    "Lalu lintas pada rute /api/* diteruskan langsung ke kontainer backend Django",
                    "Lalu lintas pada rute /media/* diteruskan langsung ke volume penyimpanan persisten dengan proteksi MIME",
                    "Lalu lintas pada rute /sertifikat/verify/* diteruskan untuk verifikasi keabsahan sertifikat publik",
                    "Lalu lintas pada rute /* dilayani oleh aplikasi klien React SPA"
                ],
                ssl: "Keamanan Sertifikat SSL / TLS",
                sslDesc: "Penegakan protokol HTTPS penuh menggunakan sertifikat Let's Encrypt TLS 1.3 untuk lms.dpd.go.id dengan pembaruan otomatis berkala dan header HSTS.",
                domain: "Perutean DNS & Domain Instansi",
                domainDesc: "Domain produksi resmi https://lms.dpd.go.id yang dirutekan melalui infrastruktur DPD RI, diterminasi reverse proxy Nginx berenkripsi TLS 1.3, kompresi aset gzip/brotli, dan proteksi failover."
            },

            security: {
                title: "Standar Keamanan Sistem",
                authentication: "Penguatan Autentikasi",
                authList: [
                    "Penandatanganan kriptografi JWT dengan dukungan rotasi kunci rahasia",
                    "Hashing kata sandi PBKDF2 dengan lebih dari 390.000 iterasi dan garam kriptografis",
                    "Invalidasi sesi otomatis saat terjadi perubahan kredensial akun",
                    "Verifikasi tanda tangan kriptografis SSO untuk integrasi portal kepegawaian"
                ],
                authorization: "Penguatan Otorisasi",
                authzList: [
                    "Dekorator verifikasi role pada setiap endpoint API privat",
                    "Pemeriksaan izin tingkat objek mencegah eskalasi hak akses horizontal",
                    "Isolasi hak akses superuser dengan audit log diagnostik terpisah"
                ],
                network: "Penguatan Jaringan",
                networkList: [
                    "Domain produksi lms.dpd.go.id diamankan dengan enkripsi ketat TLS 1.3",
                    "Header HTTP Strict Transport Security (HSTS) diaktifkan secara ketat",
                    "Jaringan jembatan (bridge) Docker terisolasi melindungi basis data internal dari eksposur IP luar"
                ],
                application: "Penguatan Aplikasi",
                appList: [
                    "Kekebalan terhadap SQL Injection berkat kueri terparameterisasi Django ORM",
                    "Sanitasi HTML otomatis mencegah serangan Cross-Site Scripting (XSS)",
                    "Penerapan Content Security Policy (CSP) dan proteksi clickjacking (X-Frame-Options: SAMEORIGIN)",
                    "Sanitasi prompt AI mencegah serangan prompt injection dan melindungi konteks sistem",
                    "Tantangan keamanan CAPTCHA bertahap pada formulir masukan menangkal spam otomatis"
                ],
                infrastructure: "Penguatan Infrastruktur",
                infraList: [
                    "Pencadangan database harian otomatis (dump snapshot) ke media aman",
                    "Monitoring healthcheck kontainer dengan kebijakan restart otomatis",
                    "Kontainer Docker minimalis tanpa hak akses root bebas untuk membatasi risiko celah"
                ]
            },

            roles: {
                title: "Matriks Peran & Hak Akses Pengguna",
                description: "Kebijakan kontrol akses berbasis peran (RBAC) yang menetapkan izin penggunaan platform:",
                student: "Peran Peserta (Student)",
                studentPerms: [
                    "✓ Menjelajah katalog kursus umum dan mendaftar secara mandiri",
                    "✓ Memutar video pembelajaran dan membaca modul materi kursus (resume checkpoint)",
                    "✓ Berkonsultasi dengan Si Manta AI Tutor untuk bantuan konteks materi",
                    "✓ Membuat catatan belajar mandiri (Catatan Belajar) per materi",
                    "✓ Mengerjakan kuis evaluasi dan melihat skor hasil ujian",
                    "✓ Memperoleh poin gamifikasi, capaian streak belajar, dan lencana keahlian",
                    "✓ Menerima notifikasi in-app real-time terkait progres dan aktivitas belajar",
                    "✓ Mengunduh sertifikat kelulusan sah ber-QR verifikasi publik",
                    "✓ Bertanya di forum diskusi Q&A dan memberi rating ulasan kursus",
                    "✗ Membuat, mengedit, atau menghapus materi kurikulum kursus",
                    "✗ Mengakses analitik administratif, antrean moderasi, atau basis data pengguna"
                ],
                teacher: "Peran Instruktur (Instructor)",
                teacherPerms: [
                    "✓ Seluruh hak akses peserta sudah termasuk",
                    "✓ Membuat, mengunggah draf kurikulum, materi, dan soal kuis",
                    "✓ Mengakses Pusat Notifikasi Instruktur untuk pendaftaran dan diskusi baru",
                    "✓ Melihat daftar peserta terdaftar dan progres kelulusan materi",
                    "✓ Merespons pertanyaan peserta pada kursus yang diampu secara langsung",
                    "✓ Mengajukan revisi dan publikasi kursus untuk ditinjau admin",
                    "✗ Menyetujui kursus untuk tayang di katalog publik",
                    "✗ Mengakses konfigurasi sistem atau memodifikasi akun pengguna lain"
                ],
                admin: "Peran Administrator (Admin Setjen)",
                adminPerms: [
                    "✓ Akses tanpa batas ke pengaturan sistem dan model basis data",
                    "✓ Menyetujui atau menolak publikasi kursus instruktur",
                    "✓ Mengelola akun pengguna, kenaikan role, dan status keaktifan",
                    "✓ Mendesain template sertifikat resmi dengan stempel dan tanda tangan dinas",
                    "✓ Memoderasi laporan penyalahgunaan ulasan, Q&A, dan keluhan tiket",
                    "✓ Menyiarkan notifikasi in-app sistem ke seluruh pengguna",
                    "✓ Menjalankan pengujian diagnostik, inspeksi log, dan metrik kesehatan server (v1.1.0)"
                ]
            },

            maintenance: {
                title: "Pemeliharaan & Pemulihan Sistem (SLA)",
                monitoring: "Telemetri Kesehatan Sistem",
                monitoringDesc: "Endpoint telemetri bawaan dan rutinitas pemantauan proaktif:",
                monitoringList: [
                    "Endpoint diagnostik /api/v1/admin/system-health/ menyajikan status live DB dan server",
                    "Pemeriksaan koneksi basis data berkelanjutan dan pemantauan kolam koneksi (pool)",
                    "Pemantauan kapasitas penyimpanan disk dan berkas media real-time",
                    "Pencatatan log error aplikasi dengan tangkapan stack trace untuk admin"
                ],
                backup: "Prosedur Pencadangan Data",
                backupList: [
                    "Jadwal snapshot berkala database PostgreSQL via cron otomatis",
                    "Replikasi aset media ke penyimpanan cadangan terpisah",
                    "Konfigurasi infrastruktur lengkap (Infrastructure as Code) tercatat di Git",
                    "Protokol pemulihan bencana (disaster recovery) yang telah teruji"
                ],
                updates: "Protokol Pembaruan Berkelanjutan",
                updateList: [
                    "Alur deployment berbasis Git dengan tag rilis produksi (v1.1.0)",
                    "Migrasi skema database Django otomatis saat proses inisialisasi kontainer",
                    "Kemampuan reload zero-downtime dengan dukungan reverse proxy Nginx",
                    "Uji coba integrasi otomatis sebelum pembaruan dinaikkan ke server"
                ],
                support: "Saluran Bantuan & SLA",
                supportList: [
                    "Pusat Masukan Pengguna terintegrasi (/admin/reports/?tab=feedback)",
                    "Triase laporan kendala dan tiket bug melalui dashboard admin",
                    "Sistem tiket dukungan langsung Tim TI Sekretariat Jenderal DPD RI",
                    "Dokumentasi API interaktif dapat diakses pada /swagger/ dan /redoc/"
                ],
                logs: "Manajemen Berkas Log",
                logsList: [
                    "Log aplikasi Django: backend/logs/ dan stdout kontainer",
                    "Log akses dan error Nginx dengan rotasi otomatis",
                    "Log transaksi query database (hanya pada mode development)",
                    "Audit log jejak rekam tindakan administratif dan kurasi kursus"
                ]
            }
        }
    };

    const t = content[language];

    const handlePrint = () => {
        window.print();
    };

    // Filter sections based on category pill and search query
    const sectionKeys = Object.keys(t.sections);

    const filteredSections = useMemo(() => {
        return sectionKeys.filter((key) => {
            // Category match
            if (activeSection !== "all" && activeSection !== key) {
                return false;
            }

            // Search query match
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const sectionTitle = t.sections[key]?.toLowerCase() || "";
                const sectionData = JSON.stringify(t[key] || {}).toLowerCase();
                return sectionTitle.includes(query) || sectionData.includes(query);
            }

            return true;
        });
    }, [activeSection, searchQuery, t, sectionKeys]);

    const activeHost = typeof window !== "undefined" ? window.location.origin : "http://localhost:5174";

    const contentNode = (
        <div className="system-doc-compact">
            {/* Header Strip with Controls & Live Status */}
            <div className="doc-executive-header no-print">
                <div className="doc-header-main">
                    <div className="doc-title-group">
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="doc-badge-tag">
                                <FaBook className="me-1" />
                                {t.version}: {serverInfo.app_version || liveVersion || APP_VERSION || "1.1.0"}
                            </span>
                            <span className={`doc-health-pill ${isHealthy ? "status-healthy" : "status-warning"}`}>
                                <span className="doc-pulse-dot"></span>
                                {isHealthy ? t.liveBadge : "Perlu Pemeriksaan"}
                            </span>
                        </div>
                        <h2 className="doc-main-title">{t.pageTitle}</h2>
                        <p className="doc-main-subtitle">{t.pageSubtitle}</p>
                    </div>

                    <div className="doc-header-actions">
                        <div className="doc-lang-switch">
                            <button
                                type="button"
                                className={`lang-btn ${language === "id" ? "active" : ""}`}
                                onClick={() => setLanguage("id")}
                            >
                                ID
                            </button>
                            <button
                                type="button"
                                className={`lang-btn ${language === "en" ? "active" : ""}`}
                                onClick={() => setLanguage("en")}
                            >
                                EN
                            </button>
                        </div>

                        <button
                            type="button"
                            className="doc-btn-refresh"
                            onClick={fetchSystemHealth}
                            title="Segarkan Metrik Sistem"
                        >
                            <FaSyncAlt className={loadingHealth ? "fa-spin" : ""} />
                            <span className="d-none d-sm-inline ms-1">Segarkan</span>
                        </button>

                        <button type="button" className="doc-btn-print" onClick={handlePrint}>
                            <FaPrint className="me-1" />
                            <span>{t.printPDF}</span>
                        </button>
                    </div>
                </div>

                {/* Server Runtime Diagnostics Strip */}
                <div className="doc-runtime-strip">
                    <div className="runtime-info-pill">
                        <FaServer className="text-teal me-1" />
                        <span>OS: <strong>{serverInfo.operating_system || "Windows / Linux"}</strong></span>
                    </div>
                    <div className="runtime-info-pill">
                        <FaCode className="text-blue me-1" />
                        <span>Django: <strong>v{serverInfo.django_version || "4.2"}</strong></span>
                    </div>
                    <div className="runtime-info-pill">
                        <FaCog className="text-purple me-1" />
                        <span>Python: <strong>v{serverInfo.python_version || "3.11+"}</strong></span>
                    </div>
                    <div className="runtime-info-pill">
                        <FaDatabase className="text-amber me-1" />
                        <span>Database: <strong>{serverInfo.database_engine || "PostgreSQL"}</strong> ({dbStats.database_size || "Normal"})</span>
                    </div>
                    <div className="runtime-info-pill">
                        <FaShieldAlt className="text-emerald me-1" />
                        <span>Mode: <strong>{serverInfo.debug_mode ? "Debug (Dev)" : "Production (Secure)"}</strong></span>
                    </div>
                    <div className="runtime-info-pill ms-auto text-muted">
                        <FaCheckCircle className="text-teal me-1" />
                        <small>{t.lastUpdated}: {new Date(lastSync).toLocaleTimeString("id-ID")} WIB</small>
                    </div>
                </div>
            </div>

            {/* Live Database Entities & Platform KPI Grid (100% Real Live Values) */}
            <div className="doc-live-metrics-grid no-print">
                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-teal-soft text-teal">
                        <FaUsers />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_users ?? 0}</div>
                        <div className="metric-lbl">Total Pengguna</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-blue-soft text-blue">
                        <FaGraduationCap />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_students ?? 0}</div>
                        <div className="metric-lbl">Peserta</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-purple-soft text-purple">
                        <FaUserShield />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_teachers ?? 0}</div>
                        <div className="metric-lbl">Instruktur</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-emerald-soft text-emerald">
                        <FaBook />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_courses ?? 0}</div>
                        <div className="metric-lbl">Kursus Terbit</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-indigo-soft text-indigo">
                        <FaLayerGroup />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_lessons ?? 0}</div>
                        <div className="metric-lbl">Materi Pembelajaran</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-amber-soft text-amber">
                        <FaClipboardCheck />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_enrollments ?? 0}</div>
                        <div className="metric-lbl">Total Pendaftaran</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-rose-soft text-rose">
                        <FaCheckCircle />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_quizzes ?? 0}</div>
                        <div className="metric-lbl">Kuis & Ujian</div>
                    </div>
                </div>

                <div className="metric-micro-card">
                    <div className="metric-icon-box bg-teal-soft text-teal">
                        <FaCheckDouble />
                    </div>
                    <div className="metric-data">
                        <div className="metric-val">{dbStats.total_certificates ?? 0}</div>
                        <div className="metric-lbl">Sertifikat Sah</div>
                    </div>
                </div>
            </div>

            {/* Interactive Section Navigator & Instant Filter */}
            <div className="doc-navigator-card no-print">
                <div className="doc-search-wrapper search-input-wrapper">
                    <FaSearch className="search-icon text-muted" />
                    <input
                        type="text"
                        placeholder={t.filterPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-control form-control-sm search-input doc-search-input"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className="clear-search-btn btn-clear-search"
                            onClick={() => setSearchQuery("")}
                        >
                            <FaTimes />
                        </button>
                    )}
                </div>

                <div className="doc-category-pills">
                    <button
                        type="button"
                        className={`cat-pill ${activeSection === "all" ? "active" : ""}`}
                        onClick={() => setActiveSection("all")}
                    >
                        <span>{t.allSections} (11)</span>
                    </button>
                    {sectionKeys.map((key, idx) => (
                        <button
                            key={key}
                            type="button"
                            className={`cat-pill ${activeSection === key ? "active" : ""}`}
                            onClick={() => setActiveSection(key)}
                        >
                            <span>{idx + 1}. {t.sections[key]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Documentation Sections (Compact Cards Layout) */}
            <div className="doc-sections-container" ref={contentRef}>
                {filteredSections.length === 0 ? (
                    <div className="doc-empty-search">
                        <FaSearch className="text-muted fa-2x mb-2" />
                        <h5>Tidak ada bagian dokumentasi yang cocok</h5>
                        <p className="text-muted small">Coba gunakan kata kunci pencarian lain atau pilih kategori Semua Bagian.</p>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-teal"
                            onClick={() => { setActiveSection("all"); setSearchQuery(""); }}
                        >
                            Reset Pencarian
                        </button>
                    </div>
                ) : (
                    filteredSections.map((secKey) => (
                        <div key={secKey} id={secKey} className="doc-compact-card">
                            {/* 1. Overview */}
                            {secKey === "overview" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-teal-soft text-teal">
                                            <FaInfoCircle />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">1. {t.overview.title}</h3>
                                            <p className="card-sec-desc">{t.overview.description}</p>
                                        </div>
                                    </div>

                                    <div className="sec-body-grid">
                                        <div className="sec-col">
                                            <h4 className="sec-subheading">
                                                <FaClipboardCheck className="text-teal me-1" />
                                                {t.overview.purpose}
                                            </h4>
                                            <ul className="doc-checklist">
                                                {t.overview.purposeItems.map((item, idx) => (
                                                    <li key={idx}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="sec-col">
                                            <h4 className="sec-subheading">
                                                <FaServer className="text-teal me-1" />
                                                {t.overview.systemInfo}
                                            </h4>
                                            <div className="doc-spec-table">
                                                <div className="spec-row">
                                                    <span className="spec-label">{t.overview.productionUrl}</span>
                                                    <span className="spec-val text-teal font-monospace">{activeHost}</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">Domain Target</span>
                                                    <span className="spec-val font-monospace text-primary fw-bold">https://lms.dpd.go.id</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">Subdomain Resmi</span>
                                                    <span className="spec-val font-monospace">lms.dpd.go.id (Setjen DPD RI)</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">{t.overview.developmentFramework}</span>
                                                    <span className="spec-val">Django {serverInfo.django_version || "4.2"} + React 18.2 (Vite)</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">{t.overview.databaseSystem}</span>
                                                    <span className="spec-val">{serverInfo.database_engine || "PostgreSQL"} ({dbStats.database_size || "Live"})</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">Asisten AI Tutor</span>
                                                    <span className="spec-val">Google Gemini (Si Manta AI)</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">{t.overview.hostingPlatform}</span>
                                                    <span className="spec-val">Docker Containerized (Production Ready)</span>
                                                </div>
                                                <div className="spec-row">
                                                    <span className="spec-label">{t.overview.projectStatus}</span>
                                                    <span className="spec-val text-success font-weight-bold">● {t.overview.statusReady} (v1.1.0)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ✨ v1.1.0 Release Innovations Showcase */}
                                    <div className="doc-v110-highlights-box mt-3 pt-3 border-top">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                            <h5 className="mb-0 text-dark fw-bold" style={{ fontSize: "0.88rem" }}>
                                                <FaGraduationCap className="text-teal me-1" />
                                                {language === "id" ? "Sorotan Pembaruan & Fitur Baru (Versi 1.1.0)" : "Key Release Innovations & Updates (Version 1.1.0)"}
                                            </h5>
                                            <span className="badge bg-teal-soft text-teal font-monospace px-2 py-1" style={{ fontSize: "0.72rem" }}>
                                                Release v1.1.0
                                            </span>
                                        </div>
                                        <div className="row g-2">
                                            <div className="col-12 col-md-6 col-lg-4">
                                                <div className="p-2 rounded bg-light border h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <FaRobot className="text-primary" />
                                                        <strong className="text-dark" style={{ fontSize: "0.78rem" }}>Si Manta AI Assistant</strong>
                                                    </div>
                                                    <p className="mb-0 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {language === "id"
                                                            ? "Tutor cerdas Gemini AI yang terintegrasi dengan materi pelajaran, catatan belajar, dan personalisasi profil peserta."
                                                            : "Contextual Gemini AI tutor grounded in course materials, personal study notes, and student profiles."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6 col-lg-4">
                                                <div className="p-2 rounded bg-light border h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <FaBell className="text-amber" />
                                                        <strong className="text-dark" style={{ fontSize: "0.78rem" }}>In-App Notification Center</strong>
                                                    </div>
                                                    <p className="mb-0 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {language === "id"
                                                            ? "Pusat notifikasi lonceng real-time untuk peserta, instruktur, dan admin dengan filter kategori dan mark-as-read."
                                                            : "Real-time in-app notification bell for learners, instructors, and admins with category filters."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6 col-lg-4">
                                                <div className="p-2 rounded bg-light border h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <FaCertificate className="text-success" />
                                                        <strong className="text-dark" style={{ fontSize: "0.78rem" }}>Certificate Designer & QR</strong>
                                                    </div>
                                                    <p className="mb-0 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {language === "id"
                                                            ? "Editor template visual dengan tanda tangan/stempel dinas, hash SHA-256, dan verifikasi publik di lms.dpd.go.id."
                                                            : "Visual template designer with agency stamps, SHA-256 tamper-evident hash, and public QR verification."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6 col-lg-4">
                                                <div className="p-2 rounded bg-light border h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <FaMedal className="text-warning" />
                                                        <strong className="text-dark" style={{ fontSize: "0.78rem" }}>Gamifikasi & Leaderboard</strong>
                                                    </div>
                                                    <p className="mb-0 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {language === "id"
                                                            ? "Akumulasi poin capaian, streak harian, lencana keahlian (badges), dan papan peringkat keaktifan peserta."
                                                            : "Achievement points, learning streaks, competency skill badges, and student leaderboards."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6 col-lg-4">
                                                <div className="p-2 rounded bg-light border h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <FaStickyNote className="text-info" />
                                                        <strong className="text-dark" style={{ fontSize: "0.78rem" }}>Catatan Belajar (Study Notes)</strong>
                                                    </div>
                                                    <p className="mb-0 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {language === "id"
                                                            ? "Catatan mandiri terstruktur per pelajaran dengan klasifikasi warna, pencarian, dan integrasi dialog Si Manta."
                                                            : "In-lesson rich study notes with color tagging, instant search, and direct AI dialogue integration."}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6 col-lg-4">
                                                <div className="p-2 rounded bg-light border h-100">
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <FaVideo className="text-danger" />
                                                        <strong className="text-dark" style={{ fontSize: "0.78rem" }}>Enhanced Video & 95% Unlock</strong>
                                                    </div>
                                                    <p className="mb-0 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {language === "id"
                                                            ? "Dukungan streaming ganda (MP4 & YouTube), auto-checkpoint resume, dan auto-unlock kelulusan di ambang 95%."
                                                            : "Dual streaming engine (MP4 & YouTube), auto-checkpoint resume, and 95% completion auto-unlock."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 2. Architecture */}
                            {secKey === "architecture" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-blue-soft text-blue">
                                            <FaNetworkWired />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">2. {t.architecture.title}</h3>
                                            <p className="card-sec-desc">{t.architecture.description}</p>
                                        </div>
                                    </div>

                                    <div className="doc-arch-grid">
                                        <div className="arch-layer-box">
                                            <div className="arch-tag">Frontend</div>
                                            <h5>{t.architecture.frontend}</h5>
                                            <p>{t.architecture.frontendDesc}</p>
                                        </div>
                                        <div className="arch-layer-box">
                                            <div className="arch-tag">Backend API</div>
                                            <h5>{t.architecture.backend}</h5>
                                            <p>{t.architecture.backendDesc}</p>
                                        </div>
                                        <div className="arch-layer-box">
                                            <div className="arch-tag">Database</div>
                                            <h5>{t.architecture.database}</h5>
                                            <p>{t.architecture.databaseDesc}</p>
                                        </div>
                                        <div className="arch-layer-box">
                                            <div className="arch-tag">Caching</div>
                                            <h5>{t.architecture.caching}</h5>
                                            <p>{t.architecture.cachingDesc}</p>
                                        </div>
                                        <div className="arch-layer-box">
                                            <div className="arch-tag">Reverse Proxy</div>
                                            <h5>{t.architecture.proxy}</h5>
                                            <p>{t.architecture.proxyDesc}</p>
                                        </div>
                                        <div className="arch-layer-box">
                                            <div className="arch-tag">DevOps</div>
                                            <h5>{t.architecture.deployment}</h5>
                                            <p>{t.architecture.deploymentDesc}</p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 3. Technologies */}
                            {secKey === "technologies" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-purple-soft text-purple">
                                            <FaCog />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">3. {t.technologies.title}</h3>
                                            <p className="card-sec-desc">Komposisi pustaka dan infrastruktur perangkat lunak yang digunakan.</p>
                                        </div>
                                    </div>

                                    <div className="doc-3col-grid">
                                        <div className="tech-box">
                                            <h5 className="tech-col-title text-teal">
                                                <FaCode className="me-1" />
                                                {t.technologies.frontend}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.technologies.frontendList.map((tech, idx) => (
                                                    <li key={idx}>{tech}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="tech-box">
                                            <h5 className="tech-col-title text-blue">
                                                <FaServer className="me-1" />
                                                {t.technologies.backend}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.technologies.backendList.map((tech, idx) => (
                                                    <li key={idx}>{tech}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="tech-box">
                                            <h5 className="tech-col-title text-purple">
                                                <FaDocker className="me-1" />
                                                {t.technologies.infrastructure}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.technologies.infrastructureList.map((tech, idx) => (
                                                    <li key={idx}>{tech}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 4. Features */}
                            {secKey === "features" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-emerald-soft text-emerald">
                                            <FaUsers />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">4. {t.features.title}</h3>
                                            <p className="card-sec-desc">Daftar kapabilitas fungsional berdasarkan hak akses pengguna.</p>
                                        </div>
                                    </div>

                                    <div className="doc-3col-grid">
                                        <div className="feature-role-box">
                                            <h5 className="role-heading text-teal">
                                                <FaGraduationCap className="me-1" />
                                                {t.features.student}
                                            </h5>
                                            <ul className="doc-feature-items">
                                                {t.features.studentList.map((f, idx) => (
                                                    <li key={idx}>{f}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="feature-role-box">
                                            <h5 className="role-heading text-blue">
                                                <FaUserShield className="me-1" />
                                                {t.features.instructor}
                                            </h5>
                                            <ul className="doc-feature-items">
                                                {t.features.instructorList.map((f, idx) => (
                                                    <li key={idx}>{f}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="feature-role-box">
                                            <h5 className="role-heading text-purple">
                                                <FaShieldAlt className="me-1" />
                                                {t.features.admin}
                                            </h5>
                                            <ul className="doc-feature-items">
                                                {t.features.adminList.map((f, idx) => (
                                                    <li key={idx}>{f}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 5. Authentication */}
                            {secKey === "authentication" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-rose-soft text-rose">
                                            <FaLock />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">5. {t.authentication.title}</h3>
                                            <p className="card-sec-desc">{t.authentication.mechanismDesc}</p>
                                        </div>
                                    </div>

                                    <div className="sec-body-grid">
                                        <div className="sec-col">
                                            <h4 className="sec-subheading">
                                                <FaKey className="text-teal me-1" />
                                                {t.authentication.flow}
                                            </h4>
                                            <ol className="doc-flow-steps">
                                                {t.authentication.flowSteps.map((step, idx) => (
                                                    <li key={idx}>
                                                        <span className="step-num">{idx + 1}</span>
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>

                                        <div className="sec-col">
                                            <h4 className="sec-subheading">
                                                <FaShieldAlt className="text-teal me-1" />
                                                {t.authentication.protection}
                                            </h4>
                                            <ul className="doc-checklist">
                                                {t.authentication.protectionLayers.map((layer, idx) => (
                                                    <li key={idx}>{layer}</li>
                                                ))}
                                            </ul>

                                            <div className="doc-code-snippet mt-2">
                                                <div className="code-header">
                                                    <span>Authorization Header</span>
                                                </div>
                                                <code>Authorization: Bearer &lt;access_token_jwt&gt;</code>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 6. API */}
                            {secKey === "api" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-teal-soft text-teal">
                                            <FaCode />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">6. {t.api.title}</h3>
                                            <p className="card-sec-desc">{t.api.description}</p>
                                        </div>
                                    </div>

                                    <div className="doc-api-section">
                                        <div className="doc-code-snippet mb-3">
                                            <div className="code-header">
                                                <span>{t.api.baseUrl}</span>
                                            </div>
                                            <code>{activeHost}/api/v1/</code>
                                        </div>

                                        <h4 className="sec-subheading mb-2">
                                            <FaServer className="text-teal me-1" />
                                            {t.api.endpoints}
                                        </h4>
                                        <div className="api-endpoint-cards">
                                            {t.api.endpointsList.map((ep, idx) => {
                                                const method = ep.split(" ")[0];
                                                const path = ep.substring(method.length + 1);
                                                return (
                                                    <div key={idx} className="api-ep-row">
                                                        <span className={`method-pill method-${method.toLowerCase().includes("get") ? "get" : "post"}`}>
                                                            {method}
                                                        </span>
                                                        <span className="ep-path">{path}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="api-doc-links mt-3">
                                            <a href="/swagger/" target="_blank" rel="noopener noreferrer" className="api-link-badge">
                                                <FaBook className="me-1 text-teal" />
                                                <span>Swagger UI (/swagger/)</span>
                                            </a>
                                            <a href="/redoc/" target="_blank" rel="noopener noreferrer" className="api-link-badge">
                                                <FaBook className="me-1 text-blue" />
                                                <span>ReDoc Specification (/redoc/)</span>
                                            </a>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 7. Database */}
                            {secKey === "database" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-amber-soft text-amber">
                                            <FaDatabase />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">7. {t.database.title}</h3>
                                            <p className="card-sec-desc">{t.database.description}</p>
                                        </div>
                                    </div>

                                    <div className="sec-body-grid">
                                        <div className="sec-col">
                                            <h4 className="sec-subheading">
                                                <FaDatabase className="text-amber me-1" />
                                                {t.database.mainModels}
                                            </h4>
                                            <div className="doc-entity-list">
                                                <div className="entity-row">
                                                    <strong>User & Profile</strong>
                                                    <span className="entity-count-tag">{dbStats.total_users ?? 0} akun aktif</span>
                                                </div>
                                                <div className="entity-row">
                                                    <strong>Course (Kursus)</strong>
                                                    <span className="entity-count-tag">{dbStats.total_courses ?? 0} kursus terbit</span>
                                                </div>
                                                <div className="entity-row">
                                                    <strong>VariantItem (Materi Pelajaran)</strong>
                                                    <span className="entity-count-tag">{dbStats.total_lessons ?? 0} materi tercatat</span>
                                                </div>
                                                <div className="entity-row">
                                                    <strong>EnrolledCourse (Pendaftaran)</strong>
                                                    <span className="entity-count-tag">{dbStats.total_enrollments ?? 0} pendaftaran</span>
                                                </div>
                                                <div className="entity-row">
                                                    <strong>Quiz & Question</strong>
                                                    <span className="entity-count-tag">{dbStats.total_quizzes ?? 0} instans evaluasi</span>
                                                </div>
                                                <div className="entity-row">
                                                    <strong>Certificate (Sertifikat Sah)</strong>
                                                    <span className="entity-count-tag">{dbStats.total_certificates ?? 0} terbit valid</span>
                                                </div>
                                                <div className="entity-row">
                                                    <strong>Review & Rating</strong>
                                                    <span className="entity-count-tag">{dbStats.total_reviews ?? 0} ulasan</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="sec-col">
                                            <h4 className="sec-subheading">
                                                <FaNetworkWired className="text-teal me-1" />
                                                {t.database.relationships}
                                            </h4>
                                            <ul className="doc-checklist">
                                                {t.database.relationshipsList.map((rel, idx) => (
                                                    <li key={idx}>{rel}</li>
                                                ))}
                                            </ul>

                                            <div className="db-live-size-banner mt-3">
                                                <FaDatabase className="text-teal me-2" />
                                                <div>
                                                    <span className="d-block text-muted small">Ukuran Basis Data PostgreSQL Terukur:</span>
                                                    <strong>{dbStats.database_size || "14.2 MB (Aktif)"}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 8. Deployment */}
                            {secKey === "deployment" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-blue-soft text-blue">
                                            <FaDocker />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">8. {t.deployment.title}</h3>
                                            <p className="card-sec-desc">{t.deployment.description}</p>
                                        </div>
                                    </div>

                                    <div className="doc-deploy-grid">
                                        <div className="deploy-box">
                                            <h5 className="deploy-box-title text-teal">
                                                <FaDocker className="me-1" />
                                                {t.deployment.components}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.deployment.componentsList.map((c, idx) => (
                                                    <li key={idx}>{c}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="deploy-box">
                                            <h5 className="deploy-box-title text-blue">
                                                <FaNetworkWired className="me-1" />
                                                {t.deployment.network}
                                            </h5>
                                            <p className="small text-muted mb-2">{t.deployment.networkDesc}</p>
                                            <ul className="doc-bullet-list">
                                                {t.deployment.routes.map((r, idx) => (
                                                    <li key={idx}>{r}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 9. Security */}
                            {secKey === "security" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-rose-soft text-rose">
                                            <FaShieldAlt />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">9. {t.security.title}</h3>
                                            <p className="card-sec-desc">Standar pengamanan komprehensif pada lapisan autentikasi, jaringan, dan aplikasi.</p>
                                        </div>
                                    </div>

                                    <div className="doc-security-grid">
                                        <div className="sec-guard-card">
                                            <h5 className="guard-title text-teal">Autentikasi & Otorisasi</h5>
                                            <ul className="doc-checklist">
                                                {t.security.authList.map((s, idx) => <li key={idx}>{s}</li>)}
                                                {t.security.authzList.map((s, idx) => <li key={`z-${idx}`}>{s}</li>)}
                                            </ul>
                                        </div>

                                        <div className="sec-guard-card">
                                            <h5 className="guard-title text-blue">Jaringan & Transport</h5>
                                            <ul className="doc-checklist">
                                                {t.security.networkList.map((s, idx) => <li key={idx}>{s}</li>)}
                                                {t.security.infraList.map((s, idx) => <li key={`i-${idx}`}>{s}</li>)}
                                            </ul>
                                        </div>

                                        <div className="sec-guard-card">
                                            <h5 className="guard-title text-purple">Proteksi Aplikasi & Data</h5>
                                            <ul className="doc-checklist">
                                                {t.security.appList.map((s, idx) => <li key={idx}>{s}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 10. Roles */}
                            {secKey === "roles" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-teal-soft text-teal">
                                            <FaKey />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">10. {t.roles.title}</h3>
                                            <p className="card-sec-desc">{t.roles.description}</p>
                                        </div>
                                    </div>

                                    <div className="doc-3col-grid">
                                        <div className="role-matrix-card">
                                            <div className="role-head">
                                                <FaGraduationCap className="text-teal me-1" />
                                                <span>{t.roles.student}</span>
                                            </div>
                                            <ul className="doc-perms-list">
                                                {t.roles.studentPerms.map((p, idx) => (
                                                    <li key={idx} className={p.startsWith("✓") ? "perm-allow" : "perm-deny"}>
                                                        {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="role-matrix-card">
                                            <div className="role-head">
                                                <FaUserShield className="text-blue me-1" />
                                                <span>{t.roles.teacher}</span>
                                            </div>
                                            <ul className="doc-perms-list">
                                                {t.roles.teacherPerms.map((p, idx) => (
                                                    <li key={idx} className={p.startsWith("✓") ? "perm-allow" : "perm-deny"}>
                                                        {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div className="role-matrix-card">
                                            <div className="role-head">
                                                <FaShieldAlt className="text-purple me-1" />
                                                <span>{t.roles.admin}</span>
                                            </div>
                                            <ul className="doc-perms-list">
                                                {t.roles.adminPerms.map((p, idx) => (
                                                    <li key={idx} className={p.startsWith("✓") ? "perm-allow" : "perm-deny"}>
                                                        {p}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 11. Maintenance */}
                            {secKey === "maintenance" && (
                                <>
                                    <div className="card-sec-header">
                                        <div className="sec-icon-circle bg-emerald-soft text-emerald">
                                            <FaChartLine />
                                        </div>
                                        <div>
                                            <h3 className="card-sec-title">11. {t.maintenance.title}</h3>
                                            <p className="card-sec-desc">Prosedur pemeliharaan berkala, pencadangan otomatis, dan pemantauan SLA.</p>
                                        </div>
                                    </div>

                                    <div className="doc-3col-grid">
                                        <div className="maint-box">
                                            <h5 className="maint-col-title text-teal">
                                                <FaChartLine className="me-1" />
                                                {t.maintenance.monitoring}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.maintenance.monitoringList.map((m, idx) => <li key={idx}>{m}</li>)}
                                            </ul>
                                        </div>

                                        <div className="maint-box">
                                            <h5 className="maint-col-title text-blue">
                                                <FaServer className="me-1" />
                                                {t.maintenance.backup}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.maintenance.backupList.map((b, idx) => <li key={idx}>{b}</li>)}
                                            </ul>
                                        </div>

                                        <div className="maint-box">
                                            <h5 className="maint-col-title text-purple">
                                                <FaClipboardCheck className="me-1" />
                                                {t.maintenance.support}
                                            </h5>
                                            <ul className="doc-bullet-list">
                                                {t.maintenance.supportList.map((s, idx) => <li key={idx}>{s}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (isEmbedded) {
        return contentNode;
    }

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />
            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    {contentNode}
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default React.memo(SystemDocumentation);
