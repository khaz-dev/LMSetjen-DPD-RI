import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiInstance from '../../utils/axios';
import UserData from '../../views/plugin/UserData';
import './SiMantaAvatar.css';

// Import sprite assets (WebP format with fallback)
import mantaTabletIdleWebp from '../../assets/avatar/manta-tablet-idle.webp';
import mantaTabletWaveWebp from '../../assets/avatar/manta-tablet-wave.webp';
import mantaHappyWebp from '../../assets/avatar/manta-happy.webp';
import mantaIdleWebp from '../../assets/avatar/manta-idle.webp';

// Kunci penyimpanan riwayat sesi chat
const CHAT_STORAGE_KEY = 'manta_chat_session_history';

// Saran pertanyaan cepat bawaan umum
const DEFAULT_SUGGESTIONS = [
    {
        label: '🎓 Panduan Kursus',
        query: 'Bagaimana cara mulai belajar atau mendaftar kursus di LMS?'
    },
    {
        label: '📜 Unduh Sertifikat',
        query: 'Bagaimana cara mendapatkan dan mengunduh sertifikat pelatihan?'
    },
    {
        label: '⚡ Kendala Teknis',
        query: 'Video atau modul SCORM macet, apa solusinya?'
    },
    {
        label: '🔐 Login & SSO',
        query: 'Bagaimana cara masuk menggunakan SSO Setjen DPD RI?'
    }
];

/**
 * Memberikan rekomendasi pertanyaan cepat yang adaptif sesuai halaman yang sedang dibuka (Contextual Page Awareness)
 */
const getContextualSuggestions = (pathname) => {
    if (!pathname) return DEFAULT_SUGGESTIONS;

    if (pathname.includes('/course-detail/')) {
        return [
            { label: '📖 Tentang Kursus Ini', query: 'Jelaskan ringkasan materi dan silabus kursus ini' },
            { label: '📝 Syarat & Evaluasi', query: 'Bagaimana evaluasi kuis dan syarat kelulusan kursus ini?' },
            { label: '👨‍🏫 Instruktur & Modul', query: 'Siapa instruktur dan berapa banyak modul di kursus ini?' },
            { label: '📜 Sertifikat Kelulusan', query: 'Apakah kursus ini menerbitkan sertifikat digital resmi?' }
        ];
    }
    if (pathname.includes('/student/sertifikat/')) {
        return [
            { label: '📜 Sertifikat Saya', query: 'Berapa banyak sertifikat yang sudah saya miliki?' },
            { label: '🔍 Verifikasi QR Code', query: 'Bagaimana cara memverifikasi keaslian QR Code sertifikat?' },
            { label: '📥 Syarat Terbit Sertifikat', query: 'Apa syarat agar sertifikat kelulusan otomatis terbit?' },
            { label: '📚 Lanjut Belajar', query: 'Lihat progres kursus saya' }
        ];
    }
    if (pathname.includes('/student/courses/')) {
        return [
            { label: '📊 Progres Belajar Saya', query: 'Bagaimana progres kursus saya saat ini?' },
            { label: '▶️ Lanjut Kursus Tertunda', query: 'Kursus apa yang belum saya selesaikan?' },
            { label: '⚡ Modul SCORM Macet', query: 'Video atau modul SCORM macet, apa solusinya?' },
            { label: '📜 Cek Sertifikat', query: 'Bagaimana cara unduh sertifikat setelah selesai?' }
        ];
    }
    if (pathname.includes('/search/')) {
        return [
            { label: '🌟 Kursus Terpopuler', query: 'Rekomendasikan kursus paling populer di LMS' },
            { label: '🏛️ Pelatihan Keparlemenan', query: 'Cari kursus keparlemenan Setjen DPD RI' },
            { label: '💡 Pelatihan Inovasi & TI', query: 'Cari pelatihan teknologi informasi dan inovasi' },
            { label: '🚀 Cara Mendaftar', query: 'Bagaimana cara mendaftar kursus di katalog?' }
        ];
    }
    if (pathname.includes('/user-guide/') || pathname.includes('/tentang/')) {
        return [
            { label: '🏛️ Visi Misi LMS', query: 'Apa visi dan fungsi LMS Setjen DPD RI?' },
            { label: '🔐 Panduan Akun SSO', query: 'Bagaimana cara masuk menggunakan SSO Setjen DPD RI?' },
            { label: '📞 Kontak Helpdesk', query: 'Bagaimana cara menghubungi admin jika ada kendala?' },
            { label: '📚 Mulai Belajar', query: 'Bagaimana langkah awal memulai belajar?' }
        ];
    }

    return DEFAULT_SUGGESTIONS;
};

/**
 * Membersihkan format Markdown, tautan, dan emoji agar dapat dibacakan secara natural oleh Text-to-Speech
 */
const stripMarkdownForTTS = (text) => {
    if (!text) return '';
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[\s]*[-*•]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        .replace(/\n+/g, '. ')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/[#~_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Render teks pesan AI dengan format Markdown yang rapi:
 * - Paragraf terstruktur dengan jarak nyaman
 * - **Teks Tebal** diubah menjadi <strong> yang jelas dan kontras
 * - Bullet list (* atau - atau •) diubah menjadi elemen kartu poin
 * - Numbered list (1., 2.) diubah menjadi badge nomor terstruktur
 * - `kode` diubah menjadi badge inline code
 */
const renderFormattedMessageText = (text) => {
    if (!text) return null;

    // Helper render format inline (**bold**, `code`, *italic*)
    const renderInlineFormatting = (str) => {
        if (!str) return null;
        const parts = str.split(/(\*\*.*?\*\*|`.*?`|\*[^*]+?\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return (
                    <strong key={index} className="simanta-text-bold">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
                return (
                    <code key={index} className="simanta-text-code">
                        {part.slice(1, -1)}
                    </code>
                );
            }
            if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
                return (
                    <em key={index} className="simanta-text-italic">
                        {part.slice(1, -1)}
                    </em>
                );
            }
            return part;
        });
    };

    const lines = text.split('\n');
    const blocks = [];
    let currentParagraph = [];
    let currentList = null;

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            blocks.push({
                type: 'p',
                text: currentParagraph.join(' ')
            });
            currentParagraph = [];
        }
    };

    const flushList = () => {
        if (currentList && currentList.items.length > 0) {
            blocks.push(currentList);
            currentList = null;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        // Horizontal divider (--- atau ***)
        if (/^(\-{3,}|\*{3,})$/.test(line)) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'hr' });
            continue;
        }

        // Bullet point: *, -, •
        const bulletMatch = line.match(/^[\*\-\•]\s+(.*)$/);
        if (bulletMatch) {
            flushParagraph();
            if (!currentList || currentList.type !== 'bullet') {
                flushList();
                currentList = { type: 'bullet', items: [] };
            }
            currentList.items.push(bulletMatch[1]);
            continue;
        }

        // Numbered list: 1., 2., 1), etc.
        const numberMatch = line.match(/^(\d+)[\.\)]\s+(.*)$/);
        if (numberMatch) {
            flushParagraph();
            if (!currentList || currentList.type !== 'numbered') {
                flushList();
                currentList = { type: 'numbered', items: [] };
            }
            currentList.items.push({ num: numberMatch[1], content: numberMatch[2] });
            continue;
        }

        // Blockquote: > text
        const quoteMatch = line.match(/^>\s*(.*)$/);
        if (quoteMatch) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'blockquote', text: quoteMatch[1] });
            continue;
        }

        // Regular paragraph line
        flushList();
        currentParagraph.push(line);
    }

    flushParagraph();
    flushList();

    return blocks.map((block, idx) => {
        if (block.type === 'hr') {
            return <hr key={idx} className="simanta-msg-divider" />;
        }
        if (block.type === 'blockquote') {
            return (
                <blockquote key={idx} className="simanta-msg-blockquote">
                    {renderInlineFormatting(block.text)}
                </blockquote>
            );
        }
        if (block.type === 'p') {
            return (
                <p key={idx} className="simanta-msg-paragraph">
                    {renderInlineFormatting(block.text)}
                </p>
            );
        }
        if (block.type === 'bullet') {
            return (
                <ul key={idx} className="simanta-msg-list simanta-msg-bullet-list">
                    {block.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="simanta-msg-list-item">
                            <span className="simanta-bullet-dot" aria-hidden="true">•</span>
                            <span className="simanta-list-text">{renderInlineFormatting(item)}</span>
                        </li>
                    ))}
                </ul>
            );
        }
        if (block.type === 'numbered') {
            return (
                <ol key={idx} className="simanta-msg-list simanta-msg-numbered-list">
                    {block.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="simanta-msg-list-item">
                            <span className="simanta-number-badge">{item.num}</span>
                            <span className="simanta-list-text">{renderInlineFormatting(item.content)}</span>
                        </li>
                    ))}
                </ol>
            );
        }
        return null;
    });
};

/**
 * MantaAvatar - Asisten AI Avatar Bergerak LMS Setjen DPD RI
 * 
 * Karakteristik:
 * - Posisi: Pojok Kiri Bawah (Fixed Bottom-Left)
 * - Hubungan: Sesuai rancangan awal, simanta-chat-window mengembang anggun
 *   dari pojok kiri bawah saat avatar diklik.
 * - Karakter: Manta (Pari Manta Setjen DPD RI)
 * - Efisiensi: GPU-accelerated CSS animations (0% CPU)
 * - Terhubung Backend AI cerdas LMS Setjen DPD RI (/api/v1/ai/chat/)
 */
const SiMantaAvatar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentUser = UserData();

    // 1. Validasi konteks: Jangan tampilkan jika dalam iframe (SCORM player) atau player page
    const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
    const isPlayerPage = typeof window !== 'undefined' && window.location.pathname.includes('/modules/') && window.location.pathname.includes('/player');

    // 2. Validasi integritas ujian (Anti-Kecurangan): Sembunyikan Manta saat kuis/pre-test/post-test aktif
    const [isQuizActiveScreen, setIsQuizActiveScreen] = useState(false);

    // State avatar & animasi
    const [pose, setPose] = useState('idle'); // 'idle' | 'wave' | 'happy'
    const [isHovered, setIsHovered] = useState(false);
    const [showBubble, setShowBubble] = useState(false);
    const [bubbleDismissed, setBubbleDismissed] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        try {
            return localStorage.getItem('manta_minimized') === 'true';
        } catch {
            return false;
        }
    });

    // Smart Learning Nudge & Proactive Reminder State
    const [learningNudge, setLearningNudge] = useState(null);
    const [isNudgeDismissed, setIsNudgeDismissed] = useState(() => {
        try {
            return sessionStorage.getItem('manta_nudge_dismissed') === 'true';
        } catch {
            return false;
        }
    });

    // Ambil data pengingat belajar proaktif pengguna dari Backend
    useEffect(() => {
        let isMounted = true;
        const fetchNudge = async () => {
            try {
                const uid = currentUser?.user_id || currentUser?.id;
                const resp = await apiInstance.get('ai/nudge/', {
                    params: uid ? { user_id: uid } : {}
                });
                if (isMounted && resp.data?.status === 'success' && resp.data.nudge) {
                    setLearningNudge(resp.data.nudge);
                }
            } catch (err) {
                // ignore network fallback
            }
        };
        fetchNudge();
        return () => { isMounted = false; };
    }, [currentUser?.user_id, currentUser?.id]);

    // Deteksi real-time apakah pengguna sedang berada di layar pengerjaan kuis/pre-test/post-test
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const checkQuizActive = () => {
            const hasQuizScreen = !!document.querySelector(
                '.quiz-active-screen-inline, .quiz-active-screen, .inline-quiz-fullscreen, body.lms-quiz-active'
            );
            const isBodyFlagged = document.body.classList.contains('lms-quiz-active');
            const active = hasQuizScreen || isBodyFlagged;

            setIsQuizActiveScreen((prev) => {
                if (active && !prev) {
                    setIsChatOpen(false);
                    setShowBubble(false);
                }
                return active;
            });
        };

        checkQuizActive();

        const handleQuizEvent = (e) => {
            const active = !!(e.detail?.isQuizActive);
            setIsQuizActiveScreen(active);
            if (active) {
                setIsChatOpen(false);
                setShowBubble(false);
            }
        };
        window.addEventListener('lms-quiz-status-change', handleQuizEvent);

        const observer = new MutationObserver(() => {
            checkQuizActive();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });

        return () => {
            window.removeEventListener('lms-quiz-status-change', handleQuizEvent);
            observer.disconnect();
        };
    }, []);

    // Chat state (Dipersistensikan di sessionStorage + Terpersonalisasi)
    const [quizAnswers, setQuizAnswers] = useState({}); // { [quizId]: { selectedKey: 'B', isCorrect: true } }
    const [savedNotes, setSavedNotes] = useState({}); // { [summaryId]: { status: 'saved' | 'saving' | 'error', message: '', note: {} } }
    const [previewNoteIds, setPreviewNoteIds] = useState({});
    const [copiedSummaryId, setCopiedSummaryId] = useState(null);
    const [chatMessages, setChatMessages] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('Gagal memuat riwayat obrolan Manta:', e);
            }
        }

        const user = UserData();
        const greeting = user?.full_name
            ? `Halo, Bapak/Ibu **${user.full_name}**! Saya **Manta**, Asisten AI Virtual LMS Setjen DPD RI 👋 Ada materi atau topik pembelajaran yang ingin Manta bantu?`
            : 'Halo! Saya **Manta**, Asisten AI Virtual LMS Setjen DPD RI 👋 Ada topik atau bantuan pembelajaran yang ingin Anda tanyakan?';

        const initialActions = user
            ? [
                { label: '📚 Kursus Saya', url: '/student/courses/', type: 'route' },
                { label: '📜 Sertifikat Saya', url: '/student/sertifikat/', type: 'route' },
                { label: '🔍 Cari Pelatihan Baru', url: '/search/', type: 'route' }
            ]
            : [
                { label: '🔍 Jelajahi Katalog Kursus', url: '/search/', type: 'route' },
                { label: '🔐 Masuk Akun SSO', url: '/login/', type: 'route' }
            ];

        return [
            {
                sender: 'bot',
                text: greeting,
                time: 'Baru saja',
                courses: [],
                actions: initialActions
            }
        ];
    });

    // Saran pertanyaan cepat yang adaptif sesuai halaman aktif (Contextual Page Awareness)
    const [quickChips, setQuickChips] = useState(() => {
        return getContextualSuggestions(typeof window !== 'undefined' ? window.location.pathname : '');
    });
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatBodyRef = useRef(null);

    // Auto-scroll chat body
    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [chatMessages, isTyping, isChatOpen]);

    // Simpan riwayat chat ke sessionStorage setiap kali ada pesan baru
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            if (chatMessages && chatMessages.length > 0) {
                sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages));
            }
        } catch (e) {
            console.warn('Gagal menyimpan riwayat obrolan Manta:', e);
        }
    }, [chatMessages]);

    // Contextual Page Awareness: Perbarui saran pertanyaan cepat saat pengguna berpindah halaman
    useEffect(() => {
        const contextualChips = getContextualSuggestions(location.pathname);
        setQuickChips(contextualChips);
    }, [location.pathname]);

    // Mulai sesi obrolan baru (Reset Chat)
    const handleResetChat = () => {
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.removeItem(CHAT_STORAGE_KEY);
            } catch (e) {
                console.warn(e);
            }
        }
        const user = UserData();
        const greeting = user?.full_name
            ? `Halo, Bapak/Ibu **${user.full_name}**! Saya **Manta**, Asisten AI Virtual LMS Setjen DPD RI 👋 Sesi obrolan baru telah dimulai. Ada materi atau topik pembelajaran yang ingin Anda tanyakan?`
            : 'Halo! Saya **Manta**, Asisten AI Virtual LMS Setjen DPD RI 👋 Sesi obrolan baru telah dimulai. Ada topik atau bantuan pembelajaran yang ingin Anda tanyakan?';

        const initialActions = user
            ? [
                { label: '📚 Kursus Saya', url: '/student/courses/', type: 'route' },
                { label: '📜 Sertifikat Saya', url: '/student/sertifikat/', type: 'route' },
                { label: '🔍 Cari Pelatihan Baru', url: '/search/', type: 'route' }
            ]
            : [
                { label: '🔍 Jelajahi Katalog Kursus', url: '/search/', type: 'route' },
                { label: '🔐 Masuk Akun SSO', url: '/login/', type: 'route' }
            ];

        setChatMessages([
            {
                sender: 'bot',
                text: greeting,
                time: 'Baru saja',
                courses: [],
                actions: initialActions
            }
        ]);
        setQuickChips(getContextualSuggestions(location.pathname));
        stopSpeaking();
    };

    // =========================================================================
    // FITUR INTERAKSI SUARA (VOICE INPUT 🎙️ & TEXT-TO-SPEECH 🔊)
    // =========================================================================
    const [speakingIdx, setSpeakingIdx] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    // Hentikan pembacaan suara
    const stopSpeaking = useCallback(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setSpeakingIdx(null);
    }, []);

    // Hentikan suara jika jendela obrolan ditutup atau komponen unmount
    useEffect(() => {
        if (!isChatOpen) {
            stopSpeaking();
        }
    }, [isChatOpen, stopSpeaking]);

    useEffect(() => {
        return () => {
            stopSpeaking();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    // ignore
                }
            }
        };
    }, [stopSpeaking]);

    // Memuat daftar suara yang tersedia di peramban
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const loadVoices = () => {
                window.speechSynthesis.getVoices();
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    // Toggle Text-to-Speech (Membacakan pesan bot)
    const handleToggleSpeak = (text, idx) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            alert('Peramban Anda belum mendukung fitur Text-to-Speech.');
            return;
        }

        if (speakingIdx === idx) {
            stopSpeaking();
            return;
        }

        stopSpeaking();

        const cleanText = stripMarkdownForTTS(text);
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'id-ID';
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const idVoice = voices.find(v => 
            v.lang.toLowerCase().startsWith('id') || 
            v.lang.includes('ID') || 
            v.name.toLowerCase().includes('indonesia')
        );
        if (idVoice) {
            utterance.voice = idVoice;
        }

        utterance.onend = () => {
            setSpeakingIdx(null);
        };
        utterance.onerror = () => {
            setSpeakingIdx(null);
        };

        setSpeakingIdx(idx);
        window.speechSynthesis.speak(utterance);
    };

    // Inisialisasi SpeechRecognition (Input Suara Mikrofon)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'id-ID';

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (transcript) {
                setInputText(transcript);
            }
        };

        recognition.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    // Toggle Input Suara Mikrofon
    const handleToggleSpeechRecognition = () => {
        if (!recognitionRef.current) {
            alert('Peramban Anda belum mendukung Speech Recognition. Disarankan menggunakan Google Chrome, Microsoft Edge, atau browser berbasis Chromium.');
            return;
        }

        if (isListening) {
            try {
                recognitionRef.current.stop();
            } catch {
                // ignore
            }
            setIsListening(false);
        } else {
            try {
                stopSpeaking();
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.warn('Gagal memulai mikrofon:', e);
                setIsListening(false);
            }
        }
    };

    // Simpan status minimized ke localStorage
    const handleToggleMinimize = (e) => {
        e?.stopPropagation();
        setIsMinimized((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('manta_minimized', String(next));
            } catch (err) {
                console.error(err);
            }
            return next;
        });
        if (isChatOpen) setIsChatOpen(false);
    };

    // Balon sapaan otomatis saat pertama kali dibuka
    useEffect(() => {
        if (isMinimized || bubbleDismissed) return;

        const timer = setTimeout(() => {
            setShowBubble(true);
        }, 1200);

        const hideTimer = setTimeout(() => {
            setShowBubble(false);
        }, 8500);

        return () => {
            clearTimeout(timer);
            clearTimeout(hideTimer);
        };
    }, [isMinimized, bubbleDismissed]);

    // Micro-interaction berkala: Melambai singkat setiap 15 detik sekali saat idle
    useEffect(() => {
        if (isChatOpen || isHovered || isMinimized) return;

        const interval = setInterval(() => {
            setPose('wave');
            const resetTimer = setTimeout(() => {
                setPose('idle');
            }, 1800);
            return () => clearTimeout(resetTimer);
        }, 15000);

        return () => clearInterval(interval);
    }, [isChatOpen, isHovered, isMinimized]);

    // Hover handler
    const handleMouseEnter = () => {
        setIsHovered(true);
        if (!isChatOpen) {
            setPose('wave');
            if (!bubbleDismissed) setShowBubble(true);
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (!isChatOpen) {
            setPose('idle');
        }
    };

    // Klik Avatar: Buka dialog asisten AI & pose bahagia
    const handleAvatarClick = () => {
        setPose('happy');
        setIsChatOpen((prev) => !prev);
        setShowBubble(false);

        setTimeout(() => {
            setPose('idle');
        }, 1200);
    };

    // Pilih sprite berdasarkan status aktif
    const getCurrentSprite = useCallback(() => {
        if (pose === 'happy') return mantaHappyWebp;
        if (pose === 'wave' || isHovered) return mantaTabletWaveWebp;
        return mantaTabletIdleWebp;
    }, [pose, isHovered]);

    // Eksekusi Tombol Aksi Cepat (Quick Action Click)
    const handleActionClick = (action) => {
        if (!action) return;

        if (action.type === 'route' && action.url) {
            navigate(action.url);
            setIsChatOpen(false);
        } else if (action.type === 'event') {
            if (action.action === 'open_feedback') {
                // Kumpulkan informasi diagnostik peramban & sesi secara otomatis
                const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
                let browserName = 'Browser Web';
                if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browserName = 'Google Chrome';
                else if (userAgent.includes('Firefox')) browserName = 'Mozilla Firefox';
                else if (userAgent.includes('Edg')) browserName = 'Microsoft Edge';
                else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browserName = 'Apple Safari';

                const screenSize = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A';
                const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

                const diagHeader = `[Diagnostik Otomatis Manta AI]\n` +
                    `• Kategori: ${action.category_desc || 'Kendala Teknis'}\n` +
                    `• Lokasi Halaman: ${currentUrl}\n` +
                    `• Peramban: ${browserName} (Resolusi Layar: ${screenSize})\n` +
                    `• Waktu Laporan: ${new Date().toLocaleString('id-ID')}\n\n` +
                    `[Detail Kendala]:\n` +
                    `${action.user_problem || 'Pengguna melaporkan kendala teknis saat mengakses LMS Setjen DPD RI.'}`;

                window.dispatchEvent(new CustomEvent('lms-open-feedback-modal', {
                    detail: {
                        courseId: action.course_id || null,
                        prefill: {
                            feedback_type: 'bug',
                            title: action.report_title || 'Kendala Teknis Sistem LMS',
                            description: diagHeader,
                            affected_area: action.affected_area || 'other',
                            related_url: currentUrl,
                            related_course: action.course_id || ''
                        }
                    }
                }));
                setIsChatOpen(false);
            } else if (action.action === 'next_quiz') {
                handleSendMessage('Beri saya latihan kuis berikutnya');
            } else if (action.action === 'save_to_notes') {
                handleSaveSummaryToNotes(action);
            }
        }
    };

    // Handler menyimpan rangkuman materi ke Catatan Belajar (Student Notes)
    const handleSaveSummaryToNotes = async (summaryData) => {
        if (!summaryData) return;
        const uid = currentUser?.user_id || currentUser?.id;
        if (!uid) {
            alert('Silakan masuk (login) terlebih dahulu untuk menyimpan catatan pembelajaran ke akun Anda.');
            return;
        }

        const summaryId = summaryData.summary_id || summaryData.id || 'gen';
        setSavedNotes((prev) => ({ ...prev, [summaryId]: { status: 'saving' } }));

        try {
            const resp = await apiInstance.post('ai/notes/save/', {
                user_id: uid,
                course_id: summaryData.course_id,
                course_slug: summaryData.course_slug,
                title: summaryData.title || `Rangkuman: ${summaryData.topic || 'Materi LMS'}`,
                content: summaryData.plain_text_note || summaryData.content || '',
                color: '#0d9488'
            });

            if (resp.data?.status === 'success') {
                setSavedNotes((prev) => ({
                    ...prev,
                    [summaryId]: {
                        status: 'saved',
                        message: resp.data.message || 'Tersimpan di Catatan Belajar!',
                        noteId: resp.data.note?.note_id,
                        note: resp.data.note
                    }
                }));
            } else {
                throw new Error(resp.data?.message || 'Gagal menyimpan catatan');
            }
        } catch (err) {
            console.error('Gagal menyimpan rangkuman ke catatan:', err);
            setSavedNotes((prev) => ({
                ...prev,
                [summaryId]: { status: 'error', message: 'Gagal menyimpan, silakan coba lagi.' }
            }));
        }
    };

    // Handler salin rangkuman ke clipboard
    const handleCopySummary = (summaryData) => {
        const textToCopy = summaryData?.plain_text_note || summaryData?.content;
        if (!textToCopy) return;
        try {
            navigator.clipboard.writeText(textToCopy);
            setCopiedSummaryId(summaryData.id || summaryData.summary_id);
            setTimeout(() => setCopiedSummaryId(null), 2500);
        } catch (err) {
            console.warn('Clipboard copy error:', err);
        }
    };

    // Handler memilih opsi kuis interaktif (AI Quiz Prep)
    const handleSelectQuizChoice = (quizId, choiceKey, correctKey) => {
        if (!quizId || !choiceKey) return;
        setQuizAnswers((prev) => {
            if (prev[quizId]) return prev;
            return {
                ...prev,
                [quizId]: {
                    selectedKey: choiceKey,
                    isCorrect: choiceKey === correctKey
                }
            };
        });
    };

    // Kirim pesan interaktif ke Backend AI
    const handleSendMessage = async (textToSend) => {
        const query = textToSend || inputText.trim();
        if (!query) return;

        stopSpeaking();
        if (isListening && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {
                // ignore
            }
            setIsListening(false);
        }

        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        setChatMessages((prev) => [
            ...prev,
            { sender: 'user', text: query, time: timeString, courses: [], actions: [] }
        ]);
        setInputText('');
        setIsTyping(true);
        setPose('wave');

        const courseSlugMatch = location.pathname.match(/\/course-detail\/([^/]+)/);
        const currentCourseSlug = courseSlugMatch ? courseSlugMatch[1] : null;

        try {
            // Panggil Backend AI LMS Setjen DPD RI dengan konteks pengguna & konteks halaman aktif
            const response = await apiInstance.post('ai/chat/', {
                message: query,
                user_id: currentUser?.user_id || currentUser?.id || null,
                user_name: currentUser?.full_name || currentUser?.username || '',
                page_context: {
                    pathname: location.pathname,
                    course_slug: currentCourseSlug
                },
                history: chatMessages.slice(-6).map((m) => ({
                    role: m.sender === 'user' ? 'user' : 'assistant',
                    content: m.text
                }))
            });

            if (response.data && response.data.status === 'success') {
                const replyText = response.data.reply;
                const recCourses = response.data.recommended_courses || [];
                const matchedLessons = response.data.matched_lessons || [];
                const nextSuggestions = response.data.suggested_questions || [];
                const replyActions = response.data.actions || [];
                const interactiveQuiz = response.data.interactive_quiz || null;
                const summaryCard = response.data.summary_card || null;

                setChatMessages((prev) => [
                    ...prev,
                    {
                        sender: 'bot',
                        text: replyText,
                        time: timeString,
                        courses: recCourses,
                        lessons: matchedLessons,
                        actions: replyActions,
                        quiz: interactiveQuiz,
                        summary: summaryCard
                    }
                ]);

                if (nextSuggestions.length > 0) {
                    setQuickChips(nextSuggestions.map((s) => ({ label: s, query: s })));
                }
            } else {
                throw new Error('Format balasan backend tidak valid');
            }
        } catch (error) {
            console.warn('Backend AI offline / fallback lokal diaktifkan:', error);

            setTimeout(() => {
                let localReply = '';
                let localActions = [
                    { label: '🔍 Katalog Kursus', url: '/search/', type: 'route' }
                ];

                if (/sertifikat|lulus|skor/i.test(query)) {
                    localReply = '📜 **Panduan Sertifikat:** Sertifikat resmi otomatis terbit di menu **Sertifikat Saya** setelah Anda menyelesaikan seluruh materi dan lulus kuis evaluasi akhir.';
                    localActions = [
                        { label: '📜 Sertifikat Saya', url: '/student/sertifikat/', type: 'route' },
                        { label: '📚 Kursus Saya', url: '/student/courses/', type: 'route' }
                    ];
                } else if (/kursus|materi|kelas/i.test(query)) {
                    localReply = '📚 **Katalog Kursus:** Silakan jelajahi katalog kursus pembelajaran kami pada bilah navigasi atas untuk melihat seluruh pelatihan resmi Setjen DPD RI.';
                    localActions = [
                        { label: '🔍 Buka Katalog', url: '/search/', type: 'route' },
                        { label: '📚 Kursus Saya', url: '/student/courses/', type: 'route' }
                    ];
                } else if (/halo|hai|pagi|siang|sore|malam/i.test(query)) {
                    localReply = 'Halo! Saya Manta, Asisten LMS Setjen DPD RI 👋 Ada topik kursus atau materi yang ingin Anda tanyakan?';
                    localActions = currentUser
                        ? [
                            { label: '📚 Kursus Saya', url: '/student/courses/', type: 'route' },
                            { label: '📜 Sertifikat Saya', url: '/student/sertifikat/', type: 'route' }
                        ]
                        : [
                            { label: '🔍 Cari Kursus', url: '/search/', type: 'route' },
                            { label: '🔐 Masuk SSO', url: '/login/', type: 'route' }
                        ];
                } else {
                    localReply = 'Mohon maaf, saat ini server AI sedang memuat ulang atau tidak terhubung ke backend. Silakan coba kembali sesaat lagi.';
                    localActions = [
                        { label: '💬 Laporkan Kendala', action: 'open_feedback', type: 'event' }
                    ];
                }

                setChatMessages((prev) => [
                    ...prev,
                    {
                        sender: 'bot',
                        text: localReply,
                        time: timeString,
                        courses: [],
                        actions: localActions
                    }
                ]);
            }, 300);
        } finally {
            setIsTyping(false);
            setPose('idle');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // 🔒 Integritas Ujian & Pengecualian Layar:
    // Jangan render Manta jika di dalam iframe, player SCORM, atau saat kuis/ujian aktif
    if (isInsideIframe || isPlayerPage || isQuizActiveScreen) {
        return null;
    }

    return (
        <aside 
            className="simanta-container"
            aria-label="Asisten AI LMS Setjen DPD RI"
        >
            {/* JIKA DALAM MODE MINIMIZED (Lencana Kecil) */}
            {isMinimized ? (
                <button
                    className="simanta-minimized-badge"
                    onClick={handleToggleMinimize}
                    title="Buka Manta (Asisten AI LMS)"
                    aria-label="Buka Manta Asisten AI"
                >
                    <img
                        src={mantaIdleWebp}
                        alt="Manta"
                        className="simanta-minimized-icon"
                    />
                    <span>Manta AI</span>
                    <span className="simanta-status-dot" style={{ marginLeft: 2 }} />
                </button>
            ) : (
                /* MODE AVATAR UTAMA (POSISI ASLI DI POJOK KIRI BAWAH) */
                <div className="simanta-avatar-wrapper">
                    {/* Tombol perkecil (minimize) di sudut atas avatar */}
                    <button
                        className="simanta-action-toggle"
                        onClick={handleToggleMinimize}
                        title="Sembunyikan Manta ke lencana kecil"
                        aria-label="Minimize Manta"
                    >
                        ✕
                    </button>

                    {/* Balon Sapaan Cerdas (Smart Proactive Learning Nudge) */}
                    {showBubble && !isChatOpen && (
                        <div 
                            className="simanta-speech-bubble"
                            onClick={handleAvatarClick}
                            role="button"
                            tabIndex={0}
                        >
                            <span>
                                {learningNudge?.bubble_text || 'Halo! Saya Manta 👋 Ada yang bisa dibantu?'}
                            </span>
                            <button
                                className="simanta-speech-close"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowBubble(false);
                                    setBubbleDismissed(true);
                                }}
                                title="Tutup sapaan"
                                aria-label="Tutup sapaan"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Karakter Avatar 1.5x Lipat dengan Gerakan Nafas / Floating */}
                    <div
                        className="simanta-floating"
                        onClick={handleAvatarClick}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        role="button"
                        tabIndex={0}
                        title="Klik untuk membuka interaksi Manta AI"
                        aria-label="Interaksi Manta AI"
                    >
                        <img
                            src={getCurrentSprite()}
                            alt="Manta - Maskot Asisten AI LMS Setjen DPD RI"
                            className="simanta-sprite"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                        />
                        <div className="simanta-shadow" />
                    </div>

                    {/* Lencana Online Status */}
                    <div className="simanta-status-badge">
                        <span className="simanta-status-dot" />
                        <span>AI</span>
                    </div>
                </div>
            )}

            {/* JENDELA INTERAKTIF ASISTEN AI (CHAT MODAL / DRAWER) */}
            {/* POSISI ASLI: MENGEMBANG DARI POJOK KIRI BAWAH */}
            {isChatOpen && !isMinimized && (
                <section 
                    className="simanta-chat-window"
                    aria-labelledby="simanta-dialog-title"
                >
                    {/* Header Chat Window */}
                    <header className="simanta-chat-header">
                        <div className="simanta-chat-header-info">
                            <div className="simanta-chat-header-avatar">
                                <img src={mantaTabletIdleWebp} alt="Manta Avatar" />
                            </div>
                            <div>
                                <h3 id="simanta-dialog-title" className="simanta-chat-title">Manta AI</h3>
                                <p className="simanta-chat-subtitle">
                                    <span className="simanta-status-dot" style={{ width: 5, height: 5 }} />
                                    Asisten LMS Setjen DPD RI
                                </p>
                            </div>
                        </div>

                        <div className="simanta-chat-header-actions">
                            {/* Tombol Obrolan Baru (Reset Chat) */}
                            <button
                                className="simanta-chat-header-btn"
                                onClick={handleResetChat}
                                title="Mulai sesi obrolan baru"
                                aria-label="Mulai sesi obrolan baru"
                            >
                                🔄
                            </button>
                            {/* Tombol Tutup */}
                            <button
                                className="simanta-chat-header-btn"
                                onClick={() => setIsChatOpen(false)}
                                title="Tutup dialog"
                                aria-label="Tutup dialog"
                            >
                                ✕
                            </button>
                        </div>
                    </header>

                    {/* Percakapan */}
                    <div className="simanta-chat-body" ref={chatBodyRef}>
                        {/* Smart Learning Nudge Banner (Pengingat Belajar Proaktif) */}
                        {learningNudge && learningNudge.has_nudge && !isNudgeDismissed && (
                            <div className="simanta-nudge-banner">
                                <div className="simanta-nudge-header">
                                    <div className="simanta-nudge-badge">
                                        <span className="simanta-nudge-icon">⏰</span>
                                        <span>{learningNudge.title || 'Pengingat Belajar'}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="simanta-nudge-close"
                                        onClick={() => {
                                            setIsNudgeDismissed(true);
                                            try {
                                                sessionStorage.setItem('manta_nudge_dismissed', 'true');
                                            } catch (e) {}
                                        }}
                                        title="Tutup pengingat"
                                        aria-label="Tutup pengingat"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="simanta-nudge-body">
                                    {learningNudge.course_title && (
                                        <h4 className="simanta-nudge-course-title">
                                            {learningNudge.course_title}
                                        </h4>
                                    )}
                                    {learningNudge.progress !== undefined && (
                                        <div className="simanta-nudge-progress-wrap">
                                            <div className="simanta-nudge-progress-labels">
                                                <span>Capaian Belajar</span>
                                                <span className="simanta-nudge-pct">{learningNudge.progress}%</span>
                                            </div>
                                            <div className="simanta-nudge-progress-track">
                                                <div
                                                    className="simanta-nudge-progress-fill"
                                                    style={{ width: `${Math.min(learningNudge.progress, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {learningNudge.remaining_lessons > 0 ? (
                                        <p className="simanta-nudge-desc">
                                            Tersisa <strong>{learningNudge.remaining_lessons} materi lagi</strong> menuju syarat kelulusan sertifikat resmi.
                                        </p>
                                    ) : learningNudge.message ? (
                                        <p className="simanta-nudge-desc">{learningNudge.message}</p>
                                    ) : null}
                                    <div className="simanta-nudge-actions">
                                        <button
                                            type="button"
                                            className="simanta-nudge-action-btn"
                                            onClick={() => {
                                                setIsChatOpen(false);
                                                navigate(learningNudge.action_url);
                                            }}
                                        >
                                            {learningNudge.action_label}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {chatMessages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`simanta-msg ${msg.sender === 'user' ? 'simanta-msg-user' : 'simanta-msg-bot'}`}
                            >
                                <div className="simanta-msg-content">
                                    {renderFormattedMessageText(msg.text)}

                                    {/* Kartu Simulasi Kuis Interaktif (Interactive Quiz Prep & Flashcard) */}
                                    {msg.quiz && (
                                        <div className="simanta-interactive-quiz-card">
                                            <div className="simanta-quiz-header">
                                                <div className="simanta-quiz-badge">
                                                    <span className="simanta-quiz-badge-icon">🧠</span>
                                                    <span className="simanta-quiz-badge-text">Simulasi Kuis Mandiri</span>
                                                </div>
                                                {msg.quiz.topic && (
                                                    <span className="simanta-quiz-topic" title={msg.quiz.course_title}>
                                                        {msg.quiz.topic}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="simanta-quiz-question-box">
                                                <p className="simanta-quiz-question-text">{msg.quiz.question}</p>
                                            </div>

                                            <div className="simanta-quiz-choices">
                                                {msg.quiz.choices.map((choice) => {
                                                    const quizState = quizAnswers[msg.quiz.id];
                                                    const isSelected = quizState?.selectedKey === choice.key;
                                                    const isAnswered = Boolean(quizState);
                                                    const isCorrectChoice = choice.key === msg.quiz.correct_key;

                                                    let choiceClass = 'simanta-quiz-choice-btn';
                                                    if (isAnswered) {
                                                        if (isCorrectChoice) {
                                                            choiceClass += ' correct';
                                                        } else if (isSelected) {
                                                            choiceClass += ' wrong';
                                                        } else {
                                                            choiceClass += ' dim';
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={choice.key}
                                                            type="button"
                                                            className={choiceClass}
                                                            disabled={isAnswered}
                                                            onClick={() => handleSelectQuizChoice(msg.quiz.id, choice.key, msg.quiz.correct_key)}
                                                        >
                                                            <span className="simanta-quiz-choice-key">{choice.key}</span>
                                                            <span className="simanta-quiz-choice-text">{choice.text}</span>
                                                            {isAnswered && isCorrectChoice && (
                                                                <span className="simanta-quiz-choice-icon" aria-label="Benar">✅</span>
                                                            )}
                                                            {isAnswered && isSelected && !isCorrectChoice && (
                                                                <span className="simanta-quiz-choice-icon" aria-label="Salah">❌</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Panel Evaluasi & Penjelasan Rationale setelah Dijawab */}
                                            {quizAnswers[msg.quiz.id] && (
                                                <div className={`simanta-quiz-feedback ${quizAnswers[msg.quiz.id].isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
                                                    <div className="simanta-quiz-feedback-header">
                                                        {quizAnswers[msg.quiz.id].isCorrect ? (
                                                            <>
                                                                <span className="simanta-quiz-feedback-title">🎉 Jawaban Anda Tepat Sekali!</span>
                                                                <span className="simanta-quiz-feedback-sub">Hebat, pemahaman Anda terhadap materi ini sudah sangat baik.</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="simanta-quiz-feedback-title">💡 Jawaban Anda Kurang Tepat</span>
                                                                <span className="simanta-quiz-feedback-sub">
                                                                    Jawaban yang benar adalah Opsi <strong>{msg.quiz.correct_key}</strong>.
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {msg.quiz.explanation && (
                                                        <div className="simanta-quiz-explanation">
                                                            <span className="simanta-explanation-label">💡 Penjelasan & Rationale:</span>
                                                            <p className="simanta-explanation-text">{msg.quiz.explanation}</p>
                                                        </div>
                                                    )}

                                                    <div className="simanta-quiz-feedback-actions">
                                                        <button
                                                            type="button"
                                                            className="simanta-quiz-next-btn"
                                                            onClick={() => handleSendMessage('Beri saya latihan kuis berikutnya')}
                                                        >
                                                            🔄 Soal Selanjutnya
                                                        </button>
                                                        {msg.quiz.explanation && (
                                                            <button
                                                                type="button"
                                                                className="simanta-quiz-speak-btn"
                                                                onClick={() => handleToggleSpeak(msg.quiz.explanation, idx)}
                                                                title="Dengarkan penjelasan suara"
                                                            >
                                                                🔊 Baca Penjelasan
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Kartu Rangkuman Cerdas & Key Takeaways (Smart Course Summarizer) */}
                                    {msg.summary && (
                                        <div className="simanta-summary-card">
                                            <div className="simanta-summary-header">
                                                <div className="simanta-summary-badge">
                                                    <span className="simanta-summary-badge-icon">📑</span>
                                                    <span className="simanta-summary-badge-text">Rangkuman Cerdas Modul</span>
                                                </div>
                                                {msg.summary.course_title && (
                                                    <span className="simanta-summary-course-tag" title={msg.summary.course_title}>
                                                        📖 {msg.summary.course_title}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="simanta-summary-topic-box">
                                                <span className="simanta-summary-topic-title">{msg.summary.topic}</span>
                                            </div>

                                            {/* Golden Takeaways */}
                                            {msg.summary.takeaways && msg.summary.takeaways.length > 0 && (
                                                <div className="simanta-summary-section">
                                                    <span className="simanta-summary-section-label">🎯 Poin Kunci Utama (Golden Takeaways):</span>
                                                    <ul className="simanta-summary-takeaways-list">
                                                        {msg.summary.takeaways.map((takeaway, tIdx) => (
                                                            <li key={tIdx} className="simanta-summary-takeaway-item">
                                                                <span className="simanta-takeaway-bullet">✓</span>
                                                                <span className="simanta-takeaway-text">{takeaway}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Action Steps */}
                                            {msg.summary.action_steps && msg.summary.action_steps.length > 0 && (
                                                <div className="simanta-summary-action-box">
                                                    <span className="simanta-action-box-label">⚡ Langkah Penerapan di Setjen DPD RI:</span>
                                                    <ul className="simanta-summary-action-list">
                                                        {msg.summary.action_steps.map((step, sIdx) => (
                                                            <li key={sIdx} className="simanta-summary-action-item">
                                                                <span className="simanta-action-step-num">•</span>
                                                                <span className="simanta-action-step-text">{step}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Footer Action Bar: Simpan ke Catatan, Salin & Suara */}
                                            <div className="simanta-summary-footer">
                                                {(() => {
                                                    const noteState = savedNotes[msg.summary.id];
                                                    const isSaved = noteState?.status === 'saved';
                                                    const isSaving = noteState?.status === 'saving';

                                                    return (
                                                        <button
                                                            type="button"
                                                            className={`simanta-save-note-btn ${isSaved ? 'saved' : ''}`}
                                                            disabled={isSaved || isSaving}
                                                            onClick={() => handleSaveSummaryToNotes(msg.summary)}
                                                            title="Simpan rangkuman ini ke menu Catatan Belajar Anda"
                                                        >
                                                            {isSaving ? (
                                                                <>⏳ Menyimpan...</>
                                                            ) : isSaved ? (
                                                                <>✅ Tersimpan di Catatan Belajar</>
                                                            ) : (
                                                                <>📝 Simpan ke Catatan Saya</>
                                                            )}
                                                        </button>
                                                    );
                                                })()}

                                                <button
                                                    type="button"
                                                    className="simanta-copy-summary-btn"
                                                    onClick={() => handleCopySummary(msg.summary)}
                                                    title="Salin isi rangkuman ke papan klip"
                                                >
                                                    {copiedSummaryId === msg.summary.id ? '✅ Tersalin!' : '📋 Salin'}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="simanta-tts-summary-btn"
                                                    onClick={() => handleToggleSpeak(msg.summary.plain_text_note || msg.text, idx)}
                                                    title="Dengarkan pembacaan rangkuman suara"
                                                >
                                                    🔊 Baca
                                                </button>
                                            </div>

                                            {/* Feedback alert link & preview jika berhasil disimpan */}
                                            {savedNotes[msg.summary.id]?.status === 'saved' && (() => {
                                                const noteState = savedNotes[msg.summary.id];
                                                const noteData = noteState?.note;
                                                const targetCourseUrl = noteData?.note_url || (noteData?.enrollment_id ? `/student/courses/${noteData.enrollment_id}/` : (msg.summary.course_player_url || '/student/courses/'));
                                                const isPreviewOpen = !!previewNoteIds[msg.summary.id];

                                                return (
                                                    <div className="simanta-saved-note-container">
                                                        <div className="simanta-saved-note-toast">
                                                             <div className="simanta-saved-note-info">
                                                                 <span className="simanta-saved-badge">✅ Tersimpan</span>
                                                                 <span className="simanta-saved-text">
                                                                     Tersimpan di <strong>Catatan Belajar</strong> {noteData?.course_title ? `(${noteData.course_title})` : ''}
                                                                 </span>
                                                             </div>
                                                             <div className="simanta-saved-actions">
                                                                 <button
                                                                     type="button"
                                                                     className="simanta-note-preview-toggle-btn"
                                                                     onClick={() => setPreviewNoteIds((prev) => ({ ...prev, [msg.summary.id]: !prev[msg.summary.id] }))}
                                                                     title="Buka / tutup pratinjau isi catatan"
                                                                 >
                                                                     👁️ {isPreviewOpen ? 'Tutup' : 'Pratinjau'}
                                                                 </button>
                                                                 <Link
                                                                     to={targetCourseUrl}
                                                                     className="simanta-view-notes-link"
                                                                     onClick={() => setIsChatOpen(false)}
                                                                     title="Buka Ruang Belajar Kursus pada Tab Catatan Saya"
                                                                 >
                                                                     📖 Buka di Ruang Belajar ↗
                                                                 </Link>
                                                             </div>
                                                        </div>

                                                        {/* Collapsible Inline Preview */}
                                                        {isPreviewOpen && (
                                                            <div className="simanta-saved-note-inline-box">
                                                                <div className="simanta-note-inline-header">
                                                                    <span className="simanta-note-inline-title">
                                                                        <i className="fas fa-sticky-note me-1 text-emerald"></i>
                                                                        {noteData?.title || msg.summary.title}
                                                                    </span>
                                                                    <span className="simanta-note-inline-meta">
                                                                        {noteData?.date || 'Baru saja'}
                                                                    </span>
                                                                </div>
                                                                <pre className="simanta-note-inline-content">
                                                                    {noteData?.content || msg.summary.plain_text_note || msg.summary.content}
                                                                </pre>
                                                                <div className="simanta-note-inline-hint">
                                                                    💡 <em>Catatan ini juga dapat Anda temukan kapan saja di <strong>Ruang Belajar Kursus &gt; Tab Catatan Saya</strong> (di bawah materi video).</em>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Tampilan Daftar Catatan Belajar Pengguna (User Notes Navigator) */}
                                    {msg.user_notes && msg.user_notes.length > 0 && (
                                        <div className="simanta-user-notes-card">
                                            <div className="simanta-user-notes-header">
                                                <span className="simanta-user-notes-title">
                                                    <i className="fas fa-book-bookmark me-1 text-teal"></i>
                                                    Catatan Belajar Anda ({msg.user_notes.length})
                                                </span>
                                            </div>
                                            <div className="simanta-user-notes-list">
                                                {msg.user_notes.map((noteItem) => (
                                                    <div key={noteItem.id || noteItem.note_id} className="simanta-user-note-item">
                                                        <div className="simanta-user-note-top">
                                                            <strong className="simanta-user-note-item-title">{noteItem.title}</strong>
                                                            <span className="simanta-user-note-date">{noteItem.date}</span>
                                                        </div>
                                                        <div className="simanta-user-note-course">
                                                            📚 {noteItem.course_title}
                                                        </div>
                                                        {noteItem.content && (
                                                            <p className="simanta-user-note-snippet">
                                                                {noteItem.content.length > 130 ? `${noteItem.content.slice(0, 130)}...` : noteItem.content}
                                                            </p>
                                                        )}
                                                        <div className="simanta-user-note-actions">
                                                            <Link
                                                                to={noteItem.open_url}
                                                                className="simanta-user-note-btn"
                                                                onClick={() => setIsChatOpen(false)}
                                                            >
                                                                📖 Buka di Ruang Belajar ↗
                                                            </Link>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Rekomendasi Modul & Materi Spesifik (Deep Syllabus Search) */}
                                    {msg.lessons && msg.lessons.length > 0 && (
                                        <div className="simanta-recommended-lessons">
                                            {msg.lessons.map((lesson, lIdx) => (
                                                <div key={lesson.id || lIdx} className="simanta-lesson-card">
                                                    <div className="simanta-lesson-header">
                                                        <span className="simanta-lesson-type-badge">
                                                            {lesson.item_type === 'quiz' ? '📝 Kuis' : '🎬 Modul'}
                                                        </span>
                                                        {lesson.duration && (
                                                            <span className="simanta-lesson-duration">
                                                                ⏱️ {lesson.duration}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="simanta-lesson-body">
                                                        <span className="simanta-lesson-title">{lesson.title}</span>
                                                        <span className="simanta-lesson-meta">
                                                            {lesson.chapter && <span className="simanta-lesson-chapter">Bab: {lesson.chapter}</span>}
                                                            <span className="simanta-lesson-course">Pelatihan: {lesson.course_title}</span>
                                                        </span>
                                                    </div>
                                                    <div className="simanta-lesson-footer">
                                                        <Link
                                                            to={lesson.action_url || `/course-detail/${lesson.course_slug}/`}
                                                            className="simanta-lesson-btn"
                                                            onClick={() => setIsChatOpen(false)}
                                                            title={`Buka ${lesson.title}`}
                                                        >
                                                            {lesson.is_enrolled ? '▶️ Lanjut Belajar' : '📖 Silabus'}
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Rekomendasi Kursus dari Database LMS */}
                                    {msg.courses && msg.courses.length > 0 && (
                                        <div className="simanta-recommended-courses">
                                            {msg.courses.map((course) => (
                                                <Link
                                                    key={course.id || course.slug}
                                                    to={`/course-detail/${course.slug}/`}
                                                    className="simanta-course-card"
                                                    onClick={() => setIsChatOpen(false)}
                                                    title={`Buka kursus: ${course.title}`}
                                                >
                                                    <span className="simanta-course-card-title">📖 {course.title}</span>
                                                    <span className="simanta-course-card-cat">{course.category}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}

                                    {/* Tombol Aksi Cepat (Quick Action Buttons) */}
                                    {msg.actions && msg.actions.length > 0 && (
                                        <div className="simanta-msg-actions">
                                            {msg.actions.map((act, actIdx) => (
                                                <button
                                                    key={actIdx}
                                                    type="button"
                                                    className="simanta-action-btn"
                                                    onClick={() => handleActionClick(act)}
                                                >
                                                    {act.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="simanta-msg-meta">
                                    <span className="simanta-msg-time">{msg.time}</span>
                                    {msg.sender === 'bot' && (
                                        <button
                                            type="button"
                                            className={`simanta-tts-btn ${speakingIdx === idx ? 'active' : ''}`}
                                            onClick={() => handleToggleSpeak(msg.text, idx)}
                                            title={speakingIdx === idx ? "Hentikan suara pembacaan" : "Dengarkan suara Manta"}
                                            aria-label={speakingIdx === idx ? "Hentikan suara" : "Dengarkan pesan"}
                                        >
                                            {speakingIdx === idx ? '⏹️' : '🔊'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div className="simanta-msg simanta-msg-bot">
                                <div className="simanta-msg-content" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className="simanta-status-dot" style={{ background: '#0d6efd' }} />
                                    <span style={{ fontSize: 11, color: '#64748b' }}>Manta sedang mengetik...</span>
                                </div>
                            </div>
                        )}

                        {/* Rekomendasi Pertanyaan Cepat */}
                        <div className="simanta-chips-container">
                            {quickChips.map((item, index) => (
                                <button
                                    key={index}
                                    className="simanta-chip"
                                    onClick={() => handleSendMessage(item.query)}
                                    title={item.query}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input Area */}
                    <footer className="simanta-chat-footer">
                        <input
                            type="text"
                            className="simanta-chat-input"
                            placeholder={isListening ? "Mendengarkan suara Anda... (Bicaralah sekarang)" : "Tanya Manta..."}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            type="button"
                            className={`simanta-mic-btn ${isListening ? 'active' : ''}`}
                            onClick={handleToggleSpeechRecognition}
                            title={isListening ? "Sedang mendengarkan... Klik untuk berhenti" : "Ketik dengan suara (Mikrofon)"}
                            aria-label={isListening ? "Berhenti merekam suara" : "Mulai merekam suara"}
                        >
                            {isListening ? '🛑' : '🎙️'}
                        </button>
                        <button
                            className="simanta-chat-send-btn"
                            onClick={() => handleSendMessage()}
                            disabled={!inputText.trim()}
                            title="Kirim pesan"
                            aria-label="Kirim pesan"
                        >
                            ➤
                        </button>
                    </footer>
                </section>
            )}
        </aside>
    );
};

export default React.memo(SiMantaAvatar);
