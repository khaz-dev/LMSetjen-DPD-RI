import React from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import "./ProfilePictureCropModal.css";

/**
 * Reusable Profile Picture Crop Modal Component
 * Used by both Student and Instructor profile pages
 * 
 * @param {Object} props
 * @param {boolean} props.show - Controls modal visibility
 * @param {string} props.imageSrc - Source URL of the image to crop
 * @param {Object} props.crop - Current crop configuration
 * @param {Object} props.completedCrop - Completed crop configuration
 * @param {Function} props.onCropChange - Callback when crop changes
 * @param {Function} props.onCropComplete - Callback when crop is completed
 * @param {Function} props.onApplyCrop - Callback when user applies the crop
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {React.RefObject} props.imgRef - Reference to the image element
 * @param {Function} props.onImageLoad - Callback when image loads
 * @param {string} props.variant - Theme variant: 'student' (purple) or 'instructor' (blue)
 */
const ProfilePictureCropModal = ({
    show,
    imageSrc,
    crop,
    completedCrop,
    onCropChange,
    onCropComplete,
    onApplyCrop,
    onCancel,
    imgRef,
    onImageLoad,
    variant = "student" // Default to student theme
}) => {
    // Don't render if not shown or no image
    if (!show || !imageSrc) {
        return null;
    }

    // Determine which button class to use based on variant
    const buttonClass = variant === "instructor" ? "crop-buttons-instructor" : "crop-buttons-student";
    const themeClass = variant === "instructor" ? "crop-modal-instructor" : "crop-modal-student";

    return (
        <div className={`crop-modal ${themeClass}`} onClick={onCancel}>
            <div className="crop-container" onClick={(e) => e.stopPropagation()}>
                <h4 className="crop-title">
                    <i className="fas fa-crop-alt crop-title-icon"></i>
                    Crop Your Profile Picture
                </h4>
                <p className="crop-description">
                    Drag to reposition, resize corners to adjust the crop area. The circular preview shows how your profile picture will look.
                </p>
                
                <div className="crop-image-container">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => {
                            if (c.width && c.height) {
                                onCropChange(c);
                            }
                        }}
                        onComplete={(c) => {
                            if (c.width && c.height) {
                                onCropComplete(c);
                            }
                        }}
                        aspect={1}
                        circularCrop
                        minWidth={50}
                        minHeight={50}
                        keepSelection
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Crop preview"
                            className="crop-image"
                            onLoad={onImageLoad}
                        />
                    </ReactCrop>
                </div>

                <div className="crop-footer-row">
                    <div className="crop-info-text">
                        <small>
                            <i className="fas fa-info-circle me-1"></i>
                            Tip: Drag the circle to move, drag corners to resize. You can move the crop area anywhere on the image.
                        </small>
                    </div>
                    
                    <div className={buttonClass}>
                        <div style={{ display: "flex", gap: "1rem" }}>
                            <button 
                                type="button"
                                className="btn btn-crop-cancel"
                                onClick={onCancel}
                            >
                                <i className="fas fa-times me-2"></i>
                                Cancel
                            </button>
                            <button 
                                type="button"
                                className="btn btn-modern"
                                onClick={onApplyCrop}
                                disabled={!completedCrop || !completedCrop.width || !completedCrop.height}
                            >
                                <i className="fas fa-check me-2"></i>
                                Apply Crop
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePictureCropModal;
