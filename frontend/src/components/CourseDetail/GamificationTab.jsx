import React, { useState, useEffect, useMemo } from "react";
import apiInstance from "../../utils/axios";
import Toast from "../../views/plugin/Toast";
import UserData from "../../views/plugin/UserData";
import "./GamificationTab.css";

const GAME_META = {
    crossword: {
        name: "Teka Teki Silang",
        icon: "fas fa-border-all",
        iconClass: "icon-crossword",
        badgeClass: "badge-crossword"
    },
    word_search: {
        name: "Word Search (Cari Kata)",
        icon: "fas fa-search",
        iconClass: "icon-wordsearch",
        badgeClass: "badge-wordsearch"
    },
    anagram: {
        name: "Anagram (Susun Kata)",
        icon: "fas fa-font",
        iconClass: "icon-anagram",
        badgeClass: "badge-anagram"
    },
    memory_match: {
        name: "Memory Match (Kartu)",
        icon: "fas fa-clone",
        iconClass: "icon-memory",
        badgeClass: "badge-memory"
    }
};

const GamificationTab = ({
    course,
    pretestRequired = false,
    hasCompletedPretest = true,
    onStartPretest = null,
    onGameCompleted = null,
    selectedGame = null,
    onSelectGame = null,
    refreshKey = 0
}) => {
    const isPretestLocked = pretestRequired && !hasCompletedPretest;
    const userData = UserData();
    const userId = userData?.user_id;
    // Resolve courseId properly whether passed as Course object or EnrolledCourse wrapper
    const courseId = course?.course?.course_id || course?.course_id || course?.course?.id || course?.id;

    const [games, setGames] = useState(() => {
        const initial = course?.course?.games || course?.games;
        return Array.isArray(initial) ? initial : [];
    });
    const [isLoading, setIsLoading] = useState(true);

    // Sync state immediately if course.games prop changes with updated attempts
    useEffect(() => {
        const propGames = course?.course?.games || course?.games;
        if (Array.isArray(propGames) && propGames.length > 0) {
            setGames(propGames);
            setIsLoading(false);
        }
    }, [course]);

    // Fetch Games for student
    const fetchGames = async (silent = false) => {
        if (!courseId) {
            setIsLoading(false);
            return;
        }
        try {
            if (!silent && games.length === 0) {
                setIsLoading(true);
            }
            const url = userId 
                ? `student/game-list/${userId}/${courseId}/`
                : `game/list-create/?course_id=${courseId}`;
            const res = await apiInstance.get(url);
            const raw = res.data?.results || res.data;
            const fetched = Array.isArray(raw) ? raw : [];
            setGames(fetched);

            // Keep selectedGame in GamePlayer updated with fresh attempts count & status
            if (selectedGame && onSelectGame) {
                const refreshed = fetched.find(g => g.game_id === selectedGame.game_id);
                if (refreshed) {
                    onSelectGame(refreshed);
                }
            }
        } catch (error) {
            console.error("Error fetching games for student:", error);
            const fallback = course?.course?.games || course?.games;
            if (Array.isArray(fallback)) {
                setGames(fallback);
            } else if (fallback?.results && Array.isArray(fallback.results)) {
                setGames(fallback.results);
            } else {
                setGames([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const gamesList = useMemo(() => {
        if (Array.isArray(games)) return games;
        if (games && Array.isArray(games.results)) return games.results;
        return [];
    }, [games]);

    useEffect(() => {
        if (courseId) {
            fetchGames(games.length > 0);
        } else if (course) {
            setIsLoading(false);
        }
    }, [courseId, userId, refreshKey]);

    // Handle user selecting/starting a game
    const handleOpenGame = (game) => {
        if (isPretestLocked) {
            Toast().fire({
                icon: "warning",
                title: "Gamifikasi Terkunci",
                text: "Selesaikan Pre-test Diagnostik terlebih dahulu untuk memainkan tantangan mini-game ini."
            });
            return;
        }

        const attemptsUsed = game.user_attempts_count || 0;
        const maxAttempts = game.max_attempts || 3;
        if (attemptsUsed >= maxAttempts) {
            Toast().fire({
                icon: "info",
                title: "Batas 3 kesempatan telah habis",
                text: `Skor terbaik Anda: ${game.user_best_score || 0}%`
            });
            return;
        }

        if (onSelectGame) {
            onSelectGame(game);
        }
    };

    return (
        <div className="tab-pane fade" id="gamification" role="tabpanel">
            <div className="gamification-tab-container">
                {isPretestLocked ? (
                    <div className="gamification-pretest-locked p-4 p-md-5 my-3 text-center rounded-4 border border-warning-subtle bg-white shadow-sm">
                        <div className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning border border-warning" style={{ width: '68px', height: '68px' }}>
                            <i className="fas fa-lock" style={{ fontSize: '1.75rem' }}></i>
                        </div>
                        <h5 className="fw-bold text-dark mb-2">Gamifikasi Terkunci</h5>
                        <p className="text-muted mx-auto mb-4" style={{ maxWidth: '580px', fontSize: '0.92rem', lineHeight: '1.6' }}>
                            Akses mini-game dan tantangan interaktif kursus ini terkunci. Anda harus menyelesaikan <strong>Pre-test Diagnostik</strong> terlebih dahulu sebelum dapat membuka dan memainkan tantangan Gamifikasi.
                        </p>
                        {onStartPretest && (
                            <button
                                type="button"
                                className="btn btn-teal fw-bold px-4 py-2 shadow-sm"
                                onClick={onStartPretest}
                            >
                                <i className="fas fa-play me-2"></i>
                                Mulai Kerjakan Pre-test Sekarang
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Summary Card */}
                        <div className="gamification-summary-card d-flex justify-content-between align-items-center flex-wrap gap-3">
                            <div>
                                <h5><i className="fas fa-gamepad me-2"></i>Gamifikasi & Tantangan Materi</h5>
                                <p>
                                    Uji pemahaman materi kursus lewat mini-game interaktif pada Player Arena di atas. Setiap materi game memiliki maksimal <strong>3 kesempatan</strong> mencoba.
                                </p>
                            </div>
                            <div className="d-flex gap-2">
                                <div className="stat-badge-pill">
                                    <i className="fas fa-trophy text-warning"></i>
                                    <span>Total {gamesList.length} Game</span>
                                </div>
                                <div className="stat-badge-pill">
                                    <i className="fas fa-shield-alt text-info"></i>
                                    <span>Maks 3x Kesempatan</span>
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="text-muted mt-2">Memuat mini-game kursus...</p>
                            </div>
                        ) : gamesList.length === 0 ? (
                            <div className="card text-center p-5 border-0 shadow-sm">
                                <div className="text-muted mb-3" style={{ fontSize: "2.5rem" }}>
                                    <i className="fas fa-puzzle-piece text-secondary"></i>
                                </div>
                                <h6 className="fw-bold">Belum Ada Mini-Game untuk Kursus Ini</h6>
                                <p className="text-muted small">Instruktur belum menambahkan mini-game materi untuk kursus ini.</p>
                            </div>
                        ) : (
                            /* Games Grid */
                            <div className="row g-3">
                                {gamesList.map((game, idx) => {
                                    const meta = GAME_META[game.game_type] || GAME_META.crossword;
                                    const attemptsUsed = game.user_attempts_count || 0;
                                    const maxAttempts = game.max_attempts || 3;
                                    const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
                                    const canAttempt = attemptsLeft > 0;
                                    const bestScore = game.user_best_score || 0;
                                    const isPassed = game.user_is_passed || bestScore >= 70;
                                    const isCurrentlyActive = selectedGame?.game_id === game.game_id;

                                    return (
                                        <div key={game.game_id || idx} className="col-lg-6 col-md-12">
                                            <div className={`game-card-item ${isCurrentlyActive ? "border-primary shadow-sm" : ""}`} style={isCurrentlyActive ? { borderColor: "#0d9488", backgroundColor: "#f0fdfa" } : {}}>
                                                <div>
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className={`game-card-icon ${meta.iconClass}`}>
                                                                <i className={meta.icon}></i>
                                                            </div>
                                                            <div>
                                                                <span className={`game-badge ${meta.badgeClass}`}>
                                                                    {meta.name}
                                                                </span>
                                                                <h6 className="fw-bold m-0 mt-1">{game.title}</h6>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {isCurrentlyActive && (
                                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle me-1">
                                                                    <i className="fas fa-satellite-dish me-1"></i>Aktif di Player
                                                                </span>
                                                            )}
                                                            {isPassed ? (
                                                                <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                                    <i className="fas fa-check-circle me-1"></i>Lulus ({bestScore}%)
                                                                </span>
                                                            ) : attemptsUsed > 0 ? (
                                                                <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                                                                    Skor: {bestScore}%
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-secondary-subtle text-secondary">
                                                                    Belum Dicoba
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <p className="text-muted small mt-2 mb-3" style={{ minHeight: "36px", whiteSpace: "pre-line", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                                                        {game.description || "Selesaikan tantangan game untuk menguji ingatan materi dan raih poin."}
                                                    </p>
                                                </div>

                                                <div className="border-top pt-3 d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <div className="small text-muted mb-1">
                                                            Kesempatan: <strong>{attemptsUsed} / {maxAttempts}</strong>
                                                        </div>
                                                        <div className="attempt-pill-dots">
                                                            {Array.from({ length: maxAttempts }).map((_, dotIdx) => (
                                                                <span 
                                                                    key={dotIdx} 
                                                                    className={`dot-attempt ${dotIdx < attemptsUsed ? (isPassed ? "used" : "failed") : ""}`}
                                                                ></span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        {canAttempt ? (
                                                            <button 
                                                                className={`btn btn-sm ${isCurrentlyActive ? "btn-teal" : "btn-primary"} px-3 fw-bold shadow-sm`}
                                                                onClick={() => handleOpenGame(game)}
                                                            >
                                                                <i className={`fas ${isCurrentlyActive ? "fa-play-circle" : "fa-play"} me-1`}></i>
                                                                {isCurrentlyActive 
                                                                    ? "Fokus ke Arena" 
                                                                    : attemptsUsed === 0 
                                                                        ? "Mulai Main" 
                                                                        : `Coba Lagi (${attemptsLeft} sisa)`}
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                className="btn btn-sm btn-outline-secondary px-3"
                                                                onClick={() => handleOpenGame(game)}
                                                            >
                                                                <i className="fas fa-lock me-1"></i>Kesempatan Habis
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GamificationTab;
