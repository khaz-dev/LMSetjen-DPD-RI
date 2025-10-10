import React from "react";

const CourseActions = ({ 
    courseId, 
    isCourseInWishlist, 
    addToWishlist, 
    isEnrolled, 
    isEnrolling, 
    handleEnrollment 
}) => {
    return (
        <div className="card-body px-3">
            {/* Course Actions */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                {/* Course Info Badge */}
                <div className="d-flex align-items-center">
                    <span className="badge bg-primary-soft text-primary px-2 py-1 rounded-pill">
                        <i className="fas fa-graduation-cap me-1"></i>
                        Course Materials
                    </span>
                </div>
                
                {/* Action Buttons */}
                <div className="d-flex align-items-center gap-2">
                    {/* Wishlist heart icon */}
                    <button 
                        onClick={() => addToWishlist(courseId)} 
                        className={`btn btn-outline-danger btn-sm rounded-circle p-2 action-button ${isCourseInWishlist(courseId) ? 'active' : ''}`}
                        type="button"
                        title={isCourseInWishlist(courseId) ? "Remove from wishlist" : "Add to wishlist"}
                    >
                        <i className={`${isCourseInWishlist(courseId) ? 'fas' : 'far'} fa-heart action-button-icon`} />
                    </button>
                    
                    {/* Share button with dropdown */}
                    <div className="dropdown">
                        <button 
                            className="btn btn-outline-primary btn-sm rounded-circle p-2 action-button" 
                            type="button" 
                            id="dropdownShare" 
                            data-bs-toggle="dropdown" 
                            aria-expanded="false"
                            title="Share this course"
                        >
                            <i className="fas fa-share-alt action-button-icon" />
                        </button>
                        <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-3 mt-2 share-dropdown" aria-labelledby="dropdownShare">
                            <li className="dropdown-header px-3 py-2 bg-light rounded-top">
                                <small className="text-muted fw-bold">Share this course</small>
                            </li>
                            <li>
                                <a className="dropdown-item py-2 px-3 d-flex align-items-center share-dropdown-item" href="#">
                                    <i className="fab fa-twitter text-info me-3 share-dropdown-icon" />
                                    <span>Twitter</span>
                                </a>
                            </li>
                            <li>
                                <a className="dropdown-item py-2 px-3 d-flex align-items-center share-dropdown-item" href="#">
                                    <i className="fab fa-facebook text-primary me-3 share-dropdown-icon" />
                                    <span>Facebook</span>
                                </a>
                            </li>
                            <li>
                                <a className="dropdown-item py-2 px-3 d-flex align-items-center share-dropdown-item" href="#">
                                    <i className="fab fa-linkedin text-info me-3 share-dropdown-icon" />
                                    <span>LinkedIn</span>
                                </a>
                            </li>
                            <li><hr className="dropdown-divider my-1" /></li>
                            <li>
                                <a className="dropdown-item py-2 px-3 d-flex align-items-center share-dropdown-item" href="#">
                                    <i className="fas fa-copy text-secondary me-3 copy-link-icon" />
                                    <span>Copy link</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            
            {/* Enrollment Button */}
            <div className="mt-3 d-sm-flex justify-content-sm-between">
                <button 
                    className={`btn ${isEnrolled ? 'btn-primary' : 'btn-success'} mb-0 w-100 me-2`}
                    onClick={handleEnrollment}
                    disabled={isEnrolling}
                >
                    {isEnrolling ? (
                        <>
                            <i className="fas fa-spinner fa-spin me-2" />
                            Enrolling...
                        </>
                    ) : isEnrolled ? (
                        <>
                            Continue Learning <i className="fas fa-play text-white align-middle me-2" />
                        </>
                    ) : (
                        <>
                            Enroll Now <i className="fas fa-arrow-right text-primary align-middle me-2 text-white" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CourseActions;