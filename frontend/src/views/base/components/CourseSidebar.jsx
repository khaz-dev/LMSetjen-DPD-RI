import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import useAxios from "../../../utils/useAxios";
import UserData from "../../plugin/UserData";

const CourseSidebar = ({ 
    course, 
    isInWishlist: parentIsInWishlist, 
    isLoadingWishlist: parentIsLoadingWishlist, 
    onWishlistToggle 
}) => {
    const [activeAccordion, setActiveAccordion] = useState("");
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [localIsInWishlist, setLocalIsInWishlist] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const userData = UserData();

    // Use parent wishlist state if provided, otherwise use local state
    const isInWishlist = parentIsInWishlist !== undefined ? parentIsInWishlist : localIsInWishlist;
    const isLoadingWishlist = parentIsLoadingWishlist || loading;

    const toggleAccordion = (section) => {
        setActiveAccordion(activeAccordion === section ? "" : section);
    };

    // Check enrollment and wishlist status on component mount
    useEffect(() => {
        if (userData?.user_id && course?.id) {
            checkEnrollmentStatus();
            // Only check wishlist if not managed by parent
            if (parentIsInWishlist === undefined) {
                checkWishlistStatus();
            }
        }
    }, [userData?.user_id, course?.id, parentIsInWishlist]);

    const checkEnrollmentStatus = async () => {
        try {
            const response = await useAxios.get(`course/check-enrollment/${course.id}/${userData.user_id}/`);
            setIsEnrolled(response.data.is_enrolled);
        } catch (error) {
            console.error("Error checking enrollment:", error);
        }
    };

    const checkWishlistStatus = async () => {
        try {
            const response = await useAxios.get(`student/wishlist/${userData.user_id}/`);
            const wishlistItems = response.data;
            const isInList = wishlistItems.some(item => item.course?.id === course.id);
            setLocalIsInWishlist(isInList);
        } catch (error) {
            console.error("Error checking wishlist:", error);
        }
    };

    const handleEnrollment = async () => {
        // Check if user is logged in
        if (!userData?.user_id) {
            Swal.fire({
                icon: 'warning',
                title: 'Login Required',
                text: 'Please login to enroll in this course',
                confirmButtonText: 'Go to Login',
                confirmButtonColor: '#667eea'
            }).then((result) => {
                if (result.isConfirmed) {
                    navigate('/login');
                }
            });
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('course_id', course.id);
            formData.append('user_id', userData.user_id);

            const response = await useAxios.post('course/enroll/', formData);
            
            Swal.fire({
                icon: 'success',
                title: 'Enrollment Successful!',
                text: 'You have successfully enrolled in this course',
                confirmButtonColor: '#667eea'
            });

            setIsEnrolled(true);
            
            // Redirect to student dashboard or course player
            setTimeout(() => {
                navigate(`/student/courses/${response.data.enrollment_id}/`);
            }, 1500);

        } catch (error) {
            console.error("Enrollment error:", error);
            Swal.fire({
                icon: 'error',
                title: 'Enrollment Failed',
                text: error.response?.data?.message || 'Failed to enroll in course. Please try again.',
                confirmButtonColor: '#dc3545'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleWishlist = async () => {
        // Use parent handler if provided
        if (onWishlistToggle) {
            onWishlistToggle();
            return;
        }

        // Otherwise use local handler
        // Check if user is logged in
        if (!userData?.user_id) {
            Swal.fire({
                icon: 'warning',
                title: 'Login Required',
                text: 'Please login to add courses to your wishlist',
                confirmButtonText: 'Go to Login',
                confirmButtonColor: '#667eea'
            }).then((result) => {
                if (result.isConfirmed) {
                    navigate('/login');
                }
            });
            return;
        }

        setLoading(true);
        try {
            // Backend uses POST for both add and remove (toggle logic)
            const formData = new FormData();
            formData.append('course_id', course.id);
            formData.append('user_id', userData.user_id);

            await useAxios.post(`student/wishlist/${userData.user_id}/`, formData);
            
            if (isInWishlist) {
                // Was in wishlist, now removed
                Swal.fire({
                    icon: 'success',
                    title: 'Removed from Wishlist',
                    text: 'Course has been removed from your wishlist',
                    timer: 1500,
                    showConfirmButton: false
                });
                setLocalIsInWishlist(false);
            } else {
                // Was not in wishlist, now added
                Swal.fire({
                    icon: 'success',
                    title: 'Added to Wishlist',
                    text: 'Course has been added to your wishlist',
                    timer: 1500,
                    showConfirmButton: false
                });
                setLocalIsInWishlist(true);
            }
        } catch (error) {
            console.error("Wishlist error:", error);
            Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: error.response?.data?.message || 'Failed to update wishlist. Please try again.',
                confirmButtonColor: '#dc3545'
            });
        } finally {
            setLoading(false);
        }
    };

    // Check if user is instructor and owns this course
    const isInstructorCourse = userData?.teacher_id && course?.teacher?.id === userData.teacher_id;
    const isInstructor = userData?.teacher_id !== undefined;

    // ✅ ALL HARDCODED DATA REMOVED - Now using backend data:
    // - course.features (replaces courseFeatures)
    // - course.requirements (replaces requirements)
    // - course.learning_outcomes (replaces learningOutcomes)
    // - course.resources (replaces downloadableResources)
    // - No more courseIncludes array - can be derived from course data

    return (
        <div className="sticky-top" style={{ top: '90px' }}> {/* Match CourseTabNavigation: 70px header + 10px gap + 10px offset */}
            {/* Modern Course Preview Card */}
            <div 
                className="card border-0 shadow-lg mb-3"
                style={{ borderRadius: '15px' }}
            >
                {/* Video Preview */}
                <div className="position-relative">
                    <img 
                        src={course?.image || 'https://via.placeholder.com/400x225'}
                        alt={course?.title}
                        className="card-img-top"
                        style={{ 
                            borderRadius: '15px 15px 0 0',
                            height: '160px',
                            objectFit: 'cover'
                        }}
                    />
                    <div className="position-absolute top-50 start-50 translate-middle">
                        <button 
                            className="btn rounded-circle"
                            data-bs-toggle="modal"
                            data-bs-target="#coursePreviewModal"
                            style={{ 
                                width: '50px', 
                                height: '50px',
                                background: 'rgba(255, 255, 255, 0.9)',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                                border: 'none'
                            }}
                        >
                            <i className="fas fa-play" style={{ color: '#667eea', fontSize: '1rem' }}></i>
                        </button>
                    </div>
                    <div 
                        className="position-absolute top-0 end-0 m-2"
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                        }}
                    >
                        GRATIS
                    </div>
                </div>

                {/* Card Body */}
                <div className="card-body p-3">
                    {/* Course Price */}
                    <div className="text-center mb-3">
                        <h3 className="fw-bold mb-1 h5" style={{ color: '#2c3e50' }}>
                            Kursus Gratis
                        </h3>
                        <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
                            Untuk siapa saja terkhusus untuk pegawai Setjen DPD RI
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="d-grid gap-2 mb-3">
                        {/* Show Edit Course button if instructor owns this course */}
                        {isInstructorCourse ? (
                            <button 
                                onClick={() => navigate(`/instructor/edit-course/${course.course_id}/`)}
                                className="btn"
                                style={{
                                    background: 'linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <i className="fas fa-edit me-2"></i>
                                Edit Kursus
                            </button>
                        ) : isEnrolled ? (
                            /* Show Continue Learning if already enrolled */
                            <button 
                                onClick={() => navigate('/student/courses/')}
                                className="btn"
                                style={{
                                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <i className="fas fa-play me-2"></i>
                                Lanjutkan Belajar
                            </button>
                        ) : (
                            /* Show Enroll button */
                            <button 
                                onClick={handleEnrollment}
                                disabled={loading}
                                className="btn"
                                style={{
                                    background: loading ? '#cccccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.9rem',
                                    cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin me-2"></i>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-play me-2"></i>
                                        Mulai Belajar Gratis
                                    </>
                                )}
                            </button>
                        )}
                        
                        {/* Hide wishlist button for instructors */}
                        {!isInstructor && (
                            <button 
                                onClick={handleWishlist}
                                disabled={isLoadingWishlist}
                                className="btn"
                                style={{
                                    background: isInWishlist ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)' : 'transparent',
                                    color: isInWishlist ? 'white' : '#667eea',
                                    border: isInWishlist ? 'none' : '2px solid #667eea',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.9rem',
                                    cursor: isLoadingWishlist ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                {isLoadingWishlist ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin me-2"></i>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <i className={`${isInWishlist ? 'fas fa-heart-broken' : 'far fa-heart'} me-2`}></i>
                                        {isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
                                    </>
                                )}
                            </button>
                        )}
                        
                        <button 
                            className="btn"
                            onClick={() => {
                                if (navigator.share) {
                                    navigator.share({
                                        title: course?.title,
                                        text: course?.description,
                                        url: window.location.href
                                    });
                                } else {
                                    // Fallback: copy to clipboard
                                    navigator.clipboard.writeText(window.location.href);
                                    Swal.fire({
                                        icon: 'success',
                                        title: 'Link Copied!',
                                        text: 'Course link has been copied to clipboard',
                                        timer: 1500,
                                        showConfirmButton: false
                                    });
                                }
                            }}
                            style={{
                                background: 'transparent',
                                color: '#28a745',
                                border: '2px solid #28a745',
                                borderRadius: '12px',
                                fontWeight: '600',
                                padding: '0.6rem 1rem',
                                fontSize: '0.9rem'
                            }}
                        >
                            <i className="fas fa-share me-2"></i>
                            Bagikan Kursus
                        </button>
                    </div>
                </div>
            </div>

            {/* Modern Course Includes */}
            <div 
                className="card border-0 shadow-sm mb-3"
                style={{ borderRadius: '15px' }}
            >
                <div className="card-body p-3">
                    <div className="d-flex align-items-center mb-3">
                        <div 
                            className="me-2"
                            style={{
                                width: '35px',
                                height: '35px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <i className="fas fa-gift text-white" style={{ fontSize: '0.9rem' }}></i>
                        </div>
                        <h5 className="mb-0 fw-bold" style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                            Kursus Ini Termasuk
                        </h5>
                    </div>
                    
                    {course?.features && course.features.length > 0 ? (
                        course.features.map((item, index) => (
                            <div 
                                key={item.id || index} 
                                className="d-flex align-items-center py-2"
                            >
                                <i 
                                    className={`${item.icon} me-3`} 
                                    style={{ 
                                        width: '20px',
                                        color: item.highlight ? '#667eea' : '#6c757d'
                                    }}
                                ></i>
                                <span 
                                    className={`small ${item.highlight ? 'fw-semibold' : ''}`}
                                    style={{ 
                                        color: item.highlight ? '#667eea' : '#6c757d'
                                    }}
                                >
                                    {item.text}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted small">Tidak ada fitur yang tersedia</p>
                    )}
                </div>
            </div>

            {/* Modern Requirements Card */}
            <div 
                className="card border-0 shadow-sm mb-4"
                style={{ borderRadius: '20px' }}
            >
                <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-4">
                        <div 
                            className="me-3"
                            style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <i className="fas fa-list-check text-white"></i>
                        </div>
                        <h5 className="mb-0 fw-bold" style={{ color: '#2c3e50' }}>
                            Persyaratan
                        </h5>
                    </div>
                    
                    {course?.requirements && course.requirements.length > 0 ? (
                        course.requirements.map((item, index) => (
                            <div key={item.id || index} className="d-flex align-items-start py-2">
                                <div 
                                    className="me-3 mt-1"
                                    style={{
                                        width: '16px',
                                        height: '16px',
                                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    <i className="fas fa-check text-white" style={{ fontSize: '0.6rem' }}></i>
                                </div>
                                <span className="small text-muted">{item.requirement}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted small">Tidak ada persyaratan khusus</p>
                    )}
                </div>
            </div>

            {/* Modern Learning Outcomes Card */}
            <div 
                className="card border-0 shadow-sm"
                style={{ borderRadius: '20px' }}
            >
                <div className="card-body p-4">
                    <div className="d-flex align-items-center mb-4">
                        <div 
                            className="me-3"
                            style={{
                                width: '40px',
                                height: '40px',
                                background: 'linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <i className="fas fa-graduation-cap text-white"></i>
                        </div>
                        <h5 className="mb-0 fw-bold" style={{ color: '#2c3e50' }}>
                            Hasil Pembelajaran
                        </h5>
                    </div>
                    
                    {course?.learning_outcomes && course.learning_outcomes.length > 0 ? (
                        <>
                            {course.learning_outcomes.slice(0, 5).map((item, index) => (
                                <div key={item.id || index} className="d-flex align-items-start py-2">
                                    <div 
                                        className="me-3 mt-1"
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            background: 'linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                    >
                                        <i className="fas fa-star text-white" style={{ fontSize: '0.6rem' }}></i>
                                    </div>
                                    <span className="small text-muted">{item.outcome}</span>
                                </div>
                            ))}
                            
                            {course.learning_outcomes.length > 5 && (
                                <div className="mt-3">
                                    <button 
                                        className="btn btn-sm"
                                        style={{
                                            background: 'transparent',
                                            color: '#667eea',
                                            border: '1px solid #667eea',
                                            borderRadius: '10px',
                                            fontWeight: '500',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        Lihat Semua ({course.learning_outcomes.length} item)
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-muted small">Tidak ada hasil pembelajaran yang tersedia</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CourseSidebar;