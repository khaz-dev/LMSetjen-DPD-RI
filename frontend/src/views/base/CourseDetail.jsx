import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

// Import enhanced components
import CourseHero from "./components/CourseHero";
import CourseTabNavigation from "./components/CourseTabNavigation";
import CourseInstructor from "./components/CourseInstructor";
import CourseReviews from "./components/CourseReviews";
import CourseStatistics from "./components/CourseStatistics";
import CourseSidebar from "./components/CourseSidebar";
import CourseFAQ from "./components/CourseFAQ";
import CourseDetailLoading from "./components/CourseDetailLoading";

// Import hooks and utilities
import { useCourse } from "./hooks/useCourse";
import { calculateTotalDuration } from "../../utils/durationUtils";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";

import "./CourseDetail.css";

function CourseDetail() {
    const { slug } = useParams();
    const [activeTab, setActiveTab] = useState("overview");
    const videoRef = React.useRef(null);
    const [previewVideo, setPreviewVideo] = useState(null);
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [isLoadingWishlist, setIsLoadingWishlist] = useState(false);
    const userData = UserData();
    const isTeacher = userData?.role === 'teacher' || userData?.role === 'instructor';
    
    // Fetch course data from backend
    const { course, isLoading } = useCourse(slug);

    // Check wishlist status on component mount (skip for teachers)
    useEffect(() => {
        if (course?.id && !isTeacher) {
            checkWishlistStatus();
        }
    }, [course?.id, isTeacher]);

    const checkWishlistStatus = async () => {
        const userData = UserData();
        if (!userData || isTeacher) return;
        
        try {
            const response = await useAxios.get(`student/wishlist/${userData.user_id}/`);
            const wishlistItems = response.data;
            const isInList = wishlistItems.some(item => item.course?.id === course.id);
            setIsInWishlist(isInList);
        } catch (error) {
            console.error("Error checking wishlist:", error);
        }
    };

    const handleWishlist = async () => {
        const userData = UserData();
        
        if (!userData) {
            Swal.fire({
                icon: 'warning',
                title: 'Login Required',
                text: 'Please login to add courses to your wishlist',
                confirmButtonColor: '#667eea'
            });
            return;
        }

        setIsLoadingWishlist(true);
        
        try {
            // Backend uses POST for both add and remove (toggle logic)
            const formData = new FormData();
            formData.append('course_id', course.id);
            formData.append('user_id', userData.user_id);
            
            const response = await useAxios.post(`student/wishlist/${userData.user_id}/`, formData);
            
            if (isInWishlist) {
                // Was in wishlist, now removed
                Toast().fire({
                    icon: 'success',
                    title: 'Removed from Wishlist',
                    text: 'Course has been removed from your wishlist',
                });
                setIsInWishlist(false);
            } else {
                // Was not in wishlist, now added
                Toast().fire({
                    icon: 'success',
                    title: 'Added to Wishlist',
                    text: 'Course has been added to your wishlist',
                });
                setIsInWishlist(true);
            }
        } catch (error) {
            console.error("Error updating wishlist:", error);
            Toast().fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'Failed to update wishlist',
            });
        } finally {
            setIsLoadingWishlist(false);
        }
    };

    // Function to handle preview video
    const handlePreviewClick = (videoItem) => {
        // Reset video first to ensure clean state
        setPreviewVideo(null);
        
        // Use setTimeout to ensure state is reset before setting new video
        setTimeout(() => {
            setPreviewVideo(videoItem);
            
            // Trigger modal after state is set
            setTimeout(() => {
                const modalElement = document.getElementById('lessonPreviewModal');
                if (modalElement) {
                    const modal = new window.bootstrap.Modal(modalElement);
                    modal.show();
                }
            }, 100);
        }, 50);
    };

    // Ensure page always loads from top as a fresh instance
    useEffect(() => {
        // Scroll to top immediately
        window.scrollTo(0, 0);
        
        // Force page to load as new instance
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }, [slug]);

    // Reset to top when component mounts (ensures fresh load)
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Handle video event listeners and modal close events
    useEffect(() => {
        const videoElement = videoRef.current;
        
        if (!videoElement) return;
        
        const handleVideoEnd = () => {
            // You can add completion logic here if needed for preview
        };
        
        const handleTimeUpdate = () => {
            const progress = (videoElement.currentTime / videoElement.duration) * 100;
            if (progress >= 95) { // Consider 95% as complete
                handleVideoEnd();
            }
        };
        
        videoElement.addEventListener('ended', handleVideoEnd);
        videoElement.addEventListener('timeupdate', handleTimeUpdate);
        
        // Cleanup
        return () => {
            videoElement.removeEventListener('ended', handleVideoEnd);
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [course?.file]); // Re-run when video source changes

    // Add modal event listeners to pause videos when modals close
    // Enhanced with multiple event types for better reliability
    // This runs after modals are rendered (when course/previewVideo exist)
    useEffect(() => {
        // Wait for next tick to ensure modals are in DOM
        const setupListeners = () => {
            const coursePreviewModalElement = document.getElementById('coursePreviewModal');
            const lessonPreviewModalElement = document.getElementById('lessonPreviewModal');
            
            const handleCourseModalHidden = () => {
                const videoElement = videoRef.current;
                if (videoElement) {
                    videoElement.pause();
                    videoElement.currentTime = 0; // Reset to start
                    videoElement.blur(); // Remove focus to prevent aria-hidden warning
                }
            };
            
            const handleLessonModalHidden = () => {
                // Find lesson video element and pause it
                const lessonVideo = document.querySelector('#lessonPreviewModal video');
                if (lessonVideo) {
                    lessonVideo.pause();
                    lessonVideo.currentTime = 0; // Reset to start
                    lessonVideo.blur(); // Remove focus to prevent aria-hidden warning
                }
                // Reset preview video state
                setPreviewVideo(null);
            };
            
            // Handle backdrop clicks (clicking outside modal)
            const handleBackdropClick = (e) => {
                // Check if click is on the modal backdrop (not the modal content)
                if (e.target.classList.contains('modal')) {
                    // Determine which modal and pause appropriate video
                    if (e.target.id === 'coursePreviewModal') {
                        handleCourseModalHidden();
                    } else if (e.target.id === 'lessonPreviewModal') {
                        handleLessonModalHidden();
                    }
                }
            };
            
            // Handle ESC key press
            const handleEscKey = (e) => {
                if (e.key === 'Escape') {
                    // Check which modal is open and pause video
                    const courseModal = document.getElementById('coursePreviewModal');
                    const lessonModal = document.getElementById('lessonPreviewModal');
                    
                    if (courseModal && courseModal.classList.contains('show')) {
                        handleCourseModalHidden();
                    }
                    if (lessonModal && lessonModal.classList.contains('show')) {
                        handleLessonModalHidden();
                    }
                }
            };
            
            // Add Bootstrap modal hidden event listeners (this fires on ALL close methods)
            if (coursePreviewModalElement) {
                coursePreviewModalElement.addEventListener('hidden.bs.modal', handleCourseModalHidden);
                coursePreviewModalElement.addEventListener('click', handleBackdropClick);
            }
            
            if (lessonPreviewModalElement) {
                lessonPreviewModalElement.addEventListener('hidden.bs.modal', handleLessonModalHidden);
                lessonPreviewModalElement.addEventListener('click', handleBackdropClick);
            }
            
            // Add ESC key listener
            document.addEventListener('keydown', handleEscKey);
            
            // Return cleanup function
            return () => {
                if (coursePreviewModalElement) {
                    coursePreviewModalElement.removeEventListener('hidden.bs.modal', handleCourseModalHidden);
                    coursePreviewModalElement.removeEventListener('click', handleBackdropClick);
                }
                if (lessonPreviewModalElement) {
                    lessonPreviewModalElement.removeEventListener('hidden.bs.modal', handleLessonModalHidden);
                    lessonPreviewModalElement.removeEventListener('click', handleBackdropClick);
                }
                document.removeEventListener('keydown', handleEscKey);
            };
        };
        
        // Use setTimeout to ensure modals are rendered in DOM
        const timeoutId = setTimeout(setupListeners, 100);
        
        // Cleanup timeout on unmount
        return () => {
            clearTimeout(timeoutId);
        };
    }, [course?.file, previewVideo]); // Re-run when modals are rendered

    const getTabContent = () => {
        switch (activeTab) {
            case "overview":
                return (
                    <>
                    {/* Modern Course Description Card */}
                    <div
                        className="card border-0 shadow-sm mb-3"
                        style={{ borderRadius: '20px' }}
                    >
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex align-items-center mb-3">
                                <div 
                                    className="me-3"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <i className="fas fa-info-circle text-white"></i>
                                </div>
                                <h3 className="h5 mb-0" style={{ color: '#2c3e50' }}>
                                    Tentang Kursus Ini
                                </h3>
                            </div>
                            
                            <div className="course-description">
                                <div 
                                    className="text-muted mb-3" 
                                    style={{ lineHeight: '1.6', fontSize: '0.95rem' }}
                                    dangerouslySetInnerHTML={{ __html: course?.description || "Deskripsi kursus tidak tersedia." }}
                                />
                                
                                {/* Show curriculum overview if available */}
                                {course?.curriculum && course.curriculum.length > 0 && (
                                    <>
                                        <h5 className="fw-bold mb-3 mt-3" style={{ color: '#2c3e50', fontSize: '1rem' }}>
                                            Materi Pembelajaran:
                                        </h5>
                                        
                                        <div className="row g-3">
                                            {course.curriculum.slice(0, 6).map((variant, index) => (
                                                <div key={variant.variant_id || index} className="col-md-6">
                                                    <div className="d-flex align-items-start">
                                                        <div 
                                                            className="me-3 mt-1"
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <i className="fas fa-check text-white" style={{ fontSize: '0.7rem' }}></i>
                                                        </div>
                                                        <span className="text-muted">{variant.title}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {course.curriculum.length > 6 && (
                                            <div className="mt-3">
                                                <small className="text-muted">
                                                    <i className="fas fa-plus-circle me-1"></i>
                                                    Dan {course.curriculum.length - 6} modul lainnya...
                                                </small>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Course Analytics & Statistics - Separate Card Below Description */}
                    <CourseStatistics course={course} />
                    </>

                );
            case "curriculum":
                return (
                    <div 
                        className="card border-0 shadow-sm"
                        style={{ borderRadius: '20px' }}
                    >
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex align-items-center mb-3">
                                <div 
                                    className="me-3"
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <i className="fas fa-list text-white"></i>
                                </div>
                                <h3 className="h5 mb-0" style={{ color: '#2c3e50' }}>
                                    Kurikulum Kursus
                                </h3>
                            </div>
                            
                            <div className="row g-2 mb-3">
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-2 p-md-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                            borderRadius: '12px'
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: '#667eea', fontSize: '0.95rem' }}>
                                            {course?.curriculum?.length || 0} Modul
                                        </h6>
                                        <small className="text-muted" style={{ fontSize: '0.8rem' }}>Materi pembelajaran</small>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-2 p-md-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 201, 151, 0.1) 100%)',
                                            borderRadius: '12px'
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: '#28a745', fontSize: '0.95rem' }}>
                                            {course?.lectures?.length || 0} Video
                                        </h6>
                                        <small className="text-muted" style={{ fontSize: '0.8rem' }}>Video pembelajaran</small>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-2 p-md-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)',
                                            borderRadius: '12px'
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: '#ffc107', fontSize: '0.95rem' }}>
                                            {calculateTotalDuration(course?.lectures || [])}
                                        </h6>
                                        <small className="text-muted" style={{ fontSize: '0.8rem' }}>Total durasi</small>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Real curriculum sections from backend */}
                            {course?.curriculum && course.curriculum.length > 0 ? (
                                course.curriculum.map((section, index) => (
                                    <div key={section.variant_id || index} className="mb-3">
                                        <div 
                                            className="p-3"
                                            style={{
                                                background: '#f8f9fa',
                                                borderRadius: '12px',
                                                border: '1px solid #e9ecef'
                                            }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center flex-grow-1">
                                                    <span 
                                                        className="badge me-3"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                            color: 'white',
                                                            width: '30px',
                                                            height: '30px',
                                                            borderRadius: '50%',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex-grow-1">
                                                        <h6 className="mb-1 fw-bold" style={{ color: '#2c3e50' }}>
                                                            {section.title || `Modul ${index + 1}`}
                                                        </h6>
                                                        <small className="text-muted">
                                                            <i className="fas fa-play-circle me-1"></i>
                                                            {section.variant_items?.length || section.items?.length || 0} video
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Show variant items/lectures */}
                                            {(section.variant_items || section.items) && (section.variant_items?.length > 0 || section.items?.length > 0) && (
                                                <div className="mt-3 ms-5">
                                                    {(section.variant_items || section.items).map((item, itemIndex) => (
                                                        <div key={item.variant_item_id || itemIndex} className="d-flex align-items-center py-2 border-bottom">
                                                            <i className={`${item.file_icon || 'fas fa-play-circle'} text-muted me-2`} style={{ fontSize: '0.9rem' }}></i>
                                                            <span className="text-muted me-auto" style={{ fontSize: '0.9rem' }}>
                                                                {item.title}
                                                            </span>
                                                            {item.content_duration && (
                                                                <small className="badge bg-light text-muted">
                                                                    <i className="fas fa-clock me-1"></i>
                                                                    {item.content_duration}
                                                                </small>
                                                            )}
                                                            {item.preview && (
                                                                <small 
                                                                    className="badge bg-primary ms-2"
                                                                    role="button"
                                                                    onClick={() => handlePreviewClick(item)}
                                                                    style={{ cursor: 'pointer' }}
                                                                    title="Klik untuk menonton preview"
                                                                >
                                                                    <i className="fas fa-eye me-1"></i>
                                                                    Preview
                                                                </small>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-5">
                                    <i className="fas fa-book text-muted mb-3" style={{ fontSize: '3rem', opacity: '0.3' }}></i>
                                    <p className="text-muted">Kurikulum belum tersedia untuk kursus ini.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case "instructor":
                return <CourseInstructor teacher={course?.teacher} />;
            case "reviews":
                return (
                    <CourseReviews 
                        reviews={course?.reviews || []}
                        averageRating={course?.average_rating || 0}
                        totalReviews={course?.rating_count || 0}
                    />
                );
            case "faq":
                return <CourseFAQ />;
            default:
                return (
                    <div className="card border-0 shadow-sm">
                        <div className="card-body p-4">
                            <h3 className="h4 mb-3">Course Overview</h3>
                            <p>{course?.description || "Course description not available."}</p>
                        </div>
                    </div>
                );
        }
    };

    if (isLoading) {
        return (
            <>
                <BaseHeader />
                <CourseDetailLoading />
                <Footer />
            </>
        );
    }
    
    return (
        <div className="course-detail">
            <BaseHeader />
            
            <CourseHero course={course} />
            
            <section className="py-4 base-course-detail-content">
                <div className="container">
                    <div className="row g-3 g-md-4">
                        {/* Main Content */}
                        <div className="col-lg-8">
                            <CourseTabNavigation 
                                activeTab={activeTab} 
                                setActiveTab={setActiveTab} 
                            />
                            
                            <div>
                                {getTabContent()}
                            </div>
                        </div>
                        
                        {/* Sidebar */}
                        <div className="col-lg-4">
                            <CourseSidebar 
                                course={course}
                                isInWishlist={isInWishlist}
                                isLoadingWishlist={isLoadingWishlist}
                                onWishlistToggle={handleWishlist}
                            />
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Course Preview Modal - Compact Design */}
            {course?.file && (
                <div className="modal fade" id="coursePreviewModal" tabIndex={-1} aria-labelledby="coursePreviewModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                            <div 
                                className="modal-header border-0 text-white position-relative"
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    padding: '0.75rem 1.25rem'
                                }}
                            >
                                <div className="d-flex align-items-center" style={{ zIndex: 2, position: 'relative' }}>
                                    <div 
                                        className="me-2"
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <i className="fas fa-play text-white" style={{ fontSize: '0.9rem' }}></i>
                                    </div>
                                    <div>
                                        <h6 className="mb-0 fw-bold" style={{ fontSize: '0.95rem' }}>
                                            Preview Kursus
                                        </h6>
                                        <small style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                            {course.title}
                                        </small>
                                    </div>
                                </div>
                                
                                <button 
                                    type="button" 
                                    className="btn btn-sm"
                                    data-bs-dismiss="modal" 
                                    aria-label="Close"
                                    style={{ 
                                        zIndex: 3, 
                                        position: 'relative',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        transition: 'all 0.3s ease'
                                    }}
                                    onClick={() => {
                                        // Immediately pause and reset the video
                                        const videoElement = videoRef.current;
                                        if (videoElement) {
                                            videoElement.pause();
                                            videoElement.currentTime = 0;
                                            videoElement.blur(); // Remove focus to prevent aria-hidden warning
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                        e.target.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                        e.target.style.transform = 'scale(1)';
                                    }}
                                >
                                    <i className="fas fa-times text-white" style={{ fontSize: '1rem' }}></i>
                                </button>
                            </div>
                            <div className="modal-body p-0 bg-dark d-flex align-items-center justify-content-center" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 100px)' }}>
                                {/* Video with natural aspect ratio */}
                                <video 
                                    ref={videoRef}
                                    src={course.file} 
                                    style={{ 
                                        width: '100%',
                                        height: 'auto',
                                        maxHeight: 'calc(100vh - 100px)',
                                        objectFit: 'contain'
                                    }}
                                    controls 
                                    onError={(e) => {
                                        console.error('Video failed to load:', course.file);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lesson Preview Modal - Compact Design */}
            {previewVideo && (
                <div className="modal fade" id="lessonPreviewModal" tabIndex={-1} aria-labelledby="lessonPreviewModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                            <div 
                                className="modal-header border-0 text-white position-relative"
                                style={{
                                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                    padding: '0.75rem 1.25rem'
                                }}
                            >
                                <div className="d-flex align-items-center flex-grow-1" style={{ zIndex: 2, position: 'relative' }}>
                                    <div 
                                        className="me-2"
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <i className="fas fa-play text-white" style={{ fontSize: '0.9rem' }}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-0 fw-bold" style={{ fontSize: '0.95rem' }}>
                                            {previewVideo.title}
                                        </h6>
                                        <small style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                            <i className="fas fa-clock me-1"></i>
                                            {previewVideo.content_duration || 'N/A'}
                                        </small>
                                    </div>
                                    <span className="badge bg-light text-success ms-2" style={{ fontSize: '0.7rem' }}>
                                        <i className="fas fa-eye me-1"></i>
                                        Gratis Preview
                                    </span>
                                </div>
                                
                                <button 
                                    type="button" 
                                    className="btn btn-sm ms-2"
                                    data-bs-dismiss="modal" 
                                    aria-label="Close"
                                    style={{ 
                                        zIndex: 3, 
                                        position: 'relative',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        transition: 'all 0.3s ease'
                                    }}
                                    onClick={() => {
                                        // Immediately pause and reset the lesson video
                                        const lessonVideo = document.querySelector('#lessonPreviewModal video');
                                        if (lessonVideo) {
                                            lessonVideo.pause();
                                            lessonVideo.currentTime = 0;
                                            lessonVideo.blur(); // Remove focus to prevent aria-hidden warning
                                        }
                                        // Reset preview state
                                        setPreviewVideo(null);
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                        e.target.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                        e.target.style.transform = 'scale(1)';
                                    }}
                                >
                                    <i className="fas fa-times text-white" style={{ fontSize: '1rem' }}></i>
                                </button>
                            </div>
                            <div className="modal-body p-0 bg-dark d-flex align-items-center justify-content-center" style={{ minHeight: '400px', maxHeight: 'calc(100vh - 150px)' }}>
                                {/* Video with natural aspect ratio */}
                                <video 
                                    key={previewVideo.file || previewVideo.video_url}
                                    src={previewVideo.file || previewVideo.video_url} 
                                    style={{ 
                                        width: '100%',
                                        height: 'auto',
                                        maxHeight: 'calc(100vh - 150px)',
                                        objectFit: 'contain'
                                    }}
                                    controls 
                                    autoPlay
                                    onError={(e) => {
                                        console.error('Video failed to load:', previewVideo.file || previewVideo.video_url);
                                    }}
                                    onLoadedData={(e) => {
                                        e.target.play().catch(err => console.error('Auto-play blocked:', err));
                                    }}
                                />
                            </div>
                            <div className="modal-footer border-0 bg-light py-2">
                                <div className="w-100 text-center">
                                    <small className="text-muted">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Ini adalah preview gratis. Daftar sekarang untuk mengakses seluruh kursus!
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Floating Wishlist Button - Hidden for teachers/instructors */}
            {course && !isLoading && !isTeacher && (
                <div 
                    className="floating-wishlist-container"
                    style={{
                        position: 'fixed',
                        top: '50%',
                        right: '80px',
                        transform: 'translateY(-50%)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        pointerEvents: 'auto'
                    }}
                >
                    {/* Text label (shows when in wishlist) */}
                    {isInWishlist && (
                        <div 
                            className="floating-wishlist-label"
                            style={{
                                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '30px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 15px rgba(255, 107, 107, 0.4)',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                whiteSpace: 'nowrap',
                                animation: 'fadeInRight 0.3s ease',
                                zIndex: 9999
                            }}
                        >
                            Click to Remove
                        </div>
                    )}
                    
                    <button
                        onClick={handleWishlist}
                        disabled={isLoadingWishlist}
                        className="btn floating-wishlist-button"
                        style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: isInWishlist 
                                ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)' 
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: '3px solid rgba(255, 255, 255, 0.3)',
                            boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isLoadingWishlist ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            padding: 0,
                            flexShrink: 0,
                            zIndex: 9999,
                            position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoadingWishlist) {
                                e.currentTarget.style.transform = 'scale(1.1) translateY(-3px)';
                                e.currentTarget.style.boxShadow = '0 12px 35px rgba(102, 126, 234, 0.5)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1) translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
                        }}
                        title={isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
                    >
                        {isLoadingWishlist ? (
                            <i className="fas fa-spinner fa-spin text-white" style={{ fontSize: '1.5rem' }}></i>
                        ) : (
                            <i 
                                className={`${isInWishlist ? 'fas' : 'far'} fa-heart text-white`}
                                style={{ 
                                    fontSize: '1.5rem',
                                    animation: isInWishlist ? 'heartBeat 0.5s' : 'none'
                                }}
                            ></i>
                        )}
                    </button>
                </div>
            )}
            
            <div className="footer-wrapper">
                <Footer />
            </div>
        </div>
    );
}

export default CourseDetail;