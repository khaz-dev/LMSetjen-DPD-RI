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

import "./Saerch.css";

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
            setCourses(response.data);
            setAllCourses(response.data);
            
            // Extract unique categories from courses
            const uniqueCategories = [...new Set(response.data.map(course => course.category?.title).filter(Boolean))];
            setCategories(uniqueCategories);
        } catch (error) {
            console.error("Error fetching courses:", error);
            Toast().fire({
                icon: "error",
                title: "Failed to load courses",
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
            setWishlistItems(response.data);
        } catch (error) {
            console.error("Error fetching wishlist:", error);
        }
    };

    // Check if course is in wishlist
    const isCourseInWishlist = (courseId) => {
        return wishlistItems.some(item => item.course?.id === courseId);
    };

    // Add/remove from wishlist
    const addToWishlist = async (courseId) => {
        // Check if user is logged in
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Please login to add to wishlist",
            });
            return;
        }

        // Prevent teachers from adding to wishlist
        if (isTeacher) {
            Toast().fire({
                icon: "info",
                title: "Instructors cannot add courses to wishlist",
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
                title: response.data.message || "Wishlist updated successfully",
            });
            
            // Refresh wishlist data
            await fetchWishlistItems();
            refreshWishlistCount();
            
        } catch (error) {
            console.error("[Wishlist Error]", error);
            
            // Handle different error scenarios
            let errorMessage = "Error updating wishlist";
            
            if (error.response) {
                // Server responded with error
                if (error.response.status === 404) {
                    errorMessage = "Course not found";
                } else if (error.response.status === 401) {
                    errorMessage = "Please login again";
                } else if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.response.data?.detail) {
                    errorMessage = error.response.data.detail;
                }
            } else if (error.request) {
                // Request made but no response
                errorMessage = "Network error. Please check your connection";
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
        const subject = "Application to Become an Instructor";
        const emailBody = `Hello,

I would like to apply to become an instructor on the LMS DPD RI platform.

Name: [Your Full Name]
Email: [Your Email]
Phone: [Your Phone Number]
Expertise Area: [Your Expertise]

Thank you for considering my application.

Best regards`;

        Swal.fire({
            title: '<strong>Become an Instructor</strong>',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <p style="margin-bottom: 15px; color: #555;">
                        To apply as an instructor, please send an email with the following details:
                    </p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea; display: block; margin-bottom: 5px;">
                                📧 Email To:
                            </strong>
                            <code style="background: white; padding: 8px 12px; border-radius: 6px; display: inline-block; font-size: 14px;">
                                ${email}
                            </code>
                            <button onclick="navigator.clipboard.writeText('${email}'); 
                                this.innerHTML='✓ Copied!'; 
                                this.style.background='#28a745';
                                setTimeout(() => { this.innerHTML='Copy'; this.style.background='#667eea'; }, 2000);"
                                style="margin-left: 10px; padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
                                Copy
                            </button>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <strong style="color: #667eea; display: block; margin-bottom: 5px;">
                                📋 Subject:
                            </strong>
                            <code style="background: white; padding: 8px 12px; border-radius: 6px; display: block; font-size: 14px;">
                                ${subject}
                            </code>
                        </div>
                        
                        <div>
                            <strong style="color: #667eea; display: block; margin-bottom: 5px;">
                                ✉️ Email Template:
                            </strong>
                            <textarea readonly
                                style="width: 100%; height: 200px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-family: monospace; font-size: 13px; resize: vertical;"
                                onclick="this.select();"
                            >${emailBody}</textarea>
                            <button onclick="navigator.clipboard.writeText(\`${emailBody.replace(/`/g, '\\`')}\`); 
                                this.innerHTML='✓ Template Copied!'; 
                                this.style.background='#28a745';
                                setTimeout(() => { this.innerHTML='Copy Template'; this.style.background='#667eea'; }, 2000);"
                                style="width: 100%; margin-top: 10px; padding: 10px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                Copy Template
                            </button>
                        </div>
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <strong style="color: #1976d2; display: block; margin-bottom: 5px;">
                            💡 How to Apply:
                        </strong>
                        <ol style="margin: 5px 0; padding-left: 20px; color: #555; font-size: 14px;">
                            <li>Copy the email address and template above</li>
                            <li>Open your email client (Gmail, Outlook, etc.)</li>
                            <li>Paste the email address in the "To" field</li>
                            <li>Paste the subject line</li>
                            <li>Paste the template and fill in your details</li>
                            <li>Click "Send Email" button below for quick access</li>
                        </ol>
                    </div>
                </div>
            `,
            icon: 'info',
            width: '700px',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-envelope"></i> Send Email',
            cancelButtonText: 'Close',
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
                    title: "Opening your email client...",
                    timer: 3000
                });
            }
        });
    };

    // Pagination calculations
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = courses.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(courses.length / itemsPerPage);
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
                                        Discover Amazing Courses
                                    </h1>
                                    <p className="lead mb-4 opacity-90">
                                        Find the perfect course to advance your skills and achieve your learning goals
                                    </p>
                                    
                                    <div className="search-input-container">
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            className="form-control form-control-search"
                                            placeholder="Search for courses, topics, or instructors..."
                                            value={searchQuery}
                                            onChange={handleSearch}
                                        />
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
                                        {searchQuery ? `Search Results` : `All Courses`}
                                    </h3>
                                    <p className="text-muted mb-0">
                                        {courses.length} course{courses.length !== 1 ? 's' : ''} available
                                        {searchQuery && ` matching "${searchQuery}"`}
                                        {selectedCategory !== "all" && ` in ${selectedCategory}`}
                                    </p>
                                </div>
                                <div className="col-md-6 text-md-end">
                                    <div className="d-flex align-items-center justify-content-md-end gap-3">
                                        <span className="text-muted">
                                            Page {currentPage} of {totalPages || 1}
                                        </span>
                                        <span className="badge bg-primary">
                                            {courses.length} Results
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Category Filter */}
                            <div className="category-filter-section">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <span className="filter-label">
                                        <i className="fas fa-filter me-2"></i>
                                        Filter by Category:
                                    </span>
                                    <button
                                        className={`category-filter-btn ${selectedCategory === "all" ? "active" : ""}`}
                                        onClick={() => handleCategoryChange("all")}
                                    >
                                        <i className="fas fa-th-large me-1"></i>
                                        All Categories
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
                                            className="card border-0 h-100"
                                            style={{
                                                borderRadius: '16px',
                                                background: '#f8f9fa',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div className="placeholder" style={{ height: '200px', background: '#e9ecef' }}></div>
                                            <div className="card-body p-3">
                                                <div className="placeholder rounded mb-2" style={{ width: '70%', height: '20px' }}></div>
                                                <div className="placeholder rounded mb-2" style={{ width: '100%', height: '16px' }}></div>
                                                <div className="placeholder rounded mb-3" style={{ width: '90%', height: '16px' }}></div>
                                                <div className="d-flex justify-content-between">
                                                    <div className="placeholder rounded" style={{ width: '45%', height: '14px' }}></div>
                                                    <div className="placeholder rounded" style={{ width: '45%', height: '14px' }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : courses.length === 0 ? (
                            /* Empty State */
                            <div className="empty-state">
                                <i className="fas fa-search empty-icon"></i>
                                <h4 className="mb-3">No Courses Found</h4>
                                <p className="mb-3">
                                    {searchQuery 
                                        ? `No courses match "${searchQuery}". Try adjusting your search terms.`
                                        : "No courses are available at the moment."
                                    }
                                </p>
                                {searchQuery && (
                                    <button 
                                        className="btn btn-primary"
                                        onClick={handleClearSearch}
                                    >
                                        <i className="fas fa-arrow-left me-2"></i>
                                        Show All Courses
                                    </button>
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
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                            objectPosition: 'center',
                                                            display: 'block'
                                                        }}
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
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
                                                            title={isCourseInWishlist(c.id) ? "Remove from wishlist" : "Add to wishlist"}
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
                                                        <span>{c.teacher?.full_name || 'Unknown Instructor'}</span>
                                                    </div>
                                                    
                                                    <div className="course-meta-search">
                                                        <i className="fas fa-users me-1"></i>
                                                        <span>{c.students?.length || 0} Student{(c.students?.length || 0) !== 1 ? 's' : ''}</span>
                                                    </div>

                                                    <div className="course-meta-search mb-2">
                                                        <span className="badge bg-info me-1">{c.level}</span>
                                                        <span className="badge bg-success">{c.category?.title || 'General'}</span>
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
                                                        <span>View Course</span>
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
                    </div>
                </section>

                {/* Call to Action Section */}
                <section className="container" style={{ paddingTop: '6rem', paddingBottom: '4rem' }}>
                    <div className="cta-section">
                        <div className="cta-content">
                            <div className="row align-items-center">
                                <div className="col-lg-8">
                                    <h2 className="h1 mb-3">Become an Instructor Today</h2>
                                    <p className="lead mb-0 opacity-90">
                                        Share your knowledge with millions of students worldwide. 
                                        Join our community of expert instructors and start teaching what you love.
                                    </p>
                                </div>
                                <div className="col-lg-4 text-lg-end mt-4 mt-lg-0">
                                    <button 
                                        onClick={handleStartTeaching}
                                        className="btn-cta"
                                        style={{ border: 'none', cursor: 'pointer' }}
                                    >
                                        <span>Start Teaching</span>
                                        <i className="fas fa-arrow-right"></i>
                                    </button>
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
