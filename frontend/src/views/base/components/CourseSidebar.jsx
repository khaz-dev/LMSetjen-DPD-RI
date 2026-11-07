import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import useAxios from "../../../utils/useAxios";
import UserData from "../../plugin/UserData";
import { getImageUrl } from "../../../utils/courseUtils";
import { getMediaUrl } from "../../../utils/constants";
import { calculateTotalDuration } from "../../../utils/durationUtils";

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
    const [accessInfo, setAccessInfo] = useState({ canAccess: true, message: "" });

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
            if (response.data.can_access !== undefined) {
                setAccessInfo({
                    canAccess: response.data.can_access,
                    message: response.data.restriction_message || ""
                });
            }
        } catch (error) {
            console.error("Error checking enrollment:", error);
        }
    };

    const checkWishlistStatus = async () => {
        try {
            const response = await useAxios.get(`student/wishlist/${userData.user_id}/`);
            // Handle paginated API response
            const wishlistData = response.data?.results || response.data || [];
            const wishlistItems = Array.isArray(wishlistData) ? wishlistData : [];
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
                title: 'Login Diperlukan',
                text: 'Silakan login untuk mendaftar di kursus ini',
                confirmButtonText: 'Ke Halaman Login',
                confirmButtonColor: '#0d9488'
            }).then((result) => {
                if (result.isConfirmed) {
                    navigate('/login');
                }
            });
            return;
        }

        // Check audience accessibility
        if (accessInfo.canAccess === false) {
            Swal.fire({
                icon: 'warning',
                title: 'Akses Khusus Dibatasi',
                text: accessInfo.message || 'Akun Anda tidak memenuhi klasifikasi peserta untuk kursus ini.',
                confirmButtonColor: '#002B49'
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
                title: 'Pendaftaran Berhasil!',
                text: 'Anda telah berhasil mendaftar di kursus ini',
                confirmButtonColor: '#0d9488'
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
                title: 'Pendaftaran Gagal',
                text: error.response?.data?.error || error.response?.data?.message || 'Gagal mendaftar di kursus. Silakan coba lagi.',
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
                title: 'Login Diperlukan',
                text: 'Silakan login untuk menambahkan kursus ke wishlist Anda',
                confirmButtonText: 'Ke Halaman Login',
                confirmButtonColor: '#0d9488'
            }).then((result) => {
                if (result.isConfirmed) {
                    navigate('/login');
                }
            });
            return;
        }

        // Check audience accessibility
        if (accessInfo.canAccess === false) {
            Swal.fire({
                icon: 'warning',
                title: 'Akses Khusus Dibatasi',
                text: accessInfo.message || 'Akun Anda tidak memenuhi klasifikasi peserta untuk kursus ini.',
                confirmButtonColor: '#002B49'
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
    // ✨ PHASE 8c: Fixed - Filter out students (teacher_id = 0) before comparing IDs
    const isInstructorCourse = userData?.teacher_id > 0 && course?.teacher?.id === userData.teacher_id;
    // Fix: Check if teacher_id is a valid positive number (students have teacher_id = 0)
    const isInstructor = userData?.teacher_id && userData.teacher_id > 0;

    // ✨ PHASE 8d: Multi-role support - Check if user is currently in student mode
    // For multi-role users, use current_role if available, fallback to role
    const currentRole = userData?.current_role || userData?.role;
    const isStudentMode = currentRole === "student";

    // ✅ ALL HARDCODED DATA REMOVED - Now using backend data:
    // - course.features (replaces courseFeatures)
    // - course.requirements (replaces requirements)
    // - course.learning_outcomes (replaces learningOutcomes)
    // - course.resources (replaces downloadableResources)
    // - No more courseIncludes array - can be derived from course data

    // Derive smart features if course.features is empty
    const durationData = calculateTotalDuration(course?.lectures || []);
    const smartFeatures = (course?.features && course.features.length > 0)
        ? course.features
        : [
            { id: 'f1', icon: 'fas fa-video', text: `${course?.lectures?.length || 1} Materi Pembelajaran`, highlight: true },
            { id: 'f2', icon: 'fas fa-clock', text: durationData?.withJP || 'Waktu Fleksibel', highlight: false },
            { id: 'f3', icon: 'fas fa-layer-group', text: `${course?.curriculum?.length || 1} Modul Terstruktur`, highlight: false },
            { id: 'f4', icon: 'fas fa-certificate', text: 'Sertifikat Kelulusan Resmi', highlight: true },
            { id: 'f5', icon: 'fas fa-laptop-code', text: 'Modul Interaktif & SCORM', highlight: false },
            { id: 'f6', icon: 'fas fa-infinity', text: 'Akses Penuh Fleksibel', highlight: false }
        ];

    return (
        <div className="course-sidebar-sticky">
            {/* Unified Modern Card */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-3">
                {/* Media Preview Header */}
                <div className="position-relative overflow-hidden" style={{ maxHeight: "175px" }}>
                    <img
                        src={getImageUrl(course?.image) || '/images/placeholders/default-course.svg'}
                        alt={course?.title}
                        className="w-100 object-fit-cover"
                        loading="lazy"
                        decoding="async"
                        style={{ height: '175px' }}
                        onError={(e) => {
                            e.target.src = '/images/placeholders/default-course.svg';
                        }}
                    />

                    {/* Dark gradient overlay */}
                    <div
                        className="position-absolute top-0 start-0 w-100 h-100"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)' }}
                    />

                    {/* Play Button Overlay - Only render if course has a valid video */}
                    {Boolean(
                        course?.file &&
                        course?.file_type !== 'scorm' &&
                        typeof course?.file === 'string' &&
                        course?.file.trim() !== '' &&
                        !course?.file.toLowerCase().endsWith('.zip') &&
                        !course?.file.toLowerCase().endsWith('.rar') &&
                        !course?.file.toLowerCase().endsWith('.pdf')
                    ) && (
                            <div className="position-absolute top-50 start-50 translate-middle">
                                <button
                                    className="btn rounded-circle d-flex align-items-center justify-content-center sidebar-play-btn"
                                    data-bs-toggle="modal"
                                    data-bs-target="#coursePreviewModal"
                                    aria-label="Preview Video Kursus"
                                    title="Tonton Preview Kursus"
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(4px)',
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                                        border: 'none',
                                        transition: 'all 0.25s ease'
                                    }}
                                >
                                    <i className="fas fa-play text-teal" style={{ color: '#0d9488', fontSize: '0.95rem', marginLeft: '2px' }}></i>
                                </button>
                            </div>
                        )}

                    {/* Badge GRATIS */}
                    <div
                        className="position-absolute top-0 end-0 m-2 badge"
                        style={{
                            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                            color: 'white',
                            padding: '0.35rem 0.7rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            letterSpacing: '0.03em',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    >
                        GRATIS
                    </div>
                </div>

                {/* Card Body */}
                <div className="card-body p-3 p-lg-4">
                    {/* Course Access / Target Audience Info */}
                    <div className="p-3 rounded-3 bg-light border mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom border-light-subtle">
                            {course?.target_audience === 'asn' ? (
                                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 fw-semibold" style={{ fontSize: '0.74rem' }}>
                                    <i className="fas fa-building-columns me-1"></i>Khusus ASN
                                </span>
                            ) : course?.target_audience === 'umum' ? (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-1 fw-semibold" style={{ fontSize: '0.74rem' }}>
                                    <i className="fas fa-globe me-1"></i>Akses Terbuka
                                </span>
                            ) : (
                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle rounded-pill px-2 py-1 fw-semibold" style={{ fontSize: '0.74rem' }}>
                                    <i className="fas fa-shield-halved me-1"></i>Internal DPD RI
                                </span>
                            )}
                            <span className="badge bg-emerald-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-semibold" style={{ fontSize: '0.72rem' }}>
                                <i className="fas fa-check-circle me-1"></i>100% Gratis
                            </span>
                        </div>

                        <div className="d-flex align-items-center gap-2 pt-1">
                            <div
                                className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    background: course?.target_audience === 'asn'
                                        ? 'rgba(5, 150, 105, 0.12)'
                                        : course?.target_audience === 'umum'
                                        ? 'rgba(59, 130, 246, 0.12)'
                                        : 'rgba(13, 148, 136, 0.12)',
                                    color: course?.target_audience === 'asn'
                                        ? '#059669'
                                        : course?.target_audience === 'umum'
                                        ? '#2563eb'
                                        : '#0d9488'
                                }}
                            >
                                <i className={
                                    course?.target_audience === 'asn'
                                        ? "fas fa-building-columns"
                                        : course?.target_audience === 'umum'
                                        ? "fas fa-users"
                                        : "fas fa-id-card-clip"
                                } style={{ fontSize: '1.05rem' }}></i>
                            </div>
                            <div className="min-w-0 ps-1">
                                <div className="fw-bold text-dark" style={{ fontSize: '0.88rem', lineHeight: 1.35 }}>
                                    {course?.target_audience === 'asn'
                                        ? 'Khusus ASN (Internal & Instansi Lain)'
                                        : course?.target_audience === 'umum'
                                        ? 'Terbuka untuk Umum'
                                        : 'Khusus Internal Pegawai Setjen DPD RI'}
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                                    {course?.target_audience === 'asn'
                                        ? 'Dapat diikuti seluruh ASN ber-NIP aktif'
                                        : course?.target_audience === 'umum'
                                        ? 'Dapat diikuti oleh seluruh kalangan pengguna'
                                        : 'Hanya bagi pegawai Setjen DPD RI'}
                                </div>
                            </div>
                        </div>

                        {/* Ineligibility Warning if not allowed */}
                        {accessInfo.canAccess === false && !isEnrolled && (
                            <div className="alert alert-warning py-2 px-2 rounded-2 mt-2 mb-0 d-flex align-items-start gap-2" style={{ fontSize: '0.75rem', lineHeight: 1.35 }}>
                                <i className="fas fa-lock text-warning mt-1"></i>
                                <div>
                                    <strong>Akses Terbatas:</strong> {accessInfo.message || 'Kategori akun Anda tidak sesuai dengan target peserta kursus ini.'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Primary Action Button */}
                    <div className="mb-3">
                        {isInstructorCourse && !isStudentMode ? (
                            <button
                                onClick={() => navigate(`/instructor/edit-course/${course.course_id}/`)}
                                className="btn w-100 text-white fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                                style={{
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    border: 'none',
                                    fontSize: '0.92rem'
                                }}
                            >
                                <i className="fas fa-edit me-2"></i>
                                Edit Kursus Ini
                            </button>
                        ) : isEnrolled ? (
                            <button
                                onClick={() => navigate('/student/courses/')}
                                className="btn w-100 text-white fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    border: 'none',
                                    fontSize: '0.92rem'
                                }}
                            >
                                <i className="fas fa-play-circle me-2"></i>
                                Lanjutkan Belajar
                            </button>
                        ) : (
                            <button
                                onClick={handleEnrollment}
                                disabled={loading}
                                className="btn w-100 text-white fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                                style={{
                                    background: loading ? '#94a3b8' : 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                                    border: 'none',
                                    fontSize: '0.92rem',
                                    cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin me-2"></i>
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-user-plus me-2"></i>
                                        Daftar & Mulai Belajar
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Secondary Action Buttons (Side by Side to save vertical space) */}
                    <div className="row g-2 mb-2 mt-2 pb-1">
                        {!isInstructor && (
                            <div className="col-6">
                                <button
                                    onClick={handleWishlist}
                                    disabled={isLoadingWishlist}
                                    className={`btn btn-sm w-100 py-2 rounded-3 fw-medium d-flex align-items-center justify-content-center gap-2 ${isInWishlist
                                        ? 'btn-danger text-white'
                                        : 'btn-outline-secondary'
                                        }`}
                                    style={{ fontSize: '0.82rem' }}
                                    title={isInWishlist ? 'Hapus dari Wishlist' : 'Simpan ke Wishlist'}
                                >
                                    {isLoadingWishlist ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                        <>
                                            <i className={`${isInWishlist ? 'fas' : 'far'} fa-heart ${isInWishlist ? 'text-white' : 'text-danger'}`}></i>
                                            <span className="text-truncate">{isInWishlist ? 'Tersimpan' : 'Wishlist'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        <div className={!isInstructor ? "col-6" : "col-12"}>
                            <button
                                className="btn btn-sm btn-outline-secondary w-100 py-2 rounded-3 fw-medium d-flex align-items-center justify-content-center gap-2"
                                style={{ fontSize: '0.82rem' }}
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: course?.title,
                                            text: course?.description,
                                            url: window.location.href
                                        });
                                    } else {
                                        navigator.clipboard.writeText(window.location.href);
                                        Swal.fire({
                                            icon: 'success',
                                            title: 'Tautan Disalin!',
                                            text: 'Tautan kursus berhasil disalin ke clipboard',
                                            timer: 1500,
                                            showConfirmButton: false
                                        });
                                    }
                                }}
                                title="Bagikan Kursus Ini"
                            >
                                <i className="fas fa-share-nodes text-primary"></i>
                                <span>Bagikan</span>
                            </button>
                        </div>
                    </div>

                    {/* Course Features / Highlights */}
                    <div className="pt-3 border-top">
                        <h6 className="fw-bold text-dark mb-3 small d-flex align-items-center gap-1">
                            <i className="fas fa-shield-halved text-teal" style={{ color: '#0d9488', fontSize: '0.95rem' }}></i>
                            <span>Fasilitas & Fitur Kursus:</span>
                        </h6>

                        <div className="d-flex flex-column gap-1">
                            {smartFeatures.map((item, index) => (
                                <div
                                    key={item.id || index}
                                    className="d-flex align-items-center gap-1"
                                    style={{ fontSize: '0.85rem' }}
                                >
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            background: item.highlight ? 'rgba(13, 148, 136, 0.12)' : '#f1f5f9'
                                        }}
                                    >
                                        <i
                                            className={item.icon || 'fas fa-check'}
                                            style={{
                                                fontSize: '0.75rem',
                                                color: item.highlight ? '#0d9488' : '#64748b'
                                            }}
                                        ></i>
                                    </div>
                                    <span className={`ps-1 ${item.highlight ? 'fw-semibold text-dark' : 'text-secondary'}`}>
                                        {item.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseSidebar;