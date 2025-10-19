import React, { useState } from 'react';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import './UserGuide.css';

function UserGuide() {
    const [language, setLanguage] = useState('id'); // Default to Indonesian

    const handlePrint = () => {
        window.print();
    };

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const content = {
        en: {
            pageTitle: "User Guide",
            pageSubtitle: "Complete guide to using LMSetjen DPD RI Learning Platform",
            lastUpdated: "Last Updated",
            version: "Version 1.0",
            exportPdf: "Export to PDF",
            language: "Language",
            
            tableOfContents: {
                title: "Table of Contents",
                items: [
                    { id: "getting-started", title: "Getting Started", icon: "fa-rocket" },
                    { id: "for-students", title: "For Students", icon: "fa-graduation-cap" },
                    { id: "for-instructors", title: "For Instructors", icon: "fa-chalkboard-teacher" },
                    { id: "features", title: "Platform Features", icon: "fa-star" },
                    { id: "troubleshooting", title: "Troubleshooting", icon: "fa-tools" },
                    { id: "faq", title: "FAQ", icon: "fa-question-circle" }
                ]
            },

            sections: {
                gettingStarted: {
                    title: "Getting Started",
                    intro: "Welcome to LMSetjen DPD RI! This guide will help you get started with our learning platform.",
                    
                    registration: {
                        title: "Creating an Account",
                        steps: [
                            "Visit the homepage and click 'Daftar' (Register) button",
                            "Fill in your information: Full Name, Email, Username, and Password",
                            "Choose your role: Student or Instructor",
                            "Click 'Register' to create your account",
                            "You'll be redirected to login page after successful registration"
                        ]
                    },
                    
                    login: {
                        title: "Logging In",
                        steps: [
                            "Click 'Masuk' (Login) button on the homepage",
                            "Enter your Email/Username and Password",
                            "Click 'Sign In' to access your dashboard",
                            "Use 'Remember Me' to stay logged in on your device"
                        ]
                    },
                    
                    navigation: {
                        title: "Navigating the Platform",
                        description: "The platform has different dashboards based on your role:",
                        dashboards: [
                            { role: "Students", path: "/student/dashboard/", description: "Access your enrolled courses, progress, and learning materials" },
                            { role: "Instructors", path: "/instructor/dashboard/", description: "Manage your courses, students, and teaching content" },
                            { role: "Admins", path: "/admin/dashboard/", description: "Oversee the entire platform, users, and system settings" }
                        ]
                    }
                },

                forStudents: {
                    title: "For Students",
                    subtitle: "Learn how to make the most of your learning experience",
                    
                    browsing: {
                        title: "Browsing Courses",
                        description: "Find the perfect course for your learning goals:",
                        steps: [
                            "Use the search bar to find specific topics",
                            "Browse by categories from the homepage",
                            "View course details including syllabus, instructor, and reviews",
                            "Check course duration, lessons count, and difficulty level"
                        ]
                    },
                    
                    enrolling: {
                        title: "Enrolling in a Course",
                        steps: [
                            "Navigate to the course detail page",
                            "Click 'Enroll Now' button",
                            "Confirm your enrollment",
                            "Access the course from your Student Dashboard"
                        ]
                    },
                    
                    learning: {
                        title: "Taking a Course",
                        features: [
                            {
                                name: "Video Lessons",
                                description: "Watch high-quality video lectures at your own pace. Videos can be paused, rewound, and rewatched anytime."
                            },
                            {
                                name: "Course Materials",
                                description: "Download PDF documents, presentations, and supplementary materials provided by instructors."
                            },
                            {
                                name: "Progress Tracking",
                                description: "Your progress is automatically saved. Track completion percentage on your dashboard."
                            },
                            {
                                name: "Taking Notes",
                                description: "Add personal notes while watching lectures. Notes are saved and can be reviewed anytime."
                            },
                            {
                                name: "Quizzes & Assessments",
                                description: "Test your knowledge with quizzes. You must pass all quizzes to earn your certificate."
                            }
                        ]
                    },
                    
                    interaction: {
                        title: "Interacting with Content",
                        features: [
                            "Ask questions in the Q&A section",
                            "Participate in discussions with other students",
                            "Leave reviews and ratings after completing courses",
                            "Add courses to your wishlist for later"
                        ]
                    },
                    
                    certificates: {
                        title: "Earning Certificates",
                        requirements: [
                            "Complete all lessons in the course (100% completion)",
                            "Pass all quizzes with required scores",
                            "Once eligible, generate your certificate from the Certificate tab",
                            "Download your certificate as PDF for your records"
                        ]
                    }
                },

                forInstructors: {
                    title: "For Instructors",
                    subtitle: "Create and manage engaging learning experiences",
                    
                    creatingCourse: {
                        title: "Creating a New Course",
                        steps: [
                            "Go to Instructor Dashboard",
                            "Click 'Buat Materi' (Create Course)",
                            "Fill in course details: Title, Description, Category, Level",
                            "Upload course thumbnail and preview video",
                            "Click 'Create Course' - it will be saved as Draft"
                        ]
                    },
                    
                    curriculum: {
                        title: "Building Curriculum",
                        description: "After creating a course, add structured content:",
                        steps: [
                            "Access 'Manage Curriculum' from course edit page",
                            "Add sections to organize your course content",
                            "Add lessons within each section",
                            "Upload videos, documents, or other materials for each lesson",
                            "Drag and drop to reorder sections and lessons",
                            "Save your curriculum structure"
                        ]
                    },
                    
                    quizzes: {
                        title: "Creating Quizzes",
                        steps: [
                            "Navigate to 'Manage Quiz' section",
                            "Create quiz with title and description",
                            "Add multiple-choice questions",
                            "Set correct answers and point values",
                            "Configure passing score threshold",
                            "Publish quiz for students"
                        ]
                    },
                    
                    publishing: {
                        title: "Publishing Your Course",
                        requirements: [
                            "Course must have complete information (title, description, thumbnail)",
                            "At least one section with lessons must be added",
                            "At least one quiz should be created",
                            "Click 'Publish Course' button when ready",
                            "Course will be visible to all students after publishing"
                        ]
                    },
                    
                    management: {
                        title: "Managing Students & Engagement",
                        features: [
                            "View enrolled students in 'Murid Saya' (My Students)",
                            "Monitor student progress and completion rates",
                            "Answer student questions in Q&A section",
                            "Read and respond to course reviews",
                            "Track course analytics and performance metrics"
                        ]
                    }
                },

                features: {
                    title: "Platform Features",
                    subtitle: "Explore all the features available on our platform",
                    
                    dashboard: {
                        title: "Personal Dashboard",
                        description: "Your personalized hub for all learning activities",
                        items: [
                            "View enrolled courses and progress",
                            "Access recent activities and notifications",
                            "Quick links to frequently used features",
                            "Performance statistics and achievements"
                        ]
                    },
                    
                    search: {
                        title: "Search & Discovery",
                        description: "Find courses easily with powerful search tools",
                        items: [
                            "Search by course title or keywords",
                            "Filter by category, level, and instructor",
                            "Sort by popularity, rating, or newest",
                            "Browse curated course collections"
                        ]
                    },
                    
                    videoPlayer: {
                        title: "Video Player",
                        description: "Advanced video player with learning-friendly features",
                        features: [
                            "HD video quality with adaptive streaming",
                            "Playback speed control (0.5x to 2x)",
                            "Fullscreen mode for distraction-free learning",
                            "Automatic progress saving",
                            "Resume from where you left off"
                        ]
                    },
                    
                    qa: {
                        title: "Q&A System",
                        description: "Get help and engage with the learning community",
                        features: [
                            "Ask questions specific to course content",
                            "Instructors and peers can provide answers",
                            "Upvote helpful answers",
                            "Search existing questions before asking",
                            "Get email notifications for replies"
                        ]
                    },
                    
                    profile: {
                        title: "Profile Management",
                        description: "Customize your account and settings",
                        options: [
                            "Update personal information and photo",
                            "Change password and security settings",
                            "Manage email preferences",
                            "View your learning history",
                            "Download certificates and transcripts"
                        ]
                    }
                },

                troubleshooting: {
                    title: "Troubleshooting",
                    subtitle: "Common issues and how to solve them",
                    
                    issues: [
                        {
                            problem: "Cannot Login",
                            solutions: [
                                "Check your email/username and password are correct",
                                "Use 'Forgot Password' to reset your password",
                                "Clear browser cache and cookies",
                                "Try a different browser",
                                "Contact support if issue persists"
                            ]
                        },
                        {
                            problem: "Video Not Playing",
                            solutions: [
                                "Check your internet connection",
                                "Try refreshing the page",
                                "Clear browser cache",
                                "Disable browser extensions temporarily",
                                "Try a different browser (Chrome recommended)",
                                "Ensure your browser is up to date"
                            ]
                        },
                        {
                            problem: "Progress Not Saving",
                            solutions: [
                                "Ensure you're logged in",
                                "Complete the lesson fully before moving on",
                                "Check your internet connection",
                                "Don't use incognito/private browsing mode",
                                "Wait a few seconds after completing a lesson"
                            ]
                        },
                        {
                            problem: "Cannot Download Certificate",
                            solutions: [
                                "Verify you've completed 100% of lessons",
                                "Confirm all quizzes are passed",
                                "Click 'Generate Certificate' button first",
                                "Allow pop-ups in your browser",
                                "Check your Downloads folder",
                                "Try using a different browser"
                            ]
                        },
                        {
                            problem: "File Upload Failed",
                            solutions: [
                                "Check file size is within limits (5MB for images, 100MB for videos)",
                                "Ensure file format is supported",
                                "Check your internet connection",
                                "Try a smaller file size",
                                "Clear browser cache and retry"
                            ]
                        }
                    ]
                },

                faq: {
                    title: "Frequently Asked Questions (FAQ)",
                    
                    questions: [
                        {
                            q: "Is LMSetjen DPD RI free to use?",
                            a: "Yes, the platform is provided free of charge for all staff members of Sekretariat Jenderal DPD RI."
                        },
                        {
                            q: "Can I access courses on mobile devices?",
                            a: "Yes! Our platform is fully responsive and works on smartphones and tablets. Simply use your mobile browser to access the site."
                        },
                        {
                            q: "How do I become an instructor?",
                            a: "When registering, select 'Instructor' as your role. Your instructor account will need to be approved by administrators."
                        },
                        {
                            q: "Can I enroll in multiple courses at once?",
                            a: "Absolutely! There's no limit to how many courses you can enroll in simultaneously."
                        },
                        {
                            q: "How long do I have access to a course?",
                            a: "Once enrolled, you have unlimited access to the course materials. Learn at your own pace!"
                        },
                        {
                            q: "Are certificates recognized officially?",
                            a: "Certificates are issued by Sekretariat Jenderal DPD RI for internal professional development purposes."
                        },
                        {
                            q: "Can I download course videos?",
                            a: "Videos are for streaming only and cannot be downloaded. However, you can download supplementary materials and documents."
                        },
                        {
                            q: "What browsers are supported?",
                            a: "We recommend using the latest versions of Chrome, Firefox, Safari, or Edge for the best experience."
                        },
                        {
                            q: "How do I report a technical issue?",
                            a: "Contact your system administrator or use the support channels provided by your organization."
                        },
                        {
                            q: "Can I change my role from Student to Instructor?",
                            a: "Yes, contact the platform administrator to update your role and permissions."
                        }
                    ]
                }
            }
        },
        id: {
            pageTitle: "Panduan Pengguna",
            pageSubtitle: "Panduan lengkap menggunakan Platform Pembelajaran LMSetjen DPD RI",
            lastUpdated: "Terakhir Diperbarui",
            version: "Versi 1.0",
            exportPdf: "Ekspor ke PDF",
            language: "Bahasa",
            
            tableOfContents: {
                title: "Daftar Isi",
                items: [
                    { id: "getting-started", title: "Memulai", icon: "fa-rocket" },
                    { id: "for-students", title: "Untuk Peserta", icon: "fa-graduation-cap" },
                    { id: "for-instructors", title: "Untuk Pemateri", icon: "fa-chalkboard-teacher" },
                    { id: "features", title: "Fitur Platform", icon: "fa-star" },
                    { id: "troubleshooting", title: "Pemecahan Masalah", icon: "fa-tools" },
                    { id: "faq", title: "FAQ", icon: "fa-question-circle" }
                ]
            },

            sections: {
                gettingStarted: {
                    title: "Memulai",
                    intro: "Selamat datang di LMSetjen DPD RI! Panduan ini akan membantu Anda memulai menggunakan platform pembelajaran kami.",
                    
                    registration: {
                        title: "Membuat Akun",
                        steps: [
                            "Kunjungi halaman utama dan klik tombol 'Daftar'",
                            "Isi informasi Anda: Nama Lengkap, Email, Username, dan Password",
                            "Pilih peran Anda: Peserta atau Pemateri",
                            "Klik 'Register' untuk membuat akun",
                            "Anda akan diarahkan ke halaman login setelah registrasi berhasil"
                        ]
                    },
                    
                    login: {
                        title: "Masuk ke Akun",
                        steps: [
                            "Klik tombol 'Masuk' di halaman utama",
                            "Masukkan Email/Username dan Password Anda",
                            "Klik 'Sign In' untuk mengakses dashboard",
                            "Gunakan 'Remember Me' untuk tetap login di perangkat Anda"
                        ]
                    },
                    
                    navigation: {
                        title: "Navigasi Platform",
                        description: "Platform memiliki dashboard berbeda berdasarkan peran Anda:",
                        dashboards: [
                            { role: "Peserta", path: "/student/dashboard/", description: "Akses materi yang Anda ikuti, progres, dan bahan pembelajaran" },
                            { role: "Pemateri", path: "/instructor/dashboard/", description: "Kelola materi, peserta, dan konten pembelajaran Anda" },
                            { role: "Admin", path: "/admin/dashboard/", description: "Awasi seluruh platform, pengguna, dan pengaturan sistem" }
                        ]
                    }
                },

                forStudents: {
                    title: "Untuk Peserta",
                    subtitle: "Pelajari cara memaksimalkan pengalaman belajar Anda",
                    
                    browsing: {
                        title: "Menjelajahi Materi",
                        description: "Temukan materi yang sempurna untuk tujuan belajar Anda:",
                        steps: [
                            "Gunakan search bar untuk mencari topik tertentu",
                            "Telusuri berdasarkan kategori dari halaman utama",
                            "Lihat detail materi termasuk silabus, pemateri, dan review",
                            "Periksa durasi, jumlah pelajaran, dan tingkat kesulitan"
                        ]
                    },
                    
                    enrolling: {
                        title: "Mendaftar Materi",
                        steps: [
                            "Buka halaman detail materi",
                            "Klik tombol 'Enroll Now'",
                            "Konfirmasi pendaftaran Anda",
                            "Akses materi dari Dashboard Peserta Anda"
                        ]
                    },
                    
                    learning: {
                        title: "Mengikuti Materi",
                        features: [
                            {
                                name: "Video Pembelajaran",
                                description: "Tonton video berkualitas tinggi sesuai kecepatan Anda. Video dapat dijeda, diulang, dan ditonton kapan saja."
                            },
                            {
                                name: "Materi Pembelajaran",
                                description: "Unduh dokumen PDF, presentasi, dan materi tambahan dari pemateri."
                            },
                            {
                                name: "Pelacakan Progres",
                                description: "Progres Anda otomatis tersimpan. Lihat persentase penyelesaian di dashboard."
                            },
                            {
                                name: "Catatan Pribadi",
                                description: "Tambahkan catatan pribadi saat menonton. Catatan tersimpan dan dapat dilihat kapan saja."
                            },
                            {
                                name: "Kuis & Penilaian",
                                description: "Uji pengetahuan Anda dengan kuis. Anda harus lulus semua kuis untuk mendapat sertifikat."
                            }
                        ]
                    },
                    
                    interaction: {
                        title: "Berinteraksi dengan Konten",
                        features: [
                            "Ajukan pertanyaan di bagian Q&A",
                            "Berpartisipasi dalam diskusi dengan peserta lain",
                            "Berikan review dan rating setelah menyelesaikan materi",
                            "Tambahkan materi ke wishlist untuk nanti"
                        ]
                    },
                    
                    certificates: {
                        title: "Mendapatkan Sertifikat",
                        requirements: [
                            "Selesaikan semua pelajaran dalam materi (100% completion)",
                            "Lulus semua kuis dengan nilai yang dipersyaratkan",
                            "Setelah memenuhi syarat, generate sertifikat dari tab Certificate",
                            "Unduh sertifikat Anda sebagai PDF untuk arsip"
                        ]
                    }
                },

                forInstructors: {
                    title: "Untuk Pemateri",
                    subtitle: "Buat dan kelola pengalaman pembelajaran yang menarik",
                    
                    creatingCourse: {
                        title: "Membuat Materi Baru",
                        steps: [
                            "Buka Dashboard Pemateri",
                            "Klik 'Buat Materi' (Create Course)",
                            "Isi detail materi: Judul, Deskripsi, Kategori, Level",
                            "Upload thumbnail dan video preview",
                            "Klik 'Create Course' - akan disimpan sebagai Draft"
                        ]
                    },
                    
                    curriculum: {
                        title: "Membangun Kurikulum",
                        description: "Setelah membuat materi, tambahkan konten terstruktur:",
                        steps: [
                            "Akses 'Manage Curriculum' dari halaman edit materi",
                            "Tambahkan section untuk mengorganisir konten",
                            "Tambahkan pelajaran dalam setiap section",
                            "Upload video, dokumen, atau materi lain untuk tiap pelajaran",
                            "Drag dan drop untuk mengatur ulang section dan pelajaran",
                            "Simpan struktur kurikulum Anda"
                        ]
                    },
                    
                    quizzes: {
                        title: "Membuat Kuis",
                        steps: [
                            "Navigasi ke bagian 'Manage Quiz'",
                            "Buat kuis dengan judul dan deskripsi",
                            "Tambahkan pertanyaan pilihan ganda",
                            "Tetapkan jawaban benar dan nilai poin",
                            "Konfigurasi ambang batas kelulusan",
                            "Publikasikan kuis untuk peserta"
                        ]
                    },
                    
                    publishing: {
                        title: "Mempublikasikan Materi",
                        requirements: [
                            "Materi harus memiliki informasi lengkap (judul, deskripsi, thumbnail)",
                            "Minimal satu section dengan pelajaran harus ditambahkan",
                            "Minimal satu kuis harus dibuat",
                            "Klik tombol 'Publish Course' saat siap",
                            "Materi akan terlihat oleh semua peserta setelah dipublikasi"
                        ]
                    },
                    
                    management: {
                        title: "Mengelola Peserta & Engagement",
                        features: [
                            "Lihat peserta yang terdaftar di 'Murid Saya'",
                            "Monitor progres dan tingkat penyelesaian peserta",
                            "Jawab pertanyaan peserta di bagian Q&A",
                            "Baca dan tanggapi review materi",
                            "Lacak analitik dan metrik performa materi"
                        ]
                    }
                },

                features: {
                    title: "Fitur Platform",
                    subtitle: "Jelajahi semua fitur yang tersedia di platform kami",
                    
                    dashboard: {
                        title: "Dashboard Pribadi",
                        description: "Hub personal Anda untuk semua aktivitas pembelajaran",
                        items: [
                            "Lihat materi yang diikuti dan progres",
                            "Akses aktivitas terkini dan notifikasi",
                            "Link cepat ke fitur yang sering digunakan",
                            "Statistik performa dan pencapaian"
                        ]
                    },
                    
                    search: {
                        title: "Pencarian & Penemuan",
                        description: "Temukan materi dengan mudah menggunakan alat pencarian",
                        items: [
                            "Cari berdasarkan judul atau kata kunci",
                            "Filter berdasarkan kategori, level, dan pemateri",
                            "Urutkan berdasarkan popularitas, rating, atau terbaru",
                            "Telusuri koleksi materi pilihan"
                        ]
                    },
                    
                    videoPlayer: {
                        title: "Pemutar Video",
                        description: "Pemutar video canggih dengan fitur ramah pembelajaran",
                        features: [
                            "Kualitas video HD dengan streaming adaptif",
                            "Kontrol kecepatan playback (0.5x hingga 2x)",
                            "Mode fullscreen untuk pembelajaran tanpa gangguan",
                            "Penyimpanan progres otomatis",
                            "Lanjutkan dari tempat terakhir Anda berhenti"
                        ]
                    },
                    
                    qa: {
                        title: "Sistem Q&A",
                        description: "Dapatkan bantuan dan berinteraksi dengan komunitas",
                        features: [
                            "Ajukan pertanyaan spesifik tentang konten",
                            "Pemateri dan rekan dapat memberikan jawaban",
                            "Upvote jawaban yang membantu",
                            "Cari pertanyaan yang sudah ada sebelum bertanya",
                            "Dapatkan notifikasi email untuk balasan"
                        ]
                    },
                    
                    profile: {
                        title: "Manajemen Profil",
                        description: "Sesuaikan akun dan pengaturan Anda",
                        options: [
                            "Perbarui informasi pribadi dan foto",
                            "Ubah password dan pengaturan keamanan",
                            "Kelola preferensi email",
                            "Lihat riwayat pembelajaran Anda",
                            "Unduh sertifikat dan transkrip"
                        ]
                    }
                },

                troubleshooting: {
                    title: "Pemecahan Masalah",
                    subtitle: "Masalah umum dan cara mengatasinya",
                    
                    issues: [
                        {
                            problem: "Tidak Bisa Login",
                            solutions: [
                                "Periksa email/username dan password sudah benar",
                                "Gunakan 'Forgot Password' untuk reset password",
                                "Hapus cache dan cookies browser",
                                "Coba browser yang berbeda",
                                "Hubungi dukungan jika masalah berlanjut"
                            ]
                        },
                        {
                            problem: "Video Tidak Bisa Diputar",
                            solutions: [
                                "Periksa koneksi internet Anda",
                                "Coba refresh halaman",
                                "Hapus cache browser",
                                "Nonaktifkan ekstensi browser sementara",
                                "Coba browser berbeda (Chrome direkomendasikan)",
                                "Pastikan browser Anda sudah update"
                            ]
                        },
                        {
                            problem: "Progres Tidak Tersimpan",
                            solutions: [
                                "Pastikan Anda sudah login",
                                "Selesaikan pelajaran sepenuhnya sebelum lanjut",
                                "Periksa koneksi internet",
                                "Jangan gunakan mode incognito/private browsing",
                                "Tunggu beberapa detik setelah menyelesaikan pelajaran"
                            ]
                        },
                        {
                            problem: "Tidak Bisa Download Sertifikat",
                            solutions: [
                                "Verifikasi Anda telah menyelesaikan 100% pelajaran",
                                "Konfirmasi semua kuis telah lulus",
                                "Klik tombol 'Generate Certificate' terlebih dahulu",
                                "Izinkan pop-up di browser Anda",
                                "Periksa folder Downloads",
                                "Coba gunakan browser berbeda"
                            ]
                        },
                        {
                            problem: "Upload File Gagal",
                            solutions: [
                                "Periksa ukuran file sesuai batas (5MB untuk gambar, 100MB untuk video)",
                                "Pastikan format file didukung",
                                "Periksa koneksi internet",
                                "Coba file dengan ukuran lebih kecil",
                                "Hapus cache browser dan coba lagi"
                            ]
                        }
                    ]
                },

                faq: {
                    title: "Pertanyaan yang Sering Diajukan (FAQ)",
                    
                    questions: [
                        {
                            q: "Apakah LMSetjen DPD RI gratis?",
                            a: "Ya, platform ini disediakan gratis untuk semua pegawai Sekretariat Jenderal DPD RI."
                        },
                        {
                            q: "Bisakah saya mengakses materi di perangkat mobile?",
                            a: "Ya! Platform kami fully responsive dan berfungsi di smartphone dan tablet. Cukup gunakan browser mobile untuk mengakses situs."
                        },
                        {
                            q: "Bagaimana cara menjadi pemateri?",
                            a: "Saat registrasi, pilih 'Instructor' sebagai peran Anda. Akun pemateri perlu disetujui oleh administrator."
                        },
                        {
                            q: "Bisakah saya mengikuti beberapa materi sekaligus?",
                            a: "Tentu saja! Tidak ada batasan berapa banyak materi yang bisa Anda ikuti secara bersamaan."
                        },
                        {
                            q: "Berapa lama saya bisa mengakses suatu materi?",
                            a: "Setelah terdaftar, Anda memiliki akses unlimited ke materi. Belajar sesuai kecepatan Anda!"
                        },
                        {
                            q: "Apakah sertifikat diakui secara resmi?",
                            a: "Sertifikat diterbitkan oleh Sekretariat Jenderal DPD RI untuk tujuan pengembangan profesional internal."
                        },
                        {
                            q: "Bisakah saya download video materi?",
                            a: "Video hanya untuk streaming dan tidak bisa didownload. Namun, Anda bisa download materi tambahan dan dokumen."
                        },
                        {
                            q: "Browser apa yang didukung?",
                            a: "Kami merekomendasikan versi terbaru Chrome, Firefox, Safari, atau Edge untuk pengalaman terbaik."
                        },
                        {
                            q: "Bagaimana cara melaporkan masalah teknis?",
                            a: "Hubungi administrator sistem atau gunakan saluran dukungan yang disediakan organisasi Anda."
                        },
                        {
                            q: "Bisakah saya mengubah peran dari Peserta ke Pemateri?",
                            a: "Ya, hubungi administrator platform untuk memperbarui peran dan izin Anda."
                        }
                    ]
                }
            }
        }
    };

    const t = content[language];

    return (
        <>
            <BaseHeader />
            
            <div className="user-guide-container">
                {/* Header */}
                <div className="guide-header no-print">
                    <div className="container">
                        <div className="header-content">
                            <div className="header-title-section">
                                <h1 className="guide-main-title">
                                    <i className="fas fa-book-reader me-3"></i>
                                    {t.pageTitle}
                                </h1>
                                <p className="guide-subtitle">{t.pageSubtitle}</p>
                                <div className="guide-meta">
                                    <span className="meta-item">
                                        <i className="fas fa-code-branch me-2"></i>
                                        {t.version}
                                    </span>
                                    <span className="meta-item">
                                        <i className="fas fa-calendar-alt me-2"></i>
                                        {t.lastUpdated}: October 20, 2025
                                    </span>
                                </div>
                            </div>
                            <div className="header-actions">
                                <select 
                                    className="language-selector"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                >
                                    <option value="en">🇬🇧 English</option>
                                    <option value="id">🇮🇩 Indonesia</option>
                                </select>
                                <button onClick={handlePrint} className="btn-export">
                                    <i className="fas fa-file-pdf me-2"></i>
                                    {t.exportPdf}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table of Contents */}
                <div className="container">
                    <div className="toc-section no-print">
                        <h2 className="toc-title">{t.tableOfContents.title}</h2>
                        <div className="toc-grid">
                            {t.tableOfContents.items.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => scrollToSection(item.id)}
                                    className="toc-item"
                                >
                                    <i className={`fas ${item.icon} toc-icon`}></i>
                                    <span>{item.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="guide-content">
                        {/* Getting Started */}
                        <section id="getting-started" className="guide-section">
                            <h2 className="section-title">
                                <i className="fas fa-rocket me-3"></i>
                                {t.sections.gettingStarted.title}
                            </h2>
                            <p className="section-intro">{t.sections.gettingStarted.intro}</p>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-user-plus me-2"></i>
                                    {t.sections.gettingStarted.registration.title}
                                </h3>
                                <ol className="step-list">
                                    {t.sections.gettingStarted.registration.steps.map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-sign-in-alt me-2"></i>
                                    {t.sections.gettingStarted.login.title}
                                </h3>
                                <ol className="step-list">
                                    {t.sections.gettingStarted.login.steps.map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-compass me-2"></i>
                                    {t.sections.gettingStarted.navigation.title}
                                </h3>
                                <p>{t.sections.gettingStarted.navigation.description}</p>
                                <div className="dashboard-cards">
                                    {t.sections.gettingStarted.navigation.dashboards.map((dash, index) => (
                                        <div key={index} className="dashboard-card">
                                            <h4>{dash.role}</h4>
                                            <code className="path-code">{dash.path}</code>
                                            <p>{dash.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* For Students */}
                        <section id="for-students" className="guide-section">
                            <h2 className="section-title">
                                <i className="fas fa-graduation-cap me-3"></i>
                                {t.sections.forStudents.title}
                            </h2>
                            <p className="section-intro">{t.sections.forStudents.subtitle}</p>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-search me-2"></i>
                                    {t.sections.forStudents.browsing.title}
                                </h3>
                                <p>{t.sections.forStudents.browsing.description}</p>
                                <ul className="feature-list">
                                    {t.sections.forStudents.browsing.steps.map((step, index) => (
                                        <li key={index}><i className="fas fa-check-circle me-2"></i>{step}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-pen me-2"></i>
                                    {t.sections.forStudents.enrolling.title}
                                </h3>
                                <ol className="step-list">
                                    {t.sections.forStudents.enrolling.steps.map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-book-open me-2"></i>
                                    {t.sections.forStudents.learning.title}
                                </h3>
                                <div className="feature-grid">
                                    {t.sections.forStudents.learning.features.map((feature, index) => (
                                        <div key={index} className="feature-card">
                                            <h4>{feature.name}</h4>
                                            <p>{feature.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-comments me-2"></i>
                                    {t.sections.forStudents.interaction.title}
                                </h3>
                                <ul className="feature-list">
                                    {t.sections.forStudents.interaction.features.map((feature, index) => (
                                        <li key={index}><i className="fas fa-check-circle me-2"></i>{feature}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-certificate me-2"></i>
                                    {t.sections.forStudents.certificates.title}
                                </h3>
                                <div className="requirements-box">
                                    <h4>{language === 'en' ? 'Requirements:' : 'Persyaratan:'}</h4>
                                    <ol className="requirement-list">
                                        {t.sections.forStudents.certificates.requirements.map((req, index) => (
                                            <li key={index}>{req}</li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </section>

                        {/* For Instructors */}
                        <section id="for-instructors" className="guide-section">
                            <h2 className="section-title">
                                <i className="fas fa-chalkboard-teacher me-3"></i>
                                {t.sections.forInstructors.title}
                            </h2>
                            <p className="section-intro">{t.sections.forInstructors.subtitle}</p>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-plus-circle me-2"></i>
                                    {t.sections.forInstructors.creatingCourse.title}
                                </h3>
                                <ol className="step-list">
                                    {t.sections.forInstructors.creatingCourse.steps.map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-list-ul me-2"></i>
                                    {t.sections.forInstructors.curriculum.title}
                                </h3>
                                <p>{t.sections.forInstructors.curriculum.description}</p>
                                <ol className="step-list">
                                    {t.sections.forInstructors.curriculum.steps.map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-question-circle me-2"></i>
                                    {t.sections.forInstructors.quizzes.title}
                                </h3>
                                <ol className="step-list">
                                    {t.sections.forInstructors.quizzes.steps.map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-globe me-2"></i>
                                    {t.sections.forInstructors.publishing.title}
                                </h3>
                                <div className="requirements-box">
                                    <h4>{language === 'en' ? 'Publishing Requirements:' : 'Persyaratan Publikasi:'}</h4>
                                    <ul className="requirement-list">
                                        {t.sections.forInstructors.publishing.requirements.map((req, index) => (
                                            <li key={index}><i className="fas fa-check me-2"></i>{req}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="subsection">
                                <h3 className="subsection-title">
                                    <i className="fas fa-users-cog me-2"></i>
                                    {t.sections.forInstructors.management.title}
                                </h3>
                                <ul className="feature-list">
                                    {t.sections.forInstructors.management.features.map((feature, index) => (
                                        <li key={index}><i className="fas fa-check-circle me-2"></i>{feature}</li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        {/* Platform Features */}
                        <section id="features" className="guide-section">
                            <h2 className="section-title">
                                <i className="fas fa-star me-3"></i>
                                {t.sections.features.title}
                            </h2>
                            <p className="section-intro">{t.sections.features.subtitle}</p>

                            <div className="features-showcase">
                                <div className="feature-showcase-item">
                                    <div className="showcase-icon">
                                        <i className="fas fa-tachometer-alt"></i>
                                    </div>
                                    <h3>{t.sections.features.dashboard.title}</h3>
                                    <p className="showcase-desc">{t.sections.features.dashboard.description}</p>
                                    <ul className="showcase-list">
                                        {t.sections.features.dashboard.items.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="feature-showcase-item">
                                    <div className="showcase-icon">
                                        <i className="fas fa-search-plus"></i>
                                    </div>
                                    <h3>{t.sections.features.search.title}</h3>
                                    <p className="showcase-desc">{t.sections.features.search.description}</p>
                                    <ul className="showcase-list">
                                        {t.sections.features.search.items.map((item, index) => (
                                            <li key={index}>{item}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="feature-showcase-item">
                                    <div className="showcase-icon">
                                        <i className="fas fa-play-circle"></i>
                                    </div>
                                    <h3>{t.sections.features.videoPlayer.title}</h3>
                                    <p className="showcase-desc">{t.sections.features.videoPlayer.description}</p>
                                    <ul className="showcase-list">
                                        {t.sections.features.videoPlayer.features.map((feature, index) => (
                                            <li key={index}>{feature}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="feature-showcase-item">
                                    <div className="showcase-icon">
                                        <i className="fas fa-question-circle"></i>
                                    </div>
                                    <h3>{t.sections.features.qa.title}</h3>
                                    <p className="showcase-desc">{t.sections.features.qa.description}</p>
                                    <ul className="showcase-list">
                                        {t.sections.features.qa.features.map((feature, index) => (
                                            <li key={index}>{feature}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="feature-showcase-item">
                                    <div className="showcase-icon">
                                        <i className="fas fa-user-circle"></i>
                                    </div>
                                    <h3>{t.sections.features.profile.title}</h3>
                                    <p className="showcase-desc">{t.sections.features.profile.description}</p>
                                    <ul className="showcase-list">
                                        {t.sections.features.profile.options.map((option, index) => (
                                            <li key={index}>{option}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* Troubleshooting */}
                        <section id="troubleshooting" className="guide-section">
                            <h2 className="section-title">
                                <i className="fas fa-tools me-3"></i>
                                {t.sections.troubleshooting.title}
                            </h2>
                            <p className="section-intro">{t.sections.troubleshooting.subtitle}</p>

                            <div className="troubleshooting-grid">
                                {t.sections.troubleshooting.issues.map((issue, index) => (
                                    <div key={index} className="trouble-card">
                                        <h3 className="trouble-problem">
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            {issue.problem}
                                        </h3>
                                        <div className="trouble-solutions">
                                            <h4>{language === 'en' ? 'Solutions:' : 'Solusi:'}</h4>
                                            <ul>
                                                {issue.solutions.map((solution, idx) => (
                                                    <li key={idx}>{solution}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* FAQ */}
                        <section id="faq" className="guide-section">
                            <h2 className="section-title">
                                <i className="fas fa-question-circle me-3"></i>
                                {t.sections.faq.title}
                            </h2>

                            <div className="faq-list">
                                {t.sections.faq.questions.map((item, index) => (
                                    <div key={index} className="faq-item">
                                        <h3 className="faq-question">
                                            <i className="fas fa-question me-2"></i>
                                            {item.q}
                                        </h3>
                                        <p className="faq-answer">
                                            <i className="fas fa-answer me-2"></i>
                                            {item.a}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            <Footer />
        </>
    );
}

export default UserGuide;
