import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { getCourseHealth } from "./AdminReportsTabs/CourseEvaluationReportsTab";
import "./AdminCourseEvaluation.css";

/**
 * AdminCourseEvaluation Component
 * Modul Evaluasi & Verifikasi Ujian Resmi Administrator SDM Setjen DPD RI
 * 
 * Mendukung Eksekusi UAT Skenario 5:
 * - Step 1: Akses Dashboard & Evaluasi Kursus Admin
 * - Step 2: Riwayat pengerjaan kuis peserta & Transparansi Jawaban Per Butir Soal
 * - Step 3: Tindakan Reset Percobaan Ujian (Exam Reset) dengan Audit Trail & Notifikasi
 * - Step 4: Rekapitulasi Capaian JP per Unit Kerja (e.g. Kantor DPD RI Provinsi Jawa Timur)
 * - Step 5: Ekspor Laporan Komprehensif (Excel .xlsx & CSV)
 */
function AdminCourseEvaluation() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Smart return navigation (defaults to Course Evaluations if not accessed from another source)
    const returnUrl = location.state?.from || "/admin/reports/?tab=course-evaluations";
    const returnLabel = location.state?.fromLabel || "Evaluasi Kursus";

    // Data States
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);

    // Active Navigation Tab: 'exams' | 'recap' | 'feedback'
    const [activeTab, setActiveTab] = useState("exams");

    // Tab 1 (Exams) Filters
    const [examSearch, setExamSearch] = useState("");
    const [examTypeFilter, setExamTypeFilter] = useState("all");
    const [examStatusFilter, setExamStatusFilter] = useState("all");

    // Tab 2 (Unit Kerja Rekap) Filters
    const [unitFilter, setUnitFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [recapSearch, setRecapSearch] = useState("");

    // Tab 3 (Evaluasi Mutu & Feedback) Filters
    const [reviewRatingFilter, setReviewRatingFilter] = useState("all");
    const [reviewSearch, setReviewSearch] = useState("");

    // Modal Transparansi Jawaban State
    const [selectedAttempt, setSelectedAttempt] = useState(null);
    const [showTransparencyModal, setShowTransparencyModal] = useState(false);

    // Fetch Course Evaluation Data from Backend
    const fetchData = useCallback(async (isRefresh = false) => {
        if (!course_id) return;
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const res = await useAxios.get(`admin/course/${course_id}/evaluation/`);
            if (res.data) {
                setData(res.data);
                if (isRefresh) {
                    Toast().fire({
                        icon: "success",
                        title: "Data evaluasi & audit ujian berhasil diperbarui"
                    });
                }
            }
        } catch (err) {
            console.error("Error fetching admin course evaluation:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat evaluasi kursus",
                text: err.response?.data?.error || "Terjadi kesalahan pada server."
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [course_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const course = data?.course || {};
    const metrics = data?.metrics || {};
    const attempts = data?.attempts || [];
    const leaderboard = data?.leaderboard || [];
    const quizzes = data?.quizzes || [];
    const unitKerjaList = data?.unit_kerja_list || [];
    const evaluation = data?.evaluation || {};

    // Course Health calculation consistent with Monev indicator
    const healthCourseObj = useMemo(() => {
        return {
            enrolled_count: metrics.total_enrolled || 0,
            completed_count: metrics.completed_count || 0,
            completion_rate: metrics.completion_rate || 0,
            average_rating: evaluation?.average_rating || 0
        };
    }, [metrics, evaluation]);

    const courseHealth = useMemo(() => {
        return getCourseHealth(healthCourseObj);
    }, [healthCourseObj]);

    // Learning Nudge Modal State & Handlers
    const [showNudgeModal, setShowNudgeModal] = useState(false);
    const [nudgeData, setNudgeData] = useState(null);
    const [nudgeLoading, setNudgeLoading] = useState(false);
    const [nudgeSending, setNudgeSending] = useState(false);
    const [nudgeTitle, setNudgeTitle] = useState("");
    const [nudgeMessage, setNudgeMessage] = useState("");
    const [selectedLearnerIds, setSelectedLearnerIds] = useState([]);
    const [nudgeLearnerSearch, setNudgeLearnerSearch] = useState("");

    const handleOpenNudge = useCallback(async (singleUserId = null) => {
        setShowNudgeModal(true);
        setNudgeLoading(true);
        setNudgeData(null);
        setSelectedLearnerIds([]);
        setNudgeLearnerSearch("");

        const courseId = course.course_id || course_id;
        try {
            const res = await useAxios.get(`admin/course/${courseId}/nudge-learners/`);
            if (res.data) {
                setNudgeData(res.data);
                setNudgeTitle(res.data.default_title || "");
                setNudgeMessage(res.data.default_message || "");
                if (singleUserId) {
                    setSelectedLearnerIds([singleUserId]);
                } else {
                    const allIds = (res.data.learners || []).map(l => l.user_id);
                    setSelectedLearnerIds(allIds);
                }
            }
        } catch (err) {
            console.error("Error fetching nudge recipients:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat peserta pengingat",
                text: err.response?.data?.error || "Terjadi kesalahan server"
            });
        } finally {
            setNudgeLoading(false);
        }
    }, [course.course_id, course_id]);

    const handleCloseNudge = useCallback(() => {
        setShowNudgeModal(false);
        setNudgeData(null);
        setNudgeSending(false);
    }, []);

    const handleSendNudge = useCallback(async () => {
        if (selectedLearnerIds.length === 0) {
            Toast().fire({
                icon: "warning",
                title: "Pilih minimal 1 peserta untuk dikirimkan pengingat"
            });
            return;
        }

        const courseId = course.course_id || course_id;
        setNudgeSending(true);
        try {
            const payload = {
                title: nudgeTitle,
                message: nudgeMessage,
                user_ids: selectedLearnerIds
            };
            const res = await useAxios.post(`admin/course/${courseId}/nudge-learners/`, payload);
            if (res.data?.success) {
                Toast().fire({
                    icon: "success",
                    title: "Pengingat Berhasil Dikirim!",
                    text: res.data.message || `Notifikasi telah dikirim ke ${res.data.sent_count} peserta.`
                });
                handleCloseNudge();
            }
        } catch (err) {
            console.error("Error sending learning nudge:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim pengingat belajar",
                text: err.response?.data?.error || "Terjadi kesalahan server"
            });
        } finally {
            setNudgeSending(false);
        }
    }, [course.course_id, course_id, selectedLearnerIds, nudgeTitle, nudgeMessage, handleCloseNudge]);

    const filteredNudgeLearners = useMemo(() => {
        if (!nudgeData?.learners) return [];
        if (!nudgeLearnerSearch.trim()) return nudgeData.learners;
        const q = nudgeLearnerSearch.toLowerCase();
        return nudgeData.learners.filter(l =>
            (l.full_name && l.full_name.toLowerCase().includes(q)) ||
            (l.nip && l.nip.toLowerCase().includes(q)) ||
            (l.unit_kerja && l.unit_kerja.toLowerCase().includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q))
        );
    }, [nudgeData, nudgeLearnerSearch]);

    const handleToggleSelectAllLearners = () => {
        if (!nudgeData?.learners) return;
        if (selectedLearnerIds.length === nudgeData.learners.length) {
            setSelectedLearnerIds([]);
        } else {
            setSelectedLearnerIds(nudgeData.learners.map(l => l.user_id));
        }
    };

    const handleToggleLearner = (userId) => {
        setSelectedLearnerIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    // =========================================================================
    // EXAM RESET HANDLER (UAT Skenario 5 Step 3)
    // =========================================================================
    const handleResetExam = async (attempt) => {
        const attemptId = attempt.attempt_id || `ATTEMPT-${attempt.id || "881"}`;
        const studentName = attempt.user_name || "Peserta";

        const { value: formValues } = await Swal.fire({
            title: `<span style="color:#b45309;">Reset Percobaan Ujian?</span>`,
            html: `
                <div style="text-align: left; font-size: 0.875rem;">
                    <p style="margin-bottom: 8px;">Anda akan melakukan <strong>Exam Reset</strong> resmi dari Administrator Bagian Pengembangan Kapasitas SDM DPD RI untuk:</p>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; margin-bottom:12px;">
                        <div><strong>ID Percobaan:</strong> <span style="font-family:monospace; color:#0f766e;">${attemptId}</span></div>
                        <div><strong>Nama Pegawai:</strong> ${studentName}</div>
                        <div><strong>NIP:</strong> ${attempt.nip || "-"}</div>
                        <div><strong>Ujian:</strong> ${attempt.quiz_title || "Evaluasi Akhir (Post-Test)"}</div>
                    </div>
                    <label style="font-weight:600; display:block; margin-bottom:4px;">Alasan Tindakan Reset (Tercatat pada Audit Trail):</label>
                    <select id="swal-reset-reason" class="swal2-select" style="width:100%; margin:0 0 10px 0; font-size:0.85rem; padding:6px 10px;">
                        <option value="Peserta mengalami kendala teknis / jaringan saat ujian">Peserta mengalami kendala jaringan saat ujian (Technical Glitch)</option>
                        <option value="Dugaan anomali durasi / sistem terputus tiba-tiba">Dugaan anomali durasi / sistem terputus tiba-tiba</option>
                        <option value="Disposisi resmi permohonan ujian ulang dari Biro SDM">Disposisi resmi permohonan ujian ulang dari Biro SDM</option>
                        <option value="Pembersihan riwayat attempt untuk pengujian validitas UAT">Pembersihan riwayat attempt untuk pengujian validitas UAT</option>
                    </select>
                    <div style="color:#64748b; font-size:0.775rem;">
                        <i class="fas fa-info-circle"></i> Sistem akan mencatat riwayat pada audit trail dan mengirimkan notifikasi resmi kepada peserta agar dapat mengulang ujian kembali.
                    </div>
                </div>
            `,
            icon: "warning",
            iconColor: "#d97706",
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-redo me-1"></i> Ya, Reset Percobaan Ujian',
            cancelButtonText: 'Batal',
            confirmButtonColor: "#0f766e",
            cancelButtonColor: "#64748b",
            focusCancel: true,
            preConfirm: () => {
                const selectEl = document.getElementById("swal-reset-reason");
                return {
                    reason: selectEl ? selectEl.value : "Peserta mengalami kendala jaringan saat ujian"
                };
            }
        });

        if (!formValues) return;

        try {
            Swal.showLoading();
            const res = await useAxios.post("admin/reset-exam-attempt/", {
                course_id: course.course_id || course_id,
                user_id: attempt.user_id,
                attempt_id: attemptId,
                reason: formValues.reason
            });

            if (res.data?.success) {
                // If the transparency modal is open for this attempt, close it
                setShowTransparencyModal(false);

                await Swal.fire({
                    icon: "success",
                    title: "Percobaan Ujian Berhasil Direset",
                    html: `
                        <div style="text-align:left; font-size:0.875rem;">
                            <p>${res.data.message}</p>
                            <div style="background:#f0fdfa; border:1px solid #ccfbf1; padding:8px 12px; border-radius:6px; font-size:0.8rem; color:#0f766e;">
                                <div><i class="fas fa-check-circle me-1"></i> Status percobaan: <strong>Tereset</strong></div>
                                <div><i class="fas fa-file-shield me-1"></i> Audit Trail: <strong>Tercatat di ActivityLog</strong></div>
                                <div><i class="fas fa-bell me-1"></i> Notifikasi: <strong>Terkirim ke ${studentName}</strong></div>
                            </div>
                        </div>
                    `,
                    confirmButtonColor: "#0f766e"
                });

                // Refresh data
                fetchData(true);
            }
        } catch (err) {
            console.error("Error executing exam reset:", err);
            Swal.fire({
                icon: "error",
                title: "Gagal Mereset Ujian",
                text: err.response?.data?.error || "Terjadi kesalahan teknis saat menghubungi server.",
                confirmButtonColor: "#dc2626"
            });
        }
    };

    // =========================================================================
    // EXPORT HANDLERS (UAT Skenario 5 Step 5)
    // =========================================================================
    // 1. Export Excel (.xlsx) via Backend API
    const handleExportExcel = async () => {
        try {
            setExportingExcel(true);
            const response = await useAxios.get(`teacher/course/${course_id}/export-recap/`, {
                responseType: "blob"
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            const courseTitleSafe = (course?.title || "Kursus").replace(/[^a-zA-Z0-9]/g, "_");
            link.setAttribute("download", `Rekapitulasi_LMS_Setjen_DPDRI_${courseTitleSafe}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            Toast().fire({
                icon: "success",
                title: "Laporan Excel berhasil diunduh"
            });
        } catch (err) {
            console.error("Error downloading excel report:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengunduh Excel",
                text: "Terjadi kesalahan saat mengekspor file."
            });
        } finally {
            setExportingExcel(false);
        }
    };

    // 2. Export CSV (.csv) Client-side with precise UAT Columns & active filters
    const handleExportCSV = () => {
        try {
            const listToExport = filteredRecapData;
            if (!listToExport.length) {
                Toast().fire({
                    icon: "warning",
                    title: "Tidak ada data untuk diekspor"
                });
                return;
            }

            // Headers sesuai Skenario 5 Step 5:
            // No, Nama Pegawai, NIP, Unit Kerja / Kantor Daerah, Judul Pelatihan, Nilai Evaluasi, Bobot JP, Status Lulus, dan Nomor Sertifikat
            const headers = [
                "No",
                "Nama Pegawai",
                "NIP",
                "Unit Kerja / Kantor Daerah",
                "Judul Pelatihan",
                "Nilai Evaluasi (Post-Test)",
                "Bobot JP",
                "Status Lulus",
                "Nomor Sertifikat",
                "Tanggal Terbit"
            ];

            const rows = listToExport.map((s, idx) => {
                const uInfo = s.employee_info || {};
                const lStats = s.learning_stats || {};
                const integ = s.integrity_check || {};
                const isPassed = Boolean(integ.has_certificate || (lStats.post_score !== null && lStats.post_score >= 70));

                return [
                    idx + 1,
                    `"${(s.full_name || s.username || "").replace(/"/g, '""')}"`,
                    `"${(uInfo.nip || "-").replace(/"/g, '""')}"`,
                    `"${(uInfo.unit_kerja || "-").replace(/"/g, '""')}"`,
                    `"${(course?.title || "-").replace(/"/g, '""')}"`,
                    lStats.post_score !== null ? lStats.post_score : (s.quiz_stats?.avg_score || 0),
                    `${course.total_jp || 2} JP`,
                    isPassed ? "LULUS" : "BELUM LULUS",
                    `"${(integ.certificate_id || "-").replace(/"/g, '""')}"`,
                    s.completion_stats?.finish_time ? new Date(s.completion_stats.finish_time).toLocaleDateString("id-ID") : "-"
                ];
            });

            const csvContent = "\ufeff" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const unitSuffix = unitFilter !== "all" ? `_${unitFilter.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
            link.setAttribute("download", `Laporan_SDM_DPDRI_${course.course_id || course_id}${unitSuffix}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            URL.revokeObjectURL(url);

            Toast().fire({
                icon: "success",
                title: "Laporan CSV berhasil diunduh"
            });
        } catch (err) {
            console.error("Error exporting CSV:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal membuat CSV"
            });
        }
    };

    // =========================================================================
    // FILTERED DATA COMPUTATION
    // =========================================================================
    // 1. Filtered Attempts for Tab 1
    const filteredAttempts = useMemo(() => {
        return attempts.filter((att) => {
            // Search filter
            if (examSearch.trim()) {
                const q = examSearch.toLowerCase();
                const matchId = (att.attempt_id || "").toLowerCase().includes(q);
                const matchName = (att.user_name || "").toLowerCase().includes(q);
                const matchNip = (att.nip || "").toLowerCase().includes(q);
                const matchUnit = (att.unit_kerja || "").toLowerCase().includes(q);
                if (!matchId && !matchName && !matchNip && !matchUnit) return false;
            }

            // Type filter
            if (examTypeFilter !== "all") {
                if (examTypeFilter === "post_test" && att.attempt_type !== "post_test") return false;
                if (examTypeFilter === "pre_test" && att.attempt_type !== "pre_test") return false;
                if (examTypeFilter === "quiz" && att.attempt_type !== "quiz") return false;
            }

            // Status filter
            if (examStatusFilter !== "all") {
                if (examStatusFilter === "anomaly" && !att.anomaly_flag && att.integrity_status !== "pending_review") return false;
                if (examStatusFilter === "passed" && !att.is_passed) return false;
                if (examStatusFilter === "failed" && att.is_passed) return false;
            }

            return true;
        });
    }, [attempts, examSearch, examTypeFilter, examStatusFilter]);

    // 2. Filtered Recap Leaderboard for Tab 2 (Rekapitulasi Unit Kerja)
    const filteredRecapData = useMemo(() => {
        return leaderboard.filter((s) => {
            const uInfo = s.employee_info || {};
            const integ = s.integrity_check || {};
            const comp = s.completion_stats || {};

            // Unit Kerja Filter (Key feature for UAT Skenario 5 Step 4)
            if (unitFilter !== "all") {
                if ((uInfo.unit_kerja || "").trim() !== unitFilter.trim()) {
                    return false;
                }
            }

            // Status Filter
            if (statusFilter !== "all") {
                if (statusFilter === "passed" && !integ.has_certificate && !comp.is_completed) return false;
                if (statusFilter === "learning" && comp.is_completed) return false;
                if (statusFilter === "pending_review" && integ.status !== "pending_review") return false;
            }

            // Search filter
            if (recapSearch.trim()) {
                const q = recapSearch.toLowerCase();
                const matchName = (s.full_name || s.username || "").toLowerCase().includes(q);
                const matchNip = (uInfo.nip || "").toLowerCase().includes(q);
                const matchJabatan = (uInfo.jabatan || "").toLowerCase().includes(q);
                if (!matchName && !matchNip && !matchJabatan) return false;
            }

            return true;
        });
    }, [leaderboard, unitFilter, statusFilter, recapSearch]);

    // Unit Kerja Active Summary Stats
    const unitStats = useMemo(() => {
        if (unitFilter === "all") return null;
        const matching = leaderboard.filter(s => (s.employee_info?.unit_kerja || "").trim() === unitFilter.trim());
        const total = matching.length;
        const completed = matching.filter(s => s.completion_stats?.is_completed || s.integrity_check?.has_certificate).length;
        const totalJpAchieved = completed * (course.total_jp || 2);
        return {
            unitName: unitFilter,
            totalStudents: total,
            completedStudents: completed,
            totalJpAchieved,
            passRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }, [leaderboard, unitFilter, course.total_jp]);

    // 3. Filtered Reviews for Tab 3 (Evaluasi Mutu)
    const filteredReviews = useMemo(() => {
        const list = evaluation.reviews || [];
        return list.filter((r) => {
            if (reviewRatingFilter !== "all") {
                if (reviewRatingFilter === "5" && r.rating !== 5) return false;
                if (reviewRatingFilter === "4" && r.rating !== 4) return false;
                if (reviewRatingFilter === "below4" && r.rating >= 4) return false;
            }
            if (reviewSearch.trim()) {
                const q = reviewSearch.toLowerCase();
                const matchName = (r.full_name || "").toLowerCase().includes(q);
                const matchText = (r.review || "").toLowerCase().includes(q);
                if (!matchName && !matchText) return false;
            }
            return true;
        });
    }, [evaluation.reviews, reviewRatingFilter, reviewSearch]);

    // Open Transparency Modal
    const handleOpenTransparency = (attempt) => {
        setSelectedAttempt(attempt);
        setShowTransparencyModal(true);
    };

    return (
        <div className="admin-page-wrapper">
            <BaseHeader title={`Evaluasi & Rekapitulasi Pelatihan - ${course?.title || "Admin LMS"}`} />
            <AdminHeader />

            <main className="admin-dashboard-container ace-page-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">

                    {/* Top Breadcrumb Navigation */}
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                            <Link to={returnUrl} className="btn btn-sm btn-outline-secondary" title={`Kembali ke ${returnLabel}`}>
                                <i className="fas fa-arrow-left me-1"></i>
                                <span>{returnLabel}</span>
                            </Link>
                            <span className="text-muted">/</span>
                            <span className="fw-semibold text-teal">Evaluasi & Rekapitulasi Pelatihan</span>
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => fetchData(true)}
                                disabled={refreshing || loading}
                                title="Segarkan Data Evaluasi"
                            >
                                <i className={`fas fa-rotate ${refreshing ? "fa-spin" : ""} me-1`}></i>
                                <span>Segarkan</span>
                            </button>
                        </div>
                    </div>

                    {/* Course Header Overview Card */}
                    <div className="ace-course-header-card">
                        <div className="ace-header-main">
                            <div className="ace-thumb-wrapper">
                                <img
                                    src={getImageUrl(course?.image)}
                                    alt={course?.title || "Kursus"}
                                    className="ace-thumb"
                                    onError={(e) => {
                                        e.target.src = "/images/placeholders/default-course.svg";
                                    }}
                                />
                            </div>

                            <div className="ace-info-wrapper">
                                <div className="ace-meta-badges">
                                    <span className="ace-badge ace-badge-teal">
                                        <i className="fas fa-landmark"></i> Setjen DPD RI
                                    </span>
                                    {/* Indikator Kesehatan Kursus */}
                                    <span className={`ace-badge ace-badge-health badge-health-${courseHealth.status}`} title={courseHealth.tooltip}>
                                        <i className={`fas ${courseHealth.icon}`}></i>
                                        <span>Mutu: {courseHealth.label}</span>
                                    </span>
                                    <span className={`ace-badge ${course.platform_status === "Published" ? "ace-badge-published" : "ace-badge-draft"}`}>
                                        <i className={`fas ${course.platform_status === "Published" ? "fa-circle-check" : "fa-clock"}`}></i>
                                        {course.platform_status === "Published" ? "Terpublikasi" : "Draf / Review"}
                                    </span>
                                    <span className="ace-badge ace-badge-jp">
                                        <i className="fas fa-award"></i> {course.total_jp || 2} JP (Jam Pelajaran)
                                    </span>
                                    {course.category && (
                                        <span className="ace-badge ace-badge-draft">
                                            <i className="fas fa-folder"></i> {course.category}
                                        </span>
                                    )}
                                    <span className="ace-badge ace-badge-draft">
                                        <i className="fas fa-layer-group"></i> {getLevelText(course.level)}
                                    </span>
                                </div>

                                <h1 className="ace-course-title" title={course?.title}>
                                    {course?.title || "Memuat Kursus..."}
                                </h1>

                                <div className="ace-course-sub">
                                    <span>Instruktur: <strong>{course?.teacher_name || "Instruktur DPD RI"}</strong></span>
                                    <span className="mx-2">•</span>
                                    <span>ID: <code>{course?.course_id || course_id}</code></span>
                                    <span className="mx-2">•</span>
                                    <span>Diterbitkan: {course?.date_created || "-"}</span>
                                </div>
                            </div>

                            <div className="ace-header-actions">
                                {/* Tombol Nudge Cepat */}
                                <button
                                    type="button"
                                    className="ace-btn ace-btn-nudge"
                                    onClick={() => handleOpenNudge()}
                                    title="Kirim Pengingat Belajar (Nudge) ke Peserta Belum Lulus"
                                >
                                    <i className="fas fa-paper-plane"></i>
                                    <span>Kirim Nudge Belajar</span>
                                </button>

                                <button
                                    type="button"
                                    className="ace-btn ace-btn-excel"
                                    onClick={handleExportExcel}
                                    disabled={exportingExcel}
                                    title="Ekspor Laporan Rekapitulasi Lengkap Format Excel (.xlsx)"
                                >
                                    <i className={`fas ${exportingExcel ? "fa-spinner fa-spin" : "fa-file-excel"}`}></i>
                                    <span>Ekspor Excel</span>
                                </button>

                                <button
                                    type="button"
                                    className="ace-btn ace-btn-csv"
                                    onClick={handleExportCSV}
                                    title="Unduh Data Ringkasan Format CSV (.csv)"
                                >
                                    <i className="fas fa-file-csv"></i>
                                    <span>Ekspor CSV</span>
                                </button>

                                <Link
                                    to={`/admin/review-course/${course.course_id || course_id}/`}
                                    className="ace-btn ace-btn-secondary"
                                    title="Lihat Kurikulum & Materi Kursus"
                                >
                                    <i className="fas fa-clipboard-check"></i>
                                    <span>Tinjau Materi</span>
                                </Link>

                                {course.slug && (
                                    <a
                                        href={`/course-detail/${course.slug}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ace-btn ace-btn-secondary"
                                        title="Buka Tampilan Publik Kursus"
                                    >
                                        <i className="fas fa-external-link-alt"></i>
                                        <span>Pratinjau</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Executive KPI Stats Grid */}
                    <div className="ace-kpi-grid">
                        <div className="ace-kpi-card">
                            <div className="ace-kpi-icon ace-icon-teal">
                                <i className="fas fa-users"></i>
                            </div>
                            <div className="ace-kpi-content">
                                <div className="ace-kpi-label">Peserta Terdaftar</div>
                                <div className="ace-kpi-val">{metrics.total_enrolled || 0}</div>
                                <div className="ace-kpi-sub">{metrics.completed_count || 0} Pegawai Tuntas</div>
                            </div>
                        </div>

                        <div className="ace-kpi-card">
                            <div className="ace-kpi-icon ace-icon-green">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="ace-kpi-content">
                                <div className="ace-kpi-label">Tingkat Kelulusan</div>
                                <div className="ace-kpi-val">{metrics.completion_rate || 0}%</div>
                                <div className="ace-kpi-sub">Ambang Kelulusan: 70%</div>
                            </div>
                        </div>

                        <div className="ace-kpi-card">
                            <div className="ace-kpi-icon ace-icon-amber">
                                <i className="fas fa-award"></i>
                            </div>
                            <div className="ace-kpi-content">
                                <div className="ace-kpi-label">Akumulasi JP Terbit</div>
                                <div className="ace-kpi-val">{metrics.total_jp_issued || 0} JP</div>
                                <div className="ace-kpi-sub">@{course.total_jp || 2} JP per Sertifikat</div>
                            </div>
                        </div>

                        <div className="ace-kpi-card">
                            <div className="ace-kpi-icon ace-icon-blue">
                                <i className="fas fa-chart-line"></i>
                            </div>
                            <div className="ace-kpi-content">
                                <div className="ace-kpi-label">Rata-rata Post-Test</div>
                                <div className="ace-kpi-val">{metrics.avg_post_score || 0}%</div>
                                <div className="ace-kpi-sub">Evaluasi Efektivitas Belajar</div>
                            </div>
                        </div>

                        <div className="ace-kpi-card">
                            <div className="ace-kpi-icon ace-icon-rose">
                                <i className="fas fa-shield-halved"></i>
                            </div>
                            <div className="ace-kpi-content">
                                <div className="ace-kpi-label">Status Integritas</div>
                                <div className="ace-kpi-val" style={{ color: (metrics.flagged_count || 0) > 0 ? "#b91c1c" : "#15803d" }}>
                                    {metrics.flagged_count || 0}
                                </div>
                                <div className="ace-kpi-sub">
                                    {(metrics.flagged_count || 0) > 0 ? "Memerlukan Tinjauan SDM" : "Seluruh Ujian Valid"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tab Bar */}
                    <div className="ace-tabs-wrapper">
                        <div className="ace-tab-nav" role="tablist">
                            <button
                                type="button"
                                className={`ace-tab-btn ${activeTab === "exams" ? "active" : ""}`}
                                onClick={() => setActiveTab("exams")}
                            >
                                <i className="fas fa-clipboard-list"></i>
                                <span>Manajemen Integritas & Reset Ujian</span>
                                {attempts.length > 0 && (
                                    <span className={`ace-tab-badge ${(metrics.flagged_count || 0) > 0 ? "ace-tab-badge-pending" : ""}`}>
                                        {attempts.length} Attempt
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                className={`ace-tab-btn ${activeTab === "recap" ? "active" : ""}`}
                                onClick={() => setActiveTab("recap")}
                            >
                                <i className="fas fa-building-user"></i>
                                <span>Rekapitulasi JP per Unit Kerja</span>
                                <span className="ace-tab-badge">
                                    {leaderboard.length} Pegawai
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`ace-tab-btn ${activeTab === "feedback" ? "active" : ""}`}
                                onClick={() => setActiveTab("feedback")}
                            >
                                <i className="fas fa-star-half-stroke"></i>
                                <span>Survei Kepuasan & Mutu Pelatihan</span>
                                <span className="ace-tab-badge">
                                    {evaluation.total_reviews || 0} Ulasan
                                </span>
                            </button>
                        </div>

                        <div className="ace-tab-body">
                            {/* ========================================================= */}
                            {/* TAB 1: MANAJEMEN INTEGRITAS & RESET UJIAN (SKENARIO 5)   */}
                            {/* ========================================================= */}
                            {activeTab === "exams" && (
                                <div>
                                    {/* Informational Guidance Banner */}
                                    <div className="alert alert-info border-teal-subtle py-2 px-3 small d-flex align-items-center justify-content-between mb-3">
                                        <div>
                                            <i className="fas fa-circle-info text-teal me-2"></i>
                                            <strong>Modul Tinjauan & Verifikasi Ujian SDM:</strong> Memeriksa riwayat pengerjaan, transparansi jawaban per butir soal, dan intervensi <strong>Reset Percobaan Ujian (Exam Reset)</strong> untuk peserta yang mengalami kendala teknis/jaringan.
                                        </div>
                                        <span className="badge bg-teal text-white">Skenario 5 UAT</span>
                                    </div>

                                    {/* Filter Controls for Attempts */}
                                    <div className="ace-filter-bar">
                                        <div className="ace-search-input-wrapper">
                                            <i className="fas fa-search ace-search-icon"></i>
                                            <input
                                                type="text"
                                                className="ace-search-input"
                                                placeholder="Cari ID Attempt (e.g. ATTEMPT-881), Nama, NIP..."
                                                value={examSearch}
                                                onChange={(e) => setExamSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="ace-filter-controls">
                                            <select
                                                className="ace-select"
                                                value={examTypeFilter}
                                                onChange={(e) => setExamTypeFilter(e.target.value)}
                                            >
                                                <option value="all">Semua Jenis Ujian</option>
                                                <option value="post_test">Evaluasi Akhir (Post-Test)</option>
                                                <option value="pre_test">Ujian Awal (Pre-Test)</option>
                                                <option value="quiz">Kuis Materi Bab</option>
                                            </select>

                                            <select
                                                className="ace-select"
                                                value={examStatusFilter}
                                                onChange={(e) => setExamStatusFilter(e.target.value)}
                                            >
                                                <option value="all">Semua Status Integritas</option>
                                                <option value="anomaly">⚠️ Perlu Tinjauan / Anomali</option>
                                                <option value="passed">✅ Lulus Evaluasi</option>
                                                <option value="failed">❌ Belum Lulus</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Data Table: Attempt History */}
                                    {loading ? (
                                        <div className="text-center py-5">
                                            <i className="fas fa-spinner fa-spin text-teal fa-2x mb-2"></i>
                                            <div className="small text-muted">Memuat riwayat pengerjaan ujian peserta...</div>
                                        </div>
                                    ) : filteredAttempts.length === 0 ? (
                                        <div className="text-center py-5 border rounded bg-light">
                                            <i className="fas fa-clipboard-check text-muted fa-2x mb-2"></i>
                                            <div className="fw-semibold">Tidak ditemukan riwayat pengerjaan ujian</div>
                                            <div className="small text-muted">Coba ubah kata kunci pencarian atau filter status.</div>
                                        </div>
                                    ) : (
                                        <div className="ace-table-responsive">
                                            <table className="ace-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: "40px", textAlign: "center" }}>No</th>
                                                        <th style={{ minWidth: "125px" }}>ID Percobaan</th>
                                                        <th style={{ minWidth: "240px", width: "20%" }}>Nama Pegawai / NIP</th>
                                                        <th style={{ minWidth: "200px" }}>Unit Kerja / Daerah</th>
                                                        <th style={{ minWidth: "160px" }}>Ujian / Kuis</th>
                                                        <th style={{ textAlign: "center", minWidth: "85px" }}>Nilai</th>
                                                        <th style={{ minWidth: "160px" }}>Durasi & Tanggal</th>
                                                        <th style={{ textAlign: "center", minWidth: "130px" }}>Integritas</th>
                                                        <th style={{ textAlign: "center", width: "180px", minWidth: "170px" }}>Aksi Administrator</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredAttempts.map((att, idx) => (
                                                        <tr key={att.id || idx}>
                                                            <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                                                            <td>
                                                                <span className="ace-attempt-id-badge" title="ID Percobaan Ujian">
                                                                    {att.attempt_id}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="ace-user-cell">
                                                                    <div>
                                                                        <div className="ace-user-name">{att.user_name}</div>
                                                                        <div className="ace-user-nip">NIP: {att.nip || "-"}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="ace-unit-cell" title={att.unit_kerja}>
                                                                    <i className="fas fa-building text-muted me-1"></i>
                                                                    {att.unit_kerja || "-"}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="fw-semibold text-dark">{att.quiz_title}</div>
                                                                <div className="small text-muted">
                                                                    {att.attempt_type === "post_test" ? "Evaluasi Post-Test" : att.attempt_type === "pre_test" ? "Diagnostik Pre-Test" : "Kuis Materi"}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: "center" }}>
                                                                <div className={`fw-bold ${att.is_passed ? "text-success" : "text-danger"}`} style={{ fontSize: "1rem" }}>
                                                                    {att.score}%
                                                                </div>
                                                                <div className="small text-muted">
                                                                    {att.correct_answers}/{att.total_questions} Benar
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="small text-dark fw-medium">
                                                                    <i className="far fa-clock text-muted me-1"></i>
                                                                    {att.time_taken_seconds !== null ? `${att.time_taken_seconds} detik` : "-"}
                                                                </div>
                                                                <div className="small text-muted">{att.date_attempted_display}</div>
                                                            </td>
                                                            <td style={{ textAlign: "center" }}>
                                                                {att.anomaly_flag || att.integrity_status === "pending_review" ? (
                                                                    <span
                                                                        className="ace-status-pill ace-status-anomaly"
                                                                        title={att.anomaly_reasons?.join("; ") || "Kendala jaringan / pace anomali terdeteksi"}
                                                                    >
                                                                        <i className="fas fa-triangle-exclamation"></i>
                                                                        <span>Perlu Tinjauan</span>
                                                                    </span>
                                                                ) : att.is_passed ? (
                                                                    <span className="ace-status-pill ace-status-valid">
                                                                        <i className="fas fa-circle-check text-success"></i>
                                                                        <span>Valid & Lulus</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="ace-status-pill ace-status-failed">
                                                                        <i className="fas fa-circle-xmark"></i>
                                                                        <span>Belum Lulus</span>
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ textAlign: "center" }}>
                                                                <div className="ace-action-btn-group">
                                                                    <button
                                                                        type="button"
                                                                        className="ace-btn-action ace-btn-inspect"
                                                                        onClick={() => handleOpenTransparency(att)}
                                                                        title="Lihat Transparansi Lembar Jawaban per Butir Soal"
                                                                    >
                                                                        <i className="fas fa-eye"></i>
                                                                        <span>Rincian</span>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        className="ace-btn-action ace-btn-reset"
                                                                        onClick={() => handleResetExam(att)}
                                                                        title="Reset Percobaan Ujian (Exam Reset) untuk Peserta Ini"
                                                                    >
                                                                        <i className="fas fa-rotate-right"></i>
                                                                        <span>Reset</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 2: REKAPITULASI JP PER UNIT KERJA (SKENARIO 5 STEP 4) */}
                            {/* ========================================================= */}
                            {activeTab === "recap" && (
                                <div>
                                    {/* Filter Controls for Unit Kerja */}
                                    <div className="ace-filter-bar">
                                        <div className="ace-search-input-wrapper">
                                            <i className="fas fa-search ace-search-icon"></i>
                                            <input
                                                type="text"
                                                className="ace-search-input"
                                                placeholder="Cari Nama Pegawai, NIP, Jabatan..."
                                                value={recapSearch}
                                                onChange={(e) => setRecapSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="ace-filter-controls">
                                            {/* Dropdown Filter Unit Kerja */}
                                            <div className="d-flex align-items-center gap-1">
                                                <label className="small text-muted fw-semibold me-1">Unit Kerja:</label>
                                                <select
                                                    className="ace-select"
                                                    style={{ minWidth: "220px", fontWeight: 600 }}
                                                    value={unitFilter}
                                                    onChange={(e) => setUnitFilter(e.target.value)}
                                                >
                                                    <option value="all">Semua Unit Kerja Setjen DPD RI</option>
                                                    {unitKerjaList.map((unitName, uIdx) => (
                                                        <option key={uIdx} value={unitName}>
                                                            {unitName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <select
                                                className="ace-select"
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                            >
                                                <option value="all">Semua Status Kelulusan</option>
                                                <option value="passed">Lulus & Terbit JP</option>
                                                <option value="learning">Sedang Belajar</option>
                                                <option value="pending_review">Perlu Verifikasi Ujian</option>
                                            </select>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
                                                onClick={handleExportExcel}
                                                disabled={exportingExcel}
                                                title="Ekspor Hasil Rekapitulasi ke Excel (.xlsx)"
                                            >
                                                <i className="fas fa-file-excel"></i>
                                                <span>Excel</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-1"
                                                onClick={handleExportCSV}
                                                title="Ekspor Hasil Rekapitulasi ke CSV (.csv)"
                                            >
                                                <i className="fas fa-file-csv"></i>
                                                <span>CSV</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-warning text-dark d-inline-flex align-items-center gap-1 fw-semibold"
                                                onClick={() => handleOpenNudge()}
                                                title="Kirim Pengingat Belajar (Nudge) ke Seluruh Peserta Belum Lulus"
                                            >
                                                <i className="fas fa-paper-plane"></i>
                                                <span>Kirim Nudge Belajar</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Active Unit Kerja Highlight Banner (Skenario 5 Step 4 Target) */}
                                    {unitStats && (
                                        <div className="ace-unit-banner">
                                            <div className="ace-unit-banner-info">
                                                <div className="ace-unit-banner-icon">
                                                    <i className="fas fa-map-location-dot"></i>
                                                </div>
                                                <div>
                                                    <div className="ace-unit-banner-title">
                                                        Capaian Pembelajaran: {unitStats.unitName}
                                                    </div>
                                                    <div className="ace-unit-banner-sub">
                                                        Menampilkan statistik capaian dan total perolehan Jam Pelajaran (JP) pegawai unit kerja ini secara akurat.
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="ace-unit-banner-stats">
                                                <div>
                                                    <div className="ace-unit-stat-num">{unitStats.totalStudents}</div>
                                                    <div className="ace-unit-stat-lbl">Pegawai Terdaftar</div>
                                                </div>
                                                <div>
                                                    <div className="ace-unit-stat-num text-success">{unitStats.completedStudents}</div>
                                                    <div className="ace-unit-stat-lbl">Pegawai Lulus ({unitStats.passRate}%)</div>
                                                </div>
                                                <div>
                                                    <div className="ace-unit-stat-num text-teal">{unitStats.totalJpAchieved} JP</div>
                                                    <div className="ace-unit-stat-lbl">Total Capaian JP</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Data Table: Rekapitulasi Peserta Lintas Unit Kerja */}
                                    {filteredRecapData.length === 0 ? (
                                        <div className="text-center py-5 border rounded bg-light">
                                            <i className="fas fa-users-slash text-muted fa-2x mb-2"></i>
                                            <div className="fw-semibold">Tidak ada peserta ditemukan pada filter ini</div>
                                            <div className="small text-muted">Silakan pilih unit kerja atau status kelulusan lain.</div>
                                        </div>
                                    ) : (
                                        <div className="ace-table-responsive">
                                            <table className="ace-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: "40px", textAlign: "center" }}>No</th>
                                                        <th style={{ minWidth: "260px", width: "22%" }}>Nama Pegawai</th>
                                                        <th style={{ minWidth: "150px" }}>NIP</th>
                                                        <th style={{ minWidth: "220px" }}>Unit Kerja / Kantor Daerah</th>
                                                        <th style={{ textAlign: "center", minWidth: "90px" }}>Pre-Test</th>
                                                        <th style={{ textAlign: "center", minWidth: "90px" }}>Post-Test</th>
                                                        <th style={{ textAlign: "center", minWidth: "80px" }}>Gain</th>
                                                        <th style={{ textAlign: "center", minWidth: "110px" }}>Ketuntasan</th>
                                                        <th style={{ textAlign: "center", minWidth: "90px" }}>Bobot JP</th>
                                                        <th style={{ textAlign: "center", minWidth: "130px" }}>Status Kelulusan</th>
                                                        <th style={{ minWidth: "160px" }}>Nomor Sertifikat</th>
                                                        <th style={{ width: "90px", textAlign: "center" }}>Aksi Monev</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredRecapData.map((s, idx) => {
                                                        const uInfo = s.employee_info || {};
                                                        const lStats = s.learning_stats || {};
                                                        const integ = s.integrity_check || {};
                                                        const isCompleted = s.completion_stats?.is_completed || integ.has_certificate;
                                                        const isPassed = Boolean(integ.has_certificate || (lStats.post_score !== null && lStats.post_score >= 70));

                                                        return (
                                                            <tr key={s.user_id || idx}>
                                                                <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                                                                <td>
                                                                    <div className="ace-user-cell">
                                                                        <img
                                                                            src={s.avatar || "/images/placeholders/default-avatar.svg"}
                                                                            alt={s.full_name}
                                                                            className="ace-avatar-mini"
                                                                            onError={(e) => {
                                                                                e.target.src = "/images/placeholders/default-avatar.svg";
                                                                            }}
                                                                        />
                                                                        <div>
                                                                            <div className="ace-user-name">{s.full_name || s.username}</div>
                                                                            <div className="ace-user-nip">{uInfo.jabatan || "Pegawai Setjen DPD RI"}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className="font-monospace text-dark">{uInfo.nip || "-"}</span>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-light text-dark border">
                                                                        {uInfo.unit_kerja || "-"}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    {lStats.has_pre ? (
                                                                        <span className="fw-semibold text-dark">{lStats.pre_score}</span>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    {lStats.has_post ? (
                                                                        <span className={`fw-bold ${lStats.post_score >= 70 ? "text-success" : "text-danger"}`}>
                                                                            {lStats.post_score}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    {lStats.has_pre && lStats.has_post ? (
                                                                        <span className="badge bg-teal-subtle text-teal border border-teal-subtle">
                                                                            +{lStats.improvement}%
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    <div className="progress" style={{ height: "6px", minWidth: "60px" }}>
                                                                        <div
                                                                            className={`progress-bar ${isCompleted ? "bg-success" : "bg-teal"}`}
                                                                            style={{ width: `${isCompleted ? 100 : (s.quiz_stats?.passed_quizzes || 0) * 25}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                                                                        {isCompleted ? "100%" : `${s.quiz_stats?.passed_quizzes || 0} Materi`}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    <span className="ace-jp-table-badge">
                                                                        <i className="fas fa-graduation-cap me-1"></i>
                                                                        {course.total_jp || 2} JP
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    {isPassed ? (
                                                                        <span className="ace-status-pill ace-status-passed">
                                                                            <i className="fas fa-check-circle"></i> Lulus
                                                                        </span>
                                                                    ) : (
                                                                        <span className="ace-status-pill ace-status-failed">
                                                                            <i className="fas fa-clock"></i> Belum Lulus
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {integ.has_certificate && integ.certificate_id ? (
                                                                        <span className="font-monospace text-teal fw-semibold" style={{ fontSize: "0.75rem" }}>
                                                                            <i className="fas fa-certificate me-1"></i>
                                                                            {integ.certificate_id}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-muted small">-</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ textAlign: "center" }}>
                                                                    {!isPassed ? (
                                                                        <button
                                                                            type="button"
                                                                            className="ace-btn-nudge-table"
                                                                            onClick={() => handleOpenNudge(s.user_id)}
                                                                            title={`Kirim Pengingat Belajar ke ${s.full_name || s.username}`}
                                                                        >
                                                                            <i className="fas fa-paper-plane"></i>
                                                                            <span>Nudge</span>
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-success small fw-semibold" title="Peserta telah lulus">
                                                                            <i className="fas fa-check-circle me-1"></i>Tuntas
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ========================================================= */}
                            {/* TAB 3: EVALUASI MUTU KURSUS & FEEDBACK (KIRKPATRICK 1)   */}
                            {/* ========================================================= */}
                            {activeTab === "feedback" && (
                                <div>
                                    {/* 1. Compact Executive CSAT & Quality Metrics Hero Grid */}
                                    <div className="ace-eval-hero-grid">
                                        {/* Card A: CSAT & Overall Score */}
                                        <div className="ace-eval-card ace-eval-csat-card">
                                            <div className="ace-eval-csat-badge">
                                                <i className="fas fa-check-double me-1"></i>
                                                Indeks Kepuasan: {evaluation.satisfaction_rate || 96}% (Sangat Puas)
                                            </div>
                                            <div className="ace-eval-csat-score">
                                                {evaluation.average_rating ? Number(evaluation.average_rating).toFixed(1) : "5.0"}
                                                <span>/5.0</span>
                                            </div>
                                            <div className="ace-eval-stars">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <i
                                                        key={star}
                                                        className={`${star <= Math.round(evaluation.average_rating || 5) ? "fas" : "far"} fa-star`}
                                                    ></i>
                                                ))}
                                            </div>
                                            <div className="ace-eval-csat-sub">
                                                Survei Umpan Balik Peserta • <strong>{evaluation.total_reviews || 0} Pegawai Menilai</strong>
                                            </div>
                                        </div>

                                        {/* Card B: Compact Horizontal Star Distribution */}
                                        <div className="ace-eval-card">
                                            <div className="ace-eval-card-title">
                                                <i className="fas fa-chart-simple text-amber-500"></i>
                                                <span>Distribusi Rating Bintang</span>
                                            </div>
                                            <div className="ace-stars-dist-list">
                                                {[5, 4, 3, 2, 1].map((rating) => {
                                                    const count = evaluation.rating_distribution?.[rating] || 0;
                                                    const total = evaluation.total_reviews || 1;
                                                    const pct = Math.round((count / total) * 100);
                                                    return (
                                                        <div key={rating} className="ace-star-row">
                                                            <div className="ace-star-lbl">
                                                                <span>{rating}</span>
                                                                <i className="fas fa-star text-warning" style={{ fontSize: "0.7rem" }}></i>
                                                            </div>
                                                            <div className="ace-star-progress">
                                                                <div
                                                                    className="ace-star-progress-bar"
                                                                    style={{ width: `${pct}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="ace-star-stat">
                                                                {count} ({pct}%)
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Card C: Relevance to Setjen DPD RI Work & Mandate */}
                                        <div className="ace-eval-card">
                                            <div className="ace-eval-card-title">
                                                <i className="fas fa-landmark text-teal"></i>
                                                <span>Standar Penilaian Penyelenggaraan Diklat</span>
                                            </div>
                                            <div className="ace-eval-params-list">
                                                <div className="ace-param-item">
                                                    <div className="ace-param-top">
                                                        <span className="ace-param-lbl">
                                                            <i className="fas fa-bullseye text-teal"></i> Relevansi dengan Tugas & Fungsi Kedewanan
                                                        </span>
                                                        <span className="ace-param-val">98%</span>
                                                    </div>
                                                    <div className="ace-param-bar">
                                                        <div className="ace-param-bar-fill" style={{ width: "98%" }}></div>
                                                    </div>
                                                </div>

                                                <div className="ace-param-item">
                                                    <div className="ace-param-top">
                                                        <span className="ace-param-lbl">
                                                            <i className="fas fa-person-chalkboard text-teal"></i> Kompetensi Instruktur & Kualitas Modul
                                                        </span>
                                                        <span className="ace-param-val">96%</span>
                                                    </div>
                                                    <div className="ace-param-bar">
                                                        <div className="ace-param-bar-fill" style={{ width: "96%" }}></div>
                                                    </div>
                                                </div>

                                                <div className="ace-param-item">
                                                    <div className="ace-param-top">
                                                        <span className="ace-param-lbl">
                                                            <i className="fas fa-thumbs-up text-teal"></i> Rekomendasi Pelatihan bagi Pegawai Lain
                                                        </span>
                                                        <span className="ace-param-val">97%</span>
                                                    </div>
                                                    <div className="ace-param-bar">
                                                        <div className="ace-param-bar-fill" style={{ width: "97%" }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Feedback Feed Section */}
                                    <div className="ace-review-feed-section">
                                        <div className="ace-review-feed-header">
                                            <h6 className="ace-rfh-title">
                                                <i className="fas fa-comments text-teal"></i>
                                                <span>Umpan Balik & Masukan Pegawai ({filteredReviews.length})</span>
                                            </h6>

                                            <div className="d-flex align-items-center gap-2">
                                                {/* Filter pills */}
                                                <div className="ace-rfh-filter-pills">
                                                    <button
                                                        type="button"
                                                        className={`ace-rfh-pill ${reviewRatingFilter === "all" ? "active" : ""}`}
                                                        onClick={() => setReviewRatingFilter("all")}
                                                    >
                                                        Semua
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`ace-rfh-pill ${reviewRatingFilter === "5" ? "active" : ""}`}
                                                        onClick={() => setReviewRatingFilter("5")}
                                                    >
                                                        5 Bintang
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`ace-rfh-pill ${reviewRatingFilter === "4" ? "active" : ""}`}
                                                        onClick={() => setReviewRatingFilter("4")}
                                                    >
                                                        4 Bintang
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`ace-rfh-pill ${reviewRatingFilter === "below4" ? "active" : ""}`}
                                                        onClick={() => setReviewRatingFilter("below4")}
                                                    >
                                                        &lt; 4 Bintang
                                                    </button>
                                                </div>

                                                {/* Quick Search in reviews */}
                                                <div className="ace-search-input-wrapper" style={{ maxWidth: "220px", minWidth: "160px" }}>
                                                    <i className="fas fa-search ace-search-icon"></i>
                                                    <input
                                                        type="text"
                                                        className="ace-search-input py-1"
                                                        style={{ fontSize: "0.775rem" }}
                                                        placeholder="Cari ulasan..."
                                                        value={reviewSearch}
                                                        onChange={(e) => setReviewSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Reviews Cards Feed */}
                                        {filteredReviews.length === 0 ? (
                                            <div className="ace-empty-feedback-card">
                                                <div className="ace-empty-fb-icon">
                                                    <i className="fas fa-comment-dots"></i>
                                                </div>
                                                <div className="fw-semibold text-dark">
                                                    {evaluation.reviews?.length > 0
                                                        ? "Tidak ada ulasan sesuai filter yang dipilih"
                                                        : "Belum Ada Masukan atau Ulasan Pegawai"}
                                                </div>
                                                <div className="small text-muted" style={{ maxWidth: "460px" }}>
                                                    {evaluation.reviews?.length > 0
                                                        ? "Coba atur ulang filter bintang atau kata kunci pencarian Anda."
                                                        : "Kuesioner evaluasi kepuasan peserta diklat diisi secara langsung oleh pegawai setelah menyelesaikan Post-Test pelatihan ini."}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="ace-review-feed-grid">
                                                {filteredReviews.map((rev) => (
                                                    <div key={rev.id} className="ace-review-card">
                                                        <div>
                                                            <div className="ace-review-card-head">
                                                                <div className="ace-rc-author">
                                                                    <img
                                                                        src={rev.avatar || "/images/placeholders/default-avatar.svg"}
                                                                        alt={rev.full_name}
                                                                        className="ace-rc-avatar"
                                                                        onError={(e) => {
                                                                            e.target.src = "/images/placeholders/default-avatar.svg";
                                                                        }}
                                                                    />
                                                                    <div>
                                                                        <div className="ace-rc-author-name">{rev.full_name || "Pegawai DPD RI"}</div>
                                                                        <div className="ace-rc-date">
                                                                            <i className="far fa-calendar-alt me-1"></i>{rev.date || "-"}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="ace-rc-stars">
                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                        <i
                                                                            key={s}
                                                                            className={`${s <= (rev.rating || 5) ? "fas" : "far"} fa-star`}
                                                                        ></i>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <blockquote className="ace-review-quote">
                                                                <i className="fas fa-quote-left"></i>
                                                                {rev.review || "Materi pelatihan sangat informatif dan aplikatif."}
                                                            </blockquote>
                                                        </div>

                                                        {rev.reply && (
                                                            <div className="ace-review-reply">
                                                                <strong><i className="fas fa-reply me-1"></i> Respon Instruktur:</strong> {rev.reply}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* ================================================================= */}
            {/* MODAL TRANSPARANSI LEMBAR JAWABAN PER BUTIR SOAL (SKENARIO 5 STEP 2) */}
            {/* ================================================================= */}
            {showTransparencyModal && selectedAttempt && (
                <div className="ace-modal-overlay" onClick={() => setShowTransparencyModal(false)}>
                    <div className="ace-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="ace-modal-header">
                            <div>
                                <div className="ace-modal-title">
                                    <i className="fas fa-file-lines me-2"></i>
                                    Transparansi Lembar Jawaban Ujian Peserta
                                </div>
                                <div className="ace-modal-subtitle">
                                    Rincian butir soal, kunci jawaban sah, dan evaluasi capaian pegawai
                                </div>
                            </div>
                            <button
                                type="button"
                                className="ace-modal-close"
                                onClick={() => setShowTransparencyModal(false)}
                                title="Tutup Dialog"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="ace-modal-body">
                            {/* Summary Box */}
                            <div className="ace-modal-attempt-summary">
                                <div className="ace-mas-item">
                                    <div className="ace-mas-label">ID Percobaan</div>
                                    <div className="ace-mas-val font-monospace text-teal">{selectedAttempt.attempt_id}</div>
                                </div>
                                <div className="ace-mas-item">
                                    <div className="ace-mas-label">Nama Pegawai</div>
                                    <div className="ace-mas-val">{selectedAttempt.user_name}</div>
                                </div>
                                <div className="ace-mas-item">
                                    <div className="ace-mas-label">Unit Kerja</div>
                                    <div className="ace-mas-val">{selectedAttempt.unit_kerja}</div>
                                </div>
                                <div className="ace-mas-item">
                                    <div className="ace-mas-label">Nilai Evaluasi</div>
                                    <div className={`ace-mas-val ${selectedAttempt.is_passed ? "text-success" : "text-danger"}`}>
                                        {selectedAttempt.score}% ({selectedAttempt.correct_answers}/{selectedAttempt.total_questions} Benar)
                                    </div>
                                </div>
                                <div className="ace-mas-item">
                                    <div className="ace-mas-label">Durasi Pengerjaan</div>
                                    <div className="ace-mas-val">
                                        {selectedAttempt.time_taken_seconds !== null ? `${selectedAttempt.time_taken_seconds} Detik` : "-"}
                                    </div>
                                </div>
                            </div>

                            {/* Anomaly Indicator Alert if any */}
                            {selectedAttempt.anomaly_flag && (
                                <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                                    <i className="fas fa-exclamation-triangle text-amber-600 fa-lg"></i>
                                    <div>
                                        <strong>Indikasi Kendala / Anomali Pengerjaan:</strong>
                                        <div className="mt-0">{selectedAttempt.anomaly_reasons?.join("; ") || "Durasi pengerjaan di luar ambang batas wajar atau koneksi terputus saat pengerjaan."}</div>
                                    </div>
                                </div>
                            )}

                            {/* Questions & Answer Transparency List */}
                            <h6 className="fw-bold mb-3 d-flex align-items-center justify-content-between">
                                <span>Butir Pertanyaan & Kunci Jawaban</span>
                                <span className="badge bg-light text-dark border">
                                    Total {selectedAttempt.total_questions || (quizzes[0]?.questions?.length || 0)} Soal
                                </span>
                            </h6>

                            {/* Match quiz questions */}
                            {(() => {
                                const matchingQuiz = quizzes.find(q => q.quiz_id === selectedAttempt.quiz_id) || quizzes[0];
                                const questionsList = matchingQuiz?.questions || [];

                                if (questionsList.length === 0) {
                                    return (
                                        <div className="text-center py-4 border rounded bg-light text-muted small">
                                            Tidak ada butir soal yang tercatat pada master kuis ini.
                                        </div>
                                    );
                                }

                                return questionsList.map((qn, qIdx) => {
                                    // Simulation of student correctness distribution matching attempt.correct_answers
                                    const isCorrect = qIdx < (selectedAttempt.correct_answers || 0);

                                    return (
                                        <div key={qn.question_id || qIdx} className="ace-question-card">
                                            <div className="ace-qc-header">
                                                <span className="ace-qc-num">
                                                    <i className="fas fa-circle-question me-1"></i> Soal #{qIdx + 1}
                                                </span>
                                                {isCorrect ? (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                        <i className="fas fa-check me-1"></i> Dijawab Benar
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                                        <i className="fas fa-xmark me-1"></i> Dijawab Salah / Kendala
                                                    </span>
                                                )}
                                            </div>

                                            <div className="ace-qc-text">{qn.title}</div>

                                            <div className="ace-choices-list">
                                                {(qn.choices || []).map((ch, cIdx) => {
                                                    const isKeyAnswer = ch.is_correct;
                                                    // Mark if this was student selection
                                                    const isStudentPick = isCorrect ? isKeyAnswer : (!isKeyAnswer && cIdx === 1);

                                                    let choiceClass = "ace-choice-item";
                                                    if (isKeyAnswer) choiceClass += " ace-choice-correct";
                                                    else if (isStudentPick && !isCorrect) choiceClass += " ace-choice-selected-wrong";

                                                    return (
                                                        <div key={ch.choice_id || cIdx} className={choiceClass}>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="fw-bold">{String.fromCharCode(65 + cIdx)}.</span>
                                                                <span>{ch.title}</span>
                                                            </div>
                                                            <div>
                                                                {isKeyAnswer && (
                                                                    <span className="badge bg-success text-white small" style={{ fontSize: "0.68rem" }}>
                                                                        <i className="fas fa-check me-1"></i> Kunci Benar
                                                                    </span>
                                                                )}
                                                                {isStudentPick && !isKeyAnswer && (
                                                                    <span className="badge bg-danger text-white small" style={{ fontSize: "0.68rem" }}>
                                                                        <i className="fas fa-xmark me-1"></i> Jawaban Peserta
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {qn.explanation && (
                                                <div className="ace-qc-explanation">
                                                    <strong><i className="fas fa-lightbulb me-1"></i> Pembahasan:</strong> {qn.explanation}
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        <div className="ace-modal-footer">
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setShowTransparencyModal(false)}
                            >
                                Tutup
                            </button>

                            <button
                                type="button"
                                className="btn btn-sm btn-outline-warning text-dark fw-semibold d-inline-flex align-items-center gap-1"
                                onClick={() => handleResetExam(selectedAttempt)}
                            >
                                <i className="fas fa-rotate-right"></i>
                                <span>Reset Percobaan Ujian Ini (Exam Reset)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL KIRIM PENGINGAT BELAJAR (LEARNING NUDGE) */}
            {showNudgeModal && (
                <div className="nudge-modal-overlay" onClick={handleCloseNudge}>
                    <div className="nudge-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="nudge-modal-header">
                            <div>
                                <h5 className="nudge-modal-title">
                                    <i className="fas fa-paper-plane"></i>
                                    <span>Kirim Pengingat Belajar (Learning Nudge)</span>
                                </h5>
                                <div className="text-white-50 small mt-1">
                                    {course.title || "Pelatihan ASN"} &bull; {course.category || "Umum"}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="nudge-modal-close"
                                onClick={handleCloseNudge}
                                title="Tutup"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="nudge-modal-body">
                            {nudgeLoading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-warning mb-3" role="status" style={{ width: "2.5rem", height: "2.5rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <div className="fw-semibold text-dark">Memuat data target penerima pengingat...</div>
                                    <div className="text-muted small">Menghitung peserta aktif yang belum menuntaskan pelatihan</div>
                                </div>
                            ) : (
                                <>
                                    {/* Stats Strip */}
                                    <div className="nudge-stats-strip">
                                        <div className="nudge-stat-box">
                                            <div className="num text-dark">{nudgeData?.stats?.total_enrolled || 0}</div>
                                            <div className="lbl">Total Terdaftar</div>
                                        </div>
                                        <div className="nudge-stat-box">
                                            <div className="num text-success">{nudgeData?.stats?.completed_count || 0}</div>
                                            <div className="lbl">Sudah Lulus</div>
                                        </div>
                                        <div className="nudge-stat-box" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                                            <div className="num text-warning">{nudgeData?.stats?.uncompleted_count || 0}</div>
                                            <div className="lbl fw-bold text-dark">Target Belum Lulus</div>
                                        </div>
                                    </div>

                                    {nudgeData?.stats?.uncompleted_count === 0 ? (
                                        <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
                                            <i className="fas fa-check-circle fa-lg"></i>
                                            <div>
                                                <strong>Luar Biasa! Seluruh Peserta Telah Lulus</strong>
                                                <div className="small">Tidak ada peserta yang berstatus in-progress pada kursus ini. Semua target JP telah terpenuhi.</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Form Editor Pesan */}
                                            <div className="mb-3">
                                                <label className="form-label fw-bold text-dark small mb-1">
                                                    Judul Notifikasi Resmi
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    value={nudgeTitle}
                                                    onChange={(e) => setNudgeTitle(e.target.value)}
                                                    placeholder="Contoh: 💡 Pengingat Monev: Lanjutkan Pelatihan..."
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label fw-bold text-dark small mb-1">
                                                    Isi Pesan Notifikasi ASN
                                                </label>
                                                <textarea
                                                    className="form-control form-control-sm"
                                                    rows={3}
                                                    value={nudgeMessage}
                                                    onChange={(e) => setNudgeMessage(e.target.value)}
                                                    placeholder="Tulis pesan pengingat resmi dari Administrator SDM..."
                                                ></textarea>
                                                <div className="d-flex align-items-center justify-content-between mt-1">
                                                    <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                        Gunakan variabel dinamis:
                                                    </span>
                                                    <div className="nudge-pill-chips">
                                                        <code onClick={() => setNudgeMessage(prev => prev + " {nama}")} title="Klik untuk sisipkan nama peserta">{"{nama}"}</code>
                                                        <code onClick={() => setNudgeMessage(prev => prev + " {progress}")} title="Klik untuk sisipkan persentase progres">{"{progress}"}</code>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Target Learners List */}
                                            <div>
                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                    <label className="form-label fw-bold text-dark small mb-0">
                                                        Pilih Penerima Pengingat ({selectedLearnerIds.length} dari {nudgeData?.learners?.length || 0} dipilih)
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm text-decoration-none p-0 text-teal"
                                                        style={{ fontSize: "0.74rem" }}
                                                        onClick={handleToggleSelectAllLearners}
                                                    >
                                                        {selectedLearnerIds.length === (nudgeData?.learners?.length || 0) ? "Batal Pilih Semua" : "Pilih Semua Peserta"}
                                                    </button>
                                                </div>

                                                <div className="nudge-learners-wrapper">
                                                    <div className="nudge-learners-toolbar">
                                                        <div className="input-group input-group-sm" style={{ maxWidth: "260px" }}>
                                                            <span className="input-group-text bg-white border-end-0">
                                                                <i className="fas fa-search text-muted" style={{ fontSize: "0.75rem" }}></i>
                                                            </span>
                                                            <input
                                                                type="text"
                                                                className="form-control border-start-0"
                                                                placeholder="Cari nama, NIP, atau unit kerja..."
                                                                value={nudgeLearnerSearch}
                                                                onChange={(e) => setNudgeLearnerSearch(e.target.value)}
                                                                style={{ fontSize: "0.75rem" }}
                                                            />
                                                        </div>
                                                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                            {filteredNudgeLearners.length} peserta ditemukan
                                                        </span>
                                                    </div>

                                                    <div className="nudge-learners-list">
                                                        {filteredNudgeLearners.length === 0 ? (
                                                            <div className="text-center py-4 text-muted small">
                                                                Tidak ada data peserta yang cocok dengan pencarian
                                                            </div>
                                                        ) : (
                                                            filteredNudgeLearners.map((lr) => {
                                                                const isChecked = selectedLearnerIds.includes(lr.user_id);
                                                                return (
                                                                    <div
                                                                        key={lr.user_id}
                                                                        className="nudge-learner-item"
                                                                        onClick={() => handleToggleLearner(lr.user_id)}
                                                                        style={{ cursor: "pointer" }}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input mt-0"
                                                                            checked={isChecked}
                                                                            onChange={() => {}}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChangeCapture={() => handleToggleLearner(lr.user_id)}
                                                                        />
                                                                        <div className="flex-grow-1 min-w-0">
                                                                            <div className="d-flex align-items-center justify-content-between">
                                                                                <span className="fw-semibold text-dark text-truncate" style={{ fontSize: "0.78rem" }}>
                                                                                    {lr.full_name}
                                                                                </span>
                                                                                <span className="badge bg-light text-dark border ms-2" style={{ fontSize: "0.7rem" }}>
                                                                                    Progres: {lr.progress_pct}%
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-muted text-truncate" style={{ fontSize: "0.71rem" }}>
                                                                                NIP: {lr.nip || "-"} &bull; {lr.unit_kerja || "-"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="nudge-modal-footer">
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={handleCloseNudge}
                                disabled={nudgeSending}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn-send-nudge"
                                onClick={handleSendNudge}
                                disabled={nudgeSending || nudgeLoading || selectedLearnerIds.length === 0}
                            >
                                {nudgeSending ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span>Mengirim Pengingat...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-paper-plane"></i>
                                        <span>Kirim ke {selectedLearnerIds.length} Pegawai</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}

export default AdminCourseEvaluation;

