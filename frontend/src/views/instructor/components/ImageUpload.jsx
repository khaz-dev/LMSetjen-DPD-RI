import { useState, useRef } from "react";
import { validateFileType } from "../../../utils/courseValidation";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";

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
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validate file type and size
    const validation = validateFileType(file, 'image');
    if (!validation.isValid) {
      Toast().fire({
        icon: "error",
        title: "File Tidak Valid",
        text: validation.error,
      });
      event.target.value = '';
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      // Create FormData with the selected file
      const formData = new FormData();
      formData.append("file", file);

      // Upload directly without cropping
      const response = await useAxios.post("/file-upload/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      if (response?.data?.url) {
        // Show preview and update course data
        setImagePreview(response.data.url);
        setCourseData(prevData => ({
          ...prevData,
          image: response.data.url,
        }));
        validateField('image', response.data.url);
        
        Toast().fire({
          icon: "success",
          title: "Image Uploaded",
          text: "Course thumbnail uploaded successfully!",
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      Toast().fire({
        icon: "error",
        title: "Unggahan Gagal",
        text: error.response?.data?.message || "Gagal mengunggah gambar. Silakan coba lagi.",
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
      event.target.value = '';
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
                <h6 className="text-muted mb-2 mt-3">Mengunggah gambar kursus...</h6>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="progress mt-3" style={{ height: '5px' }}>
                    <div 
                      className="progress-bar" 
                      role="progressbar" 
                      style={{ width: `${uploadProgress}%` }} 
                    />
                  </div>
                )}
                <p className="text-muted mb-0 small mt-2">Silakan tunggu saat kami memproses gambar Anda</p>
              </div>
            </div>
          </div>
        ) : (
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
                        src={courseData.image}
                        alt="Current Course Thumbnail"
                        onError={(e) => {
                          e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
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
                        src={imagePreview}
                        alt="New Course Thumbnail Preview"
                        onError={(e) => {
                          e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                        }}
                        style={{ objectFit: 'contain', height: '100%' }}
                      />
                      <div className="position-absolute top-0 end-0 m-2">
                        <span className="badge bg-success">
                          <i className="fas fa-upload me-1"></i>
                          Diunggah
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
                  src={imagePreview || courseData?.image || "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png"}
                  alt="Course Thumbnail Preview"
                  onError={(e) => {
                    e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                  }}
                  style={{ objectFit: 'contain', height: '100%' }}
                />
                {(imagePreview || courseData?.image) && (
                  <div className="position-absolute top-0 end-0 m-2">
                    <span className="badge bg-success">
                      <i className="fas fa-upload me-1"></i>
                      Uploaded
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* File Upload */}
      <div className="mb-4">
        <label htmlFor="courseThumbnail" className="form-label">
          <i className="fas fa-upload me-2"></i>
          {courseData?.image ? 'Ganti Gambar' : 'Unggah Gambar Baru'}
          {warnings.image?.length > 0 && <span className="text-warning ms-1">*</span>}
        </label>
        
        {/* Current Value Display */}
        {courseData?.image && (
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center">
              <i className="fas fa-image text-primary me-2"></i>
              <div className="flex-grow-1">
                <strong className="text-dark">Gambar Kursus Saat Ini:</strong>
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
        
        <input 
          ref={imageRef}
          id="courseThumbnail" 
          className={getInputClass()}
          type="file" 
          name="image" 
          onChange={handleImageUpload}
          accept="image/*"
          disabled={loading}
        />
        <small className="text-muted d-block mt-2">
          <i className="fas fa-info-circle me-1"></i>
          {courseData?.image 
            ? 'Unggah gambar baru untuk mengganti gambar kursus saat ini.'
            : 'Unggah gambar (JPG, PNG, GIF, atau WebP - Maks 5MB).'
          }
        </small>
        
        {/* Error Messages */}
        {errors.image?.map((error, index) => (
          <div key={index} className="invalid-feedback d-block">
            <i className="fas fa-exclamation-circle me-1"></i>
            {error}
          </div>
        ))}

        {/* Warning Messages */}
        {warnings.image?.map((warning, index) => (
          <div key={index} className="warning-feedback d-block text-warning small mt-1">
            <i className="fas fa-exclamation-triangle me-1"></i>
            {warning}
          </div>
        ))}
      </div>
    </>
  );
};

export default ImageUpload;