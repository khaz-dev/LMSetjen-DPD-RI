import { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";

const VideoUpload = ({ courseData, setCourseData }) => {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeValidationError, setYoutubeValidationError] = useState("");
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [googleDriveValidationError, setGoogleDriveValidationError] = useState("");
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

  // ✨ PHASE 4.32: Extract Google Drive file ID from various URL formats
  const extractGoogleDriveFileId = (url) => {
    try {
      // Format 1: https://drive.google.com/file/d/FILE_ID/view...
      const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match1 && match1[1]) return match1[1];
      
      // Format 2: https://drive.google.com/uc?id=FILE_ID...
      const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (match2 && match2[1]) return match2[1];
      
      // Format 3: https://drive.usercontent.google.com/download?id=FILE_ID...
      const match3 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (match3 && match3[1]) return match3[1];
      
      return null;
    } catch {
      return null;
    }
  };

  // ✨ PHASE 4.32: Convert Google Drive URL to embed/preview format
  // Google Drive video can be embedded using: https://drive.google.com/file/d/FILE_ID/preview
  const convertGoogleDriveVideoUrl = (url) => {
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      // Use preview format which allows embedded playback
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
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

  // ✨ PHASE 4.32: Validate and handle Google Drive URL submission
  const handleGoogleDriveUrlChange = (e) => {
    const url = e.target.value;
    setGoogleDriveUrl(url);
    setGoogleDriveValidationError("");
  };

  const validateAndSetGoogleDriveUrl = () => {
    if (!googleDriveUrl.trim()) {
      setGoogleDriveValidationError("URL Google Drive diperlukan");
      return;
    }

    // Validate it's a Google Drive URL
    if (!googleDriveUrl.includes("drive.google.com") && !googleDriveUrl.includes("drive.usercontent.google.com")) {
      setGoogleDriveValidationError("URL harus dari Google Drive. Gunakan: https://drive.google.com/file/d/FILE_ID/view");
      return;
    }

    // Extract and validate file ID
    const fileId = extractGoogleDriveFileId(googleDriveUrl);
    if (!fileId) {
      setGoogleDriveValidationError("Tidak dapat mengekstrak ID file dari URL. Pastikan URL benar.");
      return;
    }

    // Convert to embed format
    const embedUrl = convertGoogleDriveVideoUrl(googleDriveUrl);

    setCourseData(prevData => ({
      ...prevData,
      file: embedUrl,
      intro_video_source: "google_drive"
    }));

    Toast().fire({
      icon: "success",
      title: "Video Google Drive Ditambahkan",
      text: "Video pengantar Google Drive berhasil ditambahkan!",
      timer: 2000,
      showConfirmButton: false
    });

    setGoogleDriveUrl("");
    setGoogleDriveValidationError("");
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

      {/* ✨ PHASE 4.32: Google Drive URL Input */}
      <div className="mb-3">
        <label htmlFor="googleDriveUrl" className="form-label">
          <i className="fab fa-google text-info me-2"></i>
          Atau Masukkan URL Google Drive Video
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
          Format yang didukung: https://drive.google.com/file/d/FILE_ID/view (file harus publik)
        </small>

        {/* Google Drive URL Format Examples */}
        <div className="mt-2 p-2 bg-light rounded">
          <small className="text-muted d-block mb-1">
            <strong>Contoh URL Google Drive yang didukung:</strong>
          </small>
          <ul className="text-muted small mb-0">
            <li><code>https://drive.google.com/file/d/1ABC...XYZ/view?usp=sharing</code></li>
            <li><code>https://drive.google.com/file/d/1ABC...XYZ/view</code></li>
            <li><strong className="text-warning">Pastikan file dibagikan "Siapa saja yang memiliki link"</strong></li>
          </ul>
        </div>
      </div>

      {/* YouTube & Google Drive Preview */}
      {courseData.file && (courseData.file.includes("youtube.com/embed") || courseData.file.includes("youtube-nocookie.com/embed") || courseData.file.includes("drive.google.com/file/d")) && (
        <>
          <div className="mb-3">
            <label className="form-label">
              <i className="fas fa-play-circle me-2 text-success"></i>
              Pratinjau Video
            </label>
            <div className="ratio ratio-16x9" style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
              <iframe
                src={courseData.file}
                title="Video player - Course Introduction"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                decoding="async"
              ></iframe>
            </div>
          </div>

          {/* Current Video Display */}
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center flex-grow-1">
                <i className={`fas me-2 ${courseData.intro_video_source === 'youtube' ? 'fab fa-youtube text-danger' : 'fab fa-google text-info'}`}></i>
                <div className="flex-grow-1">
                  <strong className="text-dark">
                    {courseData.intro_video_source === 'youtube' ? 'Video YouTube Saat Ini:' : 'Video Google Drive Saat Ini:'}
                  </strong>
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
                setGoogleDriveUrl("");
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
          <small>Masukkan URL YouTube atau Google Drive di atas untuk menambahkan video pengantar kursus Anda</small>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
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
