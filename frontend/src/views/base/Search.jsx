import { useState, useEffect, useRef, useContext } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Rating } from "react-simple-star-rating";
import Swal from "sweetalert2";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { WishlistContext } from "../plugin/Context";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import Toast from "../plugin/Toast";

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
    
    const userData = UserData();
    const userId = userData?.user_id;
    const userRole = userData?.role; // Get user role from token
    const isTeacher = userRole === 'teacher'; // Check if user is teacher/instructor
    
    // Fix: WishlistContext provides array, not object
    const wishlistContextValue = useContext(WishlistContext);
    const refreshWishlistCount = wishlistContextValue?.[2] || (() => {}); // Safely get function or noop
    
    const searchInputRef = useRef(null);
    const [searchParams] = useSearchParams();

    // Constants
    const itemsPerPage = 8;

    // Image URL helper function
    const getImageUrl = (imagePath) => {
        if (!imagePath) return DEFAULT_IMAGE_URL;
        if (imagePath.startsWith("http")) return imagePath;
        return getMediaUrl(imagePath);
    };

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
            console.error("Error fetching courses:", error);
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
            console.error("Error fetching wishlist:", error);
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
            console.error("[Wishlist Error]", error);
            
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

    // Handle instructor application email
    const handleStartTeaching = () => {
        const email = "sdm@dpd.go.id";
        const subject = "Aplikasi untuk Menjadi Instruktur";
        const emailBody = `Halo,

Saya ingin mengajukan aplikasi untuk menjadi instruktur di platform LMS DPD RI.

Nama: [Nama Lengkap Anda]
Email: [Email Anda]
Nomor Telepon: [Nomor Telepon Anda]
Area Keahlian: [Keahlian Anda]

Terima kasih atas pertimbangan aplikasi saya.

Salam hormat,`;

        Swal.fire({
            title: '<strong>Jadilah Instruktur</strong>',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <p style="margin-bottom: 15px; color: #555;">
                        Untuk mendaftar sebagai instruktur, silakan kirim email dengan detail berikut:
                    </p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea; display: block; margin-bottom: 5px;">
                                📧 Kirim Email Ke:
                            </strong>
                            <code style="background: white; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 14px;">
                                ${email}
                            </code>
                            <button onclick="navigator.clipboard.writeText('${email}'); 
                                this.innerHTML='✓ Disalin!'; 
                                this.style.background='#28a745';
                                setTimeout(() => { this.innerHTML='Salin'; this.style.background='#667eea'; }, 2000);"
                                style="margin-left: 10px; padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                                Salin
                            </button>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea; display: block; margin-bottom: 5px;">
                                📋 Subjek:
                            </strong>
                            <code style="background: white; padding: 8px 12px; border-radius: 6px; display: block; font-size: 14px;">
                                ${subject}
                            </code>
                        </div>
                        
                        <div>
                            <strong style="color: #667eea; display: block; margin-bottom: 5px;">
                                ✉️ Template Email:
                            </strong>
                            <textarea readonly
                                style="width: 100%; height: 200px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; font-size: 13px; resize: vertical;"
                                onclick="this.select();"
                            >${emailBody}</textarea>
                            <button onclick="navigator.clipboard.writeText(\`${emailBody.replace(/`/g, '\\`')}\`); 
                                this.innerHTML='✓ Template Disalin!'; 
                                this.style.background='#28a745';
                                setTimeout(() => { this.innerHTML='Salin Template'; this.style.background='#667eea'; }, 2000);"
                                style="width: 100%; margin-top: 10px; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                Salin Template
                            </button>
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <strong style="color: #1976d2; display: block; margin-bottom: 5px;">
                            💡 Cara Mendaftar:
                        </strong>
                        <ol style="margin: 5px 0; padding-left: 20px; color: #555; font-size: 14px;">
                            <li>Salin alamat email dan template di atas</li>
                            <li>Buka klien email Anda (Gmail, Outlook, dll)</li>
                            <li>Tempel alamat email di bidang "Ke"</li>
                            <li>Tempel baris subjek</li>
                            <li>Tempel template dan isi detail Anda</li>
                            <li>Klik tombol "Kirim Email" di bawah untuk akses cepat</li>
                        </ol>
                    </div>
                </div>
            `,
            icon: 'info',
            width: '700px',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-envelope"></i> Kirim Email',
            cancelButtonText: 'Tutup',
            confirmButtonColor: '#667eea',
            cancelButtonColor: '#6c757d',
            customClass: {
                confirmButton: 'btn-lg',
                cancelButton: 'btn-lg'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Try to open email client with mailto
                const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
                window.open(mailtoLink, '_blank');
                
                Toast().fire({
                    icon: "success",
                    title: "Membuka klien email Anda...",
                    timer: 3000
                });
            }
        });
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
                                                    
                                                    <div className="course-meta-search">
                                                        <i className="fas fa-users me-1"></i>
                                                        <span>{c.students?.length || 0} Siswa{(c.students?.length || 0) !== 1 ? 's' : ''}</span>
                                                    </div>

                                                    <div className="course-meta-search mb-2">
                                                        <span className="badge bg-info me-1">{c.level}</span>
                                                        <span className="badge bg-success">{c.category?.title || 'Umum'}</span>
                                                    </div>

                                                    {/* Rating */}
                                                    <div className="rating-container">
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
        <Footer />
        </>
    );
}

export default Search;
