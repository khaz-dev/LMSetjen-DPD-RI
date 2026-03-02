import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { extractGoogleDriveFileId } from "../../utils/videoContentUtils";
import useAxios from "../../utils/useAxios"; // ✨ PHASE 4.143: For fetching completion question
import UserData from "../../views/plugin/UserData"; // ✨ PHASE 4.144+: Get studentId
import LessonCompletionQuestionModal from "./LessonCompletionQuestionModal"; // ✨ PHASE 4.143
import "./VideoPlayerGoogle.css";

// ✨ PHASE 4.142: VideoPlayerGoogle - Standalone Google Drive iframe player
// Handles: Google Drive shared video files
// Features:
// - /preview endpoint for direct embed
// - Limited controls (Start from Beginning, Fullscreen only)
// - 5-second click window for native Google Drive controls
// - Auto-hide buttons after 1 second of mouse inactivity
// - Progress tracking: Timer (MM:SS) + Percentage + Duration (MM:SS)
// - 5-second delay before progress timer starts
// - Auto-mark lesson as completed when duration is reached
// - Save progress to database every 5 seconds
// - Reset timer with 5-second delay when "Start from Beginning" button clicked
// LIMITED: Custom play/pause not supported (Google Drive iframe sandbox restrictions)

const VideoPlayerGoogle = forwardRef(({
    variantItem,
    variantContext,  // ✨ PHASE 6.3: Bagian/section context for header display
    onClose,
    handleMarkLessonAsCompleted,
    courseId,  // ✨ PHASE 4.144+: Add courseId prop for completion endpoint
    autoplay = false,
    onPlayingChange,
    onProgress,
    seekPosition,
}, ref) => {
    const API = useAxios; // ✨ PHASE 4.144: FIX - useAxios is an axios instance, not a hook function
    const [loadError, setLoadError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mouseActive, setMouseActive] = useState(false);
    const [googleDriveClickExpired, setGoogleDriveClickExpired] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [timerStarted, setTimerStarted] = useState(false);  // ✨ PHASE 4.142: 5-second delay before timer starts
    const [progressPercentage, setProgressPercentage] = useState(0);  // ✨ PHASE 4.142: Track progress %
    const [durationSeconds, setDurationSeconds] = useState(0);  // ✨ PHASE 4.142: Total duration in seconds
    const [completionQuestion, setCompletionQuestion] = useState(null); // ✨ PHASE 4.143: Question to answer before marking complete
    const [showQuestionModal, setShowQuestionModal] = useState(false); // ✨ PHASE 4.143: Show question modal
    const lastSaveTimeRef = useRef(0);  // ✨ PHASE 4.142: Track last save time
    const isCompletedRef = useRef(false);  // ✨ PHASE 4.142: Guard to prevent infinite loop - marks when completion fired

    const iframeRef = useRef(null);
    const iframeContainerRef = useRef(null);
    const mouseInactiveTimer = useRef(null);

    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE 4.142: Expose seek method via ref (limited functionality for Google Drive)
    useImperativeHandle(ref, () => ({
        togglePlayPause: () => {
        },
        seekToPosition: () => {
        }
    }), []);

    const handleClose = () => {
        if (onClose) onClose();
    };

    // Convert Google Drive URLs to preview embed
    const convertGoogleDriveUrl = (url) => {
        if (!url || typeof url !== 'string') return url;
        
        if (url.includes('drive.google.com')) {
            const fileId = extractGoogleDriveFileId(url);
            if (fileId) {
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }
        
        return url;
    };

    const videoUrl = convertGoogleDriveUrl(variantItem.file);

    const handleFullscreen = () => {
        const targetElement = iframeContainerRef.current;
        
        if (targetElement) {
            if (!isFullscreen) {
                if (targetElement.requestFullscreen) {
                    targetElement.requestFullscreen();
                    setIsFullscreen(true);
                } else if (targetElement.webkitRequestFullscreen) {
                    targetElement.webkitRequestFullscreen();
                    setIsFullscreen(true);
                }
            } else {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    setIsFullscreen(false);
                } else if (document.webkitFullscreenElement) {
                    document.webkitExitFullscreen();
                    setIsFullscreen(false);
                }
            }
        }
    };

    const handleRestartVideo = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src;
            setGoogleDriveClickExpired(false);
        }
        // ✨ PHASE 4.142: Reset timer with 5-second delay when restart button is clicked
        setElapsedTime(0);
        setTimerStarted(false);
        setProgressPercentage(0);
        lastSaveTimeRef.current = 0;
        isCompletedRef.current = false;  // ✨ PHASE 4.142: Reset completion guard
    };

    // ✨ PHASE 4.143: Fetch and show completion question
    const fetchCompletionQuestion = async () => {
        try {
            const response = await API.get(`/lesson-completion-question/?variant_item_id=${variantItem?.variant_item_id}`);
            if (response.data.results && response.data.results.length > 0) {
                setCompletionQuestion(response.data.results[0]);
                setShowQuestionModal(true);
            } else {
                // No question exists, mark lesson complete immediately
                if (handleMarkLessonAsCompleted) {
                    handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
                }
            }
        } catch (error) {
            console.error('Error fetching completion question:', error);
            // On error, mark complete anyway to avoid blocking student
            if (handleMarkLessonAsCompleted) {
                handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
            }
        }
    };

    // ✨ PHASE 4.143: Handle successful answer submission
    const handleQuestionAnsweredCorrectly = () => {
        setShowQuestionModal(false);
        if (handleMarkLessonAsCompleted) {
            handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
        }
    };

    // ✨ PHASE 4.143: Handle skipping question
    const handleSkipQuestion = () => {
        setShowQuestionModal(false);
        // Still mark as completed even if skipped
        if (handleMarkLessonAsCompleted) {
            handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
        }
    };

    // ✨ PHASE 4.142: Initialize duration from variant item
    useEffect(() => {
        if (variantItem?.duration_seconds) {
            setDurationSeconds(variantItem.duration_seconds);
        }
    }, [variantItem?.duration_seconds]);

    // ✨ PHASE 4.142: 5-second delay before timer starts (after first user interaction)
    useEffect(() => {
        if (timerStarted) return;

        const delayTimer = setTimeout(() => {
            setTimerStarted(true);
        }, 5000);

        return () => clearTimeout(delayTimer);
    }, [timerStarted]);

    // ✨ PHASE 4.142: Track elapsed time and save progress every 5 seconds
    useEffect(() => {
        if (!timerStarted || durationSeconds === 0) return;

        const progressInterval = setInterval(() => {
            setElapsedTime(prev => {
                const newTime = prev + 0.5;
                
                // Calculate progress percentage
                const newProgress = durationSeconds > 0 ? Math.round((newTime / durationSeconds) * 100) : 0;
                setProgressPercentage(Math.min(newProgress, 100));

                // ✨ PHASE 4.143: Auto-mark as completed when duration is reached (only once)
                // Cap time at duration to prevent overflow
                if (newTime >= durationSeconds) {
                    if (!isCompletedRef.current) {
                        isCompletedRef.current = true;  // Set guard on first time reaching duration
                        
                        // ✨ PHASE 4.144+: Defer completion question fetch to avoid setState-in-setState
                        // Use setTimeout to ensure it runs after this state update completes
                        setTimeout(() => {
                            fetchCompletionQuestion();
                        }, 0);
                    }
                    return durationSeconds;  // Always return duration when exceeded (prevents timer overflow)
                }

                // Save progress every 5 seconds (only while playing)
                const now = Date.now();
                if (now - lastSaveTimeRef.current >= 5000) {
                    lastSaveTimeRef.current = now;
                    
                    if (onProgress) {
                        onProgress({
                            played: durationSeconds > 0 ? newTime / durationSeconds : 0,
                            loaded: 1,
                            duration: durationSeconds,
                            currentTime: newTime
                        });
                    }
                }

                return newTime;
            });
        }, 500);

        return () => clearInterval(progressInterval);
    }, [timerStarted, durationSeconds, handleMarkLessonAsCompleted, variantItem?.variant_item_id, onProgress]);

    // ✨ PHASE 4.142: Notify parent (Google Drive doesn't have easy progress tracking)
    useEffect(() => {
        if (onPlayingChange) {
            onPlayingChange(false);  // Google Drive doesn't expose state
        }
    }, [onPlayingChange]);

    // ✨ PHASE 4.142: Reset click window on load
    useEffect(() => {
        if (videoUrl) {
            setGoogleDriveClickExpired(false);
            // Reset timer on new video
            setElapsedTime(0);
            setTimerStarted(false);
            setProgressPercentage(0);
            lastSaveTimeRef.current = 0;
            isCompletedRef.current = false;  // ✨ PHASE 4.142: Reset completion guard on new video
        }
    }, [videoUrl]);

    // ✨ PHASE 4.142: 5-second timer for click window
    useEffect(() => {
        if (googleDriveClickExpired) return;

        const clickTimer = setTimeout(() => {
            setGoogleDriveClickExpired(true);
        }, 5000);

        return () => clearTimeout(clickTimer);
    }, [googleDriveClickExpired]);

    // ✨ PHASE 4.142: Auto-hide buttons
    useEffect(() => {
        if (!mouseActive) return;

        if (mouseInactiveTimer.current) {
            clearTimeout(mouseInactiveTimer.current);
        }

        mouseInactiveTimer.current = setTimeout(() => {
            setMouseActive(false);
        }, 1000);

        return () => {
            if (mouseInactiveTimer.current) {
                clearTimeout(mouseInactiveTimer.current);
            }
        };
    }, [mouseActive]);

    // Render
    return (
        <div className="video-player-inline">
            {/* Header */}
            <div className="video-player-header">
                <div className="video-player-header-content">
                    <div className="video-player-icon-box">
                        <i className="fab fa-google"></i>
                    </div>
                    <div className="video-player-title-wrapper">
                        {/* ✨ PHASE 6.3: Show Bagian context in title */}
                        <div className="video-player-title">
                            {variantContext ? (
                                <>
                                    <span style={{ fontSize: '0.85em', opacity: 0.9 }}>{variantContext.variantTitle}</span>
                                    <span style={{ margin: '0 0.5rem', opacity: 0.7 }}>|</span>
                                    <span style={{ fontWeight: 600 }}>{variantItem?.title}</span>
                                </>
                            ) : (
                                variantItem?.title
                            )}
                        </div>
                        <small className="video-player-progress-info">
                            {String(Math.floor(elapsedTime / 60)).padStart(2, '0')}:{String(Math.floor(elapsedTime % 60)).padStart(2, '0')} / {String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:{String(Math.floor(durationSeconds % 60)).padStart(2, '0')} | {progressPercentage}%
                        </small>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="btn-close video-player-close-btn"
                    aria-label="Close"
                ></button>
            </div>

            {/* Content */}
            <div className="video-player-content">
                {loadError ? (
                    <div className="video-player-error-container">
                        <i className="fas fa-exclamation-triangle video-player-error-icon"></i>
                        <h5 className="text-white mb-2">Video Gagal Dimuat</h5>
                        <p className="text-muted mb-4">
                            Pastikan file dibagikan dengan akses publik ("Siapa saja yang memiliki link").
                        </p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="btn btn-primary mt-3"
                        >
                            <i className="fas fa-redo me-2"></i>Coba Lagi
                        </button>
                    </div>
                ) : (
                    <div 
                        ref={iframeContainerRef}
                        className="video-player-aspect-ratio-container"
                        onMouseMove={() => setMouseActive(true)}
                        onMouseEnter={() => setMouseActive(true)}
                    >
                        {/* ✨ PHASE 4.142: Overlay Container - Blocks iframe interaction, allows custom buttons */}
                        <div className="overlay-container">
                            <div 
                                className="overlay overlay-h-1"
                                style={{
                                    pointerEvents: 'auto'
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        document.dispatchEvent(new CustomEvent('arrowKeyBlocked', {
                                            detail: { key: e.key },
                                            bubbles: true
                                        }));
                                    }
                                }}
                            />
                            <div 
                                className="overlay overlay-h-2"
                                style={{
                                    pointerEvents: googleDriveClickExpired ? 'auto' : 'none'
                                }}
                                {...(googleDriveClickExpired ? {
                                    onClick: (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("⚠️ Click blocked on overlay-h-2 (5-second window expired)");
                                    },
                                    onKeyDown: (e) => {
                                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            document.dispatchEvent(new CustomEvent('arrowKeyBlocked', {
                                                detail: { key: e.key },
                                                bubbles: true
                                            }));
                                        }
                                    }
                                } : {})}
                            />
                            <div 
                                className="overlay overlay-h-3"
                                style={{
                                    pointerEvents: 'auto'
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        document.dispatchEvent(new CustomEvent('arrowKeyBlocked', {
                                            detail: { key: e.key },
                                            bubbles: true
                                        }));
                                    }
                                }}
                            />
                            <div 
                                className="overlay overlay-h-4"
                                style={{
                                    pointerEvents: 'auto'
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        document.dispatchEvent(new CustomEvent('arrowKeyBlocked', {
                                            detail: { key: e.key },
                                            bubbles: true
                                        }));
                                    }
                                }}
                            />
                        </div>

                        {/* Google Drive Iframe */}
                        <iframe
                            ref={iframeRef}
                            src={videoUrl}
                            className="video-player-iframe"
                            sandbox="allow-scripts allow-same-origin"
                            title="Google Drive video player"
                            onError={() => {
                                setLoadError(true);
                            }}
                        />
                        
                        {/* Limited Control Buttons for Google Drive */}
                        
                        {/* Start from Beginning Button - ✨ PHASE 4.142: Reset timer with 5-sec delay */}
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRestartVideo();
                            }}
                            className="video-player-backward-btn"
                            title="Mulai dari Awal (Timer Reset)"
                            style={{
                                opacity: mouseActive ? 1 : 0,
                                display: 'flex',
                                zIndex: 200
                            }}
                        >
                            <i className="fas fa-redo video-player-backward-icon"></i>
                            <span className="backward-label">Mulai</span>
                        </button>

                        {/* Fullscreen Button */}
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleFullscreen();
                            }}
                            className="video-player-fullscreen-btn"
                            title="Layar Penuh"
                            style={{
                                opacity: mouseActive ? 1 : 0,
                                display: 'flex',
                                zIndex: 200
                            }}
                        >
                            <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}></i>
                        </button>

                        {/* Info: Click Window Hint */}
                        {!googleDriveClickExpired && (
                            <div className="video-player-gdrive-hint">
                                <small>
                                    <i className="fas fa-info-circle me-2"></i>
                                    Klik di video untuk kontrol native (5 detik)
                                </small>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ✨ PHASE 4.143: Lesson Completion Question Modal */}
            {showQuestionModal && completionQuestion && (
                <LessonCompletionQuestionModal
                    question={completionQuestion}
                    variantItemId={variantItem?.variant_item_id}
                    onAnswerCorrect={handleQuestionAnsweredCorrectly}
                    onCancel={handleSkipQuestion}
                    studentId={UserData()?.user_id}  // ✨ PHASE 4.144+: Pass studentId to modal
                />
            )}
        </div>
    );
});

VideoPlayerGoogle.displayName = "VideoPlayerGoogle";
export default VideoPlayerGoogle;
