import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiInstance from "../../utils/axios";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import Footer from "../partials/Footer";
import AdminHeader from "../partials/AdminHeader";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { DEFAULT_IMAGE_URL, DEFAULT_AVATAR_URL, getMediaUrl } from "../../utils/constants";
import PptxRenderer from "../../components/Common/PptxRenderer";
import PdfRenderer from "../../components/Common/PdfRenderer";
import "./AdminCourseReviewDetail.css";

/**
 * Admin Course Review Detail Page
 * High-Density, Modern & Compact Design for LMSetjen DPD RI
 * 
 * Features:
 * - 2-Column Responsive Layout (Main Content 8-col + Sticky Review Sidebar 4-col)
 * - Drastically minimized whitespace with compact card paddings & high information density
 * - Live/Real values dynamically calculated (curriculum, videos, SCORM, duration, quizzes, XP, ratings, etc.)
 * - Quick Audit Tabs: "Kurikulum & Materi", "Kuis & Evaluasi", "Gamifikasi", "Deskripsi & Silabus", "Semua Konten"
 * - Instant "Buka Semua" / "Tutup Semua" for curriculum sections & quizzes
 * - Interactive Inline & Modal Video Players for intro video and lesson videos (supports MP4, YouTube, Google Drive)
 * - Sticky Decision Bar with Approve / Reject workflows and previous rejection notice
 */

// Helper: detect video source and styling
const detectVideoSource = (url) => {
    if (!url) return { type: 'none', label: 'Tidak Ada Video', icon: 'fas fa-video-slash', color: '#64748b' };
    const clean = String(url).toLowerCase();
    if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
        return { type: 'youtube', label: 'YouTube Video', icon: 'fab fa-youtube', color: '#ef4444', badgeClass: 'acrd-badge-yt' };
    }
    if (clean.includes('drive.google.com')) {
        return { type: 'google_drive', label: 'Google Drive', icon: 'fab fa-google-drive', color: '#2563eb', badgeClass: 'acrd-badge-gdrive' };
    }
    return { type: 'upload', label: 'Video Terunggah (MP4)', icon: 'fas fa-file-video', color: '#0d9488', badgeClass: 'acrd-badge-upload' };
};

// Helper: convert embed URL to a direct viewable URL for opening in a new tab
const convertEmbedUrlToViewable = (fileUrl, videoType) => {
    if (!fileUrl) return null;
    if (videoType === "youtube" || fileUrl.includes("youtube") || fileUrl.includes("youtu.be")) {
        const youtubeMatch = fileUrl.match(/(?:embed\/|v=|\/v\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
        if (youtubeMatch?.[1]) {
            return `https://www.youtube.com/watch?v=${youtubeMatch[1]}`;
        }
    } else if (videoType === "google_drive" || fileUrl.includes("drive.google.com")) {
        const driveMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (driveMatch?.[1]) {
            return `https://drive.google.com/file/d/${driveMatch[1]}/view`;
        }
    }
    return fileUrl;
};

// Helper: get standard embed URL for iframe players
const getEmbedUrl = (url) => {
    if (!url) return "";
    const clean = String(url);
    if (clean.includes("youtube.com/embed/")) return clean;
    const ytMatch = clean.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11})/);
    if (ytMatch && ytMatch[1]) {
        return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    if (clean.includes("drive.google.com")) {
        const driveMatch = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (driveMatch && driveMatch[1]) {
            return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
        }
    }
    return clean;
};

// Gamification metadata mapping
const GAME_TYPE_META = {
    crossword: {
        label: "Teka-Teki Silang (TTS)",
        shortLabel: "TTS",
        icon: "fas fa-border-all",
        color: "#0284c7",
        bgColor: "#e0f2fe",
        borderColor: "#bae6fd"
    },
    word_search: {
        label: "Cari Kata (Word Search)",
        shortLabel: "Cari Kata",
        icon: "fas fa-search",
        color: "#0d9488",
        bgColor: "#ccfbf1",
        borderColor: "#99f6e4"
    },
    anagram: {
        label: "Susun Kata (Anagram)",
        shortLabel: "Anagram",
        icon: "fas fa-random",
        color: "#d97706",
        bgColor: "#fef3c7",
        borderColor: "#fde68a"
    },
    memory_match: {
        label: "Pencocokan Memori (Memory Match)",
        shortLabel: "Memory Match",
        icon: "fas fa-th-large",
        color: "#7c3aed",
        bgColor: "#ede9fe",
        borderColor: "#ddd6fe"
    }
};

// Format seconds into readable Indonesian duration string
const formatDuration = (totalSeconds) => {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return "0 Menit";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
        return `${hours} Jam ${minutes > 0 ? `${minutes} Mnt` : ""}`.trim();
    }
    if (minutes > 0) {
        return `${minutes} Menit ${seconds > 0 ? `${seconds} dtk` : ""}`.trim();
    }
    return `${seconds} Detik`;
};

// Format individual lecture duration
const formatLectureDuration = (lecture) => {
    if (lecture.duration_seconds && lecture.duration_seconds > 0) {
        const mins = Math.floor(lecture.duration_seconds / 60);
        const secs = String(Math.floor(lecture.duration_seconds % 60)).padStart(2, "0");
        return `${mins}:${secs}`;
    }
    if (lecture.content_duration && lecture.content_duration !== "0m 0s") {
        return lecture.content_duration;
    }
    return null;
};

// Target audience text formatter
const getTargetAudienceText = (audience) => {
    const map = {
        internal: "Khusus Internal Setjen DPD RI",
        asn: "Khusus ASN",
        umum: "Terbuka untuk Umum",
        pegawai: "Khusus Pegawai Setjen DPD RI"
    };
    return map[audience] || audience || "Khusus Pegawai Setjen DPD RI";
};

// Course type text formatter
const getCourseTypeText = (type) => {
    const map = {
        standard: "Standar (Video/Materi)",
        scorm_12: "E-Learning SCORM 1.2",
        h5p: "H5P Interaktif"
    };
    return map[type] || type || "Standar (Video/Materi)";
};

// Platform status badge info
const getPlatformStatusInfo = (status) => {
    switch (status) {
        case "Published":
            return {
                label: "Dipublikasikan",
                icon: "fas fa-check-circle",
                className: "acrd-status-published",
                description: "Kursus ini aktif dan dapat diakses peserta didik."
            };
        case "Review":
            return {
                label: "Menunggu Review",
                icon: "fas fa-clock",
                className: "acrd-status-review",
                description: "Kursus diajukan instruktur dan menunggu keputusan Admin."
            };
        case "Draft":
            return {
                label: "Draf Instruktur",
                icon: "fas fa-pencil-alt",
                className: "acrd-status-draft",
                description: "Kursus masih dalam tahap penyusunan oleh instruktur."
            };
        case "Rejected":
            return {
                label: "Ditolak",
                icon: "fas fa-times-circle",
                className: "acrd-status-rejected",
                description: "Kursus ditolak dan instruktur diminta melakukan perbaikan."
            };
        case "Disabled":
            return {
                label: "Dinonaktifkan",
                icon: "fas fa-ban",
                className: "acrd-status-disabled",
                description: "Kursus dinonaktifkan dari peredaran publik."
            };
        default:
            return {
                label: status || "Belum Ditentukan",
                icon: "fas fa-info-circle",
                className: "acrd-status-default",
                description: "Status kursus saat ini."
            };
    }
};

function AdminCourseReviewDetail() {
    const { course_id } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [course, setCourse] = useState(null);
    const [activeTab, setActiveTab] = useState("curriculum"); // 'curriculum' | 'quizzes' | 'games' | 'overview' | 'all'
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedQuizzes, setExpandedQuizzes] = useState({});
    const [expandedGames, setExpandedGames] = useState({});
    const [approving, setApproving] = useState(false);
    const [showIntroVideoInline, setShowIntroVideoInline] = useState(false);
    const [expandedLecturePreview, setExpandedLecturePreview] = useState({});

    useEffect(() => {
        fetchCourseDetail();
    }, [course_id]);

    const fetchCourseDetail = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`teacher/course-detail/${course_id}/`);
            console.log("[AdminCourseReviewDetail] Live Course Data:", response.data);
            const data = response.data;
            setCourse(data);

            // Auto-expand first section, first quiz, and first game for immediate visibility
            if (data?.curriculum?.length > 0) {
                const firstSecId = data.curriculum[0].variant_id || data.curriculum[0].id;
                if (firstSecId) setExpandedSections({ [firstSecId]: true });
            }
            if (data?.quizzes?.length > 0) {
                const firstQuizId = data.quizzes[0].quiz_id || data.quizzes[0].id;
                if (firstQuizId) setExpandedQuizzes({ [firstQuizId]: true });
            }
            if (data?.games?.length > 0) {
                const firstGameId = data.games[0].id || data.games[0].game_id;
                if (firstGameId) setExpandedGames({ [firstGameId]: true });
            }
        } catch (error) {
            console.error("Error fetching course detail:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kursus",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
            setTimeout(() => navigate("/admin/content-management/?tab=courses"), 2000);
        } finally {
            setLoading(false);
        }
    };

    // Calculate real live metrics dynamically from raw data
    const liveStats = useMemo(() => {
        if (!course) {
            return {
                sectionsCount: 0,
                lessonsCount: 0,
                curriculumQuizzesCount: 0,
                videoCount: 0,
                scormCount: 0,
                presentationCount: 0,
                pdfCount: 0,
                audioCount: 0,
                docCount: 0,
                totalDurationSeconds: 0,
                totalDurationFormatted: "0 Menit",
                quizzesCount: 0,
                totalQuestions: 0,
                gamesCount: 0,
                totalGameXP: 0,
                featuresCount: 0,
                requirementsCount: 0,
                outcomesCount: 0
            };
        }

        const sections = Array.isArray(course.curriculum) ? course.curriculum : [];
        const sectionsCount = sections.length;
        let lessonsCount = 0;
        let curriculumQuizzesCount = 0;
        let videoCount = 0;
        let scormCount = 0;
        let presentationCount = 0;
        let pdfCount = 0;
        let audioCount = 0;
        let docCount = 0;
        let totalDurationSeconds = 0;

        sections.forEach((sec) => {
            const items = sec.variant_items || sec.items || [];
            items.forEach((item) => {
                const isItemQuiz = item.item_type === "quiz" || Boolean(item.quiz_id) || Boolean(item.quiz) || Boolean(item.quiz_detail);
                if (isItemQuiz) {
                    curriculumQuizzesCount++;
                    return;
                }
                lessonsCount++;
                const type = (item.file_type || "").toLowerCase();
                const rawF = item.file || item.youtubeLink || item.gdriveLink || "";
                const fileLower = (rawF || "").toLowerCase();
                const ext = fileLower.split('?')[0].split('.').pop();
                const isItemScorm = type === "scorm" || Boolean(item.learning_module_info) || Boolean(item.learning_module_id);
                const isItemVideo = !isItemScorm && (type === "video" || ['mp4', 'avi', 'mov', 'mkv', 'webm', 'ogv'].includes(ext) || fileLower.includes("youtube") || fileLower.includes("youtu.be") || (fileLower.includes("drive.google.com") && !fileLower.includes("presentation")));
                const isItemPpt = !isItemScorm && !isItemVideo && (type === "presentation" || ['ppt', 'pptx', 'odp'].includes(ext) || fileLower.includes("docs.google.com/presentation"));
                const isItemPdf = !isItemScorm && !isItemVideo && !isItemPpt && (type === "pdf" || ext === "pdf");
                const isItemAud = !isItemScorm && !isItemVideo && !isItemPpt && !isItemPdf && (type === "audio" || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext));

                if (isItemScorm) {
                    scormCount++;
                } else if (isItemVideo) {
                    videoCount++;
                } else if (isItemPpt) {
                    presentationCount++;
                } else if (isItemPdf) {
                    pdfCount++;
                } else if (isItemAud) {
                    audioCount++;
                } else {
                    docCount++;
                }

                if (item.duration_seconds && item.duration_seconds > 0) {
                    totalDurationSeconds += Number(item.duration_seconds);
                }
            });
        });

        const quizzes = Array.isArray(course.quizzes) ? course.quizzes : [];
        const quizzesCount = Math.max(quizzes.length, curriculumQuizzesCount);
        let totalQuestions = 0;
        quizzes.forEach((q) => {
            if (Array.isArray(q.questions)) {
                totalQuestions += q.questions.length;
            } else if (q.total_questions) {
                totalQuestions += Number(q.total_questions);
            }
        });

        const games = Array.isArray(course.games) ? course.games : [];
        const gamesCount = games.length;
        let totalGameXP = 0;
        games.forEach((g) => {
            if (g.points_reward) {
                totalGameXP += Number(g.points_reward);
            }
        });

        return {
            sectionsCount,
            lessonsCount,
            curriculumQuizzesCount,
            videoCount,
            scormCount,
            presentationCount,
            pdfCount,
            audioCount,
            docCount,
            totalDurationSeconds,
            totalDurationFormatted: formatDuration(totalDurationSeconds),
            quizzesCount,
            totalQuestions,
            gamesCount,
            totalGameXP,
            featuresCount: course.features?.length || 0,
            requirementsCount: course.requirements?.length || 0,
            outcomesCount: course.learning_outcomes?.length || 0
        };
    }, [course]);

    // Section collapse toggles
    const toggleSection = (sectionId) => {
        setExpandedSections((prev) => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const toggleAllSections = () => {
        if (!course?.curriculum) return;
        const allExpanded = course.curriculum.every((s) => expandedSections[s.variant_id || s.id]);
        const newState = {};
        course.curriculum.forEach((s) => {
            newState[s.variant_id || s.id] = !allExpanded;
        });
        setExpandedSections(newState);
    };

    // Quiz collapse toggles
    const toggleQuiz = (quizId) => {
        setExpandedQuizzes((prev) => ({
            ...prev,
            [quizId]: !prev[quizId]
        }));
    };

    const toggleAllQuizzes = () => {
        if (!course?.quizzes) return;
        const allExpanded = course.quizzes.every((q) => expandedQuizzes[q.quiz_id || q.id]);
        const newState = {};
        course.quizzes.forEach((q) => {
            newState[q.quiz_id || q.id] = !allExpanded;
        });
        setExpandedQuizzes(newState);
    };

    // Game collapse toggle
    const toggleGame = (gameId) => {
        setExpandedGames((prev) => ({
            ...prev,
            [gameId]: !prev[gameId]
        }));
    };

    // Lecture preview toggle
    const toggleLecturePreview = (lectureId) => {
        setExpandedLecturePreview((prev) => ({
            ...prev,
            [lectureId]: !prev[lectureId]
        }));
    };

    // Approve Course Action
    const handleApproveCourse = async () => {
        const result = await Swal.fire({
            title: `Setujui Kursus Ini?`,
            html: `
                <div class="text-start">
                    <p class="mb-2"><strong>Judul:</strong> ${course.title}</p>
                    <p class="mb-2"><strong>Instruktur:</strong> ${course.teacher?.full_name || "Unknown"}</p>
                    <p class="mb-2"><strong>Kategori:</strong> ${course.category?.title || "N/A"}</p>
                    <div class="alert alert-success py-2 px-3 small mt-3 mb-0">
                        <i class="fas fa-check-circle me-1"></i> Kursus ini akan dipublikasikan dan langsung dapat diakses oleh peserta di platform.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-check me-1"></i> Ya, Setujui Kursus',
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                setApproving(true);
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "approve"
                });

                Toast().fire({
                    icon: "success",
                    title: "Kursus Berhasil Disetujui",
                    text: `"${course.title}" telah dipublikasikan`
                });

                // Refresh state so admin can see immediate live status
                fetchCourseDetail();
            } catch (error) {
                console.error("Approve error:", error);
                Toast().fire({
                    icon: "error",
                    title: "Gagal menyetujui kursus",
                    text: error.response?.data?.detail || "Terjadi kesalahan sistem saat menyetujui kursus"
                });
            } finally {
                setApproving(false);
            }
        }
    };

    // Reject Course Action
    const handleRejectCourse = async () => {
        const { value: reason } = await Swal.fire({
            title: `Tolak Pengajuan Kursus`,
            html: `<p class="text-muted small">Berikan catatan revisi atau alasan penolakan agar instruktur dapat memperbaiki konten kursus.</p>`,
            input: "textarea",
            inputLabel: "Catatan / Alasan Penolakan",
            inputPlaceholder: "Jelaskan hal-hal yang perlu diperbaiki (misal: materi video bagian 2 belum lengkap, kuis belum memiliki kunci jawaban, dll)...",
            inputAttributes: {
                "aria-label": "Alasan penolakan",
                rows: 4
            },
            showCancelButton: true,
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-times me-1"></i> Tolak Kursus',
            cancelButtonText: "Batal",
            reverseButtons: true,
            inputValidator: (value) => {
                if (!value || value.trim().length < 8) {
                    return "Mohon tuliskan alasan penolakan minimal 8 karakter!";
                }
            }
        });

        if (reason) {
            try {
                setApproving(true);
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "reject",
                    rejection_reason: reason
                });

                Toast().fire({
                    icon: "info",
                    title: "Kursus Telah Ditolak",
                    text: `Catatan revisi telah disimpan untuk instruktur`
                });

                // Refresh state to show rejected status
                fetchCourseDetail();
            } catch (error) {
                console.error("Reject error:", error);
                Toast().fire({
                    icon: "error",
                    title: "Gagal menolak kursus",
                    text: error.response?.data?.detail || "Terjadi kesalahan sistem saat memproses penolakan"
                });
            } finally {
                setApproving(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="admin-page-wrapper">
                <AdminHeader />
                <main className="admin-dashboard-container d-flex align-items-center justify-content-center" style={{ minHeight: "65vh" }}>
                    <div className="text-center py-5">
                        <div className="spinner-border text-teal" style={{ color: "#0d9488", width: "3rem", height: "3rem" }} role="status">
                            <span className="visually-hidden">Memuat...</span>
                        </div>
                        <h5 className="mt-3 text-secondary fw-semibold">Memuat Data Review Kursus...</h5>
                        <p className="text-muted small">Sinkronisasi kurikulum, kuis, gamifikasi, dan status kursus saat ini.</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (!course) {
        return (
            <div className="admin-page-wrapper">
                <AdminHeader />
                <main className="admin-dashboard-container">
                    <div className="container-fluid px-3 px-xl-4 py-5">
                        <div className="acrd-card text-center py-5">
                            <div className="mb-3">
                                <i className="fas fa-exclamation-circle text-danger" style={{ fontSize: "3rem" }}></i>
                            </div>
                            <h4 className="fw-bold text-dark">Kursus Tidak Ditemukan</h4>
                            <p className="text-muted mb-4">Kursus dengan ID <strong>{course_id}</strong> tidak ditemukan atau Anda tidak memiliki hak akses.</p>
                            <button
                                className="btn btn-teal px-4"
                                onClick={() => navigate("/admin/content-management/?tab=courses")}
                            >
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali ke Daftar Review Kursus
                            </button>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const introVideoInfo = detectVideoSource(course.file);
    const statusInfo = getPlatformStatusInfo(course.platform_status);
    const teacherName = course.teacher?.full_name || "Instruktur Tanpa Nama";
    const teacherImage = course.teacher?.image ? getImageUrl(course.teacher.image) : DEFAULT_AVATAR_URL;

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />

            <main className="admin-dashboard-container acrd-page-bg">
                <div className="container-fluid px-3 px-xl-4 py-3">
                    {/* Top Navigation & Breadcrumb Bar */}
                    <div className="acrd-topbar mb-3">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-2">
                                <button
                                    className="btn btn-sm btn-outline-secondary acrd-back-btn"
                                    onClick={() => navigate("/admin/content-management/?tab=courses")}
                                    title="Kembali ke Manajemen Konten"
                                >
                                    <i className="fas fa-arrow-left me-1"></i>
                                    Kembali
                                </button>
                                <nav aria-label="breadcrumb" className="d-none d-md-flex align-items-center">
                                    <ol className="breadcrumb mb-0 acrd-breadcrumb align-items-center">
                                        <li className="breadcrumb-item d-inline-flex align-items-center">
                                            <Link to="/admin/content-management/?tab=courses">Manajemen Konten</Link>
                                        </li>
                                        <li className="breadcrumb-item d-inline-flex align-items-center">
                                            <span>Review Kursus</span>
                                        </li>
                                        <li className="breadcrumb-item active d-inline-flex align-items-center" aria-current="page">
                                            <span className="acrd-breadcrumb-title" title={course.title}>
                                                {course.title || course.course_id}
                                            </span>
                                        </li>
                                    </ol>
                                </nav>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <a
                                    href={`/instructor/preview-course/${course.course_id}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-1.5"
                                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}
                                    title="Lihat Pratinjau Menyeluruh dalam Pemutar Peserta/Siswa di Tab Baru"
                                >
                                    <i className="fas fa-play-circle"></i>
                                    <span>Pratinjau Siswa (Penuh)</span>
                                </a>
                                <span className={`acrd-status-pill ${statusInfo.className}`}>
                                    <i className={`${statusInfo.icon} me-1`}></i>
                                    {statusInfo.label}
                                </span>
                                {course.course_type && (
                                    <span className="badge bg-light text-dark border">
                                        <i className="fas fa-cube text-teal me-1"></i>
                                        {getCourseTypeText(course.course_type)}
                                    </span>
                                )}
                                <span className="badge bg-light text-secondary border font-monospace">
                                    ID: {course.course_id}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Compact Hero Banner Card */}
                    <div className="acrd-hero-card mb-3">
                        <div className="row g-3 align-items-center">
                            <div className="col-md-auto text-center">
                                <div className="acrd-thumb-wrapper">
                                    <img
                                        src={getImageUrl(course.image)}
                                        alt={course.title}
                                        className="acrd-thumb-img"
                                        onError={(e) => {
                                            e.target.src = DEFAULT_IMAGE_URL;
                                        }}
                                    />
                                    {course.file && (
                                        <button
                                            type="button"
                                            className="acrd-thumb-play-btn"
                                            onClick={() => setShowIntroVideoInline(!showIntroVideoInline)}
                                            title="Tonton Video Pengantar"
                                        >
                                            <i className="fas fa-play"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="col">
                                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                    <span className="badge bg-teal-subtle text-teal fw-semibold">
                                        <i className="fas fa-folder me-1"></i>
                                        {course.category?.title || "Kategori Umum"}
                                    </span>
                                    <span className="badge bg-light text-dark border">
                                        {getLevelText(course.level)}
                                    </span>
                                    <span className="badge bg-light text-muted border">
                                        <i className="fas fa-users text-primary me-1"></i>
                                        {getTargetAudienceText(course.target_audience)}
                                    </span>
                                    {course.review_submitted_date && (
                                        <span className="badge bg-light text-secondary border">
                                            <i className="fas fa-calendar-check text-success me-1"></i>
                                            Diajukan: {new Date(course.review_submitted_date).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </span>
                                    )}
                                </div>

                                <h1 className="acrd-hero-title mb-2">{course.title}</h1>

                                <div className="d-flex flex-wrap align-items-center gap-3 acrd-instructor-line">
                                    <div className="d-flex align-items-center gap-2">
                                        <img
                                            src={teacherImage}
                                            alt={teacherName}
                                            className="acrd-avatar-sm"
                                            onError={(e) => {
                                                e.target.src = DEFAULT_AVATAR_URL;
                                            }}
                                        />
                                        <div>
                                            <span className="text-muted small d-block" style={{ fontSize: "0.75rem", lineHeight: 1 }}>Instruktur</span>
                                            <strong className="text-dark small">{teacherName}</strong>
                                        </div>
                                    </div>

                                    {course.teacher?.email && (
                                        <div className="text-muted small border-start ps-3 d-none d-sm-block">
                                            <i className="fas fa-envelope text-secondary me-1"></i>
                                            {course.teacher.email}
                                        </div>
                                    )}

                                    {course.average_rating > 0 && (
                                        <div className="d-flex align-items-center gap-1 border-start ps-3">
                                            <i className="fas fa-star text-warning"></i>
                                            <strong className="text-dark small">{Number(course.average_rating).toFixed(1)}</strong>
                                            <span className="text-muted small">({course.rating_count || 0} ulasan)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Inline Intro Video Player (Collapsible) */}
                        {showIntroVideoInline && course.file && (
                            <div className="acrd-intro-player-box mt-3 pt-3 border-top">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <div className="d-flex align-items-center gap-2">
                                        <i className={`${introVideoInfo.icon} me-1`} style={{ color: introVideoInfo.color }}></i>
                                        <strong className="small">Video Pengantar Kursus ({introVideoInfo.label})</strong>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <a
                                            href={convertEmbedUrlToViewable(course.file, introVideoInfo.type)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-xs btn-outline-secondary"
                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                        >
                                            <i className="fas fa-external-link-alt me-1"></i> Tab Baru
                                        </a>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-secondary"
                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                            onClick={() => setShowIntroVideoInline(false)}
                                        >
                                            <i className="fas fa-times me-1"></i> Tutup
                                        </button>
                                    </div>
                                </div>
                                <div className="acrd-video-container-responsive">
                                    {introVideoInfo.type === "youtube" ? (
                                        <iframe
                                            src={getEmbedUrl(course.file)}
                                            title="Video Pengantar Kursus"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    ) : introVideoInfo.type === "google_drive" ? (
                                        <iframe
                                            src={getEmbedUrl(course.file)}
                                            title="Video Pengantar Google Drive"
                                            frameBorder="0"
                                            allow="autoplay"
                                            allowFullScreen
                                        ></iframe>
                                    ) : (
                                        <video controls width="100%" preload="metadata" style={{ borderRadius: "8px", maxHeight: "360px" }}>
                                            <source src={course.file} type="video/mp4" />
                                            Browser Anda tidak mendukung pemutar video HTML5.
                                        </video>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rejection Alert if previously rejected */}
                    {course.rejection_reason && (
                        <div className="alert alert-danger acrd-alert-compact mb-3 d-flex align-items-start gap-2 shadow-sm">
                            <i className="fas fa-exclamation-triangle text-danger mt-1 flex-shrink-0"></i>
                            <div className="flex-grow-1">
                                <strong className="d-block small">Catatan Penolakan Sebelumnya:</strong>
                                <span className="small text-dark" style={{ whiteSpace: "pre-line" }}>{course.rejection_reason}</span>
                            </div>
                        </div>
                    )}

                    {/* Main 2-Column High-Density Layout */}
                    <div className="row g-3">
                        {/* LEFT COLUMN: Main Content Explorer (Tabs, Curriculum, Quizzes, Gamification, Description) */}
                        <div className="col-lg-8">
                            {/* Navigation Tabs Bar */}
                            <div className="acrd-card acrd-tabs-card mb-3 p-2">
                                <div className="nav nav-pills acrd-pills gap-1" role="tablist">
                                    <button
                                        type="button"
                                        className={`nav-link ${activeTab === "curriculum" ? "active" : ""}`}
                                        onClick={() => setActiveTab("curriculum")}
                                    >
                                        <i className="fas fa-book-open me-1"></i>
                                        Kurikulum
                                        <span className="badge ms-1">{liveStats.lessonsCount + liveStats.curriculumQuizzesCount}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`nav-link ${activeTab === "quizzes" ? "active" : ""}`}
                                        onClick={() => setActiveTab("quizzes")}
                                    >
                                        <i className="fas fa-list-check me-1"></i>
                                        Kuis
                                        <span className="badge ms-1">{liveStats.quizzesCount}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`nav-link ${activeTab === "games" ? "active" : ""}`}
                                        onClick={() => setActiveTab("games")}
                                    >
                                        <i className="fas fa-gamepad me-1"></i>
                                        Gamifikasi
                                        <span className="badge ms-1">{liveStats.gamesCount}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`nav-link ${activeTab === "overview" ? "active" : ""}`}
                                        onClick={() => setActiveTab("overview")}
                                    >
                                        <i className="fas fa-info-circle me-1"></i>
                                        Deskripsi & Silabus
                                    </button>
                                    <button
                                        type="button"
                                        className={`nav-link ms-auto text-secondary ${activeTab === "all" ? "active" : ""}`}
                                        onClick={() => setActiveTab("all")}
                                        title="Tampilkan seluruh konten sekaligus"
                                    >
                                        <i className="fas fa-layer-group me-1"></i>
                                        Semua
                                    </button>
                                </div>
                            </div>

                            {/* TAB 1: CURRICULUM & LECTURES */}
                            {(activeTab === "curriculum" || activeTab === "all") && (
                                <div className="acrd-card mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                        <div className="d-flex align-items-center gap-2">
                                            <i className="fas fa-graduation-cap text-teal"></i>
                                            <h3 className="acrd-card-title mb-0">Kurikulum & Materi Pembelajaran</h3>
                                            <span className="badge bg-teal-subtle text-teal">
                                                {liveStats.sectionsCount} Bagian • {liveStats.lessonsCount} Pelajaran{liveStats.curriculumQuizzesCount > 0 ? ` • ${liveStats.curriculumQuizzesCount} Kuis` : ""}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-teal"
                                            onClick={toggleAllSections}
                                            style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                                        >
                                            <i className="fas fa-expand-alt me-1"></i> Buka/Tutup Semua
                                        </button>
                                    </div>

                                    {course.curriculum && course.curriculum.length > 0 ? (
                                        <div className="acrd-curriculum-list">
                                            {course.curriculum.map((section, sIdx) => {
                                                const sectionId = section.variant_id || section.id || `sec-${sIdx}`;
                                                const isExpanded = !!expandedSections[sectionId];
                                                const items = section.variant_items || section.items || [];
                                                let secDuration = 0;
                                                let secLessons = 0;
                                                let secQuizzes = 0;

                                                items.forEach((it) => {
                                                    const isItQuiz = it.item_type === "quiz" || Boolean(it.quiz_id) || Boolean(it.quiz) || Boolean(it.quiz_detail);
                                                    if (isItQuiz) {
                                                        secQuizzes++;
                                                    } else {
                                                        secLessons++;
                                                        if (it.duration_seconds) secDuration += Number(it.duration_seconds);
                                                    }
                                                });

                                                const summaryParts = [];
                                                if (secLessons > 0) summaryParts.push(`${secLessons} Pelajaran`);
                                                if (secQuizzes > 0) summaryParts.push(`${secQuizzes} Kuis`);
                                                const countText = summaryParts.join(" • ") || "0 Materi";

                                                return (
                                                    <div key={sectionId} className="acrd-section-block mb-2">
                                                        <div
                                                            className={`acrd-section-header ${isExpanded ? "expanded" : ""}`}
                                                            onClick={() => toggleSection(sectionId)}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                                                                <span className="acrd-sec-badge">
                                                                    Bagian {sIdx + 1}
                                                                </span>
                                                                <strong className="acrd-sec-title text-truncate">
                                                                    {section.title}
                                                                </strong>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                                <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
                                                                    {countText} {secDuration > 0 && `• ${formatDuration(secDuration)}`}
                                                                </span>
                                                                <i className={`fas fa-chevron-down acrd-chevron ${isExpanded ? "rotated" : ""}`}></i>
                                                            </div>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="acrd-section-body">
                                                                {items.length === 0 ? (
                                                                    <div className="text-center py-3 text-muted small fst-italic">
                                                                        <i className="fas fa-inbox me-1"></i> Belum ada materi di bagian ini.
                                                                    </div>
                                                                ) : (
                                                                    <div className="acrd-lectures-stack">
                                                                        {items.map((lecture, lIdx) => {
                                                                            const lectureId = lecture.variant_item_id || lecture.id || `lec-${lIdx}`;
                                                                            const isPreviewOpen = !!expandedLecturePreview[lectureId];
                                                                            const isQuiz = lecture.item_type === "quiz" || Boolean(lecture.quiz_id) || Boolean(lecture.quiz) || Boolean(lecture.quiz_detail);

                                                                            const quizTargetId = lecture.quiz_id ||
                                                                                (lecture.quiz && typeof lecture.quiz === 'object' ? (lecture.quiz.quiz_id || lecture.quiz.id) : lecture.quiz) ||
                                                                                lecture.quiz_detail?.quiz_id ||
                                                                                lecture.quiz_detail?.id;

                                                                            const targetQuiz = isQuiz
                                                                                ? ((course.quizzes || []).find(q =>
                                                                                    quizTargetId && (String(q.quiz_id) === String(quizTargetId) || String(q.id) === String(quizTargetId))
                                                                                  ) || (lecture.quiz && typeof lecture.quiz === 'object' ? lecture.quiz : null) || lecture.quiz_detail)
                                                                                : null;

                                                                            const itemTitle = lecture.title || targetQuiz?.title || (isQuiz ? "Kuis" : "Materi");
                                                                            const itemDescription = lecture.description || targetQuiz?.description || "";
                                                                            const questionCount = targetQuiz?.questions?.length || targetQuiz?.total_questions || targetQuiz?.question_count || 0;

                                                                            const rawFile = lecture.file || lecture.youtubeLink || lecture.gdriveLink || lecture.uploadedFile || "";
                                                                            const fileUrl = rawFile.startsWith("http") || rawFile.startsWith("blob:") || rawFile.startsWith("data:")
                                                                                ? rawFile
                                                                                : getMediaUrl(rawFile);
                                                                            const fileLower = (rawFile || "").toLowerCase();
                                                                            const ext = fileLower.split("?")[0].split(".").pop();
                                                                            const fileType = (lecture.file_type || "").toLowerCase();

                                                                            const scormModuleId = lecture.learning_module_info?.id ||
                                                                                lecture.learning_module?.id ||
                                                                                (typeof lecture.learning_module === "number" ? lecture.learning_module : null) ||
                                                                                lecture.learning_module_id;
                                                                            const isScorm = !isQuiz && (fileType === "scorm" || Boolean(scormModuleId) || Boolean(lecture.learning_module_info));
                                                                            const scormTitle = lecture.learning_module_info?.judul || lecture.title;
                                                                            const scormPlayerUrl = scormModuleId
                                                                                ? `/modules/${scormModuleId}/player/`
                                                                                : (lecture.learning_module_info?.player_url ? getImageUrl(lecture.learning_module_info.player_url) : null);

                                                                            const isVideo = !isQuiz && !isScorm && (
                                                                                fileType === "video" ||
                                                                                ['mp4', 'avi', 'mov', 'mkv', 'webm', 'ogv'].includes(ext) ||
                                                                                fileLower.includes("youtube") ||
                                                                                fileLower.includes("youtu.be") ||
                                                                                (fileLower.includes("drive.google.com") && !fileLower.includes("presentation"))
                                                                            );

                                                                            const isPresentation = !isQuiz && !isScorm && !isVideo && (
                                                                                fileType === "presentation" ||
                                                                                ['ppt', 'pptx', 'odp'].includes(ext) ||
                                                                                fileLower.includes("docs.google.com/presentation")
                                                                            );

                                                                            const isPdf = !isQuiz && !isScorm && !isVideo && !isPresentation && (
                                                                                fileType === "pdf" ||
                                                                                ext === "pdf"
                                                                            );

                                                                            const isAudio = !isQuiz && !isScorm && !isVideo && !isPresentation && !isPdf && (
                                                                                fileType === "audio" ||
                                                                                ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)
                                                                            );

                                                                            const isWordDoc = !isQuiz && !isScorm && !isVideo && !isPresentation && !isPdf && !isAudio && (
                                                                                fileType === "document" ||
                                                                                ['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)
                                                                            );

                                                                            const durText = formatLectureDuration(lecture);

                                                                            return (
                                                                                <div key={lectureId} className={`acrd-lecture-row ${isQuiz ? "acrd-quiz-item-row" : ""}`}>
                                                                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                                                        <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                                                                                            <span
                                                                                                className={`acrd-lec-num ${isQuiz ? "acrd-quiz-num" : ""}`}
                                                                                                title={isQuiz ? "Kuis Kurikulum" : `Pelajaran ke-${lIdx + 1}`}
                                                                                            >
                                                                                                {isQuiz ? <i className="fas fa-tasks" style={{ fontSize: "0.65rem" }}></i> : lIdx + 1}
                                                                                            </span>
                                                                                            <div className="text-truncate">
                                                                                                <div className="fw-semibold small text-dark text-truncate">
                                                                                                    {itemTitle}
                                                                                                </div>
                                                                                                {itemDescription && (
                                                                                                    <div className="text-muted text-truncate" style={{ fontSize: "0.75rem" }}>
                                                                                                        {itemDescription}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                                                            {/* Media Type Badge */}
                                                                                            {isQuiz ? (
                                                                                                <>
                                                                                                    <span className="badge small py-1" style={{ backgroundColor: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
                                                                                                        <i className="fas fa-clipboard-check me-1"></i> Kuis
                                                                                                    </span>
                                                                                                    <span className="badge bg-light text-dark border small py-1">
                                                                                                        <i className="fas fa-question-circle text-warning me-1"></i> {questionCount} Soal
                                                                                                    </span>
                                                                                                    {targetQuiz?.passing_score && (
                                                                                                        <span className="badge bg-light text-secondary border small py-1" title="Nilai Kelulusan Minimum">
                                                                                                            <i className="fas fa-award text-success me-1"></i> Min: {targetQuiz.passing_score}%
                                                                                                        </span>
                                                                                                    )}
                                                                                                    {targetQuiz?.duration_minutes ? (
                                                                                                        <span className="badge bg-light text-dark border small py-1 font-monospace" title="Batas Waktu Pengerjaan">
                                                                                                            <i className="fas fa-clock text-muted me-1"></i> {targetQuiz.duration_minutes}m
                                                                                                        </span>
                                                                                                    ) : null}
                                                                                                </>
                                                                                            ) : isVideo ? (
                                                                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle small py-1">
                                                                                                    <i className="fas fa-play-circle me-1"></i> Video
                                                                                                </span>
                                                                                            ) : isScorm ? (
                                                                                                <span className="badge bg-purple-subtle text-purple border border-purple-subtle small py-1" style={{ backgroundColor: "#f3e8ff", color: "#7e22ce" }}>
                                                                                                    <i className="fas fa-cube me-1"></i> SCORM 1.2
                                                                                                </span>
                                                                                            ) : isPresentation ? (
                                                                                                <span className="badge small py-1" style={{ backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}>
                                                                                                    <i className="fas fa-file-powerpoint me-1" style={{ color: "#ea580c" }}></i> Presentasi (PPT)
                                                                                                </span>
                                                                                            ) : isPdf ? (
                                                                                                <span className="badge small py-1" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                                                                                                    <i className="fas fa-file-pdf me-1"></i> Dokumen PDF
                                                                                                </span>
                                                                                            ) : isAudio ? (
                                                                                                <span className="badge small py-1" style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd" }}>
                                                                                                    <i className="fas fa-headphones me-1"></i> Audio
                                                                                                </span>
                                                                                            ) : isWordDoc ? (
                                                                                                <span className="badge small py-1" style={{ backgroundColor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                                                                                                    <i className="fas fa-file-word me-1"></i> Naskah / Dokumen
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="badge bg-light text-secondary border small py-1">
                                                                                                    <i className="fas fa-file-alt me-1"></i> {lecture.file_type ? lecture.file_type.toUpperCase() : "Dokumen"}
                                                                                                </span>
                                                                                            )}

                                                                                            {!isQuiz && durText && (
                                                                                                <span className="badge bg-light text-dark border small py-1 font-monospace">
                                                                                                    <i className="fas fa-clock text-muted me-1"></i> {durText}
                                                                                                </span>
                                                                                            )}

                                                                                            {!isQuiz && lecture.completion_question && (
                                                                                                <span className="badge bg-success-subtle text-success border border-success-subtle small py-1" title="Terdapat Pertanyaan Penyelesaian">
                                                                                                    <i className="fas fa-question-circle me-1"></i> Checkpoint
                                                                                                </span>
                                                                                            )}

                                                                                            {/* Action buttons */}
                                                                                            {isQuiz ? (
                                                                                                <div className="d-flex align-items-center gap-1">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className={`btn btn-xs ${isPreviewOpen ? "btn-warning text-dark" : "btn-outline-warning text-dark"}`}
                                                                                                        onClick={() => toggleLecturePreview(lectureId)}
                                                                                                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                        title={isPreviewOpen ? "Tutup Pratinjau Kuis" : "Lihat Pratinjau Soal Kuis"}
                                                                                                    >
                                                                                                        <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-eye"} me-1`}></i>
                                                                                                        {isPreviewOpen ? "Tutup" : "Pratinjau Kuis"}
                                                                                                    </button>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-xs btn-outline-secondary"
                                                                                                        onClick={() => {
                                                                                                            setActiveTab("quizzes");
                                                                                                            const qId = targetQuiz?.quiz_id || targetQuiz?.id;
                                                                                                            if (qId) {
                                                                                                                setExpandedQuizzes(prev => ({ ...prev, [qId]: true }));
                                                                                                            }
                                                                                                        }}
                                                                                                        style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                        title="Buka tab Kuis untuk rincian lengkap"
                                                                                                    >
                                                                                                        <i className="fas fa-external-link-alt me-1"></i> Tab Kuis
                                                                                                    </button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <>
                                                                                                    {isVideo && rawFile && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className={`btn btn-xs ${isPreviewOpen ? "btn-teal" : "btn-outline-teal"}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                            title={isPreviewOpen ? "Tutup Pratinjau Video" : "Lihat Pratinjau Video"}
                                                                                                        >
                                                                                                            <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-play-circle"} me-1`}></i>
                                                                                                            {isPreviewOpen ? "Tutup" : "Pratinjau"}
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {isScorm && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className={`btn btn-xs ${isPreviewOpen ? "btn-purple" : "btn-outline-purple"}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                            title="Lihat Pratinjau Modul SCORM"
                                                                                                        >
                                                                                                            <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-play-circle"} me-1`}></i>
                                                                                                            {isPreviewOpen ? "Tutup" : "Pratinjau SCORM"}
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {isPresentation && rawFile && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className={`btn btn-xs ${isPreviewOpen ? "btn-warning text-dark" : "btn-outline-warning text-warning-emphasis"}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px", borderColor: "#f59e0b" }}
                                                                                                            title={isPreviewOpen ? "Tutup Pratinjau Slide" : "Lihat Pratinjau Paparan Presentasi"}
                                                                                                        >
                                                                                                            <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-file-powerpoint"} me-1`}></i>
                                                                                                            {isPreviewOpen ? "Tutup" : "Pratinjau Slide"}
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {isPdf && rawFile && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className={`btn btn-xs ${isPreviewOpen ? "btn-danger" : "btn-outline-danger"}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                            title={isPreviewOpen ? "Tutup Pratinjau PDF" : "Lihat Pratinjau Dokumen PDF"}
                                                                                                        >
                                                                                                            <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-file-pdf"} me-1`}></i>
                                                                                                            {isPreviewOpen ? "Tutup" : "Pratinjau PDF"}
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {isAudio && rawFile && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className={`btn btn-xs ${isPreviewOpen ? "btn-primary" : "btn-outline-primary"}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                            title={isPreviewOpen ? "Tutup Pratinjau Audio" : "Dengarkan Pratinjau Audio"}
                                                                                                        >
                                                                                                            <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-headphones"} me-1`}></i>
                                                                                                            {isPreviewOpen ? "Tutup" : "Pratinjau Audio"}
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {isWordDoc && rawFile && (
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className={`btn btn-xs ${isPreviewOpen ? "btn-primary" : "btn-outline-primary"}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                            title={isPreviewOpen ? "Tutup Info Dokumen" : "Lihat Info Dokumen"}
                                                                                                        >
                                                                                                            <i className={`fas ${isPreviewOpen ? "fa-eye-slash" : "fa-file-word"} me-1`}></i>
                                                                                                            {isPreviewOpen ? "Tutup" : "Pratinjau"}
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {rawFile && (
                                                                                                        <a
                                                                                                            href={fileUrl}
                                                                                                            target="_blank"
                                                                                                            rel="noopener noreferrer"
                                                                                                            download
                                                                                                            className="btn btn-xs btn-outline-secondary"
                                                                                                            style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                                                                                                            title="Unduh / Buka berkas materi asli"
                                                                                                        >
                                                                                                            <i className="fas fa-download me-1"></i> Unduh
                                                                                                        </a>
                                                                                                    )}
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Inline Video Player Preview */}
                                                                                    {isPreviewOpen && isVideo && rawFile && (
                                                                                        <div className="acrd-lecture-preview-box acrd-video-preview-box mt-2 p-2 rounded bg-light border">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                                                                <span className="small text-muted fw-semibold">
                                                                                                    <i className="fas fa-video me-1 text-teal"></i> Pratinjau Video Materi
                                                                                                </span>
                                                                                                <a
                                                                                                    href={convertEmbedUrlToViewable(fileUrl)}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="small text-teal text-decoration-none"
                                                                                                >
                                                                                                    <i className="fas fa-external-link-alt me-1"></i> Buka di Tab Baru
                                                                                                </a>
                                                                                            </div>
                                                                                            {fileLower.includes("youtube") || fileLower.includes("youtu.be") ? (
                                                                                                <iframe
                                                                                                    width="100%"
                                                                                                    height="260"
                                                                                                    src={getEmbedUrl(fileUrl)}
                                                                                                    title={lecture.title}
                                                                                                    frameBorder="0"
                                                                                                    allowFullScreen
                                                                                                    style={{ borderRadius: "6px" }}
                                                                                                ></iframe>
                                                                                            ) : fileLower.includes("drive.google") ? (
                                                                                                <iframe
                                                                                                    width="100%"
                                                                                                    height="260"
                                                                                                    src={getEmbedUrl(fileUrl)}
                                                                                                    title={lecture.title}
                                                                                                    frameBorder="0"
                                                                                                    allowFullScreen
                                                                                                    style={{ borderRadius: "6px" }}
                                                                                                ></iframe>
                                                                                            ) : (
                                                                                                <video controls width="100%" preload="metadata" style={{ borderRadius: "6px", maxHeight: "300px" }}>
                                                                                                    <source src={fileUrl} type="video/mp4" />
                                                                                                    Browser tidak mendukung pemutar video.
                                                                                                </video>
                                                                                            )}
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Inline SCORM Player Preview */}
                                                                                    {isPreviewOpen && isScorm && (
                                                                                        <div className="acrd-lecture-preview-box acrd-scorm-preview-box mt-2 p-2 rounded bg-white border border-purple-subtle shadow-sm">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge" style={{ backgroundColor: "#f3e8ff", color: "#7e22ce", fontSize: "0.725rem" }}>
                                                                                                        <i className="fas fa-cube me-1"></i> SCORM 1.2
                                                                                                    </span>
                                                                                                    <strong className="small text-dark text-truncate" style={{ maxWidth: "320px" }}>
                                                                                                        {scormTitle}
                                                                                                    </strong>
                                                                                                </div>
                                                                                                <div className="d-flex align-items-center gap-1">
                                                                                                    {scormPlayerUrl && (
                                                                                                        <a
                                                                                                            href={scormPlayerUrl}
                                                                                                            target="_blank"
                                                                                                            rel="noopener noreferrer"
                                                                                                            className="btn btn-xs btn-outline-purple d-inline-flex align-items-center"
                                                                                                            style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                            title="Buka player SCORM di tab baru"
                                                                                                        >
                                                                                                            <i className="fas fa-external-link-alt me-1"></i>
                                                                                                            <span>Tab Baru</span>
                                                                                                        </a>
                                                                                                    )}
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-xs btn-secondary d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        onClick={() => toggleLecturePreview(lectureId)}
                                                                                                    >
                                                                                                        <i className="fas fa-times me-1"></i>
                                                                                                        <span>Tutup</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div className="acrd-scorm-frame-wrapper position-relative rounded overflow-hidden" style={{ minHeight: "480px", background: "#f8fafc" }}>
                                                                                                {scormPlayerUrl ? (
                                                                                                    <iframe
                                                                                                        src={scormPlayerUrl}
                                                                                                        title={lecture.title || "SCORM Preview"}
                                                                                                        className="w-100 border-0"
                                                                                                        style={{ width: "100%", height: "500px", display: "block" }}
                                                                                                        allow="fullscreen; autoplay"
                                                                                                        allowFullScreen
                                                                                                    />
                                                                                                ) : (
                                                                                                    <div className="text-center py-5 text-muted">
                                                                                                        <i className="fas fa-exclamation-triangle text-warning fa-2x mb-2"></i>
                                                                                                        <p className="small mb-0">Paket modul SCORM tidak ditemukan atau belum diekstrak.</p>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Inline Presentation (PPT/PPTX & Google Slides) Player Preview */}
                                                                                    {isPreviewOpen && isPresentation && rawFile && (
                                                                                        <div className="acrd-lecture-preview-box acrd-presentation-preview-box mt-2 p-2 rounded bg-white border border-warning-subtle shadow-sm">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge" style={{ backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", fontSize: "0.725rem" }}>
                                                                                                        <i className="fas fa-file-powerpoint me-1" style={{ color: "#ea580c" }}></i> {rawFile.includes('docs.google.com') ? 'Google Slides' : 'Paparan Presentasi (PPTX)'}
                                                                                                    </span>
                                                                                                    <strong className="small text-dark text-truncate" style={{ maxWidth: "340px" }}>
                                                                                                        {lecture.title}
                                                                                                    </strong>
                                                                                                </div>
                                                                                                <div className="d-flex align-items-center gap-1">
                                                                                                    <a
                                                                                                        href={fileUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="btn btn-xs btn-outline-warning d-inline-flex align-items-center text-warning-emphasis"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        title="Buka paparan di tab baru"
                                                                                                    >
                                                                                                        <i className="fas fa-external-link-alt me-1"></i>
                                                                                                        <span>Tab Baru</span>
                                                                                                    </a>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-xs btn-secondary d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        onClick={() => toggleLecturePreview(lectureId)}
                                                                                                    >
                                                                                                        <i className="fas fa-times me-1"></i>
                                                                                                        <span>Tutup</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="rounded overflow-hidden border bg-light" style={{ minHeight: "440px" }}>
                                                                                                {rawFile.includes('docs.google.com/presentation') ? (
                                                                                                    <div className="ratio ratio-16x9" style={{ minHeight: "440px" }}>
                                                                                                        <iframe
                                                                                                            src={rawFile.replace('/edit', '/embed').replace('/view', '/embed')}
                                                                                                            title={lecture.title || "Google Slides"}
                                                                                                            style={{ border: 0, width: "100%", height: "100%" }}
                                                                                                            allowFullScreen
                                                                                                        />
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <PptxRenderer
                                                                                                        fileUrl={fileUrl}
                                                                                                        height="480px"
                                                                                                        showThumbnails={true}
                                                                                                        showToolbar={true}
                                                                                                    />
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Inline PDF Document Preview */}
                                                                                    {isPreviewOpen && isPdf && rawFile && (
                                                                                        <div className="acrd-lecture-preview-box acrd-pdf-preview-box mt-2 p-2 rounded bg-white border border-danger-subtle shadow-sm">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: "0.725rem" }}>
                                                                                                        <i className="fas fa-file-pdf me-1"></i> Dokumen PDF Materi
                                                                                                    </span>
                                                                                                    <strong className="small text-dark text-truncate" style={{ maxWidth: "340px" }}>
                                                                                                        {lecture.title}
                                                                                                    </strong>
                                                                                                </div>
                                                                                                <div className="d-flex align-items-center gap-1">
                                                                                                    <a
                                                                                                        href={fileUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="btn btn-xs btn-outline-danger d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        title="Buka dokumen PDF di tab baru"
                                                                                                    >
                                                                                                        <i className="fas fa-external-link-alt me-1"></i>
                                                                                                        <span>Tab Baru</span>
                                                                                                    </a>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-xs btn-secondary d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        onClick={() => toggleLecturePreview(lectureId)}
                                                                                                    >
                                                                                                        <i className="fas fa-times me-1"></i>
                                                                                                        <span>Tutup</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="rounded overflow-hidden border" style={{ minHeight: "520px", background: "#f8fafc" }}>
                                                                                                <PdfRenderer
                                                                                                    fileUrl={fileUrl}
                                                                                                    height="520px"
                                                                                                    title={lecture.title || "Dokumen PDF"}
                                                                                                    showThumbnails={true}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Inline Audio Player Preview */}
                                                                                    {isPreviewOpen && isAudio && rawFile && (
                                                                                        <div className="acrd-lecture-preview-box acrd-audio-preview-box mt-2 p-3 rounded bg-white border border-info-subtle shadow-sm">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge" style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", fontSize: "0.725rem" }}>
                                                                                                        <i className="fas fa-headphones me-1"></i> Audio Pembelajaran / Podcast
                                                                                                    </span>
                                                                                                    <strong className="small text-dark text-truncate" style={{ maxWidth: "340px" }}>
                                                                                                        {lecture.title}
                                                                                                    </strong>
                                                                                                </div>
                                                                                                <div className="d-flex align-items-center gap-1">
                                                                                                    <a
                                                                                                        href={fileUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="btn btn-xs btn-outline-primary d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        title="Buka audio di tab baru"
                                                                                                    >
                                                                                                        <i className="fas fa-external-link-alt me-1"></i>
                                                                                                        <span>Tab Baru</span>
                                                                                                    </a>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-xs btn-secondary d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        onClick={() => toggleLecturePreview(lectureId)}
                                                                                                    >
                                                                                                        <i className="fas fa-times me-1"></i>
                                                                                                        <span>Tutup</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>

                                                                                            <div className="p-3 rounded-3 bg-light border d-flex flex-column flex-sm-row align-items-center gap-3">
                                                                                                <div
                                                                                                    className="rounded-circle d-flex align-items-center justify-content-center shadow-xs flex-shrink-0"
                                                                                                    style={{
                                                                                                        width: "54px",
                                                                                                        height: "54px",
                                                                                                        background: "linear-gradient(135deg, #0284c7 0%, #0d9488 100%)",
                                                                                                        color: "#fff",
                                                                                                        fontSize: "1.4rem"
                                                                                                    }}
                                                                                                >
                                                                                                    <i className="fas fa-headphones"></i>
                                                                                                </div>
                                                                                                <div className="w-100 flex-grow-1">
                                                                                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                                                                                        <span className="fw-semibold text-dark small">{lecture.title}</span>
                                                                                                        {durText && <span className="badge bg-white text-muted border small">{durText}</span>}
                                                                                                    </div>
                                                                                                    <audio
                                                                                                        controls
                                                                                                        preload="metadata"
                                                                                                        className="w-100"
                                                                                                        style={{ height: "40px", borderRadius: "8px" }}
                                                                                                    >
                                                                                                        <source src={fileUrl} />
                                                                                                        Browser Anda tidak mendukung pemutar audio.
                                                                                                    </audio>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Inline Word Document Preview / Info */}
                                                                                    {isPreviewOpen && isWordDoc && rawFile && (
                                                                                        <div className="acrd-lecture-preview-box acrd-word-preview-box mt-2 p-3 rounded bg-white border border-primary-subtle shadow-sm">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge" style={{ backgroundColor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", fontSize: "0.725rem" }}>
                                                                                                        <i className="fas fa-file-word me-1"></i> Dokumen Naskah / Modul ({ext.toUpperCase()})
                                                                                                    </span>
                                                                                                    <strong className="small text-dark text-truncate" style={{ maxWidth: "340px" }}>
                                                                                                        {lecture.title}
                                                                                                    </strong>
                                                                                                </div>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="btn btn-xs btn-secondary d-inline-flex align-items-center"
                                                                                                    style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                    onClick={() => toggleLecturePreview(lectureId)}
                                                                                                >
                                                                                                    <i className="fas fa-times me-1"></i>
                                                                                                    <span>Tutup</span>
                                                                                                </button>
                                                                                            </div>
                                                                                            <div className="p-3 text-center rounded bg-light border">
                                                                                                <div
                                                                                                    className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                                                                                                    style={{ width: "50px", height: "50px", backgroundColor: "#dbeafe", color: "#2563eb", fontSize: "1.4rem" }}
                                                                                                >
                                                                                                    <i className="fas fa-file-word"></i>
                                                                                                </div>
                                                                                                <h6 className="fw-bold text-dark mb-1">{lecture.title}</h6>
                                                                                                <p className="text-muted small mb-3">Format berkas: .{ext.toUpperCase()} &bull; Kurasi isi dokumen materi pembelajaran</p>
                                                                                                <div className="d-flex gap-2 justify-content-center flex-wrap">
                                                                                                    <a
                                                                                                        href={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="btn btn-sm btn-primary px-3"
                                                                                                    >
                                                                                                        <i className="fas fa-eye me-1"></i> Buka dengan Google Docs Viewer
                                                                                                    </a>
                                                                                                    <a
                                                                                                        href={fileUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        download
                                                                                                        className="btn btn-sm btn-outline-secondary px-3"
                                                                                                    >
                                                                                                        <i className="fas fa-download me-1"></i> Unduh Berkas Asli
                                                                                                    </a>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Inline Quiz Question List Preview */}
                                                                                    {isPreviewOpen && isQuiz && (
                                                                                        <div className="acrd-lecture-preview-box acrd-quiz-preview-box mt-2 p-3 rounded bg-white border border-warning-subtle shadow-sm">
                                                                                            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge" style={{ backgroundColor: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", fontSize: "0.75rem" }}>
                                                                                                        <i className="fas fa-clipboard-check me-1"></i> Pratinjau Kuis
                                                                                                    </span>
                                                                                                    <strong className="small text-dark text-truncate" style={{ maxWidth: "340px" }}>
                                                                                                        {itemTitle}
                                                                                                    </strong>
                                                                                                </div>
                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                    <span className="badge bg-light text-muted border small">
                                                                                                        {questionCount} Pertanyaan
                                                                                                    </span>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="btn btn-xs btn-secondary d-inline-flex align-items-center"
                                                                                                        style={{ fontSize: "0.725rem", padding: "3px 8px", lineHeight: 1 }}
                                                                                                        onClick={() => toggleLecturePreview(lectureId)}
                                                                                                    >
                                                                                                        <i className="fas fa-times me-1"></i>
                                                                                                        <span>Tutup</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>

                                                                                            {itemDescription && (
                                                                                                <div className="alert alert-light border small py-2 px-3 mb-2 text-muted">
                                                                                                    <i className="fas fa-info-circle text-warning me-1"></i>
                                                                                                    <strong>Petunjuk:</strong> {itemDescription}
                                                                                                </div>
                                                                                            )}

                                                                                            {targetQuiz?.questions && targetQuiz.questions.length > 0 ? (
                                                                                                <div className="acrd-questions-list">
                                                                                                    {targetQuiz.questions.map((question, quIdx) => (
                                                                                                        <div key={question.question_id || quIdx} className="acrd-question-card mb-2 p-2 rounded border bg-light">
                                                                                                            <div className="d-flex align-items-start gap-2 mb-2">
                                                                                                                <span className="badge bg-dark text-white flex-shrink-0" style={{ fontSize: "0.7rem", marginTop: "2px" }}>
                                                                                                                    Soal {quIdx + 1}
                                                                                                                </span>
                                                                                                                <div className="fw-semibold small text-dark flex-grow-1">
                                                                                                                    {question.question_text}
                                                                                                                </div>
                                                                                                            </div>

                                                                                                            {question.choices && question.choices.length > 0 ? (
                                                                                                                <div className="acrd-choices-grid">
                                                                                                                    {question.choices.map((choice, cIdx) => (
                                                                                                                        <div
                                                                                                                            key={choice.choice_id || cIdx}
                                                                                                                            className={`acrd-choice-pill ${choice.is_correct ? "correct" : ""}`}
                                                                                                                        >
                                                                                                                            <span className="acrd-choice-letter">
                                                                                                                                {String.fromCharCode(65 + cIdx)}.
                                                                                                                            </span>
                                                                                                                            <span className="acrd-choice-text flex-grow-1">
                                                                                                                                {choice.choice_text}
                                                                                                                            </span>
                                                                                                                            {choice.is_correct && (
                                                                                                                                <span className="badge bg-success text-white py-0 px-1 ms-1" style={{ fontSize: "0.65rem" }}>
                                                                                                                                    <i className="fas fa-check me-0"></i> Kunci
                                                                                                                                </span>
                                                                                                                            )}
                                                                                                                        </div>
                                                                                                                    ))}
                                                                                                                </div>
                                                                                                            ) : (
                                                                                                                <div className="text-muted small fst-italic ps-4">
                                                                                                                    Belum ada pilihan jawaban untuk pertanyaan ini.
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="text-center py-3 text-muted small fst-italic">
                                                                                                    <i className="fas fa-exclamation-triangle me-1 text-warning"></i>
                                                                                                    {targetQuiz ? "Belum ada detail soal dalam kuis ini." : "Data kuis tidak ditemukan atau belum dimuat."}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Lesson Completion Question */}
                                                                                    {!isQuiz && lecture.completion_question && (
                                                                                        <div className="acrd-checkpoint-box mt-2 p-2 rounded">
                                                                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                                                                <span className="small fw-bold text-success d-flex align-items-center gap-1">
                                                                                                    <i className="fas fa-check-circle"></i> Pertanyaan Penyelesaian Pelajaran
                                                                                                </span>
                                                                                                <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: "0.7rem" }}>
                                                                                                    {lecture.completion_question.question_type_display || "Pilihan Ganda"}
                                                                                                </span>
                                                                                            </div>
                                                                                            <p className="mb-1 text-dark small">
                                                                                                <strong>Soal:</strong> {lecture.completion_question.question_text}
                                                                                            </p>
                                                                                            {lecture.completion_question.choices && lecture.completion_question.choices.length > 0 && (
                                                                                                <div className="acrd-checkpoint-choices ps-2">
                                                                                                    {lecture.completion_question.choices.map((ch, chIdx) => (
                                                                                                        <div key={chIdx} className={`small py-0 d-flex align-items-center gap-1 ${ch.is_correct ? "text-success fw-bold" : "text-muted"}`}>
                                                                                                            <i className={`fas ${ch.is_correct ? "fa-check-circle text-success" : "fa-circle text-black-50"}`} style={{ fontSize: "0.65rem" }}></i>
                                                                                                            <span>{ch.choice_text}</span>
                                                                                                            {ch.is_correct && <span className="badge bg-success text-white py-0 px-1 ms-1" style={{ fontSize: "0.65rem" }}>Jawaban Benar</span>}
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                            {lecture.completion_question.correct_answer_text && (
                                                                                                <div className="small text-success mt-1 pt-1 border-top">
                                                                                                    <strong>Jawaban:</strong> {lecture.completion_question.correct_answer_text}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-muted">
                                            <i className="fas fa-folder-open mb-2" style={{ fontSize: "2rem" }}></i>
                                            <p className="small mb-0">Belum ada kurikulum yang ditambahkan pada kursus ini.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: QUIZZES */}
                            {(activeTab === "quizzes" || activeTab === "all") && (
                                <div className="acrd-card mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                        <div className="d-flex align-items-center gap-2">
                                            <i className="fas fa-list-check text-teal"></i>
                                            <h3 className="acrd-card-title mb-0">Daftar Kuis & Evaluasi</h3>
                                            <span className="badge bg-teal-subtle text-teal">
                                                {liveStats.quizzesCount} Kuis • {liveStats.totalQuestions} Total Soal
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-teal"
                                            onClick={toggleAllQuizzes}
                                            style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                                        >
                                            <i className="fas fa-expand-alt me-1"></i> Buka/Tutup Semua
                                        </button>
                                    </div>

                                    {course.quizzes && course.quizzes.length > 0 ? (
                                        <div className="acrd-quiz-stack">
                                            {course.quizzes.map((quiz, qIdx) => {
                                                const quizId = quiz.quiz_id || quiz.id || `quiz-${qIdx}`;
                                                const isExpanded = !!expandedQuizzes[quizId];
                                                const qCount = quiz.questions?.length || quiz.total_questions || 0;

                                                return (
                                                    <div key={quizId} className="acrd-quiz-block mb-2">
                                                        <div
                                                            className={`acrd-quiz-header ${isExpanded ? "expanded" : ""}`}
                                                            onClick={() => toggleQuiz(quizId)}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                                                                <span className="badge bg-teal text-white fw-bold" style={{ fontSize: "0.7rem" }}>
                                                                    Kuis {qIdx + 1}
                                                                </span>
                                                                <strong className="acrd-quiz-title text-truncate">
                                                                    {quiz.title || "Kuis Tanpa Judul"}
                                                                </strong>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                                <span className="badge bg-light text-dark border small">
                                                                    <i className="fas fa-question-circle text-teal me-1"></i> {qCount} Soal
                                                                </span>
                                                                {quiz.is_active !== undefined && (
                                                                    <span className={`badge ${quiz.is_active ? "bg-success-subtle text-success border border-success-subtle" : "bg-light text-muted border"} small`}>
                                                                        {quiz.is_active ? "Aktif" : "Nonaktif"}
                                                                    </span>
                                                                )}
                                                                <i className={`fas fa-chevron-down acrd-chevron ${isExpanded ? "rotated" : ""}`}></i>
                                                            </div>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="acrd-quiz-body">
                                                                {quiz.description && (
                                                                    <div className="small text-muted p-2 rounded bg-light mb-2 border">
                                                                        <i className="fas fa-info-circle text-teal me-1"></i>
                                                                        <strong>Petunjuk Kuis:</strong> {quiz.description}
                                                                    </div>
                                                                )}

                                                                {quiz.questions && quiz.questions.length > 0 ? (
                                                                    <div className="acrd-questions-list">
                                                                        {quiz.questions.map((question, quIdx) => (
                                                                            <div key={question.question_id || quIdx} className="acrd-question-card mb-2 p-2 rounded border bg-white">
                                                                                <div className="d-flex align-items-start gap-2 mb-2">
                                                                                    <span className="badge bg-dark text-white flex-shrink-0" style={{ fontSize: "0.7rem", marginTop: "2px" }}>
                                                                                        Soal {quIdx + 1}
                                                                                    </span>
                                                                                    <div className="fw-semibold small text-dark flex-grow-1">
                                                                                        {question.question_text}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Choices list */}
                                                                                {question.choices && question.choices.length > 0 ? (
                                                                                    <div className="acrd-choices-grid">
                                                                                        {question.choices.map((choice, cIdx) => (
                                                                                            <div
                                                                                                key={choice.choice_id || cIdx}
                                                                                                className={`acrd-choice-pill ${choice.is_correct ? "correct" : ""}`}
                                                                                            >
                                                                                                <span className="acrd-choice-letter">
                                                                                                    {String.fromCharCode(65 + cIdx)}.
                                                                                                </span>
                                                                                                <span className="acrd-choice-text flex-grow-1">
                                                                                                    {choice.choice_text}
                                                                                                </span>
                                                                                                {choice.is_correct && (
                                                                                                    <span className="badge bg-success text-white py-0 px-1 ms-1" style={{ fontSize: "0.65rem" }}>
                                                                                                        <i className="fas fa-check me-0"></i> Kunci
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-muted small fst-italic ps-4">
                                                                                        Belum ada pilihan jawaban untuk pertanyaan ini.
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-3 text-muted small fst-italic">
                                                                        <i className="fas fa-exclamation-triangle me-1 text-warning"></i> Belum ada detail soal dalam kuis ini.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-muted">
                                            <i className="fas fa-clipboard-check mb-2" style={{ fontSize: "2rem" }}></i>
                                            <p className="small mb-0">Belum ada kuis yang dibuat untuk kursus ini.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: GAMIFICATION */}
                            {(activeTab === "games" || activeTab === "all") && (
                                <div className="acrd-card mb-3">
                                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                        <div className="d-flex align-items-center gap-2">
                                            <i className="fas fa-gamepad text-teal"></i>
                                            <h3 className="acrd-card-title mb-0">Gamifikasi Pembelajaran</h3>
                                            <span className="badge bg-teal-subtle text-teal">
                                                {liveStats.gamesCount} Game • +{liveStats.totalGameXP} Total XP
                                            </span>
                                        </div>
                                    </div>

                                    {course.games && course.games.length > 0 ? (
                                        <div className="acrd-games-stack">
                                            {course.games.map((game, gIdx) => {
                                                const gameId = game.id || game.game_id || `game-${gIdx}`;
                                                const isExpanded = !!expandedGames[gameId];
                                                const meta = GAME_TYPE_META[game.game_type] || {
                                                    label: game.game_type,
                                                    shortLabel: "Game",
                                                    icon: "fas fa-gamepad",
                                                    color: "#0d9488",
                                                    bgColor: "#ccfbf1",
                                                    borderColor: "#99f6e4"
                                                };
                                                const gameData = game.game_data || {};
                                                let itemCount = 0;
                                                if (game.game_type === "crossword") itemCount = gameData.items?.length || 0;
                                                else if (game.game_type === "word_search") itemCount = gameData.words?.length || 0;
                                                else if (game.game_type === "anagram") itemCount = gameData.items?.length || 0;
                                                else if (game.game_type === "memory_match") itemCount = gameData.pairs?.length || 0;

                                                return (
                                                    <div key={gameId} className="acrd-game-block mb-2">
                                                        <div
                                                            className={`acrd-game-header ${isExpanded ? "expanded" : ""}`}
                                                            onClick={() => toggleGame(gameId)}
                                                            role="button"
                                                            tabIndex={0}
                                                        >
                                                            <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                                                                <span
                                                                    className="badge text-white px-2 py-1 flex-shrink-0"
                                                                    style={{ backgroundColor: meta.color, fontSize: "0.7rem", borderRadius: "4px" }}
                                                                >
                                                                    <i className={`${meta.icon} me-1`}></i>
                                                                    {meta.shortLabel}
                                                                </span>
                                                                <strong className="acrd-game-title text-truncate">
                                                                    {game.title || "Game Tanpa Judul"}
                                                                </strong>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                                <span className="badge bg-light text-dark border small">
                                                                    <i className="fas fa-trophy text-warning me-1"></i> +{game.points_reward || 0} XP
                                                                </span>
                                                                <span className="badge bg-light text-muted border small">
                                                                    {itemCount} {game.game_type === "memory_match" ? "Pasangan" : "Item"}
                                                                </span>
                                                                {game.is_active !== undefined && (
                                                                    <span className={`badge ${game.is_active ? "bg-success-subtle text-success border border-success-subtle" : "bg-light text-muted border"} small`}>
                                                                        {game.is_active ? "Aktif" : "Nonaktif"}
                                                                    </span>
                                                                )}
                                                                <i className={`fas fa-chevron-down acrd-chevron ${isExpanded ? "rotated" : ""}`}></i>
                                                            </div>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="acrd-game-body p-2 bg-light border-top">
                                                                {/* Game Parameters row */}
                                                                <div className="d-flex align-items-center gap-2 flex-wrap mb-2 p-2 bg-white rounded border">
                                                                    <span className="badge bg-light text-dark border small">
                                                                        <i className="fas fa-redo text-teal me-1"></i> Maks: <strong>{game.max_attempts}x Coba</strong>
                                                                    </span>
                                                                    <span className="badge bg-light text-dark border small">
                                                                        <i className="fas fa-clock text-info me-1"></i> Waktu: <strong>{game.time_limit_seconds > 0 ? `${game.time_limit_seconds} Detik` : "Tanpa Batas"}</strong>
                                                                    </span>
                                                                    <span className="badge bg-light text-dark border small">
                                                                        <i className="fas fa-layer-group text-primary me-1"></i> Jenis: <strong>{meta.label}</strong>
                                                                    </span>
                                                                </div>

                                                                {game.description && (
                                                                    <div className="small text-secondary mb-2 p-2 bg-white rounded border">
                                                                        <strong><i className="fas fa-info-circle text-teal me-1"></i>Petunjuk:</strong> {game.description}
                                                                    </div>
                                                                )}

                                                                {/* Crossword items */}
                                                                {game.game_type === "crossword" && (
                                                                    <div className="row g-2">
                                                                        {(gameData.items || []).map((item, qIdx) => (
                                                                            <div key={qIdx} className="col-md-6">
                                                                                <div className="p-2 bg-white border rounded h-100">
                                                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                                                        <span className="badge bg-info-subtle text-info fw-bold" style={{ fontSize: "0.7rem" }}>
                                                                                            Petunjuk {qIdx + 1}
                                                                                        </span>
                                                                                        <span className="badge bg-dark font-monospace" style={{ fontSize: "0.75rem" }}>
                                                                                            {item.answer || "____"}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="small text-secondary">{item.clue || "Petunjuk belum diisi"}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Word Search items */}
                                                                {game.game_type === "word_search" && (
                                                                    <div className="bg-white p-2 rounded border">
                                                                        <div className="small text-muted mb-1">
                                                                            Matriks Grid: <strong>{gameData.gridSize || 10}x{gameData.gridSize || 10}</strong> • Daftar Kata:
                                                                        </div>
                                                                        <div className="d-flex flex-wrap gap-1">
                                                                            {(gameData.words || []).map((w, wIdx) => {
                                                                                const wordText = typeof w === "object" ? w.word : w;
                                                                                const hintText = typeof w === "object" ? w.hint : "";
                                                                                return (
                                                                                    <div key={wIdx} className="badge bg-light text-dark border p-1 text-start">
                                                                                        <span className="font-monospace fw-bold text-teal">{wordText}</span>
                                                                                        {hintText && <div className="text-muted fw-normal" style={{ fontSize: "0.7rem" }}>{hintText}</div>}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Anagram items */}
                                                                {game.game_type === "anagram" && (
                                                                    <div className="row g-2">
                                                                        {(gameData.items || []).map((item, aIdx) => (
                                                                            <div key={aIdx} className="col-md-6">
                                                                                <div className="p-2 bg-white border rounded h-100">
                                                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                                                        <span className="badge bg-warning-subtle text-dark fw-bold" style={{ fontSize: "0.7rem" }}>
                                                                                            Kata {aIdx + 1}
                                                                                        </span>
                                                                                        <span className="font-monospace fw-bold text-teal" style={{ fontSize: "0.85rem" }}>
                                                                                            {item.word}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="small text-secondary">{item.clue || "Petunjuk belum diatur"}</div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Memory Match pairs */}
                                                                {game.game_type === "memory_match" && (
                                                                    <div className="row g-2">
                                                                        {(gameData.pairs || []).map((pair, pIdx) => (
                                                                            <div key={pIdx} className="col-md-6">
                                                                                <div className="p-2 bg-white border rounded h-100">
                                                                                    <div className="d-flex align-items-center gap-1 mb-1">
                                                                                        <span className="badge" style={{ backgroundColor: "#f3e8ff", color: "#7e22ce", fontSize: "0.7rem" }}>
                                                                                            Pasangan {pIdx + 1}
                                                                                        </span>
                                                                                        <strong className="text-dark small font-monospace">{pair.term}</strong>
                                                                                    </div>
                                                                                    <div className="small text-secondary p-1 bg-light rounded border" style={{ fontSize: "0.8rem" }}>
                                                                                        {pair.definition}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-muted">
                                            <i className="fas fa-dice mb-2" style={{ fontSize: "2rem" }}></i>
                                            <p className="small mb-0">Belum ada modul gamifikasi pada kursus ini.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 4: OVERVIEW, FEATURES, REQUIREMENTS, OUTCOMES */}
                            {(activeTab === "overview" || activeTab === "all") && (
                                <>
                                    {/* Description Card */}
                                    <div className="acrd-card mb-3">
                                        <div className="d-flex align-items-center gap-2 mb-2 pb-2 border-bottom">
                                            <i className="fas fa-file-alt text-teal"></i>
                                            <h3 className="acrd-card-title mb-0">Deskripsi Kursus</h3>
                                        </div>
                                        <div
                                            className="acrd-description-content"
                                            dangerouslySetInnerHTML={{
                                                __html: course.description || "<p class='text-muted fst-italic'>Tidak ada deskripsi kursus.</p>"
                                            }}
                                        />
                                    </div>

                                    {/* Features, Requirements & Learning Outcomes in a Compact 3-Column or Grid */}
                                    <div className="row g-3 mb-3">
                                        {/* What's Included */}
                                        <div className="col-md-4">
                                            <div className="acrd-card h-100">
                                                <div className="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom">
                                                    <i className="fas fa-check-circle text-teal"></i>
                                                    <strong className="small text-dark">Kursus Ini Termasuk</strong>
                                                    <span className="badge bg-light text-muted ms-auto">{liveStats.featuresCount}</span>
                                                </div>
                                                {course.features && course.features.length > 0 ? (
                                                    <ul className="list-unstyled mb-0 small">
                                                        {course.features.map((f, idx) => (
                                                            <li key={f.id || idx} className="d-flex align-items-start gap-1 mb-1 text-secondary">
                                                                <i className={`${f.icon || "fas fa-check"} text-teal mt-1 flex-shrink-0`} style={{ fontSize: "0.75rem" }}></i>
                                                                <span>{f.text}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-muted small fst-italic">Tidak ditentukan</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Requirements */}
                                        <div className="col-md-4">
                                            <div className="acrd-card h-100">
                                                <div className="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom">
                                                    <i className="fas fa-tasks text-warning"></i>
                                                    <strong className="small text-dark">Persyaratan</strong>
                                                    <span className="badge bg-light text-muted ms-auto">{liveStats.requirementsCount}</span>
                                                </div>
                                                {course.requirements && course.requirements.length > 0 ? (
                                                    <ul className="list-unstyled mb-0 small">
                                                        {course.requirements.map((r, idx) => (
                                                            <li key={r.id || idx} className="d-flex align-items-start gap-1 mb-1 text-secondary">
                                                                <span className="badge bg-warning-subtle text-dark border border-warning-subtle mt-0 flex-shrink-0" style={{ fontSize: "0.65rem", padding: "1px 4px" }}>
                                                                    {idx + 1}
                                                                </span>
                                                                <span>{r.requirement}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-muted small fst-italic">Tidak ada prasyarat khusus</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Learning Outcomes */}
                                        <div className="col-md-4">
                                            <div className="acrd-card h-100">
                                                <div className="d-flex align-items-center gap-2 mb-2 pb-1 border-bottom">
                                                    <i className="fas fa-bullseye text-info"></i>
                                                    <strong className="small text-dark">Hasil Pembelajaran</strong>
                                                    <span className="badge bg-light text-muted ms-auto">{liveStats.outcomesCount}</span>
                                                </div>
                                                {course.learning_outcomes && course.learning_outcomes.length > 0 ? (
                                                    <ul className="list-unstyled mb-0 small">
                                                        {course.learning_outcomes.map((o, idx) => (
                                                            <li key={o.id || idx} className="d-flex align-items-start gap-1 mb-1 text-secondary">
                                                                <i className="fas fa-caret-right text-info mt-1 flex-shrink-0"></i>
                                                                <span>{o.outcome}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className="text-muted small fst-italic">Tidak ditentukan</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Sticky Review Action Bar, Real Live Metrics, Instructor Info & Specs */}
                        <div className="col-lg-4">
                            <div className="acrd-sticky-sidebar">
                                {/* 1. Quick Decision / Action Card */}
                                <div className="acrd-card acrd-action-card mb-3 shadow-sm border-teal-subtle">
                                    <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                                        <strong className="small text-dark d-flex align-items-center gap-1">
                                            <i className="fas fa-stamp text-teal"></i>
                                            Tindakan Review Admin
                                        </strong>
                                        <span className={`acrd-status-dot ${statusInfo.className}`} title={statusInfo.description}></span>
                                    </div>

                                    <div className="acrd-status-callout mb-3 p-2 rounded">
                                        <div className="d-flex align-items-center gap-2">
                                            <i className={`${statusInfo.icon} fs-5`}></i>
                                            <div>
                                                <div className="fw-bold small">{statusInfo.label}</div>
                                                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                    {statusInfo.description}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="d-grid gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-teal-action"
                                            onClick={handleApproveCourse}
                                            disabled={approving || course.platform_status === "Published"}
                                        >
                                            {approving ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                    Memproses...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-check-circle me-1"></i>
                                                    Setujui & Publikasikan Kursus
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-outline-danger"
                                            onClick={handleRejectCourse}
                                            disabled={approving}
                                            style={{ fontSize: "0.85rem", padding: "8px 12px" }}
                                        >
                                            <i className="fas fa-times-circle me-1"></i>
                                            Tolak / Minta Revisi
                                        </button>
                                    </div>

                                    <div className="acrd-action-meta mt-3 pt-2 border-top text-muted small">
                                        <div className="d-flex justify-content-between py-0">
                                            <span>Status Platform:</span>
                                            <strong className="text-dark">{course.platform_status || "N/A"}</strong>
                                        </div>
                                        <div className="d-flex justify-content-between py-0">
                                            <span>Status Instruktur:</span>
                                            <strong className="text-dark">{course.teacher_course_status || "Draft"}</strong>
                                        </div>
                                        {course.approved_by_name && (
                                            <div className="d-flex justify-content-between py-0">
                                                <span>Disetujui Oleh:</span>
                                                <strong className="text-dark">{course.approved_by_name}</strong>
                                            </div>
                                        )}
                                        {course.approval_date && (
                                            <div className="d-flex justify-content-between py-0">
                                                <span>Tanggal Disetujui:</span>
                                                <span className="text-dark">
                                                    {new Date(course.approval_date).toLocaleDateString("id-ID")}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 2. Real Live Curriculum Metrics Grid */}
                                <div className="acrd-card mb-3">
                                    <div className="d-flex align-items-center gap-1 mb-2 pb-1 border-bottom">
                                        <i className="fas fa-chart-pie text-teal"></i>
                                        <strong className="small text-dark">Ringkasan Metrik Kursus (Live)</strong>
                                    </div>

                                    <div className="row g-2 acrd-mini-stats">
                                        <div className="col-6">
                                            <div className="acrd-stat-tile">
                                                <div className="acrd-stat-val text-teal">{liveStats.sectionsCount}</div>
                                                <div className="acrd-stat-lbl">Total Bagian</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="acrd-stat-tile">
                                                <div className="acrd-stat-val text-teal">{liveStats.lessonsCount}</div>
                                                <div className="acrd-stat-lbl">Total Pelajaran</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="acrd-stat-tile">
                                                <div className="acrd-stat-val text-dark">{liveStats.totalDurationFormatted}</div>
                                                <div className="acrd-stat-lbl">Total Durasi</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="acrd-stat-tile">
                                                <div className="acrd-stat-val text-primary">{liveStats.quizzesCount}</div>
                                                <div className="acrd-stat-lbl">Kuis ({liveStats.totalQuestions} Soal)</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="acrd-stat-tile">
                                                <div className="acrd-stat-val text-warning">{liveStats.gamesCount}</div>
                                                <div className="acrd-stat-lbl">Gamifikasi</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="acrd-stat-tile">
                                                <div className="acrd-stat-val text-success">+{liveStats.totalGameXP}</div>
                                                <div className="acrd-stat-lbl">Total XP Reward</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Instructor Profile Box */}
                                <div className="acrd-card mb-3">
                                    <div className="d-flex align-items-center gap-1 mb-2 pb-1 border-bottom">
                                        <i className="fas fa-id-badge text-teal"></i>
                                        <strong className="small text-dark">Profil Instruktur</strong>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 mb-2">
                                        <img
                                            src={teacherImage}
                                            alt={teacherName}
                                            className="acrd-avatar-md"
                                            onError={(e) => {
                                                e.target.src = DEFAULT_AVATAR_URL;
                                            }}
                                        />
                                        <div className="overflow-hidden">
                                            <strong className="text-dark d-block text-truncate small">{teacherName}</strong>
                                            <span className="text-muted d-block" style={{ fontSize: "0.75rem" }}>
                                                {course.teacher?.user_type || "Instruktur LMS DPD RI"}
                                            </span>
                                            {course.teacher?.email && (
                                                <span className="text-secondary d-block text-truncate" style={{ fontSize: "0.75rem" }}>
                                                    {course.teacher.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {course.teacher?.bio && (
                                        <div className="small text-muted p-2 rounded bg-light border fst-italic" style={{ fontSize: "0.75rem" }}>
                                            "{course.teacher.bio}"
                                        </div>
                                    )}

                                    {course.teacher?.last_login && (
                                        <div className="text-muted small mt-2 pt-1 border-top" style={{ fontSize: "0.7rem" }}>
                                            <i className="fas fa-history me-1"></i>
                                            Login terakhir: {new Date(course.teacher.last_login).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* 4. Course Metadata & Technical Specs */}
                                <div className="acrd-card mb-3">
                                    <div className="d-flex align-items-center gap-1 mb-2 pb-1 border-bottom">
                                        <i className="fas fa-cogs text-teal"></i>
                                        <strong className="small text-dark">Spesifikasi Kursus</strong>
                                    </div>

                                    <div className="acrd-specs-list small">
                                        <div className="d-flex justify-content-between py-1 border-bottom">
                                            <span className="text-muted">ID Kursus:</span>
                                            <span className="font-monospace fw-bold text-dark">{course.course_id}</span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 border-bottom">
                                            <span className="text-muted">Slug URL:</span>
                                            <span className="font-monospace text-truncate ms-2 text-dark" style={{ maxWidth: "160px" }}>
                                                {course.slug}
                                            </span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 border-bottom">
                                            <span className="text-muted">Kategori:</span>
                                            <span className="fw-semibold text-teal">{course.category?.title || "Umum"}</span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 border-bottom">
                                            <span className="text-muted">Tingkat Kesulitan:</span>
                                            <span>{getLevelText(course.level)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 border-bottom">
                                            <span className="text-muted">Tipe Modul:</span>
                                            <span className="fw-semibold">{getCourseTypeText(course.course_type)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1 border-bottom">
                                            <span className="text-muted">Target Peserta:</span>
                                            <span className="fw-semibold">{getTargetAudienceText(course.target_audience)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between py-1">
                                            <span className="text-muted">Tanggal Dibuat:</span>
                                            <span>{course.date ? new Date(course.date).toLocaleDateString("id-ID") : "-"}</span>
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    {course.tags && Array.isArray(course.tags) && course.tags.length > 0 && (
                                        <div className="mt-2 pt-2 border-top">
                                            <span className="text-muted small d-block mb-1">Tagar Kursus:</span>
                                            <div className="d-flex flex-wrap gap-1">
                                                {course.tags.map((t) => (
                                                    <span key={t.id || t} className="badge bg-light text-secondary border" style={{ fontSize: "0.7rem" }}>
                                                        #{typeof t === "object" ? t.title : t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default React.memo(AdminCourseReviewDetail);
