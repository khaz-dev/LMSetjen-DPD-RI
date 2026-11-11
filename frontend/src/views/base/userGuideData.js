export const userGuideContent = {
    en: {
        pageTitle: "User Guide",
        pageSubtitle: "Complete operational guide for the LMSetjen DPD RI Digital Learning Platform",
        lastUpdated: "Last Updated",
        version: "Version 1.1.0",
        exportPdf: "Export to PDF",
        language: "Language",

        tableOfContents: {
            title: "Table of Contents",
            items: [
                { id: "getting-started", title: "Getting Started", icon: "fa-rocket" },
                { id: "for-students", title: "For Students", icon: "fa-graduation-cap" },
                { id: "for-instructors", title: "For Instructors", icon: "fa-chalkboard-teacher" },
                { id: "manta-ai", title: "Manta AI", icon: "fa-robot" },
                { id: "features", title: "Platform Features", icon: "fa-star" },
                { id: "troubleshooting", title: "Troubleshooting", icon: "fa-tools" },
                { id: "faq", title: "FAQ", icon: "fa-question-circle" }
            ]
        },

        sections: {
            gettingStarted: {
                title: "Getting Started",
                intro: "Welcome to LMSetjen DPD RI v1.1.0! This official guide helps civil servants and instructors navigate our updated learning ecosystem.",

                registration: {
                    title: "Account Activation & Onboarding",
                    steps: [
                        "Click 'Masuk' (Login) on the navigation bar — public manual registration is disabled for institutional security.",
                        "Authenticate using 'SSO Nusa DPD' or official 'Google Workspace' (@dpd.go.id).",
                        "First-time Google users will complete a quick Onboarding form (Full Name, NIP, Unit) for identity verification.",
                        "Your account is automatically activated and assigned institutional roles without manual password setup.",
                        "If you hold multiple permissions (e.g. Student and Instructor), select your active role via the Multi-Role dialog."
                    ]
                },

                login: {
                    title: "Logging In & Role Selection",
                    steps: [
                        "Click 'Masuk' (Sign In) button on the top right header.",
                        "Choose your preferred authentication gateway: SSO Nusa DPD or Google Workspace.",
                        "Upon authorization, multi-role users can choose whether to enter as Student, Instructor, or Admin.",
                        "You can switch roles anytime from your profile dropdown without signing out."
                    ]
                },

                navigation: {
                    title: "Navigating the Platform",
                    description: "LMSetjen DPD RI provides role-optimized dashboards tailored to your daily tasks:",
                    dashboards: [
                        { role: "Students", path: "/student/dashboard/", description: "Access enrolled courses, interactive SCORM modules, personal notes, and certificates." },
                        { role: "Instructors", path: "/instructor/dashboard/", description: "Curate courses, upload SCORM packages, manage quizzes, design certificates, and track student mastery." },
                        { role: "Admins", path: "/admin/dashboard/", description: "Oversee system health, content moderation, version updates, user management, and platform analytics." }
                    ]
                }
            },

            forStudents: {
                title: "For Students",
                subtitle: "Master skills efficiently with interactive multimedia, automated progress, and AI guidance",

                browsing: {
                    title: "Discovering Courses",
                    description: "Explore curated competencies tailored for Setjen DPD RI:",
                    steps: [
                        "Use the smart search bar equipped with Trending Searches and real-time keyword suggestions.",
                        "Review personalized 'Recommended For You' courses based on your learning history and interests.",
                        "Filter catalogs by category, difficulty level, instructor, and format (Video or SCORM).",
                        "Inspect syllabus, learning outcomes, estimated duration, and certified instructor credentials."
                    ]
                },

                enrolling: {
                    title: "Enrolling & Starting",
                    steps: [
                        "Navigate to the course overview page.",
                        "Click 'Enroll Now' (Daftar Kelas) — internal civil servant courses are complimentary.",
                        "The course immediately appears under 'My Courses' in your Student Dashboard.",
                        "Resume your learning anytime across desktop and mobile browsers."
                    ]
                },

                learning: {
                    title: "Interactive Learning Experience",
                    features: [
                        {
                            name: "HD Video Streaming",
                            description: "Adaptive playback, 0.5x–2.0x playback speed, and automatic timestamp progress synchronization."
                        },
                        {
                            name: "SCORM Interactive Modules",
                            description: "New in v1.1.0: Full SCORM 1.2 / 2004 interactive courses with embedded simulations and auto-scoring."
                        },
                        {
                            name: "Smart Study Notes",
                            description: "Take timestamped private notes during lectures. Fully connected to Manta AI for instant contextual elaboration."
                        },
                        {
                            name: "Course Resources",
                            description: "Download verified reference slides, regulations, SOP manuals, and supplementary PDF documents."
                        },
                        {
                            name: "Automated Evaluation",
                            description: "Complete progressive quizzes and assessments with real-time pass/fail feedback and review summaries."
                        },
                        {
                            name: "Live Manta AI Tutor",
                            description: "Consult Manta AI directly while studying to clarify complex concepts or generate self-assessment quizzes."
                        }
                    ]
                },

                interaction: {
                    title: "Collaboration & In-App Alerts",
                    features: [
                        "Ask questions in the dedicated Q&A forum and upvote insightful answers from peers.",
                        "Receive real-time notifications via the In-App Notification Bell whenever instructors answer your questions.",
                        "Post constructive reviews and star ratings upon course completion.",
                        "Submit suggestions and issue reports directly via the floating Feedback widget."
                    ]
                },

                certificates: {
                    title: "Tamper-Evident Digital Certificates",
                    requirements: [
                        "Complete 100% of curriculum lessons and interactive SCORM modules.",
                        "Achieve or exceed the minimum passing grade on all required course quizzes.",
                        "Generate your certificate instantly from the Certificate tab with an authentic unique serial number.",
                        "Includes dynamic QR Code verification for instant digital credential validation by auditors and evaluators."
                    ]
                }
            },

            forInstructors: {
                title: "For Instructors",
                subtitle: "Author high-impact courses, embed SCORM packages, and evaluate competency growth",

                creatingCourse: {
                    title: "Course Creation Workflow",
                    steps: [
                        "Navigate to the Instructor Dashboard and click 'Buat Materi' (Create Course).",
                        "Input essential metadata: Title, Description, Categorization, Level, and Target Audience.",
                        "Upload high-resolution thumbnail graphics and an introductory teaser video.",
                        "Save as Draft to prepare the curriculum before submitting for publishing."
                    ]
                },

                curriculum: {
                    title: "Curriculum & SCORM Integration",
                    description: "Organize lessons using flexible media modules:",
                    steps: [
                        "Structure your curriculum into thematic Sections and Lessons.",
                        "Upload video lectures, PDF supplementary materials, or zipped SCORM 1.2 / 2004 interactive packages.",
                        "SCORM packages auto-extract and connect with student progress tracking.",
                        "Drag and drop to rearrange lessons seamlessly before publishing."
                    ]
                },

                quizzes: {
                    title: "Assessment & Passing Criteria",
                    steps: [
                        "Access the 'Manage Quiz' tab for your course.",
                        "Create multiple-choice questions with customized explanations for correct answers.",
                        "Assign point weights and determine the required passing grade (e.g. 70% or 80%).",
                        "Students must pass quizzes to unlock their official certificate of completion."
                    ]
                },

                publishing: {
                    title: "Certificate Customizer & Publishing",
                    requirements: [
                        "Select and customize the official Certificate Template with authorized signatures and emblems.",
                        "Ensure all curriculum sections, lessons, and quizzes are verified and complete.",
                        "Click 'Publish Course' to make it available to civil servants across the Secretariat General.",
                        "Track real-time student enrollments, completion rates, and feedback via your analytics dashboard."
                    ]
                },

                management: {
                    title: "Engagement & Student Mentorship",
                    features: [
                        "Monitor individual student progress and quiz performance in 'Peserta Saya' (My Participants).",
                        "Respond to student inquiries with instant In-App Notification delivery to the student.",
                        "Review student ratings, constructive feedback, and learning completion statistics.",
                        "Update curriculum materials and announcements dynamically without losing existing progress records."
                    ]
                }
            },

            mantaAi: {
                title: "Manta AI (Intelligent Learning Companion)",
                subtitle: "Your personal 24/7 AI learning assistant powered by institutional intelligence",
                description: "Manta AI is integrated directly into LMSetjen DPD RI v1.1.0 to accompany students and civil servants throughout their learning journey.",
                capabilities: [
                    {
                        title: "Interactive Course Tutor",
                        icon: "fa-comments",
                        description: "Ask Manta AI about any topic within your courses. Manta breaks down challenging institutional concepts, legal terms, and administrative procedures into concise, easy-to-digest explanations."
                    },
                    {
                        title: "Instant Lesson Summaries",
                        icon: "fa-file-alt",
                        description: "Need a refresher before a quiz? Ask Manta AI to summarize any video lesson or SCORM module into key takeaways and action points."
                    },
                    {
                        title: "Connected with Study Notes",
                        icon: "fa-book-reader",
                        description: "Manta AI connects directly with your personal 'Catatan Belajar'. Review, expand, or test yourself based on notes you took during lectures."
                    },
                    {
                        title: "Personalized Course Recommendations",
                        icon: "fa-compass",
                        description: "Manta AI recommends relevant courses and competency pathways matching your civil service role, unit requirements, and learning trajectory."
                    },
                    {
                        title: "Self-Assessment Practice Quizzes",
                        icon: "fa-check-double",
                        description: "Prepare with confidence! Request Manta AI to generate mock questions before attempting the final course evaluation quiz."
                    }
                ],
                howToUse: [
                    "Locate the Manta AI floating avatar in the bottom-right corner of your screen.",
                    "Click to expand the chat window while browsing courses or studying a lesson.",
                    "Type your question in natural Indonesian or English, or click one of the suggested quick prompts.",
                    "Manta AI responds instantly with tailored insights, relevant course references, and study tips."
                ]
            },

            features: {
                title: "Platform Features (v1.1.0)",
                subtitle: "Explore the end-to-end digital learning suite built for Setjen DPD RI",

                dashboard: {
                    title: "Personalized Command Center",
                    description: "A centralized hub tailored to your role with zero clutter:",
                    items: [
                        "Track ongoing courses, completion percentages, and study hours.",
                        "Quick access to downloaded resources, certificates, and upcoming quizzes.",
                        "One-click Multi-Role switcher for dual-role civil servants (Student/Instructor/Admin).",
                        "Recent activity feed and quick course resumption."
                    ]
                },

                search: {
                    title: "Smart Search & Trending Topics",
                    description: "Find competency modules faster with intelligent discovery:",
                    items: [
                        "Trending Searches chips showing most-searched skills and competencies.",
                        "Personalized course recommendations based on civil service specialization.",
                        "Multi-filter support: category, level, instructor, and SCORM/Video format.",
                        "Real-time autocomplete and typo-tolerant search suggestions."
                    ]
                },

                videoPlayer: {
                    title: "Modern Player & SCORM Engine",
                    description: "High-performance multimedia player built for uninterrupted learning:",
                    features: [
                        "Adaptive HD video streaming with zero buffering.",
                        "Integrated SCORM 1.2 / 2004 interactive player with embedded simulations.",
                        "Adjustable playback speed (0.5x, 1.0x, 1.25x, 1.5x, 2.0x).",
                        "Automatic progress autosave — switch devices without losing your place."
                    ]
                },

                qa: {
                    title: "In-App Notification & Q&A Hub",
                    description: "Stay informed and connected with colleagues and instructors:",
                    features: [
                        "Real-time In-App Notification Bell in top navigation for instantaneous alerts.",
                        "Course discussion threads with rich-text formatting and code/document references.",
                        "Upvote helpful peer responses and mark instructor-certified answers.",
                        "Notification center with mark-as-read and filtering controls."
                    ]
                },

                profile: {
                    title: "Profile & Identity Governance",
                    description: "Integrated institutional account and credential management:",
                    options: [
                        "Synchronized identity with SSO Nusa DPD and Google Workspace.",
                        "Role permissions inspection and multi-role active profile toggling.",
                        "Centralized portfolio of earned digital certificates with QR validation codes.",
                        "Floating Feedback widget to submit feature suggestions directly to administrators."
                    ]
                }
            },

            troubleshooting: {
                title: "Troubleshooting & Solutions",
                subtitle: "Frequently encountered issues and step-by-step resolution steps",

                issues: [
                    {
                        problem: "Unable to Sign In (Login Issues)",
                        solutions: [
                            "Ensure you are using your official SSO Nusa DPD credentials or institutional Google Workspace account (@dpd.go.id).",
                            "If you forgot your SSO password, reset it via the official SSO Nusa DPD portal or contact the Secretariat IT Helpdesk (standalone password reset on LMS is disabled for centralized security).",
                            "First-time Google users must complete the short Onboarding form displayed upon initial sign-in.",
                            "Clear browser cookies and cache if the login modal or OAuth popup fails to open.",
                            "Ensure third-party cookies or popup blockers are temporarily permitted for localhost/dpd.go.id."
                        ]
                    },
                    {
                        problem: "SCORM Interactive Module Fails to Load",
                        solutions: [
                            "Verify that your browser allows iframes and popups from the LMS domain.",
                            "Ensure your internet connection is stable, as SCORM packages load interactive assets.",
                            "Try refreshing the page or clearing cached site data in your browser.",
                            "Use modern Chromium-based browsers (Google Chrome, Microsoft Edge) or Firefox."
                        ]
                    },
                    {
                        problem: "Video Playback Freezing or Stuttering",
                        solutions: [
                            "Check your network bandwidth and disable heavy background downloads.",
                            "Reload the lecture page to re-establish the media stream.",
                            "Temporarily disable browser extensions (such as aggressive ad-blockers) that might interfere with video decoders.",
                            "Lower video playback speed or refresh your browser cache."
                        ]
                    },
                    {
                        problem: "Course Progress Not Updating",
                        solutions: [
                            "Verify that you are actively logged in to your account while watching lessons.",
                            "For video lessons, watch through to completion without skipping directly to the final second.",
                            "For SCORM modules, complete the required interactive steps or exit using the in-module exit button.",
                            "Avoid private/incognito browsing windows if your browser restricts local storage state."
                        ]
                    },
                    {
                        problem: "Unable to Download or Verify Certificate",
                        solutions: [
                            "Confirm 100% curriculum completion and verified passing scores on all course quizzes.",
                            "Click 'Generate Certificate' in the Certificate tab if not generated automatically.",
                            "Allow pop-ups in your browser when clicking 'Download PDF'.",
                            "Scan the QR code with your mobile camera to verify that the certificate URL validates properly."
                        ]
                    },
                    {
                        problem: "Manta AI Chat Window Not Responding",
                        solutions: [
                            "Check your internet connection to ensure backend AI services are reachable.",
                            "Close and re-open the Manta AI chat bubble from the bottom-right corner.",
                            "Refresh the browser page to re-authenticate your active session token."
                        ]
                    }
                ]
            },

            faq: {
                title: "Frequently Asked Questions (FAQ)",

                questions: [
                    {
                        q: "How do I register for an account on LMSetjen DPD RI?",
                        a: "You do not need to register manually! Simply click 'Masuk' (Sign In) and log in with your official SSO Nusa DPD account or institutional Google Workspace account (@dpd.go.id). Your account will be provisioned automatically through our onboarding gateway."
                    },
                    {
                        q: "Is there a 'Forgot Password' feature in the LMS?",
                        a: "No. For institutional security (S-01 standard), user credentials are centrally managed by SSO Nusa DPD and Google Workspace. If you cannot remember your password, please reset it through the official SSO Nusa portal or contact the Secretariat IT Helpdesk."
                    },
                    {
                        q: "What is Manta AI and how can it assist my learning?",
                        a: "Manta AI is your institutional virtual learning tutor. You can open Manta AI anytime via the bottom-right button to ask questions about your course, request lesson summaries, test your knowledge with mock quizzes, and get recommendations on what course to take next."
                    },
                    {
                        q: "What are SCORM modules in v1.1.0?",
                        a: "SCORM is an international standard for interactive digital e-learning. Unlike static videos, SCORM modules contain interactive simulations, clickable diagrams, and built-in exercises that record your scores and mastery directly into your student record."
                    },
                    {
                        q: "Can I hold both Student and Instructor roles with one account?",
                        a: "Yes! LMSetjen DPD RI features seamless Multi-Role support. If assigned multiple roles by administrators, you can switch between Student, Instructor, and Admin dashboards anytime without having to log out."
                    },
                    {
                        q: "How do I verify the authenticity of an LMSetjen DPD RI certificate?",
                        a: "Every certificate issued contains a unique verification code and QR Code. Scanning the QR code or visiting the verification link confirms the student's name, course completion date, and validity directly against the official database."
                    },
                    {
                        q: "Can I access LMSetjen DPD RI on mobile devices?",
                        a: "Yes. The platform is fully responsive and optimized for smartphones, tablets, and desktop workstations across Chrome, Safari, Edge, and Firefox."
                    },
                    {
                        q: "How do I provide feedback or report a bug?",
                        a: "Click the floating 'Feedback' button on the edge of the screen to submit comments, feature suggestions, or bug reports directly to the LMS administration team."
                    }
                ]
            }
        }
    },

    id: {
        pageTitle: "Panduan Pengguna",
        pageSubtitle: "Panduan operasional resmi penggunaan Platform Pembelajaran Digital LMSetjen DPD RI",
        lastUpdated: "Terakhir Diperbarui",
        version: "Versi 1.1.0",
        exportPdf: "Ekspor ke PDF",
        language: "Bahasa",

        tableOfContents: {
            title: "Daftar Isi",
            items: [
                { id: "getting-started", title: "Memulai", icon: "fa-rocket" },
                { id: "for-students", title: "Untuk Peserta", icon: "fa-graduation-cap" },
                { id: "for-instructors", title: "Untuk Instruktur", icon: "fa-chalkboard-teacher" },
                { id: "manta-ai", title: "Manta AI", icon: "fa-robot" },
                { id: "features", title: "Fitur Platform", icon: "fa-star" },
                { id: "troubleshooting", title: "Pemecahan Masalah", icon: "fa-tools" },
                { id: "faq", title: "FAQ", icon: "fa-question-circle" }
            ]
        },

        sections: {
            gettingStarted: {
                title: "Memulai",
                intro: "Selamat datang di LMSetjen DPD RI Versi 1.1.0! Panduan ini dirancang untuk membantu seluruh pegawai dan instruktur memanfaatkan ekosistem pembelajaran digital secara optimal.",

                registration: {
                    title: "Aktivasi Akun & Onboarding",
                    steps: [
                        "Klik tombol 'Masuk' pada bilah navigasi — pendaftaran mandiri dengan formulir publik ditiadakan demi keamanan terpusat instansi.",
                        "Masuk menggunakan akun 'SSO Nusa DPD' atau akun kedinasan resmi 'Google Workspace' (@dpd.go.id).",
                        "Untuk pengguna pertama kali melalui Google, lengkapi verifikasi data singkat pada form Onboarding (Nama Lengkap, NIP, Unit Kerja).",
                        "Akun Anda akan aktif secara otomatis tanpa perlu membuat kata sandi baru secara terpisah.",
                        "Jika Anda memiliki peran ganda (misal Peserta dan Instruktur), pilih peran aktif melalui jendela pemilihan peran (Multi-Role Switcher)."
                    ]
                },

                login: {
                    title: "Masuk & Pemilihan Peran",
                    steps: [
                        "Klik tombol 'Masuk' di bagian header kanan atas.",
                        "Pilih gerbang autentikasi yang diinginkan: SSO Nusa DPD atau Google Workspace.",
                        "Setelah berhasil login, pengguna multi-peran dapat memilih apakah ingin masuk sebagai Peserta, Instruktur, atau Admin.",
                        "Anda dapat berpindah peran kapan saja melalui menu profil tanpa perlu keluar (logout) dari platform."
                    ]
                },

                navigation: {
                    title: "Navigasi Platform",
                    description: "LMSetjen DPD RI menyediakan dashboard yang disesuaikan khusus untuk tiap peran tugas:",
                    dashboards: [
                        { role: "Peserta", path: "/student/dashboard/", description: "Akses materi yang diikuti, modul interaktif SCORM, catatan belajar, dan sertifikat." },
                        { role: "Instruktur", path: "/instructor/dashboard/", description: "Kelola kurikulum materi, upload modul SCORM, buat kuis, kelola sertifikat, dan pantau peserta." },
                        { role: "Admin", path: "/admin/dashboard/", description: "Pusat tata kelola sistem, moderasi konten, pembaruan versi (Update Logs), dan analitik instansi." }
                    ]
                }
            },

            forStudents: {
                title: "Untuk Peserta",
                subtitle: "Kembangkan kompetensi dengan media pembelajaran interaktif, progres otomatis, dan pendampingan AI",

                browsing: {
                    title: "Menjelajahi Materi Pembelajaran",
                    description: "Temukan materi pengembangan kompetensi yang tepat di lingkungan Setjen DPD RI:",
                    steps: [
                        "Gunakan bilah pencarian pintar yang dilengkapi Pencarian Populer (Trending Searches) dan saran kata kunci.",
                        "Telusuri seksi 'Rekomendasi Untuk Anda' yang disesuaikan dengan riwayat belajar dan minat kompetensi Anda.",
                        "Gunakan filter kategori, tingkat kesulitan, instruktur, dan format materi (Video atau SCORM).",
                        "Periksa silabus, tujuan pembelajaran, estimasi durasi, dan profil instruktur sebelum memulai."
                    ]
                },

                enrolling: {
                    title: "Mendaftar Materi",
                    steps: [
                        "Buka halaman detail materi yang ingin dipelajari.",
                        "Klik tombol 'Daftar Kelas' (Enroll Now) — seluruh materi internal kedinasan dapat diakses gratis oleh pegawai.",
                        "Materi langsung masuk ke daftar 'Materi Saya' di Dashboard Peserta Anda.",
                        "Lanjutkan proses belajar kapan saja melalui browser desktop maupun perangkat ponsel cerdas."
                    ]
                },

                learning: {
                    title: "Pengalaman Pembelajaran Interaktif",
                    features: [
                        {
                            name: "Streaming Video HD",
                            description: "Pemutar video adaptif dengan kontrol kecepatan (0.5x–2.0x) dan penyimpanan posisi menit belajar otomatis."
                        },
                        {
                            name: "Materi Interaktif SCORM",
                            description: "Fitur baru di v1.1.0: Modul interaktif SCORM 1.2 / 2004 dengan simulasi interaktif dan kuis terintegrasi."
                        },
                        {
                            name: "Catatan Belajar Pintar",
                            description: "Buat catatan pribadi berstempel waktu saat menyimak materi. Terhubung langsung dengan Manta AI untuk pendalaman topik."
                        },
                        {
                            name: "Materi & Dokumen Pendukung",
                            description: "Unduh materi paparan, modul PDF, SOP, dan regulasi resmi yang disediakan instruktur."
                        },
                        {
                            name: "Kuis Evaluasi Terstruktur",
                            description: "Uji pemahaman Anda dengan kuis berkala. Hasil nilai dan pembahasan langsung ditampilkan secara seketika."
                        },
                        {
                            name: "Pendampingan Manta AI",
                            description: "Tanyakan langsung ke Manta AI saat menemukan konsep yang sulit dipahami atau minta kuis latihan mandiri."
                        }
                    ]
                },

                interaction: {
                    title: "Kolaborasi & Notifikasi Langsung",
                    features: [
                        "Ajukan pertanyaan di forum Tanya Jawab (Q&A) materi dan berikan upvote pada jawaban yang bermanfaat.",
                        "Dapatkan pemberitahuan seketika melalui ikon lonceng Pusat Notifikasi (In-App Bell) saat instruktur membalas pertanyaan Anda.",
                        "Berikan ulasan dan rating bintang setelah menyelesaikan seluruh rangkaian materi.",
                        "Sampaikan masukan atau laporan kendala secara instan melalui tombol melayang Feedback."
                    ]
                },

                certificates: {
                    title: "Sertifikat Digital Terverifikasi",
                    requirements: [
                        "Selesaikan 100% pelajaran dan modul interaktif SCORM dalam materi.",
                        "Lulus semua kuis evaluasi dengan nilai memenuhi atau melampaui batas kelulusan.",
                        "Generate sertifikat digital otomatis dengan nomor seri unik melalui tab Sertifikat.",
                        "Dilengkapi QR Code Verifikasi Keaslian yang dapat dipindai langsung untuk validasi kredensial resmi."
                    ]
                }
            },

            forInstructors: {
                title: "Untuk Instruktur",
                subtitle: "Susun materi berkualitas, integrasikan modul SCORM, dan pantau kemajuan kompetensi peserta",

                creatingCourse: {
                    title: "Membuat Materi Baru",
                    steps: [
                        "Buka Dashboard Instruktur dan klik 'Buat Materi' (Create Course).",
                        "Lengkapi informasi utama: Judul, Deskripsi, Kategori, Tingkat Kesulitan, dan Target Sasaran Pegawai.",
                        "Unggah gambar thumbnail representatif dan video cuplikan materi (teaser).",
                        "Simpan sebagai Draf untuk melanjutkan penyusunan kurikulum materi."
                    ]
                },

                curriculum: {
                    title: "Penyusunan Kurikulum & SCORM",
                    description: "Strukturkan materi secara modular dengan ragam jenis konten:",
                    steps: [
                        "Bagi kurikulum ke dalam Bagian (Section) dan Pelajaran (Lesson) terstruktur.",
                        "Unggah video pembelajaran, modul PDF, atau paket interaktif SCORM (.zip) 1.2 / 2004.",
                        "Paket SCORM akan diekstrak otomatis dan terhubung dengan penilaian nilai kelulusan peserta.",
                        "Gunakan fitur seret-dan-lepas (drag and drop) untuk menyusun urutan materi dengan mudah."
                    ]
                },

                quizzes: {
                    title: "Kuis & Kriteria Kelulusan",
                    steps: [
                        "Buka tab 'Kelola Kuis' (Manage Quiz) pada materi Anda.",
                        "Susun pertanyaan pilihan ganda disertai penjelasan kunci jawaban.",
                        "Tentukan bobot nilai tiap soal dan tetapkan ambang batas nilai kelulusan (passing grade, misal 70% atau 80%).",
                        "Peserta diwajibkan lulus kuis evaluasi sebelum berhak memperoleh sertifikat digital."
                    ]
                },

                publishing: {
                    title: "Kustomisasi Sertifikat & Publikasi",
                    requirements: [
                        "Pilih dan sesuaikan Template Sertifikat resmi dengan tanda tangan digital dan stempel yang sah.",
                        "Pastikan seluruh modul pelajaran, materi unduhan, dan kuis telah terverifikasi dengan lengkap.",
                        "Klik 'Publikasikan Materi' agar materi dapat diakses oleh seluruh pegawai di lingkungan Setjen DPD RI.",
                        "Pantau jumlah pendaftar, tingkat penyelesaian, dan ulasan melalui dashboard analitik instruktur."
                    ]
                },

                management: {
                    title: "Bimbingan & Interaksi Peserta",
                    features: [
                        "Pantau kemajuan belajar dan capaian kuis setiap peserta pada menu 'Peserta Saya'.",
                        "Jawab pertanyaan peserta di forum Q&A dengan notifikasi langsung yang terkirim ke peserta.",
                        "Tinjau ulasan bintang dan umpan balik konstruktif untuk peningkatan materi selanjutnya.",
                        "Perbarui modul materi dan pengumuman secara berkala tanpa menghapus riwayat belajar peserta yang sudah ada."
                    ]
                }
            },

            mantaAi: {
                title: "Manta AI (Asisten Pembelajaran Cerdas)",
                subtitle: "Pendamping belajar digital berbasis kecerdasan buatan untuk akselerasi kompetensi pegawai",
                description: "Manta AI hadir secara terintegrasi di LMSetjen DPD RI v1.1.0 untuk memberikan bantuan belajar personal kapan pun Anda butuhkan.",
                capabilities: [
                    {
                        title: "Tutor Pembelajaran Interaktif",
                        icon: "fa-comments",
                        description: "Tanyakan apa saja seputar topik materi yang sedang dipelajari. Manta AI menjelaskan konsep kelembagaan, regulasi, dan prosedur administratif secara ringkas dan mudah dipahami."
                    },
                    {
                        title: "Ringkasan Materi Kilat",
                        icon: "fa-file-alt",
                        description: "Butuh penyegaran sebelum mengikuti kuis? Minta Manta AI merangkum intisari dan poin-poin krusial dari video pembelajaran maupun modul SCORM."
                    },
                    {
                        title: "Terhubung dengan Catatan Belajar",
                        icon: "fa-book-reader",
                        description: "Manta AI terhubung langsung dengan 'Catatan Belajar' pribadi Anda. Anda dapat meminta Manta AI memperdalam poin yang pernah Anda catat saat menyimak materi."
                    },
                    {
                        title: "Rekomendasi Materi Cerdas",
                        icon: "fa-compass",
                        description: "Manta AI memberikan saran materi dan jalur kompetensi berikutnya yang paling relevan dengan profil, tugas, dan kemajuan belajar Anda."
                    },
                    {
                        title: "Latihan Soal & Pra-Evaluasi Mandiri",
                        icon: "fa-check-double",
                        description: "Uji kesiapan Anda sebelum kuis resmi! Minta Manta AI membuatkan simulasi pertanyaan latihan untuk menguji pemahaman materi."
                    }
                ],
                howToUse: [
                    "Temukan avatar melayang Manta AI di sudut kanan bawah layar Anda.",
                    "Klik avatar untuk membuka jendela percakapan saat sedang menjelajah materi maupun di tengah proses belajar.",
                    "Ketikkan pertanyaan dalam Bahasa Indonesia sehari-hari, atau klik salah satu saran perintah cepat (quick prompts).",
                    "Manta AI akan merespons seketika dengan penjelasan terarah, rujukan materi, dan tips belajar bermanfaat."
                ]
            },

            features: {
                title: "Fitur Platform (v1.1.0)",
                subtitle: "Jelajahi seluruh fitur unggulan ekosistem pembelajaran digital Setjen DPD RI",

                dashboard: {
                    title: "Dashboard Terpadu & Multi-Role",
                    description: "Pusat kendali personal yang ringkas dan bebas hambatan visual:",
                    items: [
                        "Pantau materi yang sedang dipelajari, persentase tuntas, dan jam pembelajaran.",
                        "Akses cepat ke materi unduhan, catatan pribadi, kuis, dan sertifikat resmi.",
                        "Fitur Multi-Role Switcher untuk beralih peran (Peserta/Instruktur/Admin) dalam 1 klik tanpa logout.",
                        "Riwayat aktivitas dan tombol lanjutkan belajar dari posisi terakhir."
                    ]
                },

                search: {
                    title: "Pencarian Pintar & Tren Topik",
                    description: "Temukan modul kompetensi dengan cepat dan akurat:",
                    items: [
                        "Pencarian Populer (Trending Searches) untuk mengetahui topik yang banyak dipelajari rekan kerja.",
                        "Rekomendasi materi yang dipersonalisasi berdasarkan bidang kompetensi dan riwayat.",
                        "Filter multi-kategori: tingkat kesulitan, instruktur, serta format materi (SCORM/Video).",
                        "Pencarian cepat dengan toleransi salah ketik (typo-tolerant)."
                    ]
                },

                videoPlayer: {
                    title: "Pemutar Video & SCORM Player",
                    description: "Platform multimedia berkinerja tinggi untuk pengalaman belajar tanpa hambatan:",
                    features: [
                        "Streaming video HD adaptif yang lancar di berbagai kondisi jaringan.",
                        "Player SCORM 1.2 / 2004 terintegrasi untuk menjalankan modul interaktif dan simulasi.",
                        "Pengaturan kecepatan putar (0.5x, 1.0x, 1.25x, 1.5x, 2.0x).",
                        "Penyimpanan progres otomatis — lanjutkan belajar di perangkat lain tanpa mengulang dari awal."
                    ]
                },

                qa: {
                    title: "Pusat Notifikasi & Forum Q&A",
                    description: "Terhubung secara aktif dengan rekan sejawat dan instruktur:",
                    features: [
                        "Pusat Notifikasi Langsung (In-App Bell) di navbar atas untuk pengingat dan pembaruan seketika.",
                        "Forum diskusi dan tanya jawab materi berformat teks kaya (rich-text).",
                        "Dukungan upvote jawaban terbaik serta penanda jawaban terverifikasi dari instruktur.",
                        "Manajemen notifikasi dengan fitur tandai sudah dibaca dan filter notifikasi."
                    ]
                },

                profile: {
                    title: "Manajemen Profil & Kredensial",
                    description: "Tata kelola akun resmi instansi yang terintegrasi dan aman:",
                    options: [
                        "Sinkronisasi profil otomatis dengan SSO Nusa DPD dan Google Workspace.",
                        "Pemeriksaan izin peran serta pergantian profil aktif bagi pengguna multi-peran.",
                        "Portofolio sertifikat digital resmi yang dilengkapi kode verifikasi QR.",
                        "Tombol melayang Feedback untuk menyampaikan saran atau kendala langsung ke tim pengembang."
                    ]
                }
            },

            troubleshooting: {
                title: "Pemecahan Masalah & Solusi",
                subtitle: "Panduan penyelesaian kendala umum yang sering dihadapi pengguna",

                issues: [
                    {
                        problem: "Kendala Masuk Akun (Tidak Bisa Login)",
                        solutions: [
                            "Pastikan Anda menggunakan akun kredensial SSO Nusa DPD yang valid atau email Google Workspace resmi (@dpd.go.id).",
                            "Jika lupa kata sandi SSO, lakukan pemulihan melalui portal resmi SSO Nusa DPD atau hubungi Helpdesk IT Setjen DPD RI (Layanan Lupa Password mandiri pada LMS ditiadakan demi keamanan terpusat).",
                            "Bagi pengguna login Google pertama kali, pastikan menyelesaikan pengisian formulir Onboarding singkat yang muncul di layar.",
                            "Bersihkan cache dan cookies browser jika jendela login SSO atau popup OAuth mengalami kendala memuat.",
                            "Pastikan browser Anda tidak memblokir jendela popup untuk domain LMS dan portal login."
                        ]
                    },
                    {
                        problem: "Modul Interaktif SCORM Tidak Muncul atau Blank",
                        solutions: [
                            "Pastikan browser mengizinkan pemuatan konten iframe dan tidak diblokir oleh ekstensi pihak ketiga.",
                            "Pastikan koneksi internet stabil saat mengunduh aset modul interaktif SCORM.",
                            "Coba lakukan refresh (muat ulang) halaman pembelajaran.",
                            "Gunakan peramban modern berbasis Chromium (Google Chrome, Microsoft Edge) atau Mozilla Firefox terkini."
                        ]
                    },
                    {
                        problem: "Video Terhenti atau Mengalami Buffering",
                        solutions: [
                            "Periksa kestabilan koneksi internet Anda dan jeda proses unduhan berat lainnya.",
                            "Segarkan (refresh) halaman materi untuk menginisialisasi ulang aliran video.",
                            "Nonaktifkan sementara ekstensi browser pemblokir skrip yang berpotensi mengganggu decoder pemutar video.",
                            "Turunkan kecepatan playback atau bersihkan cache browser Anda."
                        ]
                    },
                    {
                        problem: "Kemajuan Belajar (Progres) Tidak Bertambah",
                        solutions: [
                            "Pastikan Anda berada dalam status login aktif saat menyimak materi.",
                            "Pada video pelajaran, tonton video hingga selesai tanpa mempercepat langsung ke detik terakhir.",
                            "Pada modul SCORM, selesaikan seluruh instruksi simulasi/kuis di dalam modul hingga tombol penyelesaian akhir ditekan.",
                            "Hindari menggunakan mode incognito/penyamaran jika browser membatasi penyimpanan data lokal sesi."
                        ]
                    },
                    {
                        problem: "Tidak Bisa Mengunduh atau Memverifikasi Sertifikat",
                        solutions: [
                            "Pastikan progres materi sudah mencapai 100% dan seluruh kuis telah dinyatakan lulus.",
                            "Klik tombol 'Generate Certificate' pada tab Sertifikat jika sertifikat belum diterbitkan otomatis.",
                            "Izinkan jendela pop-up pada browser saat mengeklik tombol 'Download PDF'.",
                            "Pindai QR code pada sertifikat menggunakan kamera ponsel untuk menguji validitas tautan verifikasi resmi."
                        ]
                    },
                    {
                        problem: "Jendela Percakapan Manta AI Tidak Merespons",
                        solutions: [
                            "Periksa koneksi internet Anda untuk memastikan layanan AI di server dapat dijangkau.",
                            "Tutup dan buka kembali jendela percakapan Manta AI melalui avatar di pojok kanan bawah.",
                            "Segarkan (refresh) halaman browser untuk memperbarui token autentikasi sesi Anda."
                        ]
                    }
                ]
            },

            faq: {
                title: "Pertanyaan yang Sering Diajukan (FAQ)",

                questions: [
                    {
                        q: "Bagaimana cara mendaftar akun di LMSetjen DPD RI?",
                        a: "Anda tidak perlu melakukan registrasi manual! Cukup klik tombol 'Masuk' dan login menggunakan akun SSO Nusa DPD atau email kedinasan Google Workspace (@dpd.go.id). Akun Anda akan diaktifkan secara otomatis melalui proses onboarding instansi."
                    },
                    {
                        q: "Apakah ada fitur 'Lupa Password' di LMSetjen DPD RI?",
                        a: "Tidak. Sesuai standar tata kelola keamanan instansi (S-01), kredensial akun dikelola secara terpusat melalui SSO Nusa DPD dan Google Workspace. Jika lupa kata sandi SSO, silakan lakukan reset melalui portal SSO Nusa DPD resmi atau hubungi Helpdesk IT Bagian Kepegawaian."
                    },
                    {
                        q: "Apa itu Manta AI dan bagaimana cara menggunakannya?",
                        a: "Manta AI adalah asisten pembelajaran virtual cerdas. Anda dapat mengeklik avatar Manta AI di sudut kanan bawah layar kapan saja untuk menanyakan isi materi yang sedang dipelajari, meminta ringkasan, membuat kuis latihan, maupun meminta rekomendasi materi pengembangan kompetensi selanjutnya."
                    },
                    {
                        q: "Apa yang dimaksud dengan materi SCORM di versi 1.1.0?",
                        a: "SCORM adalah format standar modul e-learning interaktif internasional. Berbeda dengan video pasif biasa, materi SCORM berisi animasi, simulasi interaktif, latihan berkas, dan kuis terintegrasi yang secara otomatis mencatat capaian nilai ke dalam profil belajar Anda."
                    },
                    {
                        q: "Apakah satu akun dapat memiliki peran sebagai Peserta sekaligus Instruktur?",
                        a: "Ya! LMSetjen DPD RI mendukung fitur Multi-Role. Jika Anda memiliki hak akses ganda, Anda dapat dengan mudah beralih peran antara Peserta, Instruktur, atau Admin melalui menu akun tanpa perlu logout dari sistem."
                    },
                    {
                        q: "Bagaimana cara memeriksa keaslian sertifikat yang diterbitkan?",
                        a: "Setiap sertifikat yang terbit dilengkapi dengan nomor sertifikat resmi dan kode QR unik. Memindai kode QR tersebut dengan kamera ponsel akan langsung membuka halaman verifikasi keabsahan sertifikat di sistem LMSetjen DPD RI."
                    },
                    {
                        q: "Apakah platform ini dapat diakses melalui ponsel cerdas (smartphone)?",
                        a: "Ya, LMSetjen DPD RI dirancang sepenuhnya responsif dan dapat diakses dengan lancar melalui peramban di smartphone, tablet, maupun komputer desktop."
                    },
                    {
                        q: "Bagaimana cara menyampaikan masukan atau melaporkan kendala sistem?",
                        a: "Anda dapat mengeklik tombol melayang 'Feedback' di sisi layar untuk mengirimkan penilaian, saran perbaikan, maupun laporan kendala teknis secara langsung kepada tim pengelola sistem."
                    }
                ]
            }
        }
    }
};
