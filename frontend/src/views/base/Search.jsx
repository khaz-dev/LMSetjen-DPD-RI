import { useState, useEffect, useRef, useContext } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Rating } from "react-simple-star-rating";

import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { WishlistContext } from "../plugin/Context";
import Toast from "../plugin/Toast";

import "./Saerch.css";

function Search() {
    const [courses, setCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    
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
        if (!imagePath) return "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
        if (imagePath.startsWith("http")) return imagePath;
        return `http://127.0.0.1:8000${imagePath}`;
    };

    // Fetch courses from API
    const fetchCourse = async () => {
        setIsLoading(true);
        try {
            const response = await useAxios.get(`course/course-list/`);
            setCourses(response.data);
            setAllCourses(response.data);
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
        const lowerQuery = query.toLowerCase();

        if (lowerQuery === "") {
            setCourses(allCourses);
        } else {
            const filteredCourses = allCourses.filter((course) => 
                course.title.toLowerCase().includes(lowerQuery)
            );
            setCourses(filteredCourses);
            setCurrentPage(1);
        }
    };

    // Clear search
    const handleClearSearch = () => {
        setSearchQuery("");
        setCourses(allCourses);
        setCurrentPage(1);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
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
        fetchCourse();
        if (userId) {
            fetchWishlistItems();
        }
        
        // Set initial search query from URL params
        const searchParam = searchParams.get('search');
        if (searchParam) {
            setSearchQuery(searchParam);
        }
    }, [userId]);

    useEffect(() => {
        // Focus search input when component mounts
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

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
                                    
                                    <div className="modern-search-card">
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
                                        
                                        {searchQuery && (
                                            <div className="mt-3 d-flex justify-content-between align-items-center">
                                                <small className="text-muted">
                                                    Found {courses.length} course{courses.length !== 1 ? 's' : ''} 
                                                    {searchQuery && ` for "${searchQuery}"`}
                                                </small>
                                                <button 
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={handleClearSearch}
                                                >
                                                    <i className="fas fa-times me-1"></i>
                                                    Clear
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Results Section */}
                <section className="py-3">
                    <div className="container">
                        {/* Results Header */}
                        <div className="results-header-card">
                            <div className="row align-items-center">
                                <div className="col-md-6">
                                    <h3 className="mb-0 fw-bold text-dark">
                                        {searchQuery ? `Search Results` : `All Courses`}
                                    </h3>
                                    <p className="text-muted mb-0">
                                        {courses.length} course{courses.length !== 1 ? 's' : ''} available
                                        {searchQuery && ` matching "${searchQuery}"`}
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
                        </div>

                        {/* Loading State */}
                        {isLoading ? (
                            <div className="loading-state">
                                <div className="loading-spinner-wrapper">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                                <h4>Loading courses...</h4>
                                <p>Please wait while we fetch the latest courses for you.</p>
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
                                                    
                                                    <div className="course-meta">
                                                        <i className="fas fa-user me-1"></i>
                                                        <span>{c.teacher?.full_name || 'Unknown Instructor'}</span>
                                                    </div>
                                                    
                                                    <div className="course-meta">
                                                        <i className="fas fa-users me-1"></i>
                                                        <span>{c.students?.length || 0} Student{(c.students?.length || 0) !== 1 ? 's' : ''}</span>
                                                    </div>

                                                    <div className="course-meta mb-2">
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
                <section className="container mb-2 mt-3">
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
                                    <Link to="/instructor/dashboard" className="btn-cta">
                                        <span>Start Teaching</span>
                                        <i className="fas fa-arrow-right"></i>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <BaseFooter />
        </>
    );
}

export default Search;
