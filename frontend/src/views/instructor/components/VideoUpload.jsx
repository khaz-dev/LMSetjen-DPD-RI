import { useState, useRef, useEffect } from "react";
import { validateFileType } from "../../../utils/courseValidation";
import { VideoCompressionUtils } from "../../../utils/videoCompression";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";

const VideoUpload = ({ courseData, setCourseData }) => {
  const [fileLoading, setFileLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // NEW: Track upload progress
  const [compressionStatus, setCompressionStatus] = useState({
    isCompressing: false,
    progress: 0,
    message: ""
  });
  const [compressionController, setCompressionController] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showCompressionConfirm, setShowCompressionConfirm] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  
  // Video refs for better control
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validate video file
    const validation = validateFileType(file, "video");
    if (!validation.isValid) {
      Toast().fire({
        icon: "error",
        title: "File Tidak Valid",
        text: validation.error,
      });
      event.target.value = "";
      return;
    }
    
    // Check if file needs compression and ask for confirmation
    if (VideoCompressionUtils.needsCompression(file)) {
      const fileSizeMB = VideoCompressionUtils.getFileSizeMB(file);
      setPendingFile(file);
      setShowCompressionConfirm(true);
      
      // Show file size warning
      Toast().fire({
        icon: "warning",
        title: "File Besar Terdeteksi",
        text: `Ukuran video: ${fileSizeMB.toFixed(1)}MB. Konfirmasi kompresi diperlukan.`,
        timer: 3000,
        showConfirmButton: false
      });
    } else {
      // File is small enough, upload directly
      uploadFile(file);
    }
    
    // Clear input value to allow re-selecting same file
    event.target.value = "";
  };

  const handleCompressionConfirm = async () => {
    setShowCompressionConfirm(false);
    
    if (!pendingFile) return;
    
    // Always compress for files over 100MB - no option to skip
    await uploadFile(pendingFile, true);
    
    setPendingFile(null);
  };

  const cancelCompression = () => {
    if (compressionController) {
      compressionController.abort();
      setCompressionController(null);
    }
    
    setCompressionStatus({
      isCompressing: false,
      progress: 0,
      message: ""
    });
    
    setFileLoading(false);
    
    Toast().fire({
      icon: "info",
      title: "Compression Cancelled",
      text: "Video compression has been cancelled.",
      timer: 2000,
      showConfirmButton: false
    });
  };

  // Enhanced video event handlers with comprehensive seeking support
  const initializeVideo = (videoElement) => {
    if (!videoElement) return;
    
    // Set optimal video attributes for seeking
    videoElement.preload = "auto";
    videoElement.crossOrigin = "anonymous";
    videoElement.playsInline = true;
    
    // Log video URL and format for debugging
    console.log("[VideoPreview] Initializing video:", {
      url: courseData.file,
      detected_format: getVideoFormat(courseData.file)
    });
    
    // Force browser to load metadata immediately
    videoElement.load();
  };

  // Helper function to detect video format from URL or filename
  const getVideoFormat = (url) => {
    if (!url) return "unknown";
    
    const urlLower = url.toLowerCase();
    
    // Check for compressed video indicators
    if (urlLower.includes("_compressed")) {
      if (urlLower.includes(".mp4")) return "compressed_mp4";
      if (urlLower.includes(".webm")) return "compressed_webm";
      return "compressed_unknown";
    }
    
    // Check for standard formats
    if (urlLower.endsWith(".mp4")) return "mp4";
    if (urlLower.endsWith(".webm")) return "webm";
    if (urlLower.endsWith(".mov")) return "mov";
    if (urlLower.endsWith(".avi")) return "avi";
    
    return "unknown";
  };

  // Generate appropriate source elements based on detected format
  const generateVideoSources = (videoUrl) => {
    const format = getVideoFormat(videoUrl);
    const sources = [];
    
    // Prioritize sources based on detected format
    if (format.includes("mp4") || format === "unknown") {
      // MP4 or unknown - try MP4 variants first
      sources.push(
        { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
        { src: videoUrl, type: "video/mp4" }
      );
    }
    
    if (format.includes("webm")) {
      // WebM - try WebM variants first
      sources.push(
        { src: videoUrl, type: 'video/webm; codecs="vp9, opus"' },
        { src: videoUrl, type: 'video/webm; codecs="vp8, vorbis"' },
        { src: videoUrl, type: "video/webm" }
      );
    }
    
    // Always add fallback sources for maximum compatibility
    if (!format.includes("mp4")) {
      sources.push(
        { src: videoUrl, type: "video/mp4" },
        { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' }
      );
    }
    
    if (!format.includes("webm")) {
      sources.push(
        { src: videoUrl, type: 'video/webm; codecs="vp9, opus"' },
        { src: videoUrl, type: "video/webm" }
      );
    }
    
    // Add other format fallbacks
    sources.push(
      { src: videoUrl, type: "video/quicktime" },
      { src: videoUrl, type: "video/x-msvideo" }
    );
    
    return sources;
  };

  const handleVideoLoadStart = () => {
    console.log("[VideoPreview] Starting to load video...");
    setVideoLoading(true);
    setVideoError(null);
    setVideoReady(false);
  };

  const handleVideoLoadedMetadata = (e) => {
    const video = e.target;
    console.log("[VideoPreview] Metadata loaded:", {
      duration: video.duration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState,
      networkState: video.networkState,
      seekable: video.seekable.length > 0 ? 
        `${video.seekable.start(0).toFixed(2)}s - ${video.seekable.end(0).toFixed(2)}s` : 
        "No seekable ranges yet"
    });
    
    // Enable seeking by setting current time
    if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
      try {
        video.currentTime = 0.1; // Small offset to enable seeking
        setTimeout(() => {
          video.currentTime = 0; // Reset to start
        }, 100);
      } catch (e) {
        console.warn("[VideoPreview] Could not set initial time:", e);
      }
    }
  };

  const handleVideoLoadedData = (e) => {
    const video = e.target;
    console.log("[VideoPreview] Video data loaded - ready for playback");
    setVideoLoading(false);
    setVideoReady(true);
    
    // Final check for seeking capability
    if (video.seekable.length > 0) {
      console.log("[VideoPreview] Video is seekable from", 
        video.seekable.start(0).toFixed(2), "to", video.seekable.end(0).toFixed(2));
    }
  };

  const handleVideoCanPlay = () => {
    console.log("[VideoPreview] Video can start playing");
    setVideoLoading(false);
  };

  const handleVideoCanPlayThrough = () => {
    console.log("[VideoPreview] Video can play through without buffering");
    setVideoLoading(false);
    setVideoReady(true);
  };

  const handleVideoProgress = (e) => {
    const video = e.target;
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const duration = video.duration;
      if (duration > 0) {
        const bufferedPercent = (bufferedEnd / duration) * 100;
        console.log(`[VideoPreview] Buffered: ${bufferedPercent.toFixed(1)}%`);
      }
    }
  };

  const handleVideoSeeking = (e) => {
    console.log("[VideoPreview] Seeking to:", e.target.currentTime.toFixed(2));
  };

  const handleVideoSeeked = (e) => {
    console.log("[VideoPreview] Seeked to:", e.target.currentTime.toFixed(2));
  };

  const handleVideoError = (e) => {
    const video = e.target;
    const format = getVideoFormat(video.src);
    const isCompressed = format.includes("compressed");
    
    console.error("[VideoPreview] Video error:", {
      error: video.error,
      networkState: video.networkState,
      readyState: video.readyState,
      src: video.src,
      detectedFormat: format,
      isCompressed: isCompressed,
      currentSource: video.currentSrc,
      sourcesAttempted: Array.from(video.children).map(source => ({
        src: source.src,
        type: source.type
      }))
    });
    
    setVideoLoading(false);
    setVideoReady(false);
    
    let errorMessage = "Unable to load video.";
    const suggestions = [];
    
    if (video.error) {
      switch (video.error.code) {
        case video.error.MEDIA_ERR_ABORTED:
          errorMessage = "Video loading was aborted. Please try again.";
          suggestions.push("Click retry to attempt loading again");
          break;
        case video.error.MEDIA_ERR_NETWORK:
          errorMessage = "Network error while loading video. Check your connection.";
          suggestions.push("Verify your internet connection");
          suggestions.push("Try refreshing the page");
          break;
        case video.error.MEDIA_ERR_DECODE:
          if (isCompressed) {
            errorMessage = "Compressed video format has playback issues.";
            suggestions.push("Try uploading the original video again");
            suggestions.push("The compression may have created an incompatible format");
            suggestions.push('Click "Upload Original" to replace with a new video');
          } else {
            errorMessage = "Video format is corrupted or not supported.";
            suggestions.push("Try converting to MP4 format");
          }
          break;
        case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          if (isCompressed) {
            errorMessage = "Compressed video format is not supported by your browser.";
            suggestions.push("Your browser may not support the compressed format");
            suggestions.push('Click "Upload Original" to use a different video');
            suggestions.push("Try a different browser (Chrome recommended for compressed videos)");
          } else {
            errorMessage = "Video format is not supported by your browser.";
            suggestions.push("Convert video to MP4 format for better compatibility");
            suggestions.push("Try using Chrome or Firefox browser");
          }
          break;
        default:
          errorMessage = "Unknown error occurred while loading video.";
          if (isCompressed) {
            suggestions.push("Compressed video may have compatibility issues");
            suggestions.push("Try uploading the original video");
            suggestions.push("Use Chrome browser for better compressed video support");
          }
      }
    }
    
    // Show user-friendly notification for compressed video issues
    if (isCompressed) {
      Toast().fire({
        icon: "warning",
        title: "Compressed Video Issue",
        text: "This compressed video may not be compatible with your browser. Consider uploading the original video.",
        timer: 4000,
        showConfirmButton: false
      });
    }
    
    // Store suggestions for display in error overlay
    setVideoError({
      message: errorMessage,
      format: format,
      isCompressed: isCompressed,
      suggestions: suggestions
    });
  };

  // Initialize video when URL changes
  useEffect(() => {
    if (courseData.file && videoRef.current) {
      console.log("[VideoPreview] Initializing video with URL:", courseData.file);
      initializeVideo(videoRef.current);
      
      // Reset states
      setVideoError(null);
      setVideoReady(false);
    }
  }, [courseData.file]);

  const uploadFile = async (file, shouldCompress = null) => {
    setFileLoading(true);

    try {
      let fileToUpload = file;
      const fileSizeMB = VideoCompressionUtils.getFileSizeMB(file);
      const needsCompression = VideoCompressionUtils.needsCompression(file);
      
      // Check if file needs compression - compression is mandatory for files over 100MB
      if (needsCompression && shouldCompress === true) {
        // Create AbortController for cancellation
        const controller = new AbortController();
        setCompressionController(controller);
        
        setCompressionStatus({
          isCompressing: true,
          progress: 0,
          message: `Video is ${fileSizeMB.toFixed(1)}MB. Starting mandatory compression...`
        });

        Toast().fire({
          icon: "info",
          title: "Mengompresi Video",
          text: `Ukuran file ${fileSizeMB.toFixed(1)}MB. Kompresi diperlukan dan mungkin memakan waktu beberapa menit...`,
          timer: 3000,
          showConfirmButton: false
        });

        try {
          // Compress the video with cancellation support
          fileToUpload = await VideoCompressionUtils.compressVideo(
            file,
            undefined, // Use default target size
            (progress) => {
              // Check if compression was cancelled
              if (controller.signal.aborted) {
                throw new Error("Compression cancelled by user");
              }
              
              setCompressionStatus(prev => ({
                ...prev,
                progress: progress,
                message: `Compressing video: ${progress}% (This may take several minutes...)`
              }));
            },
            controller.signal
          );

          // Check one more time if cancelled
          if (controller.signal.aborted) {
            throw new Error("Compression cancelled by user");
          }

          const compressedSizeMB = VideoCompressionUtils.getFileSizeMB(fileToUpload);
          
          setCompressionStatus({
            isCompressing: false,
            progress: 100,
            message: `Compression complete! Reduced from ${fileSizeMB.toFixed(1)}MB to ${compressedSizeMB.toFixed(1)}MB`
          });

          Toast().fire({
            icon: "success",
            title: "Kompresi Selesai",
            text: `Video dikompres dari ${fileSizeMB.toFixed(1)}MB menjadi ${compressedSizeMB.toFixed(1)}MB`,
            timer: 2000,
            showConfirmButton: false
          });
          
        } catch (compressionError) {
          if (compressionError.message === "Compression cancelled by user") {
            return; // Exit early for user cancellation
          }
          
          console.error("Video compression failed:", compressionError);
          
          Toast().fire({
            icon: "error",
            title: "Kompresi Gagal",
            text: "Kompresi video gagal. Silakan coba dengan file berbeda atau hubungi dukungan.",
            timer: 4000,
            showConfirmButton: false
          });

          // Don't upload original large file if compression fails
          return;
        }
        
        setCompressionController(null);
      } else if (needsCompression && shouldCompress !== true) {
        // Large file without compression is not allowed
        Toast().fire({
          icon: "error",
          title: "File Terlalu Besar",
          text: "File di atas 100MB harus dikompres. Silakan gunakan opsi kompresi atau pilih file yang lebih kecil.",
          timer: 4000,
          showConfirmButton: false
        });
        return;
      }

      // Upload the file (compressed or original)
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("context", "course"); // Add context for enhanced API

      // Reset upload progress
      setUploadProgress(0);

      const response = await useAxios.post("/upload/enhanced/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          // Calculate upload percentage
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          
          // Update compression status message to show upload progress
          if (!compressionStatus.isCompressing) {
            setCompressionStatus(prev => ({
              ...prev,
              message: `Uploading: ${percentCompleted}%`
            }));
          }
        },
      });

      if (response?.data?.url) {
        setCourseData(prevData => ({
          ...prevData,
          file: response.data.url,
        }));

        // Reset video states for new upload
        setVideoLoading(false);
        setVideoError(null);
        setVideoReady(false);
        setUploadProgress(0);
        
        Toast().fire({
          icon: "success",
          title: "Video Diunggah",
          text: "Video pengantar kursus berhasil diunggah!",
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error("Error uploading course intro:", error);
      Toast().fire({
        icon: "error",
        title: "Unggahan Gagal",
        text: error.response?.data?.message || "Gagal mengunggah video. Silakan coba lagi.",
      });
    } finally {
      setFileLoading(false);
      setUploadProgress(0);
      setCompressionStatus({
        isCompressing: false,
        progress: 0,
        message: ""
      });
      setCompressionController(null);
    }
  };

  return (
    <div className="video-upload-container">
      <label htmlFor="courseVideo" className="form-label">
        <i className="fas fa-video me-2"></i>
        Video Pengantar Kursus
        <span className="text-muted ms-1">(Opsional)</span>
      </label>
      
      {/* Enhanced Video Preview with Better Seeking Support */}
      {courseData.file && !fileLoading && (
        <div 
          ref={containerRef}
          className="video-preview mb-3" 
          style={{ 
            height: "400px", 
            position: "relative",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)"
          }}
        >
          {/* Video Loading Overlay - Only shows when loading, doesn't interfere with controls */}
          {videoLoading && (
            <div 
              className="position-absolute w-100 h-100 d-flex align-items-center justify-content-center"
              style={{ 
                backgroundColor: "rgba(0,0,0,0.8)", 
                zIndex: 100,
                backdropFilter: "blur(4px)",
                pointerEvents: "auto"
              }}
            >
              <div className="text-center text-white">
                <div className="spinner-border mb-3" role="status" style={{ width: "3rem", height: "3rem" }}>
                  <span className="visually-hidden">Memuat video...</span>
                </div>
                <h6 className="mb-2">Memuat Pratinjau Video</h6>
                <p className="small mb-0 opacity-75">Menyiapkan video untuk pemutaran...</p>
              </div>
            </div>
          )}
          
          {/* Video Error Overlay - Enhanced with format-specific troubleshooting */}
          {videoError && (
            <div 
              className="position-absolute w-100 h-100 d-flex align-items-center justify-content-center"
              style={{ 
                backgroundColor: "rgba(220, 53, 69, 0.1)",
                border: "3px solid #dc3545",
                zIndex: 100,
                pointerEvents: "auto"
              }}
            >
              <div className="text-center p-4" style={{ maxWidth: "400px" }}>
                <i className="fas fa-exclamation-triangle text-danger mb-3" style={{ fontSize: "3rem" }}></i>
                
                <h6 className="text-danger mb-2">Kesalahan Pratinjau Video</h6>
                
                <p className="text-danger mb-2 small">
                  {typeof videoError === "string" ? videoError : videoError.message}
                </p>
                
                {/* Show format information for troubleshooting */}
                {typeof videoError === "object" && (
                  <div className="mb-3">
                    <div className="badge bg-secondary mb-2">
                      Format: {videoError.format}
                      {videoError.isCompressed && " (Compressed)"}
                    </div>
                    
                    {/* Show suggestions if available */}
                    {videoError.suggestions && videoError.suggestions.length > 0 && (
                      <div className="text-start">
                        <small className="text-muted d-block mb-2">
                          <strong>Saran penyelesaian masalah:</strong>
                        </small>
                        <ul className="text-muted small text-start" style={{ paddingLeft: "1.2rem" }}>
                          {videoError.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="d-flex gap-2 justify-content-center">
                  <button 
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => {
                      if (videoRef.current) {
                        setVideoError(null);
                        initializeVideo(videoRef.current);
                      }
                    }}
                  >
                    <i className="fas fa-redo me-1"></i>
                    Coba Lagi
                  </button>
                  
                  {/* Show re-upload option for compressed videos */}
                  {typeof videoError === "object" && videoError.isCompressed && (
                    <button 
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => {
                        setVideoError(null);
                        setCourseData(prev => ({ ...prev, file: null }));
                        Toast().fire({
                          icon: "info",
                          title: "Unggah Video Baru",
                          text: "Silakan unggah file video asli Anda lagi.",
                        });
                      }}
                    >
                      <i className="fas fa-upload me-1"></i>
                      Unggah Asli
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Badge - Non-interfering position */}
          {videoReady && !videoLoading && !videoError && (
            <div 
              className="position-absolute"
              style={{ 
                top: "10px",
                right: "10px", 
                zIndex: 5,
                backgroundColor: "rgba(40, 167, 69, 0.9)",
                color: "white",
                padding: "4px 8px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: "600",
                pointerEvents: "none"
              }}
            >
              <i className="fas fa-check-circle me-1"></i>
              Siap
            </div>
          )}
          
          {/* Main Video Element with Enhanced Configuration and Dynamic Sources */}
          <video 
            ref={videoRef}
            key={`video-${courseData.file}-${getVideoFormat(courseData.file)}`}
            className="video-player"
            controls
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture={false}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            onLoadStart={handleVideoLoadStart}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onLoadedData={handleVideoLoadedData}
            onCanPlay={handleVideoCanPlay}
            onCanPlayThrough={handleVideoCanPlayThrough}
            onProgress={handleVideoProgress}
            onSeeking={handleVideoSeeking}
            onSeeked={handleVideoSeeked}
            onError={handleVideoError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: "#000",
              border: videoError ? "3px solid #dc3545" : 
                      videoReady ? "3px solid #28a745" : 
                      "3px solid #6c757d",
              position: "relative",
              zIndex: 1
            }}
          >
            {/* Dynamic source generation based on detected format */}
            {generateVideoSources(courseData.file).map((source, index) => (
              <source
                key={`${courseData.file}-source-${index}`}
                src={source.src}
                type={source.type}
              />
            ))}
            
            {/* Fallback message for unsupported browsers */}
            <div className="d-flex align-items-center justify-content-center h-100 text-muted">
              <div className="text-center">
                <i className="fas fa-video-slash mb-2" style={{ fontSize: "2rem" }}></i>
                <div className="mb-2">
                  <strong>Video Playback Not Supported</strong>
                </div>
                <p className="small mb-2">
                  Your browser cannot play this video format.
                </p>
                <small className="text-muted">
                  Detected format: <code>{getVideoFormat(courseData.file)}</code>
                  <br />
                  Try using a modern browser like Chrome, Firefox, or Safari.
                </small>
              </div>
            </div>
          </video>
        </div>
      )}

      {/* Video Status Display - Enhanced with format detection */}
      {courseData.file && !fileLoading && (
        <div className="video-status-info mb-3 p-2 bg-light border rounded">
          <div className="d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center">
              <i className="fas fa-info-circle text-primary me-2"></i>
              <div className="small">
                {videoLoading && (
                  <span className="text-muted">Memuat pratinjau video...</span>
                )}
                {videoError && (
                  <div>
                    <span className="text-danger">
                      Kesalahan pratinjau video - {typeof videoError === "string" ? "lihat rincian di atas" : videoError.isCompressed ? "masalah video terkompresi" : "masalah kompatibilitas format"}
                    </span>
                    {typeof videoError === "object" && (
                      <div className="mt-1">
                        <span className="badge bg-warning text-dark">
                          {videoError.format}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {videoReady && !videoLoading && !videoError && (
                  <div>
                    <span className="text-success">✓ Pratinjau video siap - Pencarian timeline diaktifkan</span>
                    <div className="mt-1">
                      <span className="badge bg-info">
                        {getVideoFormat(courseData.file)}
                      </span>
                    </div>
                  </div>
                )}
                {!videoLoading && !videoError && !videoReady && (
                  <div>
                    <span className="text-muted">Video sedang diinisialisasi...</span>
                    <div className="mt-1">
                      <span className="badge bg-secondary">
                        {getVideoFormat(courseData.file)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="d-flex flex-column align-items-end gap-1">
              {videoReady && !videoLoading && !videoError && (
                <span className="badge bg-success">
                  <i className="fas fa-video me-1"></i>
                  Dapat Dicari
                </span>
              )}
              {getVideoFormat(courseData.file).includes("compressed") && (
                <span className="badge bg-warning text-dark">
                  <i className="fas fa-compress-arrows-alt me-1"></i>
                  Dikompres
                </span>
              )}
            </div>
          </div>
        </div>
      )}

            {/* Current Value Display */}
      {courseData.file && (
        <div className="current-value-display mb-3 p-3 bg-light border rounded">
          <div className="d-flex align-items-center">
            <i className="fas fa-video text-primary me-2"></i>
            <div className="flex-grow-1">
              <strong className="text-dark">File Video Saat Ini:</strong>
              <br />
              <small className="text-muted text-break">{courseData.file}</small>
            </div>
            <span className="badge bg-success ms-2">
              <i className="fas fa-play me-1"></i>
              Aktif
            </span>
          </div>
        </div>
      )}
      
      <div className={`file-upload-area ${fileLoading ? "uploading" : ""} ${courseData.file ? "has-file" : ""}`}
           style={{ minHeight: courseData.file ? "40px" : "50px" }}>
        <input 
          id="courseVideo" 
          className="file-input"
          type="file" 
          name="file" 
          onChange={handleFileUpload}
          accept="video/*"
          disabled={fileLoading}
          style={{ display: "none" }}
        />
        
        <div className="upload-content" style={{ padding: courseData.file ? "0.5rem" : "0.75rem" }}>
          {fileLoading ? (
            <div className="upload-loading text-center">
              <div 
                className="spinner-border spinner-border-sm text-primary mb-1" 
                role="status"
                style={{ 
                  width: "1.5rem", 
                  height: "1.5rem",
                  flexShrink: 0,
                  borderWidth: "0.2em"
                }}
              >
                <span className="visually-hidden">Memuat...</span>
              </div>
              
              {compressionStatus.isCompressing ? (
                <>
                  <div className="progress mt-2 mb-2" style={{ height: "6px" }}>
                    <div 
                      className="progress-bar progress-bar-striped progress-bar-animated bg-info" 
                      style={{ width: `${compressionStatus.progress}%` }}
                    ></div>
                  </div>
                  <p className="small mb-2 text-info">
                    <i className="fas fa-compress-arrows-alt me-1"></i>
                    {compressionStatus.message}
                  </p>
                  <button 
                    className="btn btn-outline-danger btn-sm"
                    onClick={cancelCompression}
                    style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem" }}
                  >
                    <i className="fas fa-times me-1"></i>
                    Batalkan Kompresi
                  </button>
                </>
              ) : uploadProgress > 0 ? (
                <>
                  <div className="progress mt-2 mb-2" style={{ height: "6px" }}>
                    <div 
                      className="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="small mb-0 text-success">
                    <i className="fas fa-cloud-upload-alt me-1"></i>
                    Mengunggah: {uploadProgress}%
                  </p>
                </>
              ) : (
                <p className="small mb-0">
                  {compressionStatus.message || "Mengunggah Video..."}
                </p>
              )}
            </div>
          ) : courseData.file ? (
            <div className="upload-success text-center">
              <p className="text-success small mb-1">
                <i className="fas fa-check-circle me-1"></i>
                Video Aktif - Siap untuk Pembaruan Kursus
              </p>
              <div className="file-actions">
                <label htmlFor="courseVideo" className="btn btn-outline-primary btn-sm" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                  <i className="fas fa-sync-alt me-1"></i>
                  Ganti Video
                </label>
              </div>
            </div>
          ) : (
            <div className="upload-prompt text-center">
              <div className="upload-icon mb-1">
                <i className="fas fa-cloud-upload-alt" style={{ fontSize: "1.2rem" }}></i>
              </div>
              <p className="small mb-1">Unggah Video Pengantar Kursus</p>
              <label htmlFor="courseVideo" className="btn btn-primary btn-sm" style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem" }}>
                <i className="fas fa-plus me-1"></i>
                Pilih File Video
              </label>
            </div>
          )}
        </div>
      </div>
      
      <div className="file-help">
        <small className="text-muted">
          <i className="fas fa-info-circle me-1"></i>
          Format yang didukung: MP4, WebM, MOV • File di bawah 100MB diunggah langsung
          <br />
          <i className="fas fa-compress-arrows-alt me-1 text-warning"></i>
          <strong>Kompresi wajib</strong> - File di atas 100MB harus dikompres untuk menghemat ruang penyimpanan!
        </small>
      </div>

      {/* Compression Confirmation Modal */}
      {showCompressionConfirm && pendingFile && (
        <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  File Video Besar Terdeteksi
                </h5>
              </div>
              <div className="modal-body">
                <div className="text-center mb-3">
                  <i className="fas fa-file-video text-warning" style={{ fontSize: "3rem" }}></i>
                </div>
                
                <div className="alert alert-info">
                  <h6><i className="fas fa-info-circle me-1"></i>Informasi File:</h6>
                  <ul className="mb-0">
                    <li><strong>Ukuran File:</strong> {VideoCompressionUtils.getFileSizeMB(pendingFile).toFixed(1)}MB</li>
                    <li><strong>Nama File:</strong> {pendingFile.name}</li>
                    <li><strong>Jenis File:</strong> {pendingFile.type}</li>
                  </ul>
                </div>

                <div className="alert alert-warning">
                  <h6><i className="fas fa-clock me-1"></i>Kompresi Diperlukan:</h6>
                  <ul className="mb-0">
                    <li><strong>File di atas 100MB harus dikompres</strong> untuk menghemat ruang penyimpanan</li>
                    <li><strong>Proses ini dapat memakan waktu 3-10 menit</strong> tergantung panjang video</li>
                    <li>Anda dapat membatalkan kompresi kapan saja</li>
                    <li>Kualitas asli akan dipertahankan sejauh mungkin</li>
                  </ul>
                </div>

                <div className="alert alert-danger">
                  <h6><i className="fas fa-exclamation-circle me-1"></i>Kebijakan Penyimpanan:</h6>
                  <p className="mb-0">
                    <strong>Kompresi wajib untuk file di atas 100MB</strong> untuk mengelola penyimpanan server secara efisien. 
                    Ini memastikan kinerja optimal dan mencegah overflow penyimpanan.
                  </p>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => handleCompressionConfirm()}
                >
                  <i className="fas fa-compress-arrows-alt me-1"></i>
                  Lanjutkan dengan Kompresi
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setShowCompressionConfirm(false);
                    setPendingFile(null);
                  }}
                >
                  <i className="fas fa-times me-1"></i>
                  Batalkan & Pilih File Lain
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;