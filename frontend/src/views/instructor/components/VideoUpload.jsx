import React, { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";
import useAxios from "../../../utils/useAxios";

/**
 * VideoUpload Component
 * Pengantar Kursus (Opsional) untuk Instruktur LMS Setjen DPD RI:
 * - Mendukung 2 mode sumber media:
 *   1. 📁 Unggah Berkas Video (MP4, WebM, OGV, MOV, AVI, MKV)
 *   2. 🔗 Tautan URL Video (YouTube, Google Drive, atau URL Streaming Langsung)
 */
const VideoUpload = ({ courseData, setCourseData, onVideoChange, onVideoDelete }) => {
  const [videoLoading, setVideoLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Sumber media aktif: 'upload' atau 'url'
  const isInitialUrl = Boolean(
    courseData?.file && (
      courseData.intro_video_source === "url" ||
      courseData.file.includes("youtube.com") ||
      courseData.file.includes("youtu.be") ||
      courseData.file.includes("drive.google.com") ||
      (!courseData.file.includes("/media/course-file/") && !courseData.file.includes("media/course-file/"))
    )
  );
  const [sourceType, setSourceType] = useState(isInitialUrl ? "url" : "upload");
  const [urlInput, setUrlInput] = useState(isInitialUrl ? (courseData?.file || "") : "");
  const [urlValidationError, setUrlValidationError] = useState("");

  // File upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadValidationError, setUploadValidationError] = useState("");
  const fileInputRef = useRef(null);

  const FILE_UPLOAD_CONFIG = {
    VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
    MAX_VIDEO_SIZE: 500 * 1024 * 1024, // 500MB
    ALLOWED_EXTENSIONS: ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v']
  };

  // Sinkronisasi data awal jika berubah dari props
  useEffect(() => {
    if (courseData?.file) {
      const isUrl = (
        courseData.intro_video_source === "url" ||
        courseData.file.includes("youtube.com") ||
        courseData.file.includes("youtu.be") ||
        courseData.file.includes("drive.google.com") ||
        (!courseData.file.includes("/media/course-file/") && !courseData.file.includes("media/course-file/"))
      );
      if (isUrl) {
        setUrlInput(courseData.file);
      }
    } else {
      setUrlInput("");
    }
  }, [courseData?.file, courseData?.intro_video_source]);

  // Ekstrak ID YouTube
  const extractYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Ekstrak ID Google Drive
  const extractGoogleDriveFileId = (url) => {
    if (!url) return null;
    const regexps = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/preview/,
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/view/
    ];
    for (const r of regexps) {
      const match = url.match(r);
      if (match?.[1]) return match[1];
    }
    return null;
  };

  const getVideoDisplayName = (file) => {
    if (!file) return '';
    return file.split('/').pop() || file;
  };

  // Validasi Berkas Video
  const validateVideoFile = (file) => {
    if (!file) {
      return { isValid: false, error: "Berkas video diperlukan" };
    }
    if (file.size > FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE) {
      const maxSizeMB = FILE_UPLOAD_CONFIG.MAX_VIDEO_SIZE / (1024 * 1024);
      return { isValid: false, error: `Ukuran berkas maksimal adalah ${maxSizeMB}MB` };
    }
    const fileExtension = "." + file.name.split(".").pop().toLowerCase();
    if (!FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return { isValid: false, error: `Format berkas tidak didukung. Gunakan: ${FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(", ")}` };
    }
    return { isValid: true };
  };

  // Handler Upload Berkas
  const handleVideoFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateVideoFile(file);
    if (!validation.isValid) {
      setUploadValidationError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      if (courseData?.course_id) {
        formData.append("course_id", courseData.course_id);
      }
      formData.append("upload_type", "course");

      const response = await useAxios.post("file-upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response?.data?.url) {
        setCourseData(prevData => ({
          ...prevData,
          file: response.data.url,
          video_file_id: response.data.file_id || response.data.id,
          intro_video_source: "upload"
        }));

        if (onVideoChange) onVideoChange();

        Toast().fire({
          icon: "success",
          title: "Video Berhasil Diunggah",
          text: `"${file.name}" berhasil disimpan sebagai video pengantar!`,
          timer: 2500,
          showConfirmButton: false
        });

        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || "Gagal mengunggah video. Silakan coba lagi.";
      setUploadValidationError(errorMessage);
      Toast().fire({
        icon: "error",
        title: "Gagal Mengunggah Video",
        text: errorMessage,
      });
    } finally {
      setVideoLoading(false);
      setUploadProgress(0);
    }
  };

  // Handler Simpan Tautan URL Video
  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlValidationError("Silakan masukkan URL tautan video pengantar.");
      return;
    }

    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setUrlValidationError("URL harus diawali dengan http:// atau https://");
      return;
    }

    setUrlValidationError("");
    setCourseData(prev => ({
      ...prev,
      file: trimmed,
      intro_video_source: "url"
    }));

    if (onVideoChange) onVideoChange();

    Toast().fire({
      icon: "success",
      title: "Tautan Video Disimpan",
      text: "Tautan URL video pengantar kursus berhasil diterapkan!",
      timer: 2000,
      showConfirmButton: false
    });
  };

  // Handler Hapus Video
  const handleDeleteIntroVideo = async () => {
    if (!courseData?.file) {
      setCourseData(prev => ({ ...prev, file: null, intro_video_source: null }));
      setUrlInput("");
      setUrlValidationError("");
      setUploadValidationError("");
      setShowPreview(false);
      if (onVideoChange) onVideoChange();
      if (onVideoDelete) setTimeout(onVideoDelete, 50);
      return;
    }

    try {
      const isLocalFile = courseData.file.includes('/media/course-file/') || courseData.file.includes('media/course-file/');
      if (isLocalFile) {
        await useAxios.delete('file-cleanup/', {
          data: {
            file_url: courseData.file,
            file_id: courseData.video_file_id
          }
        });
      }

      setCourseData(prev => ({ ...prev, file: null, intro_video_source: null }));
      setUrlInput("");
      setUrlValidationError("");
      setUploadValidationError("");
      setShowPreview(false);

      if (onVideoChange) onVideoChange();

      Toast().fire({
        icon: "info",
        title: "Video Dihapus",
        text: "Video pengantar kursus berhasil dihapus.",
        timer: 2000,
        showConfirmButton: false
      });

      if (onVideoDelete) setTimeout(onVideoDelete, 50);
    } catch (error) {
      console.error('[VideoUpload] Error deleting video:', error);
      setCourseData(prev => ({ ...prev, file: null, intro_video_source: null }));
      setUrlInput("");
      setUrlValidationError("");
      setUploadValidationError("");
      setShowPreview(false);

      if (onVideoChange) onVideoChange();
      if (onVideoDelete) setTimeout(onVideoDelete, 50);
    }
  };

  const youtubeId = extractYoutubeId(courseData?.file);
  const driveId = extractGoogleDriveFileId(courseData?.file);

  return (
    <div className="video-upload-container mb-4">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <label className="form-label fw-bold text-dark m-0 d-flex align-items-center gap-2">
          <i className="fas fa-video text-teal"></i>
          <span>Video Pengantar Kursus</span>
          <span className="text-muted fw-normal small">(Opsional)</span>
        </label>
        {courseData?.file && (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger py-0 px-2 fw-semibold"
            style={{ fontSize: "11px" }}
            onClick={handleDeleteIntroVideo}
            title="Hapus video pengantar saat ini"
          >
            <i className="fas fa-trash-alt me-1"></i>Hapus Video
          </button>
        )}
      </div>

      <p className="text-muted small mb-3">
        Video pengantar atau cuplikan (*teaser*) yang ditampilkan di halaman awal kursus untuk menarik minat belajar aparatur.
      </p>

      {/* Mode Switcher: Unggah Berkas vs Tautan URL */}
      <div className="btn-group btn-group-sm mb-3 w-100 shadow-xs" role="group">
        <button
          type="button"
          className={`btn ${sourceType === 'upload' ? 'btn-teal text-white fw-bold' : 'btn-outline-secondary'}`}
          onClick={() => setSourceType('upload')}
          style={{ transition: 'all 0.2s ease' }}
        >
          <i className="fas fa-cloud-upload-alt me-2"></i>
          Unggah Berkas Video
        </button>
        <button
          type="button"
          className={`btn ${sourceType === 'url' ? 'btn-teal text-white fw-bold' : 'btn-outline-secondary'}`}
          onClick={() => setSourceType('url')}
          style={{ transition: 'all 0.2s ease' }}
        >
          <i className="fas fa-link me-2"></i>
          Tautan URL Video (YouTube / Google Drive / URL Langsung)
        </button>
      </div>

      {/* MODE 1: UNGGAH BERKAS VIDEO */}
      {sourceType === 'upload' && (
        <div className="p-3 bg-light rounded-3 border mb-3">
          <label htmlFor="videoFileInput" className="form-label fw-semibold small text-dark d-flex align-items-center gap-2 mb-2">
            <i className="fas fa-file-video text-teal"></i>
            <span>Pilih Berkas Video dari Komputer</span>
          </label>

          <div className="input-group mb-2">
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
              className="btn btn-teal btn-sm d-inline-flex align-items-center gap-2 px-3 fw-semibold"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={videoLoading}
            >
              {videoLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Mengunggah... {uploadProgress}%
                </>
              ) : (
                <>
                  <i className="fas fa-folder-open"></i>
                  <span>Pilih Berkas</span>
                </>
              )}
            </button>
          </div>

          {uploadValidationError && (
            <div className="invalid-feedback d-block mb-2">
              <i className="fas fa-exclamation-circle me-1"></i>
              {uploadValidationError}
            </div>
          )}

          <small className="text-muted d-block" style={{ fontSize: "11px" }}>
            <i className="fas fa-info-circle me-1 text-teal"></i>
            Format didukung: <strong>MP4, WebM, OGV, MOV, AVI, MKV</strong> &bull; Ukuran maksimal: <strong>500MB</strong>.
          </small>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="progress mt-2" style={{ height: "18px", borderRadius: "999px" }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated bg-teal"
                role="progressbar"
                style={{ width: `${uploadProgress}%` }}
              >
                {uploadProgress}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: TAUTAN URL VIDEO */}
      {sourceType === 'url' && (
        <div className="p-3 bg-light rounded-3 border mb-3">
          <label htmlFor="videoUrlInput" className="form-label fw-semibold small text-dark d-flex align-items-center gap-2 mb-2">
            <i className="fas fa-link text-teal"></i>
            <span>Tautan URL Video (YouTube / Google Drive / URL MP4)</span>
          </label>

          <div className="input-group mb-2">
            <span className="input-group-text bg-white text-muted">
              <i className="fas fa-globe"></i>
            </span>
            <input
              id="videoUrlInput"
              type="url"
              className={`form-control ${urlValidationError ? "is-invalid" : ""}`}
              placeholder="Contoh: https://www.youtube.com/watch?v=... atau https://drive.google.com/file/d/.../view"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlValidationError("");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyUrl();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-teal fw-semibold px-3"
              onClick={handleApplyUrl}
            >
              <i className="fas fa-check me-1"></i>Terapkan URL
            </button>
          </div>

          {urlValidationError && (
            <div className="invalid-feedback d-block mb-2">
              <i className="fas fa-exclamation-circle me-1"></i>
              {urlValidationError}
            </div>
          )}

          <small className="text-muted d-block" style={{ fontSize: "11px" }}>
            <i className="fab fa-youtube text-danger me-1"></i>
            Dapat berupa tautan publik YouTube, share link Google Drive, atau tautan streaming MP4 langsung.
          </small>
        </div>
      )}

      {/* INFORMASI VIDEO AKTIF SAAT INI */}
      {courseData?.file && (
        <div className="current-video-banner p-3 bg-white border rounded-3 shadow-xs mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <div className="d-flex align-items-center gap-2">
              <span className={`badge ${youtubeId ? 'bg-danger text-white' : driveId ? 'bg-primary text-white' : 'bg-teal text-white'} px-2 py-1`}>
                <i className={`fas ${youtubeId ? 'fa-play' : driveId ? 'fa-hdd' : 'fa-film'} me-1`}></i>
                {youtubeId ? 'YouTube' : driveId ? 'Google Drive' : 'Video Berkas'}
              </span>
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                <i className="fas fa-check-circle me-1"></i>Video Pengantar Aktif
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link text-decoration-none py-0 px-1 text-teal fw-semibold"
              style={{ fontSize: "12px" }}
              onClick={() => setShowPreview(!showPreview)}
            >
              <i className={`fas fa-${showPreview ? 'eye-slash' : 'eye'} me-1`}></i>
              {showPreview ? 'Sembunyikan Pratinjau' : 'Tampilkan Pratinjau'}
            </button>
          </div>

          <div className="text-muted small text-break mb-2" style={{ fontSize: "11.5px" }}>
            <strong>URL/Berkas:</strong> <code>{courseData.file}</code>
          </div>

          {/* PRATINJAU VIDEO */}
          {showPreview && (
            <div className="mt-3">
              {youtubeId ? (
                <div className="ratio ratio-16x9 rounded-3 overflow-hidden shadow-sm" style={{ maxHeight: '380px' }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                    title="Pratinjau Video YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ border: 'none' }}
                  ></iframe>
                </div>
              ) : driveId ? (
                <div className="ratio ratio-16x9 rounded-3 overflow-hidden shadow-sm" style={{ maxHeight: '380px' }}>
                  <iframe
                    src={`https://drive.google.com/file/d/${driveId}/preview`}
                    title="Pratinjau Video Google Drive"
                    allow="autoplay"
                    style={{ border: 'none' }}
                  ></iframe>
                </div>
              ) : (
                <div className="rounded-3 overflow-hidden shadow-sm bg-dark" style={{ maxHeight: '380px' }}>
                  <video
                    width="100%"
                    height="auto"
                    controls
                    controlsList="nodownload"
                    style={{ maxHeight: '380px', display: 'block' }}
                  >
                    <source src={courseData.file} />
                    Browser Anda tidak mendukung tag video HTML5.
                  </video>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status Belum Ada Video */}
      {!courseData?.file && (
        <div className="alert alert-secondary py-2 px-3 small d-flex align-items-center gap-2 mb-0" style={{ borderRadius: '8px' }}>
          <i className="fas fa-info-circle text-muted"></i>
          <span>Belum ada video pengantar yang dipilih. Anda dapat mengunggah berkas video atau menempelkan tautan URL di atas.</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(VideoUpload);
