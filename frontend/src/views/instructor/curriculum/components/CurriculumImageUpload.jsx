import { useState } from "react";
import useAxios from "../../../../utils/useAxios";
import Toast from "../../../plugin/Toast";

const CurriculumImageUpload = ({ 
    imagePreview, 
    setImagePreview, 
    courseData, 
    setCourseData, 
    errors, 
    warnings, 
    validateField,
    loading,
    setLoading 
}) => {
    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        
        if (!file) return;

        // Validate file type and size
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            Toast().fire({
                icon: "error",
                title: "Jenis File Tidak Valid",
                text: "Silakan unggah file gambar yang valid (JPEG, PNG, GIF, atau WebP)",
            });
            event.target.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            Toast().fire({
                icon: "error",
                title: "File Terlalu Besar",
                text: "Silakan unggah gambar dengan ukuran lebih kecil dari 5MB",
            });
            event.target.value = '';
            return;
        }

        setImagePreview(null);
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await useAxios.post("/file-upload/", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            if (response?.data?.url) {
                setImagePreview(response.data.url);
                setCourseData({
                    ...courseData,
                    image: response.data.url,
                });
                validateField && validateField('image', response.data.url);
                
                Toast().fire({
                    icon: "success",
                    title: "Gambar Diunggah",
                    text: "Thumbnail kursus berhasil diperbarui!",
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
        }
    };

    const getInputClass = () => {
        const baseClass = "form-control";
        if (errors?.image?.length > 0) {
            return `${baseClass} is-invalid`;
        }
        if (warnings?.image?.length > 0) {
            return `${baseClass} is-warning`;
        }
        if (courseData?.image) {
            return `${baseClass} is-valid`;
        }
        return baseClass;
    };

    return (
        <>
            <label htmlFor="courseThumbnail" className="form-label">
                Thumbnail Preview
            </label>
            
            {/* Image Preview Section */}
            <div className="mb-4 position-relative">
                {loading ? (
                    <div 
                        className="d-flex align-items-center justify-content-center"
                        style={{
                            width: "100%",
                            height: "330px",
                            backgroundColor: "#f8f9fa",
                            borderRadius: "10px",
                            border: "2px dashed #dee2e6"
                        }}
                    >
                        <div className="text-center">
                            <div className="spinner-border text-primary mb-2" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="text-muted mb-0">Uploading image...</p>
                        </div>
                    </div>
                ) : (
                    <img
                        style={{
                            width: "100%",
                            height: "330px",
                            objectFit: "cover",
                            borderRadius: "10px",
                            border: errors?.image?.length > 0 ? "2px solid #dc3545" : 
                                   warnings?.image?.length > 0 ? "2px solid #ffc107" : 
                                   courseData?.image ? "2px solid #198754" : "2px solid #dee2e6"
                        }}
                        className="mb-4"
                        src={imagePreview || "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png"}
                        alt="Course Thumbnail"
                        onError={(e) => {
                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                        }}
                    />
                )}
            </div>

            <div className="mb-3">
                <label htmlFor="courseThumbnail" className="form-label">
                    Course Thumbnail
                    {warnings?.image?.length > 0 && <span className="text-warning">*</span>}
                </label>
                <input 
                    id="courseThumbnail" 
                    className={getInputClass()}
                    type="file" 
                    name="image" 
                    onChange={handleImageUpload}
                    accept="image/*"
                    disabled={loading}
                />
                <small className="text-muted">Upload a course thumbnail image (JPG, PNG, GIF, or WebP - Max 5MB)</small>
                
                {/* Error Messages */}
                {errors?.image?.map((error, index) => (
                    <div key={index} className="invalid-feedback d-block">
                        <i className="fas fa-exclamation-circle me-1"></i>
                        {error}
                    </div>
                ))}
                
                {/* Warning Messages */}
                {warnings?.image?.map((warning, index) => (
                    <div key={index} className="text-warning d-block">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {warning}
                    </div>
                ))}
            </div>
        </>
    );
};

export default CurriculumImageUpload;