import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { getMediaUrl } from "../../utils/constants";
import { formatDurationStyle } from "../../utils/durationUtils";  // ✨ PHASE 4.127: Format video timer
import {
    isVideoContent,
    getFileTypeIcon,
    getFileTypeLabel,
    isVideoFile,
    extractGoogleDriveFileId
} from "../../utils/videoContentUtils";
import "./VideoPLayer.css";

// ✨ PHASE 4.87: Inline VideoPlayer with iframe support
// Fixed to use direct iframe for Google Drive (/preview) and YouTube
// Matches working implementation from base CourseDetail.jsx
// ✨ PHASE 4.89: Custom minimal video player - only play/pause and fullscreen

const VideoPlayer = forwardRef(({
    variantItem,
    onClose,
    handleMarkLessonAsCompleted,
    autoplay = false,  // ✨ PHASE 4.103: Add autoplay prop to auto-play videos on load
    onPlayingChange,  // ✨ PHASE 4.105: Callback to track playing state
    onProgress,  // ✨ PHASE 4.115: Callback to report progress updates
    seekPosition,  // ✨ PHASE 4.117: Position in seconds to seek to when video loads
}, ref) => {
    const [loadError, setLoadError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(autoplay);  // Initialize with autoplay state
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isVideoFocused, setIsVideoFocused] = useState(false);
    const [googleDriveClickExpired, setGoogleDriveClickExpired] = useState(false);  // ✨ PHASE 4.103: Track if 5-second window expired
    const [mouseActive, setMouseActive] = useState(false);  // ✨ PHASE 4.104: Track if mouse is active (moving)
    const [currentTime, setCurrentTime] = useState(0);  // ✨ PHASE 4.114: Track current playback time
    const [duration, setDuration] = useState(0);  // ✨ PHASE 4.114: Track total video duration
    const [progressPercentage, setProgressPercentage] = useState(0);  // ✨ PHASE 4.114: Calculate progress percentage
    
    // ✨ PHASE 4.127: Format video timer for display (MM:SS or HH:MM:SS)
    const formatVideoTimer = () => {
        const hours = Math.floor(currentTime / 3600);
        const minutes = Math.floor((currentTime % 3600) / 60);
        const seconds = Math.floor(currentTime % 60);
        
        const durationHours = Math.floor(duration / 3600);
        const durationMinutes = Math.floor((duration % 3600) / 60);
        const durationSeconds = Math.floor(duration % 60);
        
        // Use HH:MM:SS if total duration > 1 hour, else MM:SS
        if (durationHours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} / ${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;
        } else {
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} / ${String(durationMinutes).padStart(2, '0')}:${String(durationSeconds).padStart(2, '0')}`;
        }
    };
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const iframeRef = useRef(null);
    const iframeContainerRef = useRef(null);  // ✨ PHASE 4.103: Ref for iframe container to detect clicks
    const mouseInactiveTimer = useRef(null);  // ✨ PHASE 4.104: Timer for auto-hiding buttons
    const youtubePlayerRef = useRef(null);  // ✨ PHASE 4.107: YouTube player instance for backward seeking

    // Don't render if no variant item
    if (!variantItem?.file) {
        return null;
    }

    // ✨ PHASE 4.105: Expose play/pause toggle method via ref
    // ✨ PHASE 4.112: Fixed dependency array to include all dependencies - was missing youtubePlayerRef, variantItem, etc.
    useImperativeHandle(ref, () => ({
        togglePlayPause: handlePlayPause,
        seekToPosition: (position) => {
            // ✨ PHASE 4.116: Seek to saved position for resume functionality
            if (videoRef.current && isVideoFile(variantItem?.file)) {
                videoRef.current.currentTime = position;
                console.log(`⏩ [VideoPlayer] Seeked to ${position.toFixed(1)}s`);
            } else if (youtubePlayerRef.current && typeof youtubePlayerRef.current.seekTo === 'function') {
                youtubePlayerRef.current.seekTo(position);
                console.log(`⏩ [VideoPlayer] YouTube seeked to ${position.toFixed(1)}s`);
            }
        }
    }), [isPlaying, videoRef, youtubePlayerRef, variantItem]);

    const handleClose = () => {
        if (onClose) onClose();
    };

    // ✨ PHASE 4.89: Custom video controls handlers
    const handlePlayPause = () => {
        const isUploadedVideo = isVideoFile(variantItem.file);
        const isYouTubeEmbed = videoUrl && videoUrl.includes('youtube.com/embed');
        const isGoogleDrive = videoUrl && videoUrl.includes('drive.google.com/file');
        
        // ✨ PHASE 4.112: Better logging for debugging toggle issues
        console.log("🎬 handlePlayPause called");
        console.log(`   Video type: ${isUploadedVideo ? 'HTML5' : isYouTubeEmbed ? 'YouTube' : isGoogleDrive ? 'Google Drive' : 'Unknown'}`);
        console.log(`   Current playing state: ${isPlaying}`);
        console.log(`   YouTube player ready: ${youtubePlayerRef.current ? 'Yes' : 'No'}`);
        
        if (isUploadedVideo && videoRef.current) {
            // ✨ PHASE 4.107: HTML5 video - use native play/pause
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
                console.log("⏸️ HTML5 video paused");
            } else {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            setIsPlaying(true);
                            console.log("▶️ HTML5 video playing");
                        })
                        .catch(err => {
                            console.warn("⚠️ Play failed:", err);
                            setIsPlaying(true);
                        });
                } else {
                    setIsPlaying(true);
                }
            }
        } else if (isYouTubeEmbed) {
            // ✨ PHASE 4.107: YouTube - use YouTube Player API for reliable play/pause
            // ✨ PHASE 4.111: Better checking if player is actually ready
            if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
                try {
                    if (isPlaying) {
                        youtubePlayerRef.current.pauseVideo();
                        setIsPlaying(false);
                        console.log("⏸️ YouTube paused");
                    } else {
                        youtubePlayerRef.current.playVideo();
                        setIsPlaying(true);
                        console.log("▶️ YouTube playing");
                    }
                } catch (err) {
                    console.warn("⚠️ YouTube play/pause failed:", err);
                    // Toggle state anyway so UI updates
                    setIsPlaying(!isPlaying);
                }
            } else {
                console.warn("⚠️ YouTube player API not ready yet, toggling state only");
                console.warn(`   youtubePlayerRef.current: ${youtubePlayerRef.current}`);
                if (youtubePlayerRef.current) {
                    console.warn(`   playVideo function exists: ${typeof youtubePlayerRef.current.playVideo}`);
                }
                setIsPlaying(!isPlaying);
            }
        } else if (isGoogleDrive) {
            // ✨ PHASE 4.111: Google Drive - custom controls not supported due to iframe sandbox
            console.log("📄 Google Drive: Custom play/pause not supported - click directly on video to control");
        }
    };

    const handleFullscreen = () => {
        // ✨ PHASE 4.111: Support fullscreen for both uploaded videos and YouTube/Google Drive iframes
        const targetElement = isYouTubeEmbed || isGoogleDrive ? iframeContainerRef.current : containerRef.current;
        
        if (targetElement) {
            if (!isFullscreen) {
                // Try fullscreen
                if (targetElement.requestFullscreen) {
                    targetElement.requestFullscreen();
                    setIsFullscreen(true);
                    console.log("📺 Fullscreen entered");
                } else if (targetElement.webkitRequestFullscreen) {
                    // Safari
                    targetElement.webkitRequestFullscreen();
                    setIsFullscreen(true);
                    console.log("📺 Fullscreen entered (Safari)");
                } else if (targetElement.msRequestFullscreen) {
                    // IE 11
                    targetElement.msRequestFullscreen();
                    setIsFullscreen(true);
                    console.log("📺 Fullscreen entered (IE11)");
                } else {
                    console.warn("⚠️ Fullscreen not supported on this browser");
                }
            } else {
                // Exit fullscreen
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    setIsFullscreen(false);
                    console.log("📺 Fullscreen exited");
                } else if (document.webkitFullscreenElement) {
                    document.webkitExitFullscreen();
                    setIsFullscreen(false);
                    console.log("📺 Fullscreen exited (Safari)");
                } else if (document.msFullscreenElement) {
                    document.msExitFullscreen();
                    setIsFullscreen(false);
                    console.log("📺 Fullscreen exited (IE11)");
                }
            }
        } else {
            console.warn("⚠️ No valid container ref for fullscreen");
        }
    };

    // ✨ PHASE 4.107: Backward 5 seconds handler for all video types
    // ✨ PHASE 4.111: Improved YouTube support with better error handling
    const handleBackward5Seconds = () => {
        const isUploadedVideo = isVideoFile(variantItem.file);
        const isYouTubeEmbed = videoUrl && videoUrl.includes('youtube.com/embed');
        const isGoogleDrive = videoUrl && videoUrl.includes('drive.google.com/file');
        
        if (isUploadedVideo && videoRef.current) {
            // ✨ PHASE 4.107: HTML5 video - direct seek (works perfectly)
            const newTime = Math.max(0, videoRef.current.currentTime - 5);
            videoRef.current.currentTime = newTime;
            console.log(`⏪ HTML5 Backward 5 seconds: ${videoRef.current.currentTime.toFixed(1)}s`);
        } else if (isYouTubeEmbed) {
            // ✨ PHASE 4.111: YouTube - use YouTube API to seek
            if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
                try {
                    const currentTime = youtubePlayerRef.current.getCurrentTime();
                    const newTime = Math.max(0, currentTime - 5);
                    youtubePlayerRef.current.seekTo(newTime, true);  // true = allowSeekAhead
                    console.log(`⏪ YouTube Backward 5 seconds: ${newTime.toFixed(1)}s`);
                } catch (err) {
                    console.warn(`⚠️ YouTube backward seek failed:`, err);
                }
            } else {
                console.warn(`⚠️ YouTube player not ready yet for seeking`);
                if (youtubePlayerRef.current) {
                    console.log("   youtubePlayerRef.current is defined but missing methods");
                } else {
                    console.log("   youtubePlayerRef.current is null/undefined");
                }
            }
        } else if (isGoogleDrive) {
            // ✨ PHASE 4.111: Google Drive - not supported due to iframe sandbox restrictions
            console.log(`📄 Google Drive: Backward seeking not supported (sandbox restriction)`);
            console.log(`   Use the Google Drive native controls by clicking directly on the video player`);
        }
    };

    // Block seeking on video - reset current time if user tries to seek
    const handleTimeSeeking = () => {
        // Block seeking by preventing the timeupdate when user tries to scrub
        if (videoRef.current) {
            // Optional: You can prevent seeking by catching the 'seeking' event
            // For now, we'll hide the progress bar via CSS
        }
    };

    const handleVideoPlay = () => {
        console.log("🎬 [VideoPlayer] handleVideoPlay called");
        setIsPlaying(true);
    };

    const handleVideoPause = () => {
        console.log("⏸️ [VideoPlayer] handleVideoPause called");
        setIsPlaying(false);
    };

    // ✨ PHASE 4.91: Video focus handlers and keyboard controls
    const handleVideoBlur = () => {
        setIsVideoFocused(false);
    };

    // Block arrow keys (left and right) on video element and show notification
    const handleVideoKeyDown = (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            // Emit custom event that parent can listen to
            if (containerRef.current) {
                const eventDetail = {
                    key: e.key,
                    blocked: true
                };
                containerRef.current.dispatchEvent(
                    new CustomEvent('arrowKeyBlocked', { detail: eventDetail, bubbles: true })
                );
            }
            return false;
        }
    };

    // Prevent focus on video element
    const handleVideoFocus = (e) => {
        // Immediately blur the video element to prevent native control interaction
        if (videoRef.current) {
            videoRef.current.blur();
        }
    };

    // ✨ PHASE 4.92: Arrow keys can't be blocked in iframes due to sandbox isolation
    // (Keyboard events inside iframe don't bubble to parent - kept for reference)

    // Convert Google Drive and YouTube URLs to embeddable format
    const convertUrlToEmbeddable = (url, shouldAutoplay = false, hasSeekPosition = false) => {
        if (!url || typeof url !== 'string') return url;
        
        // Google Drive - use /preview endpoint with iframe
        if (url.includes('drive.google.com')) {
            const fileId = extractGoogleDriveFileId(url);
            if (fileId) {
                // ✨ PHASE 4.103: Return plain preview URL without autoplay parameter
                // Google Drive doesn't support autoplay due to sandbox restrictions
                return `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }
        
        // YouTube - convert to embed format
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
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
                // ✨ PHASE 4.126: Skip autoplay=1 in iframe URL when resuming from progress
                // If seekPosition exists, don't autoplay yet - let seek effect handle it
                // This prevents YouTube from auto-starting at 0:00 before seek can trigger
                let shouldUseAutoplay = shouldAutoplay && !hasSeekPosition;
                
                if (shouldUseAutoplay) {
                    // When autoplay is requested AND no seek position: autoplay=1
                    return `${embedUrl}?autoplay=1&fs=1&modestbranding=1&rel=0&enablejsapi=1`;
                } else {
                    // Default: no autoplay (will be handled by seek effect or user click)
                    return `${embedUrl}?fs=1&modestbranding=1&rel=0&enablejsapi=1`;
                }
            }
        }
        
        return url;
    };

    // ✨ PHASE 4.126: Pass seekPosition info to convertUrlToEmbeddable so it skips autoplay
    const videoUrl = convertUrlToEmbeddable(variantItem.file, autoplay, seekPosition && seekPosition > 0);
    const isGoogleDrive = videoUrl && videoUrl.includes('drive.google.com/file') && videoUrl.includes('/preview');
    const isYouTubeEmbed = videoUrl && videoUrl.includes('youtube.com/embed');
    const isUploadedVideo = isVideoFile(variantItem.file);

    // Debug logging
    useEffect(() => {
        console.log("\n🔍 VideoPlayer Debug Info:");
        console.log("  variantItem:", variantItem?.title);
        console.log("  autoplay prop:", autoplay);
        console.log("  onPlayingChange callback:", onPlayingChange ? "✅ PROVIDED" : "❌ MISSING");
        console.log("  isUploadedVideo:", isUploadedVideo);
        console.log("  isYouTubeEmbed:", isYouTubeEmbed);
        console.log("  isGoogleDrive:", isGoogleDrive);
        console.log("  videoUrl:", videoUrl);
        
        // Show expected behavior for each video type
        if (isUploadedVideo) {
            console.log("\n✅ Video HTML5: Autoplay akan berfungsi saat pelajaran diklik");
        }
        if (isYouTubeEmbed) {
            console.log("\n✅ YouTube: Autoplay akan berfungsi saat pelajaran diklik");
        }
        if (isGoogleDrive) {
            console.log("\nℹ️ Google Drive: Kontrol terbatas tersedia");
            console.log("✨ Tombol yang tersedia: Mulai dari Awal, Layar Penuh");
            console.log("💡 Anda memiliki 5 detik untuk mengklik video untuk memutar/menjeda/mencari menggunakan kontrol asli");
            console.log("⏱️ Setelah 5 detik, klik di tengah akan diblokir (gunakan tombol khusus sebagai gantinya)");
        }
    }, [variantItem, autoplay, isUploadedVideo, isYouTubeEmbed, isGoogleDrive, videoUrl]);

    // ✨ PHASE 4.105: Notify parent when playing state changes
    useEffect(() => {
        console.log("📢 [VideoPlayer] useEffect: isPlaying changed to", isPlaying);
        console.log("   onPlayingChange callback:", onPlayingChange ? "✅ exists" : "❌ missing");
        if (onPlayingChange) {
            console.log("📤 [VideoPlayer] Calling onPlayingChange(", isPlaying, ")");
            onPlayingChange(isPlaying);
        } else {
            console.warn("⚠️ [VideoPlayer] onPlayingChange NOT provided!");
        }
    }, [isPlaying, onPlayingChange]);

    // ✨ PHASE 4.107: Load YouTube IFrame API for play/pause control via postMessage
    // ✨ PHASE 4.118: Load YouTube API globally once (not per component)
    useEffect(() => {
        // Load YouTube API once globally if not already loaded
        if (!window.YT && !window.youtubeAPILoading) {
            console.log("📺 [GLOBAL] Loading YouTube IFrame API script (first time)");
            window.youtubeAPILoading = true;  // Prevent multiple loads
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onload = () => {
                console.log("📺 [GLOBAL] YouTube IFrame API loaded successfully");
            };
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
    }, []);

    useEffect(() => {
        if (isYouTubeEmbed) {
            // Check if YouTube API is already loaded
            if (!window.YT) {
                console.log("⏳ [VideoPlayer] YouTube API not loaded yet, waiting...");
            } else {
                console.log("✅ [VideoPlayer] YouTube IFrame API is available");
            }
        }
    }, [isYouTubeEmbed]);

    // ✨ PHASE 4.107: Initialize YouTube player instance for backward seeking
    // ✨ PHASE 4.111: Improved initialization with retry logic and better timing
    // ✨ PHASE 4.128: Fixed - re-initialize player when switching between YouTube lessons
    useEffect(() => {
        if (!isYouTubeEmbed || !iframeRef.current) {
            console.log("⏭️ YouTube player initialization skipped - not YouTube or no iframe ref");
            return;
        }
        
        // ✨ PHASE 4.128: Reset player initialization flag when switching lessons
        // This ensures a new player is created for each lesson (prevents stale refs)
        iframeRef.current.dataset.playerInitialized = '';
        youtubePlayerRef.current = null;  // Clear old ref
        console.log(`🔄 [VideoPlayer.YouTube.Init] Resetting for lesson switch (clearing old player ref)`);
        
        let initAttempts = 0;
        const maxAttempts = 10;
        
        const initializeYouTubePlayer = () => {
            if (!window.YT || !window.YT.Player) {
                initAttempts++;
                if (initAttempts < maxAttempts) {
                    console.log(`⏳ YouTube API not ready (attempt ${initAttempts}/${maxAttempts}), retrying...`);
                    setTimeout(initializeYouTubePlayer, 300);
                } else {
                    console.warn(`⚠️ YouTube API failed to load after ${maxAttempts} attempts`);
                }
                return;
            }
            
            try {
                // Check if player is already initialized
                if (!iframeRef.current.dataset.playerInitialized) {
                    console.log("🚀 Creating new YouTube Player instance...");
                    const player = new window.YT.Player(iframeRef.current, {
                        events: {
                            'onReady': (event) => {
                                youtubePlayerRef.current = event.target;
                                iframeRef.current.dataset.playerInitialized = 'true';
                                console.log("✅ YouTube player initialized successfully for custom controls");
                                console.log("   Available methods: playVideo, pauseVideo, seekTo, getCurrentTime");
                            },
                            'onStateChange': (event) => {
                                if (event.data === window.YT.PlayerState.PLAYING) {
                                    setIsPlaying(true);
                                    console.log("▶️ YouTube state: PLAYING");
                                } else if (event.data === window.YT.PlayerState.PAUSED) {
                                    setIsPlaying(false);
                                    console.log("⏸️ YouTube state: PAUSED");
                                } else if (event.data === window.YT.PlayerState.ENDED) {
                                    // ✨ PHASE 4.133: Call completion handler when YouTube video ends
                                    console.log("✅ YouTube state: ENDED");
                                    if (handleMarkLessonAsCompleted) {
                                        console.log(`🎬 [VideoPlayer.YouTube] Video finished - calling completion handler for ${variantItem?.variant_item_id}`);
                                        handleMarkLessonAsCompleted(variantItem?.variant_item_id, true);
                                    }
                                    setIsPlaying(false);
                                    setProgressPercentage(100);
                                }
                            },
                            'onError': (event) => {
                                console.error("❌ YouTube player error:", event.data);
                            }
                        }
                    });
                } else {
                    console.log("📺 YouTube player already initialized on this iframe");
                }
            } catch (err) {
                console.warn("⚠️ Failed to initialize YouTube player:", err);
            }
        };
        
        // Start initialization immediately
        initializeYouTubePlayer();
        
    }, [isYouTubeEmbed, variantItem?.variant_item_id]);  // ✨ PHASE 4.128: Added variantItem to re-init on lesson change

    // ✨ PHASE 4.103: Auto-play YouTube iframe when autoplay prop is true
    // ✨ PHASE 4.120: Skip iframe autoplay if we have a seek position - seek first, then play manually
    useEffect(() => {
        if (autoplay && isYouTubeEmbed && iframeRef.current) {
            // ✨ PHASE 4.120: If resuming from saved position, don't autoplay in iframe - will play manually after seek
            if (seekPosition && seekPosition > 0) {
                console.log(`📺 [YouTube.Autoplay] Skipping iframe autoplay (resuming from position ${seekPosition}s) - will play manually after seek`);
                return;  // Don't trigger autoplay yet - seek effect will handle it first
            }

            console.log("📺 YouTube autoplay triggered");
            console.log("Current YouTube URL:", videoUrl);
            
            // YouTube URL should already include autoplay=1 from convertUrlToEmbeddable
            // Only reload if the URL doesn't have autoplay parameter yet
            if (!videoUrl.includes('autoplay=1')) {
                console.log("📺 YouTube URL missing autoplay=1, adding it now");
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
                
                console.log("Updated YouTube URL:", youtubeUrlWithAutoplay);
                
                // Reload iframe src to trigger autoplay
                if (iframeRef.current.src !== youtubeUrlWithAutoplay) {
                    iframeRef.current.src = youtubeUrlWithAutoplay;
                    console.log("✅ YouTube iframe reloaded with autoplay");
                }
            } else {
                console.log("✅ YouTube URL already has autoplay=1, no reload needed");
            }
        }
    }, [autoplay, isYouTubeEmbed, videoUrl, seekPosition]);  // ✨ PHASE 4.120: Added seekPosition dependency

    // ✨ PHASE 4.140+: Handle HTML5 video seek when resuming with improved autoplay retry logic
    useEffect(() => {
        // Only for HTML5 videos, not YouTube/Google Drive
        if (isYouTubeEmbed || isGoogleDrive || !isUploadedVideo || !seekPosition || seekPosition <= 0) {
            return;
        }

        console.log(`⏩ [VideoPlayer.HTML5.onSeek] Seeking to saved position: ${seekPosition}s, autoplay=${autoplay}`);

        if (videoRef.current) {
            try {
                // Set current time to resume position
                videoRef.current.currentTime = seekPosition;
                console.log(`✅ [VideoPlayer.HTML5.onSeek] Seek completed to ${seekPosition}s`);

                // If autoplay enabled, play video with retry logic
                if (autoplay && typeof videoRef.current.play === 'function') {
                    // ✨ PHASE 4.140: Add retry mechanism for autoplay after hard refresh
                    // Browser autoplay policy may require video to be loadable before playing
                    // Use exponential backoff: 50ms, 100ms, 200ms, 400ms (total 750ms)
                    const attemptPlay = (retryCount = 0, maxRetries = 4) => {
                        const video = videoRef.current;
                        
                        if (!video) {
                            console.warn(`⚠️ [VideoPlayer.HTML5.onSeek] Video ref no longer available on retry #${retryCount}`);
                            return;
                        }

                        // Check video readiness state
                        const readyState = video.readyState;
                        const readyStateNames = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
                        
                        console.log(`⏳ [VideoPlayer.HTML5.onSeek] Autoplay attempt #${retryCount + 1}: readyState=${readyState} (${readyStateNames[readyState]})`);
                        
                        // Only attempt to play if video has at least current data
                        if (readyState >= 2) { // HAVE_CURRENT_DATA or better
                            console.log(`▶️ [VideoPlayer.HTML5.onSeek] Attempting to play video (readyState sufficient)`);
                            video.play()
                                .then(() => {
                                    console.log(`✅ [VideoPlayer.HTML5.onSeek] Auto-play succeeded after ${retryCount} retries`);
                                    setIsPlaying(true);
                                })
                                .catch(err => {
                                    console.warn(`⚠️ [VideoPlayer.HTML5.onSeek] Autoplay rejected on attempt #${retryCount + 1}: ${err.message}`);
                                    
                                    // If browser rejected autoplay (NotAllowedError), don't retry
                                    if (err.name === 'NotAllowedError') {
                                        console.log(`ℹ️ [VideoPlayer.HTML5.onSeek] Browser blocked autoplay (user gesture required) - video ready but not auto-playing`);
                                        setIsPlaying(false);
                                    } else if (retryCount < maxRetries) {
                                        // For other errors, retry with exponential backoff
                                        const delay = 50 * Math.pow(2, retryCount);
                                        console.log(`⏳ [VideoPlayer.HTML5.onSeek] Retrying in ${delay}ms...`);
                                        setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                                    } else {
                                        console.warn(`❌ [VideoPlayer.HTML5.onSeek] Autoplay failed after ${maxRetries} retries`);
                                        setIsPlaying(false);
                                    }
                                });
                        } else if (retryCount < maxRetries) {
                            // Video not ready yet, retry
                            const delay = 50 * Math.pow(2, retryCount);
                            console.log(`⏳ [VideoPlayer.HTML5.onSeek] Video not ready (readyState=${readyState}), retrying in ${delay}ms...`);
                            setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                        } else {
                            console.warn(`❌ [VideoPlayer.HTML5.onSeek] Video never reached ready state after ${maxRetries} retries (readyState=${readyState})`);
                            setIsPlaying(false);
                        }
                    };
                    
                    // Start autoplay attempts immediately
                    attemptPlay();
                }
            } catch (error) {
                console.warn(`⚠️ [VideoPlayer.HTML5.onSeek] Error seeking:`, error);
            }
        }
    }, [isUploadedVideo, isYouTubeEmbed, isGoogleDrive, seekPosition, autoplay]);

    // ✨ PHASE 4.103: Auto-play Google Drive iframe - NOT SUPPORTED
    // Google Drive /preview endpoint has strict sandbox isolation that prevents autoplay
    // Users must click inside the Google Drive player to start playback
    // 5-second click window allows easy access to the play button
    useEffect(() => {
        if (autoplay && isGoogleDrive && iframeRef.current) {
            console.log("📄 Google Drive loaded (autoplay not supported due to sandbox restrictions)");
            console.log("💡 Quick access window: Click overlay-h-2 (center) within 5 seconds to interact");
            console.log("⏱️ After 5 seconds, center overlay becomes blocked");
        }
    }, [autoplay, isGoogleDrive, videoUrl]);
    
    // ✨ PHASE 4.104: Auto-hide buttons after 1 second of mouse inactivity
    useEffect(() => {
        if (!mouseActive) return;  // Only set timer when mouse is active

        // Clear existing timer
        if (mouseInactiveTimer.current) {
            clearTimeout(mouseInactiveTimer.current);
        }

        // Set new timer to hide buttons after 1 second
        mouseInactiveTimer.current = setTimeout(() => {
            setMouseActive(false);
        }, 1000);  // 1 second

        return () => {
            if (mouseInactiveTimer.current) {
                clearTimeout(mouseInactiveTimer.current);
            }
        };
    }, [mouseActive]);

    // ✨ PHASE 4.103: Start 5-second timer for Google Drive overlay-h-2 click window
    // ✨ PHASE 4.111: Reset timer when switching to new lesson to allow fresh 5-second window
    useEffect(() => {
        // Reset the click-expired state when a new lesson/video is loaded
        if (isGoogleDrive && videoUrl) {
            setGoogleDriveClickExpired(false);
            console.log("🔄 Video Google Drive baru dimuat - jendela klik 5 detik direset");
        }
    }, [videoUrl, isGoogleDrive]);

    useEffect(() => {
        if (!isGoogleDrive || googleDriveClickExpired) return;  // Only set timer for Google Drive before expiration

        const clickTimer = setTimeout(() => {
            setGoogleDriveClickExpired(true);
            console.log("⏱️ Google Drive 5-second click window expired - overlay-h-2 is now blocked");
        }, 5000);  // 5 seconds

        return () => clearTimeout(clickTimer);
    }, [isGoogleDrive, googleDriveClickExpired]);
    // ✨ PHASE 4.103+autoplay: Auto-play HTML5 video with improved retry logic
    // Only triggers when: (a) autoplay=true, (b) is HTML5 video, (c) NO saved seek position
    useEffect(() => {
        // Skip if we're resuming from saved progress (seek effect will handle it)
        // OR if autoplay not requested OR if not an uploaded video
        if (!autoplay || !isUploadedVideo || seekPosition && seekPosition > 0) {
            return;
        }

        console.log(`▶️ [VideoPlayer.HTML5.Autoplay] Starting autoplay (no resume position)`);

        if (videoRef.current) {
            // ✨ PHASE 4.140: Add retry mechanism similar to seek recovery
            // Video might not be ready immediately on mount
            const attemptPlay = (retryCount = 0, maxRetries = 3) => {
                const video = videoRef.current;
                
                if (!video) {
                    console.warn(`⚠️ [VideoPlayer.HTML5.Autoplay] Video ref no longer available`);
                    return;
                }

                const readyState = video.readyState;
                const readyStateNames = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'];
                
                console.log(`⏳ [VideoPlayer.HTML5.Autoplay] Attempt #${retryCount + 1}: readyState=${readyState} (${readyStateNames[readyState]})`);
                
                if (readyState >= 2) { // HAVE_CURRENT_DATA or better
                    video.play()
                        .then(() => {
                            console.log(`✅ [VideoPlayer.HTML5.Autoplay] Auto-play succeeded`);
                            setIsPlaying(true);
                        })
                        .catch(err => {
                            console.warn(`⚠️ [VideoPlayer.HTML5.Autoplay] Play rejected on attempt #${retryCount + 1}: ${err.message}`);
                            
                            if (err.name === 'NotAllowedError') {
                                console.log(`ℹ️ [VideoPlayer.HTML5.Autoplay] Browser blocked autoplay (user gesture required)`);
                                setIsPlaying(false);
                            } else if (retryCount < maxRetries) {
                                const delay = 50 * Math.pow(2, retryCount);
                                console.log(`⏳ [VideoPlayer.HTML5.Autoplay] Retrying in ${delay}ms...`);
                                setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                            } else {
                                console.warn(`❌ [VideoPlayer.HTML5.Autoplay] Failed after ${maxRetries} retries`);
                                setIsPlaying(false);
                            }
                        });
                } else if (retryCount < maxRetries) {
                    const delay = 50 * Math.pow(2, retryCount);
                    console.log(`⏳ [VideoPlayer.HTML5.Autoplay] Video not ready, retrying in ${delay}ms...`);
                    setTimeout(() => attemptPlay(retryCount + 1, maxRetries), delay);
                } else {
                    console.warn(`❌ [VideoPlayer.HTML5.Autoplay] Video never reached ready state (readyState=${readyState})`);
                    setIsPlaying(false);
                }
            };

            // Small delay to ensure video element is fully mounted and can accept play() calls
            const playTimer = setTimeout(() => {
                if (videoRef.current) {
                    attemptPlay();
                }
            }, 100);
            
            return () => clearTimeout(playTimer);
        }
    }, [autoplay, variantItem?.variant_item_id, isUploadedVideo, seekPosition]);

    // ✨ PHASE 4.128: YouTube autoplay effect - ensures auto-play/resume works for YouTube videos
    // This effect handles YouTube autoplay separately from the seek effect
    // When user clicks lesson-play-btn with autoplay=true on a YouTube video:
    // - If there's saved progress (seekPosition > 0): seek effect will seek + playVideo()
    // - If there's NO saved progress: this effect ensures playVideo() is called
    useEffect(() => {
        if (!autoplay || !isYouTubeEmbed) {
            return;  // Not applicable for non-YouTube or non-autoplay scenarios
        }

        // Wait for YouTube player to be ready
        let autoplayAttempts = 0;
        const maxAutoplayAttempts = 15;  // Try for up to 1.5 seconds (15 * 100ms)

        const attemptAutoplay = () => {
            const youtubePlayer = youtubePlayerRef.current;

            // Check if player is ready with playVideo method
            if (!youtubePlayer || typeof youtubePlayer.playVideo !== 'function') {
                autoplayAttempts++;
                if (autoplayAttempts < maxAutoplayAttempts) {
                    console.log(`⏳ [VideoPlayer.YouTube.Autoplay] Player not ready (attempt ${autoplayAttempts}/${maxAutoplayAttempts}), retrying in 100ms...`);
                    setTimeout(attemptAutoplay, 100);
                } else {
                    console.warn(`⚠️ [VideoPlayer.YouTube.Autoplay] Failed to autoplay: player not ready after ${maxAutoplayAttempts} attempts`);
                }
                return;
            }

            try {
                // Get current player state to check if already playing
                const playerState = typeof youtubePlayer.getPlayerState === 'function' 
                    ? youtubePlayer.getPlayerState() 
                    : null;
                
                // State codes: -1 = UNSTARTED, 0 = ENDED, 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 5 = CUED
                const isAlreadyPlaying = playerState === 1;

                if (!isAlreadyPlaying) {
                    youtubePlayer.playVideo();
                    console.log(`▶️ [VideoPlayer.YouTube.Autoplay] Auto-playing YouTube video (state was ${playerState})`);
                    setIsPlaying(true);
                } else {
                    console.log(`ℹ️ [VideoPlayer.YouTube.Autoplay] Video already playing (state=${playerState})`);
                }
            } catch (error) {
                console.warn(`⚠️ [VideoPlayer.YouTube.Autoplay] Error calling playVideo():`, error);
            }
        };

        // Start attempting autoplay with small initial delay
        setTimeout(attemptAutoplay, 100);

    }, [autoplay, variantItem?.variant_item_id, isYouTubeEmbed]);  // Re-run when autoplay, variant, or video type changes

    // ✨ PHASE 4.118: Track YouTube video progress every 500ms (even before player is ready)
    useEffect(() => {
        // Only set up polling for YouTube videos
        if (!isYouTubeEmbed) {
            return;
        }

        console.log(`📊 [VideoPlayer.YouTubeProgress] Setting up polling for YouTube video: ${variantItem?.title || 'Unknown'} (ID: ${variantItem?.variant_item_id})`);  // ✨ PHASE 4.130: Enhanced logging for hard refresh debugging

        const progressInterval = setInterval(() => {
            try {
                // ✨ PHASE 4.126: Verify variantItem is still valid for this polling cycle
                // This prevents stale closures from reporting progress for the wrong lesson
                if (!variantItem || !variantItem.variant_item_id) {
                    return;  // Lesson was unmounted, stop polling
                }

                // Check if should continue polling (inside the loop, not in dependencies)
                const youtubePlayer = youtubePlayerRef.current;
                
                // Only poll if: player exists and methods are available
                if (!youtubePlayer || typeof youtubePlayer.getCurrentTime !== 'function' || typeof youtubePlayer.getDuration !== 'function') {
                    return;  // Skip this poll cycle, player not ready yet
                }

                const currentTime = youtubePlayer.getCurrentTime();
                const duration = youtubePlayer.getDuration();
                
                // ✨ PHASE 4.121: Check player state to diagnose playback issues
                let playerState = 'UNKNOWN';
                try {
                    if (youtubePlayer.getPlayerState) {
                        const state = youtubePlayer.getPlayerState();
                        const stateMap = {
                            '-1': 'UNSTARTED',
                            '0': 'ENDED',
                            '1': 'PLAYING',
                            '2': 'PAUSED',
                            '3': 'BUFFERING',
                            '5': 'VIDEO_CUED'
                        };
                        playerState = stateMap[state] || `UNKNOWN(${state})`;
                    }
                } catch (e) {
                    // Ignore state check errors
                }

                // Only update if we have valid video duration (skip loading state)
                if (duration > 0 && currentTime >= 0) {
                    // ✨ PHASE 4.118: Update progress percentage for YouTube videos (like HTML5 videos)
                    const percentage = (currentTime / duration) * 100;
                    setCurrentTime(currentTime);  // ✨ PHASE 4.130: Update currentTime state for video timer display
                    setDuration(duration);  // ✨ PHASE 4.119: Set duration state so header can display progress
                    setProgressPercentage(Math.round(percentage));

                    // ✨ PHASE 4.130: Log more frequently after hard refresh to diagnose update issues
                    if (Math.random() < 0.1) {  // Sample every ~10th call (50x per second = 5x per second)
                        console.log(`▶️ [VideoPlayer.YouTubeProgress] UPDATED - Lesson: ${variantItem?.variant_item_id}, time=${currentTime.toFixed(1)}s, duration=${duration.toFixed(1)}s, progress=${percentage.toFixed(1)}%, state=${playerState}`);
                    }

                    // ✨ PHASE 4.129: Only report progress if video is PLAYING (state = 1)
                    // Don't report when paused (state = 2), buffering (state = 3), or in other states
                    // This prevents continuous backend updates when user pauses the video
                    const playerStatePlaying = youtubePlayer.getPlayerState?.() === 1;  // 1 = PLAYING
                    
                    // ✨ PHASE 4.140: FIXED - Allow progress reporting from 0% on hard refresh
                    // The `currentTime > 0` check was blocking initial progress reports when video starts at 0s
                    // This prevented hard refresh scenario from ever sending the first progress update to backend
                    // Now: Report as long as player is playing and we have valid duration data
                    if (playerStatePlaying && duration > 0 && onProgress) {
                        onProgress({
                            played: currentTime / duration,
                            loaded: 1,
                            duration: duration,
                            currentTime: currentTime
                        });
                    }
                }
            } catch (error) {
                // Silently ignore errors during polling - player might be temporarily unavailable
            }
        }, 500);  // Poll every 500ms

        return () => {
            clearInterval(progressInterval);
        };
    }, [isYouTubeEmbed, variantItem?.variant_item_id, onProgress]);  // ✨ PHASE 4.130: Use ID only, not object ref, for consistency after hard refresh

    // ✨ PHASE 4.119: Handle YouTube video seek when resuming (with player readiness verification)
    useEffect(() => {
        if (!isYouTubeEmbed || !seekPosition || seekPosition <= 0) {
            return;
        }

        // ✨ PHASE 4.119: Retry seeking with player readiness check
        let seekAttempts = 0;
        const maxSeekAttempts = 10;

        const attemptSeek = () => {
            const youtubePlayer = youtubePlayerRef.current;
            
            // Check if player is ready with all required methods
            if (!youtubePlayer || typeof youtubePlayer.seekTo !== 'function' || typeof youtubePlayer.getDuration !== 'function') {
                seekAttempts++;
                if (seekAttempts < maxSeekAttempts) {
                    console.log(`⏳ [VideoPlayer.YouTube.onSeek] Player not ready (attempt ${seekAttempts}/${maxSeekAttempts}), retrying in 100ms...`);
                    setTimeout(attemptSeek, 100);
                } else {
                    console.warn(`⚠️ [VideoPlayer.YouTube.onSeek] Failed to seek: player not ready after ${maxSeekAttempts} attempts`);
                }
                return;
            }

            try {
                // Verify duration is available
                const duration = youtubePlayer.getDuration();
                if (duration <= 0) {
                    seekAttempts++;
                    if (seekAttempts < maxSeekAttempts) {
                        console.log(`⏳ [VideoPlayer.YouTube.onSeek] Duration not available (attempt ${seekAttempts}/${maxSeekAttempts}), retrying in 100ms...`);
                        setTimeout(attemptSeek, 100);
                    } else {
                        console.warn(`⚠️ [VideoPlayer.YouTube.onSeek] Failed to seek: duration unavailable`);
                    }
                    return;
                }

                console.log(`⏩ [VideoPlayer.YouTube.onSeek] Seeking to saved position: ${seekPosition}s (duration: ${duration.toFixed(1)}s)`);
                youtubePlayer.seekTo(seekPosition, true);  // true = allowSeekAhead
                console.log(`✅ [VideoPlayer.YouTube.onSeek] Seek completed`);
                
                // ✨ PHASE 4.120: If autoplay is enabled, play video after seek completes
                if (autoplay && typeof youtubePlayer.playVideo === 'function') {
                    setTimeout(() => {
                        youtubePlayer.playVideo();
                        console.log(`▶️ [VideoPlayer.YouTube.onSeek] Playing video after seek completed`);
                    }, 100);  // Small delay to ensure seek is fully applied before playing
                }
            } catch (error) {
                console.warn(`⚠️ [VideoPlayer.YouTube.onSeek] Error seeking:`, error);
            }
        };

        // Start attempting to seek (with small initial delay to let player initialize)
        setTimeout(attemptSeek, 100);

    }, [isYouTubeEmbed, seekPosition, autoplay, variantItem?.variant_item_id]);  // ✨ PHASE 4.128: Added variantItem to re-seek on lesson change

    return (
        <div className="video-player-inline">
            {/* Header */}
            <div className="video-player-header">
                <div className="video-player-header-content">
                    <div className="video-player-icon-box">
                        <i className={`${getFileTypeIcon(variantItem?.file, variantItem)} text-white`}></i>
                    </div>
                    <div className="video-player-title-wrapper">
                        <div className="video-player-title fw-bold">{variantItem?.title}</div>
                        <small className="opacity-90">
                            {getFileTypeLabel(variantItem?.file, variantItem)}
                            {/* ✨ PHASE 4.127: Show video timer (current time / total duration) */}
                            {duration > 0 && ` • ${formatVideoTimer()}`} 
                            {/* ✨ PHASE 4.114: Show progress percentage in Indonesian for all video types */}
                            {duration > 0 && progressPercentage > 0 && ` • ${progressPercentage}% ditonton`}
                            
                        </small>
                    </div>
                </div>
                <button
                    type="button"
                    className="btn-close btn-close-white video-player-close-btn"
                    aria-label="Close"
                    onClick={handleClose}
                ></button>
            </div>

            {/* Content */}
            <div className="video-player-content">
                {/* FULL OVERLAY - Blocking layer covering entire video area */}
                {isVideoContent(variantItem) && isUploadedVideo && !loadError && (
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
                        onKeyDown={(e) => {
                            // ✨ PHASE 4.103: Block arrow keys on overlay itself
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                e.preventDefault();
                                e.stopPropagation();
                                // Dispatch custom event for parent notification
                                if (containerRef.current) {
                                    containerRef.current.dispatchEvent(
                                        new CustomEvent('arrowKeyBlocked', {
                                            detail: { key: e.key },
                                            bubbles: true
                                        })
                                    );
                                } else {
                                    document.dispatchEvent(
                                        new CustomEvent('arrowKeyBlocked', {
                                            detail: { key: e.key },
                                            bubbles: true
                                        })
                                    );
                                }
                                return false;
                            }
                        }}
                        tabIndex="0"
                        style={{ background: 'transparent' }}  /* ✨ PHASE 4.104: Make overlay transparent instead of red */
                    />
                )}
                {isVideoContent(variantItem) ? (
                    loadError ? (
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
                    ) : isGoogleDrive || isYouTubeEmbed ? (
                        // ✨ PHASE 4.87: Use iframe for Google Drive and YouTube (aspect ratio container)
                        // ⚠️ LIMITATION: YouTube & Google Drive iframes have built-in controls (arrow keys, PIP) 
                        // that CANNOT be disabled due to iframe sandbox isolation and their player APIs.
                        // To disable seeking & PIP, you must:
                        // 1. Host videos on your own server (S3, etc.) - use native <video> element instead
                        // 2. Use a custom player library (HLS.js, Video.js) with full control
                        // 3. Accept these limitations with third-party embeds
                        <div 
                            ref={iframeContainerRef}
                            className="video-player-aspect-ratio-container"
                            onKeyDown={(e) => {
                                // ✨ PHASE 4.103: Block arrow keys on iframe container
                                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Dispatch custom event for parent notification
                                    document.dispatchEvent(
                                        new CustomEvent('arrowKeyBlocked', {
                                            detail: { key: e.key },
                                            bubbles: true
                                        })
                                    );
                                    return false;
                                }
                            }}
                            onMouseMove={() => {
                                // ✨ PHASE 4.111: Show buttons on mouse movement for YouTube/Google Drive
                                setMouseActive(true);
                            }}
                            onMouseEnter={() => {
                                // ✨ PHASE 4.111: Show buttons when entering iframe container for YouTube/Google Drive
                                setMouseActive(true);
                            }}
                            tabIndex="0"
                        >
                            {/* Overlay - Full coverage, pointer-events controlled per section */}
                            <div className="overlay-container" style={{ 
                                pointerEvents: isYouTubeEmbed ? 'auto' : 'none'
                                // YouTube: auto (block at container level)
                                // Google Drive: none (let children handle blocking per section)
                            }}>
                                <div 
                                    className="overlay overlay-h-1"
                                    style={{
                                        pointerEvents: isGoogleDrive ? 'auto' : 'none'  // Google Drive: always block, YouTube: parent handles
                                    }}
                                    onClick={(e) => {
                                        if (isGoogleDrive) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
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
                                        pointerEvents: isGoogleDrive && googleDriveClickExpired ? 'auto' : isGoogleDrive ? 'none' : 'auto'
                                        // Google Drive before 5 seconds: 'none' (click passes through to iframe)
                                        // Google Drive after 5 seconds: 'auto' (click blocked by handler)
                                        // YouTube: always 'auto' (parent blocks anyway)
                                    }}
                                    onClick={(e) => {
                                        if (isGoogleDrive && googleDriveClickExpired) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log("⚠️ Click blocked on overlay-h-2 (5-second window expired)");
                                        }
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
                                    className="overlay overlay-h-3"
                                    style={{
                                        pointerEvents: isGoogleDrive ? 'auto' : 'none'  // Google Drive: always block, YouTube: parent handles
                                    }}
                                    onClick={(e) => {
                                        if (isGoogleDrive) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
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
                                        pointerEvents: isGoogleDrive ? 'auto' : 'none'  // Google Drive: always block, YouTube: parent handles
                                    }}
                                    onClick={(e) => {
                                        if (isGoogleDrive) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }
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
                            {/* Iframe Player - Fullscreen, PIP, and Arrow Keys DISABLED */}
                            <iframe
                                ref={iframeRef}
                                src={videoUrl}
                                className="video-player-iframe"
                                sandbox="allow-scripts allow-same-origin allow-autoplay allow-presentation"  // ✨ PHASE 4.103: Relaxed sandbox to allow autoplay and presentation
                                allow="autoplay"  // ✨ PHASE 4.103: Explicit allow attribute for autoplay
                                title="Video Content"
                                onError={() => {
                                    console.error("Iframe failed to load:", videoUrl);
                                    setLoadError(true);
                                }}
                            />
                            
                            {/* ✨ PHASE 4.111: Control Buttons for YouTube - Positioned on top of iframe */}
                            {/* ✨ PHASE 4.111: NOT shown for Google Drive (custom controls not supported) */}
                            {isYouTubeEmbed && (
                                <>
                                    <div className="video-player-controls-container-iframe">
                                        {/* Play/Pause Button - Centered */}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handlePlayPause();
                                            }}
                                            className="video-player-play-pause-btn"
                                            title="Putar/Jeda"
                                            style={{
                                                opacity: mouseActive ? 1 : 0  // Show/hide based on mouse activity
                                            }}
                                        >
                                            <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"} video-player-play-pause-icon ${isPlaying ? "is-playing" : ""}`}></i>
                                        </button>
                                    </div>

                                    {/* Backward 5 Seconds Button - Bottom Left (Above iframe and overlay) */}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleBackward5Seconds();
                                        }}
                                        className="video-player-backward-btn"
                                        title="Mundur 5 detik"
                                        style={{
                                            // ✨ PHASE 4.111: Show/hide based on mouse activity like play/pause and fullscreen
                                            opacity: mouseActive ? 1 : 0,
                                            display: 'flex',
                                            zIndex: 200  // Higher z-index to be above all overlays
                                        }}
                                    >
                                        <i className="fas fa-redo-alt video-player-backward-icon"></i>
                                        <span className="backward-label">5s</span>
                                    </button>

                                    {/* Fullscreen Button - Bottom Right (Above iframe and overlay) */}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleFullscreen();
                                        }}
                                        className="video-player-fullscreen-btn"
                                        title="Layar Penuh"
                                        style={{
                                            opacity: mouseActive ? 1 : 0,  // Show/hide based on mouse activity
                                            display: 'flex',
                                            zIndex: 200  // Higher z-index to be above all overlays
                                        }}
                                    >
                                        <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}></i>
                                    </button>
                                </>
                            )}
                            
                            {/* ✨ PHASE 4.113: Google Drive - show limited controls (restart + fullscreen only) */}
                            {isGoogleDrive && (
                                <>
                                    {/* Start from Beginning Button - Bottom Left */}
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // ✨ PHASE 4.113: Reload iframe to restart from beginning and reset 5-second click window
                                            if (iframeRef.current) {
                                                iframeRef.current.src = iframeRef.current.src;
                                                // Reset the 5-second click window so user can interact with native controls again
                                                setGoogleDriveClickExpired(false);
                                                console.log("🔄 Video Google Drive dimulai ulang dari awal");
                                                console.log("💡 Jendela klik 5 detik direset - Anda sekarang dapat mengklik kontrol asli");
                                            }
                                        }}
                                        className="video-player-backward-btn"
                                        title="Mulai dari Awal"
                                        style={{
                                            opacity: mouseActive ? 1 : 0,
                                            display: 'flex',
                                            zIndex: 200
                                        }}
                                    >
                                        <i className="fas fa-redo video-player-backward-icon"></i>
                                        <span className="backward-label">Mulai</span>
                                    </button>

                                    {/* Fullscreen Button - Bottom Right */}
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
                                </>
                            )}
                        </div>
                    ) : isUploadedVideo ? (
                        // ✨ PHASE 4.90: Dark overlay blocking layer - prevents all video interactions except buttons
                        <div 
                            ref={containerRef}
                            className="video-player-video-container video-player-video-hover"  /* ✨ PHASE 4.104: Add hover class for button visibility */
                            onKeyDown={handleVideoKeyDown}
                            tabIndex="-1"
                            onMouseMove={() => {
                                // ✨ PHASE 4.104: Show buttons on mouse movement
                                setMouseActive(true);
                            }}
                            onMouseEnter={() => {
                                // ✨ PHASE 4.104: Show buttons when entering video container
                                setMouseActive(true);
                            }}
                        >
                            {/* Native Video Player - NO CONTROLS */}
                            <video
                                ref={videoRef}
                                src={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                className="video-player-video-element"
                                onPlay={handleVideoPlay}
                                onPause={handleVideoPause}
                                onFocus={handleVideoFocus}
                                onBlur={handleVideoBlur}
                                onKeyDown={handleVideoKeyDown}
                                muted={false}  // ✨ PHASE 4.103: Set to false (user may have sound preferences)
                                autoPlay={autoplay && (!seekPosition || seekPosition <= 0)}  // ✨ PHASE 4.122: Skip autoPlay if resuming progress (will play manually after seek)
                                tabIndex="-1"
                                onLoadedMetadata={() => {
                                    // ✨ PHASE 4.114: Track duration when metadata loads
                                    if (videoRef.current) {
                                        setDuration(videoRef.current.duration);
                                        console.log("✅ [VideoPlayer.HTML5] Video metadata loaded, duration:", videoRef.current.duration);
                                    }
                                    console.log(`✅ [VideoPlayer.HTML5] Metadata loaded - autoplay=${autoplay}, seekPosition=${seekPosition}`);
                                }}
                                onTimeUpdate={() => {
                                    // ✨ PHASE 4.114: Track current playback time and calculate progress percentage
                                    if (videoRef.current && videoRef.current.duration) {
                                        setCurrentTime(videoRef.current.currentTime);
                                        const percentage = (videoRef.current.currentTime / videoRef.current.duration) * 100;
                                        setProgressPercentage(Math.round(percentage));
                                        
                                        // ✨ PHASE 4.115: Call onProgress callback to report progress to parent
                                        if (onProgress) {
                                            // Sample log every ~10 frames to avoid spam
                                            if (Math.random() < 0.1) {
                                                console.log(`▶️ [VideoPlayer.onTimeUpdate] currentTime=${videoRef.current.currentTime.toFixed(1)}s, duration=${videoRef.current.duration.toFixed(1)}s, calling onProgress`);
                                            }
                                            onProgress({
                                                played: videoRef.current.currentTime / videoRef.current.duration,
                                                loaded: 1,
                                                duration: videoRef.current.duration,
                                                currentTime: videoRef.current.currentTime
                                            });
                                        } else {
                                            console.warn(`⚠️ [VideoPlayer.onTimeUpdate] onProgress callback is NOT available!`);
                                        }
                                    }
                                }}
                                onEnded={() => {
                                    // ✨ PHASE 4.133: Mark lesson as completed when video ends
                                    if (handleMarkLessonAsCompleted) {
                                        console.log(`🎬 [VideoPlayer.Upload] Video finished - calling completion handler for ${variantItem?.variant_item_id}`);
                                        handleMarkLessonAsCompleted(variantItem.variant_item_id, true);
                                    }
                                    setIsPlaying(false);
                                    setProgressPercentage(100);  // ✨ PHASE 4.114: Set to 100% when video ends
                                }}
                                onError={() => {
                                    console.error("Video failed to load:", variantItem.file);
                                    setLoadError(true);
                                }}
                            />
                            
                            {/* Control Buttons Container - Above video */}
                            <div className="video-player-controls-container">
                                {/* Play/Pause Button - Centered */}
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handlePlayPause();
                                    }}
                                    className="video-player-play-pause-btn"
                                    title="Putar/Jeda"
                                    style={{
                                        opacity: mouseActive ? 1 : 0  // ✨ PHASE 4.104: Show/hide based on mouse activity
                                    }}
                                >
                                    <i className={`fas ${isPlaying ? "fa-pause" : "fa-play"} video-player-play-pause-icon ${isPlaying ? "is-playing" : ""}`}></i>
                                </button>
                            </div>

                            {/* Backward 5 Seconds Button - Bottom Left (Above overlay and controls) */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleBackward5Seconds();
                                }}
                                className="video-player-backward-btn"
                                title={(() => {
                                    const isUploadedVideo = isVideoFile(variantItem.file);
                                    const isYouTubeEmbed = videoUrl && videoUrl.includes('youtube.com/embed');
                                    if (isUploadedVideo || isYouTubeEmbed) return "Mundur 5 detik";
                                    return "Mundur 5 detik (Tidak didukung untuk jenis video ini)";
                                })()}
                                style={{
                                    // ✨ PHASE 4.111: YouTube always shows button, uploaded video uses mouseActive state
                                    opacity: isYouTubeEmbed ? 1 : (mouseActive ? 1 : 0)
                                }}
                            >
                                <i className="fas fa-redo-alt video-player-backward-icon"></i>
                                <span className="backward-label">5s</span>
                            </button>

                            {/* Fullscreen Button - Bottom Right (Above overlay and controls) */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleFullscreen();
                                }}
                                className="video-player-fullscreen-btn"
                                title="Layar Penuh"
                                style={{
                                    opacity: mouseActive ? 1 : 0  // ✨ PHASE 4.104: Show/hide based on mouse activity
                                }}
                            >
                                <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`}></i>
                            </button>
                        </div>
                    ) : null
                ) : (
                    /* File Preview for Non-Video Files */
                    <div className="video-player-file-preview">
                        <div className="file-preview-container">
                            <div className="file-icon-large mb-3">
                                <i className={`${getFileTypeIcon(variantItem.file, variantItem)} fa-4x video-player-file-icon`}></i>
                            </div>
                            <h5 className="mb-2 text-white">{variantItem.title}</h5>
                            <p className="text-muted mb-4">
                                {getFileTypeLabel(variantItem.file, variantItem)} File
                            </p>
                            <div className="d-flex gap-3 justify-content-center flex-wrap">
                                <a
                                    href={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (handleMarkLessonAsCompleted) {
                                            // ✨ PHASE 4.133: Mark as completed when user opens external file (Google Drive, etc)
                                            setTimeout(() => {
                                                console.log(`🎬 [VideoPlayer.ExternalFile] User opened file - calling completion handler for ${variantItem?.variant_item_id}`);
                                                handleMarkLessonAsCompleted(variantItem.variant_item_id, true);
                                            }, 1000);
                                        }
                                    }}
                                >
                                    <i className="fas fa-external-link-alt me-2"></i>
                                    Buka File
                                </a>
                                <a
                                    href={variantItem.file.startsWith("http") ? variantItem.file : getMediaUrl(variantItem.file)}
                                    download
                                    className="btn btn-outline-light"
                                >
                                    <i className="fas fa-download me-2"></i>
                                    Unduh
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

VideoPlayer.displayName = "VideoPlayer";  // ✨ PHASE 4.105: Add display name for debugging
export default VideoPlayer;
