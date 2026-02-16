import { useState, useRef } from "react";
import Toast from "../../plugin/Toast";

// Placeholder SVG (no external dependencies)
const PLACEHOLDER_SVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="%23999" transform="translate(0 20)"%3EGambar Tidak Tersedia%3C/text%3E%3C/svg%3E';

const ImageUpload = ({ 
  imagePreview, 
  setImagePreview, 
  courseData, 
  setCourseData, 
  errors, 
  warnings, 
  validateField,
  imageRef 
}) => {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  // ✨ PHASE 4.26: Extract file ID from various Google Drive URL formats
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

  // ✨ PHASE 4.26: Convert Google Drive URL to direct image URL
  const convertGoogleDriveUrl = (url) => {
    const isGoogleDrive = url.includes('drive.google.com') || url.includes('drive.usercontent.google.com');
    
    if (!isGoogleDrive) {
      return url; // Return as-is if not Google Drive
    }
    
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      // Use the direct export format that works with img tags
      return `https://drive.google.com/uc?id=${fileId}`;
    }
    
    return url; // Return original if can't extract file ID
  };

  // Validate image URL
  const isValidImageUrl = (url) => {
    try {
      const urlObj = new URL(url);
      // Check if it's HTTP or HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }
      // Check common image extensions or Google Drive format
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const path = urlObj.pathname.toLowerCase();
      const isValidExt = validExtensions.some(ext => path.includes(ext));
      const isGoogleDrive = urlObj.hostname.includes('drive.google.com') || urlObj.hostname.includes('lh') || urlObj.hostname.includes('drive.usercontent.google.com');
      return isValidExt || isGoogleDrive;
    } catch {
      return false;
    }
  };

  const handleImageUrlChange = (e) => {
    const url = e.target.value;
    setImageUrl(url);
    setValidationError("");
  };

  const validateAndSetImageUrl = () => {
    if (!imageUrl.trim()) {
      setValidationError("URL gambar diperlukan");
      return;
    }

    if (!isValidImageUrl(imageUrl)) {
      setValidationError("URL gambar tidak valid. Gunakan HTTP/HTTPS URL yang mengarah ke file gambar (JPG, PNG, GIF, WebP) atau Google Drive link");
      return;
    }

    setLoading(true);
    
    try {
      // ✨ PHASE 4.26: Convert Google Drive URLs to loadable format
      const urlToLoad = convertGoogleDriveUrl(imageUrl);
      
      // Verify image can be loaded by creating an Image object
      const img = new Image();
      img.onload = () => {
        // Store the original URL, not the converted one
        setImagePreview(imageUrl);
        setCourseData(prevData => ({
          ...prevData,
          image: imageUrl, // Store original URL
        }));
        validateField('image', imageUrl);
        
        Toast().fire({
          icon: "success",
          title: "Gambar Ditambahkan",
          text: "Gambar thumbnail kursus berhasil ditambahkan!",
          timer: 2000,
          showConfirmButton: false
        });
        
        setImageUrl("");
        setValidationError("");
        setLoading(false);
      };
      
      img.onerror = () => {
        setValidationError("Tidak dapat memuat gambar dari URL tersebut. Pastikan URL dapat diakses publik dan menunjuk ke file gambar");
        setLoading(false);
      };
      
      // Load using the converted URL (for testing), but preview the original URL
      img.src = urlToLoad;
    } catch (error) {
      console.error("Error validating image URL:", error);
      setValidationError("Terjadi kesalahan saat validasi URL gambar");
      setLoading(false);
    }
  };

  const getInputClass = () => {
    if (errors.image?.length > 0) return "form-control is-invalid";
    if (warnings.image?.length > 0) return "form-control is-warning";
    if (courseData.image) return "form-control is-valid";
    return "form-control";
  };

  const getImagePreviewClass = () => {
    if (errors.image?.length > 0) return "image-preview invalid";
    if (warnings.image?.length > 0) return "image-preview warning";
    if (courseData.image || imagePreview) return "image-preview valid";
    return "image-preview";
  };

  return (
    <>
      {/* Image Preview Section */}
      <div className="mb-4">
        <label className="form-label">
          <i className="fas fa-image me-2"></i>
          Gambar Kursus
          <span className="text-danger ms-1">*</span>
        </label>
        
        {loading ? (
          <div className="image-preview-container">
            <div className="loading-overlay">
              <div className="loading-content">
                <div 
                  className="spinner-border text-primary" 
                  role="status"
                  style={{ 
                    width: '3rem', 
                    height: '3rem',
                    flexShrink: 0,
                    borderWidth: '0.25em'
                  }}
                >
                  <span className="visually-hidden">Memuat...</span>
                </div>
                <h6 className="text-muted mb-2 mt-3">Memvalidasi gambar...</h6>
                <p className="text-muted mb-0 small mt-2">Silakan tunggu saat kami memverifikasi URL gambar Anda</p>
              </div>
            </div>
          </div>
        ) : (imagePreview || courseData?.image) ? (
          <>
            {/* Show comparison when both old and new images exist */}
            {courseData?.image && imagePreview && courseData.image !== imagePreview ? (
              <div className="row">
                <div className="col-md-6 mb-3">
                  <div className="text-center">
                    <small className="text-muted fw-bold d-block mb-2">
                      <i className="fas fa-history me-1"></i>
                      Gambar Kursus Saat Ini
                    </small>
                    <div className="image-preview-container" style={{ height: '400px' }}>
                      <img
                        className="image-preview"
                        src={convertGoogleDriveUrl(courseData.image)}
                        alt="Current Course Thumbnail"
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_SVG;
                          e.target.style.backgroundColor = '#f0f0f0';
                        }}
                        style={{ opacity: 0.7, objectFit: 'contain', height: '100%' }}
                      />
                      <div className="position-absolute top-0 end-0 m-2">
                        <span className="badge bg-secondary">
                          <i className="fas fa-clock me-1"></i>
                          Saat Ini
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="text-center">
                    <small className="text-success fw-bold d-block mb-2">
                      <i className="fas fa-sparkles me-1"></i>
                      Gambar Baru
                    </small>
                    <div className="image-preview-container" style={{ height: '400px' }}>
                      <img
                        className={getImagePreviewClass()}
                        src={convertGoogleDriveUrl(imagePreview)}
                        alt="New Course Thumbnail Preview"
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_SVG;
                          e.target.style.backgroundColor = '#f0f0f0';
                        }}
                        style={{ objectFit: 'contain', height: '100%' }}
                      />
                      <div className="position-absolute top-0 end-0 m-2">
                        <span className="badge bg-success">
                          <i className="fas fa-link me-1"></i>
                          Ditambahkan
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="image-preview-container" style={{ height: '400px' }}>
                <img
                  className={getImagePreviewClass()}
                  src={convertGoogleDriveUrl(imagePreview || courseData?.image || PLACEHOLDER_SVG)}
                  alt="Course Thumbnail Preview"
                  onError={(e) => {
                    e.target.src = PLACEHOLDER_SVG;
                    e.target.style.backgroundColor = '#f0f0f0';
                  }}
                  style={{ objectFit: 'contain', height: '100%' }}
                />
                {(imagePreview || courseData?.image) && (
                  <div className="position-absolute top-0 end-0 m-2">
                    <span className="badge bg-success">
                      <i className="fas fa-check me-1"></i>
                      Aktif
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* URL Input Section */}
      <div className="mb-4">
        <label htmlFor="courseImageUrl" className="form-label">
          <i className="fas fa-link me-2"></i>
          {courseData?.image ? 'Ganti URL Gambar' : 'Masukkan URL Gambar'}
          <span className="text-danger ms-1">*</span>
        </label>
        
        {/* Current Value Display */}
        {courseData?.image && (
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center">
              <i className="fas fa-image text-primary me-2"></i>
              <div className="flex-grow-1">
                <strong className="text-dark">URL Gambar Saat Ini:</strong>
                <br />
                <small className="text-muted text-break">{courseData.image}</small>
              </div>
              <span className="badge bg-success ms-2">
                <i className="fas fa-check me-1"></i>
                Aktif
              </span>
            </div>
          </div>
        )}
        
        {/* URL Input */}
        <div className="input-group mb-3">
          <input 
            id="courseImageUrl"
            className={`form-control ${validationError ? "is-invalid" : ""} ${courseData?.image && !validationError ? "is-valid" : ""}`}
            type="text"
            placeholder="https://example.com/image.jpg atau Google Drive link"
            value={imageUrl}
            onChange={handleImageUrlChange}
            onKeyPress={(e) => e.key === "Enter" && validateAndSetImageUrl()}
            disabled={loading}
          />
          <button 
            className="btn btn-outline-primary"
            type="button"
            onClick={validateAndSetImageUrl}
            disabled={!imageUrl.trim() || loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Memvalidasi...
              </>
            ) : (
              <>
                <i className="fas fa-check me-2"></i>
                Tambahkan
              </>
            )}
          </button>
        </div>

        {/* Error Messages */}
        {validationError && (
          <div className="invalid-feedback d-block">
            <i className="fas fa-exclamation-circle me-1"></i>
            {validationError}
          </div>
        )}

        {/* Validation Messages from Parent */}
        {errors.image?.map((error, index) => (
          <div key={index} className="invalid-feedback d-block">
            <i className="fas fa-exclamation-circle me-1"></i>
            {error}
          </div>
        ))}

        {warnings.image?.map((warning, index) => (
          <div key={index} className="warning-feedback d-block text-warning small mt-1">
            <i className="fas fa-exclamation-triangle me-1"></i>
            {warning}
          </div>
        ))}

        {/* Help Text */}
        <small className="text-muted d-block mt-2">
          <i className="fas fa-info-circle me-1"></i>
          Gunakan URL HTTP/HTTPS ke gambar (JPG, PNG, GIF, WebP) atau Google Drive link yang dapat diakses publik.
        </small>

        {/* URL Format Examples */}
        <div className="mt-2 p-2 bg-light rounded">
          <small className="text-muted d-block mb-1">
            <strong>Contoh URL yang didukung:</strong>
          </small>
          <ul className="text-muted small mb-0">
            <li>Direct image: <code>https://example.com/course-thumbnail.jpg</code></li>
            <li>Google Drive: <code>https://drive.google.com/uc?id=1ABC...&export=download</code></li>
            <li>CDN image: <code>https://cdn.example.com/images/photo.png</code></li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default ImageUpload;
