import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { getMediaUrl } from "../../utils/constants";
import { formatDurationStyle } from "../../utils/durationUtils";
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
}, ref) => {
    const [loadError, setLoadError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoplay);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mouseActive, setMouseActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progressPercentage, setProgressPercentage] = useState(0);

    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const mouseInactiveTimer = useRef(null);

    // Format video timer for display (MM:SS or HH:MM:SS)
    const formatVideoTimer = () => {
        const hours = Math.floor(currentTime / 3600);
        const minutes = Math.floor((currentTime % 3600) / 60);
        const seconds = Math.floor(currentTime % 60);
        
        const durationHours = Math.floor(duration / 3600);
        const durationMinutes = Math.floor((duration % 3600) / 60);
        const durationSeconds = Math.floor(duration % 60);
        
        if (durationHours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} / ${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;
        } else {
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} / ${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;
        }
    };

    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE 4.142: Expose play/pause toggle and seek methods via ref
    useImperativeHandle(ref, () => ({
        togglePlayPause: handlePlayPause,
        seekToPosition: (position) => {
            if (videoRef.current) {
                videoRef.current.currentTime = position;
            }
        }
    }), []);

    const handleClose = () => {
        if (onClose) onClose();
    };

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

    const handleVideoKeyDown = (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            if (containerRef.current) {
                containerRef.current.dispatchEvent(
                    new CustomEvent('arrowKeyBlocked', { detail: { key: e.key }, bubbles: true })
                );
            }
            return false;
        }
    };

    // ✨ PHASE 4.142+: Callback when isPlaying state changes
    useEffect(() => {
        if (onPlayingChange) {
            onPlayingChange(isPlaying);
        } else {
        }
    }, [isPlaying, onPlayingChange]);

    const handleVideoFocus = (e) => {
        if (videoRef.current) {
            videoRef.current.blur();
        }
    };

    // ✨ PHASE 4.142: Notify parent when playing state changes
    useEffect(() => {
        if (onPlayingChange) {
            onPlayingChange(isPlaying);
        }
    }, [isPlaying, onPlayingChange]);

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
                        <small>{formatVideoTimer()}</small>
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
                        tabIndex="-1"
                        onMouseMove={() => setMouseActive(true)}
                        onMouseEnter={() => setMouseActive(true)}
                    >
                        {/* ✨ PHASE 4.142: Overlay Blocker - Blocks native video controls */}
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

                        {/* Video Element */}
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
                            tabIndex="-1"
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
                                    
                                    if (onProgress) {
                                        if (Math.random() < 0.1) {
                                        }
                                        onProgress({
                                            played: videoRef.current.currentTime / videoRef.current.duration,
                                            loaded: 1,
                                            duration: videoRef.current.duration,
                                            currentTime: videoRef.current.currentTime
                                        });
                                    }
                                }
                            }}
                            onEnded={() => {
                                if (handleMarkLessonAsCompleted) {
                                    handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
                                }
                                setIsPlaying(false);
                                setProgressPercentage(100);
                            }}
                            onError={() => {
                                setLoadError(true);
                            }}
                        />
                        
                        {/* Control Buttons Container */}
                        <div className="video-player-controls-container">
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

                        {/* Backward 5 Seconds Button */}
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleBackward5Seconds();
                            }}
                            className="video-player-backward-btn"
                            title="Mundur 5 detik"
                            style={{
                                opacity: mouseActive ? 1 : 0
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
                                opacity: mouseActive ? 1 : 0
                            }}
                        >
                            <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}></i>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

VideoPlayerUnggah.displayName = "VideoPlayerUnggah";
export default VideoPlayerUnggah;
