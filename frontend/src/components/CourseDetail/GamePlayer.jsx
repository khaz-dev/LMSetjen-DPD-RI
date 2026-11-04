import React, { useState, useEffect, useMemo, useRef } from "react";
import apiInstance from "../../utils/axios";
import Toast from "../../views/plugin/Toast";
import UserData from "../../views/plugin/UserData";
import gameAudio from "../../utils/gameAudio";
import "./GamePlayer.css";

const GAME_META = {
    crossword: {
        name: "Teka Teki Silang",
        icon: "fas fa-border-all",
        badgeClass: "badge-crossword"
    },
    word_search: {
        name: "Word Search (Cari Kata)",
        icon: "fas fa-search",
        badgeClass: "badge-wordsearch"
    },
    anagram: {
        name: "Anagram (Susun Kata)",
        icon: "fas fa-font",
        badgeClass: "badge-anagram"
    },
    memory_match: {
        name: "Memory Match (Kartu)",
        icon: "fas fa-clone",
        badgeClass: "badge-memory"
    }
};

const GamePlayer = ({
    course,
    activeGame,
    onSelectGame,
    onCloseGame,
    onGameCompleted,
    pretestRequired = false,
    hasCompletedPretest = true,
    onStartPretest = null
}) => {
    const isPretestLocked = pretestRequired && !hasCompletedPretest;
    const userData = UserData();
    const userId = userData?.user_id;

    // Available games from course
    const courseGames = useMemo(() => {
        const raw = course?.course?.games || course?.games;
        if (Array.isArray(raw)) return raw;
        if (raw?.results && Array.isArray(raw.results)) return raw.results;
        return [];
    }, [course]);

    // Stage: 'ready' | 'playing' | 'completed'
    const [gameStage, setGameStage] = useState("ready");
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [isMuted, setIsMuted] = useState(() => gameAudio.getMuted());
    const [isBgmActive, setIsBgmActive] = useState(() => !gameAudio.getBGMMuted());

    // Mini-game specific states
    // 1. Crossword
    const [crosswordAnswers, setCrosswordAnswers] = useState({});
    const [activeClueIndex, setActiveClueIndex] = useState(0);

    // 2. Word Search
    const [wsGrid, setWsGrid] = useState([]);
    const [wsFoundWords, setWsFoundWords] = useState([]);
    const [wsSelectedCells, setWsSelectedCells] = useState([]);

    // 3. Anagram
    const [anagramCurrentIdx, setAnagramCurrentIdx] = useState(0);
    const [anagramUserLetters, setAnagramUserLetters] = useState([]);
    const [anagramSolvedCount, setAnagramSolvedCount] = useState(0);

    // 4. Memory Match
    const [memoryCards, setMemoryCards] = useState([]);
    const [flippedCards, setFlippedCards] = useState([]);
    const [matchedCardIds, setMatchedCardIds] = useState([]);
    const [memoryMoves, setMemoryMoves] = useState(0);

    const timerRef = useRef(null);

    // Audio SFX Toggle Handler
    const handleToggleSound = () => {
        const next = gameAudio.toggleMute();
        setIsMuted(next);
        if (!next) {
            gameAudio.playSelect();
        }
    };

    // Background Music (BGM) Toggle Handler
    const handleToggleBGM = () => {
        const active = gameAudio.toggleBGM();
        setIsBgmActive(active);
    };

    const handleCloseArena = () => {
        gameAudio.stopBGM();
        if (onCloseGame) {
            onCloseGame();
        }
    };

    // Reset when activeGame changes
    useEffect(() => {
        if (activeGame) {
            setGameStage("ready");
            setTimerSeconds(0);
            setSubmissionResult(null);
            setFlippedCards([]);
            setMatchedCardIds([]);
            setWsSelectedCells([]);
            setWsFoundWords([]);
            setCrosswordAnswers({});
        }
    }, [activeGame?.game_id]);

    // Timer effect
    useEffect(() => {
        if (gameStage === "playing") {
            timerRef.current = setInterval(() => {
                setTimerSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameStage]);

    // Background Music (BGM) playback effect
    useEffect(() => {
        if (gameStage === "playing") {
            gameAudio.startBGM();
        } else {
            gameAudio.stopBGM();
        }
    }, [gameStage]);

    // Unmount cleanup
    useEffect(() => {
        return () => {
            gameAudio.stopBGM();
        };
    }, []);

    // Initialize Boards & start playing
    const handleStartPlaying = () => {
        if (!activeGame) return;
        gameAudio.playGameStart();
        gameAudio.startBGM();
        setGameStage("playing");
        setTimerSeconds(0);

        const gType = activeGame.game_type;
        const gData = activeGame.game_data || {};

        if (gType === "crossword") {
            const items = gData.items || [];
            const initialAns = {};
            items.forEach((_, idx) => {
                initialAns[idx] = "";
            });
            setCrosswordAnswers(initialAns);
            setActiveClueIndex(0);
        } else if (gType === "word_search") {
            initWordSearch(gData.words || []);
        } else if (gType === "anagram") {
            setAnagramCurrentIdx(0);
            setAnagramSolvedCount(0);
            setAnagramUserLetters([]);
        } else if (gType === "memory_match") {
            initMemoryMatch(gData.pairs || []);
        }
    };

    // Helper: Init Word Search
    const initWordSearch = (wordsList) => {
        const size = 10;
        const grid = Array(size).fill(null).map(() => Array(size).fill(""));
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const validWords = wordsList.map(w => 
            (typeof w === "object" ? w.word : w).toUpperCase().replace(/[^A-Z]/g, "")
        );

        validWords.forEach((word) => {
            if (!word || word.length > size) return;
            let placed = false;
            let tries = 0;
            while (!placed && tries < 50) {
                tries++;
                const isHorizontal = Math.random() > 0.5;
                const row = Math.floor(Math.random() * (isHorizontal ? size : size - word.length + 1));
                const col = Math.floor(Math.random() * (isHorizontal ? size - word.length + 1 : size));

                let canPlace = true;
                for (let i = 0; i < word.length; i++) {
                    const r = isHorizontal ? row : row + i;
                    const c = isHorizontal ? col + i : col;
                    if (grid[r][c] !== "" && grid[r][c] !== word[i]) {
                        canPlace = false;
                        break;
                    }
                }

                if (canPlace) {
                    for (let i = 0; i < word.length; i++) {
                        const r = isHorizontal ? row : row + i;
                        const c = isHorizontal ? col + i : col;
                        grid[r][c] = word[i];
                    }
                    placed = true;
                }
            }
        });

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === "") {
                    grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
                }
            }
        }

        setWsGrid(grid);
        setWsFoundWords([]);
        setWsSelectedCells([]);
    };

    // Helper: Init Memory Match
    const initMemoryMatch = (pairs) => {
        const cards = [];
        pairs.forEach((p, idx) => {
            cards.push({
                id: `term-${idx}`,
                pairId: idx,
                type: "term",
                content: p.term
            });
            cards.push({
                id: `def-${idx}`,
                pairId: idx,
                type: "def",
                content: p.definition
            });
        });

        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        setMemoryCards(cards);
        setFlippedCards([]);
        setMatchedCardIds([]);
        setMemoryMoves(0);
    };

    // 1. Crossword Handlers
    const handleCrosswordLetterChange = (clueIdx, letterIdx, val) => {
        gameAudio.playKeyTick();
        const item = activeGame.game_data.items[clueIdx];
        const targetLen = item.answer.length;
        const currentAnswer = (crosswordAnswers[clueIdx] || "").padEnd(targetLen, " ");
        const chars = currentAnswer.split("");
        chars[letterIdx] = (val || " ").toUpperCase();
        const newAns = chars.join("");

        setCrosswordAnswers({
            ...crosswordAnswers,
            [clueIdx]: newAns
        });

        if (val && letterIdx < targetLen - 1) {
            const nextInput = document.getElementById(`cw-arena-input-${clueIdx}-${letterIdx + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const submitCrossword = () => {
        const items = activeGame.game_data.items || [];
        let correctCount = 0;
        items.forEach((item, idx) => {
            const userAns = (crosswordAnswers[idx] || "").trim().toUpperCase();
            if (userAns === item.answer.trim().toUpperCase()) {
                correctCount++;
            }
        });

        const score = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0;
        finalizeAttempt(score);
    };

    // 2. Word Search Handlers
    const handleWsCellClick = (r, c) => {
        const newSelection = [...wsSelectedCells];
        const existingIdx = newSelection.findIndex(cell => cell.r === r && cell.c === c);

        if (existingIdx !== -1) {
            newSelection.splice(existingIdx, 1);
            gameAudio.playTileDeselect();
        } else {
            newSelection.push({ r, c, char: wsGrid[r][c] });
            gameAudio.playTileSelect();
        }
        setWsSelectedCells(newSelection);

        const formedWord = newSelection.map(cell => cell.char).join("");
        const reverseFormed = formedWord.split("").reverse().join("");
        const targetWords = (activeGame.game_data.words || []).map(w => 
            (typeof w === "object" ? w.word : w).toUpperCase().replace(/[^A-Z]/g, "")
        );

        const matchedWord = targetWords.find(w => (w === formedWord || w === reverseFormed) && !wsFoundWords.includes(w));
        if (matchedWord) {
            const updatedFound = [...wsFoundWords, matchedWord];
            setWsFoundWords(updatedFound);
            setWsSelectedCells([]);
            gameAudio.playWordFound();
            Toast().fire({ icon: "success", title: `Kata ditemukan: ${matchedWord}!` });

            if (updatedFound.length >= targetWords.length) {
                finalizeAttempt(100);
            }
        }
    };

    const submitWordSearch = () => {
        const targetWords = (activeGame.game_data.words || []).map(w => 
            (typeof w === "object" ? w.word : w).toUpperCase().replace(/[^A-Z]/g, "")
        );
        const score = targetWords.length > 0 ? Math.round((wsFoundWords.length / targetWords.length) * 100) : 0;
        finalizeAttempt(score);
    };

    // 3. Anagram Handlers (Multi-word phrase support)
    const currentAnagramItem = useMemo(() => {
        if (!activeGame || activeGame.game_type !== "anagram") return null;
        const items = activeGame.game_data.items || [];
        return items[anagramCurrentIdx] || null;
    }, [activeGame, anagramCurrentIdx]);

    // Breakdown multi-word phrase into word groups with continuous global slot indices
    const anagramWordsBreakdown = useMemo(() => {
        if (!currentAnagramItem?.word) return [];
        const words = currentAnagramItem.word.trim().toUpperCase().split(/\s+/).filter(Boolean);
        let runningSlotIndex = 0;
        return words.map((w, wIdx) => {
            const cleanLetters = w.replace(/[^A-Z]/g, "").split("");
            const slots = cleanLetters.map((char) => {
                const slotIdx = runningSlotIndex;
                runningSlotIndex += 1;
                return {
                    slotIdx,
                    targetChar: char
                };
            });
            return {
                wordIndex: wIdx,
                wordString: w,
                slots
            };
        });
    }, [currentAnagramItem]);

    const totalAnagramLettersCount = useMemo(() => {
        return anagramWordsBreakdown.reduce((acc, w) => acc + w.slots.length, 0);
    }, [anagramWordsBreakdown]);

    const scrambledLetters = useMemo(() => {
        if (!currentAnagramItem) return [];
        const raw = currentAnagramItem.word.toUpperCase().replace(/[^A-Z]/g, "");
        const arr = raw.split("").map((char, index) => ({ id: `${char}-${index}`, char }));
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }, [currentAnagramItem]);

    const handleSelectAnagramLetter = (letterObj) => {
        if (anagramUserLetters.length < totalAnagramLettersCount) {
            gameAudio.playTileDrop();
            setAnagramUserLetters([...anagramUserLetters, letterObj]);
        }
    };

    const handleRemoveAnagramLetter = (idx) => {
        gameAudio.playTileRemove();
        const updated = [...anagramUserLetters];
        updated.splice(idx, 1);
        setAnagramUserLetters(updated);
    };

    const handleCheckAnagramWord = () => {
        const userWord = anagramUserLetters.map(l => l.char).join("");
        const targetWord = currentAnagramItem.word.toUpperCase().replace(/[^A-Z]/g, "");
        const totalItems = activeGame.game_data.items.length;
        let newSolved = anagramSolvedCount;

        if (userWord === targetWord) {
            newSolved += 1;
            setAnagramSolvedCount(newSolved);
            gameAudio.playCorrectChime();
            Toast().fire({ icon: "success", title: "Benar! Susunan kata/frasa tepat." });
        } else {
            gameAudio.playWrongBuzzer();
            Toast().fire({ icon: "error", title: `Kurang tepat. Jawaban yang benar: ${currentAnagramItem.word.toUpperCase()}` });
        }

        if (anagramCurrentIdx + 1 < totalItems) {
            setAnagramCurrentIdx(prev => prev + 1);
            setAnagramUserLetters([]);
        } else {
            const score = Math.round((newSolved / totalItems) * 100);
            finalizeAttempt(score);
        }
    };

    // 4. Memory Match Handlers with Sound & 3D Flip
    const handleMemoryCardClick = (card) => {
        if (flippedCards.length === 2) return;
        if (flippedCards.some(c => c.id === card.id)) return;
        if (matchedCardIds.includes(card.id)) return;

        // Sound on flipping card open
        gameAudio.playCardFlip();

        const newFlipped = [...flippedCards, card];
        setFlippedCards(newFlipped);

        if (newFlipped.length === 2) {
            setMemoryMoves(prev => prev + 1);
            const [first, second] = newFlipped;
            if (first.pairId === second.pairId && first.type !== second.type) {
                // Match! Celebratory chime
                setTimeout(() => {
                    gameAudio.playCardMatch();
                }, 150);
                const newMatched = [...matchedCardIds, first.id, second.id];
                setMatchedCardIds(newMatched);
                setFlippedCards([]);

                if (newMatched.length >= memoryCards.length) {
                    finalizeAttempt(100);
                }
            } else {
                // Mismatch: soft warning and flip back
                setTimeout(() => {
                    gameAudio.playCardMismatch();
                }, 200);
                setTimeout(() => {
                    gameAudio.playCardClose();
                    setFlippedCards([]);
                }, 1000);
            }
        }
    };

    // Submit Attempt
    const finalizeAttempt = async (score) => {
        setGameStage("completed");
        if (timerRef.current) clearInterval(timerRef.current);
        gameAudio.stopBGM();

        // Sound based on score result
        if (score >= 70) {
            gameAudio.playVictoryFanfare();
        } else {
            gameAudio.playTryAgainMelody();
        }

        if (!userId) {
            setSubmissionResult({
                score,
                is_passed: score >= 70,
                attempts_left: 2,
                points_awarded: score >= 70 ? (activeGame.points_reward || 50) : 0,
                can_attempt: true
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await apiInstance.post(`student/game-submit/${userId}/`, {
                game_id: activeGame.game_id,
                score: score,
                time_taken: timerSeconds,
                is_passed: score >= 70,
                answers_data: { completed_at: new Date().toISOString() }
            });

            setSubmissionResult(res.data);
            if (onGameCompleted) {
                onGameCompleted();
            }
        } catch (error) {
            console.error("Error submitting game attempt:", error);
            const errMsg = error.response?.data?.error || "Gagal menyimpan hasil game";
            Toast().fire({ icon: "error", title: errMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    // -------------------------------------------------------------------------
    // Render: 1. Locked Pretest Standby
    // -------------------------------------------------------------------------
    if (isPretestLocked) {
        return (
            <div className="game-player-standby">
                <div className="game-standby-content">
                    <div className="game-standby-icon-circle locked-circle">
                        <i className="fas fa-lock"></i>
                    </div>
                    <h5 className="game-standby-title">Gamifikasi Pembelajaran Terkunci</h5>
                    <p className="game-standby-subtitle">
                        Akses tantangan mini-game materi terkunci. Anda harus menyelesaikan <strong>Pre-test Diagnostik</strong> terlebih dahulu sebelum membuka arena gamifikasi kursus ini.
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
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // Render: 2. Standby State (When no game is currently selected)
    // -------------------------------------------------------------------------
    if (!activeGame) {
        const firstPlayableGame = courseGames.find(g => ((g.user_attempts_count || 0) < (g.max_attempts || 3))) || courseGames[0];

        return (
            <div className="game-player-standby">
                <div className="game-standby-content">
                    <div className="game-standby-icon-circle">
                        <i className="fas fa-gamepad"></i>
                    </div>
                    <h5 className="game-standby-title">Arena Gamifikasi Pembelajaran</h5>
                    <p className="game-standby-subtitle">
                        Uji pemahaman dan daya ingat materi kursus melalui simulasi mini-game interaktif. Silakan pilih salah satu tantangan pada daftar permainan di bawah untuk memulai arena.
                    </p>

                    <div className="game-standby-chips">
                        <span className="game-standby-chip">
                            <i className="fas fa-trophy text-warning"></i> Total {courseGames.length} Mini-Game
                        </span>
                        <span className="game-standby-chip">
                            <i className="fas fa-shield-alt text-info"></i> Maksimal 3x Percobaan
                        </span>
                        <span className="game-standby-chip">
                            <i className="fas fa-star text-warning"></i> Dapatkan Poin XP
                        </span>
                    </div>

                    {firstPlayableGame && onSelectGame ? (
                        <button
                            type="button"
                            className="btn btn-teal fw-bold px-4 py-2.5 shadow-sm"
                            onClick={() => onSelectGame(firstPlayableGame)}
                        >
                            <i className="fas fa-play me-2"></i>
                            Mulai Main Game Pertama: {firstPlayableGame.title}
                        </button>
                    ) : (
                        <div className="text-muted small">
                            <i className="fas fa-info-circle me-1"></i>
                            Pilih modul permainan pada kartu di bawah.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // Render: 3. Active Game Player Arena Card
    // -------------------------------------------------------------------------
    const meta = GAME_META[activeGame.game_type] || GAME_META.crossword;
    const attemptsUsed = activeGame.user_attempts_count || 0;
    const maxAttempts = activeGame.max_attempts || 3;
    const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
    const hasAttempts = attemptsLeft > 0;

    return (
        <div className="game-player-arena-card">
            {/* Arena Header: Left title + Right Controls (Sound, Timer, Close Button flush on far right) */}
            <div className="game-arena-header">
                <div className="game-arena-header-left">
                    <span className={`game-badge ${meta.badgeClass}`}>
                        <i className={`${meta.icon} me-1`}></i>
                        {meta.name}
                    </span>
                    <h6 className="game-arena-title">{activeGame.title}</h6>
                </div>

                <div className="game-arena-header-right">
                    <button
                        type="button"
                        className={`btn-music-toggle ${isBgmActive ? "active" : ""}`}
                        onClick={handleToggleBGM}
                        title={isBgmActive ? "Matikan Musik Latar (BGM)" : "Nyalakan Musik Latar (BGM)"}
                        aria-label="Toggle Background Music"
                    >
                        <i className={`fas ${isBgmActive ? "fa-music text-teal" : "fa-music text-muted opacity-50"}`}></i>
                        <span className="d-none d-md-inline">
                            {isBgmActive ? "Musik On" : "Musik Off"}
                        </span>
                    </button>

                    <button
                        type="button"
                        className="btn-sound-toggle"
                        onClick={handleToggleSound}
                        title={isMuted ? "Aktifkan Efek Suara (SFX)" : "Bisukan Efek Suara (SFX)"}
                        aria-label="Toggle Sound Effects"
                    >
                        <i className={`fas ${isMuted ? "fa-volume-mute text-danger" : "fa-volume-up text-primary"}`}></i>
                    </button>

                    {gameStage === "playing" && (
                        <div className="game-arena-timer-badge">
                            <i className="fas fa-clock me-1 text-primary"></i>
                            {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
                        </div>
                    )}

                    <button
                        type="button"
                        className="btn-close-arena"
                        onClick={handleCloseArena}
                        title="Tutup Arena Game"
                    >
                        <i className="fas fa-times me-1"></i>
                        <span>Tutup Arena</span>
                    </button>
                </div>
            </div>

            {/* Arena Body */}
            <div className="game-arena-body">
                {/* STAGE 1: READY / RULES & CONFIRMATION */}
                {gameStage === "ready" && (
                    <div className="text-center py-4 game-arena-board-wrap">
                        <div
                            className={`game-card-icon ${meta.badgeClass} mx-auto mb-3`}
                            style={{ width: "68px", height: "68px", fontSize: "1.9rem", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <i className={meta.icon}></i>
                        </div>
                        <h4 className="fw-bold text-dark mb-2">{activeGame.title}</h4>
                        
                        <p
                            className="text-muted mx-auto mb-4"
                            style={{ maxWidth: "620px", whiteSpace: "pre-line", fontSize: "0.925rem", lineHeight: "1.6" }}
                        >
                            {activeGame.description || "Uji penguasaan konsep dan materi modul Anda melalui tantangan ini."}
                        </p>

                        <div className="card p-3 bg-light border-0 mx-auto mb-4 text-start shadow-sm" style={{ maxWidth: "440px" }}>
                            <div className="d-flex justify-content-between mb-2 small">
                                <span className="text-muted">Total Kesempatan:</span>
                                <strong>{maxAttempts} kali</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2 small">
                                <span className="text-muted">Percobaan Ini:</span>
                                <strong className="text-primary">Percobaan ke-{attemptsUsed + 1}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2 small">
                                <span className="text-muted">Reward Poin XP:</span>
                                <strong className="text-warning">+{activeGame.points_reward || 50} Poin</strong>
                            </div>
                            <div className="d-flex justify-content-between small">
                                <span className="text-muted">Batas Waktu:</span>
                                <strong>{activeGame.time_limit_seconds > 0 ? `${activeGame.time_limit_seconds} Detik` : "Tidak Dibatasi"}</strong>
                            </div>
                        </div>

                        <div className="d-flex align-items-center justify-content-center gap-2 text-muted small mb-4">
                            <i className="fas fa-headphones text-teal"></i>
                            <span>Musik latar & efek suara akan aktif otomatis saat permainan dimulai.</span>
                        </div>

                        {!hasAttempts ? (
                            <div className="alert alert-warning d-inline-block px-4 shadow-sm">
                                <i className="fas fa-exclamation-triangle me-2"></i>
                                Anda telah menggunakan seluruh {maxAttempts} kesempatan untuk game ini.
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn btn-teal px-5 py-2.5 fw-bold shadow-sm fs-6"
                                onClick={handleStartPlaying}
                            >
                                <i className="fas fa-play me-2"></i>
                                Mulai Permainan Sekarang
                            </button>
                        )}
                    </div>
                )}

                {/* STAGE 2: PLAYING MINI-GAME */}
                {gameStage === "playing" && (
                    <div className="game-arena-board-wrap">
                        {/* 1. Crossword */}
                        {activeGame.game_type === "crossword" && (
                            <div className="crossword-board-container">
                                <div className="crossword-clues-list">
                                    <div className="fw-bold small text-muted text-uppercase mb-2">Pilih Pertanyaan / Clue:</div>
                                    {(activeGame.game_data?.items || []).map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`crossword-clue-item ${activeClueIndex === idx ? "active" : ""}`}
                                            onClick={() => {
                                                setActiveClueIndex(idx);
                                                gameAudio.playSelect();
                                            }}
                                        >
                                            <strong>{idx + 1}.</strong> {item.clue}
                                            <span className="badge bg-light text-dark ms-2">({item.answer?.length || 0} Huruf)</span>
                                        </div>
                                    ))}
                                </div>

                                {activeGame.game_data?.items?.[activeClueIndex] && (
                                    <div className="card p-4 text-center bg-light border-0 shadow-sm rounded-3">
                                        <div className="small text-muted mb-1">
                                            Pertanyaan #{activeClueIndex + 1}:
                                        </div>
                                        <h6 className="fw-bold mb-3">{activeGame.game_data.items[activeClueIndex].clue}</h6>
                                        
                                        <div className="crossword-inputs-group mb-4">
                                            {Array.from({ length: activeGame.game_data.items[activeClueIndex].answer.length }).map((_, letterIdx) => {
                                                const currentVal = (crosswordAnswers[activeClueIndex] || "")[letterIdx] || "";
                                                return (
                                                    <input 
                                                        key={letterIdx}
                                                        id={`cw-arena-input-${activeClueIndex}-${letterIdx}`}
                                                        type="text"
                                                        maxLength={1}
                                                        className="crossword-cell-input"
                                                        value={currentVal.trim()}
                                                        onChange={(e) => handleCrosswordLetterChange(activeClueIndex, letterIdx, e.target.value)}
                                                    />
                                                );
                                            })}
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center">
                                            <button 
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                disabled={activeClueIndex === 0}
                                                onClick={() => {
                                                    setActiveClueIndex(prev => prev - 1);
                                                    gameAudio.playSelect();
                                                }}
                                            >
                                                <i className="fas fa-chevron-left me-1"></i>Sebelumnya
                                            </button>
                                            <button 
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                disabled={activeClueIndex >= activeGame.game_data.items.length - 1}
                                                onClick={() => {
                                                    setActiveClueIndex(prev => prev + 1);
                                                    gameAudio.playSelect();
                                                }}
                                            >
                                                Berikutnya<i className="fas fa-chevron-right ms-1"></i>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="text-end mt-3">
                                    <button 
                                        type="button" 
                                        className="btn btn-success fw-bold px-4 shadow-sm"
                                        onClick={submitCrossword}
                                    >
                                        <i className="fas fa-paper-plane me-2"></i>Selesai & Kumpulkan Jawaban
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 2. Word Search */}
                        {activeGame.game_type === "word_search" && (
                            <div className="wordsearch-layout">
                                <div>
                                    <div className="small text-muted mb-2">
                                        Klik huruf untuk memilih kata kunci yang tersembunyi di dalam papan:
                                    </div>
                                    <div className="wordsearch-grid">
                                        {wsGrid.map((row, r) => 
                                            row.map((char, c) => {
                                                const isSelected = wsSelectedCells.some(cell => cell.r === r && cell.c === c);
                                                return (
                                                    <div 
                                                        key={`${r}-${c}`}
                                                        className={`ws-cell ${isSelected ? "selected" : ""}`}
                                                        onClick={() => handleWsCellClick(r, c)}
                                                    >
                                                        {char}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="ws-words-panel">
                                    <h6 className="fw-bold mb-3">Kata yang Dicari:</h6>
                                    <div className="word-targets-list">
                                        {(activeGame.game_data?.words || []).map((w, idx) => {
                                            const wordStr = (typeof w === "object" ? w.word : w).toUpperCase();
                                            const isFound = wsFoundWords.includes(wordStr);
                                            return (
                                                <div key={idx} className={`ws-target-word ${isFound ? "found" : ""}`}>
                                                    <span>{wordStr}</span>
                                                    {isFound && <i className="fas fa-check text-success"></i>}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4">
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-secondary btn-sm w-100 mb-2" 
                                            onClick={() => {
                                                setWsSelectedCells([]);
                                                gameAudio.playTileDeselect();
                                            }}
                                        >
                                            Reset Seleksi
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn btn-success fw-bold w-100" 
                                            onClick={submitWordSearch}
                                        >
                                            Kumpulkan Hasil
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Anagram */}
                        {activeGame.game_type === "anagram" && currentAnagramItem && (
                            <div className="text-center py-2">
                                <div className="badge bg-secondary mb-2">
                                    Soal {anagramCurrentIdx + 1} dari {activeGame.game_data?.items?.length || 1}
                                </div>
                                <h5 className="fw-bold mb-1">{currentAnagramItem.clue || "Susun kata/frasa berikut"}</h5>
                                <p className="text-muted small mb-4">
                                    {anagramWordsBreakdown.length > 1
                                        ? `Susun frasa (${anagramWordsBreakdown.length} Kata). Klik huruf pada bank huruf untuk menyusun frasa yang tepat:`
                                        : "Klik huruf pada bank huruf untuk menyusun kata yang tepat:"}
                                </p>

                                {/* Multi-word Slots Container */}
                                <div className="anagram-words-container">
                                    {anagramWordsBreakdown.map((wGroup, wIdx) => (
                                        <div key={wIdx} className="anagram-word-group">
                                            <div className="anagram-slots">
                                                {wGroup.slots.map((s) => {
                                                    const placedLetter = anagramUserLetters[s.slotIdx];
                                                    return (
                                                        <div 
                                                            key={s.slotIdx} 
                                                            className={`anagram-slot ${placedLetter ? "filled" : ""}`}
                                                            onClick={() => placedLetter && handleRemoveAnagramLetter(s.slotIdx)}
                                                            title={placedLetter ? "Klik untuk membatalkan huruf" : ""}
                                                        >
                                                            {placedLetter?.char || ""}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {/* Space separator indicator between words */}
                                            {wIdx < anagramWordsBreakdown.length - 1 && (
                                                <div className="anagram-word-spacer" title="Pemisah Spasi Antarkata">
                                                    <span className="badge">Spasi</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Scrambled letter tiles */}
                                <div className="anagram-letter-bank">
                                    {scrambledLetters.map((lObj) => {
                                        const isUsed = anagramUserLetters.some(item => item.id === lObj.id);
                                        return (
                                            <button 
                                                key={lObj.id} 
                                                type="button"
                                                className={`anagram-tile ${isUsed ? "disabled" : ""}`}
                                                disabled={isUsed}
                                                onClick={() => handleSelectAnagramLetter(lObj)}
                                            >
                                                {lObj.char}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="d-flex justify-content-center gap-2 mt-4">
                                    <button 
                                        type="button"
                                        className="btn btn-light px-3"
                                        onClick={() => {
                                            setAnagramUserLetters([]);
                                            gameAudio.playTileRemove();
                                        }}
                                    >
                                        Reset Huruf
                                    </button>
                                    <button 
                                        type="button"
                                        className="btn btn-primary px-4 fw-bold"
                                        disabled={anagramUserLetters.length < totalAnagramLettersCount}
                                        onClick={handleCheckAnagramWord}
                                    >
                                        Cek & Lanjut <i className="fas fa-arrow-right ms-1"></i>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 4. Memory Match with 3D Flip & Truncate Hover Popover */}
                        {activeGame.game_type === "memory_match" && (
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div className="small text-muted">
                                        Cocokkan kartu istilah dan definisinya. Langkah: <strong>{memoryMoves}</strong>
                                    </div>
                                    <div className="badge bg-success-subtle text-success">
                                        {matchedCardIds.length / 2} / {memoryCards.length / 2} Pasangan Cocok
                                    </div>
                                </div>

                                <div className="memory-grid">
                                    {memoryCards.map((card) => {
                                        const isFlipped = flippedCards.some(c => c.id === card.id);
                                        const isMatched = matchedCardIds.includes(card.id);
                                        const isOpen = isFlipped || isMatched;

                                        return (
                                            <div 
                                                key={card.id}
                                                className="memory-card-wrap"
                                                onClick={() => handleMemoryCardClick(card)}
                                            >
                                                <div 
                                                    className={`memory-card-inner ${isOpen ? "is-flipped" : ""} ${isMatched ? "is-matched" : ""}`}
                                                >
                                                    {/* Front Face: Covered question mark */}
                                                    <div className="memory-card-face face-front">
                                                        <i className="fas fa-question-circle"></i>
                                                    </div>

                                                    {/* Back Face: Revealed Content */}
                                                    <div className="memory-card-face face-back" title={card.content}>
                                                        <div className="memory-card-type-badge">
                                                            {card.type === "term" ? "Istilah" : "Definisi"}
                                                        </div>
                                                        <div className="memory-card-content">
                                                            <span className="memory-card-text">{card.content}</span>
                                                        </div>

                                                        {/* Hover Popover showing complete text when long */}
                                                        {card.content.length > 25 && (
                                                            <div className="memory-card-hover-popover">
                                                                <div className="small fw-bold text-teal mb-1">
                                                                    {card.type === "term" ? "Istilah Lengkap:" : "Definisi Lengkap:"}
                                                                </div>
                                                                <div>{card.content}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STAGE 3: RESULT SCREEN */}
                {gameStage === "completed" && (
                    <div className="text-center py-4 game-arena-board-wrap">
                        <div className={`game-result-score-circle ${(submissionResult?.score || 0) >= 70 ? "passed" : "failed"}`}>
                            {submissionResult?.score ?? 0}%
                        </div>
                        <h4 className="fw-bold text-dark">
                            {(submissionResult?.score || 0) >= 70 ? "Luar Biasa, Berhasil!" : "Permainan Selesai!"}
                        </h4>
                        
                        <p className="text-muted mx-auto" style={{ maxWidth: "520px" }}>
                            {submissionResult?.is_passed 
                                ? "Selamat! Anda berhasil menuntaskan materi tantangan ini dengan baik." 
                                : "Terima kasih telah mencoba. Pelajari kembali materi modul dan coba lagi!"}
                        </p>

                        <div className="card p-3 bg-light border-0 mx-auto my-4 text-start shadow-sm" style={{ maxWidth: "380px" }}>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Poin Diperoleh:</span>
                                <strong className="text-success">+{submissionResult?.points_awarded || 0} XP</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <span className="text-muted">Waktu Pengerjaan:</span>
                                <strong>{timerSeconds} Detik</strong>
                            </div>
                            <div className="d-flex justify-content-between">
                                <span className="text-muted">Sisa Kesempatan:</span>
                                <strong className="text-danger">{submissionResult?.attempts_left ?? 0} Kali</strong>
                            </div>
                        </div>

                        <div className="d-flex justify-content-center gap-3">
                            {(submissionResult?.attempts_left > 0) && (
                                <button 
                                    type="button" 
                                    className="btn btn-outline-primary px-4 fw-bold"
                                    onClick={handleStartPlaying}
                                >
                                    <i className="fas fa-redo me-1"></i>Coba Lagi ({submissionResult?.attempts_left} sisa)
                                </button>
                            )}
                            <button 
                                type="button" 
                                className="btn btn-primary px-4 fw-bold shadow-sm"
                                onClick={handleCloseArena}
                            >
                                Kembali ke Daftar Game
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GamePlayer;
