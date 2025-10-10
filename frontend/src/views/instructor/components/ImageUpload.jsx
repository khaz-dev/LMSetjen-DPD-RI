import { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
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
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // Center crop with 16:9 aspect ratio (ideal for course thumbnails)
  function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        mediaWidth,
        mediaHeight,
      ),
      mediaWidth,
      mediaHeight,
    );
  }

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 16 / 9));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validate file type and size
    const validation = validateFileType(file, 'image');
    if (!validation.isValid) {
      Toast().fire({
        icon: "error",
        title: "Invalid File",
        text: validation.error,
      });
      event.target.value = '';
      return;
    }

    // Read file and show crop modal
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result);
      setSelectedFile(file);
      setShowCropModal(true);
    });
    reader.readAsDataURL(file);
    
    // Clear input
    event.target.value = '';
  };

  const getCroppedImg = (image, crop, fileName) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Set canvas size to match desired output (1920x1080 for 16:9)
    const targetWidth = 1920;
    const targetHeight = 1080;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          blob.name = fileName;
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const handleCropComplete = async () => {
    if (!completedCrop || !imgRef.current) {
      Toast().fire({
        icon: "error",
        title: "No Crop Selected",
        text: "Please select an area to crop",
      });
      return;
    }

    setLoading(true);
    setShowCropModal(false);

    try {
      const croppedBlob = await getCroppedImg(
        imgRef.current,
        completedCrop,
        selectedFile.name
      );

      const formData = new FormData();
      formData.append("file", croppedBlob, selectedFile.name);

      const response = await useAxios.post("/file-upload/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response?.data?.url) {
        setImagePreview(response.data.url);
        setCourseData(prevData => ({
          ...prevData,
          image: response.data.url,
        }));
        validateField('image', response.data.url);
        
        Toast().fire({
          icon: "success",
          title: "Image Uploaded",
          text: "Course thumbnail uploaded and cropped successfully!",
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      Toast().fire({
        icon: "error",
        title: "Upload Failed",
        text: error.response?.data?.message || "Failed to upload image. Please try again.",
      });
    } finally {
      setLoading(false);
      setImageSrc(null);
      setSelectedFile(null);
      setCompletedCrop(null);
    }
  };

  const handleCancelCrop = () => {
    setShowCropModal(false);
    setImageSrc(null);
    setSelectedFile(null);
    setCompletedCrop(null);
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
      {/* Crop Modal */}
      {showCropModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} tabIndex="-1">
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-crop me-2"></i>
                  Crop Your Course Thumbnail
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={handleCancelCrop}
                  disabled={loading}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-info mb-4">
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>Pro Tip:</strong> Drag the selection area to choose what will be visible as your course thumbnail. 
                  The image will be optimized to 16:9 aspect ratio (1920x1080px) - perfect for course displays!
                </div>
                
                <div className="crop-container" style={{ 
                  maxHeight: '60vh', 
                  overflow: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '20px'
                }}>
                  {imageSrc && (
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={16 / 9}
                      minWidth={100}
                    >
                      <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Crop preview"
                        onLoad={onImageLoad}
                        style={{ 
                          maxWidth: '100%',
                          maxHeight: '60vh',
                          objectFit: 'contain'
                        }}
                      />
                    </ReactCrop>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <small className="text-muted">
                    <i className="fas fa-arrows-alt me-1"></i>
                    Drag the corners to adjust the crop area. The selected area will be your course thumbnail.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCancelCrop}
                  disabled={loading}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCropComplete}
                  disabled={loading || !completedCrop}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check me-2"></i>
                      Crop & Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Section */}
      <div className="mb-4">
        <label className="form-label">
          <i className="fas fa-image me-2"></i>
          Course Thumbnail
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
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h6 className="text-muted mb-2 mt-3">Uploading thumbnail...</h6>
                <p className="text-muted mb-0 small">Please wait while we process your image</p>
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
                      Current Thumbnail
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
                          Current
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="text-center">
                    <small className="text-success fw-bold d-block mb-2">
                      <i className="fas fa-sparkles me-1"></i>
                      New Thumbnail
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
                          <i className="fas fa-check me-1"></i>
                          New
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
                      <i className="fas fa-check me-1"></i>
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
          {courseData?.image ? 'Replace Thumbnail' : 'Upload New Thumbnail'}
          {warnings.image?.length > 0 && <span className="text-warning ms-1">*</span>}
        </label>
        
        {/* Current Value Display */}
        {courseData?.image && (
          <div className="current-value-display mb-3 p-3 bg-light border rounded">
            <div className="d-flex align-items-center">
              <i className="fas fa-image text-primary me-2"></i>
              <div className="flex-grow-1">
                <strong className="text-dark">Current Thumbnail:</strong>
                <br />
                <small className="text-muted text-break">{courseData.image}</small>
              </div>
              <span className="badge bg-success ms-2">
                <i className="fas fa-check me-1"></i>
                Active
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
            ? 'Upload a new image to replace the current thumbnail. You can crop and adjust the image before uploading.'
            : 'Upload an image (JPG, PNG, GIF, or WebP - Max 5MB). You\'ll be able to crop it to 16:9 aspect ratio (1920x1080px) for the perfect thumbnail!'
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
          <div key={index} className="warning-feedback d-block">
            <i className="fas fa-exclamation-triangle me-1"></i>
            {warning}
          </div>
        ))}
        
        {/* Warning Messages */}
        {warnings.image?.map((warning, index) => (
          <div key={index} className="feedback-modern warning">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {warning}
          </div>
        ))}
      </div>
    </>
  );
};

export default ImageUpload;