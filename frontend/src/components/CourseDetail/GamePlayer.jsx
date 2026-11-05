import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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


// ==========================================
// TRUE INTERSECTING CROSSWORD (TTS) GENERATOR
// ==========================================
const generateCrosswordGrid = (items) => {
    if (!items || items.length === 0) return null;

    const cleanedItems = items.map((item, originalIndex) => ({
        originalIndex,
        clue: item.clue || "",
        answer: (item.answer || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
    })).filter(it => it.answer.length >= 2);

    if (cleanedItems.length === 0) return null;

    // Sort by length descending for best intersections
    const sorted = [...cleanedItems].sort((a, b) => b.answer.length - a.answer.length);

    const grid = {}; // 'r,c' -> char
    const placed = []; // [{ item, row, col, direction, wordId }]

    const canPlace = (word, startR, startC, direction) => {
        const dr = direction === 'across' ? 0 : 1;
        const dc = direction === 'across' ? 1 : 0;
        const pr = direction === 'across' ? 1 : 0;
        const pc = direction === 'across' ? 0 : 1;

        // Check cell before
        if (grid[(startR - dr) + ',' + (startC - dc)] !== undefined) return false;
        // Check cell after
        if (grid[(startR + word.length * dr) + ',' + (startC + word.length * dc)] !== undefined) return false;

        let intersections = 0;
        for (let i = 0; i < word.length; i++) {
            const r = startR + i * dr;
            const c = startC + i * dc;
            const existing = grid[r + ',' + c];

            if (existing !== undefined) {
                if (existing !== word[i]) return false;
                intersections++;
            } else {
                // Must not touch adjacent cells on perpendicular axis
                if (grid[(r + pr) + ',' + (c + pc)] !== undefined) return false;
                if (grid[(r - pr) + ',' + (c - pc)] !== undefined) return false;
            }
        }
        return intersections;
    };

    // Place first word across at 0, 0
    const first = sorted[0];
    for (let i = 0; i < first.answer.length; i++) {
        grid['0,' + i] = first.answer[i];
    }
    placed.push({ item: first, row: 0, col: 0, direction: 'across', wordId: 0 });

    // Place remaining words
    for (let sIdx = 1; sIdx < sorted.length; sIdx++) {
        const target = sorted[sIdx];
        const word = target.answer;
        let best = null;
        let bestScore = -99999;

        for (const p of placed) {
            const pWord = p.item.answer;
            const candDir = p.direction === 'across' ? 'down' : 'across';
            const pDr = p.direction === 'across' ? 0 : 1;
            const pDc = p.direction === 'across' ? 1 : 0;
            const cDr = candDir === 'across' ? 0 : 1;
            const cDc = candDir === 'across' ? 1 : 0;

            for (let pi = 0; pi < pWord.length; pi++) {
                for (let wi = 0; wi < word.length; wi++) {
                    if (pWord[pi] === word[wi]) {
                        const intR = p.row + pi * pDr;
                        const intC = p.col + pi * pDc;

                        const candR = intR - wi * cDr;
                        const candC = intC - wi * cDc;

                        const inter = canPlace(word, candR, candC, candDir);
                        if (inter !== false && inter > 0) {
                            const score = inter * 30 - (Math.abs(candR) + Math.abs(candC));
                            if (score > bestScore) {
                                bestScore = score;
                                best = { item: target, row: candR, col: candC, direction: candDir, wordId: sIdx };
                            }
                        }
                    }
                }
            }
        }

        if (!best) {
            // Fallback: place parallel with gap
            let maxR = -9999;
            for (const key of Object.keys(grid)) {
                const r = parseInt(key.split(',')[0], 10);
                if (r > maxR) maxR = r;
            }
            best = { item: target, row: maxR + 2, col: 0, direction: 'across', wordId: sIdx };
        }

        const dr = best.direction === 'across' ? 0 : 1;
        const dc = best.direction === 'across' ? 1 : 0;
        for (let i = 0; i < word.length; i++) {
            grid[(best.row + i * dr) + ',' + (best.col + i * dc)] = word[i];
        }
        placed.push(best);
    }

    // Find bounding box
    let minR = 9999, maxR = -9999, minC = 9999, maxC = -9999;
    for (const key of Object.keys(grid)) {
        const [r, c] = key.split(',').map(Number);
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
    }

    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;

    // Shift coordinates so minR = 0, minC = 0
    placed.forEach(p => {
        p.row -= minR;
        p.col -= minC;
    });

    // Create 2D matrix
    const matrix = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            isBlock: true,
            char: '',
            number: null,
            acrossWordId: null,
            downWordId: null
        }))
    );

    placed.forEach(p => {
        const dr = p.direction === 'across' ? 0 : 1;
        const dc = p.direction === 'across' ? 1 : 0;
        for (let i = 0; i < p.item.answer.length; i++) {
            const r = p.row + i * dr;
            const c = p.col + i * dc;
            matrix[r][c].isBlock = false;
            matrix[r][c].char = p.item.answer[i];
            if (p.direction === 'across') {
                matrix[r][c].acrossWordId = p.wordId;
            } else {
                matrix[r][c].downWordId = p.wordId;
            }
        }
    });

    // Assign Clue Numbers
    let clueCounter = 1;
    const acrossClues = [];
    const downClues = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (matrix[r][c].isBlock) continue;

            const acrossWord = placed.find(p => p.direction === 'across' && p.row === r && p.col === c);
            const downWord = placed.find(p => p.direction === 'down' && p.row === r && p.col === c);

            if (acrossWord || downWord) {
                matrix[r][c].number = clueCounter;
                if (acrossWord) {
                    acrossWord.number = clueCounter;
                    acrossClues.push({
                        number: clueCounter,
                        wordId: acrossWord.wordId,
                        clue: acrossWord.item.clue,
                        answer: acrossWord.item.answer,
                        row: acrossWord.row,
                        col: acrossWord.col,
                        length: acrossWord.item.answer.length,
                        direction: 'across'
                    });
                }
                if (downWord) {
                    downWord.number = clueCounter;
                    downClues.push({
                        number: clueCounter,
                        wordId: downWord.wordId,
                        clue: downWord.item.clue,
                        answer: downWord.item.answer,
                        row: downWord.row,
                        col: downWord.col,
                        length: downWord.item.answer.length,
                        direction: 'down'
                    });
                }
                clueCounter++;
            }
        }
    }

    return {
        rows,
        cols,
        matrix,
        placedWords: placed,
        acrossClues,
        downClues,
        allClues: [...acrossClues, ...downClues].sort((a, b) => a.number - b.number)
    };
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
    const [isFullscreen, setIsFullscreen] = useState(false);
    const arenaCardRef = useRef(null);

    // Mini-game specific states
    // 1. Crossword (True Intersecting Teka Teki Silang)
    const [crosswordLayout, setCrosswordLayout] = useState(null);
    const [crosswordGridValues, setCrosswordGridValues] = useState({}); // `${r}_${c}` -> char
    const [activeCell, setActiveCell] = useState(null); // { r, c }
    const [activeWordId, setActiveWordId] = useState(null);
    const [activeDirection, setActiveDirection] = useState("across");
    const hiddenInputRef = useRef(null);

    // 2. Word Search
    const [wsGrid, setWsGrid] = useState([]);
    const [wsFoundWords, setWsFoundWords] = useState([]);
    const [wsSelectedCells, setWsSelectedCells] = useState([]);
    const [wsFoundCells, setWsFoundCells] = useState([]);

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

    // Fullscreen toggle handler
    const handleToggleFullscreen = () => {
        if (!arenaCardRef.current) return;
        const elem = arenaCardRef.current;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(() => {
                    setIsFullscreen(true);
                });
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else {
                setIsFullscreen(prev => !prev);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            setIsFullscreen(false);
        }
    };

    // Fullscreen change listener (sync state when user presses Esc)
    useEffect(() => {
        const onFsChange = () => {
            const isFs = Boolean(
                document.fullscreenElement ||
                document.webkitFullscreenElement
            );
            setIsFullscreen(isFs);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            document.removeEventListener('webkitfullscreenchange', onFsChange);
        };
    }, []);

    const handleCloseArena = () => {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
        setIsFullscreen(false);
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
            setWsFoundCells([]);
            setCrosswordLayout(null);
            setCrosswordGridValues({});
            setActiveCell(null);
            setActiveWordId(null);
            setActiveDirection("across");
        }
    }, [activeGame?.game_id]);

    // Auto-focus hidden input when crossword game starts so first click won't cause focus/layout jump
    useEffect(() => {
        if (gameStage === "playing" && activeGame?.game_type === "crossword") {
            const t = setTimeout(() => {
                hiddenInputRef.current?.focus({ preventScroll: true });
            }, 80);
            return () => clearTimeout(t);
        }
    }, [gameStage, activeGame?.game_type]);

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
            const layout = generateCrosswordGrid(items);
            setCrosswordLayout(layout);
            setCrosswordGridValues({});
            if (layout && layout.placedWords.length > 0) {
                const firstWord = layout.acrossClues[0] || layout.downClues[0] || layout.placedWords[0];
                setActiveWordId(firstWord.wordId);
                setActiveDirection(firstWord.direction);
                setActiveCell({ r: firstWord.row, c: firstWord.col });
            }
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

    // Helper: Calculate straight-line coordinates between two cells (horizontal, vertical, diagonal)
    const getCellsBetween = (cellA, cellB) => {
        if (!cellA || !cellB) return null;
        const dr = cellB.r - cellA.r;
        const dc = cellB.c - cellA.c;
        const absR = Math.abs(dr);
        const absC = Math.abs(dc);

        if (dr === 0 && dc === 0) return [cellA];
        // Straight line check: same row, same col, or exact 45-deg diagonal
        if (dr !== 0 && dc !== 0 && absR !== absC) {
            return null;
        }

        const steps = Math.max(absR, absC);
        const stepR = dr === 0 ? 0 : (dr > 0 ? 1 : -1);
        const stepC = dc === 0 ? 0 : (dc > 0 ? 1 : -1);

        const cells = [];
        for (let i = 0; i <= steps; i++) {
            cells.push({
                r: cellA.r + i * stepR,
                c: cellA.c + i * stepC
            });
        }
        return cells;
    };

    // Helper: Init Word Search (supports 8 directions: horizontal, vertical, diagonal, and reverse)
    const initWordSearch = (wordsList) => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        const validWords = wordsList
            .map(w => (typeof w === "object" ? w.word : w).toUpperCase().replace(/[^A-Z]/g, ""))
            .filter(Boolean);

        if (validWords.length === 0) {
            setWsGrid([]);
            setWsFoundWords([]);
            setWsSelectedCells([]);
            setWsFoundCells([]);
            return;
        }

        // 8 directions: horizontal, vertical, diagonal down, diagonal up, and reverse
        const WS_DIRECTIONS = [
            { name: "horizontal", dr: 0, dc: 1 },
            { name: "horizontal_rev", dr: 0, dc: -1 },
            { name: "vertical", dr: 1, dc: 0 },
            { name: "vertical_rev", dr: -1, dc: 0 },
            { name: "diagonal_down_right", dr: 1, dc: 1 },
            { name: "diagonal_down_left", dr: 1, dc: -1 },
            { name: "diagonal_up_right", dr: -1, dc: 1 },
            { name: "diagonal_up_left", dr: -1, dc: -1 },
        ];

        const getRandomCoord = (dirComponent, wordLen, gridSize) => {
            if (dirComponent === 1) {
                const maxStart = gridSize - wordLen;
                return Math.floor(Math.random() * (maxStart + 1));
            } else if (dirComponent === -1) {
                const minStart = wordLen - 1;
                return minStart + Math.floor(Math.random() * (gridSize - minStart));
            } else {
                return Math.floor(Math.random() * gridSize);
            }
        };

        const maxLen = Math.max(...validWords.map(w => w.length));
        // Dynamic grid size: accommodates words longer than 10 characters with breathing space
        const size = Math.max(12, maxLen <= 10 ? 12 : maxLen + 1);

        // Sort longest words first for optimal placement without collisions
        const sortedWords = [...validWords].sort((a, b) => b.length - a.length);
        const grid = Array(size).fill(null).map(() => Array(size).fill(""));

        // Direction usage tracking to encourage balanced variety across all 8 directions
        const dirUsage = {};
        WS_DIRECTIONS.forEach(d => { dirUsage[d.name] = 0; });

        sortedWords.forEach((word) => {
            let placed = false;

            // Prioritize less-used directions with random jitter
            const candidateDirs = [...WS_DIRECTIONS].sort((a, b) => {
                return (dirUsage[a.name] - dirUsage[b.name]) + (Math.random() - 0.5) * 1.5;
            });

            for (const dir of candidateDirs) {
                for (let tries = 0; tries < 60; tries++) {
                    const row = getRandomCoord(dir.dr, word.length, size);
                    const col = getRandomCoord(dir.dc, word.length, size);

                    let canPlace = true;
                    for (let i = 0; i < word.length; i++) {
                        const r = row + i * dir.dr;
                        const c = col + i * dir.dc;
                        if (grid[r][c] !== "" && grid[r][c] !== word[i]) {
                            canPlace = false;
                            break;
                        }
                    }

                    if (canPlace) {
                        for (let i = 0; i < word.length; i++) {
                            grid[row + i * dir.dr][col + i * dir.dc] = word[i];
                        }
                        placed = true;
                        dirUsage[dir.name]++;
                        break;
                    }
                }
                if (placed) break;
            }

            // Fallback: systematic scan across entire grid if random search did not find spot
            if (!placed) {
                outer:
                for (let r = 0; r < size; r++) {
                    for (let c = 0; c < size; c++) {
                        for (const dir of WS_DIRECTIONS) {
                            const endRow = r + (word.length - 1) * dir.dr;
                            const endCol = c + (word.length - 1) * dir.dc;
                            if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

                            let canPlace = true;
                            for (let i = 0; i < word.length; i++) {
                                const curR = r + i * dir.dr;
                                const curC = c + i * dir.dc;
                                if (grid[curR][curC] !== "" && grid[curR][curC] !== word[i]) {
                                    canPlace = false;
                                    break;
                                }
                            }
                            if (canPlace) {
                                for (let i = 0; i < word.length; i++) {
                                    grid[r + i * dir.dr][c + i * dir.dc] = word[i];
                                }
                                placed = true;
                                dirUsage[dir.name]++;
                                break outer;
                            }
                        }
                    }
                }
            }
        });

        // Fill empty spaces with random uppercase letters
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
        setWsFoundCells([]);
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

    // 1. True Crossword (Teka Teki Silang) Handlers & Helpers
    const activeClue = useMemo(() => {
        if (!crosswordLayout || activeWordId === null) return null;
        return (
            crosswordLayout.acrossClues.find(c => c.wordId === activeWordId && c.direction === activeDirection) ||
            crosswordLayout.downClues.find(c => c.wordId === activeWordId && c.direction === activeDirection) ||
            crosswordLayout.acrossClues.find(c => c.wordId === activeWordId) ||
            crosswordLayout.downClues.find(c => c.wordId === activeWordId)
        );
    }, [crosswordLayout, activeWordId, activeDirection]);

    const activeWordCellsSet = useMemo(() => {
        const set = new Set();
        if (!crosswordLayout || activeWordId === null) return set;
        const activeWord = crosswordLayout.placedWords.find(p => p.wordId === activeWordId);
        if (!activeWord) return set;

        const dr = activeWord.direction === "across" ? 0 : 1;
        const dc = activeWord.direction === "across" ? 1 : 0;
        for (let i = 0; i < activeWord.item.answer.length; i++) {
            set.add(`${activeWord.row + i * dr}_${activeWord.col + i * dc}`);
        }
        return set;
    }, [crosswordLayout, activeWordId]);

    const isWordCorrect = useCallback((word) => {
        const dr = word.direction === "across" ? 0 : 1;
        const dc = word.direction === "across" ? 1 : 0;
        for (let i = 0; i < word.item.answer.length; i++) {
            const r = word.row + i * dr;
            const c = word.col + i * dc;
            if ((crosswordGridValues[`${r}_${c}`] || "").trim() !== word.item.answer[i]) {
                return false;
            }
        }
        return true;
    }, [crosswordGridValues]);

    const isWordFilled = useCallback((word) => {
        const dr = word.direction === "across" ? 0 : 1;
        const dc = word.direction === "across" ? 1 : 0;
        for (let i = 0; i < word.item.answer.length; i++) {
            const r = word.row + i * dr;
            const c = word.col + i * dc;
            if (!(crosswordGridValues[`${r}_${c}`] || "").trim()) {
                return false;
            }
        }
        return true;
    }, [crosswordGridValues]);

    const solvedWordsCount = useMemo(() => {
        if (!crosswordLayout) return 0;
        return crosswordLayout.placedWords.filter(isWordFilled).length;
    }, [crosswordLayout, isWordFilled]);

    const handleCellInput = (char) => {
        if (!activeCell || !crosswordLayout) return;
        const upper = char.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!upper) return;

        gameAudio.playKeyTick();
        const cellKey = `${activeCell.r}_${activeCell.c}`;
        setCrosswordGridValues(prev => ({
            ...prev,
            [cellKey]: upper[0]
        }));

        // Advance cursor to next cell in the active word
        const activeWord = crosswordLayout.placedWords.find(p => p.wordId === activeWordId);
        if (activeWord) {
            const dr = activeWord.direction === "across" ? 0 : 1;
            const dc = activeWord.direction === "across" ? 1 : 0;
            for (let i = 0; i < activeWord.item.answer.length - 1; i++) {
                const curR = activeWord.row + i * dr;
                const curC = activeWord.col + i * dc;
                if (curR === activeCell.r && curC === activeCell.c) {
                    setActiveCell({ r: activeWord.row + (i + 1) * dr, c: activeWord.col + (i + 1) * dc });
                    break;
                }
            }
        }
    };

    const handleCellBackspace = () => {
        if (!activeCell || !crosswordLayout) return;
        const cellKey = `${activeCell.r}_${activeCell.c}`;
        const activeWord = crosswordLayout.placedWords.find(p => p.wordId === activeWordId);

        if (crosswordGridValues[cellKey]) {
            setCrosswordGridValues(prev => {
                const next = { ...prev };
                delete next[cellKey];
                return next;
            });
        } else if (activeWord) {
            const dr = activeWord.direction === "across" ? 0 : 1;
            const dc = activeWord.direction === "across" ? 1 : 0;
            for (let i = 1; i < activeWord.item.answer.length; i++) {
                const curR = activeWord.row + i * dr;
                const curC = activeWord.col + i * dc;
                if (curR === activeCell.r && curC === activeCell.c) {
                    const prevR = activeWord.row + (i - 1) * dr;
                    const prevC = activeWord.col + (i - 1) * dc;
                    setActiveCell({ r: prevR, c: prevC });
                    setCrosswordGridValues(prev => {
                        const next = { ...prev };
                        delete next[`${prevR}_${prevC}`];
                        return next;
                    });
                    break;
                }
            }
        }
    };

    const handleKeyDown = (e) => {
        if (!activeCell || !crosswordLayout) return;
        const { r, c } = activeCell;

        if (e.key === "Backspace") {
            e.preventDefault();
            handleCellBackspace();
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            if (c + 1 < crosswordLayout.cols && !crosswordLayout.matrix[r][c + 1].isBlock) {
                setActiveCell({ r, c: c + 1 });
                const cellAcrossWord = crosswordLayout.placedWords.find(p => p.direction === "across" && p.row === r && c + 1 >= p.col && c + 1 < p.col + p.item.answer.length);
                if (cellAcrossWord) {
                    setActiveDirection("across");
                    setActiveWordId(cellAcrossWord.wordId);
                }
            }
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (c - 1 >= 0 && !crosswordLayout.matrix[r][c - 1].isBlock) {
                setActiveCell({ r, c: c - 1 });
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (r + 1 < crosswordLayout.rows && !crosswordLayout.matrix[r + 1][c].isBlock) {
                setActiveCell({ r: r + 1, c });
                const cellDownWord = crosswordLayout.placedWords.find(p => p.direction === "down" && p.col === c && r + 1 >= p.row && r + 1 < p.row + p.item.answer.length);
                if (cellDownWord) {
                    setActiveDirection("down");
                    setActiveWordId(cellDownWord.wordId);
                }
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (r - 1 >= 0 && !crosswordLayout.matrix[r - 1][c].isBlock) {
                setActiveCell({ r: r - 1, c });
            }
        } else if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            cycleClue(e.shiftKey ? -1 : 1);
        } else if (/^[a-zA-Z0-9]$/.test(e.key)) {
            e.preventDefault();
            handleCellInput(e.key);
        }
    };

    const handleCellClick = (r, c) => {
        if (!crosswordLayout) return;
        const cell = crosswordLayout.matrix[r][c];
        if (cell.isBlock) return;

        gameAudio.playTileSelect();

        // If clicking already active cell and it's an intersection:
        if (activeCell && activeCell.r === r && activeCell.c === c) {
            if (cell.acrossWordId !== null && cell.downWordId !== null) {
                const nextDir = activeDirection === "across" ? "down" : "across";
                const nextWordId = nextDir === "across" ? cell.acrossWordId : cell.downWordId;
                setActiveDirection(nextDir);
                setActiveWordId(nextWordId);
                hiddenInputRef.current?.focus({ preventScroll: true });
                return;
            }
        }

        setActiveCell({ r, c });

        if (activeDirection === "across" && cell.acrossWordId !== null) {
            setActiveWordId(cell.acrossWordId);
        } else if (activeDirection === "down" && cell.downWordId !== null) {
            setActiveWordId(cell.downWordId);
        } else if (cell.acrossWordId !== null) {
            setActiveDirection("across");
            setActiveWordId(cell.acrossWordId);
        } else if (cell.downWordId !== null) {
            setActiveDirection("down");
            setActiveWordId(cell.downWordId);
        }

        hiddenInputRef.current?.focus({ preventScroll: true });
    };

    const handleClueSelect = (clue) => {
        gameAudio.playSelect();
        setActiveWordId(clue.wordId);
        setActiveDirection(clue.direction);

        const dr = clue.direction === "across" ? 0 : 1;
        const dc = clue.direction === "across" ? 1 : 0;
        let targetCell = { r: clue.row, c: clue.col };

        for (let i = 0; i < clue.length; i++) {
            const curR = clue.row + i * dr;
            const curC = clue.col + i * dc;
            if (!crosswordGridValues[`${curR}_${curC}`]) {
                targetCell = { r: curR, c: curC };
                break;
            }
        }

        setActiveCell(targetCell);
        hiddenInputRef.current?.focus({ preventScroll: true });
    };

    const cycleClue = (delta) => {
        if (!crosswordLayout || !crosswordLayout.allClues?.length) return;
        const currentIdx = crosswordLayout.allClues.findIndex(
            c => c.wordId === activeWordId && c.direction === activeDirection
        );
        let nextIdx = (currentIdx + delta + crosswordLayout.allClues.length) % crosswordLayout.allClues.length;
        const nextClue = crosswordLayout.allClues[nextIdx];
        if (nextClue) {
            handleClueSelect(nextClue);
        }
    };

    const clearActiveWord = () => {
        if (!crosswordLayout || activeWordId === null) return;
        const activeWord = crosswordLayout.placedWords.find(p => p.wordId === activeWordId);
        if (!activeWord) return;

        const dr = activeWord.direction === "across" ? 0 : 1;
        const dc = activeWord.direction === "across" ? 1 : 0;
        setCrosswordGridValues(prev => {
            const next = { ...prev };
            for (let i = 0; i < activeWord.item.answer.length; i++) {
                delete next[`${activeWord.row + i * dr}_${activeWord.col + i * dc}`];
            }
            return next;
        });
        setActiveCell({ r: activeWord.row, c: activeWord.col });
        hiddenInputRef.current?.focus({ preventScroll: true });
    };

    const submitCrossword = () => {
        if (!crosswordLayout) return;
        const totalWords = crosswordLayout.placedWords.length;
        let correctCount = 0;

        crosswordLayout.placedWords.forEach(w => {
            if (isWordCorrect(w)) {
                correctCount++;
            }
        });

        const score = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;
        finalizeAttempt(score);
    };

    // 2. Word Search Handlers (supports first-to-last letter line selection and letter-by-letter)
    const handleWsCellClick = (r, c) => {
        const clickedCell = { r, c, char: wsGrid[r][c] };
        const targetWords = (activeGame.game_data?.words || []).map(w => 
            (typeof w === "object" ? w.word : w).toUpperCase().replace(/[^A-Z]/g, "")
        ).filter(Boolean);

        // Case 1: Active selection exists
        if (wsSelectedCells.length > 0) {
            // Clicking the only selected cell again -> deselect
            if (wsSelectedCells.length === 1 && wsSelectedCells[0].r === r && wsSelectedCells[0].c === c) {
                setWsSelectedCells([]);
                gameAudio.playTileDeselect();
                return;
            }

            const startCell = wsSelectedCells[0];
            const lineCells = getCellsBetween(startCell, clickedCell);

            if (lineCells) {
                const newSelection = lineCells.map(pos => ({
                    r: pos.r,
                    c: pos.c,
                    char: wsGrid[pos.r][pos.c]
                }));

                const formedWord = newSelection.map(cell => cell.char).join("");
                const reverseFormed = formedWord.split("").reverse().join("");

                const matchedWord = targetWords.find(w => 
                    (w === formedWord || w === reverseFormed) && !wsFoundWords.includes(w)
                );

                if (matchedWord) {
                    const updatedFound = [...wsFoundWords, matchedWord];
                    setWsFoundWords(updatedFound);

                    // Mark all cells in this line permanently as found
                    setWsFoundCells(prev => {
                        const newCoords = newSelection.map(cell => ({ r: cell.r, c: cell.c }));
                        const existingKeys = new Set(prev.map(p => `${p.r}-${p.c}`));
                        const toAdd = newCoords.filter(coord => !existingKeys.has(`${coord.r}-${coord.c}`));
                        return [...prev, ...toAdd];
                    });

                    setWsSelectedCells([]);
                    gameAudio.playWordFound();
                    Toast().fire({ icon: "success", title: `Kata ditemukan: ${matchedWord}!` });

                    if (updatedFound.length >= targetWords.length) {
                        finalizeAttempt(100);
                    }
                    return;
                } else {
                    // Update active selection path along the straight line
                    setWsSelectedCells(newSelection);
                    gameAudio.playTileSelect();
                    return;
                }
            }
        }

        // Case 2: Start new selection
        setWsSelectedCells([clickedCell]);
        gameAudio.playTileSelect();
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
        <div ref={arenaCardRef} className={`game-player-arena-card ${isFullscreen ? "is-fullscreen" : ""}`}>

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
                        className={`btn-fullscreen-toggle ${isFullscreen ? "active" : ""}`}
                        onClick={handleToggleFullscreen}
                        title={isFullscreen ? "Keluar Layar Penuh (Esc)" : "Mode Layar Penuh"}
                        aria-label="Toggle Fullscreen"
                    >
                        <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}></i>
                        <span className="d-none d-sm-inline">
                            {isFullscreen ? "Normal" : "Layar Penuh"}
                        </span>
                    </button>

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
                        {/* 1. True Intersecting Crossword (Teka Teki Silang) */}
                        {activeGame.game_type === "crossword" && (
                            <div className="crossword-board-container">
                                {/* Active Clue Banner with Controls */}
                                {activeClue && (
                                    <div className="cw-active-clue-banner shadow-sm">
                                        <div className="cw-clue-banner-left">
                                            <span className={`badge ${activeClue.direction === 'across' ? 'bg-primary' : 'bg-info text-dark'} px-2 py-1 flex-shrink-0`}>
                                                <i className={`fas ${activeClue.direction === 'across' ? 'fa-arrows-alt-h' : 'fa-arrows-alt-v'} me-1`}></i>
                                                {activeClue.number} {activeClue.direction === 'across' ? 'Mendatar' : 'Menurun'}
                                            </span>
                                            <span className="cw-active-clue-text" title={activeClue.clue}>
                                                {activeClue.clue}
                                            </span>
                                            <span className="badge bg-light text-muted border flex-shrink-0">
                                                {activeClue.length} Huruf
                                            </span>
                                        </div>
                                        <div className="cw-clue-banner-right">
                                            <button
                                                type="button"
                                                className="cw-clue-nav-btn"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => cycleClue(-1)}
                                                title="Pertanyaan Sebelumnya"
                                                aria-label="Pertanyaan Sebelumnya"
                                            >
                                                <i className="fas fa-chevron-left"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="cw-clue-nav-btn"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => cycleClue(1)}
                                                title="Pertanyaan Berikutnya"
                                                aria-label="Pertanyaan Berikutnya"
                                            >
                                                <i className="fas fa-chevron-right"></i>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Main Crossword Layout: Board + Clues Panel */}
                                <div className="cw-main-layout mt-3">
                                    {/* Left Side: Interlocking Grid */}
                                    <div className="cw-board-wrapper">
                                        <input
                                            ref={hiddenInputRef}
                                            type="text"
                                            className="cw-hidden-input"
                                            value=""
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val) {
                                                    handleCellInput(val[val.length - 1]);
                                                }
                                            }}
                                            onKeyDown={handleKeyDown}
                                            autoComplete="off"
                                            autoCorrect="off"
                                            autoCapitalize="characters"
                                            spellCheck="false"
                                        />

                                        <div 
                                            className="cw-grid-table-container"
                                            tabIndex={0}
                                            onKeyDown={handleKeyDown}
                                        >
                                            <div 
                                                className="cw-grid-table"
                                                style={{
                                                    gridTemplateColumns: `repeat(${crosswordLayout?.cols || 1}, 1fr)`,
                                                    maxWidth: `${(crosswordLayout?.cols || 1) * 44}px`
                                                }}
                                            >
                                                {crosswordLayout?.matrix.map((row, r) => 
                                                    row.map((cell, c) => {
                                                        const key = `${r}_${c}`;
                                                        if (cell.isBlock) {
                                                            return <div key={key} className="cw-cell cw-block-cell" />;
                                                        }

                                                        const isWordActive = activeWordCellsSet.has(key);
                                                        const isCursorActive = activeCell?.r === r && activeCell?.c === c;
                                                        const userChar = crosswordGridValues[key] || "";

                                                        return (
                                                            <div
                                                                key={key}
                                                                className={`cw-cell cw-letter-cell ${isWordActive ? "cw-word-active" : ""} ${isCursorActive ? "cw-cursor-active" : ""}`}
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => handleCellClick(r, c)}
                                                            >
                                                                {cell.number && (
                                                                    <span className="cw-number-tag">{cell.number}</span>
                                                                )}
                                                                <span className="cw-char-val">{userChar}</span>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        <div className="cw-sub-controls d-flex justify-content-between align-items-center mt-2 px-1">
                                            <span className="small text-muted">
                                                <i className="fas fa-keyboard me-1 text-primary"></i>
                                                Ketik huruf atau klik sel kotak untuk mengisi
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger border-0 py-0 px-2"
                                                onClick={clearActiveWord}
                                                title="Kosongkan kata yang sedang dipilih"
                                            >
                                                <i className="fas fa-eraser me-1"></i>Hapus Kata
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Side: Clues Lists */}
                                    <div className="cw-clues-wrapper">
                                        {/* Mendatar (Across) */}
                                        <div className="cw-clues-column mb-3">
                                            <div className="cw-clues-header d-flex align-items-center gap-2 mb-2">
                                                <i className="fas fa-arrows-alt-h text-primary"></i>
                                                <span className="fw-bold small text-uppercase">Mendatar</span>
                                            </div>
                                            <div className="cw-clues-scroll-list">
                                                {crosswordLayout?.acrossClues.map(clue => {
                                                    const isSelected = activeWordId === clue.wordId && activeDirection === "across";
                                                    const wordObj = crosswordLayout.placedWords.find(p => p.wordId === clue.wordId);
                                                    const isFilled = wordObj ? isWordFilled(wordObj) : false;

                                                    return (
                                                        <div
                                                            key={`across-${clue.number}`}
                                                            className={`cw-clue-item ${isSelected ? "active" : ""} ${isFilled ? "filled" : ""}`}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleClueSelect(clue);
                                                            }}
                                                        >
                                                            <span className="cw-clue-badge">{clue.number}</span>
                                                            <div className="cw-clue-content">
                                                                <div className="cw-clue-text">{clue.clue}</div>
                                                                <div className="cw-clue-meta">
                                                                    <span>{clue.length} Huruf</span>
                                                                    {isFilled && <i className="fas fa-check-circle text-success ms-1"></i>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Menurun (Down) */}
                                        <div className="cw-clues-column">
                                            <div className="cw-clues-header d-flex align-items-center gap-2 mb-2">
                                                <i className="fas fa-arrows-alt-v text-info"></i>
                                                <span className="fw-bold small text-uppercase">Menurun</span>
                                            </div>
                                            <div className="cw-clues-scroll-list">
                                                {crosswordLayout?.downClues.map(clue => {
                                                    const isSelected = activeWordId === clue.wordId && activeDirection === "down";
                                                    const wordObj = crosswordLayout.placedWords.find(p => p.wordId === clue.wordId);
                                                    const isFilled = wordObj ? isWordFilled(wordObj) : false;

                                                    return (
                                                        <div
                                                            key={`down-${clue.number}`}
                                                            className={`cw-clue-item ${isSelected ? "active" : ""} ${isFilled ? "filled" : ""}`}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleClueSelect(clue);
                                                            }}
                                                        >
                                                            <span className="cw-clue-badge down">{clue.number}</span>
                                                            <div className="cw-clue-content">
                                                                <div className="cw-clue-text">{clue.clue}</div>
                                                                <div className="cw-clue-meta">
                                                                    <span>{clue.length} Huruf</span>
                                                                    {isFilled && <i className="fas fa-check-circle text-success ms-1"></i>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Submission Bar */}
                                <div className="cw-footer-bar d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                                    <div className="d-flex align-items-center gap-2">
                                        <span className="badge bg-light text-dark border px-3 py-2 fs-6">
                                            <i className="fas fa-check-double text-primary me-2"></i>
                                            {solvedWordsCount} / {crosswordLayout?.placedWords.length || 0} Kata Terisi
                                        </span>
                                    </div>
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
                                    <div className="small text-muted mb-2 d-flex justify-content-between align-items-center flex-wrap gap-1">
                                        <span>
                                            <i className="fas fa-info-circle me-1"></i>
                                            Pilih kata (horizontal, vertikal, diagonal & terbalik):
                                        </span>
                                        {wsSelectedCells.length > 0 && (
                                            <span className="badge bg-teal text-white px-2 py-0.5 font-monospace" style={{ fontSize: "11px" }}>
                                                {wsSelectedCells.map(c => c.char).join("")}
                                            </span>
                                        )}
                                    </div>
                                    <div 
                                        className="wordsearch-grid"
                                        style={{
                                            gridTemplateColumns: `repeat(${wsGrid.length || 10}, 1fr)`,
                                            maxWidth: wsGrid.length > 13 ? "580px" : "480px"
                                        }}
                                    >
                                        {wsGrid.map((row, r) => 
                                            row.map((char, c) => {
                                                const isSelected = wsSelectedCells.some(cell => cell.r === r && cell.c === c);
                                                const isFound = wsFoundCells.some(cell => cell.r === r && cell.c === c);
                                                return (
                                                    <div 
                                                        key={`${r}-${c}`}
                                                        className={`ws-cell ${isFound ? "found" : ""} ${isSelected ? "selected" : ""}`}
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
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h6 className="fw-bold mb-0">Kata yang Dicari:</h6>
                                        <span className="badge bg-light text-dark border">
                                            {wsFoundWords.length} / {(activeGame.game_data?.words || []).length}
                                        </span>
                                    </div>
                                    <div className="word-targets-list">
                                        {(activeGame.game_data?.words || []).map((w, idx) => {
                                            const wordStr = (typeof w === "object" ? w.word : w).toUpperCase();
                                            const cleanWord = wordStr.replace(/[^A-Z]/g, "");
                                            const isFound = wsFoundWords.includes(cleanWord);
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
                                            disabled={wsSelectedCells.length === 0}
                                        >
                                            <i className="fas fa-undo me-1"></i>
                                            Reset Seleksi
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn btn-success fw-bold w-100" 
                                            onClick={submitWordSearch}
                                        >
                                            <i className="fas fa-paper-plane me-1"></i>
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
