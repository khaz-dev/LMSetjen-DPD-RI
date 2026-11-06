import React, { useState, useEffect, useMemo } from "react";
import apiInstance from "../../utils/axios";
import Toast from "../../views/plugin/Toast";
import UserData from "../../views/plugin/UserData";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import "./LeaderboardTab.css";

function LeaderboardTab({ courseId, enrollmentId, activeTab }) {
    const [leaderboardData, setLeaderboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState("overall"); // overall | speed | gain | games

    const userData = UserData();
    const currentUserId = userData?.user_id;

    const fetchLeaderboard = async (isManualRefresh = false) => {
        if (!courseId) return;

        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const url = `student/course-leaderboard/${courseId}/?user_id=${currentUserId || ""}`;
            const res = await apiInstance.get(url);
            setLeaderboardData(res.data);
            if (isManualRefresh) {
                Toast().fire({
                    icon: "success",
                    title: "Papan peringkat berhasil diperbarui"
                });
            }
        } catch (err) {
            console.error("Error fetching course leaderboard:", err);
            // Fallback gracefully
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (courseId) {
            fetchLeaderboard();
        }
    }, [courseId, currentUserId]);

    // Refresh if tab becomes active
    useEffect(() => {
        if (activeTab === "leaderboard") {
            fetchLeaderboard();
        }
    }, [activeTab]);

    // Sorting and filtering based on category
    const processedLeaderboard = useMemo(() => {
        if (!leaderboardData?.leaderboard) return [];

        const list = [...leaderboardData.leaderboard];

        if (activeCategory === "speed") {
            // Urutkan berdasarkan yang sudah selesai tercepat (duration_seconds ascending)
            return list.sort((a, b) => {
                const aComp = a.completion_stats.is_completed ? 0 : 1;
                const bComp = b.completion_stats.is_completed ? 0 : 1;
                if (aComp !== bComp) return aComp - bComp;

                const aDur = a.completion_stats.duration_seconds ?? 99999999;
                const bDur = b.completion_stats.duration_seconds ?? 99999999;
                return aDur - bDur;
            });
        }

        if (activeCategory === "gain") {
            // Urutkan berdasarkan peningkatan nilai Pre-test ke Post-test (improvement descending)
            return list.sort((a, b) => {
                const aGain = a.learning_stats.improvement ?? -999;
                const bGain = b.learning_stats.improvement ?? -999;
                if (bGain !== aGain) return bGain - aGain;

                const aPost = a.learning_stats.post_score ?? -999;
                const bPost = b.learning_stats.post_score ?? -999;
                return bPost - aPost;
            });
        }

        if (activeCategory === "games") {
            // Urutkan berdasarkan total skor gamifikasi & kecepatan
            return list.sort((a, b) => {
                const aGamePts = a.gamification_stats.points ?? 0;
                const bGamePts = b.gamification_stats.points ?? 0;
                if (bGamePts !== aGamePts) return bGamePts - aGamePts;

                const aTime = a.gamification_stats.total_time_seconds ?? 999999;
                const bTime = b.gamification_stats.total_time_seconds ?? 999999;
                return aTime - bTime;
            });
        }

        // Default 'overall': Total Course XP descending
        return list;
    }, [leaderboardData, activeCategory]);

    const myStats = leaderboardData?.my_stats;
    const podium = leaderboardData?.podium || [];

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-teal mb-3" role="status">
                    <span className="visually-hidden">Memuat papan peringkat...</span>
                </div>
                <h6 className="text-muted">Menghitung akumulasi skor dan peringkat peserta...</h6>
            </div>
        );
    }

    return (
        <div className="leaderboard-tab-container">
            {/* 1. Hero Banner */}
            <div className="leaderboard-hero-banner">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                    <div>
                        <h4 className="leaderboard-hero-title">
                            <i className="fas fa-trophy text-amber"></i> Papan Peringkat Peserta Kursus
                        </h4>
                        <p className="leaderboard-hero-subtitle">
                            Peringkat kompetitif dan objektif berdasarkan <strong>Nilai Kuis</strong>, <strong>Efektivitas Belajar (Pre-Test ke Post-Test)</strong>, <strong>Skor & Waktu Gamifikasi</strong>, serta <strong>Kecepatan Ketuntasan Kursus</strong>.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="leaderboard-refresh-btn"
                        onClick={() => fetchLeaderboard(true)}
                        disabled={refreshing}
                    >
                        <i className={`fas fa-sync-alt me-1 ${refreshing ? "fa-spin" : ""}`}></i>
                        {refreshing ? "Memperbarui..." : "Segarkan Peringkat"}
                    </button>
                </div>
            </div>

            {/* 2. My Standing Card (Kartu Prestasi Saya) */}
            {myStats && (
                <div className="my-standing-card">
                    <div className="my-standing-badge">
                        <i className="fas fa-user-check me-1"></i> Posisi Peringkat Anda
                    </div>

                    <div className="my-rank-display">
                        <div className={`my-rank-circle rank-${myStats.rank <= 3 ? myStats.rank : "other"}`}>
                            <span className="rank-num">#{myStats.rank}</span>
                            <span className="rank-label">Rank</span>
                        </div>

                        <div className="flex-grow-1">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div>
                                    <h5 className="mb-0 fw-bold text-slate-800">
                                        {myStats.full_name}
                                        <span className="badge-you">Akun Anda</span>
                                    </h5>
                                    <small className="text-muted">
                                        Gelar LMS: <strong style={{ color: myStats.global_stats.level_color }}>
                                            <i className={`${myStats.global_stats.level_icon} me-1`}></i>
                                            {myStats.global_stats.level_name}
                                        </strong>
                                    </small>
                                </div>
                                <div className="text-end">
                                    <span className="total-xp-pill">
                                        <i className="fas fa-bolt me-1"></i> {myStats.total_points} Kursus XP
                                    </span>
                                    <div className="text-muted small mt-1">
                                        dari maks 1.000 XP
                                    </div>
                                </div>
                            </div>

                            {/* 4 Pilar Skor */}
                            <div className="my-score-strip">
                                <div className="pillar-chip" title="Nilai rata-rata kuis materi">
                                    <i className="fas fa-question-circle text-teal"></i>
                                    <div>
                                        <div className="text-muted small">Kuis Materi</div>
                                        <div className="p-val">{myStats.quiz_stats.avg_score}% ({myStats.quiz_stats.points} XP)</div>
                                    </div>
                                </div>

                                <div className="pillar-chip" title="Peningkatan nilai Pre-test ke Post-test">
                                    <i className="fas fa-chart-line text-emerald"></i>
                                    <div>
                                        <div className="text-muted small">Efektivitas Belajar</div>
                                        <div className="p-val">
                                            {myStats.learning_stats.has_post ? (
                                                `+${myStats.learning_stats.improvement} (${myStats.learning_stats.points} XP)`
                                            ) : myStats.learning_stats.has_pre ? (
                                                `Pre: ${myStats.learning_stats.pre_score}%`
                                            ) : (
                                                "Belum Pre-test"
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pillar-chip" title="Skor gamifikasi dan waktu pengerjaan game">
                                    <i className="fas fa-gamepad text-purple"></i>
                                    <div>
                                        <div className="text-muted small">Gamifikasi</div>
                                        <div className="p-val">{myStats.gamification_stats.avg_score}% ({myStats.gamification_stats.points} XP)</div>
                                    </div>
                                </div>

                                <div className="pillar-chip" title="Kecepatan menyelesaikan seluruh materi hingga Post-test">
                                    <i className="fas fa-tachometer-alt text-amber"></i>
                                    <div>
                                        <div className="text-muted small">Kecepatan Tuntas</div>
                                        <div className="p-val">{myStats.completion_stats.duration_human} ({myStats.completion_stats.points} XP)</div>
                                    </div>
                                </div>
                            </div>

                            {/* Terhubung dengan Sistem Skor Keseluruhan */}
                            <div className="global-link-alert">
                                <i className="fas fa-link fa-lg"></i>
                                <div>
                                    <strong>Terhubung ke Profil Global Siswa:</strong> Anda memiliki akumulasi total <strong>{myStats.global_stats.lifetime_points} Global Points</strong> di sistem LMSetjen DPD RI. Poin yang diraih dari kursus ini otomatis meningkatkan level & peringkat platform Anda!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Top 3 Podium Display */}
            {podium.length > 0 && (
                <div className="leaderboard-podium-container">
                    {/* Rank 2 (Perak) */}
                    {podium[1] && (
                        <div className="podium-step podium-step-2">
                            <div className="podium-avatar-box">
                                <img
                                    src={podium[1].avatar ? getMediaUrl(podium[1].avatar) : DEFAULT_IMAGE_URL}
                                    alt={podium[1].full_name}
                                    className="podium-avatar"
                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                />
                            </div>
                            <div className="podium-name" title={podium[1].full_name}>
                                {podium[1].full_name}
                            </div>
                            <div className="podium-xp">{podium[1].total_points} XP</div>
                            <div className="podium-block">2</div>
                        </div>
                    )}

                    {/* Rank 1 (Emas) */}
                    {podium[0] && (
                        <div className="podium-step podium-step-1">
                            <div className="podium-avatar-box">
                                <i className="fas fa-crown podium-crown"></i>
                                <img
                                    src={podium[0].avatar ? getMediaUrl(podium[0].avatar) : DEFAULT_IMAGE_URL}
                                    alt={podium[0].full_name}
                                    className="podium-avatar"
                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                />
                            </div>
                            <div className="podium-name" title={podium[0].full_name}>
                                {podium[0].full_name}
                            </div>
                            <div className="podium-xp">{podium[0].total_points} XP</div>
                            <div className="podium-block">1</div>
                        </div>
                    )}

                    {/* Rank 3 (Perunggu) */}
                    {podium[2] && (
                        <div className="podium-step podium-step-3">
                            <div className="podium-avatar-box">
                                <img
                                    src={podium[2].avatar ? getMediaUrl(podium[2].avatar) : DEFAULT_IMAGE_URL}
                                    alt={podium[2].full_name}
                                    className="podium-avatar"
                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                />
                            </div>
                            <div className="podium-name" title={podium[2].full_name}>
                                {podium[2].full_name}
                            </div>
                            <div className="podium-xp">{podium[2].total_points} XP</div>
                            <div className="podium-block">3</div>
                        </div>
                    )}
                </div>
            )}

            {/* 4. Multi-Category Filter Tabs */}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="leaderboard-nav-pills">
                    <button
                        type="button"
                        className={`leaderboard-nav-btn ${activeCategory === "overall" ? "active" : ""}`}
                        onClick={() => setActiveCategory("overall")}
                    >
                        <i className="fas fa-trophy"></i> Peringkat Utama (Total XP)
                    </button>
                    <button
                        type="button"
                        className={`leaderboard-nav-btn ${activeCategory === "speed" ? "active" : ""}`}
                        onClick={() => setActiveCategory("speed")}
                    >
                        <i className="fas fa-bolt"></i> Tercepat Tuntas
                    </button>
                    <button
                        type="button"
                        className={`leaderboard-nav-btn ${activeCategory === "gain" ? "active" : ""}`}
                        onClick={() => setActiveCategory("gain")}
                    >
                        <i className="fas fa-chart-line"></i> Efektivitas Belajar (Pre &rarr; Post)
                    </button>
                    <button
                        type="button"
                        className={`leaderboard-nav-btn ${activeCategory === "games" ? "active" : ""}`}
                        onClick={() => setActiveCategory("games")}
                    >
                        <i className="fas fa-gamepad"></i> Master Gamifikasi
                    </button>
                </div>
                <div className="text-muted small">
                    Menampilkan <strong>{processedLeaderboard.length} Peserta</strong>
                </div>
            </div>

            {/* 5. Leaderboard Table */}
            <div className="leaderboard-table-card">
                <div className="table-responsive">
                    <table className="table align-middle">
                        <thead>
                            <tr>
                                <th style={{ width: "60px" }} className="text-center">#</th>
                                <th>Peserta Kursus</th>
                                <th className="text-center">Total XP</th>
                                <th className="text-center">Efektivitas Belajar</th>
                                <th className="text-center">Nilai Kuis</th>
                                <th className="text-center">Gamifikasi</th>
                                <th className="text-center">Waktu Ketuntasan</th>
                                <th className="text-center">Poin Global</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedLeaderboard.map((student, idx) => {
                                const rankDisplay = idx + 1;
                                const isMe = student.is_current_user || (currentUserId && student.user_id === currentUserId);

                                let medalClass = "normal";
                                let medalIcon = null;
                                if (rankDisplay === 1) {
                                    medalClass = "gold";
                                    medalIcon = <i className="fas fa-medal text-amber"></i>;
                                } else if (rankDisplay === 2) {
                                    medalClass = "silver";
                                    medalIcon = <i className="fas fa-medal text-secondary"></i>;
                                } else if (rankDisplay === 3) {
                                    medalClass = "bronze";
                                    medalIcon = <i className="fas fa-medal text-warning"></i>;
                                }

                                return (
                                    <tr key={student.user_id} className={isMe ? "leaderboard-row-me" : ""}>
                                        <td className="text-center">
                                            <span className={`rank-badge ${medalClass}`}>
                                                {medalIcon || rankDisplay}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="student-meta-cell">
                                                <img
                                                    src={student.avatar ? getMediaUrl(student.avatar) : DEFAULT_IMAGE_URL}
                                                    alt={student.full_name}
                                                    className="student-table-avatar"
                                                    onError={(e) => { e.target.src = DEFAULT_IMAGE_URL; }}
                                                />
                                                <div>
                                                    <div className="student-name-bold">
                                                        {student.full_name}
                                                        {isMe && <span className="badge-you">Anda</span>}
                                                    </div>
                                                    <div className="student-subtext">
                                                        <i className={`${student.global_stats.level_icon} me-1`} style={{ color: student.global_stats.level_color }}></i>
                                                        {student.global_stats.level_name}
                                                    </div>
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
                                                    <div className="fw-bold text-success">
                                                        +{student.learning_stats.improvement} Poin
                                                    </div>
                                                    <small className="text-muted d-block" style={{ fontSize: "0.725rem" }}>
                                                        Pre: {student.learning_stats.pre_score}% &rarr; Post: {student.learning_stats.post_score}%
                                                    </small>
                                                </div>
                                            ) : student.learning_stats.has_pre ? (
                                                <span className="badge bg-warning-subtle text-warning">
                                                    Pre-test: {student.learning_stats.pre_score}%
                                                </span>
                                            ) : (
                                                <span className="badge bg-light text-muted">Belum Tes</span>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <div className="fw-semibold">
                                                {student.quiz_stats.avg_score}%
                                            </div>
                                            <small className="text-muted" style={{ fontSize: "0.725rem" }}>
                                                {student.quiz_stats.total_quizzes > 0
                                                    ? `${student.quiz_stats.passed_quizzes}/${student.quiz_stats.total_quizzes} Lulus (${student.quiz_stats.points} XP)`
                                                    : `Progres (${student.quiz_stats.points} XP)`}
                                            </small>
                                        </td>
                                        <td className="text-center">
                                            <div className="fw-semibold text-purple">
                                                {student.gamification_stats.avg_score}%
                                            </div>
                                            <small className="text-muted" style={{ fontSize: "0.725rem" }}>
                                                {student.gamification_stats.total_games > 0
                                                    ? `${student.gamification_stats.completed_games}/${student.gamification_stats.total_games} Game (${student.gamification_stats.points} XP)`
                                                    : `Progres (${student.gamification_stats.points} XP)`}
                                            </small>
                                        </td>
                                        <td className="text-center">
                                            {student.completion_stats.is_completed ? (
                                                <div>
                                                    <span className="badge bg-success-subtle text-success">
                                                        <i className="fas fa-check-circle me-1"></i>Tuntas
                                                    </span>
                                                    <small className="text-muted d-block mt-1" style={{ fontSize: "0.725rem" }}>
                                                        {student.completion_stats.duration_human}
                                                    </small>
                                                </div>
                                            ) : (
                                                <span className="badge bg-light text-muted">Sedang Belajar</span>
                                            )}
                                        </td>
                                        <td className="text-center">
                                            <span className="fw-bold text-slate-700">
                                                {student.global_stats.lifetime_points} XP
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. Formula & Global Points Transparency */}
            <div className="leaderboard-formula-card">
                <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-calculator text-teal fa-lg"></i>
                    <h6 className="mb-0 fw-bold">Formula & Transparansi Perhitungan Skor Kursus (1.000 XP)</h6>
                </div>
                <p className="text-muted small mb-3">
                    Setiap pilar dinilai secara objektif untuk mengukur integritas dan pertumbuhan kompetensi siswa secara komprehensif:
                </p>

                <div className="formula-grid">
                    <div className="formula-item">
                        <h6><i className="fas fa-question-circle text-teal me-1"></i> 1. Kuis Materi (25% / 250 XP)</h6>
                        <small>Rata-rata pencapaian skor nilai seluruh kuis materi modul yang telah lulus dikerjakan.</small>
                    </div>

                    <div className="formula-item">
                        <h6><i className="fas fa-chart-line text-emerald me-1"></i> 2. Efektivitas Belajar (35% / 350 XP)</h6>
                        <small>Mengukur lonjakan pemahaman dari Pre-Test ke Post-Test (Normalized Learning Gain). Siswa yang paling berkembang mendapatkan apresiasi tertinggi.</small>
                    </div>

                    <div className="formula-item">
                        <h6><i className="fas fa-gamepad text-purple me-1"></i> 3. Gamifikasi & Kecepatan (20% / 200 XP)</h6>
                        <small>Skor tantangan mini-game (TTS, Word Search, Anagram, Memory Match) ditambah bonus ketangkasan waktu pengerjaan.</small>
                    </div>

                    <div className="formula-item">
                        <h6><i className="fas fa-tachometer-alt text-amber me-1"></i> 4. Kecepatan Ketuntasan (20% / 200 XP)</h6>
                        <small>Dihitung dari selisih waktu mulai Pre-Test hingga berhasil lulus Post-Test (Time to Completion Speed).</small>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-top d-flex align-items-center gap-2 text-muted small">
                    <i className="fas fa-shield-alt text-teal"></i>
                    <span>Poin dari kursus ini terhubung dan menyumbang langsung ke <strong>StudentPoints</strong> profil global siswa di seluruh sistem LMS Setjen DPD RI.</span>
                </div>
            </div>
        </div>
    );
}

export default LeaderboardTab;

