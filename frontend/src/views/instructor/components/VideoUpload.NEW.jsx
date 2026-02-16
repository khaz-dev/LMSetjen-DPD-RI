import { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";

const VideoUpload = ({ courseData, setCourseData }) => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeValidationError, setYoutubeValidationError] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);

  // Extract YouTube video ID from various YouTube URL formats
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

  // Validate and handle YouTube URL submission
  const handleYoutubeUrlChange = (e) => {
    const url = e.target.value;
    setYoutubeUrl(url);
    setYoutubeValidationError("");
  };

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
    // youtube-nocookie.com doesn't load tracking/ads, reducing console violations
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    
    // ✨ PHASE 4.28: Update state immediately instead of unnecessary setTimeout
    // Previous 500ms delay caused performance violations with no UX benefit
    setCourseData(prevData => ({
      ...prevData,
      file: embedUrl,
      intro_video_source: "youtube"
    }));

    Toast().fire({
      icon: "success",
      title: "Video YouTube Ditambahkan",
      text: "Video pengantar YouTube berhasil ditambahkan!",
      timer: 2000,
      showConfirmButton: false
    });

    setYoutubeUrl("");
    setYoutubeValidationError("");
  };

  return (
    <div className="video-upload-container">
      <label className="form-label">
        <i className="fas fa-video me-2"></i>
        Video Pengantar Kursus
        <span className="text-muted ms-1">(Opsional)</span>
      </label>
      
      {/* YouTube URL Input */}
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

        {/* URL Format Examples */}
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

      {/* YouTube Preview */}
      {courseData.file && (courseData.file.includes("youtube.com/embed") || courseData.file.includes("youtube-nocookie.com/embed")) && (
        <>
          <div className="mb-3">
            <label className="form-label">
              <i className="fas fa-play-circle me-2 text-success"></i>
              Pratinjau Video
            </label>
            <div className="ratio ratio-16x9" style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              <iframe
                src={courseData.file}
                title="YouTube video player - Course Introduction"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                decoding="async"
                sandbox="allow-accelerometer allow-autoplay allow-clipboard-write allow-encrypted-media allow-gyroscope allow-picture-in-picture allow-same-origin"
              ></iframe>
            </div>
          </div>

          {/* Current Video Display */}
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center flex-grow-1">
                <i className="fas fa-video text-success me-2"></i>
                <div className="flex-grow-1">
                  <strong className="text-dark">Video YouTube Saat Ini:</strong>
                  <br />
                  <small className="text-muted text-break">{courseData.file}</small>
                </div>
              </div>
              <span className="badge bg-success ms-2">
                <i className="fas fa-check-circle me-1"></i>
                Aktif
              </span>
            </div>
          </div>

          {/* Remove Button */}
          <div className="d-flex gap-2">
            <button 
              className="btn btn-danger btn-sm"
              onClick={() => {
                setCourseData(prev => ({ ...prev, file: null, intro_video_source: "youtube" }));
                setYoutubeUrl("");
                Toast().fire({
                  icon: "info",
                  title: "Video Dihapus",
                  text: "Video pengantar telah dihapus",
                  timer: 2000,
                  showConfirmButton: false
                });
              }}
            >
              <i className="fas fa-trash me-2"></i>
              Hapus Video
            </button>
          </div>
        </>
      )}

      {/* No Video Selected Message */}
      {!courseData.file && (
        <div className="alert alert-info" role="alert">
          <i className="fas fa-info-circle me-2"></i>
          <strong>Tidak ada video yang dipilih</strong>
          <br />
          <small>Masukkan URL YouTube di atas untuk menambahkan video pengantar kursus Anda</small>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
