import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiInstance from '../../utils/axios';
import './SiMantaAvatar.css';

// Import sprite assets (WebP format with fallback)
import mantaTabletIdleWebp from '../../assets/avatar/manta-tablet-idle.webp';
import mantaTabletWaveWebp from '../../assets/avatar/manta-tablet-wave.webp';
import mantaHappyWebp from '../../assets/avatar/manta-happy.webp';
import mantaIdleWebp from '../../assets/avatar/manta-idle.webp';

// Saran pertanyaan cepat bawaan
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
    // 1. Validasi konteks: Jangan tampilkan jika dalam iframe (SCORM player) atau player page
    const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
    const isPlayerPage = typeof window !== 'undefined' && window.location.pathname.includes('/modules/') && window.location.pathname.includes('/player');

    if (isInsideIframe || isPlayerPage) {
        return null;
    }

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

    // Chat state
    const [chatMessages, setChatMessages] = useState([
        {
            sender: 'bot',
            text: 'Halo! Saya Manta, Asisten AI Virtual LMS Setjen DPD RI 👋 Ada topik atau bantuan pembelajaran yang ingin Anda tanyakan?',
            time: 'Baru saja',
            courses: []
        }
    ]);
    const [quickChips, setQuickChips] = useState(DEFAULT_SUGGESTIONS);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatBodyRef = useRef(null);

    // Auto-scroll chat body
    useEffect(() => {
        if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        }
    }, [chatMessages, isTyping, isChatOpen]);

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

    // Kirim pesan interaktif ke Backend AI
    const handleSendMessage = async (textToSend) => {
        const query = textToSend || inputText.trim();
        if (!query) return;

        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        setChatMessages((prev) => [
            ...prev,
            { sender: 'user', text: query, time: timeString, courses: [] }
        ]);
        setInputText('');
        setIsTyping(true);
        setPose('wave');

        try {
            // Panggil Backend AI LMS Setjen DPD RI
            const response = await apiInstance.post('ai/chat/', {
                message: query,
                history: chatMessages.slice(-6).map((m) => ({
                    role: m.sender === 'user' ? 'user' : 'assistant',
                    content: m.text
                }))
            });

            if (response.data && response.data.status === 'success') {
                const replyText = response.data.reply;
                const recCourses = response.data.recommended_courses || [];
                const nextSuggestions = response.data.suggested_questions || [];

                setChatMessages((prev) => [
                    ...prev,
                    {
                        sender: 'bot',
                        text: replyText,
                        time: timeString,
                        courses: recCourses
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
                if (/sertifikat|lulus|skor/i.test(query)) {
                    localReply = '📜 **Panduan Sertifikat:** Sertifikat resmi otomatis terbit di menu **Sertifikat Saya** setelah Anda menyelesaikan seluruh materi dan lulus kuis evaluasi akhir.';
                } else if (/kursus|materi|kelas/i.test(query)) {
                    localReply = '📚 **Katalog Kursus:** Silakan jelajahi katalog kursus pembelajaran kami pada bilah navigasi atas untuk melihat seluruh pelatihan resmi Setjen DPD RI.';
                } else if (/halo|hai|pagi|siang|sore|malam/i.test(query)) {
                    localReply = 'Halo! Saya Manta, Asisten LMS Setjen DPD RI 👋 Ada topik kursus atau materi yang ingin Anda tanyakan?';
                } else {
                    localReply = 'Mohon maaf, saat ini server AI sedang memuat ulang atau tidak terhubung ke backend. Silakan coba kembali sesaat lagi.';
                }

                setChatMessages((prev) => [
                    ...prev,
                    {
                        sender: 'bot',
                        text: localReply,
                        time: timeString,
                        courses: []
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

                    {/* Balon Sapaan (Speech Bubble) */}
                    {showBubble && !isChatOpen && (
                        <div 
                            className="simanta-speech-bubble"
                            onClick={handleAvatarClick}
                            role="button"
                            tabIndex={0}
                        >
                            <span>Halo! Saya Manta 👋 Ada yang bisa dibantu?</span>
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
                        {chatMessages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`simanta-msg ${msg.sender === 'user' ? 'simanta-msg-user' : 'simanta-msg-bot'}`}
                            >
                                <div className="simanta-msg-content">
                                    {renderFormattedMessageText(msg.text)}

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
                                </div>
                                <span className="simanta-msg-time">{msg.time}</span>
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
                            placeholder="Tanya Manta..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
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
