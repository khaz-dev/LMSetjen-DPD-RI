import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Swal from "sweetalert2";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../../utils/constants";
import logoSetjenDPD from "../../../assets/logo/logo-setjen-dpd.png";
import "./InstructorCourseLeaderboard.css";

function InstructorCourseLeaderboard({ courseId, courseTitle }) {
    const [leaderboardData, setLeaderboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState("overall"); // overall | gain | speed | games | integrity | evaluation
    const [verifyingUserId, setVerifyingUserId] = useState(null);
    const [downloadingExcel, setDownloadingExcel] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);

    const handleVerifyIntegrity = async (userId, action, studentName = 'Peserta') => {
        let actionTitle = 'Konfirmasi Tindakan Integritas';
        let actionHtml = '';
        let confirmBtnText = 'Ya, Lanjutkan';
        let confirmBtnColor = '#0f766e';
        let iconType = 'question';
        let iconColor = '#0f766e';

        if (action === 'approve') {
            actionTitle = `Sahkan Kelulusan ${studentName}?`;
            actionHtml = `
                <div class="text-start mt-2">
                    <p class="text-muted mb-2">Tindakan ini akan mengesahkan integritas hasil belajar & ujian peserta <strong>${studentName}</strong> serta mengizinkan penerbitan <strong>sertifikat digital</strong>.</p>
                    <div class="alert alert-info py-2 px-3 small mb-0" style="background-color: #f0fdfa; border-color: #ccfbf1; color: #0f766e;">
                        <i class="fas fa-info-circle me-1"></i> Peserta akan otomatis menerima notifikasi resmi bahwa kelulusannya telah disahkan oleh Instruktur.
                    </div>
                </div>
            `;
            confirmBtnText = '<i class="fas fa-check-circle me-1"></i> Ya, Sahkan';
            confirmBtnColor = '#0f766e';
            iconType = 'question';
            iconColor = '#0f766e';
        } else if (action === 'reject') {
            actionTitle = `Tolak Hasil Ujian ${studentName}?`;
            actionHtml = `
                <div class="text-start mt-2">
                    <p class="text-muted mb-2">Tindakan ini akan <strong>membatalkan kelulusan</strong> dan menahan sertifikat peserta karena indikasi ketidaksesuaian integritas ujian.</p>
                </div>
            `;
            confirmBtnText = '<i class="fas fa-ban me-1"></i> Ya, Tolak';
            confirmBtnColor = '#dc2626';
            iconType = 'warning';
            iconColor = '#ef4444';
        } else {
            actionTitle = `Reset Post-Test ${studentName}?`;
            actionHtml = `
                <div class="text-start mt-2">
                    <p class="text-muted mb-2">Tindakan ini akan <strong>menghapus riwayat Post-Test</strong> peserta terkait dan memberikan kesempatan untuk melakukan ujian ulang.</p>
                    <div class="alert alert-warning py-2 px-3 small mb-0">
                        <i class="fas fa-exclamation-triangle me-1"></i> Skor Post-Test sebelumnya akan direset dan peserta dapat mengerjakan kembali Post-Test.
                    </div>
                </div>
            `;
            confirmBtnText = '<i class="fas fa-redo me-1"></i> Ya, Reset Ujian';
            confirmBtnColor = '#d97706';
            iconType = 'warning';
            iconColor = '#f59e0b';
        }

        const result = await Swal.fire({
            title: actionTitle,
            html: actionHtml,
            icon: iconType,
            iconColor: iconColor,
            showCancelButton: true,
            confirmButtonText: confirmBtnText,
            cancelButtonText: '<i class="fas fa-times me-1"></i> Batal',
            confirmButtonColor: confirmBtnColor,
            cancelButtonColor: '#64748b',
            reverseButtons: true,
            focusCancel: true
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            setVerifyingUserId(userId);
            const res = await useAxios.post('teacher/verify-student-integrity/', {
                course_id: courseId,
                user_id: userId,
                action: action
            });
            if (res.data.success) {
                // Dispatch event to refresh notification bell across tabs/navbar
                window.dispatchEvent(new CustomEvent('notificationUpdated'));
                Toast().fire({
                    icon: "success",
                    title: "Status Integritas & Notifikasi Terkirim",
                    text: `${res.data.message} Notifikasi otomatis telah dikirimkan ke peserta.`
                });
                fetchLeaderboard(true);
            }
        } catch (err) {
            console.error("Error verifying integrity:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui integritas",
                text: err.response?.data?.error || "Terjadi kesalahan saat memproses permintaan."
            });
        } finally {
            setVerifyingUserId(null);
        }
    };

    const fetchLeaderboard = async (isManual = false) => {
        if (!courseId) return;

        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            const res = await useAxios.get(`student/course-leaderboard/${courseId}/`);
            setLeaderboardData(res.data);
            if (isManual) {
                Toast().fire({
                    icon: "success",
                    title: "Data analitik & peringkat berhasil diperbarui"
                });
            }
        } catch (err) {
            console.error("Error loading instructor course leaderboard:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data peringkat",
                text: "Terjadi kesalahan saat menghubungi server."
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (courseId) {
            fetchLeaderboard();
        }
    }, [courseId]);

    // Lock body & html scroll when print modal is open to ensure full overlay coverage
    useEffect(() => {
        if (showPrintModal) {
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
            document.documentElement.style.overflow = "";
        };
    }, [showPrintModal]);

    // KPI Metrics calculation
    const classAnalytics = useMemo(() => {
        if (!leaderboardData?.leaderboard) {
            return {
                totalStudents: 0,
                completedStudents: 0,
                completionRate: 0,
                avgPreScore: 0,
                avgPostScore: 0,
                avgGain: 0,
                avgQuizScore: 0,
                integrityHealth: 100,
                flaggedCount: 0
            };
        }

        const list = leaderboardData.leaderboard;
        const totalStudents = list.length;
        if (totalStudents === 0) {
            return {
                totalStudents: 0,
                completedStudents: 0,
                completionRate: 0,
                avgPreScore: 0,
                avgPostScore: 0,
                avgGain: 0,
                avgQuizScore: 0,
                integrityHealth: 100,
                flaggedCount: 0
            };
        }

        const completedStudents = list.filter(s => s.completion_stats.is_completed).length;
        const completionRate = Math.round((completedStudents / totalStudents) * 100);

        // Pre-test & Post-test averages
        const studentsWithPre = list.filter(s => s.learning_stats.has_pre && s.learning_stats.pre_score !== null);
        const avgPreScore = studentsWithPre.length > 0
            ? Math.round(studentsWithPre.reduce((acc, s) => acc + s.learning_stats.pre_score, 0) / studentsWithPre.length)
            : 0;

        const studentsWithPost = list.filter(s => s.learning_stats.has_post && s.learning_stats.post_score !== null);
        const avgPostScore = studentsWithPost.length > 0
            ? Math.round(studentsWithPost.reduce((acc, s) => acc + s.learning_stats.post_score, 0) / studentsWithPost.length)
            : 0;

        const avgGain = studentsWithPost.length > 0 ? (avgPostScore - avgPreScore) : 0;

        // Quiz score average
        const avgQuizScore = Math.round(list.reduce((acc, s) => acc + (s.quiz_stats.avg_score || 0), 0) / totalStudents);

        // Integrity stats
        const flaggedCount = list.filter(s => s.completion_stats.duration_seconds && s.completion_stats.duration_seconds < 180).length;
        const integrityHealth = totalStudents > 0 ? Math.max(0, Math.round(((totalStudents - flaggedCount) / totalStudents) * 100)) : 100;

        return {
            totalStudents,
            completedStudents,
            completionRate,
            avgPreScore,
            avgPostScore,
            avgGain,
            avgQuizScore,
            integrityHealth,
            flaggedCount
        };
    }, [leaderboardData]);

    const evaluationData = leaderboardData?.evaluation;

    // Filter & Sort student list
    const processedList = useMemo(() => {
        if (!leaderboardData?.leaderboard) return [];

        const list = [...leaderboardData.leaderboard];

        if (activeFilter === "gain") {
            // Paling berkembang (lonjakan Pre -> Post terbesar)
            return list.sort((a, b) => {
                const aG = a.learning_stats.improvement ?? -999;
                const bG = b.learning_stats.improvement ?? -999;
                return bG - aG;
            });
        }

        if (activeFilter === "speed") {
            // Tercepat tuntas
            return list.sort((a, b) => {
                const aComp = a.completion_stats.is_completed ? 0 : 1;
                const bComp = b.completion_stats.is_completed ? 0 : 1;
                if (aComp !== bComp) return aComp - bComp;
                const aDur = a.completion_stats.duration_seconds ?? 99999999;
                const bDur = b.completion_stats.duration_seconds ?? 99999999;
                return aDur - bDur;
            });
        }

        if (activeFilter === "games") {
            // Skor gamifikasi
            return list.sort((a, b) => (b.gamification_stats.points || 0) - (a.gamification_stats.points || 0));
        }

        if (activeFilter === "integrity") {
            // Urutkan yang perlu verifikasi/anomali ke atas
            return list.sort((a, b) => {
                const aFlag = (a.completion_stats.duration_seconds && a.completion_stats.duration_seconds < 180) ? 1 : 0;
                const bFlag = (b.completion_stats.duration_seconds && b.completion_stats.duration_seconds < 180) ? 1 : 0;
                return bFlag - aFlag;
            });
        }

        // Default 'overall'
        return list;
    }, [leaderboardData, activeFilter]);

    // Export to Excel (.xlsx) function via backend endpoint
    const exportExcel = async () => {
        if (!courseId) return;
        if (!leaderboardData?.leaderboard || leaderboardData.leaderboard.length === 0) {
            Toast().fire({ icon: "warning", title: "Tidak ada data peserta untuk diekspor" });
            return;
        }

        try {
            setDownloadingExcel(true);
            Toast().fire({
                icon: "info",
                title: "Menyiapkan berkas Excel...",
                timer: 2000
            });

            const response = await useAxios.get(`teacher/course/${courseId}/export-recap/`, {
                responseType: 'blob'
            });

            let filename = `Rekapitulasi_Pelatihan_${courseTitle ? courseTitle.replace(/[^a-zA-Z0-9]/g, "_") : "Kursus"}.xlsx`;
            const contentDisposition = response.headers?.['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^";]+)"?/);
                if (match && match[1]) {
                    filename = match[1];
                }
            }

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            Toast().fire({
                icon: "success",
                title: "Berkas Excel Berhasil Diunduh",
                text: filename
            });
        } catch (err) {
            console.error("Error downloading excel report, falling back to CSV:", err);
            Toast().fire({
                icon: "warning",
                title: "Mengunduh via mode cadangan (CSV)...",
                timer: 2000
            });
            exportCSV();
        } finally {
            setDownloadingExcel(false);
        }
    };

    // Export to CSV function
    const exportCSV = () => {
        if (!leaderboardData?.leaderboard || leaderboardData.leaderboard.length === 0) {
            Toast().fire({ icon: "warning", title: "Tidak ada data untuk diekspor" });
            return;
        }

        const headers = [
            "Peringkat",
            "NIP",
            "Nama Peserta",
            "Unit Kerja",
            "Total Kursus XP",
            "Pre-Test Score (%)",
            "Post-Test Score (%)",
            "Peningkatan Nilai",
            "Status Efektivitas",
            "Rata-rata Kuis (%)",
            "Kuis Lulus",
            "Gamifikasi XP",
            "Durasi Ketuntasan",
            "Status Kelulusan",
            "Status Integritas",
            "No. Sertifikat"
        ];

        const rows = leaderboardData.leaderboard.map((s, idx) => {
            const isSuspicious = s.completion_stats.duration_seconds && s.completion_stats.duration_seconds < 180;
            const emp = s.employee_info || {};
            return [
                idx + 1,
                `"${emp.nip || "-"}"`,
                `"${s.full_name}"`,
                `"${emp.unit_kerja || "-"}"`,
                s.total_points,
                s.learning_stats.pre_score !== null ? s.learning_stats.pre_score : "-",
                s.learning_stats.post_score !== null ? s.learning_stats.post_score : "-",
                `"+${s.learning_stats.improvement}"`,
                `"${s.learning_stats.status}"`,
                s.quiz_stats.avg_score,
                `"${s.quiz_stats.passed_quizzes}/${s.quiz_stats.total_quizzes}"`,
                s.gamification_stats.points,
                `"${s.completion_stats.duration_human}"`,
                s.completion_stats.is_completed ? "Tuntas" : "Sedang Belajar",
                isSuspicious ? "Perlu Verifikasi" : "Valid",
                `"${s.integrity_check?.certificate_id || "-"}"`
            ];
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Rekapitulasi_Nilai_${courseTitle ? courseTitle.replace(/[^a-zA-Z0-9]/g, "_") : "Kursus"}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-teal mb-3" role="status">
                    <span className="visually-hidden">Memuat analitik evaluasi kursus...</span>
                </div>
                <h6 className="text-muted">Menganalisis performa kelas, efektivitas belajar, dan evaluasi kepuasan peserta...</h6>
            </div>
        );
    }

    return (
        <div className="icl-container">
            {/* 1. Classroom Analytics Hero Header */}
            <div className="icl-analytics-hero">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <div>
                        <h4 className="icl-hero-title">
                            <i className="fas fa-chart-line text-warning"></i>
                            Peringkat, Efektivitas Belajar & Evaluasi Peserta Kursus
                        </h4>
                        <p className="icl-hero-desc">
                            Pantau perolehan skor peserta, evaluasi lonjakan kompetensi (Pre-Test ke Post-Test), ulasan kepuasan peserta, serta monitor keabsahan ujian melalui sistem deteksi anti-cheat.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-light border fw-semibold d-inline-flex align-items-center gap-1 py-1 px-2"
                        style={{ fontSize: "0.78rem" }}
                        onClick={() => fetchLeaderboard(true)}
                        disabled={refreshing}
                    >
                        <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
                        {refreshing ? "Memperbarui..." : "Segarkan"}
                    </button>
                </div>

                {/* KPI Metrics Strip */}
                <div className="icl-kpi-grid">
                    <div className="icl-kpi-card">
                        <div className="icl-kpi-icon icon-gold">
                            <i className="fas fa-users"></i>
                        </div>
                        <div>
                            <div className="icl-kpi-val">{classAnalytics.totalStudents}</div>
                            <div className="icl-kpi-label">Total Peserta Terdaftar</div>
                        </div>
                    </div>

                    <div className="icl-kpi-card">
                        <div className="icl-kpi-icon icon-teal">
                            <i className="fas fa-graduation-cap"></i>
                        </div>
                        <div>
                            <div className="icl-kpi-val">{classAnalytics.completionRate}%</div>
                            <div className="icl-kpi-label">Ketuntasan Kelas ({classAnalytics.completedStudents} Lulus)</div>
                        </div>
                    </div>

                    <div className="icl-kpi-card">
                        <div className="icl-kpi-icon icon-emerald">
                            <i className="fas fa-arrow-trend-up"></i>
                        </div>
                        <div>
                            <div className="icl-kpi-val">+{classAnalytics.avgGain} Poin</div>
                            <div className="icl-kpi-label">Rerata Kenaikan Pre &rarr; Post</div>
                        </div>
                    </div>

                    <div className="icl-kpi-card" onClick={() => setActiveFilter("evaluation")} style={{ cursor: "pointer" }} title="Klik untuk melihat ulasan peserta">
                        <div className="icl-kpi-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                            <i className="fas fa-star"></i>
                        </div>
                        <div>
                            <div className="icl-kpi-val">{evaluationData?.average_rating?.toFixed(1) || "0.0"} / 5.0</div>
                            <div className="icl-kpi-label">Rating Kepuasan ({evaluationData?.total_reviews || 0} Ulasan)</div>
                        </div>
                    </div>

                    <div className="icl-kpi-card">
                        <div className="icl-kpi-icon icon-shield">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <div className="icl-kpi-val">{classAnalytics.integrityHealth}%</div>
                            <div className="icl-kpi-label">Kesehatan Integritas Ujian</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Top 3 Podium Juara Kelas (Only on overall view) */}
            {activeFilter !== "evaluation" && leaderboardData?.podium && leaderboardData.podium.length > 0 && (
                <div className="icl-podium-card">
                    <div className="icl-podium-title">
                        <i className="fas fa-award text-warning"></i>
                        3 Peserta Berprestasi Tertinggi Kursus Ini
                    </div>
                    <div className="icl-podium-flex">
                        {/* Juara 2 */}
                        {leaderboardData.podium[1] && (
                            <div className="icl-podium-item rank-2">
                                <img
                                    src={leaderboardData.podium[1].avatar ? getMediaUrl(leaderboardData.podium[1].avatar) : DEFAULT_IMAGE_URL}
                                    alt={leaderboardData.podium[1].full_name}
                                    className="avatar"
                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                />
                                <div className="icl-podium-name" title={leaderboardData.podium[1].full_name}>
                                    {leaderboardData.podium[1].full_name}
                                </div>
                                <div className="icl-podium-xp">{leaderboardData.podium[1].total_points} XP</div>
                                <div className="icl-podium-bar">2</div>
                            </div>
                        )}

                        {/* Juara 1 */}
                        {leaderboardData.podium[0] && (
                            <div className="icl-podium-item rank-1">
                                <img
                                    src={leaderboardData.podium[0].avatar ? getMediaUrl(leaderboardData.podium[0].avatar) : DEFAULT_IMAGE_URL}
                                    alt={leaderboardData.podium[0].full_name}
                                    className="avatar"
                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                />
                                <div className="icl-podium-name" title={leaderboardData.podium[0].full_name}>
                                    {leaderboardData.podium[0].full_name}
                                </div>
                                <div className="icl-podium-xp">{leaderboardData.podium[0].total_points} XP</div>
                                <div className="icl-podium-bar">1</div>
                            </div>
                        )}

                        {/* Juara 3 */}
                        {leaderboardData.podium[2] && (
                            <div className="icl-podium-item rank-3">
                                <img
                                    src={leaderboardData.podium[2].avatar ? getMediaUrl(leaderboardData.podium[2].avatar) : DEFAULT_IMAGE_URL}
                                    alt={leaderboardData.podium[2].full_name}
                                    className="avatar"
                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                />
                                <div className="icl-podium-name" title={leaderboardData.podium[2].full_name}>
                                    {leaderboardData.podium[2].full_name}
                                </div>
                                <div className="icl-podium-xp">{leaderboardData.podium[2].total_points} XP</div>
                                <div className="icl-podium-bar">3</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3. Action Row: Filter & Export Button */}
            <div className="icl-action-row">
                <div className="d-flex flex-wrap gap-2 align-items-center">
                    <button
                        type="button"
                        className={`icl-nav-btn ${activeFilter === "overall" ? "active" : ""}`}
                        onClick={() => setActiveFilter("overall")}
                    >
                        <i className="fas fa-trophy me-1"></i> Semua Peserta (Total XP)
                    </button>
                    <button
                        type="button"
                        className={`icl-nav-btn ${activeFilter === "gain" ? "active" : ""}`}
                        onClick={() => setActiveFilter("gain")}
                    >
                        <i className="fas fa-chart-line me-1"></i> Paling Berkembang (Pre &rarr; Post)
                    </button>
                    <button
                        type="button"
                        className={`icl-nav-btn ${activeFilter === "evaluation" ? "active" : ""}`}
                        onClick={() => setActiveFilter("evaluation")}
                    >
                        <i className="fas fa-star me-1 text-warning"></i> Evaluasi & Ulasan Kursus ({evaluationData?.total_reviews || 0})
                    </button>
                    <button
                        type="button"
                        className={`icl-nav-btn ${activeFilter === "speed" ? "active" : ""}`}
                        onClick={() => setActiveFilter("speed")}
                    >
                        <i className="fas fa-bolt me-1"></i> Tercepat Tuntas
                    </button>
                    <button
                        type="button"
                        className={`icl-nav-btn ${activeFilter === "games" ? "active" : ""}`}
                        onClick={() => setActiveFilter("games")}
                    >
                        <i className="fas fa-gamepad me-1"></i> Gamifikasi
                    </button>
                    <button
                        type="button"
                        className={`icl-nav-btn ${activeFilter === "integrity" ? "active" : ""}`}
                        onClick={() => setActiveFilter("integrity")}
                    >
                        <i className="fas fa-shield-alt me-1 text-danger"></i> Pantauan Integritas
                    </button>
                </div>

                <div className="ms-auto d-flex align-items-center gap-2">
                    <button
                        id="btn-trigger-excel"
                        type="button"
                        className="icl-export-btn icl-btn-excel"
                        onClick={exportExcel}
                        disabled={downloadingExcel}
                        title="Unduh rekapitulasi nilai dan integritas peserta ke file Excel (.xlsx)"
                    >
                        <i className={`fas ${downloadingExcel ? "fa-spinner fa-spin" : "fa-file-excel"} me-1`}></i>
                        <span>{downloadingExcel ? "Mengunduh..." : "Ekspor Excel"}</span>
                    </button>
                    <button
                        id="btn-trigger-pdf"
                        type="button"
                        className="icl-export-btn icl-btn-pdf"
                        onClick={() => setShowPrintModal(true)}
                        title="Cetak atau simpan laporan rekapitulasi pelatihan ke format PDF"
                    >
                        <i className="fas fa-file-pdf me-1"></i>
                        <span>Cetak / PDF</span>
                    </button>
                </div>
            </div>

            {/* 4. Tab Content: Evaluation & Reviews OR Student Table */}
            {activeFilter === "evaluation" ? (
                <div className="icl-eval-section">
                    {/* Evaluasi Summary Card */}
                    <div className="icl-eval-summary-card mb-4">
                        <div className="row align-items-center g-4">
                            <div className="col-lg-4 col-md-5 text-center border-end-md">
                                <div className="icl-eval-big-score">{evaluationData?.average_rating?.toFixed(1) || "0.0"}</div>
                                <div className="icl-eval-stars mb-2">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <i
                                            key={s}
                                            className={`fas fa-star ${s <= Math.round(evaluationData?.average_rating || 0) ? "star-active" : "star-inactive"}`}
                                        ></i>
                                    ))}
                                </div>
                                <div className="icl-eval-count-text">
                                    Berdasarkan <strong>{evaluationData?.total_reviews || 0} ulasan</strong> peserta kursus
                                </div>
                                <div className="mt-2">
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill fw-semibold">
                                        <i className="fas fa-heart me-1"></i> {evaluationData?.satisfaction_rate || 0}% Peserta Sangat Puas
                                    </span>
                                </div>
                            </div>
                            <div className="col-lg-8 col-md-7">
                                <h6 className="fw-bold text-slate-800 mb-3">Distribusi Penilaian Kepuasan</h6>
                                {[5, 4, 3, 2, 1].map((stars) => {
                                    const count = evaluationData?.rating_distribution?.[stars] || 0;
                                    const total = evaluationData?.total_reviews || 1;
                                    const pct = evaluationData?.total_reviews ? Math.round((count / total) * 100) : 0;
                                    return (
                                        <div key={stars} className="d-flex align-items-center gap-2 mb-2">
                                            <span className="icl-eval-bar-label">{stars} Bintang</span>
                                            <div className="progress flex-grow-1" style={{ height: "8px", borderRadius: "4px" }}>
                                                <div
                                                    className="progress-bar"
                                                    style={{
                                                        width: `${pct}%`,
                                                        backgroundColor: stars >= 4 ? "#10b981" : stars === 3 ? "#f59e0b" : "#ef4444"
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="icl-eval-bar-count text-muted">{count} ({pct}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Reviews List */}
                    <div className="icl-reviews-card">
                        <div className="icl-reviews-header d-flex justify-content-between align-items-center mb-3">
                            <h5 className="fw-bold mb-0 text-slate-800">
                                <i className="fas fa-comments text-teal me-2"></i>
                                Evaluasi & Ulasan Nyata Peserta ({evaluationData?.reviews?.length || 0})
                            </h5>
                            <span className="text-muted small">Ulasan resmi peserta terverifikasi</span>
                        </div>

                        {!evaluationData?.reviews || evaluationData.reviews.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                <i className="fas fa-comment-dots fa-3x text-slate-300 mb-3"></i>
                                <h6>Belum Ada Ulasan Masuk</h6>
                                <p className="small mb-0">Peserta yang telah mengikuti kursus belum memberikan evaluasi bintang atau ulasan tertulis.</p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {evaluationData.reviews.map((rev) => (
                                    <div key={rev.id} className="icl-review-item">
                                        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                                            <div className="d-flex align-items-center gap-2">
                                                <img
                                                    src={rev.avatar ? getMediaUrl(rev.avatar) : DEFAULT_IMAGE_URL}
                                                    alt={rev.full_name}
                                                    className="icl-student-avatar"
                                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                                />
                                                <div>
                                                    <div className="fw-bold text-slate-800">{rev.full_name}</div>
                                                    <span className="badge bg-teal-subtle text-teal" style={{ fontSize: "10px" }}>
                                                        <i className="fas fa-check-circle me-1"></i> Peserta Terverifikasi
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <div className="icl-review-stars mb-1">
                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                        <i
                                                            key={s}
                                                            className={`fas fa-star ${s <= rev.rating ? "star-active" : "star-inactive"}`}
                                                        ></i>
                                                    ))}
                                                </div>
                                                <small className="text-muted">{rev.date}</small>
                                            </div>
                                        </div>
                                        <div className="icl-review-body mt-2">
                                            <p className="mb-0 text-slate-700 font-monospace" style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>
                                                "{rev.review}"
                                            </p>
                                        </div>
                                        {rev.reply && (
                                            <div className="icl-instructor-reply mt-2 p-2 rounded bg-light border-start border-teal border-3">
                                                <small className="fw-bold text-teal d-block mb-1">
                                                    <i className="fas fa-reply me-1"></i> Balasan Instruktur:
                                                </small>
                                                <p className="small text-muted mb-0">{rev.reply}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="icl-table-card">
                    <div className="table-responsive">
                        <table className="table align-middle">
                            <thead>
                                <tr>
                                    <th style={{ width: "50px" }} className="text-center">#</th>
                                    <th>Peserta Kursus</th>
                                    <th className="text-center">Total XP</th>
                                    <th className="text-center">Efektivitas (Pre &rarr; Post)</th>
                                    <th className="text-center">Kuis Materi</th>
                                    <th className="text-center">Gamifikasi</th>
                                    <th className="text-center">Ketuntasan Kursus</th>
                                    <th className="text-center">Status Integritas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedList.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-4 text-muted">
                                            Belum ada peserta yang terdaftar pada kursus ini.
                                        </td>
                                    </tr>
                                ) : (
                                    processedList.map((student, idx) => {
                                        const rankNum = idx + 1;
                                        const isSuspicious = student.completion_stats.duration_seconds && student.completion_stats.duration_seconds < 180;

                                        return (
                                            <tr key={student.user_id}>
                                                <td className="text-center fw-bold text-muted">
                                                    {rankNum}
                                                </td>
                                                <td>
                                                    <div className="icl-student-cell">
                                                        <img
                                                            src={student.avatar ? getMediaUrl(student.avatar) : DEFAULT_IMAGE_URL}
                                                            alt={student.full_name}
                                                            className="icl-student-avatar"
                                                            onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                                        />
                                                        <div>
                                                            <div className="fw-bold text-slate-800">
                                                                {student.full_name}
                                                            </div>
                                                            <small className="text-muted">
                                                                @{student.username} • {student.global_stats.level_name}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-teal-subtle text-teal fw-bold px-3 py-2 rounded-pill">
                                                        <i className="fas fa-bolt me-1"></i> {student.total_points} XP
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    {student.learning_stats.has_post ? (
                                                        <div>
                                                            <div className="fw-bold text-emerald">
                                                                +{student.learning_stats.improvement} Poin ({student.learning_stats.normalized_gain}% Gain)
                                                            </div>
                                                            <small className="text-muted d-block">
                                                                Pre: {student.learning_stats.pre_score}% &rarr; Post: {student.learning_stats.post_score}%
                                                            </small>
                                                            <span className="badge bg-light text-slate-700 border small mt-1">
                                                                {student.learning_stats.points} XP
                                                            </span>
                                                        </div>
                                                    ) : student.learning_stats.has_pre ? (
                                                        <div>
                                                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                                                                Pre-Test: {student.learning_stats.pre_score}%
                                                            </span>
                                                            <div className="small text-muted mt-0">Menunggu Post-test</div>
                                                            <span className="badge bg-light text-slate-700 border small mt-1">
                                                                {student.learning_stats.points} XP
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted small">Belum Pre-test (0 XP)</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <div className="fw-bold text-slate-700">
                                                        {student.quiz_stats.avg_score}%
                                                    </div>
                                                    <small className="text-muted d-block">
                                                        {student.quiz_stats.total_quizzes > 0
                                                            ? `${student.quiz_stats.passed_quizzes}/${student.quiz_stats.total_quizzes} Lulus`
                                                            : `${student.quiz_stats.points} XP (Progres)`}
                                                    </small>
                                                    {student.quiz_stats.total_quizzes > 0 && (
                                                        <span className="badge bg-light text-slate-700 border small mt-1">
                                                            {student.quiz_stats.points} XP
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <div className="fw-bold text-slate-700">
                                                        {student.gamification_stats.points} XP
                                                    </div>
                                                    <small className="text-muted">
                                                        {student.gamification_stats.total_games > 0
                                                            ? `${student.gamification_stats.completed_games}/${student.gamification_stats.total_games} Game Selesai`
                                                            : `${student.gamification_stats.avg_score}% Progres`}
                                                    </small>
                                                </td>
                                                <td className="text-center">
                                                    {student.completion_stats.is_completed ? (
                                                        <div>
                                                            <span className="badge bg-success text-white">
                                                                <i className="fas fa-check-circle me-1"></i> Tuntas
                                                            </span>
                                                            <div className="small text-muted mt-0">
                                                                {student.completion_stats.duration_human}
                                                            </div>
                                                            <span className="badge bg-light text-slate-700 border small mt-1">
                                                                {student.completion_stats.points} XP (Pace)
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="badge bg-light text-secondary border">
                                                                Sedang Belajar
                                                            </span>
                                                            <div className="small text-muted mt-1">
                                                                {student.completion_stats.points} XP
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    {student.integrity_check?.status === "pending_review" ? (
                                                        <div className="d-flex flex-column align-items-center gap-1">
                                                            <span
                                                                className="integrity-badge-warning"
                                                                title={student.integrity_check?.reasons?.join("; ") || "Perlu verifikasi instruktur"}
                                                            >
                                                                <i className="fas fa-triangle-exclamation"></i>
                                                                <span>Perlu Verifikasi</span>
                                                            </span>
                                                            <div className="d-flex align-items-center gap-1 mt-1">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-success py-0 px-2 fw-semibold"
                                                                    style={{ fontSize: "10px", borderRadius: "5px" }}
                                                                    title="Sahkan hasil ujian & izinkan penerbitan sertifikat"
                                                                    onClick={() => handleVerifyIntegrity(student.user_id, 'approve', student.full_name)}
                                                                    disabled={verifyingUserId === student.user_id}
                                                                >
                                                                    <i className="fas fa-check me-1"></i>Sahkan
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-warning py-0 px-2 fw-semibold text-dark"
                                                                    style={{ fontSize: "10px", borderRadius: "5px" }}
                                                                    title="Reset Post-Test peserta untuk ujian ulang"
                                                                    onClick={() => handleVerifyIntegrity(student.user_id, 'reset_post_test', student.full_name)}
                                                                    disabled={verifyingUserId === student.user_id}
                                                                >
                                                                    <i className="fas fa-rotate-right me-1"></i>Reset
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : student.integrity_check?.is_manual_approved ? (
                                                        <div className="d-flex flex-column align-items-center">
                                                            <span className="integrity-badge-valid" title="Disahkan manual oleh Instruktur">
                                                                <i className="fas fa-user-check text-teal"></i>
                                                                <span>Disahkan Instruktur</span>
                                                            </span>
                                                            {student.integrity_check?.has_certificate && (
                                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle mt-1" style={{ fontSize: "10px" }}>
                                                                    <i className="fas fa-award me-1"></i>Sertifikat Terbit
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : student.integrity_check?.status === "rejected" ? (
                                                        <div className="d-flex flex-column align-items-center gap-1">
                                                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1" style={{ fontSize: "11px" }}>
                                                                <i className="fas fa-ban me-1"></i>Tidak Sah
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-xs btn-outline-warning py-0 px-2 mt-0"
                                                                style={{ fontSize: "10px", borderRadius: "4px" }}
                                                                onClick={() => handleVerifyIntegrity(student.user_id, 'reset_post_test', student.full_name)}
                                                                disabled={verifyingUserId === student.user_id}
                                                                title="Beri kesempatan ujian ulang"
                                                            >
                                                                <i className="fas fa-rotate-right me-1"></i>Beri Ulang
                                                            </button>
                                                        </div>
                                                    ) : isSuspicious ? (
                                                        <div className="d-flex flex-column align-items-center gap-1">
                                                            <span
                                                                className="integrity-badge-warning"
                                                                title="Waktu ketuntasan berada di bawah batas kewajaran manusia (< 3 menit)"
                                                            >
                                                                <i className="fas fa-triangle-exclamation"></i>
                                                                <span>Pace Anomali</span>
                                                            </span>
                                                            <div className="d-flex align-items-center gap-1 mt-1">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-success py-0 px-2 fw-semibold"
                                                                    style={{ fontSize: "10px", borderRadius: "5px" }}
                                                                    title="Sahkan hasil ujian & izinkan penerbitan sertifikat"
                                                                    onClick={() => handleVerifyIntegrity(student.user_id, 'approve', student.full_name)}
                                                                    disabled={verifyingUserId === student.user_id}
                                                                >
                                                                    <i className="fas fa-check me-1"></i>Sahkan
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex flex-column align-items-center">
                                                            <span className="integrity-badge-valid">
                                                                <i className="fas fa-circle-check"></i>
                                                                <span>Valid</span>
                                                            </span>
                                                            {student.integrity_check?.has_certificate && (
                                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle mt-1" style={{ fontSize: "10px" }}>
                                                                    <i className="fas fa-award me-1"></i>Sertifikat Terbit
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 5. Formal Print & PDF Export Modal (Rendered at Root Body via Portal) */}
            {showPrintModal && typeof document !== "undefined" && createPortal(
                <div className="icl-print-modal-overlay" onClick={(e) => {
                    if (e.target.classList.contains("icl-print-modal-overlay")) {
                        setShowPrintModal(false);
                    }
                }}>
                    <div className="icl-print-modal-container">
                        {/* Top Bar / Header */}
                        <div className="icl-print-modal-header no-print">
                            <div className="d-flex align-items-center gap-2.5">
                                <div className="icl-modal-badge-icon">
                                    <i className="fas fa-file-invoice text-teal"></i>
                                </div>
                                <div>
                                    <div className="d-flex align-items-center gap-2">
                                        <h6 className="mb-0 fw-bold text-dark">Pratinjau Dokumen Rekapitulasi Pelatihan</h6>
                                        <span className="badge bg-teal-subtle text-teal border border-teal-subtle px-2 py-0.5" style={{ fontSize: "11px" }}>
                                            <i className="fas fa-file-pdf me-1"></i>A4 Landscape (297 x 210 mm)
                                        </span>
                                    </div>
                                    <span className="small text-muted">Format Standar Resmi Kedinasan Sekretariat Jenderal DPD RI</span>
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success d-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold"
                                    onClick={exportExcel}
                                    disabled={downloadingExcel}
                                    title="Unduh versi spreadsheet Excel (.xlsx)"
                                >
                                    <i className={`fas ${downloadingExcel ? "fa-spinner fa-spin" : "fa-file-excel"}`}></i>
                                    <span>Unduh Excel</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-teal d-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold text-white shadow-sm"
                                    style={{ background: "#0f766e", borderColor: "#0d5f58", borderRadius: "6px" }}
                                    onClick={() => window.print()}
                                    title="Buka dialog cetak browser (Simpan sebagai PDF)"
                                >
                                    <i className="fas fa-print"></i>
                                    <span>Cetak / Simpan PDF</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary px-2.5 py-1.5"
                                    onClick={() => setShowPrintModal(false)}
                                    title="Tutup dialog pratinjau"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        <div className="icl-print-modal-body">
                            {/* Document Container that will be printed */}
                            <div id="printable-recap-document" className="printable-recap-sheet">
                                {/* Kop Surat Resmi */}
                                <div className="kop-surat-wrapper">
                                    <img
                                        src={logoSetjenDPD}
                                        alt="Logo Setjen DPD RI"
                                        className="kop-logo"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <div className="kop-text-block">
                                        <div className="kop-title-main">SEKRETARIAT JENDERAL DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA</div>
                                        <div className="kop-title-dept">BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN</div>
                                        <div className="kop-address">
                                            Kompleks Parlemen, Jalan Jenderal Gatot Subroto No. 6, Senayan, Jakarta Pusat 10270<br />
                                            Laman: https://lms.dpd.go.id | Pos-el: sdm@dpd.go.id | Telepon: (021) 57897475
                                        </div>
                                    </div>
                                </div>

                                {/* Title & Document Number */}
                                <div className="doc-heading-wrapper">
                                    <div className="doc-report-title">
                                        LAPORAN REKAPITULASI PELATIHAN DAN KEHADIRAN PESERTA
                                    </div>
                                    <div className="doc-report-sub">
                                        Nomor: LAP-LMS/{courseId}/2026 &bull; Dokumen Resmi Penyelenggaraan Pelatihan Pegawai Setjen DPD RI
                                    </div>
                                </div>

                                {/* Compact 3-Column Info Strip */}
                                <div className="doc-info-strip">
                                    <div className="doc-info-col">
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Nama Pelatihan</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val fw-bold text-dark">{courseTitle || leaderboardData?.course?.title || "-"}</span>
                                        </div>
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Kategori / Tingkat</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val">{leaderboardData?.course?.category || "Kompetensi ASN"} ({leaderboardData?.course?.level || "Semua Tingkat"})</span>
                                        </div>
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Beban Belajar</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val badge-jp">{leaderboardData?.course?.total_jp || 2} Jam Pelajaran (JP)</span>
                                        </div>
                                    </div>

                                    <div className="doc-info-col">
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Instruktur</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val">{leaderboardData?.course?.teacher_name || "Instruktur Internal DPD RI"}</span>
                                        </div>
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Penyelenggara</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val">Bagian Sumber Daya Manusia</span>
                                        </div>
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Waktu Unduh</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</span>
                                        </div>
                                    </div>

                                    <div className="doc-info-col">
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Total Peserta</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val fw-bold">{classAnalytics.totalStudents} Pegawai ({classAnalytics.completedStudents} Tuntas - {classAnalytics.completionRate}%)</span>
                                        </div>
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Rata-rata Skor</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val">Pre: <strong>{classAnalytics.avgPreScore}</strong> | Post: <strong>{classAnalytics.avgPostScore}</strong></span>
                                        </div>
                                        <div className="doc-info-row">
                                            <span className="doc-info-key">Efektivitas Belajar</span>
                                            <span className="doc-info-sep">:</span>
                                            <span className="doc-info-val text-teal fw-bold">Peningkatan Gain +{classAnalytics.avgGain}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabel Rekapitulasi Lengkap */}
                                <table className="doc-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "32px" }}>No</th>
                                            <th style={{ width: "45px" }}>Rank</th>
                                            <th style={{ width: "115px" }}>NIP</th>
                                            <th>Nama Lengkap Pegawai</th>
                                            <th>Unit Kerja</th>
                                            <th style={{ width: "65px" }}>Status</th>
                                            <th style={{ width: "48px" }}>Pre</th>
                                            <th style={{ width: "48px" }}>Post</th>
                                            <th style={{ width: "52px" }}>Gain</th>
                                            <th style={{ width: "60px" }}>N-Gain</th>
                                            <th style={{ width: "50px" }}>Kuis</th>
                                            <th style={{ width: "62px" }}>Total XP</th>
                                            <th style={{ width: "80px" }}>Integritas</th>
                                            <th style={{ width: "115px" }}>No. Sertifikat</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 ? (
                                            leaderboardData.leaderboard.map((s, idx) => {
                                                const emp = s.employee_info || {};
                                                const ls = s.learning_stats || {};
                                                const cs = s.completion_stats || {};
                                                const isSuspicious = cs.duration_seconds && cs.duration_seconds < 180;
                                                const integ = s.integrity_check || {};
                                                const integText = integ.is_manual_approved ? "Disahkan" : isSuspicious ? "Investigasi" : "Valid";

                                                return (
                                                    <tr key={s.user_id || idx}>
                                                        <td style={{ textAlign: "center" }}>{idx + 1}</td>
                                                        <td style={{ textAlign: "center", fontWeight: 700 }}>
                                                            {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                                                        </td>
                                                        <td style={{ textAlign: "center", fontFamily: "Consolas, monospace", fontSize: "0.72rem" }}>
                                                            {emp.nip || "-"}
                                                        </td>
                                                        <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                                                        <td style={{ fontSize: "0.73rem" }}>{emp.unit_kerja || "-"}</td>
                                                        <td style={{ textAlign: "center" }}>
                                                            <span className={`doc-status-badge ${cs.is_completed ? "status-done" : "status-active"}`}>
                                                                {cs.is_completed ? "Tuntas" : "Belajar"}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>{ls.pre_score !== null ? ls.pre_score : "-"}</td>
                                                        <td style={{ textAlign: "center", fontWeight: 700 }}>{ls.post_score !== null ? ls.post_score : "-"}</td>
                                                        <td style={{ textAlign: "center", color: ls.improvement > 0 ? "#0f766e" : "inherit", fontWeight: 600 }}>
                                                            {ls.has_pre && ls.has_post ? `+${ls.improvement}` : "-"}
                                                        </td>
                                                        <td style={{ textAlign: "center", fontWeight: 600 }}>
                                                            {ls.has_pre && ls.has_post ? `${ls.normalized_gain}%` : "-"}
                                                        </td>
                                                        <td style={{ textAlign: "center" }}>{s.quiz_stats?.avg_score ?? "-"}</td>
                                                        <td style={{ textAlign: "right", fontWeight: 700 }}>{s.total_points}</td>
                                                        <td style={{ textAlign: "center", fontSize: "0.72rem" }}>
                                                            <span className={`doc-integ-badge ${integ.is_manual_approved ? "integ-manual" : isSuspicious ? "integ-flag" : "integ-valid"}`}>
                                                                {integText}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: "center", fontSize: "0.70rem", fontFamily: "Consolas, monospace" }}>
                                                            {integ.certificate_id || "-"}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="14" style={{ textAlign: "center", padding: "1.5rem" }}>
                                                    Belum ada data peserta terdaftar pada kursus ini.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 && (
                                        <tfoot>
                                            <tr className="doc-table-summary-row">
                                                <td colSpan="6" style={{ textAlign: "center", fontWeight: 700 }}>
                                                    RATA-RATA / KETUNTASAN KELAS ({classAnalytics.totalStudents} PESERTA)
                                                </td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>{classAnalytics.avgPreScore}</td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>{classAnalytics.avgPostScore}</td>
                                                <td style={{ textAlign: "center", fontWeight: 700, color: "#0f766e" }}>+{classAnalytics.avgGain}</td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>{classAnalytics.avgGain > 0 ? `${classAnalytics.avgGain}%` : "-"}</td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>{classAnalytics.avgQuizScore}</td>
                                                <td style={{ textAlign: "right", fontWeight: 700 }}>
                                                    {Math.round(leaderboardData.leaderboard.reduce((acc, s) => acc + (s.total_points || 0), 0) / leaderboardData.leaderboard.length)}
                                                </td>
                                                <td colSpan="2" style={{ textAlign: "center", fontSize: "0.70rem", fontStyle: "italic" }}>
                                                    {classAnalytics.completionRate}% Tuntas
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>

                                {/* Kolom Tanda Tangan Formal */}
                                <div className="doc-signature-row">
                                    <div className="doc-signature-col">
                                        <div>Mengetahui,</div>
                                        <div style={{ fontWeight: 700 }}>Instruktur Pelatihan</div>
                                        <div className="doc-signature-space"></div>
                                        <div className="doc-signature-name">
                                            {leaderboardData?.course?.teacher_name || "Instruktur Pelatihan"}
                                        </div>
                                        <div className="doc-signature-role">Instruktur Setjen DPD RI</div>
                                    </div>

                                    <div className="doc-stamp-col">
                                        <div className="doc-stamp-box">
                                            <i className="fas fa-certificate text-teal"></i>
                                            <span className="doc-stamp-title">TERVERIFIKASI SISTEM</span>
                                            <span className="doc-stamp-sub">LMS SETJEN DPD RI</span>
                                        </div>
                                    </div>

                                    <div className="doc-signature-col">
                                        <div>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                        <div style={{ fontWeight: 700 }}>Bagian Pengembangan Sumber Daya Manusia</div>
                                        <div className="doc-signature-space"></div>
                                        <div className="doc-signature-name">
                                            Kepala Bagian Pengembangan SDM
                                        </div>
                                        <div className="doc-signature-role">Bagian Pengembangan Sumber Daya Manusia</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default InstructorCourseLeaderboard;
