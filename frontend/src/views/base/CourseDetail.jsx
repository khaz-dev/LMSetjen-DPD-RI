import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";

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

    // Handle video event listeners
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

    const getTabContent = () => {
        switch (activeTab) {
            case "overview":
                return (
                    <>
                    {/* Modern Course Description Card */}
                    <div
                        className="card border-0 shadow-sm mb-4"
                        style={{ borderRadius: '20px' }}
                    >
                            <div className="card-body p-4">
                                <div className="d-flex align-items-center mb-4">
                                    <div 
                                        className="me-3"
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            borderRadius: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <i className="fas fa-info-circle text-white" style={{ fontSize: '1.2rem' }}></i>
                                    </div>
                                    <h3 className="h4 mb-0" style={{ color: '#2c3e50' }}>
                                        Tentang Kursus Ini
                                    </h3>
                                </div>
                                
                                <div className="course-description">
                                    <div 
                                        className="text-muted mb-4" 
                                        style={{ lineHeight: '1.7' }}
                                        dangerouslySetInnerHTML={{ __html: course?.description || "Deskripsi kursus tidak tersedia." }}
                                    />
                                    
                                    {/* Show curriculum overview if available */}
                                    {course?.curriculum && course.curriculum.length > 0 && (
                                        <>
                                            <h5 className="fw-bold mb-3 mt-4" style={{ color: '#2c3e50' }}>
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
                            {/* Modern Statistics Card */}
                            <CourseStatistics course={course} />
                        </div>
                    </>

                );
            case "curriculum":
                return (
                    <div 
                        className="card border-0 shadow-sm"
                        style={{ borderRadius: '20px' }}
                    >
                        <div className="card-body p-4">
                            <div className="d-flex align-items-center mb-4">
                                <div 
                                    className="me-3"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        borderRadius: '15px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <i className="fas fa-list text-white" style={{ fontSize: '1.2rem' }}></i>
                                </div>
                                <h3 className="h4 mb-0" style={{ color: '#2c3e50' }}>
                                    Kurikulum Kursus
                                </h3>
                            </div>
                            
                            <div className="row g-3 mb-4">
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: '#667eea' }}>
                                            {course?.curriculum?.length || 0} Modul
                                        </h6>
                                        <small className="text-muted">Materi pembelajaran</small>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 201, 151, 0.1) 100%)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: '#28a745' }}>
                                            {course?.lectures?.length || 0} Video
                                        </h6>
                                        <small className="text-muted">Video pembelajaran</small>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: '#ffc107' }}>
                                            {calculateTotalDuration(course?.lectures || [])}
                                        </h6>
                                        <small className="text-muted">Total durasi</small>
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
                <BaseFooter />
            </>
        );
    }
    
    return (
        <div className="course-detail">
            <BaseHeader />
            
            <CourseHero course={course} />
            
            <section className="py-5">
                <div className="container">
                    <div className="row g-4">
                        {/* Main Content */}
                        <div className="col-lg-8">
                            <CourseTabNavigation 
                                activeTab={activeTab} 
                                setActiveTab={setActiveTab} 
                            />
                            
                            <div className="mt-4">
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
            
            {/* Course Preview Modal */}
            {course?.file && (
                <div className="modal fade" id="coursePreviewModal" tabIndex={-1} aria-labelledby="coursePreviewModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                            <div 
                                className="modal-header border-0 text-white position-relative"
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    padding: '1.5rem 2rem'
                                }}
                            >
                                {/* Decorative background elements */}
                                <div 
                                    style={{
                                        position: 'absolute',
                                        top: '-50%',
                                        right: '-20%',
                                        width: '40%',
                                        height: '200%',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        transform: 'rotate(15deg)',
                                        zIndex: 1
                                    }}
                                ></div>
                                
                                <div className="d-flex align-items-center" style={{ zIndex: 2, position: 'relative' }}>
                                    <div 
                                        className="me-3"
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <i className="fas fa-play text-white" style={{ fontSize: '1.2rem' }}></i>
                                    </div>
                                    <div>
                                        <h1 className="modal-title fs-4 mb-0 fw-bold" id="coursePreviewModalLabel">
                                            Preview Kursus
                                        </h1>
                                        <small className="opacity-90">
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
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        border: '2px solid rgba(255, 255, 255, 0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        transition: 'all 0.3s ease',
                                        backdropFilter: 'blur(10px)'
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
                                    <i className="fas fa-times text-white" style={{ fontSize: '1.2rem' }}></i>
                                </button>
                            </div>
                            <div className="modal-body p-0 bg-dark position-relative">
                                {/* Video container with aspect ratio */}
                                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                                    <video 
                                        ref={videoRef}
                                        src={course.file} 
                                        style={{ 
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '0',
                                            objectFit: 'cover'
                                        }}
                                        controls 
                                        onError={(e) => {
                                            console.error('Video failed to load:', course.file);
                                        }}
                                    />
                                </div>
                                
                                {/* Video info overlay */}
                                <div 
                                    className="position-absolute bottom-0 start-0 end-0 text-white p-3"
                                    style={{
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                        zIndex: 1
                                    }}
                                >
                                    <div className="d-flex justify-content-between align-items-end">
                                        <div>
                                            <h6 className="mb-1 fw-bold">Preview Video</h6>
                                            <small className="opacity-75">
                                                Tonton preview untuk melihat isi kursus
                                            </small>
                                        </div>
                                        <div className="text-end">
                                            <div className="badge bg-primary px-3 py-2 rounded-pill">
                                                <i className="fas fa-eye me-1"></i>
                                                Preview
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lesson Preview Modal - For individual lesson previews */}
            {previewVideo && (
                <div className="modal fade" id="lessonPreviewModal" tabIndex={-1} aria-labelledby="lessonPreviewModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-xl">
                        <div className="modal-content border-0" style={{ borderRadius: '20px', overflow: 'hidden' }}>
                            <div 
                                className="modal-header border-0 text-white position-relative"
                                style={{
                                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                    padding: '1.5rem 2rem'
                                }}
                            >
                                {/* Decorative background elements */}
                                <div 
                                    style={{
                                        position: 'absolute',
                                        top: '-50%',
                                        right: '-20%',
                                        width: '40%',
                                        height: '200%',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        transform: 'rotate(15deg)',
                                        zIndex: 1
                                    }}
                                ></div>
                                
                                <div className="d-flex align-items-center" style={{ zIndex: 2, position: 'relative' }}>
                                    <div 
                                        className="me-3"
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '15px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <i className="fas fa-play text-white" style={{ fontSize: '1.2rem' }}></i>
                                    </div>
                                    <div>
                                        <h1 className="modal-title fs-4 mb-0 fw-bold" id="lessonPreviewModalLabel">
                                            Preview Materi
                                        </h1>
                                        <small className="opacity-90">
                                            {previewVideo.title}
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
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        border: '2px solid rgba(255, 255, 255, 0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        transition: 'all 0.3s ease',
                                        backdropFilter: 'blur(10px)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                        e.target.style.transform = 'scale(1.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                        e.target.style.transform = 'scale(1)';
                                    }}
                                    onClick={() => setPreviewVideo(null)}
                                >
                                    <i className="fas fa-times text-white" style={{ fontSize: '1.2rem' }}></i>
                                </button>
                            </div>
                            <div className="modal-body p-0 bg-dark position-relative">
                                {/* Video container with aspect ratio */}
                                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                                    <video 
                                        key={previewVideo.file || previewVideo.video_url}
                                        src={previewVideo.file || previewVideo.video_url} 
                                        style={{ 
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '0',
                                            objectFit: 'cover'
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
                                
                                {/* Video info overlay */}
                                <div 
                                    className="position-absolute bottom-0 start-0 end-0 text-white p-3"
                                    style={{
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                        zIndex: 1
                                    }}
                                >
                                    <div className="d-flex justify-content-between align-items-end">
                                        <div>
                                            <h6 className="mb-1 fw-bold">{previewVideo.title}</h6>
                                            <small className="opacity-75">
                                                <i className="fas fa-clock me-2"></i>
                                                {previewVideo.content_duration || 'N/A'}
                                            </small>
                                        </div>
                                        <div className="text-end">
                                            <div className="badge bg-success px-3 py-2 rounded-pill">
                                                <i className="fas fa-eye me-1"></i>
                                                Gratis Preview
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-0 bg-light">
                                <div className="w-100 text-center">
                                    <p className="mb-2 text-muted small">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Ini adalah preview gratis. Daftar sekarang untuk mengakses seluruh kursus!
                                    </p>
                                    <button 
                                        className="btn"
                                        style={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            padding: '0.5rem 2rem'
                                        }}
                                        data-bs-dismiss="modal"
                                        onClick={() => setPreviewVideo(null)}
                                    >
                                        <i className="fas fa-graduation-cap me-2"></i>
                                        Daftar Kursus Ini
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Floating Wishlist Button - Hidden for teachers/instructors */}
            {course && !isLoading && !isTeacher && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    right: '80px',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    {/* Text label (shows when in wishlist) */}
                    {isInWishlist && (
                        <div 
                            style={{
                                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
                                color: 'white',
                                padding: '10px 20px',
                                borderRadius: '30px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                zIndex: 1000,
                                boxShadow: '0 4px 15px rgba(255, 107, 107, 0.4)',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                whiteSpace: 'nowrap',
                                animation: 'fadeInRight 0.3s ease'
                            }}
                        >
                            Click to Remove
                        </div>
                    )}
                    
                    <button
                        onClick={handleWishlist}
                        disabled={isLoadingWishlist}
                        className="btn"
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
                            flexShrink: 0
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
            
            <BaseFooter />
        </div>
    );
}

export default CourseDetail;