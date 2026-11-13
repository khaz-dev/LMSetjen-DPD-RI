import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
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
    // ✨ PHASE 47 FIX: Only initialize isPlaying=true if variantItem has a file AND autoplay is true
    // Otherwise, autoplay=true with no variantItem causes video to appear "playing" even when no lesson selected
    const [isPlaying, setIsPlaying] = useState(variantItem?.file && autoplay ? autoplay : false);
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
    const maxTimeWatchedRef = useRef(0);  // ✨ Anti-skip: Track furthest watched point to prevent skipping

    // Sync maxTimeWatchedRef on lesson change or resume seek position
    useEffect(() => {
        maxTimeWatchedRef.current = (seekPosition && seekPosition > 0) ? seekPosition : 0;
    }, [variantItem?.variant_item_id, seekPosition]);
    
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

        // Reset/sync playback time and duration for new variantItem
        const itemDur = parseTimeToSeconds(variantItem?.duration) || parseTimeToSeconds(variantItem?.content_duration) || 0;
        if (itemDur > 0) {
            setDuration(itemDur);
        } else {
            setDuration(0);
        }
        setCurrentTime(seekPosition && seekPosition > 0 ? seekPosition : 0);
    }, [variantItem?.variant_item_id]);
    
    // ✨ PHASE 47 FIX: Reset playing state when lesson becomes null/empty
    // Prevents video from appearing to "play" when no lesson is selected
    useEffect(() => {
        if (!variantItem?.file) {
            setIsPlaying(false);
        }
    }, [variantItem?.file]);
    
    const containerRef = useRef(null);
    const mouseInactiveTimer = useRef(null);

    // Helper to parse duration string (e.g. "00:01:44", "01:44", "1m 44s", or raw seconds)
    const parseTimeToSeconds = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return isFinite(val) && val > 0 ? val : 0;
        if (typeof val === 'string') {
            if (val.includes(':')) {
                const parts = val.split(':').map(p => parseFloat(p) || 0);
                if (parts.length === 3) {
                    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                } else if (parts.length === 2) {
                    return (parts[0] * 60) + parts[1];
                }
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

    // Format video timer for display - "00:00 | 00:00 | x%" format
    // Persentase dihitung secara akurat: (detik saat ini / durasi total maks) * 100%
    const formatVideoTimer = () => {
        const effectiveDuration = (duration && isFinite(duration) && duration > 0)
            ? duration
            : (videoRef.current?.duration && isFinite(videoRef.current.duration) && videoRef.current.duration > 0)
                ? videoRef.current.duration
                : (parseTimeToSeconds(variantItem?.duration) || parseTimeToSeconds(variantItem?.content_duration) || 0);

        const curTime = (typeof currentTime === 'number' && !isNaN(currentTime) && currentTime >= 0)
            ? currentTime
            : (videoRef.current?.currentTime || 0);

        const hours = Math.floor(curTime / 3600);
        const minutes = Math.floor((curTime % 3600) / 60);
        const seconds = Math.floor(curTime % 60);
        
        const durationHours = Math.floor(effectiveDuration / 3600);
        const durationMinutes = Math.floor((effectiveDuration % 3600) / 60);
        const durationSeconds = Math.floor(effectiveDuration % 60);
        
        // Perhitungan persentase valid: (detik saat ini / maks waktu) * 100%
        let percentage = 0;
        if (effectiveDuration > 0) {
            percentage = Math.min(100, Math.max(0, (curTime / effectiveDuration) * 100));
        }
        
        // Format current time
        let currentTimeStr;
        if (durationHours > 0 || hours > 0) {
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
        
        // Format persentase bulat integer tanpa desimal (misal 27% bukan 27.7%)
        const intPercentage = Math.min(100, Math.max(0, Math.round(percentage)));
        const percentageStr = `${intPercentage}%`;
        
        return `${currentTimeStr} | ${durationStr} | ${percentageStr}`;
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

    // ✨ PHASE 4.142: Expose play/pause toggle, seek methods, and currentTime via ref
    useImperativeHandle(ref, () => ({
        togglePlayPause: handlePlayPause,
        seekToPosition: (position) => {
            if (videoRef.current) {
                videoRef.current.currentTime = position;
                try {
                    const playPromise = videoRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => setIsPlaying(true)).catch(() => {});
                    }
                } catch (e) {
                    // Ignore autoplay restrictions
                }
            }
        },
        getCurrentTime: () => {
            return videoRef.current ? videoRef.current.currentTime : 0;
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

    // ✨ Anti-skip: Enforce strict keyboard lock in LIMITED mode
    const handleVideoKeyDown = useCallback((e) => {
        if (!allowVideoAccess) {
            // Block forward/skip keys in LIMITED mode (arrows, end, home, page keys, numbers, vim/youtube keys)
            if (
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight' ||
                e.key === 'End' ||
                e.key === 'Home' ||
                e.key === 'PageDown' ||
                e.key === 'PageUp' ||
                (e.key >= '0' && e.key <= '9') ||
                e.key === 'l' || e.key === 'L' ||
                e.key === 'j' || e.key === 'J'
            ) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    }, [allowVideoAccess]);

    // ✨ Anti-skip: Guard seeking to prevent forward scrub bypass
    const handleVideoSeeking = useCallback(() => {
        if (!allowVideoAccess && videoRef.current) {
            if (videoRef.current.currentTime > maxTimeWatchedRef.current + 2.0) {
                console.warn('[VideoPlayerUnggah] ⚠️ Forward skip blocked! Snapping back to:', maxTimeWatchedRef.current);
                videoRef.current.currentTime = maxTimeWatchedRef.current;
            }
        }
    }, [allowVideoAccess]);

    // ✨ Anti-skip: Prevent playback rate acceleration hacks in LIMITED mode
    const handleRateChange = useCallback(() => {
        if (!allowVideoAccess && videoRef.current) {
            if (videoRef.current.playbackRate > 2.0) {
                console.warn('[VideoPlayerUnggah] ⚠️ Playback speed acceleration blocked!');
                videoRef.current.playbackRate = 1.0;
            }
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
                <div className="video-player-header-left">
                    <div className="video-player-icon-box" title="Video Pembelajaran">
                        <i className="fas fa-play"></i>
                    </div>
                    <div className="video-player-title-wrapper">
                        <div className="video-player-title-row">
                            {variantContext?.variantTitle && (
                                <span className="video-header-section-chip" title={`Bagian: ${variantContext.variantTitle}`}>
                                    <i className="fas fa-layer-group me-1"></i>
                                    {variantContext.variantTitle}
                                </span>
                            )}
                            <OverlayTrigger
                                placement="bottom"
                                overlay={
                                    <Tooltip id={`video-tip-${variantItem?.variant_item_id || 'active'}`} className="video-player-title-tooltip">
                                        {variantItem?.title}
                                    </Tooltip>
                                }
                            >
                                <span className="video-header-lesson-title text-truncate" title={variantItem?.title}>
                                    {variantItem?.title}
                                </span>
                            </OverlayTrigger>
                        </div>
                    </div>
                </div>

                <div className="video-player-header-right">
                    <div className="video-player-live-badge d-none d-md-inline-flex" title="Status Pemutaran Aktif">
                        <span className="live-pulse-dot"></span>
                        <span>Memutar</span>
                    </div>

                    <div className="video-player-progress-info" title="Waktu Pemutaran (Waktu Saat Ini | Durasi | Persentase)">
                        <i className="fas fa-clock me-1 text-amber"></i>
                        <span>{formatVideoTimer()}</span>
                    </div>

                    <button
                        onClick={handleClose}
                        className="video-player-close-btn"
                        aria-label="Tutup Pemutar"
                        title="Tutup Pemutar Video"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
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
                        onContextMenu={(e) => { if (!allowVideoAccess) e.preventDefault(); }}
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
                        {/* Thin red progress bar at top of video - visible in both normal & fullscreen mode while restricted */}
                        {!allowVideoAccess && (
                            <div 
                                className="video-player-top-progress-bar-container"
                                title={`Progress Video: ${Math.min(100, Math.max(0, Math.round(
                                    (duration > 0 ? (currentTime / duration) * 100 : progressPercentage) || 0
                                )))}%`}
                            >
                                <div 
                                    className="video-player-top-progress-bar"
                                    style={{ 
                                        width: `${Math.min(100, Math.max(0, (
                                            duration > 0 
                                                ? (currentTime / duration) * 100 
                                                : (progressPercentage || 0)
                                        )))}%` 
                                    }}
                                />
                            </div>
                        )}

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
                            onSeeking={handleVideoSeeking}
                            onRateChange={handleRateChange}
                            onContextMenu={(e) => { if (!allowVideoAccess) e.preventDefault(); }}
                            onLoadedMetadata={() => {
                                if (videoRef.current && isFinite(videoRef.current.duration) && videoRef.current.duration > 0) {
                                    setDuration(videoRef.current.duration);
                                }
                            }}
                            onTimeUpdate={() => {
                                if (videoRef.current) {
                                    const curTime = videoRef.current.currentTime || 0;
                                    setCurrentTime(curTime);
                                    if (curTime > maxTimeWatchedRef.current) {
                                        maxTimeWatchedRef.current = curTime;
                                    }

                                    const vidDur = videoRef.current.duration;
                                    const effectiveDur = (vidDur && isFinite(vidDur) && vidDur > 0)
                                        ? vidDur
                                        : (duration > 0 ? duration : (parseTimeToSeconds(variantItem?.duration) || parseTimeToSeconds(variantItem?.content_duration) || 0));

                                    if (vidDur && isFinite(vidDur) && vidDur > 0 && Math.abs(vidDur - duration) > 0.5) {
                                        setDuration(vidDur);
                                    }

                                    const percentage = effectiveDur > 0 ? (curTime / effectiveDur) * 100 : 0;
                                    setProgressPercentage(Math.round(percentage));
                                    
                                    // ✨ PHASE 13.2: Auto-unlock Full Mode at 95%+ progress and stop tracking
                                    if (percentage >= 95 && !progressStoppedRef.current) {
                                        console.log('[VideoPlayerUnggah] 🎓 PHASE 13.2: Progress reached 95%+ - switching to FULL MODE and stopping progress tracking', {
                                            percentage: percentage.toFixed(2),
                                            currentTime: curTime.toFixed(2),
                                            duration: effectiveDur.toFixed(2)
                                        });
                                        progressStoppedRef.current = true;
                                        setAllowVideoAccess(true);  // Unlock Full Mode
                                        // Progress tracking will stop below since progressStoppedRef.current is now true
                                    }
                                    
                                    // ✨ PHASE 13.2: Only send progress updates until 95% is reached
                                    // Once at 95%+, stop wasting bandwidth and API calls on duplicate data
                                    if (!progressStoppedRef.current && onProgressRef.current && effectiveDur > 0) {
                                        if (Math.random() < 0.1) {
                                        }
                                        onProgressRef.current({
                                            played: curTime / effectiveDur,
                                            loaded: 1,
                                            duration: effectiveDur,
                                            currentTime: curTime
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
