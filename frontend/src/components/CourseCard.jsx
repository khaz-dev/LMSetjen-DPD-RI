import React, { memo, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { moment } from "../utils/dayjs";
import {
    getImageUrl,
    getLevelBadgeStyle,
    getLevelText,
    getActualCourseStatus,
    getCourseCurriculumSummary,
    calculateCourseJP
} from "../utils/courseUtils.js";
import { calculateTotalDuration, parseDurationToSeconds } from "../utils/durationUtils";
import useAxios from "../utils/useAxios";
import Toast from "../views/plugin/Toast";

import "./CourseCard.css";

const CourseCard = ({ course, _index, viewMode = "grid" }) => {
    const navigate = useNavigate();
    const [editingCourse, setEditingCourse] = useState(false);

    // Calculate course curriculum completion with accurate helper
    const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(course);
    const hasCurriculum = sectionsCount > 0;
    const hasLessons = lessonsCount > 0;
    const hasQuiz = quizzesCount > 0;

    // Calculate progress percentage for drafts
    const calculateProgress = () => {
        let completed = 0;
        const total = 4;

        if (course.title && course.description) completed++; // Basic info
        if (hasCurriculum) completed++; // Has curriculum
        if (hasLessons) completed++; // Has lessons
        if (hasQuiz) completed++; // Has quiz

        return Math.round((completed / total) * 100);
    };

    const progress = calculateProgress();

    // Calculate total JP (Jam Pelatihan) based on UU ASN No. 20/2023 (1 JP = 45 mins)
    const totalJP = calculateCourseJP(course);

    // Get actual course status accurately
    const courseStatus = getActualCourseStatus(course);

    // Accurate check if this is a published course
    const isPublished = courseStatus.status === "Published" || course.is_published_version === true || course.platform_status === "Published";

    // Edit button - opens course editor or creates draft version
    const handleEditCourse = async (e) => {
        if (e) e.preventDefault();

        try {
            // Only call course-edit-published if this is strictly the published student-facing copy
            if (course.is_published_version === true) {
                setEditingCourse(true);
                const response = await useAxios.post(`teacher/course-edit-published/${course.course_id}/`);

                if (response.data?.success) {
                    const draftCourseId = response.data.course?.course_id || course.course_id;
                    const isNew = response.data.is_new;

                    if (isNew) {
                        Toast().fire({
                            icon: "success",
                            title: "Draft Revisi Berhasil Dibuat",
                            text: "Anda sekarang dapat mengedit draf revisi dari kursus terbit ini."
                        });
                    }

                    setTimeout(() => {
                        navigate(`/instructor/edit-course/${draftCourseId}/`);
                    }, 400);
                } else {
                    Toast().fire({
                        icon: "error",
                        title: "Error",
                        text: response.data?.message || "Gagal membuat draft kursus"
                    });
                }
            } else {
                // Course is already the editable draft
                navigate(`/instructor/edit-course/${course.course_id}/`);
            }
        } catch (error) {
            console.error("Error editing course:", error);
            Toast().fire({
                icon: "error",
                title: "Error",
                text: "Gagal membuka editor kursus. Silakan coba lagi."
            });
        } finally {
            setEditingCourse(false);
        }
    };

    // Monev Metrics & Analytics for Published Courses
    const enrolledStudents = useMemo(() => (Array.isArray(course.students) ? course.students : []), [course.students]);
    const studentsCount = enrolledStudents.length || (typeof course.students === "number" ? course.students : (course.students_count || 0));

    const completedStudentsCount = useMemo(() => {
        if (!enrolledStudents.length) return 0;
        return enrolledStudents.filter(s =>
            Boolean(s.certificate) ||
            s.completion_percentage === 100 ||
            (s.completion_metrics && s.completion_metrics.completed)
        ).length;
    }, [enrolledStudents]);

    const completionRate = studentsCount > 0 ? Math.round((completedStudentsCount / studentsCount) * 100) : 0;

    const pendingIntegrityCount = useMemo(() => {
        if (!enrolledStudents.length) return 0;
        return enrolledStudents.filter(s => s.integrity_status === 'pending_review').length;
    }, [enrolledStudents]);

    // Calculate Monev Health Indicator consistent with Setjen DPD RI standards
    const monevHealth = useMemo(() => {
        if (!isPublished) return null;
        if (studentsCount === 0) {
            return {
                status: "dormant",
                label: "Dorman",
                color: "#64748b",
                bg: "#f8fafc",
                border: "#cbd5e1",
                icon: "fa-moon",
                tooltip: "Belum ada pegawai/peserta terdaftar"
            };
        }
        if (studentsCount < 3) {
            return {
                status: "new",
                label: "Baru Terbit",
                color: "#0f766e",
                bg: "#f0fdfa",
                border: "#ccfbf1",
                icon: "fa-seedling",
                tooltip: `Partisipasi awal (${studentsCount} peserta terdaftar)`
            };
        }
        const avgRating = course.average_rating || 0;
        if (studentsCount >= 5 && (completionRate < 35 || (avgRating > 0 && avgRating < 3.0))) {
            return {
                status: "critical",
                label: "Perlu Pantau",
                color: "#b91c1c",
                bg: "#fef2f2",
                border: "#fecaca",
                icon: "fa-triangle-exclamation",
                tooltip: `Kelulusan rendah (${completionRate}%) - Perlu tindak lanjut monev`
            };
        }
        if (completionRate >= 60 || (completionRate >= 50 && avgRating >= 4.0)) {
            return {
                status: "healthy",
                label: "Monev Efektif",
                color: "#15803d",
                bg: "#f0fdf4",
                border: "#bbf7d0",
                icon: "fa-circle-check",
                tooltip: `Pembelajaran efektif (${completionRate}% kelulusan peserta)`
            };
        }
        return {
            status: "active",
            label: "Berjalan Aktif",
            color: "#0369a1",
            bg: "#f0f9ff",
            border: "#bae6fd",
            icon: "fa-chart-line",
            tooltip: `Progres kelulusan (${completionRate}%) - Berjalan aktif`
        };
    }, [isPublished, studentsCount, completionRate, course.average_rating]);

    // Determine next step for draft courses
    const getNextStep = () => {
        if (!hasCurriculum) {
            return {
                label: "Tambah Kurikulum",
                icon: "fa-list-check",
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: "#0f766e"
            };
        }
        if (!hasLessons) {
            return {
                label: "Tambah Pelajaran",
                icon: "fa-play-circle",
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: "#0284c7"
            };
        }
        if (!hasQuiz) {
            return {
                label: "Tambah Kuis",
                icon: "fa-question-circle",
                link: `/instructor/edit-course/${course.course_id}/quiz/`,
                color: "#d97706"
            };
        }
        return {
            label: "Siap Dipublikasikan",
            icon: "fa-check-circle",
            link: `/instructor/edit-course/${course.course_id}/`,
            color: "#16a34a"
        };
    };

    const nextStep = getNextStep();
    const lecturesCount = lessonsCount || (course.lectures?.length || 0);
    const durationInfo = lecturesCount > 0 ? calculateTotalDuration(course.lectures) : null;

    // ==========================================
    // LIST VIEW MODE (Compact Horizontal Row)
    // ==========================================
    if (viewMode === "list") {
        return (
            <div className="col-12">
                <div className="modern-course-card modern-course-card-list">
                    {/* Thumbnail */}
                    <div className="list-thumbnail-box" onClick={handleEditCourse}>
                        <img
                            src={getImageUrl(course.image)}
                            alt={course.title || "Course"}
                            className="list-course-thumb"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                                e.target.src = "/images/placeholders/default-course.svg";
                            }}
                        />
                        <span
                            className="list-thumb-status-badge"
                            style={{ background: courseStatus.color }}
                            title={courseStatus.text}
                        >
                            <i className={`fas ${courseStatus.icon}`}></i>
                        </span>
                    </div>

                    {/* Middle Info */}
                    <div className="list-course-body">
                        <div className="list-meta-chips">
                            <span
                                className="badge level-badge-sm"
                                style={{ background: getLevelBadgeStyle(course.level) }}
                            >
                                {getLevelText(course.level)}
                            </span>
                            <span className="course-meta-tag category-tag">
                                <i className="fas fa-folder-open me-1"></i>
                                {course.category?.title || "Umum"}
                            </span>
                            <span
                                className="course-meta-tag jp-tag"
                                title="Bobot Pelatihan: Sesuai Standar UU ASN No. 20/2023 Pasal 49 (1 JP = 45 menit)"
                            >
                                <i className="fas fa-award me-1" style={{ color: "#d97706" }}></i>
                                {totalJP} JP
                            </span>
                            <span className="course-meta-tag students-tag">
                                <i className="fas fa-user-graduate me-1"></i>
                                {studentsCount} Peserta
                            </span>
                            {durationInfo?.formatted && durationInfo.formatted !== "0m 0s" && (
                                <span className="course-meta-tag duration-tag">
                                    <i className="fas fa-clock me-1"></i>
                                    {durationInfo.formatted}
                                </span>
                            )}
                            <span className="course-meta-tag date-tag">
                                <i className="far fa-calendar-alt me-1"></i>
                                {course.date ? moment(course.date).format("DD MMM YYYY") : "Baru"}
                            </span>
                        </div>

                        <h4
                            className="course-title list-course-title mb-1"
                            title={course.title}
                            onClick={handleEditCourse}
                        >
                            {course.title || "Kursus Tanpa Judul"}
                        </h4>

                        {/* Monev Indicators for Published Courses */}
                        {isPublished ? (
                            <div className="list-monev-wrapper">
                                {monevHealth && (
                                    <span
                                        className="monev-health-chip"
                                        style={{
                                            color: monevHealth.color,
                                            backgroundColor: monevHealth.bg,
                                            borderColor: monevHealth.border
                                        }}
                                        title={monevHealth.tooltip}
                                    >
                                        <i className={`fas ${monevHealth.icon} me-1`}></i>
                                        {monevHealth.label}
                                    </span>
                                )}
                                <span className="list-monev-stat" title="Tingkat kelulusan peserta">
                                    <i className="fas fa-user-check me-1 text-teal"></i>
                                    <strong>{completionRate}%</strong> Lulus ({completedStudentsCount}/{studentsCount})
                                </span>
                                {course.average_rating > 0 && (
                                    <span className="list-monev-stat" title="Rating kepuasan peserta">
                                        <i className="fas fa-star me-1 text-warning"></i>
                                        {Number(course.average_rating).toFixed(1)}
                                    </span>
                                )}
                                {pendingIntegrityCount > 0 && (
                                    <span className="list-monev-alert" title="Ada ujian peserta menunggu verifikasi integritas">
                                        <i className="fas fa-exclamation-triangle text-warning me-1"></i>
                                        {pendingIntegrityCount} Verifikasi
                                    </span>
                                )}
                            </div>
                        ) : (
                            /* Progress for Draft */
                            courseStatus.status === "Draft" && (
                                <div className="list-progress-wrapper">
                                    <div className="list-progress-track">
                                        <div
                                            className="list-progress-fill"
                                            style={{ width: `${progress}%`, background: nextStep.color }}
                                        ></div>
                                    </div>
                                    <span className="list-progress-label" style={{ color: nextStep.color }}>
                                        <i className={`fas ${nextStep.icon} me-1`}></i>
                                        {progress}% • {nextStep.label}
                                    </span>
                                </div>
                            )
                        )}
                    </div>

                    {/* Right Actions */}
                    <div className="list-course-actions">
                        <span
                            className="status-pill-badge"
                            style={{
                                color: courseStatus.color,
                                backgroundColor: `${courseStatus.color}15`,
                                borderColor: `${courseStatus.color}35`
                            }}
                        >
                            <i className={`fas ${courseStatus.icon} me-1`}></i>
                            {courseStatus.text}
                        </span>

                        <div className="d-flex align-items-center gap-1 mt-2 flex-wrap justify-content-end">
                            {isPublished ? (
                                <>
                                    <Link
                                        to={`/instructor/courses/${course.course_id}/evaluation/`}
                                        className="btn course-action-btn course-action-btn-sm btn-monev-primary"
                                        title="Buka panel Monitoring & Evaluasi: Analisis Pre/Post-Test, ranking, integritas, dan ekspor laporan"
                                    >
                                        <i className="fas fa-chart-line me-1"></i>
                                        Monev
                                        {pendingIntegrityCount > 0 && (
                                            <span className="badge bg-danger ms-1 px-1 py-0 rounded-pill">{pendingIntegrityCount}</span>
                                        )}
                                    </Link>

                                    <button
                                        className="btn course-action-btn course-action-btn-sm btn-edit-secondary"
                                        onClick={handleEditCourse}
                                        disabled={editingCourse}
                                        title="Buka draf revisi untuk memperbarui materi kursus terbit ini"
                                    >
                                        <i className={`fas ${editingCourse ? "fa-spinner fa-spin" : "fa-pen-to-square"} me-1`}></i>
                                        {editingCourse ? "..." : "Revisi"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn course-action-btn course-action-btn-sm btn-edit"
                                    onClick={handleEditCourse}
                                    disabled={editingCourse}
                                    title="Edit Kursus"
                                >
                                    <i className={`fas ${editingCourse ? "fa-spinner fa-spin" : "fa-pen-to-square"} me-1`}></i>
                                    {editingCourse ? "Membuka..." : "Edit"}
                                </button>
                            )}

                            <button
                                className="btn course-action-btn course-action-btn-sm btn-view"
                                onClick={() => window.open(`/course-detail/${course.slug}/`, "_blank")}
                                title="Pratinjau Kursus Publik"
                            >
                                <i className="fas fa-eye me-1"></i>
                                Lihat
                            </button>

                            <Link
                                to={`/instructor/edit-course/${course.course_id}/curriculum/`}
                                className="btn course-action-btn course-action-btn-sm btn-curriculum"
                                title="Kurikulum Kursus"
                            >
                                <i className="fas fa-layer-group"></i>
                            </Link>
                            <Link
                                to={`/instructor/edit-course/${course.course_id}/gamification/`}
                                className="btn course-action-btn course-action-btn-sm btn-gamification"
                                title="Kelola Gamifikasi Kursus"
                            >
                                <i className="fas fa-gamepad"></i>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // GRID VIEW MODE (Compact Modern Card)
    // ==========================================
    return (
        <div className="col-xl-6 col-lg-6 col-md-12 mb-3">
            <div className={`modern-course-card modern-course-card-grid ${isPublished ? "modern-course-card-published" : ""}`}>
                {/* Thumbnail Header */}
                <div className="course-image-container" onClick={handleEditCourse}>
                    <img
                        src={getImageUrl(course.image)}
                        alt={course.title || "Course"}
                        className="course-image"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                            e.target.src = "/images/placeholders/default-course.svg";
                        }}
                    />

                    {/* Gradient overlay for text & badge contrast */}
                    <div className="course-image-overlay"></div>

                    {/* Top Badges */}
                    <div className="course-card-top-badges">
                        <span
                            className="badge level-badge"
                            style={{ background: getLevelBadgeStyle(course.level) }}
                        >
                            {getLevelText(course.level)}
                        </span>

                        <span
                            className="badge status-badge"
                            style={{ background: courseStatus.color }}
                        >
                            <i className={`fas ${courseStatus.icon} me-1`}></i>
                            {courseStatus.text}
                        </span>
                    </div>

                    {/* Bottom overlay badge: Duration / JP */}
                    <div className="course-card-bottom-badge">
                        <span
                            className="course-jp-chip"
                            title={`Bobot: ${totalJP} Jam Pelatihan (Standar UU ASN No. 20/2023 Pasal 49)`}
                        >
                            <i className="fas fa-award me-1 text-warning"></i>
                            {totalJP} JP{durationInfo?.formatted && durationInfo.formatted !== "0m 0s" ? ` • ${durationInfo.formatted}` : ""}
                        </span>
                    </div>
                </div>

                {/* Content Body */}
                <div className="course-content">
                    {/* Meta Row: Category, Students, JP, Date */}
                    <div className="course-meta-row">
                        <span className="course-meta-tag category-tag">
                            <i className="fas fa-folder-open me-1"></i>
                            {course.category?.title || "Umum"}
                        </span>
                        <span
                            className="course-meta-tag jp-tag"
                            title="Bobot: Sesuai Standar UU ASN No. 20/2023 Pasal 49 (1 JP = 45 menit)"
                        >
                            <i className="fas fa-award me-1" style={{ color: "#d97706" }}></i>
                            {totalJP} JP
                        </span>
                        <span className="course-meta-tag students-tag">
                            <i className="fas fa-user-graduate me-1"></i>
                            {studentsCount} Peserta
                        </span>
                        <span className="course-meta-tag date-tag">
                            <i className="far fa-calendar-alt me-1"></i>
                            {course.date ? moment(course.date).format("DD MMM YYYY") : "Baru"}
                        </span>
                    </div>

                    {/* Course Title */}
                    <h4
                        className="course-title"
                        title={course.title}
                        onClick={handleEditCourse}
                    >
                        {course.title || "Kursus Tanpa Judul"}
                    </h4>

                    {/* Monev Summary Box for Published Courses */}
                    {isPublished ? (
                        <div className="course-monev-summary-box">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="monev-summary-label">
                                    <i className="fas fa-chart-line me-1 text-teal"></i>
                                    <strong>Monev Pembelajaran</strong>
                                </span>
                                {monevHealth && (
                                    <span
                                        className="monev-health-chip"
                                        style={{
                                            color: monevHealth.color,
                                            backgroundColor: monevHealth.bg,
                                            borderColor: monevHealth.border
                                        }}
                                        title={monevHealth.tooltip}
                                    >
                                        <i className={`fas ${monevHealth.icon} me-1`}></i>
                                        {monevHealth.label}
                                    </span>
                                )}
                            </div>

                            {/* Mini Metrics 3-Col Grid */}
                            <div className="monev-mini-metrics">
                                <div className="monev-mini-metric-item" title="Tingkat kelulusan peserta kursus">
                                    <span className="monev-mini-val text-teal">{completionRate}%</span>
                                    <span className="monev-mini-lbl">Kelulusan</span>
                                </div>
                                <div className="monev-mini-divider"></div>
                                <div className="monev-mini-metric-item" title="Jumlah peserta lulus / total terdaftar">
                                    <span className="monev-mini-val">{completedStudentsCount}/{studentsCount}</span>
                                    <span className="monev-mini-lbl">Lulus / Total</span>
                                </div>
                                <div className="monev-mini-divider"></div>
                                <div className="monev-mini-metric-item" title="Rating kepuasan & ulasan peserta">
                                    <span className="monev-mini-val">
                                        <i className="fas fa-star text-warning me-1"></i>
                                        {course.average_rating ? Number(course.average_rating).toFixed(1) : "-"}
                                    </span>
                                    <span className="monev-mini-lbl">Rating ({course.rating_count || 0})</span>
                                </div>
                            </div>

                            {/* Pending Integrity Alert if any */}
                            {pendingIntegrityCount > 0 && (
                                <div className="monev-integrity-alert" title="Ada peserta ujian yang memerlukan verifikasi manual instruktur">
                                    <i className="fas fa-triangle-exclamation text-amber me-1"></i>
                                    <span><strong>{pendingIntegrityCount}</strong> ujian menunggu verifikasi integritas</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Progress Indicator for Draft Courses */
                        courseStatus.status === "Draft" && (
                            <div className="course-draft-progress-box">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="draft-progress-text">
                                        <i className="fas fa-tasks me-1"></i>
                                        Kelengkapan Modul
                                    </span>
                                    <span className="draft-progress-value" style={{ color: nextStep.color }}>
                                        {progress}%
                                    </span>
                                </div>
                                <div className="progress course-progress-track">
                                    <div
                                        className="progress-bar"
                                        role="progressbar"
                                        style={{
                                            width: `${progress}%`,
                                            background: `linear-gradient(90deg, ${nextStep.color} 0%, ${nextStep.color}dd 100%)`,
                                        }}
                                        aria-valuenow={progress}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                    ></div>
                                </div>
                                <Link
                                    to={nextStep.link}
                                    className="draft-next-step-link"
                                    style={{ color: nextStep.color, borderColor: `${nextStep.color}40` }}
                                >
                                    <span className="d-flex align-items-center gap-1 text-truncate">
                                        <i className={`fas ${nextStep.icon}`}></i>
                                        <span>{nextStep.label}</span>
                                    </span>
                                    <i className="fas fa-chevron-right ms-auto"></i>
                                </Link>
                            </div>
                        )
                    )}

                    {/* Action Buttons */}
                    <div className="course-actions">
                        {isPublished ? (
                            <>
                                <Link
                                    to={`/instructor/courses/${course.course_id}/evaluation/`}
                                    className="btn course-action-btn course-action-btn-sm btn-monev-primary flex-fill"
                                    title="Buka panel Monitoring & Evaluasi: Analisis Pre/Post-Test, ranking, integritas, dan ekspor laporan"
                                >
                                    <i className="fas fa-chart-line me-1"></i>
                                    <span>Monitoring & Evaluasi</span>
                                    {pendingIntegrityCount > 0 && (
                                        <span className="badge bg-danger ms-1 px-1 py-0 rounded-pill">{pendingIntegrityCount}</span>
                                    )}
                                </Link>

                                <button
                                    className="btn course-action-btn course-action-btn-sm btn-edit-secondary"
                                    onClick={handleEditCourse}
                                    disabled={editingCourse}
                                    title="Buka draf revisi untuk memperbarui materi kursus terbit ini"
                                >
                                    <i className={`fas ${editingCourse ? "fa-spinner fa-spin" : "fa-pen-to-square"} me-1`}></i>
                                    {editingCourse ? "Membuka..." : "Revisi"}
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn course-action-btn course-action-btn-sm btn-edit flex-fill"
                                onClick={handleEditCourse}
                                disabled={editingCourse}
                                title="Edit konten kursus"
                            >
                                <i className={`fas ${editingCourse ? "fa-spinner fa-spin" : "fa-pen-to-square"} me-1`}></i>
                                {editingCourse ? "Membuka..." : "Edit Kursus"}
                            </button>
                        )}

                        <button
                            className="btn course-action-btn course-action-btn-sm btn-view"
                            onClick={() => window.open(`/course-detail/${course.slug}/`, "_blank")}
                            title="Buka halaman publik kursus"
                        >
                            <i className="fas fa-eye me-1"></i>
                            Lihat
                        </button>

                        <Link
                            to={`/instructor/edit-course/${course.course_id}/curriculum/`}
                            className="btn course-action-btn course-action-btn-sm btn-curriculum"
                            title="Kelola Kurikulum & Materi"
                        >
                            <i className="fas fa-layer-group"></i>
                        </Link>
                        <Link
                            to={`/instructor/edit-course/${course.course_id}/gamification/`}
                            className="btn course-action-btn course-action-btn-sm btn-gamification"
                            title="Kelola Gamifikasi Kursus"
                        >
                            <i className="fas fa-gamepad"></i>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(CourseCard);
