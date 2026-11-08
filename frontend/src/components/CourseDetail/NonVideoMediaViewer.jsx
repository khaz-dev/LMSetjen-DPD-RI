import React, { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { getMediaUrl } from '../../utils/constants';
import Toast from '../../views/plugin/Toast';
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
    seekPosition = 0
}, ref) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isCompleted, setIsCompleted] = useState(false);

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

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };
    const youtubeId = isYouTube ? getYoutubeId(rawFile) : null;

    // Sinkronisasi status selesai dari data kursus
    useEffect(() => {
        const completed = variantItem?.is_completed || course?.completed_lesson?.some(
            cl => cl.variant_item?.variant_item_id === variantItem?.variant_item_id
        );
        setIsCompleted(Boolean(completed));
    }, [variantItem, course]);

    // Expose seekToPosition untuk Manta AI Jump to Audio Timestamp
    useImperativeHandle(ref, () => ({
        seekToPosition: (seconds) => {
            const sec = Math.max(0, Math.floor(Number(seconds) || 0));
            if (audioRef.current) {
                audioRef.current.currentTime = sec;
                audioRef.current.play().catch(() => {});
                setIsPlaying(true);
            }
        }
    }), []);

    // Handle initial seekPosition
    useEffect(() => {
        if (isAudio && audioRef.current && seekPosition > 0) {
            audioRef.current.currentTime = seekPosition;
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    }, [isAudio, seekPosition, variantItem?.variant_item_id]);

    const formatTime = (secs) => {
        if (isNaN(secs) || secs < 0) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleToggleAudio = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        }
    };

    const handleMarkComplete = () => {
        if (handleMarkLessonAsCompleted && variantItem?.variant_item_id) {
            handleMarkLessonAsCompleted(variantItem.variant_item_id, true);
            setIsCompleted(true);
            Toast().fire({
                icon: 'success',
                title: 'Materi Telah Diselesaikan',
                text: `Progres pembelajaran "${variantItem.title}" berhasil dicatat.`,
                timer: 3000
            });
        }
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
        <div className="video-player-inline non-video-media-viewer" style={{ minHeight: '440px', display: 'flex', flexDirection: 'column' }}>
            {/* Header Eksekutif Setjen DPD RI */}
            <div className="video-player-header">
                <div className="video-player-header-left">
                    <div className="video-player-icon-box" style={{ background: typeBadge.color }}>
                        <i className={typeBadge.icon}></i>
                    </div>
                    <div className="video-player-title-box">
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge px-2 py-0" style={{ background: typeBadge.color, fontSize: '10px' }}>
                                {typeBadge.label}
                            </span>
                            <span className="video-player-lesson-title text-truncate" title={variantItem?.title}>
                                {variantItem?.title || 'Materi Pembelajaran'}
                            </span>
                        </div>
                        {variantContext?.title && (
                            <small className="text-white-50 d-block" style={{ fontSize: '11px' }}>
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
                    ) : (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-light py-1 px-2 fw-semibold"
                            style={{ fontSize: '11px', borderRadius: '6px' }}
                            onClick={handleMarkComplete}
                            title="Tandai materi ini sudah Anda baca / pelajari"
                        >
                            <i className="fas fa-check me-1"></i>Tandai Selesai
                        </button>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            className="btn btn-sm btn-link text-white-50 p-1"
                            onClick={onClose}
                            title="Tutup penampil materi"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Konten Penampil Media */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#031716', color: '#fff' }}>
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
                            src={fileUrl}
                            onTimeUpdate={() => {
                                if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                            }}
                            onLoadedMetadata={() => {
                                if (audioRef.current) setDuration(audioRef.current.duration);
                            }}
                            onEnded={() => {
                                setIsPlaying(false);
                                if (!isCompleted) handleMarkComplete();
                            }}
                        />

                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center shadow-lg mb-3"
                            style={{
                                width: '100px',
                                height: '100px',
                                background: 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                                color: '#fff',
                                fontSize: '2.5rem'
                            }}
                        >
                            <i className={isPlaying ? "fas fa-waveform-lines fa-beat-fade" : "fas fa-headphones"}></i>
                        </div>

                        <h5 className="fw-bold mb-1 text-white">{variantItem?.title}</h5>
                        <p className="text-white-50 small mb-3">Audio Podcast Pembelajaran &bull; Setjen DPD RI</p>

                        {/* Audio Progress Slider */}
                        <div className="w-100" style={{ maxWidth: '480px' }}>
                            <div className="d-flex justify-content-between text-white-50 small mb-1" style={{ fontSize: '11px' }}>
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                            <input
                                type="range"
                                className="form-range"
                                min="0"
                                max={duration || 100}
                                value={currentTime}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setCurrentTime(val);
                                    if (audioRef.current) audioRef.current.currentTime = val;
                                }}
                                style={{ accentColor: '#2dd4bf' }}
                            />
                            <div className="d-flex justify-content-center gap-3 mt-3">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light rounded-circle"
                                    style={{ width: '38px', height: '38px' }}
                                    onClick={() => {
                                        if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 10);
                                    }}
                                    title="Mundur 10 detik"
                                >
                                    <i className="fas fa-undo"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-teal rounded-circle d-flex align-items-center justify-content-center"
                                    style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}
                                    onClick={handleToggleAudio}
                                >
                                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light rounded-circle"
                                    style={{ width: '38px', height: '38px' }}
                                    onClick={() => {
                                        if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 10);
                                    }}
                                    title="Maju 10 detik"
                                >
                                    <i className="fas fa-redo"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isPdf && (
                    <div style={{ flex: 1, minHeight: '520px', position: 'relative' }}>
                        <iframe
                            src={`${fileUrl}#toolbar=1&navpanes=0`}
                            title={variantItem?.title || 'Dokumen PDF'}
                            style={{ width: '100%', height: '100%', minHeight: '520px', border: 'none', background: '#fff' }}
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
                            <iframe
                                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                                title={variantItem?.title || 'Paparan Slide PPTX'}
                                style={{ width: '100%', height: '100%', minHeight: '520px', border: 'none', background: '#fff' }}
                            />
                        )}
                    </div>
                )}

                {(isWordDoc || isExternalLink || (!isYouTube && !isGDrive && !isAudio && !isPdf && !isPresentation)) && (
                    <div className="p-4 d-flex flex-column align-items-center justify-content-center text-center my-auto">
                        <div
                            className="rounded-4 d-flex align-items-center justify-content-center shadow-lg mb-3"
                            style={{
                                width: '90px',
                                height: '90px',
                                background: typeBadge.color,
                                color: '#fff',
                                fontSize: '2.5rem'
                            }}
                        >
                            <i className={typeBadge.icon}></i>
                        </div>
                        <h5 className="fw-bold mb-1 text-white">{variantItem?.title}</h5>
                        <p className="text-white-50 small mb-3" style={{ maxWidth: '460px' }}>
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
                                className="btn btn-outline-light px-3 py-2 fw-semibold"
                            >
                                <i className="fas fa-download me-1"></i>Unduh Berkas
                            </a>
                        </div>
                    </div>
                )}

                {/* Bottom Bar Panduan */}
                <div
                    className="px-3 py-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2"
                    style={{ background: '#021a1a', borderColor: 'rgba(45, 212, 191, 0.2) !important', fontSize: '11px' }}
                >
                    <div className="text-white-50">
                        <i className="fas fa-info-circle me-1 text-teal"></i>
                        Setelah mempelajari materi {typeBadge.label.toLowerCase()} ini, klik <strong>Tandai Selesai</strong> untuk membuka bab selanjutnya.
                    </div>
                    {!isCompleted && (
                        <button
                            type="button"
                            className="btn btn-sm btn-teal py-0 px-2 fw-semibold"
                            onClick={handleMarkComplete}
                        >
                            <i className="fas fa-check me-1"></i>Selesaikan Modul
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

NonVideoMediaViewer.displayName = 'NonVideoMediaViewer';
export default NonVideoMediaViewer;
