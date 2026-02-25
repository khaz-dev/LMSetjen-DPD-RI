import React, { useState, useRef, useEffect } from "react";
import Toast from "../../plugin/Toast";
import useAxios from "../../../utils/useAxios";
import Cookie from "js-cookie";

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
  imageRef,
  onImageChange // ✨ PHASE 4.49: Added callback to track image changes
 }) => {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [validationError, setValidationError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMethod, setUploadMethod] = useState(null); // ✨ PHASE 4.100: null | 'url' | 'file'
  const fileInputRef = useRef(null);

  // ✨ PHASE 4.101.5: Monitor courseData.image for debugging
  useEffect(() => {
    // Debug log removed - only log on actual changes
    if (courseData?.image && !imagePreview) {
      setImagePreview(courseData.image);
    }
  }, [courseData?.image, imagePreview, setImagePreview]);

  // ✨ PHASE 4.176: Consolidated useEffect for upload method initialization and sync
  // This replaces three separate effects that were causing redundant operations
  useEffect(() => {
    if (!courseData?.image) return;

    const isLocalFile = courseData.image.includes('/media/course-file/') || 
                       courseData.image.includes('media/course-file/');

    // Auto-detect and initialize upload method if not already set
    if (uploadMethod === null) {
      if (isLocalFile) {
        setUploadMethod('file');
      } else {
        setUploadMethod('url');
        // Restore external URL in input field
        setImageUrl(courseData.image);
      }
    } else if (uploadMethod === 'url' && !isLocalFile) {
      // User is on URL tab and courseData has an external URL - restore it
      setImageUrl(courseData.image);
    }
  }, [courseData?.image]);

  // ✨ PHASE 4.100: File upload configuration
  const FILE_UPLOAD_CONFIG = {
    IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  };

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
  // ✨ PHASE 4.29: Fixed - Add &export=download so Google Drive serves the actual image
  // ✨ PHASE 4.30: CRITICAL FIX - Attempted lh.googleusercontent.com (FAILED - 404)
  // ✨ PHASE 4.31: REAL FIX - Use Google Drive's official thumbnail endpoint
  const convertGoogleDriveUrl = (url) => {
    const isGoogleDrive = url.includes('drive.google.com') || url.includes('drive.usercontent.google.com');
    
    if (!isGoogleDrive) {
      return url; // Return as-is if not Google Drive
    }
    
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      // PHASE 4.31: Use Google Drive's thumbnail endpoint
      // This is Google's official endpoint for retrieving file previews/thumbnails
      // Works for images, documents, and other file types
      // sz=w1200 sets width to 1200px (high quality for course thumbnails)
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }
    
    return url; // Return original if can't extract file ID
  };

  // ✨ PHASE 4.101.4: Delete uploaded file when switching to URL source
  // Only deletes if current image is from a local file upload (/media/course-file/)
  // Does NOT delete external URLs (Google Drive, CDN, etc.)
  const deleteOldFileIfLocal = async () => {
    console.log('[ImageUpload.deleteOldFileIfLocal] Starting deletion check...');
    console.log('[ImageUpload.deleteOldFileIfLocal] courseData.image:', courseData?.image);
    
    if (!courseData?.image) {
      console.log('[ImageUpload.deleteOldFileIfLocal] ℹ️  No image to delete');
      return; // No image to delete
    }
    
    // Check if it's a local file upload (not Google Drive or other external URL)
    const isLocalFile = courseData.image.includes('/media/course-file/') || 
                       courseData.image.includes('media/course-file/');
    
    console.log('[ImageUpload.deleteOldFileIfLocal] isLocalFile check:', isLocalFile);
    console.log('[ImageUpload.deleteOldFileIfLocal] Checking for /media/course-file/:', courseData.image.includes('/media/course-file/'));
    console.log('[ImageUpload.deleteOldFileIfLocal] Checking for media/course-file/:', courseData.image.includes('media/course-file/'));
    
    if (!isLocalFile) {
      console.log('[ImageUpload.deleteOldFileIfLocal] ℹ️  Keeping external URL image:', courseData.image);
      return; // Don't delete external URLs
    }
    
    try {
      console.log('[ImageUpload.deleteOldFileIfLocal] 🗑️  Attempting to delete local file...');
      console.log('[ImageUpload.deleteOldFileIfLocal] File URL:', courseData.image);
      
      const response = await useAxios().delete('/api/v1/file-cleanup/', {
        data: { file_url: courseData.image }
      });
      
      console.log('[ImageUpload.deleteOldFileIfLocal] ✅ Delete response:', response);
      console.log('[ImageUpload.deleteOldFileIfLocal] ✅ Local file deleted successfully');
    } catch (error) {
      console.error('[ImageUpload.deleteOldFileIfLocal] ❌ Error deleting local file:', error);
      // Continue anyway - file deletion failure shouldn't block URL setting
    }
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

  const validateAndSetImageUrl = async () => {
    console.log('[ImageUpload.validateAndSetImageUrl] === STARTING URL VALIDATION ===');
    console.log('[ImageUpload.validateAndSetImageUrl] imageUrl input:', imageUrl);
    console.log('[ImageUpload.validateAndSetImageUrl] Current courseData:', courseData);
    console.log('[ImageUpload.validateAndSetImageUrl] courseData.image (old file to delete):', courseData?.image);
    console.log('[ImageUpload.validateAndSetImageUrl] Type of courseData.image:', typeof courseData?.image);
    console.log('[ImageUpload.validateAndSetImageUrl] Length of courseData.image:', courseData?.image?.length);
    
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
      // ✨ PHASE 4.27: For Google Drive URLs, skip Image() validation due to CORS restrictions
      // Google Drive blocks Image() object requests even for valid public images
      const isGoogleDrive = imageUrl.includes('drive.google.com') || imageUrl.includes('drive.usercontent.google.com');
      
      console.log('[ImageUpload.validateAndSetImageUrl] isGoogleDrive:', isGoogleDrive);
      
      if (isGoogleDrive) {
        console.log('[ImageUpload.validateAndSetImageUrl] Processing Google Drive URL...');
        // Directly accept Google Drive URLs after format validation
        
        // ✨ PHASE 4.101.4: Delete old file if switching from file upload to URL
        console.log('[ImageUpload.validateAndSetImageUrl] Calling deleteOldFileIfLocal()...');
        await deleteOldFileIfLocal();
        console.log('[ImageUpload.validateAndSetImageUrl] deleteOldFileIfLocal() completed');
        
        setImagePreview(imageUrl);
        setCourseData(prevData => ({
          ...prevData,
          image: imageUrl,
        }));
        
        // ✨ PHASE 4.49: Trigger callback to mark form as dirty when image changes
        if (onImageChange) {
          onImageChange();
        }
        
        validateField('image', imageUrl);
        
        Toast().fire({
          icon: "success",
          title: "Gambar Ditambahkan",
          text: "Google Drive gambar berhasil ditambahkan! Link akan ditampilkan saat melihat kursus.",
          timer: 2000,
          showConfirmButton: false
        });
        
        setImageUrl("");
        setValidationError("");
        setLoading(false);
        return;
      }
      
      // For non-Google Drive URLs, verify image can be loaded by creating an Image object
      console.log('[ImageUpload.validateAndSetImageUrl] Processing regular URL (not Google Drive)...');
      const img = new Image();
      img.onload = async () => {
        console.log('[ImageUpload.validateAndSetImageUrl] Image loaded successfully');
        console.log('[ImageUpload.validateAndSetImageUrl] Calling deleteOldFileIfLocal()...');
        
        // ✨ PHASE 4.101.4: Delete old file if switching from file upload to URL
        await deleteOldFileIfLocal();
        
        console.log('[ImageUpload.validateAndSetImageUrl] deleteOldFileIfLocal() completed');
        
        // Store the original URL
        setImagePreview(imageUrl);
        setCourseData(prevData => ({
          ...prevData,
          image: imageUrl,
        }));
        
        // ✨ PHASE 4.49: Trigger callback to mark form as dirty when image changes
        if (onImageChange) {
          onImageChange();
        }
        
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
      
      // Load the image to verify it's valid (skip for Google Drive)
      img.src = imageUrl;
    } catch (error) {
      console.error("Error validating image URL:", error);
      setValidationError("Terjadi kesalahan saat validasi URL gambar");
      setLoading(false);
    }
  };

  // ✨ PHASE 4.100: Validate and upload image file
  const validateFile = (file) => {
    if (!FILE_UPLOAD_CONFIG.IMAGE_TYPES.includes(file.type)) {
      return { isValid: false, error: "Silakan pilih file gambar yang valid (JPG, PNG, GIF, WebP)" };
    }

    if (file.size > FILE_UPLOAD_CONFIG.MAX_IMAGE_SIZE) {
      const maxSizeMB = Math.round(FILE_UPLOAD_CONFIG.MAX_IMAGE_SIZE / (1024 * 1024));
      return { isValid: false, error: `Ukuran file harus kurang dari ${maxSizeMB}MB` };
    }

    return { isValid: true };
  };

  // ✨ PHASE 4.100: Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      Toast().fire({
        icon: "error",
        title: validation.error,
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setValidationError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      console.log('[ImageUpload.handleFileUpload] 📤 About to upload file...');
      console.log('[ImageUpload.handleFileUpload] Course ID (course_id):', courseData?.course_id);
      console.log('[ImageUpload.handleFileUpload] Current courseData.image:', courseData?.image);
      
      // ✨ PHASE 4.102: Pass course_id so backend can use consistent filename {course_id}-gk.{ext}
      // This way, every upload overwrites previous file automatically (no deletion logic needed!)
      if (courseData?.course_id) {
        formData.append("course_id", courseData.course_id);
        console.log('[ImageUpload.handleFileUpload] Sending course_id for consistent filename:', courseData.course_id);
      }
      
      // Keep old_file_url for backwards compatibility (not needed anymore but harmless)
      if (courseData?.image) {
        console.log('[ImageUpload.handleFileUpload] Old image URL (for reference):', courseData.image);
        formData.append("old_file_url", courseData.image);
      } else {
        console.log('[ImageUpload.handleFileUpload] ℹ️  No previous image (first upload)');
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

      console.log('[ImageUpload.handleFileUpload] ✅ Upload complete. Response URL:', response?.data?.url);

      if (response?.data?.url) {
        // ✨ PHASE 4.101.3: Simplified - old file now deleted automatically by backend
        // No need to track multiple uploads anymore since deletion happens on each upload
        
        console.log('[ImageUpload.handleFileUpload] Setting courseData.image to:', response.data.url);
        
        // Store image URL in cookie for reference
        Cookie.set("course_image_url", response?.data?.url);
        
        // Update preview and course data
        setImagePreview(response?.data?.url);
        
        const uploadedFileName = file.name || 'Gambar';
        console.log('[ImageUpload.handleFileUpload] File uploaded as:', uploadedFileName);
        
        // ✨ PHASE 4.102.1: Old files deleted before new one is saved
        // Handles JPG→PNG, PNG→JPG, etc. (different extensions auto-delete old one)
        const overwriteMessage = courseData?.course_id 
          ? `Gambar sebelumnya dihapus dan "${uploadedFileName}" berhasil disimpan!`
          : `"${uploadedFileName}" telah diunggah!`;
        
        setCourseData(prevData => ({
          ...prevData,
          image: response?.data?.url,
        }));

        // Trigger callback to mark form as dirty
        if (onImageChange) {
          onImageChange();
        }

        // Validate field
        validateField('image', response?.data?.url);

        // Show success message with overwrite info
        Toast().fire({
          icon: "success",
          title: "Gambar Berhasil Diunggah",
          text: overwriteMessage,
          timer: 2500,
          showConfirmButton: false
        });

        console.log('[ImageUpload.handleFileUpload] ✅ Complete success flow');

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      const errorMessage = error.response?.data?.message || "Gagal mengunggah gambar. Silakan coba lagi.";
      setValidationError(errorMessage);
      Toast().fire({
        icon: "error",
        title: "Gagal mengunggah gambar",
        text: errorMessage,
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
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
                <p className="text-muted mb-0 small mt-2">Silakan tunggu saat kami memverifikasi gambar Anda</p>
              </div>
            </div>
          </div>
        ) : (imagePreview || courseData?.image) ? (
          <div className="image-preview-container" style={{ height: '400px' }}>
            <img
              className={getImagePreviewClass()}
              src={convertGoogleDriveUrl(imagePreview || courseData?.image || PLACEHOLDER_SVG)}
              alt="Course Thumbnail Preview"
              referrerPolicy="no-referrer"
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
        ) : null}
      </div>

      {/* ✨ PHASE 4.100: Upload Method Selection */}
      {/* Show method selection if no image, or if user wants to change image */}
      <div className="mb-4">
        <label className="form-label fw-bold">
          <i className="fas fa-arrow-right me-2"></i>
          {courseData?.image ? 'Ganti Gambar Kursus' : 'Pilih Cara Menambahkan Gambar'}
          <span className="text-danger ms-1">*</span>
        </label>
        
        {/* Toggle Buttons */}
        <div className="btn-group w-100" role="group">
          <input 
            type="radio" 
            className="btn-check" 
            name="uploadMethod" 
            id="methodUrl" 
            value="url"
            checked={uploadMethod === 'url'}
            onChange={() => {
              setUploadMethod('url');
              setValidationError("");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
          />
          <label className="btn btn-outline-primary" htmlFor="methodUrl" style={{ flex: 1 }}>
            <i className="fas fa-link me-2"></i>
            Dari URL
          </label>

          <input 
            type="radio" 
            className="btn-check" 
            name="uploadMethod" 
            id="methodFile" 
            value="file"
            checked={uploadMethod === 'file'}
            onChange={() => {
              setUploadMethod('file');
              setValidationError("");
              setImageUrl("");
            }}
          />
          <label className="btn btn-outline-primary" htmlFor="methodFile" style={{ flex: 1 }}>
            <i className="fas fa-upload me-2"></i>
            Unggah File
          </label>
        </div>
      </div>

      {/* URL Input Section - Show only if uploadMethod is 'url' */}
      {uploadMethod === 'url' && (
        <div className="mb-4">
          <label htmlFor="courseImageUrl" className="form-label">
            <i className="fas fa-link me-2"></i>
            Masukkan URL Gambar
            <span className="text-danger ms-1">*</span>
          </label>
          
          {/* URL Input */}
          <div className="input-group mb-3">
            <input 
              id="courseImageUrl"
              className={`form-control ${validationError ? "is-invalid" : ""}`}
              type="text"
              placeholder="https://example.com/image.jpg atau Google Drive link"
              value={imageUrl}
              onChange={handleImageUrlChange}
              onKeyPress={(e) => e.key === "Enter" && validateAndSetImageUrl()}
              disabled={loading}
            />
            <button 
              className="btn btn-primary"
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
      )}

      {/* File Upload Section - Show only if uploadMethod is 'file' */}
      {uploadMethod === 'file' && (
        <div className="mb-4">
          <label htmlFor="courseImageFile" className="form-label">
            <i className="fas fa-upload me-2"></i>
            Unggah Gambar dari Komputer
            <span className="text-danger ms-1">*</span>
          </label>
          
          {/* Show Current Uploaded File (PHASE 4.101.6) */}
          {courseData?.image && (
            <div className="alert alert-info mb-3 d-flex align-items-center" role="alert">
              <i className="fas fa-file-image me-2" style={{fontSize: '18px'}}></i>
              <div>
                <strong>Gambar saat ini:</strong>
                <br/>
                <small>{courseData.image.split('/').pop()}</small>
                <br/>
                <small className="text-muted">✨ Unggah file baru untuk otomatis mengganti (overwrite)</small>
              </div>
            </div>
          )}
          
          {/* File Upload Input */}
          <div className="mb-3">
            <input 
              id="courseImageFile"
              ref={fileInputRef}
              className={`form-control ${validationError ? "is-invalid" : ""}`}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileUpload}
              disabled={loading}
              aria-label="Unggah gambar kursus"
            />
            <div className="form-text text-muted d-block mt-2">
              <i className="fas fa-info-circle me-1"></i>
              Format yang didukung: JPG, PNG, GIF, WebP | Ukuran maksimal: 5MB
            </div>

            {/* Upload Progress */}
            {loading && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="progress">
                  <div 
                    className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                    role="progressbar" 
                    style={{ width: `${uploadProgress}%` }}
                    aria-valuenow={uploadProgress} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  >
                    {uploadProgress}%
                  </div>
                </div>
                <small className="text-muted d-block mt-2">Mengunggah...{uploadProgress}%</small>
              </div>
            )}

            {/* File Upload Error */}
            {validationError && (
              <div className="invalid-feedback d-block mt-2">
                <i className="fas fa-exclamation-circle me-1"></i>
                {validationError}
              </div>
            )}

            {/* Validation Messages from Parent */}
            {errors.image?.map((error, index) => (
              <div key={index} className="invalid-feedback d-block mt-2">
                <i className="fas fa-exclamation-circle me-1"></i>
                {error}
              </div>
            ))}

            {warnings.image?.map((warning, index) => (
              <div key={index} className="warning-feedback d-block text-warning small mt-2">
                <i className="fas fa-exclamation-triangle me-1"></i>
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// ✨ PHASE 4.176: Memoize component to prevent unnecessary re-renders from parent
// This prevents ImageUpload from being re-rendered when parent updates unless its props actually change
export default React.memo(ImageUpload);
