import React, { useState, useEffect, useMemo } from "react";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../../utils/constants";
import "./InstructorCourseLeaderboard.css";

function InstructorCourseLeaderboard({ courseId, courseTitle }) {
    const [leaderboardData, setLeaderboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState("overall"); // overall | gain | speed | games | integrity | evaluation
    const [verifyingUserId, setVerifyingUserId] = useState(null);

    const handleVerifyIntegrity = async (userId, action) => {
        const actionTitle = action === 'approve'
            ? 'Sahkan Kelulusan Siswa?'
            : action === 'reject'
                ? 'Tolak Hasil Ujian Siswa?'
                : 'Reset Ujian Post-Test Siswa?';
        const actionText = action === 'approve'
            ? 'Tindakan ini akan mengesahkan integritas ujian peserta dan mengizinkan penerbitan sertifikat digital.'
            : action === 'reject'
                ? 'Tindakan ini akan membatalkan kelulusan dan menahan sertifikat peserta.'
                : 'Tindakan ini akan menghapus riwayat Post-Test peserta terkait dan memberi kesempatan ujian ulang.';

        if (!window.confirm(`${actionTitle}\n\n${actionText}`)) {
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
                    text: `${res.data.message} Notifikasi otomatis telah dikirimkan ke siswa.`
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

    // Export to CSV function
    const exportCSV = () => {
        if (!leaderboardData?.leaderboard || leaderboardData.leaderboard.length === 0) {
            Toast().fire({ icon: "warning", title: "Tidak ada data untuk diekspor" });
            return;
        }

        const headers = [
            "Peringkat",
            "Nama Peserta",
            "Username",
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
            "Status Integritas"
        ];

        const rows = leaderboardData.leaderboard.map((s, idx) => {
            const isSuspicious = s.completion_stats.duration_seconds && s.completion_stats.duration_seconds < 180;
            return [
                idx + 1,
                `"${s.full_name}"`,
                `"${s.username}"`,
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
                isSuspicious ? "Perlu Verifikasi (Kecepatan Tidak Wajar)" : "Valid / Lulus Verifikasi"
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
                            Pantau perolehan skor peserta, evaluasi lonjakan kompetensi (Pre-Test ke Post-Test), ulasan kepuasan siswa, serta monitor keabsahan ujian melalui sistem deteksi anti-cheat.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-light border fw-semibold d-inline-flex align-items-center gap-1.5 py-1 px-2.5"
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
                        3 Siswa Berprestasi Tertinggi Kursus Ini
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

                <div className="ms-auto d-flex align-items-center">
                    <button
                        type="button"
                        className="icl-export-btn"
                        onClick={exportCSV}
                        title="Unduh rekapitulasi nilai dan integritas siswa ke file CSV/Excel"
                    >
                        <i className="fas fa-file-excel"></i>
                        <span>Ekspor Rekapitulasi CSV</span>
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
                                <div className="mt-2.5">
                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1.5 rounded-pill fw-semibold">
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
                                            <div className="d-flex align-items-center gap-2.5">
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
                                        <div className="icl-review-body mt-2.5">
                                            <p className="mb-0 text-slate-700 font-monospace" style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>
                                                "{rev.review}"
                                            </p>
                                        </div>
                                        {rev.reply && (
                                            <div className="icl-instructor-reply mt-2 p-2.5 rounded bg-light border-start border-teal border-3">
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
                                                            <small className="text-muted">
                                                                Pre: {student.learning_stats.pre_score}% &rarr; Post: {student.learning_stats.post_score}%
                                                            </small>
                                                        </div>
                                                    ) : student.learning_stats.has_pre ? (
                                                        <div>
                                                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                                                                Pre-Test: {student.learning_stats.pre_score}%
                                                            </span>
                                                            <div className="small text-muted mt-0.5">Menunggu Post-test</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted small">Belum Pre-test</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <div className="fw-bold text-slate-700">
                                                        {student.quiz_stats.avg_score}%
                                                    </div>
                                                    <small className="text-muted">
                                                        {student.quiz_stats.passed_quizzes}/{student.quiz_stats.total_quizzes} Lulus
                                                    </small>
                                                </td>
                                                <td className="text-center">
                                                    <div className="fw-bold text-slate-700">
                                                        {student.gamification_stats.points} XP
                                                    </div>
                                                    <small className="text-muted">
                                                        {student.gamification_stats.completed_games}/{student.gamification_stats.total_games} Game Selesai
                                                    </small>
                                                </td>
                                                <td className="text-center">
                                                    {student.completion_stats.is_completed ? (
                                                        <div>
                                                            <span className="badge bg-success text-white">
                                                                <i className="fas fa-check-circle me-1"></i> Tuntas
                                                            </span>
                                                            <div className="small text-muted mt-0.5">
                                                                {student.completion_stats.duration_human}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="badge bg-light text-secondary border">
                                                            Sedang Belajar
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    {student.integrity_check?.status === "pending_review" ? (
                                                        <div className="d-flex flex-column align-items-center gap-1">
                                                            <span
                                                                className="integrity-badge-warning"
                                                                title={student.integrity_check?.reasons?.join("; ") || "Perlu verifikasi pengajar"}
                                                            >
                                                                <i className="fas fa-triangle-exclamation"></i>
                                                                <span>Perlu Verifikasi</span>
                                                            </span>
                                                            <div className="d-flex align-items-center gap-1 mt-1">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-success py-0.5 px-2 fw-semibold"
                                                                    style={{ fontSize: "10.5px", borderRadius: "5px" }}
                                                                    title="Sahkan hasil ujian & izinkan penerbitan sertifikat"
                                                                    onClick={() => handleVerifyIntegrity(student.user_id, 'approve')}
                                                                    disabled={verifyingUserId === student.user_id}
                                                                >
                                                                    <i className="fas fa-check me-1"></i>Sahkan
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-xs btn-outline-warning py-0.5 px-2 fw-semibold text-dark"
                                                                    style={{ fontSize: "10.5px", borderRadius: "5px" }}
                                                                    title="Reset Post-Test peserta untuk ujian ulang"
                                                                    onClick={() => handleVerifyIntegrity(student.user_id, 'reset_post_test')}
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
                                                                className="btn btn-xs btn-outline-warning py-0.5 px-2 mt-0.5"
                                                                style={{ fontSize: "10px", borderRadius: "4px" }}
                                                                onClick={() => handleVerifyIntegrity(student.user_id, 'reset_post_test')}
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
                                                                    className="btn btn-xs btn-success py-0.5 px-2 fw-semibold"
                                                                    style={{ fontSize: "10.5px", borderRadius: "5px" }}
                                                                    title="Sahkan hasil ujian & izinkan penerbitan sertifikat"
                                                                    onClick={() => handleVerifyIntegrity(student.user_id, 'approve')}
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
        </div>
    );
}

export default InstructorCourseLeaderboard;
