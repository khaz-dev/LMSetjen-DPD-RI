import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import "./VideoPlayerYoutube.css";

// ✨ PHASE 4.142: VideoPlayerYoutube - Standalone YouTube iframe player
// Handles: YouTube URLs (youtube.com/watch?v=... or youtu.be/...)
// Features:
// - YouTube IFrame API integration for play/pause control
// - Real-time progress polling (every 500ms)
// - Resume from saved position with seek
// - Backward 5s, fullscreen, progress tracking
// - Auto-hide buttons after 1 second of mouse inactivity
// - Auto-complete lesson when video ends
// - Handle autoplay with iframe parameter

const VideoPlayerYoutube = forwardRef(({
    variantItem,
    onClose,
    handleMarkLessonAsCompleted,
    autoplay = false,
    onPlayingChange,
    onProgress,
    seekPosition,
}, ref) => {
    const [loadError, setLoadError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mouseActive, setMouseActive] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [progressPercentage, setProgressPercentage] = useState(0);

    const iframeRef = useRef(null);
    const iframeContainerRef = useRef(null);
    const mouseInactiveTimer = useRef(null);
    const youtubePlayerRef = useRef(null);

    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE 4.142: Expose play/pause toggle and seek methods via ref
    useImperativeHandle(ref, () => ({
        togglePlayPause: handlePlayPause,
        seekToPosition: (position) => {
            if (youtubePlayerRef.current && typeof youtubePlayerRef.current.seekTo === 'function') {
                youtubePlayerRef.current.seekTo(position);
            }
        }
    }), []);

    const handleClose = () => {
        if (onClose) onClose();
    };

    // Convert YouTube URLs to embed format
    const convertYoutubeUrl = (url, shouldAutoplay = false, hasSeekPosition = false) => {
        if (!url || typeof url !== 'string') return url;
        
        let videoId = null;
        
        if (url.includes('youtube.com/watch')) {
            const match = url.match(/v=([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
        }
        
        if (url.includes('youtu.be/')) {
            const match = url.match(/youtu.be\/([a-zA-Z0-9_-]{11})/);
            if (match) videoId = match[1];
        }
        
        if (videoId) {
            const embedUrl = `https://www.youtube.com/embed/${videoId}`;
            let shouldUseAutoplay = shouldAutoplay && !hasSeekPosition;
            
            if (shouldUseAutoplay) {
                return `${embedUrl}?autoplay=1&fs=1&modestbranding=1&rel=0&enablejsapi=1`;
            } else {
                return `${embedUrl}?fs=1&modestbranding=1&rel=0&enablejsapi=1`;
            }
        }
        
        return url;
    };

    const videoUrl = convertYoutubeUrl(variantItem.file, autoplay, seekPosition && seekPosition > 0);

    const handlePlayPause = () => {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
            try {
                if (isPlaying) {
                    youtubePlayerRef.current.pauseVideo();
                    setIsPlaying(false);
                } else {
                    youtubePlayerRef.current.playVideo();
                    setIsPlaying(true);
                }
            } catch (err) {
                setIsPlaying(!isPlaying);
            }
        } else {
            setIsPlaying(!isPlaying);
        }
    };

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

    const handleBackward5Seconds = () => {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
            try {
                const currentTime = youtubePlayerRef.current.getCurrentTime();
                const newTime = Math.max(0, currentTime - 5);
                youtubePlayerRef.current.seekTo(newTime, true);
            } catch (err) {
            }
        }
    };

    // ✨ PHASE 4.142: Load YouTube API globally once
    useEffect(() => {
        if (!window.YT && !window.youtubeAPILoading) {
            window.youtubeAPILoading = true;
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onload = () => {
            };
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
    }, []);

    // ✨ PHASE 4.142: Initialize YouTube player instance
    useEffect(() => {
        if (!iframeRef.current) {
            return;
        }
        
        iframeRef.current.dataset.playerInitialized = '';
        youtubePlayerRef.current = null;
        
        let initAttempts = 0;
        const maxAttempts = 10;
        
        const initializeYouTubePlayer = () => {
            if (!window.YT || !window.YT.Player) {
                initAttempts++;
                if (initAttempts < maxAttempts) {
                    setTimeout(initializeYouTubePlayer, 300);
                } else {
                }
                return;
            }
            
            try {
                if (!iframeRef.current.dataset.playerInitialized) {
                    const player = new window.YT.Player(iframeRef.current, {
                        events: {
                            'onReady': (event) => {
                                youtubePlayerRef.current = event.target;
                                iframeRef.current.dataset.playerInitialized = 'true';
                            },
                            'onStateChange': (event) => {
                                if (event.data === window.YT.PlayerState.PLAYING) {
                                    setIsPlaying(true);
                                } else if (event.data === window.YT.PlayerState.PAUSED) {
                                    setIsPlaying(false);
                                } else if (event.data === window.YT.PlayerState.ENDED) {
                                    if (handleMarkLessonAsCompleted) {
                                        handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
                                    }
                                    setIsPlaying(false);
                                    setProgressPercentage(100);
                                }
                            },
                            'onError': (event) => {
                            }
                        }
                    });
                }
            } catch (err) {
            }
        };
        
        initializeYouTubePlayer();
        
    }, [variantItem?.variant_item_id]);

    // ✨ PHASE 4.142: Autoplay iframe
    useEffect(() => {
        if (autoplay && iframeRef.current) {
            if (seekPosition && seekPosition > 0) {
                return;
            }

            
            if (!videoUrl.includes('autoplay=1')) {
                let youtubeUrlWithAutoplay = videoUrl;
                
                if (videoUrl.includes('?')) {
                    if (videoUrl.includes('autoplay=')) {
                        youtubeUrlWithAutoplay = videoUrl.replace(/autoplay=[0-1]/, 'autoplay=1');
                    } else {
                        youtubeUrlWithAutoplay = `${videoUrl}&autoplay=1`;
                    }
                } else {
                    youtubeUrlWithAutoplay = `${videoUrl}?autoplay=1`;
                }
                
                if (iframeRef.current.src !== youtubeUrlWithAutoplay) {
                    iframeRef.current.src = youtubeUrlWithAutoplay;
                }
            }
        }
    }, [autoplay, videoUrl, seekPosition]);

    // ✨ PHASE 4.142: YouTube autoplay effect with retry
    useEffect(() => {
        if (!autoplay) {
            return;
        }

        let autoplayAttempts = 0;
        const maxAutoplayAttempts = 15;

        const attemptAutoplay = () => {
            const youtubePlayer = youtubePlayerRef.current;

            if (!youtubePlayer || typeof youtubePlayer.playVideo !== 'function') {
                autoplayAttempts++;
                if (autoplayAttempts < maxAutoplayAttempts) {
                    setTimeout(attemptAutoplay, 100);
                } else {
                }
                return;
            }

            try {
                const playerState = typeof youtubePlayer.getPlayerState === 'function' 
                    ? youtubePlayer.getPlayerState() 
                    : null;
                
                const isAlreadyPlaying = playerState === 1;

                if (!isAlreadyPlaying) {
                    youtubePlayer.playVideo();
                    setIsPlaying(true);
                } else {
                }
            } catch (error) {
            }
        };

        setTimeout(attemptAutoplay, 100);

    }, [autoplay, variantItem?.variant_item_id]);

    // ✨ PHASE 4.142: Track YouTube progress
    useEffect(() => {

        const progressInterval = setInterval(() => {
            try {
                if (!variantItem || !variantItem.variant_item_id) {
                    return;
                }

                if (!youtubePlayerRef.current) {
                    return;
                }

                try {
                    const currentTime = youtubePlayerRef.current.getCurrentTime?.();
                    const duration = youtubePlayerRef.current.getDuration?.();
                    const playerState = youtubePlayerRef.current.getPlayerState?.();

                    if (currentTime !== undefined && duration !== undefined && playerState === 1) {
                        setCurrentTime(currentTime);
                        setDuration(duration);
                        setProgressPercentage(duration > 0 ? Math.round((currentTime / duration) * 100) : 0);
                        
                        if (onProgress) {
                            onProgress({
                                played: duration > 0 ? currentTime / duration : 0,
                                loaded: 1,
                                duration: duration,
                                currentTime: currentTime
                            });
                        }
                    }
                } catch (e) {
                    // Player not ready yet
                }
            } catch (err) {
            }
        }, 500);

        return () => clearInterval(progressInterval);
    }, [variantItem?.variant_item_id, onProgress]);

    // ✨ PHASE 4.142: Notify parent when playing state changes
    useEffect(() => {
        if (onPlayingChange) {
            onPlayingChange(isPlaying);
        }
    }, [isPlaying, onPlayingChange]);

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

    // Seek to position when resuming
    useEffect(() => {
        if (!seekPosition || seekPosition <= 0) {
            return;
        }

        let seekAttempts = 0;
        const maxSeekAttempts = 10;

        const attemptSeek = () => {
            const youtubePlayer = youtubePlayerRef.current;

            if (!youtubePlayer || typeof youtubePlayer.seekTo !== 'function') {
                seekAttempts++;
                if (seekAttempts < maxSeekAttempts) {
                    setTimeout(attemptSeek, 100);
                }
                return;
            }

            try {
                youtubePlayer.seekTo(seekPosition, true);
                
                // Try to play after seek
                if (typeof youtubePlayer.playVideo === 'function') {
                    youtubePlayer.playVideo();
                }
            } catch (err) {
            }
        };

        attemptSeek();
    }, [seekPosition]);

    // Render
    return (
        <div className="video-player-inline">
            {/* Header */}
            <div className="video-player-header">
                <div className="video-player-header-content">
                    <div className="video-player-icon-box">
                        <i className="fab fa-youtube"></i>
                    </div>
                    <div className="video-player-title-wrapper">
                        <div className="video-player-title">{variantItem?.title}</div>
                        <small>YouTube Video - {Math.round(progressPercentage)}%</small>
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
                        <p className="text-muted mb-4">Gagal memuat video YouTube</p>
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
                        <div className="overlay-container" style={{ pointerEvents: 'auto' }}>
                            <div 
                                className="overlay overlay-h-1"
                                style={{ pointerEvents: 'auto' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            />
                            <div 
                                className="overlay overlay-h-2"
                                style={{ pointerEvents: 'auto' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            />
                            <div 
                                className="overlay overlay-h-3"
                                style={{ pointerEvents: 'auto' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            />
                            <div 
                                className="overlay overlay-h-4"
                                style={{ pointerEvents: 'auto' }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            />
                        </div>

                        {/* YouTube Iframe */}
                        <iframe
                            ref={iframeRef}
                            src={videoUrl}
                            className="video-player-iframe"
                            sandbox="allow-scripts allow-same-origin allow-autoplay allow-presentation"
                            allow="autoplay"
                            title="YouTube video player"
                            onError={() => {
                                setLoadError(true);
                            }}
                        />
                        
                        {/* Control Buttons for YouTube */}
                        <div className="video-player-controls-container-iframe">
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
                                opacity: mouseActive ? 1 : 0,
                                display: 'flex',
                                zIndex: 200
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
                                display: 'flex',
                                zIndex: 200
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

VideoPlayerYoutube.displayName = "VideoPlayerYoutube";
export default VideoPlayerYoutube;
