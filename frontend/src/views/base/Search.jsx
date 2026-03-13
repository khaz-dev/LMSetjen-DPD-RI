import { useState, useEffect, useRef, useContext } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Rating } from "react-simple-star-rating";
import Swal from "sweetalert2";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { WishlistContext } from "../plugin/Context";
import { getImageUrl } from "../../utils/courseUtils";
import { parseDurationToSeconds } from "../../utils/durationUtils"; // ✨ PHASE 4.77+: Calculate JP
import { DEFAULT_IMAGE_URL } from "../../utils/constants";
import Toast from "../plugin/Toast";
import InstructorRequestModal from "../../components/InstructorRequestModal"; // ✨ PHASE 4.78: Instructor Request System
import apiInstance from "../../utils/axios"; // ✨ PHASE 4.78: For fetching request status

import "./Search.css";

function Search() {
    const [courses, setCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("all");
    
    // ✨ PHASE 4.78: Instructor Request System state
    const [showInstructorModal, setShowInstructorModal] = useState(false);
    const [existingInstructorRequest, setExistingInstructorRequest] = useState(null);
    
    const userData = UserData();
    const userId = userData?.user_id;
    const userRole = userData?.role; // Get user role from token (current_role)
    // ✨ PHASE 4.81: Check is_instructor boolean OR current_role is teacher
    // When admin approves instructor, is_instructor=true but current_role may still be 'student'
    // So we check BOTH: either JWT has is_instructor=true OR current_role='teacher'
    const isTeacher = userData?.is_instructor || userRole === 'teacher';
    
    // Fix: WishlistContext provides array, not object
    const wishlistContextValue = useContext(WishlistContext);
    const refreshWishlistCount = wishlistContextValue?.[2] || (() => {}); // Safely get function or noop
    
    const searchInputRef = useRef(null);
    const [searchParams] = useSearchParams();

    // Constants
    const itemsPerPage = 8;

    // Fetch courses from API
    const fetchCourse = async () => {
        setIsLoading(true);
        try {
            const response = await useAxios.get(`course/course-list/`);
            // Handle both paginated and non-paginated responses
            const coursesData = response.data?.results || response.data || [];
            // Ensure coursesData is an array
            const coursesArray = Array.isArray(coursesData) ? coursesData : [];
            
            setCourses(coursesArray);
            setAllCourses(coursesArray);
            
            // Extract unique categories from courses
            const uniqueCategories = [...new Set(coursesArray.map(course => course.category?.title).filter(Boolean))];
            setCategories(uniqueCategories);
        } catch (error) {
            // Set empty arrays on error to prevent .map() and .slice() errors
            setCourses([]);
            setAllCourses([]);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kursus",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch wishlist items
    const fetchWishlistItems = async () => {
        if (!userId) return;
        try {
            const response = await useAxios.get(`student/wishlist/${userId}/`);
            // Handle paginated API response
            // API returns { results: [...], count: N, ... } due to DRF pagination
            const wishlistData = response.data?.results || response.data || [];
            const wishlistArray = Array.isArray(wishlistData) ? wishlistData : [];
            setWishlistItems(wishlistArray);
        } catch (error) {
        }
    };

    // Check if course is in wishlist
    const isCourseInWishlist = (courseId) => {
        // Ensure wishlistItems is an array before calling .some()
        if (!Array.isArray(wishlistItems)) {
            return false;
        }
        return wishlistItems.some(item => item.course?.id === courseId);
    };

    // Add/remove from wishlist
    const addToWishlist = async (courseId) => {
        // Check if user is logged in
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Silakan login untuk menambah ke daftar keinginan",
            });
            return;
        }

        // Prevent teachers from adding to wishlist
        if (isTeacher) {
            Toast().fire({
                icon: "info",
                title: "Instruktur tidak dapat menambahkan kursus ke daftar keinginan",
            });
            return;
        }

        try {
            const formdata = new FormData();
            formdata.append("user_id", userId);
            formdata.append("course_id", courseId);

            const response = await useAxios.post(`student/wishlist/${userId}/`, formdata);
            
            // Success response
            Toast().fire({
                icon: "success",
                title: response.data.message || "Daftar keinginan berhasil diperbarui",
            });
            
            // Refresh wishlist data
            await fetchWishlistItems();
            refreshWishlistCount();
            
        } catch (error) {
            
            // Handle different error scenarios
            let errorMessage = "Kesalahan saat memperbarui daftar keinginan";
            
            if (error.response) {
                // Server responded with error
                if (error.response.status === 404) {
                    errorMessage = "Kursus tidak ditemukan";
                } else if (error.response.status === 401) {
                    errorMessage = "Silakan login lagi";
                } else if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.response.data?.detail) {
                    errorMessage = error.response.data.detail;
                }
            } else if (error.request) {
                // Request made but no response
                errorMessage = "Kesalahan jaringan. Silakan periksa koneksi Anda";
            }
            
            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
        }
    };

    // ✨ PHASE 4.77+: Calculate total JP (Jam Pelajaran) from course lectures
    // 1 JP = 45 seconds, so JP = Math.ceil(totalSeconds / 2700)
    const calculateTotalJP = (lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        
        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        
        // 1 JP = 45 minutes = 2700 seconds
        return Math.ceil(totalSeconds / 2700);
    };

    // Search handler
    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        filterCourses(query, selectedCategory);
    };

    // Category filter handler
    const handleCategoryChange = (category) => {
        setSelectedCategory(category);
        filterCourses(searchQuery, category);
        setCurrentPage(1);
    };

    // Combined filter function
    const filterCourses = (query, category) => {
        let filtered = [...allCourses];

        // Filter by search query
        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter((course) => 
                course.title.toLowerCase().includes(lowerQuery) ||
                course.teacher?.full_name?.toLowerCase().includes(lowerQuery)
            );
        }

        // Filter by category
        if (category && category !== "all") {
            filtered = filtered.filter((course) => 
                course.category?.title === category
            );
        }

        setCourses(filtered);
        setCurrentPage(1);
    };

    // Clear search
    const handleClearSearch = () => {
        setSearchQuery("");
        setSelectedCategory("all");
        setCourses(allCourses);
        setCurrentPage(1);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    // ✨ PHASE 4.78: Handle instructor request modal
    // ✨ PHASE 4.80: Added APPROVED status check (works even if JWT not refreshed after admin approval)
    const handleStartTeaching = async () => {
        // Check if user is logged in
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Silakan login terlebih dahulu",
                text: "Anda harus login untuk mengajukan permohonan instruktur"
            });
            return;
        }

        // If already teacher, show message
        if (isTeacher) {
            Toast().fire({
                icon: "info",
                title: "Anda sudah menjadi instruktur",
                text: "Anda dapat mulai membuat dan mengelola kursus"
            });
            return;
        }

        // Fetch existing request status
        try {
            const response = await apiInstance.get('/instructor-request/');
            if (response.data) {
                const requestData = Array.isArray(response.data) ? response.data[0] : response.data;
                
                // ✨ PHASE 4.80: Check if request is APPROVED (works even if JWT not refreshed yet)
                // Admin may have approved the request but JWT token not updated in browser cache
                if (requestData.status === 'APPROVED') {
                    Toast().fire({
                        icon: "info",
                        title: "Anda sudah menjadi instruktur",
                        text: "Anda dapat mulai membuat dan mengelola kursus"
                    });
                    setExistingInstructorRequest(requestData);
                    return;
                }
                
                setExistingInstructorRequest(requestData);
            }
        } catch (error) {
            // No existing request, that's fine
            setExistingInstructorRequest(null);
        }

        // Show modal
        setShowInstructorModal(true);
    };

    // Handle modal close
    const handleCloseInstructorModal = () => {
        setShowInstructorModal(false);
    };

    // Handle successful request submission
    const handleInstructorRequestSuccess = async (requestData) => {
        // Refresh the request status
        setExistingInstructorRequest(requestData);
        
        // Close modal
        setShowInstructorModal(false);
    };

    // Pagination calculations
    const coursesArray = Array.isArray(courses) ? courses : [];
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = coursesArray.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(coursesArray.length / itemsPerPage);
    const pageNumbers = Array.from(
        { length: totalPages },
        (_, index) => index + 1
    );

    // Effects
    useEffect(() => {
        const loadInitialData = async () => {
            await fetchCourse();
            if (userId) {
                await fetchWishlistItems();
            }
        };
        
        loadInitialData();
    }, [userId]);

    useEffect(() => {
        // Set initial search query and category from URL params
        const searchParam = searchParams.get('search');
        const categoryParam = searchParams.get('category');
        
        if (searchParam) {
            setSearchQuery(searchParam);
        }
        
        if (categoryParam && allCourses.length > 0) {
            // Find category title from courses
            const matchedCourse = allCourses.find(course => 
                course.category?.title?.toLowerCase() === categoryParam.toLowerCase() ||
                course.category?.slug?.toLowerCase() === categoryParam.toLowerCase()
            );
            
            if (matchedCourse) {
                const categoryTitle = matchedCourse.category.title;
                setSelectedCategory(categoryTitle);
                filterCourses(searchParam || "", categoryTitle);
            }
        } else if (searchParam) {
            filterCourses(searchParam, "all");
        }
        
        // Focus search input when component mounts
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchParams, allCourses]);

    return (
        <>
            <BaseHeader />

            <div className="modern-search-page">
                {/* Hero Section with Search */}
                <section className="search-hero-section">
                    <div className="container">
                        <div className="search-hero-content text-center">
                            <div className="row justify-content-center">
                                <div className="col-lg-8">
                                    <h1 className="display-4 fw-bold mb-4">
                                        Temukan Kursus Luar Biasa
                                    </h1>
                                    <p className="lead mb-4 opacity-90">
                                        Temukan kursus sempurna untuk meningkatkan keterampilan Anda dan mencapai tujuan pembelajaran
                                    </p>
                                    
                                    <div className="search-input-container">
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            className="form-control form-control-search"
                                            placeholder="Cari kursus, topik, atau instruktur..."
                                            value={searchQuery}
                                            onChange={handleSearch}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="clear-search-btn"
                                                onClick={handleClearSearch}
                                                title="Hapus pencarian"
                                                aria-label="Hapus input pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                        <i className="fas fa-search search-icon"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Results Section */}
                <section className="py-2">
                    <div className="container">
                        {/* Results Header */}
                        <div className="results-header-card">
                            <div className="row align-items-center mb-3">
                                <div className="col-md-6">
                                    <h3 className="mb-0 fw-bold text-dark">
                                        {searchQuery ? `Hasil Pencarian` : `Semua Kursus`}
                                    </h3>
                                    <p className="text-muted mb-0">
                                        {courses.length} kursus{courses.length !== 1 ? 's' : ''} tersedia
                                        {searchQuery && ` cocok dengan "${searchQuery}"`}
                                        {selectedCategory !== "all" && ` di ${selectedCategory}`}
                                    </p>
                                </div>
                                <div className="col-md-6 text-md-end">
                                    <div className="d-flex align-items-center justify-content-md-end gap-3">
                                        <span className="text-muted">
                                            Halaman {currentPage} dari {totalPages || 1}
                                        </span>
                                        <span className="badge bg-primary">
                                            {courses.length} Hasil
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Category Filter */}
                            <div className="category-filter-section">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span className="filter-label">
                                        <i className="fas fa-filter me-2"></i>
                                        Filter berdasarkan Kategori:
                                    </span>
                                    <button
                                        className={`category-filter-btn ${selectedCategory === "all" ? "active" : ""}`}
                                        onClick={() => handleCategoryChange("all")}
                                    >
                                        <i className="fas fa-th-large me-1"></i>
                                        Semua Kategori
                                    </button>
                                    {categories.map((category, index) => (
                                        <button
                                            key={index}
                                            className={`category-filter-btn ${selectedCategory === category ? "active" : ""}`}
                                            onClick={() => handleCategoryChange(category)}
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Loading State - Skeleton Cards */}
                        {isLoading ? (
                            <div className="row g-4">
                                {[...Array(8)].map((_, index) => (
                                    <div key={index} className="col-lg-3 col-md-6">
                                        <div 
                                            className="card border-0 h-100 skeleton-card"
                                        >
                                            <div className="skeleton-placeholder skeleton-placeholder-image"></div>
                                            <div className="card-body p-3">
                                                <div className="skeleton-placeholder skeleton-placeholder-title"></div>
                                                <div className="skeleton-placeholder skeleton-placeholder-line"></div>
                                                <div className="skeleton-placeholder skeleton-placeholder-line-last"></div>
                                                <div className="d-flex justify-content-between">
                                                    <div className="skeleton-placeholder skeleton-placeholder-meta"></div>
                                                    <div className="skeleton-placeholder skeleton-placeholder-meta"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : courses.length === 0 ? (
                            /* ✨ FIX: Enhanced Empty State with better visibility */
                            <div className="empty-state empty-state-enhanced">
                                <div className="empty-state-animation">
                                    <i className="fas fa-search empty-icon"></i>
                                </div>
                                <h4 className="mb-3 empty-state-title">Tidak Ada Kursus</h4>
                                <p className="mb-4 empty-state-message">
                                    {searchQuery 
                                        ? <>Tidak ada kursus yang cocok dengan "<strong>{searchQuery}</strong>". Coba sesuaikan istilah pencarian Anda.</>
                                        : "Tidak ada kursus yang tersedia saat ini."
                                    }
                                </p>
                                {searchQuery && (
                                    <div className="empty-state-actions">
                                        <button 
                                            className="btn btn-primary empty-state-btn"
                                            onClick={handleClearSearch}
                                        >
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Tampilkan Semua Kursus
                                        </button>
                                        <p className="empty-state-hint mt-3">
                                            <i className="fas fa-lightbulb me-2"></i>
                                            Coba kata kunci lain atau periksa ejaan
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Course Grid */
                            <>
                                <div className="row g-4">
                                    {currentItems?.map((c, index) => (
                                        <div key={c.id || index} className="col-xl-4 col-lg-4 col-md-6 col-12">
                                            <div className="course-card-modern">
                                                {/* Course Image */}
                                                <div className="course-image-container">
                                                    <img
                                                        src={getImageUrl(c.image)}
                                                        alt={c.title}
                                                        className="course-image-modern"
                                                        loading="lazy"
                                                    />
                                                    {!c.image && (
                                                        <div className="course-image-placeholder">
                                                            <i className="fas fa-play-circle"></i>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Wishlist Button - Only show for students */}
                                                    {!isTeacher && (
                                                        <button 
                                                            onClick={() => addToWishlist(c.id)} 
                                                            className="wishlist-btn"
                                                            title={isCourseInWishlist(c.id) ? "Hapus dari daftar keinginan" : "Tambah ke daftar keinginan"}
                                                            disabled={!userId}
                                                        >
                                                            <i className={`${isCourseInWishlist(c.id) ? 'fas' : 'far'} fa-heart text-danger`} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Course Content */}
                                                <div className="course-content">
                                                    <h4 className="course-title">
                                                        <Link to={`/course-detail/${c.slug}/`} className="text-decoration-none text-dark">
                                                            {c.title}
                                                        </Link>
                                                    </h4>
                                                    
                                                    <div className="course-meta-search">
                                                        <i className="fas fa-user me-1"></i>
                                                        <span>{c.teacher?.full_name || 'Instruktur Tidak Diketahui'}</span>
                                                    </div>
                                                    
                                                    {/* Students and Rating on same line - ✨ PHASE 4.77+ */}
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <div className="course-meta-search">
                                                            <i className="fas fa-users me-1"></i>
                                                            <span>{c.students?.length || 0} Siswa</span>
                                                        </div>

                                                        {/* Rating */}
                                                        <div className="rating-container" style={{ margin: 0 }}>
                                                            <Rating
                                                                initialValue={c.average_rating || 0}
                                                                readonly={true}
                                                                size={16}
                                                                fillColor="#ffc107"
                                                                emptyColor="#e4e5e9"
                                                            />
                                                            <span className="rating-score">{c.average_rating || 0}</span>
                                                            <span className="text-muted">({c.reviews?.length || 0})</span>
                                                        </div>
                                                    </div>

                                                    <div className="course-meta-search mb-2">
                                                        <span className="badge bg-info me-1">{c.level}</span>
                                                        <span className="badge bg-success">{c.category?.title || 'Umum'}</span>
                                                    </div>

                                                    {/* Total Duration in JP (Jam Pelajaran) - ✨ PHASE 4.77+ */}
                                                    <div style={{
                                                        padding: "0.6rem 0.8rem",
                                                        marginBottom: "0.8rem",
                                                        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                                        borderRadius: "6px",
                                                        border: "1px solid rgba(102, 126, 234, 0.2)",
                                                        textAlign: "center"
                                                    }}>
                                                        <small style={{ fontSize: "0.8rem", color: "#667eea", fontWeight: "500" }}>
                                                            <i className="fas fa-clock me-1"></i>
                                                            Total: <strong>{calculateTotalJP(c.lectures)}</strong> JP
                                                        </small>
                                                    </div>

                                                    {/* View Course Button */}
                                                    <Link to={`/course-detail/${c.slug}/`} className="btn-course-detail">
                                                        <span>Lihat Kursus</span>
                                                        <i className="fas fa-arrow-right"></i>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="pagination-modern">
                                        <button 
                                            className={`page-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                            onClick={() => setCurrentPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <i className="fas fa-chevron-left"></i>
                                        </button>
                                        
                                        {pageNumbers.map((number) => (
                                            <button 
                                                key={number} 
                                                className={`page-btn ${currentPage === number ? 'active' : ''}`}
                                                onClick={() => setCurrentPage(number)}
                                            >
                                                {number}
                                            </button>
                                        ))}
                                        
                                        <button 
                                            className={`page-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                            onClick={() => setCurrentPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        >
                                            <i className="fas fa-chevron-right"></i>
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Call to Action Section - Inside container at bottom */}
                        <div className="cta-section">
                            <div className="cta-content">
                                <div className="row align-items-center">
                                    <div className="col-lg-8">
                                        <h2 className="h1 mb-3">Jadilah Instruktur Hari Ini</h2>
                                        <p className="lead mb-0 opacity-90">
                                            Bagikan pengetahuan Anda dengan jutaan siswa di seluruh dunia. 
                                            Bergabunglah dengan komunitas instruktur ahli kami dan mulai mengajar apa yang Anda cintai.
                                        </p>
                                    </div>
                                    <div className="col-lg-4 text-lg-end mt-4 mt-lg-0">
                                        <button 
                                            onClick={handleStartTeaching}
                                            className="btn-cta"
                                        >
                                            <span>Mulai Mengajar</span>
                                            <i className="fas fa-arrow-right"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        {/* ✨ PHASE 4.78: Instructor Request Modal */}
        <InstructorRequestModal
            show={showInstructorModal}
            onClose={handleCloseInstructorModal}
            onSuccess={handleInstructorRequestSuccess}
            user={userData}
            existingRequest={existingInstructorRequest}
        />

        <Footer />
        </>
    );
}

export default Search;
