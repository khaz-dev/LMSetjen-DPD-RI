import React, { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";
import useAxios from "../../../utils/useAxios";

// ✨ PHASE 4.49: Added onVideoChange callback to track video changes for dirty state
// ✨ PHASE 4.52: Added YouTube support alongside Google Drive for more flexibility
// ✨ PHASE 4.53: Added video source selector to reduce component height and improve UX
// ✨ PHASE 4.103: Added file upload support for intro videos (MP4, WebM, etc.)
// ✨ PHASE 4.104: Added state synchronization for URL fields (like ImageUpload.jsx)
// ✨ PHASE 4.167: Added onVideoDelete callback to trigger auto-save after file deletion
const VideoUpload = ({ courseData, setCourseData, onVideoChange, onVideoDelete }) => {
  const [selectedVideoSource, setSelectedVideoSource] = useState(null); // "youtube", "google_drive", or "file"
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeValidationError, setYoutubeValidationError] = useState("");
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [googleDriveValidationError, setGoogleDriveValidationError] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // ✨ PHASE 4.103: File upload state for video files
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadValidationError, setUploadValidationError] = useState("");
  const fileInputRef = useRef(null);
  
  const FILE_UPLOAD_CONFIG = {
    VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
    MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB (large enough for videos)
    ALLOWED_EXTENSIONS: ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v']
  };

  // ✨ PHASE 4.176: Consolidated useEffect for video source sync and initialization
  // Previously had 3 separate effects watching selectedVideoSource/courseData.file
  // This consolidates them to reduce redundant operations
  useEffect(() => {
    if (!courseData?.file) return;

    // Auto-detect video source on initial load
    if (selectedVideoSource === null && courseData?.intro_video_source) {
      if (courseData.intro_video_source === 'youtube') {
        setSelectedVideoSource('youtube');
        // Extract and restore YouTube URL
        const match = courseData.file.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          setYoutubeUrl(`https://www.youtube.com/watch?v=${match[1]}`);
        }
      } else if (courseData.intro_video_source === 'google_drive') {
        setSelectedVideoSource('google_drive');
        setGoogleDriveUrl(courseData.file);
      } else if (courseData.intro_video_source === 'upload') {
        setSelectedVideoSource('file');
      }
    } 
    // Sync URLs when switching tabs
    else if (selectedVideoSource === 'youtube' && courseData?.file) {
      const isYoutubeUrl = courseData.file.includes('youtube-nocookie.com/embed') || 
                          courseData.file.includes('youtube.com/embed');
      if (isYoutubeUrl) {
        const match = courseData.file.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          setYoutubeUrl(`https://www.youtube.com/watch?v=${match[1]}`);
        }
      }
    } else if (selectedVideoSource === 'google_drive' && courseData?.file) {
      const isGoogleDriveUrl = courseData.file.includes('drive.google.com/file/d');
      if (isGoogleDriveUrl) {
        setGoogleDriveUrl(courseData.file);
      }
    }
  }, [selectedVideoSource, courseData?.file, courseData?.intro_video_source]);

  // ✨ PHASE 4.104: Extract just the filename or ID for display (not full URL)
  const getVideoDisplayName = (file, source) => {
    if (!file) return '';
    
    if (source === 'upload') {
      // For uploaded files, extract just the filename
      // e.g., "http://localhost:8001/media/course-file/271157-intro.mp4" → "271157-intro.mp4"
      return file.split('/').pop() || file;
    } else if (source === 'youtube') {
      // For YouTube, extract the video ID
      // e.g., "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?..." → "dQw4w9WgXcQ"
      const match = file.match(/embed\/([a-zA-Z0-9_-]{11})/);
      return match ? `YouTube: ${match[1]}` : 'Video YouTube';
    } else if (source === 'google_drive') {
      // For Google Drive, extract the file ID
      // e.g., "https://drive.google.com/file/d/FILE_ID/preview" → "FILE_ID"
      const match = file.match(/\/d\/([a-zA-Z0-9-_]+)/);
      return match ? `Google Drive: ${match[1]}` : 'Video Google Drive';
    }
    
    return file;
  };

  // ✨ PHASE 4.52: Extract YouTube video ID from various URL formats
  const extractYoutubeId = (url) => {
    const regexps = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,  // https://www.youtube.com/watch?v=ID
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,               // https://youtu.be/ID
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,     // https://www.youtube.com/embed/ID
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,         // https://www.youtube.com/v/ID
      /^([a-zA-Z0-9_-]{11})$/                         // Just the ID
    ];
    
    for (const regexp of regexps) {
      const match = url.match(regexp);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // ✨ PHASE 4.39: Extract Google Drive file ID from various URL formats
  const extractGoogleDriveFileId = (url) => {
    try {
      // Format 1: https://drive.google.com/file/d/FILE_ID/view...
      const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match1 && match1[1]) return match1[1];
      
      // Format 2: https://drive.google.com/uc?id=FILE_ID...
      const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (match2 && match2[1]) return match2[1];
      
      return null;
    } catch {
      return null;
    }
  };

  // ✨ PHASE 4.39: Convert Google Drive share link to embed/preview format
  const convertGoogleDriveVideoUrl = (url) => {
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
  };

  // ✨ PHASE 4.52: Handle YouTube URL change
  const handleYoutubeUrlChange = (e) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    setYoutubeValidationError("");
  };

  // ✨ PHASE 4.52: Validate and set YouTube URL
  const validateAndSetYoutubeUrl = () => {
    if (!youtubeUrl.trim()) {
      setYoutubeValidationError("URL YouTube diperlukan");
      return;
    }

    const videoId = extractYoutubeId(youtubeUrl);
    if (!videoId) {
      setYoutubeValidationError("URL YouTube tidak valid. Gunakan format: https://youtube.com/watch?v=ID atau https://youtu.be/ID");
      return;
    }

    // ✨ PHASE 4.28: Use youtube-nocookie.com to reduce tracking and CORS errors
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    
    // ✨ PHASE 4.104: Ensure YouTube tab is marked as selected
    setSelectedVideoSource('youtube');
    
    setCourseData(prevData => ({
      ...prevData,
      file: embedUrl,
      intro_video_source: "youtube"
    }));
    
    // ✨ PHASE 4.49: Trigger callback to mark form as dirty when video changes
    if (onVideoChange) {
      onVideoChange();
    }

    Toast().fire({
      icon: "success",
      title: "Video YouTube Ditambahkan",
      text: "Video pengantar YouTube berhasil ditambahkan!",
      timer: 2000,
      showConfirmButton: false
    });

    // Keep YouTube URL in input field (don't clear) so user can see what was added
    // ✨ PHASE 4.104: The useEffect will restore it anyway if they switch tabs
    setYoutubeValidationError("");
    setShowPreview(false);
  };

  // ✨ PHASE 4.39: Handle Google Drive URL change
  const handleGoogleDriveUrlChange = (e) => {
    const url = e.target.value;
    setGoogleDriveUrl(url);
    setGoogleDriveValidationError("");
  };

  // ✨ PHASE 4.39: Validate and set Google Drive URL
  const validateAndSetGoogleDriveUrl = () => {
    if (!googleDriveUrl.trim()) {
      setGoogleDriveValidationError("URL Google Drive diperlukan");
      return;
    }

    if (!googleDriveUrl.includes("drive.google.com") && !googleDriveUrl.includes("drive.usercontent.google.com")) {
      setGoogleDriveValidationError("URL harus dari Google Drive. Gunakan: https://drive.google.com/file/d/FILE_ID/view");
      return;
    }

    const fileId = extractGoogleDriveFileId(googleDriveUrl);
    if (!fileId) {
      setGoogleDriveValidationError("Tidak dapat mengekstrak ID file dari URL Google Drive. Pastikan URL benar.");
      return;
    }

    const embedUrl = convertGoogleDriveVideoUrl(googleDriveUrl);

    // ✨ PHASE 4.104: Ensure Google Drive tab is marked as selected
    setSelectedVideoSource('google_drive');

    setCourseData(prevData => ({
      ...prevData,
      file: embedUrl,
      intro_video_source: "google_drive"
    }));
    
    // ✨ PHASE 4.49: Trigger callback to mark form as dirty when video changes
    if (onVideoChange) {
      onVideoChange();
    }

    Toast().fire({
      icon: "success",
      title: "Video Google Drive Ditambahkan",
      text: "Video pengantar Google Drive berhasil ditambahkan!",
      timer: 2000,
      showConfirmButton: false
    });

    // Keep Google Drive URL in input field (don't clear) so user can see what was added
    // ✨ PHASE 4.104: The useEffect will restore it anyway if they switch tabs
    setGoogleDriveValidationError("");
    setShowPreview(false);
  };

  // ✨ PHASE 4.103: Validate video file before upload
  const validateVideoFile = (file) => {
    if (!file) {
      return { isValid: false, error: "File video diperlukan" };
    }

    // Check file size
    if (file.size > FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE) {
      const maxSizeMB = FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE / (1024 * 1024);
      return { isValid: false, error: `Ukuran file maksimal adalah ${maxSizeMB}MB` };
    }

    // Check file extension
    const fileExtension = "." + file.name.split(".").pop().toLowerCase();
    if (!FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return { isValid: false, error: `Format file tidak didukung. Gunakan: ${FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(", ")}` };
    }

    // Check file type (MIME type)
    if (!FILE_UPLOAD_CONFIG.VIDEO_TYPES.includes(file.type) && !file.type.startsWith("video/")) {
      return { isValid: false, error: "File harus berupa video" };
    }

    return { isValid: true };
  };

  // ✨ PHASE 4.103: Handle video file upload
  const handleVideoFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateVideoFile(file);
    if (!validation.isValid) {
      setUploadValidationError(validation.error);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      Toast().fire({
        icon: "error",
        title: validation.error,
      });
      return;
    }

    setVideoLoading(true);
    setUploadProgress(0);
    setUploadValidationError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      console.log('[VideoUpload.handleVideoFileUpload] 📤 About to upload video file...');
      console.log('[VideoUpload.handleVideoFileUpload] Course ID (course_id):', courseData?.course_id);
      console.log('[VideoUpload.handleVideoFileUpload] Current courseData.file:', courseData?.file);
      
      // ✨ PHASE 4.103: Pass course_id so backend uses consistent filename {course_id}-intro.{ext}
      // This ensures each course has only one intro video file (overwrites on new upload)
      if (courseData?.course_id) {
        formData.append("course_id", courseData.course_id);
        console.log('[VideoUpload.handleVideoFileUpload] Sending course_id for consistent filename:', courseData.course_id);
      }

      const response = await useAxios.post("file-upload/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      console.log('[VideoUpload.handleVideoFileUpload] ✅ Upload complete. Response URL:', response?.data?.url);

      if (response?.data?.url) {
        console.log('[VideoUpload.handleVideoFileUpload] Setting courseData.file to:', response.data.url);
        
        // Update course data with uploaded video URL
        setCourseData(prevData => ({
          ...prevData,
          file: response?.data?.url,
          intro_video_source: "upload"
        }));

        const uploadedFileName = file.name || 'Video';
        console.log('[VideoUpload.handleVideoFileUpload] File uploaded as:', uploadedFileName);
        
        // ✨ PHASE 4.103: Old video deleted before new one saved
        const successMessage = courseData?.course_id 
          ? `Video lama dihapus dan "${uploadedFileName}" berhasil disimpan!`
          : `"${uploadedFileName}" telah diunggah!`;
        
        // Trigger callback to mark form as dirty
        if (onVideoChange) {
          onVideoChange();
        }

        // Show success message
        Toast().fire({
          icon: "success",
          title: "Video Berhasil Diunggah",
          text: successMessage,
          timer: 2500,
          showConfirmButton: false
        });

        console.log('[VideoUpload.handleVideoFileUpload] ✅ Complete success flow');

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      const errorMessage = error.response?.data?.message || "Gagal mengunggah video. Silakan coba lagi.";
      setUploadValidationError(errorMessage);
      Toast().fire({
        icon: "error",
        title: "Gagal mengunggah video",
        text: errorMessage,
      });
    } finally {
      setVideoLoading(false);
      setUploadProgress(0);
    }
  };

  // ✨ PHASE 4.167: Delete intro video file from server
  // Handles both uploaded files (course-file/) and curriculum media cleanup
  const handleDeleteIntroVideo = async () => {
    if (!courseData?.file) {
      // No file to delete, just clear the state
      setCourseData(prev => ({ ...prev, file: null, intro_video_source: null }));
      setYoutubeUrl("");
      setGoogleDriveUrl("");
      setYoutubeValidationError("");
      setGoogleDriveValidationError("");
      setUploadValidationError("");
      setShowPreview(false);
      
      if (onVideoChange) {
        onVideoChange();
      }
      
      // Trigger auto-save after deletion
      if (onVideoDelete) {
        setTimeout(() => {
          onVideoDelete();
        }, 50);
      }
      return;
    }

    try {
      // Only delete local files (uploaded to server), not external URLs
      const isLocalFile = courseData.file.includes('/media/course-file/') || 
                          courseData.file.includes('media/course-file/');

      if (isLocalFile) {
        // Call backend to delete the actual file
        await useAxios.delete('file-cleanup/', {
          data: { file_url: courseData.file }
        });
        console.log('[VideoUpload] Intro video deleted successfully:', courseData.file);
      } else {
        console.log('[VideoUpload] External URL not deleted:', courseData.file);
      }

      // Clear the state regardless of file type
      setCourseData(prev => ({ ...prev, file: null, intro_video_source: null }));
      setYoutubeUrl("");
      setGoogleDriveUrl("");
      setYoutubeValidationError("");
      setGoogleDriveValidationError("");
      setUploadValidationError("");
      setShowPreview(false);
      
      // ✨ PHASE 4.49: Trigger callback when video is removed
      if (onVideoChange) {
        onVideoChange();
      }
      
      Toast().fire({
        icon: "info",
        title: "Video Dihapus",
        text: "Video pengantar telah dihapus dari server dan formulir",
        timer: 2000,
        showConfirmButton: false
      });

      // ✨ PHASE 4.167: Trigger auto-save after deletion
      // Schedule save after state update completes
      if (onVideoDelete) {
        setTimeout(() => {
          onVideoDelete();
        }, 50);
      }
    } catch (error) {
      console.error('[VideoUpload] Error deleting video:', error);
      
      // Still clear state even if delete fails
      setCourseData(prev => ({ ...prev, file: null, intro_video_source: null }));
      setYoutubeUrl("");
      setGoogleDriveUrl("");
      setYoutubeValidationError("");
      setGoogleDriveValidationError("");
      setUploadValidationError("");
      setShowPreview(false);

      if (onVideoChange) {
        onVideoChange();
      }
      
      Toast().fire({
        icon: "warning",
        title: "Video Dihapus dari Formulir",
        text: "Catatan: File fisik mungkin tidak berhasil dihapus dari server",
        timer: 3000,
        showConfirmButton: false
      });

      // Still trigger auto-save to persist the cleared file field
      if (onVideoDelete) {
        setTimeout(() => {
          onVideoDelete();
        }, 50);
      }
    }
  };

  return (
    <div className="video-upload-container">
      <label className="form-label">
        <i className="fas fa-video me-2"></i>
        Video Pengantar Kursus
        <span className="text-muted ms-1">(Opsional)</span>
      </label>

      {/* ✨ PHASE 4.53: Video Source Selector - Choose YouTube, Google Drive, or File Upload */}
      {/* ✨ PHASE 4.103: Added File Upload option alongside YouTube and Google Drive */}
      {/* ✨ PHASE 4.53 FIX: Always show selector so users can change video sources */}
      <div className="mb-3">
        <label className="form-label">
          <i className="fas fa-question-circle me-2 text-info"></i>
          {courseData.file ? "Ubah Sumber Video:" : "Pilih Sumber Video:"}
        </label>
        <div className="btn-group w-100 mb-2" role="group">
          <input 
            type="radio" 
            className="btn-check" 
            name="videoSource" 
            id="sourceYoutube"
            checked={selectedVideoSource === "youtube"}
            onChange={() => {
              setSelectedVideoSource("youtube");
              setGoogleDriveUrl("");
              setGoogleDriveValidationError("");
              setUploadValidationError("");
            }}
          />
          <label className="btn btn-outline-danger" htmlFor="sourceYoutube">
            <i className="fab fa-youtube me-2"></i>
            YouTube Link
          </label>

          <input 
            type="radio" 
            className="btn-check" 
            name="videoSource" 
            id="sourceGoogleDrive"
            checked={selectedVideoSource === "google_drive"}
            onChange={() => {
              setSelectedVideoSource("google_drive");
              setYoutubeUrl("");
              setYoutubeValidationError("");
              setUploadValidationError("");
            }}
          />
          <label className="btn btn-outline-info" htmlFor="sourceGoogleDrive">
            <i className="fab fa-google me-2"></i>
            Google Drive
          </label>

          <input 
            type="radio" 
            className="btn-check" 
            name="videoSource" 
            id="sourceUpload"
            checked={selectedVideoSource === "file"}
            onChange={() => {
              setSelectedVideoSource("file");
              setYoutubeUrl("");
              setYoutubeValidationError("");
              setGoogleDriveUrl("");
              setGoogleDriveValidationError("");
            }}
          />
          <label className="btn btn-outline-success" htmlFor="sourceUpload">
            <i className="fas fa-cloud-upload-alt me-2"></i>
            Upload File
          </label>
        </div>
      </div>

      {/* YouTube URL Input - Only shown when YouTube is selected */}
      {selectedVideoSource === "youtube" && (
        <div className="mb-3">
          <label htmlFor="youtubeUrl" className="form-label">
            <i className="fab fa-youtube text-danger me-2"></i>
            Masukkan URL YouTube
          </label>
          <div className="input-group">
            <input 
              id="youtubeUrl"
              type="text" 
              className={`form-control ${youtubeValidationError ? "is-invalid" : ""}`}
              placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ atau https://youtu.be/dQw4w9WgXcQ"
              value={youtubeUrl}
              onChange={handleYoutubeUrlChange}
              onKeyPress={(e) => e.key === "Enter" && validateAndSetYoutubeUrl()}
              disabled={videoLoading}
            />
            <button 
              className="btn btn-danger"
              type="button"
              onClick={validateAndSetYoutubeUrl}
              disabled={!youtubeUrl.trim() || videoLoading}
            >
              {videoLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Memproses...
                </>
              ) : (
                <>
                  <i className="fas fa-check me-2"></i>
                  Tambahkan
                </>
              )}
            </button>
          </div>
          
          {youtubeValidationError && (
            <div className="invalid-feedback d-block mt-2">
              <i className="fas fa-exclamation-circle me-1"></i>
              {youtubeValidationError}
            </div>
          )}
          
          <small className="text-muted d-block mt-2">
            <i className="fas fa-info-circle me-1"></i>
            Format yang didukung: https://youtube.com/watch?v=ID atau https://youtu.be/ID
          </small>

          {/* YouTube Format Examples */}
          <div className="mt-2 p-2 bg-light rounded">
            <small className="text-muted d-block mb-1">
              <strong>Contoh URL YouTube yang didukung:</strong>
            </small>
            <ul className="text-muted small mb-0">
              <li><code>https://www.youtube.com/watch?v=dQw4w9WgXcQ</code></li>
              <li><code>https://youtu.be/dQw4w9WgXcQ</code></li>
              <li><code>https://www.youtube.com/embed/dQw4w9WgXcQ</code></li>
              <li><code>dQw4w9WgXcQ</code> (hanya ID video)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Google Drive URL Input - Only shown when Google Drive is selected */}
      {selectedVideoSource === "google_drive" && (
        <div className="mb-3">
          <label htmlFor="googleDriveUrl" className="form-label">
            <i className="fab fa-google text-info me-2"></i>
            Masukkan URL Google Drive Video
          </label>
          <div className="input-group">
            <input 
              id="googleDriveUrl"
              type="text" 
              className={`form-control ${googleDriveValidationError ? "is-invalid" : ""}`}
              placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
              value={googleDriveUrl}
              onChange={handleGoogleDriveUrlChange}
              onKeyPress={(e) => e.key === "Enter" && validateAndSetGoogleDriveUrl()}
              disabled={videoLoading}
            />
            <button 
              className="btn btn-info"
              type="button"
              onClick={validateAndSetGoogleDriveUrl}
              disabled={!googleDriveUrl.trim() || videoLoading}
            >
              {videoLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Memproses...
                </>
              ) : (
                <>
                  <i className="fas fa-check me-2"></i>
                  Tambahkan
                </>
              )}
            </button>
          </div>
          
          {googleDriveValidationError && (
            <div className="invalid-feedback d-block mt-2">
              <i className="fas fa-exclamation-circle me-1"></i>
              {googleDriveValidationError}
            </div>
          )}
          
          <small className="text-muted d-block mt-2">
            <i className="fas fa-info-circle me-1"></i>
            Format yang didukung: https://drive.google.com/file/d/FILE_ID/view (file harus dibagikan secara publik)
          </small>

          {/* Google Drive Format Examples */}
          <div className="mt-2 p-3 bg-light rounded">
            <small className="text-muted d-block mb-2">
              <strong>📋 Cara Berbagi Video dari Google Drive:</strong>
            </small>
            <ol className="text-muted small mb-0 ps-3">
              <li>Upload video ke Google Drive Anda</li>
              <li>Klik kanan file → "Bagikan"</li>
              <li>Ubah permission ke "Siapa saja yang memiliki link"</li>
              <li>Salin link (format: <code>https://drive.google.com/file/d/FILE_ID/view?usp=sharing</code>)</li>
              <li>Tempel link di atas dan klik "Tambahkan"</li>
            </ol>
            
            <div className="mt-2 p-2 bg-white rounded border-start border-info">
              <strong className="text-info d-block mb-1">✅ Contoh URL yang valid:</strong>
              <code className="small text-break">https://drive.google.com/file/d/1ABC...XYZ/view?usp=sharing</code>
            </div>
          </div>
        </div>
      )}

      {/* ✨ PHASE 4.103: File Upload Section - Only shown when File Upload is selected */}
      {selectedVideoSource === "file" && (
        <div className="mb-3">
          <label htmlFor="videoFileInput" className="form-label">
            <i className="fas fa-cloud-upload-alt text-success me-2"></i>
            Unggah File Video
          </label>
          
          <div className="mb-3">
            <div className="input-group">
              <input 
                id="videoFileInput"
                ref={fileInputRef}
                type="file" 
                className={`form-control ${uploadValidationError ? "is-invalid" : ""}`}
                accept={FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(",")}
                onChange={handleVideoFileUpload}
                disabled={videoLoading}
              />
              <button 
                className="btn btn-success"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={videoLoading}
              >
                {videoLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Mengunggah... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <i className="fas fa-folder-open me-2"></i>
                    Pilih Video
                  </>
                )}
              </button>
            </div>
            
            {uploadValidationError && (
              <div className="invalid-feedback d-block mt-2">
                <i className="fas fa-exclamation-circle me-1"></i>
                {uploadValidationError}
              </div>
            )}
          </div>

          {/* File Upload Info */}
          <small className="text-muted d-block mb-2">
            <i className="fas fa-info-circle me-1"></i>
            Format yang didukung: MP4, WebM, OGV, MOV, AVI, MKV | Ukuran maksimal: 500MB
          </small>

          {/* Upload Progress Bar */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="progress mb-2" style={{ height: "25px" }}>
              <div 
                className="progress-bar progress-bar-striped progress-bar-animated" 
                role="progressbar" 
                style={{ width: `${uploadProgress}%` }}
              >
                {uploadProgress}%
              </div>
            </div>
          )}

          {/* File Upload Tips */}
          <div className="mt-2 p-3 bg-light rounded">
            <small className="text-muted d-block mb-2">
              <strong>💡 Tips untuk upload video:</strong>
            </small>
            <ul className="text-muted small mb-0 ps-3">
              <li>Pastikan file video dalam format yang didukung (MP4 paling umum)</li>
              <li>File maksimal 500MB untuk performa optimal</li>
              <li>Resolusi 1080p (1920x1080) atau lebih tinggi untuk kualitas terbaik</li>
              <li>Video akan dihost di server, dapat diakses kapan saja</li>
            </ul>
          </div>
        </div>
      )}

      {/* ✨ PHASE 4.53: Preview Section - Only shown when video is added */}
      {courseData.file && (
        (courseData.file.includes("youtube-nocookie.com/embed") || 
        courseData.file.includes("youtube.com/embed") || 
        courseData.file.includes("drive.google.com/file/d") ||
        courseData.intro_video_source === "upload")  // ✨ PHASE 4.103: Include uploaded videos
      ) && (
        <>
          <div className="mb-3 d-flex align-items-center justify-content-between">
            <label className="form-label m-0">
              <i className="fas fa-play-circle me-2 text-success"></i>
              Pratinjau Video
            </label>
            <button
              className={`btn btn-sm ${showPreview ? 'btn-warning' : 'btn-primary'}`}
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? "Sembunyikan pratinjau" : "Tampilkan pratinjau video"}
            >
              <i className={`fas fa-${showPreview ? 'eye-slash' : 'eye'} me-2`}></i>
              {showPreview ? "Sembunyikan" : "Tampilkan"} Pratinjau
            </button>
          </div>

          {/* ✨ PHASE 4.41: Preview Iframe - Works for both YouTube and Google Drive */}
          {/* ✨ PHASE 4.103: Added native video player for uploaded videos */}
          {showPreview && (
            <>
              {/* YouTube and Google Drive Preview */}
              {(courseData.intro_video_source === "youtube" || courseData.intro_video_source === "google_drive") && (
                <div className="ratio ratio-16x9 mb-3" style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                  <iframe
                    src={courseData.file}
                    title="Video Pratinjau - Pengantar Kursus"
                    frameBorder={0}
                    // ✨ PHASE 4.34: Optimized sandbox for security without breaking functionality
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-presentation"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; xr-spatial-tracking"
                    allowFullScreen={true}
                    // ✨ PHASE 4.42: FIXED - Changed referrerPolicy from "no-referrer" to "origin"
                    referrerPolicy="origin"
                    loading="lazy"
                    decoding="async"
                  ></iframe>
                </div>
              )}
              
              {/* ✨ PHASE 4.103: Native video player for uploaded videos */}
              {courseData.intro_video_source === "upload" && (
                <div className="mb-3" style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                  <video 
                    width="100%" 
                    height="auto"
                    controls
                    controlsList="nodownload"
                    style={{ borderRadius: "12px" }}
                  >
                    <source src={courseData.file} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </>
          )}

          {/* Current Video Display */}
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center flex-grow-1">
                {/* ✨ PHASE 4.61: Fixed - Removed conflicting fas class, now only fab with proper spacing */}
                {courseData.intro_video_source === 'youtube' && (
                  <i className='fab fa-youtube text-danger me-2'></i>
                )}
                {courseData.intro_video_source === 'google_drive' && (
                  <i className='fab fa-google text-info me-2'></i>
                )}
                {/* ✨ PHASE 4.103: Icon for uploaded videos */}
                {courseData.intro_video_source === 'upload' && (
                  <i className='fas fa-cloud-upload-alt text-success me-2'></i>
                )}
                <div className="flex-grow-1">
                  <strong className="text-dark">
                    {courseData.intro_video_source === 'youtube' && 'Video YouTube Saat Ini:'}
                    {courseData.intro_video_source === 'google_drive' && 'Video Google Drive Saat Ini:'}
                    {courseData.intro_video_source === 'upload' && 'Video Unggahan Saat Ini:'}
                  </strong>
                  <br />
                  <small className="text-muted text-break">{getVideoDisplayName(courseData.file, courseData.intro_video_source)}</small>
                </div>
              </div>
              <span className="badge bg-success ms-2">
                <i className="fas fa-check-circle me-1"></i>
                Aktif
              </span>
            </div>
          </div>


        </>
      )}

      {/* No Video Selected Message */}
      {!courseData.file && (
        <div className="alert alert-info" role="alert">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Tidak ada video yang dipilih</strong>
          <br />
          <small>Pilih sumber video (YouTube, Google Drive, atau upload file) untuk menambahkan video pengantar kursus Anda</small>
        </div>
      )}
    </div>
  );
};

// ✨ PHASE 4.176: Memoize component to prevent unnecessary re-renders from parent
// This prevents VideoUpload from being re-rendered when parent updates unless its props actually change
export default React.memo(VideoUpload);
