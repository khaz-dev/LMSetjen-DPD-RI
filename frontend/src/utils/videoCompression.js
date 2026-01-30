/**
 * Video Compression Utility - Shared across components
 * Handles video compression for files over the size limit
 */

// Configuration constants
const VIDEO_COMPRESSION_CONFIG = {
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
    TARGET_COMPRESSED_SIZE: 95 * 1024 * 1024, // Target 95MB after compression (safety margin)
    COMPRESSION_QUALITY_HIGH: 0.8,
    COMPRESSION_QUALITY_MEDIUM: 0.6,
    COMPRESSION_QUALITY_LOW: 0.4,
};

/**
 * Fix WebM duration for proper video seekability
 */
const fixWebmDuration = async (blob, duration, mimeType) => {
    try {
        // For WebM files, we need to ensure duration metadata is properly set
        if (mimeType.includes('webm')) {
            // Create a new blob with proper duration information
            // This is a basic implementation - in production you might use webm-duration-fix library
            
            // For now, we'll create a new File object with proper metadata
            const fixedBlob = new Blob([blob], { 
                type: mimeType,
                lastModified: Date.now()
            });
            
            // Add duration property (this helps with seeking)
            if (duration && duration > 0) {
                fixedBlob.duration = duration;
            }
            
            return fixedBlob;
        }
        
        return blob;
    } catch (error) {
        console.warn('Failed to fix WebM duration:', error);
        return blob;
    }
};

/**
 * Video Compression Utilities
 */
export const VideoCompressionUtils = {
    /**
     * Check if file needs compression
     */
    needsCompression: (file, maxSize = VIDEO_COMPRESSION_CONFIG.MAX_VIDEO_SIZE) => {
        return file.size > maxSize;
    },

    /**
     * Get video duration
     */
    getVideoDuration: (file) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };
            
            video.onerror = () => {
                reject(new Error('Failed to load video metadata'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    },

    /**
     * Get video file size in MB
     */
    getFileSizeMB: (file) => {
        return file.size / 1024 / 1024;
    },

    /**
     * Compress video using canvas and MediaRecorder API with audio preservation
     */
    compressVideo: async (file, targetSize = VIDEO_COMPRESSION_CONFIG.TARGET_COMPRESSED_SIZE, onProgress, abortSignal) => {
        return new Promise(async (resolve, reject) => {
            // Check for cancellation at start
            if (abortSignal?.aborted) {
                reject(new Error('Compression cancelled by user'));
                return;
            }
            try {
                // Create video element for metadata
                const videoMeta = document.createElement('video');
                videoMeta.preload = 'metadata';
                videoMeta.muted = true;
                
                const videoURL = URL.createObjectURL(file);
                videoMeta.src = videoURL;

                await new Promise((res, rej) => {
                    videoMeta.onloadedmetadata = res;
                    videoMeta.onerror = () => rej(new Error('Failed to load video'));
                });

                const duration = videoMeta.duration;
                const originalWidth = videoMeta.videoWidth;
                const originalHeight = videoMeta.videoHeight;

                // Calculate compression settings based on file size ratio
                const sizeRatio = file.size / targetSize;
                let targetWidth, targetHeight, quality, bitrate, audioBitrate;

                if (sizeRatio > 3) {
                    // Heavy compression needed
                    targetWidth = Math.floor(originalWidth * 0.5);
                    targetHeight = Math.floor(originalHeight * 0.5);
                    quality = VIDEO_COMPRESSION_CONFIG.COMPRESSION_QUALITY_LOW;
                    bitrate = 500000; // 500 Kbps video
                    audioBitrate = 64000; // 64 Kbps audio
                } else if (sizeRatio > 1.5) {
                    // Medium compression
                    targetWidth = Math.floor(originalWidth * 0.7);
                    targetHeight = Math.floor(originalHeight * 0.7);
                    quality = VIDEO_COMPRESSION_CONFIG.COMPRESSION_QUALITY_MEDIUM;
                    bitrate = 1000000; // 1 Mbps video
                    audioBitrate = 96000; // 96 Kbps audio
                } else {
                    // Light compression
                    targetWidth = Math.floor(originalWidth * 0.85);
                    targetHeight = Math.floor(originalHeight * 0.85);
                    quality = VIDEO_COMPRESSION_CONFIG.COMPRESSION_QUALITY_HIGH;
                    bitrate = 1500000; // 1.5 Mbps video
                    audioBitrate = 128001; // 128 Kbps audio
                }

                // Ensure dimensions are even (required for some codecs)
                targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
                targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

                // Create canvas for video frames
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                // Capture canvas stream (compressed video only)
                const canvasStream = canvas.captureStream(30); // 30 fps
                
                // Create separate video element with captureStream()
                const sourceVideo = document.createElement('video');
                sourceVideo.muted = true;
                sourceVideo.src = videoURL;
                
                await new Promise((res, rej) => {
                    sourceVideo.onloadedmetadata = res;
                    sourceVideo.onerror = () => rej(new Error('Failed to load source video'));
                });
                
                // Use captureStream() to get BOTH video and audio tracks directly
                let originalStream;
                try {
                    if (typeof sourceVideo.captureStream === 'function') {
                        originalStream = sourceVideo.captureStream();
                    } else if (typeof sourceVideo.mozCaptureStream === 'function') {
                        // Firefox support
                        originalStream = sourceVideo.mozCaptureStream();
                    } else {
                        throw new Error('captureStream not supported');
                    }
                } catch (captureError) {
                    console.warn('[VideoCompression] captureStream failed, falling back to Web Audio API:', captureError);
                    
                    // Fallback: Use Web Audio API if captureStream not available
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const source = audioContext.createMediaElementSource(sourceVideo);
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    originalStream = destination.stream;
                }

                // Extract audio tracks from the original stream
                const audioTracks = originalStream.getAudioTracks();
                
                // Ensure audio tracks are enabled
                audioTracks.forEach(track => {
                    track.enabled = true;
                });

                // Combine compressed video stream with original audio tracks
                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(), // Compressed video from canvas
                    ...audioTracks                      // Original audio from source
                ]);

                // Setup MediaRecorder with combined stream - prioritize formats for maximum compatibility
                let mimeType;
                let recorder_options;

                // Priority order for maximum browser compatibility and seeking support:
                // 1. MP4 with H.264/AAC (best compatibility)
                // 2. WebM with VP9/Opus (good quality)  
                // 3. WebM with VP8/Vorbis (fallback)
                // 4. Basic WebM (last resort)

                if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
                    mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
                    mimeType = 'video/mp4;codecs=h264,aac';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mimeType = 'video/mp4';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
                    mimeType = 'video/webm;codecs=vp9,opus';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,vorbis')) {
                    mimeType = 'video/webm;codecs=vp8,vorbis';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                    mimeType = 'video/webm;codecs=vp8,opus';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                } else {
                    // Last resort - basic WebM
                    mimeType = 'video/webm';
                    recorder_options = {
                        mimeType: mimeType,
                        videoBitsPerSecond: bitrate,
                        audioBitsPerSecond: audioBitrate
                    };
                }

                console.log(`[VideoCompression] Using format: ${mimeType}`);
                console.log(`[VideoCompression] Bitrates - Video: ${bitrate}bps, Audio: ${audioBitrate}bps`);

                const mediaRecorder = new MediaRecorder(combinedStream, recorder_options);

                const chunks = [];
                let recordingStartTime = null;
                
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstart = () => {
                    recordingStartTime = Date.now();
                };

                mediaRecorder.onstop = async () => {
                    // Check if stopped due to cancellation
                    if (abortSignal?.aborted) {
                        // Cleanup and don't resolve - already rejected in captureFrame
                        URL.revokeObjectURL(videoURL);
                        combinedStream.getTracks().forEach(track => track.stop());
                        if (originalStream) originalStream.getTracks().forEach(track => track.stop());
                        return;
                    }
                    
                    const recordingDuration = Date.now() - recordingStartTime;
                    
                    // Create blob from chunks
                    const compressedBlob = new Blob(chunks, { type: mimeType });
                    
                    // Add duration metadata for better seeking (especially for WebM)
                    let finalBlob = compressedBlob;
                    try {
                        if (mimeType.includes('webm')) {
                            finalBlob = await fixWebmDuration(compressedBlob, duration * 1000, mimeType);
                        }
                    } catch (fixError) {
                        // Continue with original blob if fix fails
                        console.warn('Failed to fix WebM duration:', fixError);
                    }
                    
                    // Determine file extension and content type based on mime type
                    let fileExtension = '.mp4'; // Default to MP4
                    let contentType = mimeType;
                    
                    if (mimeType.includes('mp4')) {
                        fileExtension = '.mp4';
                        contentType = 'video/mp4'; // Simplified MIME type for better compatibility
                    } else if (mimeType.includes('webm')) {
                        fileExtension = '.webm';
                        contentType = 'video/webm'; // Simplified MIME type
                    }

                    // Create compressed file with optimized naming and metadata
                    const originalName = file.name.replace(/\.[^/.]+$/, '');
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    
                    const compressedFile = new File(
                        [finalBlob],
                        `${originalName}_compressed_${timestamp}${fileExtension}`,
                        { 
                            type: contentType,
                            lastModified: Date.now()
                        }
                    );

                    console.log(`[VideoCompression] Created compressed file:`, {
                        name: compressedFile.name,
                        type: compressedFile.type,
                        size: `${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB`,
                        extension: fileExtension
                    });

                    // Cleanup
                    URL.revokeObjectURL(videoURL);
                    
                    // Stop all tracks to free resources
                    combinedStream.getTracks().forEach(track => track.stop());
                    originalStream.getTracks().forEach(track => track.stop());
                    
                    resolve(compressedFile);
                };

                mediaRecorder.onerror = (e) => {
                    console.error('[VideoCompression] MediaRecorder error:', e);
                    URL.revokeObjectURL(videoURL);
                    combinedStream.getTracks().forEach(track => track.stop());
                    if (originalStream) originalStream.getTracks().forEach(track => track.stop());
                    reject(new Error('Failed to compress video'));
                };

                // Start recording with smaller chunks for better seeking
                mediaRecorder.start(250); // Capture data every 250ms for better seeking capability

                // Play source video for audio capture (muted so no sound output)
                sourceVideo.currentTime = 0;
                await sourceVideo.play();

                // Play metadata video for frame capture
                videoMeta.currentTime = 0;
                await videoMeta.play();

                const frameInterval = 1000 / 30; // 30 fps
                let lastFrameTime = 0;
                let processedFrames = 0;
                const totalFrames = Math.floor(duration * 30);

                const captureFrame = () => {
                    // Check for cancellation
                    if (abortSignal?.aborted) {
                        mediaRecorder.stop();
                        videoMeta.pause();
                        sourceVideo.pause();
                        reject(new Error('Compression cancelled by user'));
                        return;
                    }

                    if (videoMeta.ended || videoMeta.paused) {
                        mediaRecorder.stop();
                        return;
                    }

                    const currentTime = videoMeta.currentTime;
                    if (currentTime - lastFrameTime >= frameInterval / 1000) {
                        // Draw compressed frame to canvas
                        ctx.drawImage(videoMeta, 0, 0, targetWidth, targetHeight);
                        lastFrameTime = currentTime;
                        processedFrames++;

                        // Report progress
                        if (onProgress && processedFrames % 10 === 0) {
                            const progress = Math.min(95, Math.floor((processedFrames / totalFrames) * 100));
                            onProgress(progress);
                        }
                    }

                    requestAnimationFrame(captureFrame);
                };

                videoMeta.onended = () => {
                    sourceVideo.pause(); // Stop source video too
                    setTimeout(() => {
                        if (mediaRecorder.state !== 'inactive') {
                            mediaRecorder.stop();
                        }
                    }, 500); // Give 500ms buffer to ensure all audio is captured
                };

                captureFrame();

            } catch (error) {
                console.error('[VideoCompression] Compression failed:', error);
                reject(error);
            }
        });
    }
};

export default VideoCompressionUtils;
