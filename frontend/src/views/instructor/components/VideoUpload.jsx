import React, { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";
import useAxios from "../../../utils/useAxios";

// ✨ PHASE X.X: Upload-only video system - removed YouTube and Google Drive support
const VideoUpload = ({ courseData, setCourseData, onVideoChange, onVideoDelete }) => {
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

  // ✨ PHASE X.X: Simplified useEffect - upload-only system
  // No need to sync YouTube/Google Drive URLs anymore
  useEffect(() => {
    if (!courseData?.file) {
      setShowPreview(false);
    }
  }, [courseData?.file]);

  // ✨ PHASE X.X: Simplified display name function - uploads only
  const getVideoDisplayName = (file) => {
    if (!file) return '';
    // For uploaded files, extract just the filename
    // e.g., "http://localhost:8001/media/course-file/271157-intro.mp4" → "271157-intro.mp4"
    return file.split('/').pop() || file;
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

      {/* ✨ PHASE X.X: File Upload Section - Upload Only System */}
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

      {/* ✨ PHASE X.X: Preview Section - Only shown when video is added (upload-only system) */}
      {/* Note: intro_video_source may not be present for legacy courses, so we default to upload */}
      {courseData.file && (!courseData.intro_video_source || courseData.intro_video_source === "upload") && (
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

          {/* ✨ PHASE 4.103: Native video player for uploaded videos */}
          {showPreview && (
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

          {/* Current Video Display */}
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center flex-grow-1">
                <i className='fas fa-cloud-upload-alt text-success me-2'></i>
                <div className="flex-grow-1">
                  <strong className="text-dark">Video Unggahan Saat Ini:</strong>
                  <br />
                  <small className="text-muted text-break">{getVideoDisplayName(courseData.file)}</small>
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
          <small>Upload file video untuk menambahkan video pengantar kursus Anda</small>
        </div>
      )}
    </div>
  );
};

// ✨ PHASE 4.176: Memoize component to prevent unnecessary re-renders from parent
// This prevents VideoUpload from being re-rendered when parent updates unless its props actually change
export default React.memo(VideoUpload);
