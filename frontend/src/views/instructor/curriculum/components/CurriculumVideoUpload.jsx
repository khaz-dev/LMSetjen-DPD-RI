import { useState } from "react";
import useAxios from "../../../../utils/useAxios";
import Toast from "../../../plugin/Toast";

const CurriculumVideoUpload = ({ 
    courseData, 
    setCourseData, 
    errors, 
    warnings, 
    validateField,
    fileLoading,
    setFileLoading 
}) => {
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        
        if (!file) return;

        // Validate file type and size
        const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
        if (!validTypes.includes(file.type)) {
            Toast().fire({
                icon: "error",
                title: "Invalid File Type",
                text: "Please upload a valid video file (MP4, AVI, MOV, or WMV)",
            });
            event.target.value = '';
            return;
        }

        if (file.size > 100 * 1024 * 1024) { // 100MB
            Toast().fire({
                icon: "error",
                title: "File Too Large",
                text: "Please upload a video smaller than 100MB",
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
                setCourseData({
                    ...courseData,
                    file: response.data.url,
                });
                validateField && validateField('file', response.data.url);
                
                Toast().fire({
                    icon: "success",
                    title: "Video Uploaded",
                    text: "Course intro video uploaded successfully!",
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            console.error("Error uploading video:", error);
            Toast().fire({
                icon: "error",
                title: "Upload Failed",
                text: error.response?.data?.message || "Failed to upload video. Please try again.",
            });
        } finally {
            setFileLoading(false);
        }
    };

    const getInputClass = () => {
        const baseClass = "form-control";
        if (errors?.file?.length > 0) {
            return `${baseClass} is-invalid`;
        }
        if (warnings?.file?.length > 0) {
            return `${baseClass} is-warning`;
        }
        if (courseData?.file) {
            return `${baseClass} is-valid`;
        }
        return baseClass;
    };

    return (
        <div className="mb-3">
            <label htmlFor="introvideo" className="form-label">
                Intro Video
                {warnings?.file?.length > 0 && <span className="text-warning">*</span>}
            </label>
            
            <input 
                id="introvideo" 
                className={getInputClass()}
                type="file" 
                name="file" 
                onChange={handleFileUpload}
                accept="video/*"
                disabled={fileLoading}
            />
            
            <small className="text-muted">
                Upload an intro video for your course (MP4, AVI, MOV, or WMV - Max 100MB)
            </small>

            {/* Current file display */}
            {courseData?.file && (
                <div className="mt-2 p-2 bg-light rounded">
                    <div className="d-flex align-items-center">
                        <i className="fas fa-video text-success me-2"></i>
                        <small className="text-success me-2">Video uploaded successfully</small>
                        <a 
                            target="_blank" 
                            rel="noopener noreferrer"
                            href={courseData.file}
                            className="btn btn-sm btn-outline-primary"
                        >
                            <i className="fas fa-external-link-alt me-1"></i>
                            Preview Video
                        </a>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {fileLoading && (
                <div className="mt-2 p-2 bg-light rounded">
                    <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <small className="text-muted">Uploading video...</small>
                    </div>
                </div>
            )}
            
            {/* Error Messages */}
            {errors?.file?.map((error, index) => (
                <div key={index} className="invalid-feedback d-block">
                    <i className="fas fa-exclamation-circle me-1"></i>
                    {error}
                </div>
            ))}
            
            {/* Warning Messages */}
            {warnings?.file?.map((warning, index) => (
                <div key={index} className="text-warning d-block">
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    {warning}
                </div>
            ))}
        </div>
    );
};

export default CurriculumVideoUpload;