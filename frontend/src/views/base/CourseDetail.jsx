import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import { getImageUrl } from "../../utils/courseUtils";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";

import "./CourseDetail.css";

// ✨ PHASE 4.75: Utility function to convert media URLs to preview/embed format
// Handles YouTube URLs for iframe embedding
const convertGoogleDriveUrlToPreview = (url) => {
    if (!url || typeof url !== 'string') return url;

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
                confirmButtonColor: "#0d9488"
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

    // Function to handle preview video / scorm / document
    const handlePreviewClick = (videoItem) => {
        // Clean up any stray backdrops before opening
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');

        setPreviewVideo(videoItem);

        setTimeout(() => {
            const modalElement = document.getElementById("lessonPreviewModal");
            if (modalElement && window.bootstrap?.Modal) {
                const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);
                modal.show();
            }
        }, 50);
    };

    // Safety cleanup on unmount: ensure no orphaned backdrops linger
    useEffect(() => {
        return () => {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
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

    // Add modal event listeners to pause videos when modals close and manage cleanup cleanly
    useEffect(() => {
        const coursePreviewModalElement = document.getElementById("coursePreviewModal");
        const lessonPreviewModalElement = document.getElementById("lessonPreviewModal");

        // Handlers for Course Preview Modal
        const handleCourseModalHide = () => {
            const videos = document.querySelectorAll("#coursePreviewModal video");
            videos.forEach(video => {
                video.pause();
            });
            if (videoRef.current) {
                videoRef.current.pause();
            }
        };

        const handleCourseModalHidden = () => {
            const videos = document.querySelectorAll("#coursePreviewModal video");
            videos.forEach(video => {
                video.pause();
                video.currentTime = 0;
            });
            const iframes = document.querySelectorAll("#coursePreviewModal iframe");
            iframes.forEach(iframe => {
                iframe.src = "about:blank";
            });
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
            // Clean up any rogue backdrops and restore scrolling
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        };

        const handleCourseModalShown = () => {
            const iframes = document.querySelectorAll("#coursePreviewModal iframe");
            if (iframes.length > 0 && course?.file) {
                const videoUrl = convertGoogleDriveUrlToPreview(course.file);
                iframes.forEach(iframe => {
                    iframe.src = videoUrl;
                });
            }
        };

        // Handlers for Lesson Preview Modal
        const handleLessonModalHide = () => {
            const videos = document.querySelectorAll("#lessonPreviewModal video");
            videos.forEach(video => {
                video.pause();
            });
        };

        const handleLessonModalHidden = () => {
            const videos = document.querySelectorAll("#lessonPreviewModal video");
            videos.forEach(video => {
                video.pause();
                video.currentTime = 0;
            });
            const iframes = document.querySelectorAll("#lessonPreviewModal iframe");
            iframes.forEach(iframe => {
                iframe.src = "about:blank";
            });
            // Reset preview video state AFTER modal is completely hidden
            setPreviewVideo(null);
            // Clean up any rogue backdrops and restore scrolling
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('padding-right');
        };

        const handleLessonModalShown = () => {
            const iframes = document.querySelectorAll("#lessonPreviewModal iframe");
            if (iframes.length > 0 && previewVideo) {
                const videoUrl = convertGoogleDriveUrlToPreview(previewVideo.file || previewVideo.video_url);
                iframes.forEach(iframe => {
                    iframe.src = videoUrl;
                });
            }
        };

        if (coursePreviewModalElement) {
            coursePreviewModalElement.addEventListener("hide.bs.modal", handleCourseModalHide);
            coursePreviewModalElement.addEventListener("hidden.bs.modal", handleCourseModalHidden);
            coursePreviewModalElement.addEventListener("show.bs.modal", handleCourseModalShown);
        }

        if (lessonPreviewModalElement) {
            lessonPreviewModalElement.addEventListener("hide.bs.modal", handleLessonModalHide);
            lessonPreviewModalElement.addEventListener("hidden.bs.modal", handleLessonModalHidden);
            lessonPreviewModalElement.addEventListener("show.bs.modal", handleLessonModalShown);
        }

        return () => {
            if (coursePreviewModalElement) {
                coursePreviewModalElement.removeEventListener("hide.bs.modal", handleCourseModalHide);
                coursePreviewModalElement.removeEventListener("hidden.bs.modal", handleCourseModalHidden);
                coursePreviewModalElement.removeEventListener("show.bs.modal", handleCourseModalShown);
            }
            if (lessonPreviewModalElement) {
                lessonPreviewModalElement.removeEventListener("hide.bs.modal", handleLessonModalHide);
                lessonPreviewModalElement.removeEventListener("hidden.bs.modal", handleLessonModalHidden);
                lessonPreviewModalElement.removeEventListener("show.bs.modal", handleLessonModalShown);
            }
        };
    }, [course?.file, previewVideo]);

    const getTabContent = () => {
        switch (activeTab) {
            case "overview":
                return (
                    <div className="d-flex flex-column gap-2">
                        {/* 1. Quick Highlight Cards Ribbon */}
                        <div className="row g-2 g-md-3 mb-1">
                            <div className="col-6 col-sm-3">
                                <div className="p-3 rounded-3 bg-white border shadow-xs d-flex align-items-center gap-2 h-100">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-teal flex-shrink-0"
                                        style={{ width: "36px", height: "36px", background: "rgba(13, 148, 136, 0.1)" }}
                                    >
                                        <i className="fas fa-cubes" style={{ fontSize: "0.95rem", color: "#0d9488" }}></i>
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Format</div>
                                        <div className="text-dark fw-bold text-truncate" style={{ fontSize: "0.85rem" }}>
                                            {course?.file_type === 'scorm' || course?.curriculum?.[0]?.variant_items?.[0]?.file_type === 'scorm' ? 'SCORM 1.2' : 'Video HD'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-6 col-sm-3">
                                <div className="p-3 rounded-3 bg-white border shadow-xs d-flex align-items-center gap-2 h-100">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-success flex-shrink-0"
                                        style={{ width: "36px", height: "36px", background: "rgba(16, 185, 129, 0.1)" }}
                                    >
                                        <i className="fas fa-infinity" style={{ fontSize: "0.95rem", color: "#10b981" }}></i>
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Akses</div>
                                        <div className="text-dark fw-bold text-truncate" style={{ fontSize: "0.85rem" }}>Seumur Hidup</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-6 col-sm-3">
                                <div className="p-3 rounded-3 bg-white border shadow-xs d-flex align-items-center gap-2 h-100">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-amber flex-shrink-0"
                                        style={{ width: "36px", height: "36px", background: "rgba(245, 158, 11, 0.1)" }}
                                    >
                                        <i className="fas fa-certificate" style={{ fontSize: "0.95rem", color: "#f59e0b" }}></i>
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Sertifikat</div>
                                        <div className="text-dark fw-bold text-truncate" style={{ fontSize: "0.85rem" }}>Resmi Setjen DPD RI</div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-6 col-sm-3">
                                <div className="p-3 rounded-3 bg-white border shadow-xs d-flex align-items-center gap-2 h-100">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                                        style={{ width: "36px", height: "36px", background: "rgba(2, 132, 199, 0.1)" }}
                                    >
                                        <i className="fas fa-award" style={{ fontSize: "0.95rem", color: "#0284c7" }}></i>
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="text-muted text-uppercase" style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0px" }}>Level</div>
                                        <div className="text-dark fw-bold text-truncate" style={{ fontSize: "0.85rem" }}>{course?.level || "Semua Level"}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Course Description Card */}
                        <div className="card border-0 shadow-xs rounded-3 bg-white overflow-hidden" style={{ borderLeft: "3px solid #0d9488" }}>
                            <div className="card-body p-3 p-md-4">
                                <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                        style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}
                                    >
                                        <i className="fas fa-align-left" style={{ fontSize: "0.8rem" }}></i>
                                    </div>
                                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                                        Deskripsi Kursus
                                    </h5>
                                </div>

                                <div
                                    className="course-description text-secondary"
                                    style={{ lineHeight: "1.7", fontSize: "0.88rem" }}
                                    dangerouslySetInnerHTML={{ __html: course?.description || "<p>Tidak ada deskripsi khusus untuk kursus ini.</p>" }}
                                />
                            </div>
                        </div>

                        {/* 3. Target & Learning Outcomes */}
                        <div className="card border-0 shadow-xs rounded-3 bg-white overflow-hidden">
                            <div className="card-body p-3 p-md-4">
                                <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                        style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                                    >
                                        <i className="fas fa-graduation-cap" style={{ fontSize: "0.8rem" }}></i>
                                    </div>
                                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                                        Target & Capaian Pembelajaran
                                    </h5>
                                </div>

                                {course?.learning_outcomes && course.learning_outcomes.length > 0 ? (
                                    <div className="row g-2 g-md-3">
                                        {course.learning_outcomes.map((item, index) => (
                                            <div key={item.id || index} className="col-md-6">
                                                <div
                                                    className="p-3 rounded-3 h-100 d-flex align-items-start gap-2"
                                                    style={{ background: "#f0fdf4", border: "1px solid #dcfce7" }}
                                                >
                                                    <i className="fas fa-circle-check text-success mt-1 flex-shrink-0" style={{ fontSize: "0.85rem", color: "#16a34a" }}></i>
                                                    <span className="text-dark fw-medium" style={{ fontSize: "0.84rem", lineHeight: "1" }}>
                                                        {item.outcome}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="row g-2 g-md-3">
                                        <div className="col-md-6">
                                            <div className="p-3 rounded-3 h-100 d-flex align-items-start gap-2" style={{ background: "#f0fdf4", border: "1px solid #dcfce7" }}>
                                                <i className="fas fa-circle-check text-success mt-1 flex-shrink-0" style={{ fontSize: "0.85rem", color: "#16a34a" }}></i>
                                                <span className="text-dark fw-medium" style={{ fontSize: "0.84rem", lineHeight: "1" }}>
                                                    Penguasaan materi modul secara komprehensif dan mandiri
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-3 rounded-3 h-100 d-flex align-items-start gap-2" style={{ background: "#f0fdf4", border: "1px solid #dcfce7" }}>
                                                <i className="fas fa-circle-check text-success mt-1 flex-shrink-0" style={{ fontSize: "0.85rem", color: "#16a34a" }}></i>
                                                <span className="text-dark fw-medium" style={{ fontSize: "0.84rem", lineHeight: "1" }}>
                                                    Penyelesaian evaluasi materi SCORM / modul interaktif
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-3 rounded-3 h-100 d-flex align-items-start gap-2" style={{ background: "#f0fdf4", border: "1px solid #dcfce7" }}>
                                                <i className="fas fa-circle-check text-success mt-1 flex-shrink-0" style={{ fontSize: "0.85rem", color: "#16a34a" }}></i>
                                                <span className="text-dark fw-medium" style={{ fontSize: "0.84rem", lineHeight: "1" }}>
                                                    Peningkatan kompetensi aparatur di lingkungan Setjen DPD RI
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="p-3 rounded-3 h-100 d-flex align-items-start gap-2" style={{ background: "#f0fdf4", border: "1px solid #dcfce7" }}>
                                                <i className="fas fa-circle-check text-success mt-1 flex-shrink-0" style={{ fontSize: "0.85rem", color: "#16a34a" }}></i>
                                                <span className="text-dark fw-medium" style={{ fontSize: "0.84rem", lineHeight: "1" }}>
                                                    Perolehan sertifikat resmi setelah kelulusan seluruh materi
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. Requirements & Prerequisites */}
                        <div className="card border-0 shadow-xs rounded-3 bg-white overflow-hidden">
                            <div className="card-body p-3 p-md-4">
                                <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                        style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}
                                    >
                                        <i className="fas fa-list-check" style={{ fontSize: "0.8rem" }}></i>
                                    </div>
                                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                                        Persyaratan & Prasyarat
                                    </h5>
                                </div>

                                {course?.requirements && course.requirements.length > 0 ? (
                                    <div className="d-flex flex-column gap-2">
                                        {course.requirements.map((item, index) => (
                                            <div key={item.id || index} className="d-flex align-items-center gap-2 p-2 px-3 rounded-3 bg-light">
                                                <i className="fas fa-check text-teal" style={{ color: "#0d9488", fontSize: "0.8rem" }}></i>
                                                <span className="small text-secondary" style={{ fontSize: "0.84rem" }}>{item.requirement}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="d-flex align-items-center gap-2 p-2 px-3 rounded-3 bg-light text-secondary small" style={{ fontSize: "0.84rem" }}>
                                        <i className="fas fa-circle-info text-teal me-1" style={{ color: "#0d9488" }}></i>
                                        <span>
                                            {course?.target_audience === 'umum'
                                                ? "Tidak ada prasyarat khusus. Kursus ini terbuka dan dapat diikuti langsung oleh masyarakat umum maupun aparatur sipil."
                                                : "Tidak ada prasyarat khusus. Kursus ini dapat diikuti langsung oleh seluruh pegawai dan aparatur di lingkungan Setjen DPD RI."}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. Instructor Quick Spotlight */}
                        {course?.teacher && (
                            <div className="card border-0 shadow-xs rounded-3 bg-white overflow-hidden">
                                <div className="card-body p-3 p-md-4">
                                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                        <div className="d-flex align-items-center gap-2">
                                            <div
                                                className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                                style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
                                            >
                                                <i className="fas fa-chalkboard-user" style={{ fontSize: "0.8rem" }}></i>
                                            </div>
                                            <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                                                Instruktur Pengajar
                                            </h5>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab("instructor")}
                                            className="btn btn-sm btn-link text-teal text-decoration-none fw-semibold p-0 d-flex align-items-center gap-1"
                                            style={{ color: "#0d9488", fontSize: "0.82rem" }}
                                        >
                                            Profil Lengkap <i className="fas fa-arrow-right" style={{ fontSize: "0.72rem" }}></i>
                                        </button>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        <img
                                            src={getImageUrl(course.teacher?.image) || '/images/placeholders/default-instructor.svg'}
                                            alt={course.teacher?.full_name}
                                            className="rounded-circle border shadow-xs flex-shrink-0"
                                            style={{ width: "52px", height: "52px", objectFit: "cover" }}
                                            onError={(e) => { e.target.src = '/images/placeholders/default-instructor.svg'; }}
                                        />
                                        <div className="flex-grow-1 min-w-0">
                                            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                                <h6 className="mb-0 fw-bold text-dark text-truncate" style={{ fontSize: "0.94rem" }}>{course.teacher?.full_name}</h6>
                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle py-0 px-2 rounded-pill" style={{ fontSize: "0.7rem" }}>
                                                    <i className="fas fa-check-circle me-1"></i>Instruktur Resmi
                                                </span>
                                            </div>
                                            <p className="text-muted small mb-2 text-truncate" style={{ fontSize: "0.8rem" }}>
                                                {course.teacher?.about || course.teacher?.bio || "Instruktur Profesional di Lingkungan Setjen DPD RI"}
                                            </p>
                                            <div className="d-flex align-items-center gap-2 small text-secondary" style={{ fontSize: "0.78rem" }}>
                                                <span><i className="fas fa-star text-warning me-1"></i>{(course.teacher?.average_rating || 5.0).toFixed(1)} Rating</span>
                                                <span><i className="fas fa-users text-teal me-1" style={{ color: "#0d9488" }}></i>{course.teacher?.total_students || 0} Siswa</span>
                                                <span><i className="fas fa-book text-muted me-1"></i>{course.teacher?.total_courses || 1} Kursus</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case "curriculum": {
                const totalModules = course?.curriculum?.length || (course?.file_type === 'scorm' ? 1 : 0);
                const totalLessons = course?.curriculum?.reduce((sum, sec) => sum + (sec.variant_items?.length || sec.items?.length || 0), 0) || course?.lectures?.length || 1;
                return (
                    <div className="card border-0 shadow-xs rounded-3 bg-white overflow-hidden">
                        <div className="card-body p-3 p-md-4">
                            {/* Header with Curriculum Stats Ribbon */}
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
                                <div className="d-flex align-items-center gap-2">
                                    <div
                                        className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                        style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)" }}
                                    >
                                        <i className="fas fa-book-bookmark" style={{ fontSize: "0.8rem" }}></i>
                                    </div>
                                    <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                                        Kurikulum & Materi Kursus
                                    </h5>
                                </div>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span className="badge bg-light text-secondary border px-2 py-1" style={{ fontSize: "0.75rem" }}>
                                        <i className="fas fa-folder me-1 text-teal"></i>{totalModules} Modul
                                    </span>
                                    <span className="badge bg-light text-secondary border px-2 py-1" style={{ fontSize: "0.75rem" }}>
                                        <i className="fas fa-file-lines me-1 text-teal"></i>{totalLessons} Materi
                                    </span>
                                </div>
                            </div>

                            {/* Real curriculum sections from backend */}
                            {course?.curriculum && course.curriculum.length > 0 ? (
                                <div className="d-flex flex-column gap-2">
                                    {course.curriculum.map((section, index) => {
                                        const items = section.variant_items || section.items || [];
                                        return (
                                            <div key={section.variant_id || index} className="border rounded-3 overflow-hidden bg-white shadow-xs">
                                                {/* Section Header */}
                                                <div className="p-3 px-3 bg-light border-bottom d-flex align-items-center justify-content-between">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className="badge rounded-circle text-white d-flex align-items-center justify-content-center flex-shrink-0"
                                                            style={{
                                                                width: "24px",
                                                                height: "24px",
                                                                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                                                fontSize: "0.72rem",
                                                                fontWeight: "700"
                                                            }}
                                                        >
                                                            {index + 1}
                                                        </span>
                                                        <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.88rem" }}>
                                                            {section.title || `Modul ${index + 1}`}
                                                        </h6>
                                                    </div>
                                                    <span className="badge bg-white text-secondary border px-2 py-1" style={{ fontSize: "0.72rem" }}>
                                                        {items.length} materi
                                                    </span>
                                                </div>

                                                {/* Show variant items/lectures */}
                                                {items.length > 0 ? (
                                                    <div>
                                                        {items.map((item, itemIndex) => {
                                                            const isScorm = item.file_type === "scorm" ||
                                                                item.learning_module_info ||
                                                                (item.title && item.title.toLowerCase().includes('scorm')) ||
                                                                (course?.title && course?.title.toLowerCase().includes('scorm')) ||
                                                                course?.file_type === 'scorm';
                                                            const isPdf = item.file_type === "pdf" ||
                                                                item.file_type === "document" ||
                                                                (typeof item.file === 'string' && item.file.toLowerCase().endsWith('.pdf'));
                                                            const itemDurationSec = item.duration_seconds || (item.content_duration ? parseDurationToSeconds(item.content_duration) : 0);

                                                            return (
                                                                <div
                                                                    key={item.variant_item_id || itemIndex}
                                                                    className={`p-3 px-3 d-flex align-items-center justify-content-between gap-2 transition-all ${itemIndex < items.length - 1 ? 'border-bottom' : ''
                                                                        }`}
                                                                    style={{ fontSize: "0.84rem" }}
                                                                >
                                                                    <div className="d-flex align-items-center gap-2 text-dark min-w-0">
                                                                        <div
                                                                            className="rounded-2 d-flex align-items-center justify-content-center flex-shrink-0"
                                                                            style={{
                                                                                width: "32px",
                                                                                height: "32px",
                                                                                background: isScorm
                                                                                    ? "rgba(13, 148, 136, 0.12)"
                                                                                    : isPdf
                                                                                        ? "rgba(239, 68, 68, 0.1)"
                                                                                        : "rgba(2, 132, 199, 0.1)"
                                                                            }}
                                                                        >
                                                                            <i
                                                                                className={isScorm ? "fas fa-cubes" : isPdf ? "fas fa-file-pdf" : (item.file_icon || "fas fa-play")}
                                                                                style={{
                                                                                    fontSize: "0.82rem",
                                                                                    color: isScorm ? "#0d9488" : isPdf ? "#ef4444" : "#0284c7"
                                                                                }}
                                                                            ></i>
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <span className="fw-semibold text-dark text-truncate d-block" style={{ fontSize: "0.85rem" }}>
                                                                                {item.title}
                                                                            </span>
                                                                            <div className="d-flex align-items-center gap-1.5 mt-0.5">
                                                                                {isScorm && (
                                                                                    <span className="badge bg-teal-subtle text-teal border border-teal-subtle py-0 px-1.5 rounded" style={{ fontSize: "0.68rem" }}>
                                                                                        Modul SCORM 1.2
                                                                                    </span>
                                                                                )}
                                                                                {isPdf && (
                                                                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle py-0 px-1.5 rounded" style={{ fontSize: "0.68rem" }}>
                                                                                        Dokumen PDF
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                                                        {isScorm ? (
                                                                            <span className="badge bg-teal-subtle text-teal border border-teal-subtle px-2 py-1" style={{ fontSize: "0.74rem" }}>
                                                                                <i className="fas fa-cubes me-1"></i>SCORM 1.2
                                                                            </span>
                                                                        ) : isPdf ? (
                                                                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1" style={{ fontSize: "0.74rem" }}>
                                                                                <i className="fas fa-file-pdf me-1"></i>Dokumen
                                                                            </span>
                                                                        ) : itemDurationSec > 0 ? (
                                                                            <span className="badge bg-light text-secondary border px-2 py-1" style={{ fontSize: "0.74rem" }}>
                                                                                <i className="fas fa-clock me-1 text-muted"></i>
                                                                                {formatDuration(itemDurationSec)}
                                                                            </span>
                                                                        ) : null}

                                                                        {item.preview && (
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-xs py-1 px-3 rounded-pill fw-semibold d-flex align-items-center gap-1 border-0"
                                                                                onClick={() => handlePreviewClick(item)}
                                                                                style={{
                                                                                    fontSize: "0.74rem",
                                                                                    background: isScorm
                                                                                        ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)"
                                                                                        : isPdf
                                                                                            ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                                                                                            : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                                                                    color: "#ffffff",
                                                                                    boxShadow: isScorm
                                                                                        ? "0 2px 6px rgba(13, 148, 136, 0.25)"
                                                                                        : isPdf
                                                                                            ? "0 2px 6px rgba(239, 68, 68, 0.25)"
                                                                                            : "0 2px 6px rgba(2, 132, 199, 0.25)"
                                                                                }}
                                                                                title={
                                                                                    isScorm
                                                                                        ? "Klik untuk melihat pratinjau modul interaktif SCORM"
                                                                                        : isPdf
                                                                                            ? "Klik untuk melihat dokumen materi"
                                                                                            : "Klik untuk menonton preview video"
                                                                                }
                                                                            >
                                                                                <i className={isScorm ? "fas fa-cubes" : isPdf ? "fas fa-file-pdf" : "fas fa-play"} style={{ fontSize: "0.68rem" }}></i>
                                                                                {isScorm ? "Pratinjau Modul" : isPdf ? "Lihat Dokumen" : "Preview"}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 text-center text-muted small" style={{ fontSize: "0.82rem" }}>
                                                        Belum ada materi dalam modul ini.
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* When course has no curriculum array but has standalone SCORM package */
                                <div className="p-4 rounded-3 bg-light border text-center">
                                    <div
                                        className="mx-auto mb-2 rounded-circle d-flex align-items-center justify-content-center text-teal"
                                        style={{ width: "48px", height: "48px", background: "rgba(13, 148, 136, 0.12)" }}
                                    >
                                        <i className="fas fa-cubes" style={{ fontSize: "1.3rem", color: "#0d9488" }}></i>
                                    </div>
                                    <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: "0.95rem" }}>Modul Pembelajaran Mandiri</h6>
                                    <p className="text-secondary small mb-3" style={{ fontSize: "0.82rem", maxWidth: "440px", margin: "0 auto", lineHeight: "1.6" }}>
                                        Materi kursus ini dikemas dalam modul e-learning interaktif terstandar SCORM yang dapat diakses langsung setelah pendaftaran.
                                    </p>
                                    <span className="badge bg-teal-subtle text-teal border border-teal-subtle py-1 px-3 rounded-pill small">
                                        <i className="fas fa-check-circle me-1"></i>Pelacakan Progres Otomatis Aktif
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            case "instructor":
                return (
                    <div className="d-flex flex-column gap-2">
                        <CourseInstructor teacher={course?.teacher} courseCount={course?.teacher?.total_courses || 1} />
                        <CourseStatistics course={course} />
                    </div>
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
                    <div className="card border-0 shadow-xs rounded-3 bg-white">
                        <div className="card-body p-3">
                            <h5 className="mb-2 fw-bold">Ringkasan Kursus</h5>
                            <p className="text-secondary small">{course?.description || "Deskripsi tidak tersedia."}</p>
                        </div>
                    </div>
                );
        }
    };

    if (isLoading) {
        return (
            <>
                <BaseHeader />
                <div className="course-detail">
                    <CourseDetailLoading />
                </div>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />
            <CourseHero course={course} />
            <div className="course-detail">

            <section className="py-3 py-md-4 base-course-detail-content">
                <div className="container">
                    <div className="row g-3 g-lg-4">
                        {/* Main Content */}
                        <div className="col-lg-8">
                            <CourseTabNavigation
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                course={course}
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

            {/* Floating Wishlist Button - Hidden for teachers/instructors, stacked above feedback button */}
            {course && !isLoading && !isTeacher && (
                <div
                    className="floating-wishlist-container"
                    style={{
                        position: "fixed",
                        bottom: "92px",
                        right: "24px",
                        zIndex: 1035,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
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
                                padding: "8px 16px",
                                borderRadius: "30px",
                                fontWeight: "600",
                                fontSize: "0.82rem",
                                boxShadow: "0 4px 15px rgba(255, 107, 107, 0.4)",
                                border: "2px solid rgba(255, 255, 255, 0.3)",
                                whiteSpace: "nowrap",
                                animation: "fadeInRight 0.3s ease",
                                zIndex: 1035
                            }}
                        >
                            Tersimpan di Wishlist
                        </div>
                    )}

                    <button
                        onClick={handleWishlist}
                        disabled={isLoadingWishlist}
                        className="btn floating-wishlist-button"
                        aria-label={isInWishlist ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
                        title={isInWishlist ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
                        style={{
                            width: "56px",
                            height: "56px",
                            borderRadius: "50%",
                            background: isInWishlist
                                ? "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)"
                                : "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                            border: "3px solid rgba(255, 255, 255, 0.3)",
                            boxShadow: "0 4px 16px rgba(13, 148, 136, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: isLoadingWishlist ? "not-allowed" : "pointer",
                            transition: "all 0.3s ease",
                            padding: 0,
                            flexShrink: 0,
                            zIndex: 1035,
                            position: "relative"
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoadingWishlist) {
                                e.currentTarget.style.transform = "scale(1.1) translateY(-3px)";
                                e.currentTarget.style.boxShadow = "0 12px 35px rgba(102, 126, 234, 0)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1) translateY(0)";
                            e.currentTarget.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.4)";
                        }}
                    >
                        {isLoadingWishlist ? (
                            <i className="fas fa-spinner fa-spin text-white" style={{ fontSize: "1rem" }}></i>
                        ) : (
                            <i
                                className={`${isInWishlist ? "fas" : "far"} fa-heart text-white`}
                                style={{
                                    fontSize: "1rem",
                                    animation: isInWishlist ? "heartBeat 0s" : "none"
                                }}
                            ></i>
                        )}
                    </button>
                </div>
            )}

            </div>
            {/* End of .course-detail */}

            {/* Course Preview Modal - Compact Design (Rendered via Portal to document.body) */}
            {typeof document !== "undefined" && createPortal(
                <div className="modal fade" id="coursePreviewModal" tabIndex={-1} aria-labelledby="coursePreviewModalLabel" aria-hidden="true" style={{ zIndex: 1065 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        {course?.file && (
                            <div className="modal-content border-0" style={{ borderRadius: "20px", overflow: "hidden" }}>
                                <div
                                    className="modal-header border-0 text-white position-relative"
                                    style={{
                                        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
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
                                            e.currentTarget.blur();
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
                                    <div style={{ width: "100%", maxWidth: "100%", position: "relative" }}>
                                        {(() => {
                                            const videoUrl = convertGoogleDriveUrlToPreview(course.file);
                                            const isYouTubeEmbed = videoUrl && (videoUrl.includes('youtube.com/embed') || videoUrl.includes('youtube-nocookie.com/embed') || videoUrl.includes('youtu.be'));

                                            return isYouTubeEmbed ? (
                                                <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden" }}>
                                                    <iframe
                                                        key={videoUrl}
                                                        src={videoUrl}
                                                        style={{ border: "none", borderRadius: "8px" }}
                                                        sandbox="allow-same-origin allow-scripts allow-presentation"
                                                        allowFullScreen
                                                        title="Course Preview"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden", backgroundColor: "#000" }}>
                                                    <video
                                                        key={videoUrl}
                                                        ref={videoRef}
                                                        src={videoUrl}
                                                        style={{ objectFit: "contain", backgroundColor: "#000" }}
                                                        controls
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Lesson Preview Modal - Adaptive Design (SCORM / PDF / Video, Rendered via Portal to document.body) */}
            {typeof document !== "undefined" && createPortal(
                <div className="modal fade" id="lessonPreviewModal" tabIndex={-1} aria-labelledby="lessonPreviewModalLabel" aria-hidden="true" style={{ zIndex: 1065 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        {previewVideo && (() => {
                            const isScormModal = previewVideo.file_type === "scorm" ||
                                previewVideo.learning_module_info ||
                                (previewVideo.title && previewVideo.title.toLowerCase().includes('scorm')) ||
                                (course?.title && course?.title.toLowerCase().includes('scorm')) ||
                                course?.file_type === 'scorm';

                            const isPdfModal = previewVideo.file_type === "pdf" ||
                                previewVideo.file_type === "document" ||
                                (typeof previewVideo.file === 'string' && previewVideo.file.toLowerCase().endsWith('.pdf'));

                            return (
                            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "16px", overflow: "hidden" }}>
                                <div
                                    className="modal-header border-0 text-white position-relative"
                                    style={{
                                        background: isScormModal
                                            ? "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)"
                                            : isPdfModal
                                                ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
                                                : "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
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
                                            <i className={isScormModal ? "fas fa-cubes text-white" : isPdfModal ? "fas fa-file-pdf text-white" : "fas fa-play text-white"} style={{ fontSize: "0.9rem" }}></i>
                                        </div>
                                        <div className="flex-grow-1">
                                            <h6 className="mb-0 fw-bold" style={{ fontSize: "0.95rem" }}>
                                                {previewVideo.title}
                                            </h6>
                                            <small style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                                                {isScormModal ? (
                                                    <>
                                                        <i className="fas fa-cubes me-1"></i>
                                                        Modul Interaktif SCORM 1.2
                                                    </>
                                                ) : isPdfModal ? (
                                                    <>
                                                        <i className="fas fa-file-pdf me-1"></i>
                                                        Dokumen Materi Pembelajaran
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-clock me-1"></i>
                                                        {previewVideo.content_duration || "Video Pembelajaran"}
                                                    </>
                                                )}
                                            </small>
                                        </div>
                                        <span className="badge bg-white ms-2 shadow-xs fw-semibold" style={{
                                            fontSize: "0.7rem",
                                            color: isScormModal ? "#0d9488" : isPdfModal ? "#dc2626" : "#0284c7"
                                        }}>
                                            <i className={isScormModal ? "fas fa-cubes me-1" : isPdfModal ? "fas fa-file-pdf me-1" : "fas fa-eye me-1"}></i>
                                            {isScormModal ? "SCORM 1.2" : isPdfModal ? "Dokumen PDF" : "Preview Video"}
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
                                            e.currentTarget.blur();
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
                                    <div style={{ width: "100%", maxWidth: "100%", position: "relative" }}>
                                        {(() => {
                                            const scormPlayerUrl = previewVideo.learning_module_info?.player_url
                                                ? (previewVideo.learning_module_info.player_url.startsWith('http')
                                                    ? previewVideo.learning_module_info.player_url
                                                    : `http://127.0.0.1:8001${previewVideo.learning_module_info.player_url}`)
                                                : null;

                                            if (scormPlayerUrl) {
                                                return (
                                                    <div style={{ width: "100%", height: "550px", backgroundColor: "#fff" }}>
                                                        <iframe
                                                            key={scormPlayerUrl}
                                                            src={scormPlayerUrl}
                                                            style={{ width: "100%", height: "100%", border: "none" }}
                                                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                                                            allowFullScreen
                                                            title="SCORM Player Preview"
                                                        />
                                                    </div>
                                                );
                                            }

                                            // If SCORM module but no direct guest URL, show dedicated SCORM showcase card
                                            if (isScormModal) {
                                                return (
                                                    <div className="p-4 p-md-5 bg-white text-center w-100" style={{ minHeight: "420px" }}>
                                                        <div
                                                            className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow-xs"
                                                            style={{
                                                                width: "68px",
                                                                height: "68px",
                                                                background: "linear-gradient(135deg, rgba(13, 148, 136, 0.15) 0%, rgba(15, 118, 110, 0.25) 100%)",
                                                                border: "2px solid rgba(13, 148, 136, 0.3)"
                                                            }}
                                                        >
                                                            <i className="fas fa-cubes text-teal" style={{ fontSize: "1.9rem", color: "#0d9488" }}></i>
                                                        </div>
                                                        <div className="mb-2">
                                                            <span className="badge bg-teal-subtle text-teal border border-teal-subtle px-3 py-1.5 rounded-pill fw-semibold d-inline-flex align-items-center gap-2" style={{ fontSize: "0.78rem" }}>
                                                                <i className="fas fa-circle-check"></i>
                                                                <span>Standar Paket E-Learning SCORM 1.2</span>
                                                            </span>
                                                        </div>
                                                        <h5 className="fw-bold text-dark mb-2" style={{ fontSize: "1.15rem" }}>
                                                            {previewVideo.title}
                                                        </h5>
                                                        <p className="text-secondary mx-auto mb-4" style={{ maxWidth: "600px", fontSize: "0.86rem", lineHeight: "1.6" }}>
                                                            Materi ini disajikan dalam format modul e-learning interaktif (SCORM). Modul mencakup simulasi multimedia, materi pembelajaran terstruktur, dan evaluasi pemahaman yang terhubung langsung dengan pelacakan progres LMS Setjen DPD RI.
                                                        </p>

                                                        <div className="row g-2 g-md-3 justify-content-center mb-4 text-start">
                                                            <div className="col-12 col-md-4">
                                                                <div className="p-3 rounded-3 bg-light border h-100">
                                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                                        <i className="fas fa-laptop-code text-teal" style={{ color: "#0d9488" }}></i>
                                                                        <strong className="text-dark small">Interaktif & Mandiri</strong>
                                                                    </div>
                                                                    <div className="text-muted" style={{ fontSize: "0.74rem", lineHeight: "1.4" }}>
                                                                        Navigasi materi fleksibel, animasi simulasi, dan kuis mandiri.
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-12 col-md-4">
                                                                <div className="p-3 rounded-3 bg-light border h-100">
                                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                                        <i className="fas fa-chart-line text-success" style={{ color: "#10b981" }}></i>
                                                                        <strong className="text-dark small">Pelacakan Otomatis</strong>
                                                                    </div>
                                                                    <div className="text-muted" style={{ fontSize: "0.74rem", lineHeight: "1.4" }}>
                                                                        Skor kuis dan progres tersimpan langsung di sistem akun Anda.
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="col-12 col-md-4">
                                                                <div className="p-3 rounded-3 bg-light border h-100">
                                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                                        <i className="fas fa-award text-warning" style={{ color: "#f59e0b" }}></i>
                                                                        <strong className="text-dark small">Sertifikat Resmi</strong>
                                                                    </div>
                                                                    <div className="text-muted" style={{ fontSize: "0.74rem", lineHeight: "1.4" }}>
                                                                        Menjadi syarat kelulusan e-sertifikat resmi Setjen DPD RI.
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm px-4 py-2 rounded-pill fw-bold text-white shadow-xs d-inline-flex align-items-center justify-content-center gap-2"
                                                                data-bs-dismiss="modal"
                                                                onClick={() => {
                                                                    const enrollBtn = document.querySelector('.course-sidebar-sticky button');
                                                                    if (enrollBtn) {
                                                                        enrollBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    }
                                                                }}
                                                                style={{
                                                                    background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                                                    fontSize: "0.82rem"
                                                                }}
                                                            >
                                                                <i className="fas fa-user-plus"></i>
                                                                <span>Daftar & Akses Modul Penuh</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-secondary px-3 py-2 rounded-pill fw-medium"
                                                                data-bs-dismiss="modal"
                                                                style={{ fontSize: "0.82rem" }}
                                                            >
                                                                Tutup Pratinjau
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // If PDF Document
                                            if (isPdfModal && previewVideo.file) {
                                                return (
                                                    <div style={{ width: "100%", height: "550px", backgroundColor: "#fff" }}>
                                                        <iframe
                                                            key={previewVideo.file}
                                                            src={previewVideo.file}
                                                            style={{ width: "100%", height: "100%", border: "none" }}
                                                            title="PDF Document Preview"
                                                        />
                                                    </div>
                                                );
                                            }

                                            const videoUrl = convertGoogleDriveUrlToPreview(previewVideo.file || previewVideo.video_url);
                                            const isYouTubeEmbed = videoUrl && (videoUrl.includes('youtube.com/embed') || videoUrl.includes('youtube-nocookie.com/embed') || videoUrl.includes('youtu.be'));

                                            return isYouTubeEmbed ? (
                                                <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden" }}>
                                                    <iframe
                                                        key={videoUrl}
                                                        src={videoUrl}
                                                        style={{ border: "none", borderRadius: "8px" }}
                                                        sandbox="allow-same-origin allow-scripts allow-presentation"
                                                        allowFullScreen
                                                        title="Lesson Preview"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="ratio ratio-16x9" style={{ borderRadius: "8px", overflow: "hidden", backgroundColor: "#000" }}>
                                                    <video
                                                        key={videoUrl}
                                                        src={videoUrl}
                                                        style={{ objectFit: "contain", backgroundColor: "#000" }}
                                                        controls
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="modal-footer border-0 bg-light py-2">
                                    <div className="w-100 text-center">
                                        <small className="text-muted" style={{ fontSize: "0.76rem" }}>
                                            <i className="fas fa-info-circle me-1"></i>
                                            {isScormModal
                                                ? "Modul SCORM dapat diakses penuh dengan interaktivitas dan pelacakan progres setelah mendaftar kursus."
                                                : isPdfModal
                                                    ? "Dokumen materi dapat dibaca dan dipelajari secara lengkap setelah mendaftar kursus."
                                                    : "Ini adalah preview video. Daftar sekarang untuk mengakses seluruh materi kursus!"}
                                        </small>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                    </div>
                </div>,
                document.body
            )}

            <Footer />
        </>
    );
}

export default CourseDetail;