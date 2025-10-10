import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { validateFileType } from "../../../utils/courseValidation";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";

// Separate CropModal component for portal rendering
const CropModal = ({ 
  modalVisible, 
  handleCloseCrop, 
  imageSrc, 
  crop, 
  setCrop, 
  completedCrop, 
  setCompletedCrop, 
  imgRef, 
  previewCanvasRef, 
  handleCropComplete, 
  isLoading, 
  cropError, 
  imageLoadError,
  aspect = 16 / 9 
}) => (
  <div className={`crop-modal-backdrop ${modalVisible ? 'show' : ''}`}>
    <div className="crop-modal-dialog">
      {/* Enhanced Modal Header */}
      <div className="crop-modal-header">
        <h5 className="crop-modal-title">
          <i className="fas fa-crop me-2"></i>
          Crop Your Course Thumbnail
        </h5>
        <button 
          type="button" 
          className="crop-modal-close" 
          onClick={handleCloseCrop}
          disabled={isLoading}
          aria-label="Close modal"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Modal Body */}
      <div className="crop-modal-body">
        {/* Error States */}
        {cropError && (
          <div className="alert alert-danger crop-error-alert" role="alert">
            <i className="fas fa-exclamation-triangle me-2"></i>
            <strong>Crop Error:</strong> {cropError}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => {}} 
              aria-label="Close error"
            ></button>
          </div>
        )}

        {imageLoadError && (
          <div className="alert alert-warning crop-error-alert" role="alert">
            <i className="fas fa-exclamation-circle me-2"></i>
            <strong>Image Load Error:</strong> {imageLoadError}
            <div className="mt-2">
              <small>Try uploading a different image or check your internet connection.</small>
            </div>
          </div>
        )}
        
        {/* Aspect Ratio Badge */}
        <div className="crop-aspect-badge">
          16:9 Aspect Ratio
        </div>
        
        {/* Enhanced Crop Container */}
        <div className="crop-container">
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="crop-loading-overlay">
              <div className="crop-spinner"></div>
              <div className="mt-3 text-center">
                <strong>Processing your thumbnail...</strong>
                <br />
                <small>Cropping and optimizing image quality</small>
              </div>
            </div>
          )}
          
          {imageSrc && !imageLoadError && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              minWidth={100}
              minHeight={56}
              circularCrop={false}
              ruleOfThirds={true}
              className="enhanced-react-crop"
            >
              <img
                ref={imgRef}
                alt="Crop preview"
                src={imageSrc}
                className="crop-preview-image"
                onLoad={(e) => {
                  const { width, height } = e.currentTarget;
                  const crop = centerCrop(
                    makeAspectCrop(
                      {
                        unit: '%',
                        width: 90,
                      },
                      aspect,
                      width,
                      height,
                    ),
                    width,
                    height,
                  );
                  setCrop(crop);
                }}
                onError={() => {
                  // Handle image load error
                }}
              />
            </ReactCrop>
          )}
        </div>

        {/* Enhanced Instructions */}
        {!imageLoadError && (
          <div className="crop-instructions">
            <small>
              <i className="fas fa-hand-pointer me-1"></i>
              <strong>How to crop:</strong> Drag corners to resize • Drag center to move • Use handles for precise control
              <br />
              <i className="fas fa-magic me-1"></i>
              <strong>Pro tip:</strong> Follow the rule of thirds for the most appealing thumbnail composition
            </small>
          </div>
        )}

        {/* Live Preview of Cropped Result */}
        {completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && (
          <div className="crop-preview-section mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h6 className="mb-0">
                <i className="fas fa-eye me-2"></i>
                Live Preview (1920x1080)
              </h6>
              <span className="badge bg-info">
                16:9 Aspect Ratio
              </span>
            </div>
            <div className="crop-preview-result">
              <canvas
                ref={previewCanvasRef}
                className="crop-result-canvas"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  backgroundColor: '#000'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal Footer */}
      <div className="crop-modal-footer">
        <button 
          type="button" 
          className="btn btn-secondary" 
          onClick={handleCloseCrop}
          disabled={isLoading}
        >
          <i className="fas fa-times me-1"></i>Cancel
        </button>
        <button 
          type="button" 
          className="btn btn-success" 
          onClick={handleCropComplete}
          disabled={isLoading || imageLoadError || !crop?.width || !crop?.height}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Processing...
            </>
          ) : (
            <>
              <i className="fas fa-check me-1"></i>Crop & Save
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [cropError, setCropError] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);

  // Generate live preview of crop
  useEffect(() => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current) {
      return;
    }

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const crop = completedCrop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas to exact output size
    canvas.width = 1920;
    canvas.height = 1080;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fill with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the cropped image
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [completedCrop]);

  // Effect to manage modal visibility and prevent body scroll
  useEffect(() => {
    if (showCropModal) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      // Add smooth animation delay
      const timer = setTimeout(() => setModalVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'unset';
      setModalVisible(false);
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCropModal]);

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
      setCropError(null);
      setImageLoadError(false);
      setShowCropModal(true);
    });
    reader.readAsDataURL(file);
    
    // Clear input
    event.target.value = '';
  };

  const getCroppedImg = (image, pixelCrop, fileName) => {
    // pixelCrop contains x, y, width, height in pixels relative to the displayed image
    if (!pixelCrop || !image) {
      return Promise.reject(new Error('Invalid crop or image'));
    }

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Calculate the actual crop dimensions in the source image
    const sourceX = pixelCrop.x * scaleX;
    const sourceY = pixelCrop.y * scaleY;
    const sourceWidth = pixelCrop.width * scaleX;
    const sourceHeight = pixelCrop.height * scaleY;
    
    // Set canvas size to match desired output (1920x1080 for 16:9)
    const targetWidth = 1920;
    const targetHeight = 1080;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    const ctx = canvas.getContext('2d');
    
    // Enable high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Fill with black background for letterboxing if needed
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Draw the cropped portion of the image
    ctx.drawImage(
      image,
      sourceX,        // Source x
      sourceY,        // Source y
      sourceWidth,    // Source width
      sourceHeight,   // Source height
      0,              // Destination x
      0,              // Destination y
      targetWidth,    // Destination width
      targetHeight    // Destination height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          blob.name = fileName;
          // Also return the canvas data URL for immediate preview
          const previewUrl = canvas.toDataURL('image/jpeg', 0.95);
          resolve({ blob, previewUrl });
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const handleCropComplete = async () => {
    if (!completedCrop || !imgRef.current) {
      setCropError("Please select an area to crop by dragging the corners of the selection area.");
      Toast().fire({
        icon: "error",
        title: "No Crop Selected",
        text: "Please select an area to crop",
      });
      return;
    }

    if (completedCrop.width < 100 || completedCrop.height < 56) {
      setCropError("Crop area is too small. Please select a larger area for better thumbnail quality.");
      return;
    }

    setLoading(true);
    setCropError(null);

    try {
      const { blob: croppedBlob, previewUrl } = await getCroppedImg(
        imgRef.current,
        completedCrop,
        selectedFile.name
      );

      // Show immediate preview of the cropped image
      setImagePreview(previewUrl);

      const formData = new FormData();
      formData.append("file", croppedBlob, selectedFile.name);

      const response = await useAxios.post("/file-upload/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response?.data?.url) {
        // Update with the uploaded URL (keep the preview until upload completes)
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

        // Close modal with smooth animation
        handleCancelCrop();
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      setCropError(
        error.response?.data?.message || 
        "Failed to upload cropped image. Please check your connection and try again."
      );
      Toast().fire({
        icon: "error",
        title: "Upload Failed",
        text: error.response?.data?.message || "Failed to upload image. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCrop = () => {
    // Smooth close animation
    setModalVisible(false);
    setTimeout(() => {
      setShowCropModal(false);
      setImageSrc(null);
      setSelectedFile(null);
      setCompletedCrop(null);
      setCropError(null);
      setImageLoadError(false);
    }, 300); // Match CSS transition duration
  };

  const aspect = 16 / 9;

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
      {/* Portal-based Crop Modal */}
      {showCropModal && createPortal(
        <CropModal 
          modalVisible={modalVisible}
          handleCloseCrop={handleCancelCrop}
          imageSrc={imageSrc}
          crop={crop}
          setCrop={setCrop}
          completedCrop={completedCrop}
          setCompletedCrop={setCompletedCrop}
          imgRef={imgRef}
          previewCanvasRef={previewCanvasRef}
          handleCropComplete={handleCropComplete}
          isLoading={loading}
          cropError={cropError}
          imageLoadError={imageLoadError}
          aspect={aspect}
        />, 
        document.body
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
                          <i className="fas fa-crop me-1"></i>
                          Cropped (16:9)
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
                      <i className="fas fa-crop me-1"></i>
                      {imagePreview ? 'Cropped (16:9)' : 'Uploaded'}
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