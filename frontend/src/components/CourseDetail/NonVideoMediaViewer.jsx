import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import apiInstance from '../../utils/axios';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import { getMediaUrl, getApiUrl } from '../../utils/constants';
import Toast from '../../views/plugin/Toast';
import PptxRenderer from '../Common/PptxRenderer';
import PdfRenderer from '../Common/PdfRenderer';
import LessonCompletionQuestionModal from './LessonCompletionQuestionModal';
import './VideoPlayerUnggah.css';

/**
 * NonVideoMediaViewer
 * Pemutar & Penampil Multi-Format Media Pembelajaran LMS Setjen DPD RI:
 * - Audio Pembelajaran (.mp3, .wav, .ogg, .m4a, .aac) dengan seek/timestamp support
 * - Paparan Presentasi (.pptx, .ppt, Google Slides)
 * - Dokumen Kajian / Regulasi (.pdf, .doc, .docx, .txt)
 * - Tautan Materi Eksternal & Referensi Web
 */
const NonVideoMediaViewer = forwardRef(({
    variantItem,
    variantContext,
    onClose,
    handleMarkLessonAsCompleted,
    courseId,
    course,
    seekPosition = 0,
    onProgress
}, ref) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [audioBlobUrl, setAudioBlobUrl] = useState(null);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioError, setAudioError] = useState(null);
    const [justCompletedId, setJustCompletedId] = useState(null);
    const [completionQuestion, setCompletionQuestion] = useState(null);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [isCheckingQuestion, setIsCheckingQuestion] = useState(false);

    // ⭐ State untuk Dokumen (PPTX & PDF) Waktu Membaca Wajib
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [pptxSlideCount, setPptxSlideCount] = useState(0);
    const [docElapsedSeconds, setDocElapsedSeconds] = useState(0);
    const [isDocTimerCompleted, setIsDocTimerCompleted] = useState(false);

    // Refs untuk pelacakan audio & anti-skip
    const maxTimeWatchedRef = useRef(0);
    const onProgressRef = useRef(onProgress);
    const progressStoppedRef = useRef(false);
    const viewerRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // ✨ Sinkronkan status fullscreen dengan browser
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
            setIsFullscreen(isFs);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = () => {
        const target = viewerRef.current;
        if (!target) return;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (target.requestFullscreen) {
                target.requestFullscreen().catch(() => { });
            } else if (target.webkitRequestFullscreen) {
                target.webkitRequestFullscreen().catch(() => { });
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => { });
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen().catch(() => { });
            }
        }
    };

    useEffect(() => {
        onProgressRef.current = onProgress;
    }, [onProgress]);

    const rawFile = variantItem?.file || variantItem?.youtubeLink || variantItem?.gdriveLink || variantItem?.uploadedFile || '';
    const fileUrl = rawFile.startsWith('http') ? rawFile : getMediaUrl(rawFile);
    const ext = rawFile.toLowerCase().split('.').pop().split('?')[0];

    // Klasifikasi Format Media
    const isYouTube = rawFile.includes('youtube.com') || rawFile.includes('youtu.be');
    const isGDrive = rawFile.includes('drive.google.com');
    const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
    const isPdf = ext === 'pdf';
    const isPresentation = ['ppt', 'pptx', 'odp'].includes(ext) || rawFile.includes('docs.google.com/presentation');
    const isWordDoc = ['doc', 'docx', 'odt', 'rtf'].includes(ext);
    const isExternalLink = rawFile.startsWith('http') && !isYouTube && !isGDrive && !isAudio && !isPdf && !isPresentation && !isWordDoc;

    const studentId = UserData()?.user_id || 'guest';
    const currentVId = String(variantItem?.variant_item_id || variantItem?.id || '');
    const docTimerStorageKey = `doc_reading_time_${studentId}_${currentVId}`;

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const youtubeId = isYouTube ? getYoutubeId(rawFile) : null;

    // Helper untuk mem-parsing durasi dari format variatif (detik, mm:ss, hh:mm:ss, "2m 30s")
    const parseTimeToSeconds = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return isFinite(val) && val > 0 ? val : 0;
        if (typeof val === 'string') {
            if (val.includes(':')) {
                const parts = val.split(':').map(p => parseFloat(p) || 0);
                if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                if (parts.length === 2) return (parts[0] * 60) + parts[1];
            }
            let total = 0;
            let matched = false;
            const h = val.match(/(\d+)\s*h/i);
            const m = val.match(/(\d+)\s*m/i);
            const s = val.match(/(\d+)\s*s/i);
            if (h) { total += parseInt(h[1], 10) * 3600; matched = true; }
            if (m) { total += parseInt(m[1], 10) * 60; matched = true; }
            if (s) { total += parseInt(s[1], 10); matched = true; }
            if (matched) return total;
            const num = parseFloat(val);
            if (!isNaN(num) && isFinite(num) && num > 0) return num;
        }
        return 0;
    };

    // Single Source of Truth: Menentukan status selesai berdasarkan course.completed_lesson
    // Logika pencocokan identik 100% dengan LecturesTab.jsx
    const isCompleted = useMemo(() => {
        if (!variantItem) return false;
        const targetVId = String(variantItem.variant_item_id || variantItem.id || "");
        const targetId = String(variantItem.id || "");
        if (!targetVId && !targetId) return false;

        // 1. Jika baru saja diselesaikan di sesi pemutar aktif ini
        if (justCompletedId && (String(justCompletedId) === targetVId || String(justCompletedId) === targetId)) {
            return true;
        }

        // 2. Cek database kurikulum (course.completed_lesson)
        if (!course?.completed_lesson || !Array.isArray(course.completed_lesson)) {
            return false;
        }

        return course.completed_lesson.some(cl => {
            const clVId = String(cl.variant_item?.variant_item_id || cl.variant_item?.id || "");
            const clId = String(cl.variant_item?.id || "");
            return (targetVId && (clVId === targetVId || clId === targetVId)) ||
                (targetId && (clId === targetId || clVId === targetId));
        });
    }, [variantItem, course?.completed_lesson, justCompletedId]);

    // ⭐ Perhitungan Durasi Wajib Membaca Dokumen (PPTX & PDF)
    // - Jika ada durasi eksplisit di materi: gunakan durasi tersebut
    // - Fallback PPTX: 1 slide = 1 menit (60 detik)
    // - Fallback PDF: 1 lembar = 2 menit (120 detik)
    const requiredDocDuration = useMemo(() => {
        if (!isPdf && !isPresentation) return 0;
        const explicit = parseTimeToSeconds(variantItem?.duration) || parseTimeToSeconds(variantItem?.content_duration);
        if (explicit > 0) return explicit;

        if (isPresentation) {
            const slides = pptxSlideCount > 0 ? pptxSlideCount : 2;
            return slides * 60;
        }
        if (isPdf) {
            const pages = pdfPageCount > 0 ? pdfPageCount : 2;
            return pages * 120;
        }
        return 120;
    }, [isPdf, isPresentation, variantItem?.duration, variantItem?.content_duration, pptxSlideCount, pdfPageCount]);

    // ⭐ Memuat & Menyimpan Progress Timer Membaca Dokumen dari LocalStorage
    useEffect(() => {
        if (!isPdf && !isPresentation) return;
        try {
            const saved = localStorage.getItem(docTimerStorageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                const elapsed = Number(parsed.elapsedSeconds) || 0;
                setDocElapsedSeconds(elapsed);
                if (parsed.completed || isCompleted) {
                    setIsDocTimerCompleted(true);
                } else {
                    setIsDocTimerCompleted(false);
                }
            } else {
                setDocElapsedSeconds(0);
                setIsDocTimerCompleted(Boolean(isCompleted));
            }
        } catch (e) {
            setDocElapsedSeconds(0);
            setIsDocTimerCompleted(Boolean(isCompleted));
        }
    }, [currentVId, isPdf, isPresentation, isCompleted, docTimerStorageKey]);

    // Interval Timer Pembacaan Dokumen
    useEffect(() => {
        if ((!isPdf && !isPresentation) || isCompleted || isDocTimerCompleted) return;
        if (requiredDocDuration <= 0) {
            setIsDocTimerCompleted(true);
            return;
        }

        const interval = setInterval(() => {
            setDocElapsedSeconds(prev => {
                const next = prev + 1;
                const done = next >= requiredDocDuration;
                try {
                    localStorage.setItem(docTimerStorageKey, JSON.stringify({
                        elapsedSeconds: next,
                        completed: done
                    }));
                } catch (e) { }
                if (done) {
                    setIsDocTimerCompleted(true);
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isPdf, isPresentation, isCompleted, isDocTimerCompleted, requiredDocDuration, docTimerStorageKey]);

    const remainingDocSeconds = Math.max(0, requiredDocDuration - docElapsedSeconds);
    const isDocReadyToComplete = isCompleted || isDocTimerCompleted || remainingDocSeconds <= 0;

    // Reset modal pertanyaan dan flag sesi lokal saat materi berpindah
    useEffect(() => {
        setJustCompletedId(null);
        setShowQuestionModal(false);
        setCompletionQuestion(null);
        setIsCheckingQuestion(false);
        maxTimeWatchedRef.current = (seekPosition && seekPosition > 0) ? seekPosition : 0;
        progressStoppedRef.current = false;
    }, [variantItem?.variant_item_id]);

    // Listen event lessonAnsweredCorrectly dari modal penyelesaian
    useEffect(() => {
        const handleAnswered = (e) => {
            const eventVId = String(e.detail?.variantItemId || "");
            const currentVId = String(variantItem?.variant_item_id || variantItem?.id || "");
            if (eventVId && currentVId && eventVId === currentVId) {
                setJustCompletedId(currentVId);
                setShowQuestionModal(false);
            }
        };
        window.addEventListener('lessonAnsweredCorrectly', handleAnswered);
        return () => window.removeEventListener('lessonAnsweredCorrectly', handleAnswered);
    }, [variantItem?.variant_item_id]);

    // ⭐ IDM BYPASS FOR AUDIO:
    // Mengambil media via API endpoint `course/media-data/` dalam bentuk Base64 JSON,
    // lalu mengubahnya menjadi Blob URL di memori lokal browser (`blob:http://...`).
    // Ekstensi IDM (Internet Download Manager) TIDAK AKAN mendeteksi atau mencegat skema `blob:`,
    // sehingga pemutaran audio podcast tidak akan terputus atau terhenti tiba-tiba.
    useEffect(() => {
        let isMounted = true;
        let createdUrl = null;

        if (!isAudio || !fileUrl) {
            setAudioBlobUrl(null);
            setAudioLoading(false);
            setAudioError(null);
            return;
        }

        setAudioLoading(true);
        setAudioError(null);

        apiInstance.get(`course/media-data/?file_url=${encodeURIComponent(fileUrl)}`)
            .then((res) => {
                if (!isMounted) return;
                if (res.data?.success && res.data?.data) {
                    const binaryString = atob(res.data.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const mimeType = res.data.mime_type || 'audio/mpeg';
                    const blob = new Blob([bytes], { type: mimeType });
                    createdUrl = URL.createObjectURL(blob);
                    setAudioBlobUrl(createdUrl);
                    setAudioLoading(false);
                } else {
                    throw new Error(res.data?.error || "Gagal memproses data audio.");
                }
            })
            .catch((err) => {
                console.warn("[NonVideoMediaViewer] Media API fetch failed, trying direct blob fallback:", err);
                if (!isMounted) return;

                // Fallback 1: Fetch langsung sebagai blob
                fetch(fileUrl)
                    .then((response) => {
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.blob();
                    })
                    .then((blob) => {
                        if (!isMounted) return;
                        createdUrl = URL.createObjectURL(blob);
                        setAudioBlobUrl(createdUrl);
                        setAudioLoading(false);
                    })
                    .catch((fallbackErr) => {
                        console.warn("[NonVideoMediaViewer] Direct fetch failed, fallback to direct URL:", fallbackErr);
                        if (!isMounted) return;
                        // Fallback 2: Direct fileUrl
                        setAudioBlobUrl(null);
                        setAudioLoading(false);
                    });
            });

        return () => {
            isMounted = false;
            if (createdUrl) {
                URL.revokeObjectURL(createdUrl);
            }
        };
    }, [isAudio, fileUrl, variantItem?.variant_item_id]);

    // Expose seekToPosition untuk Manta AI Jump to Audio Timestamp
    useImperativeHandle(ref, () => ({
        seekToPosition: (seconds) => {
            const sec = Math.max(0, Math.floor(Number(seconds) || 0));
            if (audioRef.current) {
                if (audioRef.current.error) {
                    audioRef.current.load();
                }
                audioRef.current.currentTime = sec;
                const p = audioRef.current.play();
                if (p !== undefined) {
                    p.then(() => {
                        setIsPlaying(true);
                        setAudioError(null);
                    }).catch(() => { });
                }
            }
        }
    }), []);

    // Handle initial seekPosition
    useEffect(() => {
        if (isAudio && audioRef.current && seekPosition > 0) {
            audioRef.current.currentTime = seekPosition;
            const p = audioRef.current.play();
            if (p !== undefined) {
                p.then(() => {
                    setIsPlaying(true);
                    setAudioError(null);
                }).catch(() => { });
            }
        }
    }, [isAudio, seekPosition, variantItem?.variant_item_id, audioBlobUrl]);

    // Helper untuk mem-formatting detik ke "mm:ss"
    const formatTime = (secs) => {
        if (isNaN(secs) || secs < 0) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // ✨ Handler Pemeriksaan & Pemunculan Pertanyaan Penyelesaian Materi
    const fetchCompletionQuestion = async () => {
        if (!variantItem?.variant_item_id) return;
        try {
            setIsCheckingQuestion(true);
            const response = await useAxios.get(`/lesson-completion-question/?variant_item_id=${variantItem.variant_item_id}`);
            setIsCheckingQuestion(false);

            if (response.data?.results && response.data.results.length > 0) {
                // Ada pertanyaan penyelesaian -> munculkan modal verifikasi
                setCompletionQuestion(response.data.results[0]);
                setShowQuestionModal(true);
            } else {
                // Tidak ada pertanyaan -> langsung tandai selesai
                const currentVId = String(variantItem.variant_item_id || variantItem.id || "");
                setJustCompletedId(currentVId);
                if (handleMarkLessonAsCompleted) {
                    handleMarkLessonAsCompleted(variantItem.variant_item_id, false, courseId || course?.course?.id);
                }
                Toast().fire({
                    icon: 'success',
                    title: 'Materi Telah Diselesaikan',
                    text: `Pembelajaran "${variantItem.title || 'Materi'}" telah diselesaikan.`,
                    timer: 3000
                });
            }
        } catch (error) {
            setIsCheckingQuestion(false);
            console.error('[NonVideoMediaViewer] Error checking completion question:', error);
            if (handleMarkLessonAsCompleted) {
                handleMarkLessonAsCompleted(variantItem.variant_item_id, false, courseId || course?.course?.id);
            }
        }
    };

    // ✨ Handler penyelesaian materi manual (untuk PPTX/PDF setelah timer terpenuhi)
    const handleMarkComplete = async () => {
        if (!variantItem?.variant_item_id) return;

        // Jika materi sudah selesai
        if (isCompleted) {
            Toast().fire({
                icon: 'info',
                title: 'Materi Sudah Selesai',
                text: `Materi "${variantItem.title || 'ini'}" telah diselesaikan sebelumnya.`,
                timer: 2500
            });
            return;
        }

        // Untuk Dokumen (PPTX/PDF), pastikan timer membaca wajib telah terpenuhi
        if ((isPdf || isPresentation) && !isDocReadyToComplete) {
            Toast().fire({
                icon: 'warning',
                title: 'Waktu Membaca Belum Terpenuhi',
                text: `Harap pelajari materi ini selama sisa waktu ${formatTime(remainingDocSeconds)} sebelum menandai selesai.`,
                timer: 3000
            });
            return;
        }

        await fetchCompletionQuestion();
    };

    // Handler Anti-Skip pada slider audio (tidak boleh drag maju melebihi waktu yang sudah didengarkan jika belum selesai)
    const handleAudioSliderChange = (e) => {
        const val = Number(e.target.value);
        if (!isCompleted && val > maxTimeWatchedRef.current + 1) {
            const clamped = Math.max(0, maxTimeWatchedRef.current);
            setCurrentTime(clamped);
            if (audioRef.current) audioRef.current.currentTime = clamped;
            Toast().fire({
                icon: 'info',
                title: 'Pemutaran Dibatasi',
                text: 'Anda harus mendengarkan materi audio secara penuh sebelum dapat melompati bagian pemutaran.',
                timer: 2000
            });
        } else {
            setCurrentTime(val);
            if (audioRef.current) audioRef.current.currentTime = val;
        }
    };

    // Handler Maju 10 Detik: Terkunci jika audio belum selesai dipelajari
    const handleForward10 = () => {
        if (!audioRef.current) return;
        if (!isCompleted) {
            Toast().fire({
                icon: 'info',
                title: 'Fitur Terkunci',
                text: 'Tombol maju dinonaktifkan sampai materi audio didengarkan hingga selesai.',
                timer: 2000
            });
            return;
        }
        audioRef.current.currentTime = Math.min(duration, currentTime + 10);
    };

    const handleToggleAudio = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            // Pemulihan otomatis jika elemen audio mengalami error koneksi
            if (audioRef.current.error) {
                const savedTime = audioRef.current.currentTime || currentTime || 0;
                audioRef.current.load();
                audioRef.current.currentTime = savedTime;
            }
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                        setAudioError(null);
                    })
                    .catch((err) => {
                        console.warn("Audio play rejected, attempting recovery:", err);
                        setIsPlaying(false);
                        try {
                            const savedTime = currentTime || 0;
                            audioRef.current.load();
                            audioRef.current.currentTime = savedTime;
                            audioRef.current.play().then(() => {
                                setIsPlaying(true);
                                setAudioError(null);
                            }).catch(() => { });
                        } catch (e) { }
                    });
            }
        }
    };

    const handleQuestionAnsweredCorrectly = () => {
        setShowQuestionModal(false);
        const currentVId = String(variantItem?.variant_item_id || variantItem?.id || "");
        setJustCompletedId(currentVId);
    };

    const handleAnswerWrong = () => {
        // Biarkan modal tetap terbuka untuk menjawab ulang / kembali melihat materi
    };

    const handleCloseModal = () => {
        setShowQuestionModal(false);
    };

    // Tentukan Judul & Ikon Format
    let typeBadge = { icon: 'fas fa-file', label: 'Dokumen', color: '#0d9488' };
    if (isYouTube) typeBadge = { icon: 'fab fa-youtube', label: 'Video YouTube', color: '#dc2626' };
    else if (isGDrive) typeBadge = { icon: 'fab fa-google-drive', label: 'Video Google Drive', color: '#16a34a' };
    else if (isAudio) typeBadge = { icon: 'fas fa-volume-up', label: 'Audio Pembelajaran', color: '#0284c7' };
    else if (isPdf) typeBadge = { icon: 'fas fa-file-pdf', label: 'Dokumen PDF', color: '#e11d48' };
    else if (isPresentation) typeBadge = { icon: 'fas fa-file-powerpoint', label: 'Paparan Presentasi (PPT/PPTX)', color: '#ea580c' };
    else if (isWordDoc) typeBadge = { icon: 'fas fa-file-word', label: 'Dokumen Naskah / Word', color: '#2563eb' };
    else if (isExternalLink) typeBadge = { icon: 'fas fa-external-link-alt', label: 'Tautan Materi Pembelajaran', color: '#7c3aed' };

    return (
        <div ref={viewerRef} className={`video-player-inline non-video-media-viewer ${isFullscreen ? 'is-fullscreen' : ''}`} style={{ minHeight: '440px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Header Eksekutif Setjen DPD RI */}
            <div className="video-player-header">
                <div className="video-player-header-left">
                    <div className="video-player-icon-box" style={{ background: `${typeBadge.color}15`, borderColor: `${typeBadge.color}40`, color: typeBadge.color }}>
                        <i className={typeBadge.icon}></i>
                    </div>
                    <div className="video-player-title-box">
                        <div className="video-title-row">
                            <span className="badge px-2 py-0" style={{ background: typeBadge.color, fontSize: '10px' }}>
                                {typeBadge.label}
                            </span>
                            <OverlayTrigger
                                placement="bottom"
                                overlay={
                                    <Tooltip id={`lesson-title-tip-${variantItem?.variant_item_id || 'active'}`} className="video-player-title-tooltip">
                                        {variantItem?.title || 'Materi Pembelajaran'}
                                    </Tooltip>
                                }
                            >
                                <span className="video-player-lesson-title text-truncate" title={variantItem?.title}>
                                    {variantItem?.title || 'Materi Pembelajaran'}
                                </span>
                            </OverlayTrigger>
                        </div>
                        {variantContext?.title && (
                            <small className="text-muted d-block text-truncate" style={{ fontSize: '11px' }}>
                                Bagian: {variantContext.title}
                            </small>
                        )}
                    </div>
                </div>

                <div className="video-player-header-right d-flex align-items-center gap-2">
                    {isCompleted ? (
                        <span className="badge bg-success text-white px-2 py-1" style={{ fontSize: '11px' }}>
                            <i className="fas fa-check-circle me-1"></i>Selesai
                        </span>
                    ) : (isPdf || isPresentation) ? (
                        // ✨ PDF & Presentasi: Timer dan Tombol Selesaikan Modul cukup di bottom bar (tidak diduplikasi di header)
                        null
                    ) : isAudio ? (
                        // Audio TIDAK memiliki tombol manual Tandai Selesai (selesai otomatis via onEnded + pertanyaan)
                        <span className="badge bg-light text-secondary border px-2 py-1" style={{ fontSize: '11px' }} title="Dengarkan seluruh audio hingga selesai untuk menyelesaikan materi">
                            <i className="fas fa-headphones me-1 text-teal"></i>Dengarkan Penuh
                        </span>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-sm btn-teal py-1 px-2 fw-semibold"
                            style={{ fontSize: '11px', borderRadius: '6px' }}
                            onClick={handleMarkComplete}
                            disabled={isCheckingQuestion}
                            title="Tandai materi ini sudah Anda baca / pelajari"
                        >
                            {isCheckingQuestion ? (
                                <><span className="spinner-border spinner-border-sm me-1" role="status"></span>Cek...</>
                            ) : (
                                <><i className="fas fa-check me-1"></i>Tandai Selesai</>
                            )}
                        </button>
                    )}
                    {/* Fullscreen Toggle Button - Khusus PDF sudah tersedia terpadu di pdf-toolbar */}
                    {!isPdf && (
                        <button
                            type="button"
                            className="btn btn-sm btn-link text-muted p-1"
                            onClick={toggleFullscreen}
                            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                        >
                            <i className={`fas fa-${isFullscreen ? 'compress' : 'expand'}`}></i>
                        </button>
                    )}

                    {onClose && (
                        <button
                            type="button"
                            className="btn btn-sm btn-link text-muted p-1"
                            onClick={onClose}
                            title="Tutup penampil materi"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Konten Penampil Media */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#1e293b' }}>
                {isYouTube && youtubeId && (
                    <div style={{ flex: 1, minHeight: '500px', position: 'relative' }}>
                        <iframe
                            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
                            title={variantItem?.title || 'Video YouTube'}
                            style={{ width: '100%', height: '100%', minHeight: '500px', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                )}

                {isGDrive && (
                    <div style={{ flex: 1, minHeight: '500px', position: 'relative' }}>
                        <iframe
                            src={rawFile.includes('/preview') ? rawFile : rawFile.replace(/\/view(\?.*)?$/, '/preview')}
                            title={variantItem?.title || 'Google Drive Stream'}
                            style={{ width: '100%', height: '100%', minHeight: '500px', border: 'none' }}
                            allow="autoplay; fullscreen"
                            allowFullScreen
                        />
                    </div>
                )}

                {isAudio && (
                    <div className="p-4 d-flex flex-column align-items-center justify-content-center text-center my-auto">
                        <audio
                            ref={audioRef}
                            src={audioBlobUrl || fileUrl}
                            preload="metadata"
                            onTimeUpdate={() => {
                                if (audioRef.current) {
                                    const curTime = audioRef.current.currentTime || 0;
                                    setCurrentTime(curTime);
                                    if (curTime > maxTimeWatchedRef.current) {
                                        maxTimeWatchedRef.current = curTime;
                                    }
                                    const dur = (audioRef.current.duration && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
                                        ? audioRef.current.duration
                                        : duration;
                                    if (dur > 0 && curTime >= dur * 0.95 && !progressStoppedRef.current) {
                                        progressStoppedRef.current = true;
                                    }
                                    if (dur > 0 && !progressStoppedRef.current && onProgressRef.current) {
                                        onProgressRef.current({
                                            played: curTime / dur,
                                            loaded: 1,
                                            duration: dur,
                                            currentTime: curTime
                                        });
                                    }
                                }
                            }}
                            onLoadedMetadata={() => {
                                if (audioRef.current) {
                                    setDuration(audioRef.current.duration);
                                    setAudioError(null);
                                }
                            }}
                            onPlay={() => {
                                setIsPlaying(true);
                                setAudioError(null);
                            }}
                            onPause={() => {
                                setIsPlaying(false);
                            }}
                            onError={(e) => {
                                console.warn("[NonVideoMediaViewer] Audio error event:", audioRef.current?.error);
                                setIsPlaying(false);
                                setAudioError("Pemutaran audio terputus. Klik tombol putar untuk melanjutkan.");
                            }}
                            onEnded={() => {
                                setIsPlaying(false);
                                // Selesaikan audio secara otomatis dan picu pertanyaan penyelesaian
                                if (!isCompleted) {
                                    fetchCompletionQuestion();
                                }
                            }}
                        />

                        {/* Ikon Audio Dinamis (100% Font Awesome Free Didukung) */}
                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center shadow-lg mb-3"
                            style={{
                                width: '100px',
                                height: '100px',
                                background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                                color: '#fff',
                                fontSize: '2rem'
                            }}
                        >
                            {audioLoading ? (
                                <i className="fas fa-circle-notch fa-spin"></i>
                            ) : isPlaying ? (
                                <i className="fas fa-volume-high fa-beat"></i>
                            ) : (
                                <i className="fas fa-headphones"></i>
                            )}
                        </div>

                        <h5 className="fw-bold mb-1 text-dark">{variantItem?.title}</h5>
                        <p className="text-muted small mb-3">Audio Podcast Pembelajaran &bull; Setjen DPD RI</p>

                        {/* Error or Reconnection Notice */}
                        {audioError && (
                            <div className="alert alert-warning py-1 px-3 mb-3 d-inline-flex align-items-center gap-2 small shadow-sm">
                                <i className="fas fa-exclamation-triangle text-warning"></i>
                                <span>{audioError}</span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold"
                                    onClick={() => {
                                        setAudioError(null);
                                        if (audioRef.current) {
                                            const savedTime = currentTime || 0;
                                            audioRef.current.load();
                                            audioRef.current.currentTime = savedTime;
                                            audioRef.current.play().then(() => {
                                                setIsPlaying(true);
                                                setAudioError(null);
                                            }).catch(() => { });
                                        }
                                    }}
                                >
                                    Coba Lagi
                                </button>
                            </div>
                        )}

                        {/* Audio Progress Slider dengan Anti-Skip */}
                        <div className="w-100" style={{ maxWidth: '480px' }}>
                            <div className="d-flex justify-content-between text-muted small mb-1" style={{ fontSize: '11px' }}>
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                            <input
                                type="range"
                                className="form-range"
                                min="0"
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleAudioSliderChange}
                                style={{ accentColor: '#2dd4bf' }}
                                title={!isCompleted ? "Materi belum selesai: pemutaran tidak dapat dipercepat maju" : "Geser untuk memilih posisi audio"}
                            />
                            <div className="d-flex justify-content-center gap-3 mt-3">
                                {/* Tombol Mundur 10 Detik (Selalu Aktif) */}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary rounded-circle"
                                    style={{ width: '38px', height: '38px' }}
                                    onClick={() => {
                                        if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
                                    }}
                                    title="Mundur 10 detik"
                                >
                                    <i className="fas fa-undo"></i>
                                </button>

                                {/* Tombol Play / Pause */}
                                <button
                                    type="button"
                                    className="btn btn-teal rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                                    style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}
                                    onClick={handleToggleAudio}
                                    disabled={audioLoading}
                                    title={audioLoading ? "Memuat audio..." : (isPlaying ? "Jeda" : "Putar")}
                                >
                                    {audioLoading ? (
                                        <i className="fas fa-spinner fa-spin text-white"></i>
                                    ) : (
                                        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                                    )}
                                </button>

                                {/* Tombol Maju 10 Detik (Terkunci jika belum selesai didengar) */}
                                <button
                                    type="button"
                                    className={`btn btn-sm ${!isCompleted ? 'btn-outline-secondary opacity-50' : 'btn-outline-secondary'} rounded-circle`}
                                    style={{
                                        width: '38px',
                                        height: '38px',
                                        cursor: !isCompleted ? 'not-allowed' : 'pointer'
                                    }}
                                    onClick={handleForward10}
                                    disabled={!isCompleted}
                                    title={!isCompleted ? "Tombol maju dinonaktifkan sampai materi audio selesai didengarkan" : "Maju 10 detik"}
                                >
                                    <i className="fas fa-redo"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isPdf && (
                    <div style={{ flex: 1, minHeight: '520px', position: 'relative' }}>
                        <PdfRenderer
                            fileUrl={fileUrl}
                            height="520px"
                            title={variantItem?.title || 'Dokumen PDF'}
                            showThumbnails={true}
                            onDocLoaded={({ numPages }) => setPdfPageCount(numPages)}
                        />
                    </div>
                )}

                {isPresentation && (
                    <div style={{ flex: 1, minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
                        {rawFile.includes('docs.google.com/presentation') ? (
                            <iframe
                                src={rawFile.replace('/edit', '/embed').replace('/view', '/embed')}
                                title={variantItem?.title || 'Paparan Presentasi'}
                                style={{ width: '100%', height: '100%', minHeight: '520px', border: 'none' }}
                                allowFullScreen
                            />
                        ) : (
                            <PptxRenderer
                                fileUrl={fileUrl}
                                height="560px"
                                showThumbnails={true}
                                showToolbar={true}
                                onPresentationLoaded={(data) => {
                                    const total = data?.total_slides || data?.slides?.length || 0;
                                    setPptxSlideCount(total);
                                }}
                            />
                        )}
                    </div>
                )}

                {isExternalLink && (
                    <div className="flex-grow-1 d-flex flex-column w-100" style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '520px' }}>
                        <div className="p-2 bg-light border-bottom d-flex align-items-center justify-content-between px-3 flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                                <span className="badge text-white px-2 py-1" style={{ backgroundColor: '#7c3aed', fontSize: '11px' }}>
                                    <i className="fas fa-globe me-1"></i>Halaman Web
                                </span>
                                <span className="text-muted small text-truncate font-monospace" style={{ maxWidth: '380px' }} title={fileUrl}>
                                    {fileUrl}
                                </span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-primary py-1 px-3 d-inline-flex align-items-center gap-1 shadow-xs"
                                    style={{ fontSize: '12px' }}
                                >
                                    <i className="fas fa-external-link-alt"></i>
                                    <span>Buka di Tab Baru</span>
                                </a>
                            </div>
                        </div>
                        <div className="flex-grow-1 position-relative w-100" style={{ minHeight: isFullscreen ? 'calc(100vh - 170px)' : '480px', backgroundColor: '#f8fafc' }}>
                            <iframe
                                src={getApiUrl(`course/web-preview/?url=${encodeURIComponent(fileUrl)}`)}
                                title={variantItem?.title || "Halaman Web Pembelajaran"}
                                className="w-100 h-100 border-0"
                                style={{ minHeight: isFullscreen ? 'calc(100vh - 170px)' : '480px', display: 'block' }}
                                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
                                allow="fullscreen"
                                loading="lazy"
                            />
                        </div>
                    </div>
                )}

                {(isWordDoc || (!isYouTube && !isGDrive && !isAudio && !isPdf && !isPresentation && !isExternalLink)) && (
                    <div className="p-4 d-flex flex-column align-items-center justify-content-center text-center my-auto">
                        <div
                            className="rounded-4 d-flex align-items-center justify-content-center shadow-lg mb-3"
                            style={{
                                width: '90px',
                                height: '90px',
                                background: typeBadge.color,
                                color: '#fff',
                                fontSize: '2rem'
                            }}
                        >
                            <i className={typeBadge.icon}></i>
                        </div>
                        <h5 className="fw-bold mb-1 text-dark">{variantItem?.title}</h5>
                        <p className="text-muted small mb-3" style={{ maxWidth: '460px' }}>
                            Materi pembelajaran dalam format {typeBadge.label}. Anda dapat membuka materi ini secara langsung atau mengunduhnya untuk dipelajari.
                        </p>
                        <div className="d-flex gap-2 flex-wrap justify-content-center">
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-teal px-3 py-2 fw-semibold"
                            >
                                <i className="fas fa-external-link-alt me-1"></i>Buka Materi di Tab Baru
                            </a>
                            <a
                                href={fileUrl}
                                download
                                className="btn btn-outline-secondary px-3 py-2 fw-semibold"
                            >
                                <i className="fas fa-download me-1"></i>Unduh Berkas
                            </a>
                        </div>
                    </div>
                )}

                {/* Bottom Bar Panduan & Aksi */}
                <div
                    className="px-3 py-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2"
                    style={{ background: '#ffffff', borderColor: '#e2e8f0', fontSize: '11px' }}
                >
                    <div className="text-muted">
                        {isAudio ? (
                            <>
                                <i className="fas fa-headphones me-1 text-teal"></i>
                                Dengarkan seluruh audio ini hingga selesai untuk membuka evaluasi materi dan bab selanjutnya.
                            </>
                        ) : (isPdf || isPresentation) ? (
                            !isDocReadyToComplete ? (
                                <>
                                    <i className="fas fa-hourglass-half me-1 text-warning"></i>
                                    Harap pelajari materi hingga waktu membaca wajib selesai: <strong>{formatTime(remainingDocSeconds)}</strong> tersisa.
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check-circle me-1 text-success"></i>
                                    Waktu membaca wajib telah terpenuhi. Silakan klik <strong>Selesaikan Modul</strong> untuk melanjutkan.
                                </>
                            )
                        ) : (
                            <>
                                <i className="fas fa-info-circle me-1 text-teal"></i>
                                Setelah mempelajari materi {typeBadge.label.toLowerCase()} ini, klik <strong>Tandai Selesai</strong> untuk membuka bab selanjutnya.
                            </>
                        )}
                    </div>

                    {/* Tombol Aksi Selesaikan Modul (Khusus Audio disembunyikan karena selesai otomatis) */}
                    {!isCompleted && !isAudio && (
                        <button
                            type="button"
                            className={`btn btn-sm ${(isPdf || isPresentation) && !isDocReadyToComplete ? 'btn-secondary' : 'btn-teal'} py-0 px-2 fw-semibold`}
                            onClick={handleMarkComplete}
                            disabled={((isPdf || isPresentation) && !isDocReadyToComplete) || isCheckingQuestion}
                            title={((isPdf || isPresentation) && !isDocReadyToComplete) ? `Waktu membaca tersisa: ${formatTime(remainingDocSeconds)}` : "Selesaikan Modul"}
                        >
                            {isCheckingQuestion ? (
                                <><span className="spinner-border spinner-border-sm me-1" role="status"></span>Memeriksa...</>
                            ) : ((isPdf || isPresentation) && !isDocReadyToComplete) ? (
                                <><i className="fas fa-lock me-1"></i>Selesaikan Modul ({formatTime(remainingDocSeconds)})</>
                            ) : (
                                <><i className="fas fa-check me-1"></i>Selesaikan Modul</>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Modal Pertanyaan Penyelesaian Pelajaran */}
            {showQuestionModal && completionQuestion && (
                <LessonCompletionQuestionModal
                    question={completionQuestion}
                    variantItemId={variantItem?.variant_item_id}
                    onAnswerCorrect={handleQuestionAnsweredCorrectly}
                    onAnswerWrong={handleAnswerWrong}
                    onCloseModal={handleCloseModal}
                    studentId={UserData()?.user_id}
                />
            )}
        </div>
    );
});

NonVideoMediaViewer.displayName = 'NonVideoMediaViewer';
export default NonVideoMediaViewer;
