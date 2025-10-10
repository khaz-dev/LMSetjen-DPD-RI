import { useState } from "react";
import { validateFileType } from "../../../utils/courseValidation";
import useAxios from "../../../utils/useAxios";
import Toast from "../../plugin/Toast";

const VideoUpload = ({ courseData, setCourseData }) => {
  const [fileLoading, setFileLoading] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Validate video file
    const validation = validateFileType(file, 'video');
    if (!validation.isValid) {
      Toast().fire({
        icon: "error",
        title: "Invalid File",
        text: validation.error,
      });
      event.target.value = '';
      return;
    }

    setFileLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await useAxios.post("/file-upload/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response?.data?.url) {
        setCourseData(prevData => ({
          ...prevData,
          file: response.data.url,
        }));
        
        Toast().fire({
          icon: "success",
          title: "Video Uploaded",
          text: "Intro video uploaded successfully!",
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error("Error uploading course intro:", error);
      Toast().fire({
        icon: "error",
        title: "Upload Failed",
        text: error.response?.data?.message || "Failed to upload video. Please try again.",
      });
    } finally {
      setFileLoading(false);
    }
  };

  return (
    <div className="video-upload-container">
      <label htmlFor="courseVideo" className="form-label">
        <i className="fas fa-video me-2"></i>
        Course Intro Video
        <span className="text-muted ms-1">(Optional)</span>
      </label>
      
      {/* Video Thumbnail - Show at top when video exists */}
      {courseData.file && !fileLoading && (
        <div className="video-preview mb-3" style={{ height: '350px' }}>
          <video 
            src={courseData.file} 
            className="video-thumbnail"
            controls
            preload="metadata"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              border: '3px solid #28a745',
              backgroundColor: '#000'
            }}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

            {/* Current Value Display */}
      {courseData.file && (
        <div className="current-value-display mb-3 p-3 bg-light border rounded">
          <div className="d-flex align-items-center">
            <i className="fas fa-video text-primary me-2"></i>
            <div className="flex-grow-1">
              <strong className="text-dark">Current Video File:</strong>
              <br />
              <small className="text-muted text-break">{courseData.file}</small>
            </div>
            <span className="badge bg-success ms-2">
              <i className="fas fa-play me-1"></i>
              Active
            </span>
          </div>
        </div>
      )}
      
      <div className={`file-upload-area ${fileLoading ? 'uploading' : ''} ${courseData.file ? 'has-file' : ''}`}
           style={{ minHeight: courseData.file ? '40px' : '50px' }}>
        <input 
          id="courseVideo" 
          className="file-input"
          type="file" 
          name="file" 
          onChange={handleFileUpload}
          accept="video/*"
          disabled={fileLoading}
          style={{ display: 'none' }}
        />
        
        <div className="upload-content" style={{ padding: courseData.file ? '0.5rem' : '0.75rem' }}>
          {fileLoading ? (
            <div className="upload-loading text-center">
              <div 
                className="spinner-border spinner-border-sm text-primary mb-1" 
                role="status"
                style={{ 
                  width: '1.5rem', 
                  height: '1.5rem',
                  flexShrink: 0,
                  borderWidth: '0.2em'
                }}
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="small mb-0">Uploading Video...</p>
            </div>
          ) : courseData.file ? (
            <div className="upload-success text-center">
              <p className="text-success small mb-1">
                <i className="fas fa-check-circle me-1"></i>
                Video is Active - Ready for Course Update
              </p>
              <div className="file-actions">
                <label htmlFor="courseVideo" className="btn btn-outline-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                  <i className="fas fa-sync-alt me-1"></i>
                  Replace Video
                </label>
              </div>
            </div>
          ) : (
            <div className="upload-prompt text-center">
              <div className="upload-icon mb-1">
                <i className="fas fa-cloud-upload-alt" style={{ fontSize: '1.2rem' }}></i>
              </div>
              <p className="small mb-1">Upload Course Intro Video</p>
              <label htmlFor="courseVideo" className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                <i className="fas fa-plus me-1"></i>
                Choose Video File
              </label>
            </div>
          )}
        </div>
      </div>
      
      <div className="file-help">
        <small className="text-muted">
          <i className="fas fa-info-circle me-1"></i>
          Supported formats: MP4, WebM, MOV • Maximum size: 100MB
        </small>
      </div>
    </div>
  );
};

export default VideoUpload;