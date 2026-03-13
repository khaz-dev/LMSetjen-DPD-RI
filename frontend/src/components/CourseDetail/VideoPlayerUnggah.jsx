import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { getMediaUrl } from "../../utils/constants";
import { formatDurationStyle } from "../../utils/durationUtils";
import useAxios from "../../utils/useAxios"; // ✨ PHASE 4.143: For fetching completion question
import UserData from "../../views/plugin/UserData"; // ✨ PHASE 4.144+: Get studentId
import LessonCompletionQuestionModal from "./LessonCompletionQuestionModal"; // ✨ PHASE 4.143
import "./VideoPlayerUnggah.css";

// ✨ PHASE 4.142: VideoPlayerUnggah - Standalone HTML5 uploaded video player
// Handles: MP4, WebM, OGV, MOV, AVI, MKV files (HTML5<video> element)
// Features:
// - Auto-play with smart retry logic based on video readyState
// - Resume from saved position with exponential backoff
// - Play/Pause, backward 5s, fullscreen, progress tracking
// - Auto-hide buttons after 1 second of mouse inactivity
// - Real-time progress reports via onProgress callback
// - Auto-complete lesson when video ends

const VideoPlayerUnggah = forwardRef(({
    variantItem,
    variantContext,  // ✨ PHASE 6.3: Bagian/section context for header display
    onClose,
    handleMarkLessonAsCompleted,
    courseId,  // ✨ PHASE 4.144+: Add courseId prop for completion endpoint
    autoplay = false,
    onPlayingChange,
    onProgress,
    seekPosition,
    course,  // ✨ PHASE 36.1: Pass full course data to check actual completed_lesson array (source of truth)
}, ref) => {
    const [loadError, setLoadError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoplay);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mouseActive, setMouseActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [completionQuestion, setCompletionQuestion] = useState(null); // ✨ PHASE 4.143: Question to answer before marking complete
    const [showQuestionModal, setShowQuestionModal] = useState(false); // ✨ PHASE 4.143: Show question modal
    // ✨ PHASE 39.4: CRITICAL FIX - Only use is_completed for LIMITED/FULL mode detection
    // is_fully_watched is just progress state (watched 95%+), NOT completion state
    // Completion = answered verification question or auto-completed (is_completed=true)
    const [allowVideoAccess, setAllowVideoAccess] = useState(variantItem?.is_completed || false);

    const API = useAxios; // ✨ PHASE 4.143: FIX - useAxios is an axios instance, not a hook function
    const videoRef = useRef(null);
    const onProgressRef = useRef(onProgress);  // ✨ PHASE 4.156: Ref for stable onProgress
    const progressStoppedRef = useRef(false);  // ✨ PHASE 13.2: Track if we've already stopped progress tracking at 95%+
    
    // ✨ PHASE 4.156: Keep ref in sync
    useEffect(() => {
        onProgressRef.current = onProgress;
    }, [onProgress]);

    // ✨ PHASE 13.2: Reset progress tracking flag when lesson changes
    useEffect(() => {
        progressStoppedRef.current = false;
    }, [variantItem?.variant_item_id]);
    
    // ✨ PHASE 11.162: Reset modal state when video changes to prevent persistence
    // ✨ PHASE 11.177: Also reset allowVideoAccess when lesson changes
    // ✨ PHASE 40.1: CRITICAL FIX - Only use is_completed (NOT is_fully_watched) for LIMITED/FULL mode
    // is_fully_watched is progress state (95%+), not completion state
    useEffect(() => {
        setShowQuestionModal(false);
        setCompletionQuestion(null);
        // ✨ PHASE 40.1: Only use is_completed - is_fully_watched causes FULL MODE prematurely at 95% progress
        setAllowVideoAccess(variantItem?.is_completed || false);
    }, [variantItem?.variant_item_id]);
    
    const containerRef = useRef(null);
    const mouseInactiveTimer = useRef(null);

    // Format video timer for display - "00:00 | 00:00 | x%" format
    const formatVideoTimer = () => {
        const hours = Math.floor(currentTime / 3600);
        const minutes = Math.floor((currentTime % 3600) / 60);
        const seconds = Math.floor(currentTime % 60);
        
        const durationHours = Math.floor(duration / 3600);
        const durationMinutes = Math.floor((duration % 3600) / 60);
        const durationSeconds = Math.floor(duration % 60);
        
        const percentage = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;
        
        // Format current time
        let currentTimeStr;
        if (durationHours > 0) {
            currentTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            currentTimeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        // Format duration
        let durationStr;
        if (durationHours > 0) {
            durationStr = `${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;
        } else {
            durationStr = `${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;
        }
        
        return `${currentTimeStr} | ${durationStr} | ${percentage}%`;
    };

    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE 4.152: Define handlePlayPause BEFORE useImperativeHandle to avoid temporal dead zone
    const handlePlayPause = () => {
        if (!videoRef.current) {
            return;
        }

        const video = videoRef.current;
        
        if (isPlaying) {
            // Pause: update state immediately
            video.pause();
            setIsPlaying(false);
        } else {
            // Play: update state immediately for responsive UI
            setIsPlaying(true);
            
            // Attempt to play with enhanced error handling
            const playPromise = video.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                    })
                    .catch(err => {
                        
                        // Check specific error types
                        if (err.name === 'NotAllowedError') {
                            setIsPlaying(false);
                        } else if (err.name === 'NotSupportedError') {
                            setIsPlaying(false);
                        } else if (err.name === 'AbortError') {
                            // Don't revert state for abort errors - user might click again
                        } else {
                            // For unknown errors, keep state as playing since user clicked play
                        }
                    });
            } else {
                // Older browsers don't return promise
            }
        }
    };

    // ✨ PHASE 4.142: Expose play/pause toggle and seek methods via ref
    useImperativeHandle(ref, () => ({
        togglePlayPause: handlePlayPause,
        seekToPosition: (position) => {
            if (videoRef.current) {
                videoRef.current.currentTime = position;
            }
        }
    }), [handlePlayPause]);  // ✨ PHASE 4.152: Include handlePlayPause in dependencies to capture current state

    const handleClose = () => {
        if (onClose) onClose();
    };

    const handleFullscreen = () => {
        const targetElement = containerRef.current;
        
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

    const handleBackward5Seconds = () => {
        if (videoRef.current) {
            const newTime = Math.max(0, videoRef.current.currentTime - 5);
            videoRef.current.currentTime = newTime;
        }
    };

    const handleVideoPlay = () => {
        setIsPlaying(true);
    };

    const handleVideoPause = () => {
        setIsPlaying(false);
    };

    // ✨ PHASE 11.180 FIX: Use useCallback to capture latest allowVideoAccess state
    const handleVideoKeyDown = useCallback((e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // ✨ PHASE 11.180: Only block arrow keys in LIMITED mode (when allowVideoAccess = false)
            // In FULL mode (allowVideoAccess = true), allow keyboard navigation
            if (!allowVideoAccess) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            // In FULL mode, allow the default browser behavior for navigation
        }
    }, [allowVideoAccess]);

    // ✨ PHASE 4.142+: Callback when isPlaying state changes
    useEffect(() => {
        if (onPlayingChange) {
            onPlayingChange(isPlaying);
        }
    }, [isPlaying, onPlayingChange]);

    const handleVideoFocus = (e) => {
        // ✨ PHASE 11.180 FIX: Only blur in LIMITED mode - allow focus in FULL mode for keyboard events
        if (!allowVideoAccess && videoRef.current) {
            videoRef.current.blur();
        }
    };

    // ✨ PHASE 36.1: Check if lesson is actually completed based on course.completed_lesson array
    // This is the source of truth - variantItem.is_completed might not be updated immediately
    const isLessonActuallyCompleted = () => {
        if (!course || !course.completed_lesson) return variantItem?.is_completed || false;
        // Check if this variant_item_id exists in the course's completed_lesson array
        return course.completed_lesson.some(cl => cl.variant_item_id === variantItem?.variant_item_id);
    };

    // ✨ PHASE 4.143: Fetch and show completion question
    // ✨ PHASE 11.176: Auto-unlock video when modal appears (student watched 100%)
    // ✨ PHASE 11.178: Don't show modal if lesson is already completed (is_completed = true)
    // ✨ PHASE 13.4: Don't call handleMarkLessonAsCompleted if lesson already completed (prevents notification + toggle)
    // ✨ PHASE 36.1: Check both variantItem.is_completed AND course.completed_lesson array
    const fetchCompletionQuestion = async () => {
        try {
            // ✨ PHASE 36.1: Skip if lesson already completed (check actual completion status from course data)
            if (variantItem?.is_completed || isLessonActuallyCompleted()) {
                console.log('[VideoPlayerUnggah] Lesson already completed, skipping verification question and notification');
                // ✨ PHASE 13.4: DON'T call handleMarkLessonAsCompleted here - lesson is already saved
                // Calling would trigger the notification and toggle badge behavior
                return;
            }
            
            const response = await API.get(`/lesson-completion-question/?variant_item_id=${variantItem?.variant_item_id}`);
            if (response.data.results && response.data.results.length > 0) {
                setCompletionQuestion(response.data.results[0]);
                setShowQuestionModal(true);
                // ✨ PHASE 11.176: Allow free video access immediately since student completed watching
                setAllowVideoAccess(true);
            } else {
                // ✨ PHASE 11.180: No question exists, unlock video controls since student completely watched
                setAllowVideoAccess(true);
                // ✨ PHASE 36.1: Only mark complete if not already completed (check both flags and course data)
                if (!variantItem?.is_completed && !isLessonActuallyCompleted() && handleMarkLessonAsCompleted) {
                    handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
                }
            }
        } catch (error) {
            console.error('Error fetching completion question:', error);
            // ✨ PHASE 11.180: On error, allow video access and mark complete to avoid blocking student
            setAllowVideoAccess(true);
            // ✨ PHASE 36.1: Only mark complete if not already completed (check both flags and course data)
            if (!variantItem?.is_completed && !isLessonActuallyCompleted() && handleMarkLessonAsCompleted) {
                handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
            }
        }
    };

    // ✨ PHASE 4.143: Handle successful answer submission
    const handleQuestionAnsweredCorrectly = () => {
        setShowQuestionModal(false);
        // ✨ PHASE 11.171: Hide overlay blocker after lesson is marked as complete
        setAllowVideoAccess(true);
        // ✨ PHASE 13.3: DO NOT call handleMarkLessonAsCompleted here!
        // The backend already created CompletedLesson in LessonCompletionQuestionAnswerAPIView
        // Calling handleMarkLessonAsCompleted would toggle (delete) the record we just created
        // Instead, the 'lessonAnsweredCorrectly' event will trigger course data refresh
    };

    // ✨ PHASE 11.170: Handle incorrect answer - unlock video blocker to allow free video access
    const handleAnswerWrong = () => {
        setAllowVideoAccess(true);  // ✨ PHASE 11.170: Allow user to access video freely to rewatch
    };

    // ✨ PHASE 11.171: Handle closing modal to go back to video (when user clicks "Pelajaran Kembali")
    const handleCloseModal = () => {
        setShowQuestionModal(false);
        setAllowVideoAccess(true);  // ✨ PHASE 11.171: Allow access to video when closing modal
    };

    // ✨ PHASE 11.158: Skip functionality removed - user MUST answer to complete lesson

    // ✨ PHASE 4.142: Auto-hide buttons after 1 second of mouse inactivity
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

    // ✨ PHASE 4.142: Handle HTML5 video seek when resuming with improved retry logic
    useEffect(() => {
        if (!seekPosition || seekPosition <= 0) {
            return;
        }


        if (videoRef.current) {
            try {
                videoRef.current.currentTime = seekPosition;

                if (autoplay && typeof videoRef.current.play === 'function') {
                    const attemptPlay = (retryCount = 0, maxRetries = 4) => {
                        const video = videoRef.current;
                        
                        if (!video) {
                            return;
                        }

                        const readyState = video.readyState;
                        const readyStateNames = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
                        
                        
                        if (readyState >= 2) {
                            video.play()
                                .then(() => {
                                    setIsPlaying(true);
                                })
                                .catch(err => {
                                    
                                    if (err.name === 'NotAllowedError') {
                                        setIsPlaying(false);
                                    } else if (retryCount < maxRetries) {
                                        const delay = 50 * Math.pow(2, retryCount);
                                        setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                                    } else {
                                        setIsPlaying(false);
                                    }
                                });
                        } else if (retryCount < maxRetries) {
                            const delay = 50 * Math.pow(2, retryCount);
                            setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                        } else {
                            setIsPlaying(false);
                        }
                    };
                    
                    attemptPlay();
                }
            } catch (error) {
            }
        }
    }, [seekPosition, autoplay]);

    // ✨ PHASE 4.142: Auto-play HTML5 video with improved retry logic
    useEffect(() => {
        if (!autoplay || seekPosition && seekPosition > 0) {
            return;
        }


        if (videoRef.current) {
            const attemptPlay = (retryCount = 0, maxRetries = 3) => {
                const video = videoRef.current;
                
                if (!video) {
                    return;
                }

                const readyState = video.readyState;
                const readyStateNames = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
                
                
                if (readyState >= 2) {
                    video.play()
                        .then(() => {
                            setIsPlaying(true);
                        })
                        .catch(err => {
                            
                            if (err.name === 'NotAllowedError') {
                                setIsPlaying(false);
                            } else if (retryCount < maxRetries) {
                                const delay = 50 * Math.pow(2, retryCount);
                                setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                            } else {
                                setIsPlaying(false);
                            }
                        });
                } else if (retryCount < maxRetries) {
                    const delay = 50 * Math.pow(2, retryCount);
                    setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                } else {
                    setIsPlaying(false);
                }
            };

            const playTimer = setTimeout(() => {
                if (videoRef.current) {
                    attemptPlay();
                }
            }, 100);
            
            return () => clearTimeout(playTimer);
        }
    }, [autoplay, variantItem?.variant_item_id, seekPosition]);

    // Render
    return (
        <div className="video-player-inline">
            {/* Header */}
            <div className="video-player-header">
                <div className="video-player-header-content">
                    <div className="video-player-icon-box">
                        <i className="fas fa-video"></i>
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
                        <small className="video-player-progress-info">{formatVideoTimer()}</small>
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
                            Maaf, video tidak dapat dimuat. Pastikan file dibagikan dengan akses publik.
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
                        ref={containerRef}
                        className="video-player-video-container video-player-video-hover"
                        onKeyDown={handleVideoKeyDown}
                        tabIndex={allowVideoAccess ? 0 : -1}
                        onMouseMove={() => setMouseActive(true)}
                        onMouseEnter={() => setMouseActive(true)}
                        onClick={(e) => {
                            // ✨ PHASE 11.180 FIX: Ensure container can receive focus for keyboard events in FULL mode
                            if (allowVideoAccess && e.target === containerRef.current) {
                                containerRef.current?.focus();
                            }
                        }}
                    >
                        {/* ✨ PHASE 4.142: Overlay Blocker - Blocks native video controls */}
                        {/* ✨ PHASE 11.170: Hidden when allowVideoAccess is true (user answered wrong) */}
                        {/* ✨ PHASE 11.177: Also hidden when lesson completion modal is showing (student watched 100%) */}
                        {!allowVideoAccess && !showQuestionModal && (
                            <div
                                className="video-player-overlay-blocker"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onDoubleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onMouseMove={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            />
                        )}

                        {/* Video Element */}
                        {/* ✨ PHASE 11.179: Add full HTML5 controls when student has watched video (is_fully_watched || is_completed) */}
                        <video
                            ref={videoRef}
                            src={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                            className="video-player-video-element"
                            onPlay={handleVideoPlay}
                            onPause={handleVideoPause}
                            onFocus={handleVideoFocus}
                            onKeyDown={handleVideoKeyDown}
                            muted={false}
                            autoPlay={autoplay && (!seekPosition || seekPosition <= 0)}
                            tabIndex={allowVideoAccess ? 0 : -1}
                            controls={allowVideoAccess}
                            onLoadedMetadata={() => {
                                if (videoRef.current) {
                                    setDuration(videoRef.current.duration);
                                }
                            }}
                            onTimeUpdate={() => {
                                if (videoRef.current && videoRef.current.duration) {
                                    setCurrentTime(videoRef.current.currentTime);
                                    const percentage = (videoRef.current.currentTime / videoRef.current.duration) * 100;
                                    setProgressPercentage(Math.round(percentage));
                                    
                                    // ✨ PHASE 13.2: Auto-unlock Full Mode at 95%+ progress and stop tracking
                                    if (percentage >= 95 && !progressStoppedRef.current) {
                                        console.log('[VideoPlayerUnggah] 🎓 PHASE 13.2: Progress reached 95%+ - switching to FULL MODE and stopping progress tracking', {
                                            percentage: percentage.toFixed(2),
                                            currentTime: videoRef.current.currentTime.toFixed(2),
                                            duration: videoRef.current.duration.toFixed(2)
                                        });
                                        progressStoppedRef.current = true;
                                        setAllowVideoAccess(true);  // Unlock Full Mode
                                        // Progress tracking will stop below since progressStoppedRef.current is now true
                                    }
                                    
                                    // ✨ PHASE 13.2: Only send progress updates until 95% is reached
                                    // Once at 95%+, stop wasting bandwidth and API calls on duplicate data
                                    if (!progressStoppedRef.current && onProgressRef.current) {
                                        if (Math.random() < 0.1) {
                                        }
                                        onProgressRef.current({
                                            played: videoRef.current.currentTime / videoRef.current.duration,
                                            loaded: 1,
                                            duration: videoRef.current.duration,
                                            currentTime: videoRef.current.currentTime
                                        });
                                    }
                                }
                            }}
                            onEnded={() => {
                                // ✨ PHASE 4.157: FIX - First check for completion question before marking complete
                                fetchCompletionQuestion();
                                setIsPlaying(false);
                                setProgressPercentage(100);
                            }}
                            onError={() => {
                                setLoadError(true);
                            }}
                        />
                        
                        {/* ✨ PHASE 11.180 FIX: Hide custom buttons when native controls visible (FULL mode) */}
                        {/* Control Buttons Container */}
                        <div className="video-player-controls-container" style={{ display: allowVideoAccess ? 'none' : 'flex' }}>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handlePlayPause();
                                }}
                                className="video-player-play-pause-btn"
                                title="Putar/Jeda"
                                style={{
                                    opacity: mouseActive ? 1 : 0
                                }}
                            >
                                <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"} video-player-play-pause-icon ${isPlaying ? "is-playing" : ""}`}></i>
                            </button>
                        </div>

                        {/* ✨ PHASE 11.180: Backward 5 Seconds Button - Always available in both LIMITED and FULL modes */}
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleBackward5Seconds();
                            }}
                            className="video-player-backward-btn"
                            title="Mundur 5 detik"
                            style={{
                                opacity: mouseActive ? 1 : 0,
                                display: allowVideoAccess ? 'none' : 'block'  // ✨ PHASE 11.180 FIX: Hide when FULL mode
                            }}
                        >
                            <i className="fas fa-redo-alt video-player-backward-icon"></i>
                            <span className="backward-label">5s</span>
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
                                display: allowVideoAccess ? 'none' : 'block'  // ✨ PHASE 11.180 FIX: Hide when FULL mode
                            }}
                        >
                            <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}></i>
                        </button>
                    </div>
                )}

                {/* ✨ PHASE 4.143: Lesson Completion Question Modal - INSIDE video-player-content for proper overlay */}
                {showQuestionModal && completionQuestion && (
                    <LessonCompletionQuestionModal
                        question={completionQuestion}
                        variantItemId={variantItem?.variant_item_id}
                        onAnswerCorrect={handleQuestionAnsweredCorrectly}
                        onAnswerWrong={handleAnswerWrong}  // ✨ PHASE 11.170: Callback to enable video access when answer is wrong
                        onCloseModal={handleCloseModal}    // ✨ PHASE 11.171: Callback to close modal when user clicks "Pelajaran Kembali"
                        studentId={UserData()?.user_id}  // ✨ PHASE 4.144+: Pass studentId to modal
                    />
                )}
            </div>

            {/* Modal removed from here - now inside video-player-content */}
        </div>
    );
});

VideoPlayerUnggah.displayName = "VideoPlayerUnggah";

// ✨ PHASE 17.12 FIX: Wrap in React.memo to prevent unnecessary unmount/remount
// This prevents unmounting when parent re-renders but props are stable
export default React.memo(VideoPlayerUnggah);
