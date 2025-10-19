import React, { forwardRef, lazy, Suspense } from "react";

// Lazy load CKEditor (1.24 MB)
const CKEditor = lazy(() => import("@ckeditor/ckeditor5-react").then(m => ({ default: m.CKEditor })));
const ClassicEditor = lazy(() => import("@ckeditor/ckeditor5-build-classic"));

const CurriculumBasicInfo = forwardRef(({ 
    courseData, 
    setCourseData, 
    categories,
    errors, 
    warnings, 
    validateField,
    getValidationClass,
    getSelectValidationClass
}, refs) => {
    
    const handleInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        const newValue = type === "checkbox" ? checked : value;
        
        setCourseData({
            ...courseData,
            [name]: newValue,
        });
        
        validateField && validateField(name, newValue);
    };

    const handleDescriptionChange = (event, editor) => {
        const data = editor.getData();
        setCourseData({
            ...courseData,
            description: data,
        });
        
        validateField && validateField('description', data);
    };

    const getCharacterCount = (text) => {
        return text ? text.replace(/<[^>]*>/g, '').length : 0;
    };

    const getEditorClass = () => {
        if (errors?.description?.length > 0) return "border border-danger rounded";
        if (warnings?.description?.length > 0) return "border border-warning rounded";
        if (courseData?.description) return "border border-success rounded";
        return "";
    };

    return (
        <>
            {/* Course Title */}
            <div className="mb-3">
                <label htmlFor="courseTitle" className="form-label">
                    Title
                    <span className="text-danger">*</span>
                    {warnings?.title?.length > 0 && <span className="text-warning">*</span>}
                </label>
                <input 
                    ref={refs?.titleRef}
                    id="courseTitle" 
                    className={getValidationClass ? getValidationClass('title', errors, warnings, courseData) : "form-control"}
                    type="text" 
                    placeholder="Enter course title" 
                    name="title" 
                    value={courseData?.title || ''} 
                    onChange={handleInputChange} 
                />
                <small className="text-muted">
                    Write a compelling course title (60 characters recommended)
                    {courseData?.title && (
                        <span className="float-end">
                            {courseData.title.length}/60
                        </span>
                    )}
                </small>
                
                {/* Error Messages */}
                {errors?.title?.map((error, index) => (
                    <div key={index} className="invalid-feedback d-block">
                        <i className="fas fa-exclamation-circle me-1"></i>
                        {error}
                    </div>
                ))}
                
                {/* Warning Messages */}
                {warnings?.title?.map((warning, index) => (
                    <div key={index} className="text-warning d-block">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {warning}
                    </div>
                ))}
            </div>

            {/* Course Category */}
            <div className="mb-3">
                <label className="form-label">
                    Course Category
                    <span className="text-danger">*</span>
                </label>
                <select 
                    ref={refs?.categoryRef}
                    className={getSelectValidationClass ? getSelectValidationClass('category', errors, warnings, courseData) : "form-select"}
                    name="category" 
                    value={courseData?.category?.id || courseData?.category || ''} 
                    onChange={handleInputChange}
                >
                    <option value="">Select a category</option>
                    {categories?.map((c, index) => (
                        <option key={c.id || index} value={c.id}>
                            {c.title}
                        </option>
                    ))}
                </select>
                <small className="text-muted">
                    Help people find your courses by choosing categories that represent your course.
                </small>
                
                {/* Error Messages */}
                {errors?.category?.map((error, index) => (
                    <div key={index} className="invalid-feedback d-block">
                        <i className="fas fa-exclamation-circle me-1"></i>
                        {error}
                    </div>
                ))}
                
                {/* Warning Messages */}
                {warnings?.category?.map((warning, index) => (
                    <div key={index} className="text-warning d-block">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {warning}
                    </div>
                ))}
            </div>

            {/* Course Level */}
            <div className="mb-3">
                <label className="form-label">
                    Level
                    {warnings?.level?.length > 0 && <span className="text-warning">*</span>}
                </label>
                <select 
                    ref={refs?.levelRef}
                    className={getSelectValidationClass ? getSelectValidationClass('level', errors, warnings, courseData) : "form-select"}
                    onChange={handleInputChange} 
                    value={courseData?.level || ''} 
                    name="level"
                >
                    <option value="">Select level</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                </select>
                <small className="text-muted">
                    Choose the appropriate difficulty level for your course.
                </small>
                
                {/* Warning Messages */}
                {warnings?.level?.map((warning, index) => (
                    <div key={index} className="text-warning d-block">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {warning}
                    </div>
                ))}
            </div>

            {/* Course Description */}
            <div className="mb-3">
                <label className="form-label">
                    Course Description
                    <span className="text-danger">*</span>
                    {warnings?.description?.length > 0 && <span className="text-warning">*</span>}
                </label>
                
                <div className={getEditorClass()}>
                    <Suspense fallback={
                        <div className="text-center py-4">
                            <div className="spinner-border text-primary spinner-border-sm" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <span className="ms-2 text-muted">Loading content editor...</span>
                        </div>
                    }>
                        <CKEditor
                            editor={ClassicEditor}
                            data={courseData?.description || ''}
                            onChange={handleDescriptionChange}
                            config={{
                                toolbar: [
                                    "heading",
                                    "|",
                                    "bold", "italic",
                                    "|", 
                                    "bulletedList", "numberedList",
                                    "|",
                                    "link", "blockQuote",
                                    "|",
                                    "undo", "redo"
                                ],
                                placeholder: "Write a brief summary of your course..."
                            }}
                        />
                    </Suspense>
                </div>
                
                {/* Character count */}
                <div className="d-flex justify-content-between align-items-center mt-1">
                    <small className="text-muted">A brief summary of your course content and learning objectives.</small>
                    <small className="text-muted">
                        {getCharacterCount(courseData?.description)} characters
                    </small>
                </div>
                
                {/* Error Messages */}
                {errors?.description?.map((error, index) => (
                    <div key={index} className="text-danger d-block mt-1">
                        <i className="fas fa-exclamation-circle me-1"></i>
                        {error}
                    </div>
                ))}
                
                {/* Warning Messages */}
                {warnings?.description?.map((warning, index) => (
                    <div key={index} className="text-warning d-block mt-1">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        {warning}
                    </div>
                ))}
            </div>
        </>
    );
});

CurriculumBasicInfo.displayName = "CurriculumBasicInfo";

export default CurriculumBasicInfo;