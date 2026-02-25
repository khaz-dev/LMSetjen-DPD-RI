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
import { calculateTotalDuration, formatDuration, parseDurationToSeconds } from "../../utils/durationUtils"; // ✨ PHASE 4.77+: Duration formatting
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";

import "./CourseDetail.css";

// ✨ PHASE 4.75: Utility function to convert media URLs to preview/embed format
// Handles Google Drive URLs and YouTube URLs for iframe embedding
const convertGoogleDriveUrlToPreview = (url) => {
    if (!url || typeof url !== 'string') return url;
    
    // Check if it's a Google Drive URL
    if (url.includes('drive.google.com')) {
        // Extract file ID from various Google Drive URL formats
        let fileId = null;
        
        // Format: https://drive.google.com/file/d/{FILE_ID}/view
        // or: https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
        const match = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            fileId = match[1];
        }
        
        // If file ID found, convert to preview format
        if (fileId) {
            return `https://drive.google.com/file/d/${fileId}/preview`;
        }
    }
    
    // ✨ PHASE 4.75 FIX: Handle YouTube URLs
    // Convert youtube.com/watch?v=ID and youtu.be/ID to embed format
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = null;
        
        // Format: https://www.youtube.com/watch?v={VIDEO_ID}
        if (url.includes('youtube.com/watch')) {
            const match = url.match(/v=([a-zA-Z0-9_-]{11})/);
            if (match) {
                videoId = match[1];
            }
        }
        
        // Format: https://youtu.be/{VIDEO_ID}
        if (url.includes('youtu.be/')) {
            const match = url.match(/youtu.be\/([a-zA-Z0-9_-]{11})/);
            if (match) {
                videoId = match[1];
            }
        }
        
        // If video ID found, convert to embed format with disabled features
        if (videoId) {
            // ✨ PHASE 4.76: Disable share, info, and related videos in YouTube player
            // rel=0: disables related videos suggestions
            // modestbranding=1: hides YouTube logo
            return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
        }
    }
    
    return url;
};

function CourseDetail() {
    const { slug } = useParams();
    const [activeTab, setActiveTab] = useState("overview");
    const videoRef = React.useRef(null);
    const [previewVideo, setPreviewVideo] = useState(null);
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [isLoadingWishlist, setIsLoadingWishlist] = useState(false);
    const userData = UserData();
    const isTeacher = userData?.role === "teacher" || userData?.role === "instructor";
    
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
            // Handle paginated API response
            const wishlistData = response.data?.results || response.data || [];
            const wishlistItems = Array.isArray(wishlistData) ? wishlistData : [];
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
                icon: "warning",
                title: "Login Required",
                text: "Please login to add courses to your wishlist",
                confirmButtonColor: "#667eea"
            });
            return;
        }

        setIsLoadingWishlist(true);
        
        try {
            // Backend uses POST for both add and remove (toggle logic)
            const formData = new FormData();
            formData.append("course_id", course.id);
            formData.append("user_id", userData.user_id);
            
            const response = await useAxios.post(`student/wishlist/${userData.user_id}/`, formData);
            
            if (isInWishlist) {
                // Was in wishlist, now removed
                Toast().fire({
                    icon: "success",
                    title: "Removed from Wishlist",
                    text: "Course has been removed from your wishlist",
                });
                setIsInWishlist(false);
            } else {
                // Was not in wishlist, now added
                Toast().fire({
                    icon: "success",
                    title: "Added to Wishlist",
                    text: "Course has been added to your wishlist",
                });
                setIsInWishlist(true);
            }
        } catch (error) {
            console.error("Error updating wishlist:", error);
            Toast().fire({
                icon: "error",
                title: "Error",
                text: error.response?.data?.message || "Failed to update wishlist",
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
                const modalElement = document.getElementById("lessonPreviewModal");
                if (modalElement) {
                    const modal = new window.bootstrap.Modal(modalElement);
                    modal.show();
                }
            }, 100);
        }, 50);
    };

    // ✨ PHASE 4.43.3: Handle modal close to pause all videos/iframes
    useEffect(() => {
        const modalElement = document.getElementById("lessonPreviewModal");
        if (!modalElement) return;

        const handleModalHidden = () => {
            // Stop all videos
            const videos = modalElement.querySelectorAll("video");
            videos.forEach(video => {
                video.pause();
                video.currentTime = 0;
            });
            
            // Reset preview state
            setPreviewVideo(null);
        };

        // Listen for Bootstrap modal hidden event
        modalElement.addEventListener("hidden.bs.modal", handleModalHidden);

        return () => {
            modalElement.removeEventListener("hidden.bs.modal", handleModalHidden);
        };
    }, []);

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
        
        videoElement.addEventListener("ended", handleVideoEnd);
        videoElement.addEventListener("timeupdate", handleTimeUpdate);
        
        // Cleanup
        return () => {
            videoElement.removeEventListener("ended", handleVideoEnd);
            videoElement.removeEventListener("timeupdate", handleTimeUpdate);
        };
    }, [course?.file]); // Re-run when video source changes

    // Add modal event listeners to pause videos when modals close
    // Enhanced with multiple event types for better reliability
    // This runs after modals are rendered (when course/previewVideo exist)
    useEffect(() => {
        // Wait for next tick to ensure modals are in DOM
        const setupListeners = () => {
            const coursePreviewModalElement = document.getElementById("coursePreviewModal");
            const lessonPreviewModalElement = document.getElementById("lessonPreviewModal");
            
            // ✨ PHASE 4.43.9: Handlers for Course Preview Modal
            const handleCourseModalHidden = () => {
                // Pause all videos in the modal using direct DOM query
                const videos = document.querySelectorAll("#coursePreviewModal video");
                videos.forEach(video => {
                    video.pause();
                    video.currentTime = 0;
                    video.blur();
                });
                
                // Stop iframes (Google Drive videos)
                const iframes = document.querySelectorAll("#coursePreviewModal iframe");
                iframes.forEach(iframe => {
                    iframe.src = "about:blank";
                });
                
                // Also pause video via ref as backup
                const videoElement = videoRef.current;
                if (videoElement) {
                    videoElement.pause();
                    videoElement.currentTime = 0;
                    videoElement.blur();
                }
            };
            
            // ✨ PHASE 4.43.9: Reset iframe src when course preview modal is shown again
            const handleCourseModalShown = () => {
                // Reset iframe src to actual video URL when modal is shown
                const iframes = document.querySelectorAll("#coursePreviewModal iframe");
                if (iframes.length > 0 && course?.file) {
                    const videoUrl = convertGoogleDriveUrlToPreview(course.file);
                    iframes.forEach(iframe => {
                        iframe.src = videoUrl;
                    });
                }
            };
            
            const handleLessonModalHidden = () => {
                // Pause all video elements
                const videos = document.querySelectorAll("#lessonPreviewModal video");
                videos.forEach(video => {
                    video.pause();
                    video.currentTime = 0;
                    video.blur();
                });
                
                // Stop iframes (Google Drive videos)
                const iframes = document.querySelectorAll("#lessonPreviewModal iframe");
                iframes.forEach(iframe => {
                    iframe.src = "about:blank";
                });
                
                // Reset preview video state
                setPreviewVideo(null);
            };
            
            // ✨ PHASE 4.43.9: Reset iframe src when lesson preview modal is shown again
            const handleLessonModalShown = () => {
                // Reset iframe src to actual video URL when modal is shown
                const iframes = document.querySelectorAll("#lessonPreviewModal iframe");
                if (iframes.length > 0 && previewVideo) {
                    const videoUrl = convertGoogleDriveUrlToPreview(previewVideo.file || previewVideo.video_url);
                    iframes.forEach(iframe => {
                        iframe.src = videoUrl;
                    });
                }
            };
            
            // Handle backdrop clicks (clicking outside modal)
            const handleBackdropClick = (e) => {
                // Check if click is on the modal backdrop (not the modal content)
                if (e.target.classList.contains("modal")) {
                    // Determine which modal and pause appropriate video
                    if (e.target.id === "coursePreviewModal") {
                        handleCourseModalHidden();
                    } else if (e.target.id === "lessonPreviewModal") {
                        handleLessonModalHidden();
                    }
                }
            };
            
            // Handle ESC key press
            const handleEscKey = (e) => {
                if (e.key === "Escape") {
                    // Check which modal is open and pause video
                    const courseModal = document.getElementById("coursePreviewModal");
                    const lessonModal = document.getElementById("lessonPreviewModal");
                    
                    if (courseModal && courseModal.classList.contains("show")) {
                        handleCourseModalHidden();
                    }
                    if (lessonModal && lessonModal.classList.contains("show")) {
                        handleLessonModalHidden();
                    }
                }
            };
            
            // Add Bootstrap modal event listeners
            // Use 'hide.bs.modal' to pause video BEFORE the modal is hidden
            // Use 'show.bs.modal' to reset iframe src when modal is opened
            // This prevents aria-hidden warnings and ensures video stops immediately
            if (coursePreviewModalElement) {
                coursePreviewModalElement.addEventListener("hide.bs.modal", handleCourseModalHidden);
                coursePreviewModalElement.addEventListener("show.bs.modal", handleCourseModalShown);
                coursePreviewModalElement.addEventListener("click", handleBackdropClick);
            }
            
            if (lessonPreviewModalElement) {
                lessonPreviewModalElement.addEventListener("hide.bs.modal", handleLessonModalHidden);
                lessonPreviewModalElement.addEventListener("show.bs.modal", handleLessonModalShown);
                lessonPreviewModalElement.addEventListener("click", handleBackdropClick);
            }
            
            // Add ESC key listener
            document.addEventListener("keydown", handleEscKey);
            
            // Return cleanup function
            return () => {
                if (coursePreviewModalElement) {
                    coursePreviewModalElement.removeEventListener("hide.bs.modal", handleCourseModalHidden);
                    coursePreviewModalElement.removeEventListener("show.bs.modal", handleCourseModalShown);
                    coursePreviewModalElement.removeEventListener("click", handleBackdropClick);
                }
                if (lessonPreviewModalElement) {
                    lessonPreviewModalElement.removeEventListener("hide.bs.modal", handleLessonModalHidden);
                    lessonPreviewModalElement.removeEventListener("show.bs.modal", handleLessonModalShown);
                    lessonPreviewModalElement.removeEventListener("click", handleBackdropClick);
                }
                document.removeEventListener("keydown", handleEscKey);
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
                        style={{ borderRadius: "20px" }}
                    >
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex align-items-center mb-3">
                                <div 
                                    className="me-3"
                                    style={{
                                        width: "40px",
                                        height: "40px",
                                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                        borderRadius: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    <i className="fas fa-info-circle text-white"></i>
                                </div>
                                <h3 className="h5 mb-0" style={{ color: "#2c3e50" }}>
                                    Tentang Kursus Ini
                                </h3>
                            </div>
                            
                            <div className="course-description">
                                <div 
                                    className="text-muted mb-3" 
                                    style={{ lineHeight: "1.6", fontSize: "0.95rem" }}
                                    dangerouslySetInnerHTML={{ __html: course?.description || "Deskripsi kursus tidak tersedia." }}
                                />
                                
                                {/* Show curriculum overview if available */}
                                {course?.curriculum && course.curriculum.length > 0 && (
                                    <>
                                        <h5 className="fw-bold mb-3 mt-3" style={{ color: "#2c3e50", fontSize: "1rem" }}>
                                            Materi Pembelajaran:
                                        </h5>
                                        
                                        <div className="row g-3">
                                            {course.curriculum.slice(0, 6).map((variant, index) => (
                                                <div key={variant.variant_id || index} className="col-md-6">
                                                    <div className="d-flex align-items-start">
                                                        <div 
                                                            className="me-3 mt-1"
                                                            style={{
                                                                width: "20px",
                                                                height: "20px",
                                                                background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                                                                borderRadius: "50%",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            <i className="fas fa-check text-white" style={{ fontSize: "0.7rem" }}></i>
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
                    </>

                );
            case "curriculum":
                return (
                    <div 
                        className="card border-0 shadow-sm"
                        style={{ borderRadius: "20px" }}
                    >
                        <div className="card-body p-3 p-md-4">
                            <div className="d-flex align-items-center mb-3">
                                <div 
                                    className="me-3"
                                    style={{
                                        width: "40px",
                                        height: "40px",
                                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                        borderRadius: "12px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center"
                                    }}
                                >
                                    <i className="fas fa-list text-white"></i>
                                </div>
                                <h3 className="h5 mb-0" style={{ color: "#2c3e50" }}>
                                    Kurikulum Kursus
                                </h3>
                            </div>
                            
                            <div className="row g-2 mb-3">
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-2 p-md-3"
                                        style={{
                                            background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                            borderRadius: "12px"
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: "#667eea", fontSize: "0.95rem" }}>
                                            {course?.curriculum?.length || 0} Modul
                                        </h6>
                                        <small className="text-muted" style={{ fontSize: "0.8rem" }}>Materi pembelajaran</small>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-2 p-md-3"
                                        style={{
                                            background: "linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(32, 201, 151, 0.1) 100%)",
                                            borderRadius: "12px"
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: "#28a745", fontSize: "0.95rem" }}>
                                            {course?.lectures?.length || 0} Video
                                        </h6>
                                        <small className="text-muted" style={{ fontSize: "0.8rem" }}>Video pembelajaran</small>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div 
                                        className="text-center p-2 p-md-3"
                                        style={{
                                            background: "linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 140, 0, 0.1) 100%)",
                                            borderRadius: "12px"
                                        }}
                                    >
                                        <h6 className="fw-bold mb-1" style={{ color: "#ffc107", fontSize: "0.95rem" }}>
                                            {calculateTotalDuration(course?.lectures || []).withJP}
                                        </h6>
                                        <small className="text-muted" style={{ fontSize: "0.8rem" }}>Total durasi</small>
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
                                                background: "#f8f9fa",
                                                borderRadius: "12px",
                                                border: "1px solid #e9ecef"
                                            }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center flex-grow-1">
                                                    <span 
                                                        className="badge me-3"
                                                        style={{
                                                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                                            color: "white",
                                                            width: "30px",
                                                            height: "30px",
                                                            borderRadius: "50%",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontWeight: "600"
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex-grow-1">
                                                        <h6 className="mb-1 fw-bold" style={{ color: "#2c3e50" }}>
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
                                                            <i className={`${item.file_icon || "fas fa-play-circle"} text-muted me-2`} style={{ fontSize: "0.9rem" }}></i>
                                                            <span className="text-muted me-auto" style={{ fontSize: "0.9rem" }}>
                                                                {item.title}
                                                            </span>
                                                            {item.content_duration && (
                                                                <small className="badge bg-light text-muted">
                                                                    <i className="fas fa-clock me-1"></i>
                                                                    {formatDuration(parseDurationToSeconds(item.content_duration))}
                                                                </small>
                                                            )}
                                                            {item.preview && (
                                                                <small 
                                                                    className="badge bg-primary ms-2"
                                                                    role="button"
                                                                    onClick={() => handlePreviewClick(item)}
                                                                    style={{ cursor: "pointer" }}
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
                                    <i className="fas fa-book text-muted mb-3" style={{ fontSize: "3rem", opacity: "0.3" }}></i>
                                    <p className="text-muted">Kurikulum belum tersedia untuk kursus ini.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case "instructor":
                return (
                    <>
                        <CourseInstructor teacher={course?.teacher} />
                        <CourseStatistics course={course} />
                    </>
                );
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
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content border-0" style={{ borderRadius: "20px", overflow: "hidden" }}>
                            <div 
                                className="modal-header border-0 text-white position-relative"
                                style={{
                                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    padding: "0.75rem 1.25rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "1rem",
                                    flexWrap: "nowrap"
                                }}
                            >
                                <div className="d-flex align-items-center flex-grow-1" style={{ zIndex: 2, position: "relative" }}>
                                    <div 
                                        className="me-2"
                                        style={{
                                            width: "32px",
                                            height: "32px",
                                            background: "rgba(255, 255, 255, 0.2)",
                                            borderRadius: "8px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}
                                    >
                                        <i className="fas fa-play text-white" style={{ fontSize: "0.9rem" }}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-0 fw-bold" style={{ fontSize: "0.95rem" }}>
                                            Preview Kursus
                                        </h6>
                                        <small style={{ fontSize: "0.75rem", opacity: 0.9 }}>
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
                                        position: "relative",
                                        width: "32px",
                                        height: "32px",
                                        minWidth: "32px",
                                        minHeight: "32px",
                                        borderRadius: "50%",
                                        background: "rgba(255, 255, 255, 0.2)",
                                        border: "2px solid rgba(255, 255, 255, 0.3)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: 0,
                                        transition: "all 0.3s ease",
                                        flexShrink: 0
                                    }}
                                    onClick={(e) => {
                                        // ✨ PHASE 4.43.8: Stop both video and iframe content before closing
                                        // Step 1: Remove focus from button FIRST to prevent aria-hidden warning
                                        e.currentTarget.blur();
                                        
                                        // Step 2: Pause all video elements immediately
                                        const videos = document.querySelectorAll("#coursePreviewModal video");
                                        videos.forEach(video => {
                                            video.pause();
                                            video.currentTime = 0;
                                        });
                                        
                                        // Step 3: Stop iframes (Google Drive videos) by setting src to blank
                                        const iframes = document.querySelectorAll("#coursePreviewModal iframe");
                                        iframes.forEach(iframe => {
                                            iframe.src = "about:blank";
                                        });
                                        
                                        // Step 4: Also pause video via ref as backup
                                        const videoElement = videoRef.current;
                                        if (videoElement) {
                                            videoElement.pause();
                                            videoElement.currentTime = 0;
                                        }
                                        
                                        // Step 5: Now close the modal
                                        const modalElement = document.getElementById("coursePreviewModal");
                                        if (modalElement) {
                                            const modal = window.bootstrap.Modal.getInstance(modalElement);
                                            if (modal) {
                                                modal.hide();
                                            }
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = "rgba(255, 255, 255, 0.3)";
                                        e.target.style.transform = "scale(1.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = "rgba(255, 255, 255, 0.2)";
                                        e.target.style.transform = "scale(1)";
                                    }}
                                >
                                    <i className="fas fa-times text-white" style={{ fontSize: "1rem" }}></i>
                                </button>
                            </div>
                            <div className="modal-body p-0 bg-dark" style={{ minHeight: "400px", maxHeight: "calc(100vh - 100px)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                {/* ✨ PHASE 4.74: Fixed video container with proper YouTube detection */}
                                <div style={{ width: "100%", maxWidth: "100%", position: "relative" }}>
                                    {(() => {
                                        const videoUrl = convertGoogleDriveUrlToPreview(course.file);
                                        const isGoogleDrive = videoUrl && videoUrl.includes('drive.google.com/file') && videoUrl.includes('/preview');
                                        const isYouTubeEmbed = videoUrl && (videoUrl.includes('youtube.com/embed') || videoUrl.includes('youtube-nocookie.com/embed') || videoUrl.includes('youtu.be'));
                                        
                                        return isGoogleDrive || isYouTubeEmbed ? (
                                            // ✨ PHASE 4.74: Both Google Drive and YouTube require iframe
                                            <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden" }}>
                                                <iframe
                                                    key={videoUrl}
                                                    src={videoUrl}
                                                    style={{
                                                        border: "none",
                                                        borderRadius: "8px"
                                                    }}
                                                    sandbox="allow-same-origin allow-scripts allow-presentation"
                                                    allowFullScreen
                                                    title="Course Preview"
                                                    onError={(e) => {
                                                        console.error("Course preview iframe failed to load:", videoUrl, e);
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            // Regular video tag for direct video file URLs
                                            <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden", backgroundColor: "#000" }}>
                                                <video 
                                                    key={videoUrl}
                                                    ref={videoRef}
                                                    src={videoUrl} 
                                                    style={{ 
                                                        objectFit: "contain",
                                                        backgroundColor: "#000"
                                                    }}
                                                    controls 
                                                    onError={(e) => {
                                                        console.error("Video failed to load:", videoUrl);
                                                    }}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lesson Preview Modal - Compact Design */}
            {previewVideo && (
                <div className="modal fade" id="lessonPreviewModal" tabIndex={-1} aria-labelledby="lessonPreviewModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content border-0" style={{ borderRadius: "20px", overflow: "hidden" }}>
                            <div 
                                className="modal-header border-0 text-white position-relative"
                                style={{
                                    background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                                    padding: "0.75rem 1.25rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "1rem",
                                    flexWrap: "nowrap"
                                }}
                            >
                                <div className="d-flex align-items-center flex-grow-1" style={{ zIndex: 2, position: "relative" }}>
                                    <div 
                                        className="me-2"
                                        style={{
                                            width: "32px",
                                            height: "32px",
                                            background: "rgba(255, 255, 255, 0.2)",
                                            borderRadius: "8px",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}
                                    >
                                        <i className="fas fa-play text-white" style={{ fontSize: "0.9rem" }}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="mb-0 fw-bold" style={{ fontSize: "0.95rem" }}>
                                            {previewVideo.title}
                                        </h6>
                                        <small style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                                            <i className="fas fa-clock me-1"></i>
                                            {previewVideo.content_duration || "N/A"}
                                        </small>
                                    </div>
                                    <span className="badge bg-light text-success ms-2" style={{ fontSize: "0.7rem" }}>
                                        <i className="fas fa-eye me-1"></i>
                                        Preview
                                    </span>
                                </div>
                                
                                <button 
                                    type="button" 
                                    className="btn btn-sm"
                                    data-bs-dismiss="modal" 
                                    aria-label="Close"
                                    style={{ 
                                        zIndex: 3, 
                                        position: "relative",
                                        width: "32px",
                                        height: "32px",
                                        minWidth: "32px",
                                        minHeight: "32px",
                                        borderRadius: "50%",
                                        background: "rgba(255, 255, 255, 0.2)",
                                        border: "2px solid rgba(255, 255, 255, 0.3)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: 0,
                                        transition: "all 0.3s ease",
                                        flexShrink: 0
                                    }}
                                    onClick={(e) => {
                                        // ✨ PHASE 4.43.8: Stop both video and iframe content before closing
                                        // Step 1: Remove focus from button FIRST to prevent aria-hidden warning
                                        e.currentTarget.blur();
                                        
                                        // Step 2: Pause all video elements immediately
                                        const videos = document.querySelectorAll("#lessonPreviewModal video");
                                        videos.forEach(video => {
                                            video.pause();
                                            video.currentTime = 0;
                                        });
                                        
                                        // Step 3: Stop iframes (Google Drive videos) by setting src to blank
                                        const iframes = document.querySelectorAll("#lessonPreviewModal iframe");
                                        iframes.forEach(iframe => {
                                            iframe.src = "about:blank";
                                        });
                                        
                                        // Step 4: Reset preview state
                                        setPreviewVideo(null);
                                        
                                        // Step 5: Now close the modal
                                        const modalElement = document.getElementById("lessonPreviewModal");
                                        if (modalElement) {
                                            const modal = window.bootstrap.Modal.getInstance(modalElement);
                                            if (modal) {
                                                modal.hide();
                                            }
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.background = "rgba(255, 255, 255, 0.3)";
                                        e.target.style.transform = "scale(1.1)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background = "rgba(255, 255, 255, 0.2)";
                                        e.target.style.transform = "scale(1)";
                                    }}
                                >
                                    <i className="fas fa-times text-white" style={{ fontSize: "1rem" }}></i>
                                </button>
                            </div>
                            <div className="modal-body p-0 bg-dark" style={{ minHeight: "400px", maxHeight: "calc(100vh - 150px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {/* ✨ PHASE 4.43.3: Wrap video in aspect ratio container for proper proportional display */}
                                <div style={{ width: "100%", maxWidth: "100%", position: "relative" }}>
                                    {/* ✨ PHASE 4.74: Fixed YouTube embed handling - render as iframe not video tag */}
                                    {(() => {
                                        const videoUrl = convertGoogleDriveUrlToPreview(previewVideo.file || previewVideo.video_url);
                                        const isGoogleDrive = videoUrl && videoUrl.includes('drive.google.com/file') && videoUrl.includes('/preview');
                                        const isYouTubeEmbed = videoUrl && (videoUrl.includes('youtube.com/embed') || videoUrl.includes('youtube-nocookie.com/embed') || videoUrl.includes('youtu.be'));
                                        
                                        return isGoogleDrive || isYouTubeEmbed ? (
                                            // ✨ PHASE 4.74: Both Google Drive and YouTube require iframe
                                            <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden" }}>
                                                <iframe
                                                    key={videoUrl}
                                                    src={videoUrl}
                                                    style={{
                                                        border: "none",
                                                        borderRadius: "8px"
                                                    }}
                                                    sandbox="allow-same-origin allow-scripts allow-presentation"
                                                    allowFullScreen
                                                    title="Lesson Preview"
                                                    onError={(e) => {
                                                        console.error("Iframe failed to load:", videoUrl, e);
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            // Regular video tag for direct video file URLs
                                            <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden", backgroundColor: "#000" }}>
                                                <video 
                                                    key={videoUrl}
                                                    src={videoUrl} 
                                                    style={{ 
                                                        objectFit: "contain",
                                                        backgroundColor: "#000"
                                                    }}
                                                    controls 
                                                    onError={(e) => {
                                                        console.error("Video failed to load:", videoUrl);
                                                    }}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="modal-footer border-0 bg-light py-2">
                                <div className="w-100 text-center">
                                    <small className="text-muted">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Ini adalah preview. Daftar sekarang untuk mengakses seluruh kursus!
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
                        position: "fixed",
                        top: "50%",
                        right: "80px",
                        transform: "translateY(-50%)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        pointerEvents: "auto"
                    }}
                >
                    {/* Text label (shows when in wishlist) */}
                    {isInWishlist && (
                        <div 
                            className="floating-wishlist-label"
                            style={{
                                background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                                color: "white",
                                padding: "10px 20px",
                                borderRadius: "30px",
                                fontWeight: "600",
                                fontSize: "0.9rem",
                                boxShadow: "0 4px 15px rgba(255, 107, 107, 0.4)",
                                border: "2px solid rgba(255, 255, 255, 0.3)",
                                whiteSpace: "nowrap",
                                animation: "fadeInRight 0.3s ease",
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
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            background: isInWishlist 
                                ? "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)" 
                                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            border: "3px solid rgba(255, 255, 255, 0.3)",
                            boxShadow: "0 8px 25px rgba(102, 126, 234, 0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: isLoadingWishlist ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease",
                            padding: 0,
                            flexShrink: 0,
                            zIndex: 9999,
                            position: "relative"
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoadingWishlist) {
                                e.currentTarget.style.transform = "scale(1.1) translateY(-3px)";
                                e.currentTarget.style.boxShadow = "0 12px 35px rgba(102, 126, 234, 0.5)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1) translateY(0)";
                            e.currentTarget.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.4)";
                        }}
                        title={isInWishlist ? "Hapus dari Wishlist" : "Tambah ke Wishlist"}
                    >
                        {isLoadingWishlist ? (
                            <i className="fas fa-spinner fa-spin text-white" style={{ fontSize: "1.5rem" }}></i>
                        ) : (
                            <i 
                                className={`${isInWishlist ? "fas" : "far"} fa-heart text-white`}
                                style={{ 
                                    fontSize: "1.5rem",
                                    animation: isInWishlist ? "heartBeat 0.5s" : "none"
                                }}
                            ></i>
                        )}
                    </button>
                </div>
            )}
            
            <Footer />
        </div>
    );
}

export default CourseDetail;