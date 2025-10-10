import React from "react";

// Hero Section Skeleton
export const CourseHeroSkeleton = () => (
    <section className="position-relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
        minHeight: '500px'
    }}>
        <div className="container position-relative">
            <div className="row align-items-center py-5">
                <div className="col-lg-8">
                    {/* Breadcrumb Skeleton */}
                    <div className="mb-3">
                        <div className="d-flex">
                            <div className="placeholder rounded" style={{ width: '60px', height: '20px' }}></div>
                            <div className="placeholder rounded ms-2" style={{ width: '80px', height: '20px' }}></div>
                            <div className="placeholder rounded ms-2" style={{ width: '100px', height: '20px' }}></div>
                        </div>
                    </div>

                    {/* Category Badge Skeleton */}
                    <div className="mb-3">
                        <div className="placeholder rounded-pill" style={{ width: '120px', height: '35px' }}></div>
                    </div>
                    
                    {/* Title Skeleton */}
                    <div className="mb-3">
                        <div className="placeholder rounded" style={{ width: '80%', height: '50px' }}></div>
                        <div className="placeholder rounded mt-2" style={{ width: '60%', height: '50px' }}></div>
                    </div>
                    
                    {/* Description Skeleton */}
                    <div className="mb-4">
                        <div className="placeholder rounded" style={{ width: '100%', height: '20px' }}></div>
                        <div className="placeholder rounded mt-2" style={{ width: '90%', height: '20px' }}></div>
                        <div className="placeholder rounded mt-2" style={{ width: '70%', height: '20px' }}></div>
                    </div>
                    
                    {/* Stats Skeleton */}
                    <div className="row g-3 mb-4">
                        <div className="col-auto">
                            <div className="placeholder rounded" style={{ width: '150px', height: '25px' }}></div>
                        </div>
                        <div className="col-auto">
                            <div className="placeholder rounded" style={{ width: '120px', height: '25px' }}></div>
                        </div>
                        <div className="col-auto">
                            <div className="placeholder rounded" style={{ width: '100px', height: '25px' }}></div>
                        </div>
                    </div>

                    {/* Author Skeleton */}
                    <div className="d-flex align-items-center">
                        <div className="placeholder rounded-circle me-3" style={{ width: '50px', height: '50px' }}></div>
                        <div>
                            <div className="placeholder rounded" style={{ width: '180px', height: '20px' }}></div>
                            <div className="placeholder rounded mt-1" style={{ width: '150px', height: '16px' }}></div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card shadow-lg border-0">
                        <div className="placeholder" style={{ height: '200px', borderRadius: '15px 15px 0 0' }}></div>
                        <div className="card-body p-4">
                            <div className="placeholder rounded mb-3" style={{ width: '100%', height: '60px' }}></div>
                            <div className="placeholder rounded mb-3" style={{ width: '100%', height: '50px' }}></div>
                            <div className="placeholder rounded" style={{ width: '100%', height: '40px' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

// Instructor Section Skeleton
export const CourseInstructorSkeleton = () => (
    <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
            <div className="placeholder rounded mb-4" style={{ width: '250px', height: '30px' }}></div>
            
            <div className="row">
                <div className="col-lg-4 text-center mb-4">
                    <div className="placeholder rounded-circle mx-auto mb-3" style={{ width: '150px', height: '150px' }}></div>
                    <div className="placeholder rounded mx-auto mb-2" style={{ width: '120px', height: '25px' }}></div>
                    <div className="placeholder rounded mx-auto mb-3" style={{ width: '200px', height: '20px' }}></div>
                    
                    <div className="row g-2">
                        <div className="col-4">
                            <div className="placeholder rounded" style={{ height: '60px' }}></div>
                        </div>
                        <div className="col-4">
                            <div className="placeholder rounded" style={{ height: '60px' }}></div>
                        </div>
                        <div className="col-4">
                            <div className="placeholder rounded" style={{ height: '60px' }}></div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-8">
                    <div className="mb-4">
                        <div className="placeholder rounded mb-3" style={{ width: '200px', height: '25px' }}></div>
                        <div className="placeholder rounded mb-2" style={{ width: '100%', height: '20px' }}></div>
                        <div className="placeholder rounded mb-2" style={{ width: '90%', height: '20px' }}></div>
                        <div className="placeholder rounded" style={{ width: '80%', height: '20px' }}></div>
                    </div>
                    
                    <div className="mb-4">
                        <div className="placeholder rounded mb-3" style={{ width: '180px', height: '25px' }}></div>
                        <div className="d-flex gap-2">
                            <div className="placeholder rounded-pill" style={{ width: '120px', height: '30px' }}></div>
                            <div className="placeholder rounded-pill" style={{ width: '100px', height: '30px' }}></div>
                            <div className="placeholder rounded-pill" style={{ width: '140px', height: '30px' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// Reviews Section Skeleton
export const CourseReviewsSkeleton = () => (
    <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
            <div className="row">
                <div className="col-lg-4 mb-4">
                    <div className="bg-light rounded-3 p-4 text-center">
                        <div className="placeholder rounded mx-auto mb-2" style={{ width: '80px', height: '60px' }}></div>
                        <div className="placeholder rounded mx-auto mb-2" style={{ width: '120px', height: '25px' }}></div>
                        <div className="placeholder rounded mx-auto" style={{ width: '150px', height: '20px' }}></div>
                    </div>
                </div>

                <div className="col-lg-8">
                    <div className="placeholder rounded mb-4" style={{ width: '200px', height: '30px' }}></div>
                    
                    {[1, 2, 3].map((index) => (
                        <div key={index} className="border-bottom pb-4 mb-4">
                            <div className="d-flex align-items-start">
                                <div className="placeholder rounded-circle me-3" style={{ width: '50px', height: '50px' }}></div>
                                <div className="flex-grow-1">
                                    <div className="placeholder rounded mb-2" style={{ width: '150px', height: '20px' }}></div>
                                    <div className="placeholder rounded mb-3" style={{ width: '100%', height: '20px' }}></div>
                                    <div className="placeholder rounded mb-3" style={{ width: '90%', height: '20px' }}></div>
                                    <div className="placeholder rounded" style={{ width: '120px', height: '30px' }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// Statistics Section Skeleton
export const CourseStatisticsSkeleton = () => (
    <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
            <div className="placeholder rounded mb-4" style={{ width: '300px', height: '30px' }}></div>
            
            <div className="row g-4 mb-5">
                {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="col-md-3">
                        <div className="placeholder rounded-3" style={{ height: '120px' }}></div>
                    </div>
                ))}
            </div>

            <div className="row g-4">
                <div className="col-lg-6">
                    <div className="bg-light rounded-3 p-4">
                        <div className="placeholder rounded mb-3" style={{ width: '200px', height: '25px' }}></div>
                        <div className="placeholder rounded" style={{ height: '250px' }}></div>
                    </div>
                </div>
                <div className="col-lg-6">
                    <div className="bg-light rounded-3 p-4">
                        <div className="placeholder rounded mb-3" style={{ width: '250px', height: '25px' }}></div>
                        <div className="placeholder rounded" style={{ height: '250px' }}></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// Sidebar Skeleton
export const CourseSidebarSkeleton = () => (
    <div className="sticky-top" style={{ top: '20px' }}>
        <div className="card border-0 shadow-sm mb-4">
            <div className="card-header">
                <div className="placeholder rounded" style={{ width: '180px', height: '25px' }}></div>
            </div>
            <div className="card-body p-3">
                {[1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className="d-flex align-items-center py-2">
                        <div className="placeholder rounded me-3" style={{ width: '20px', height: '20px' }}></div>
                        <div className="placeholder rounded" style={{ width: '150px', height: '16px' }}></div>
                    </div>
                ))}
            </div>
        </div>

        {[1, 2, 3].map((index) => (
            <div key={index} className="card border-0 shadow-sm mb-3">
                <div className="card-header">
                    <div className="placeholder rounded" style={{ width: '120px', height: '20px' }}></div>
                </div>
                <div className="card-body p-3">
                    <div className="placeholder rounded mb-2" style={{ width: '100%', height: '16px' }}></div>
                    <div className="placeholder rounded mb-2" style={{ width: '90%', height: '16px' }}></div>
                    <div className="placeholder rounded" style={{ width: '80%', height: '16px' }}></div>
                </div>
            </div>
        ))}
    </div>
);

// FAQ Skeleton
export const CourseFAQSkeleton = () => (
    <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-4">
            <div className="text-center mb-5">
                <div className="placeholder rounded mx-auto mb-3" style={{ width: '300px', height: '30px' }}></div>
                <div className="placeholder rounded mx-auto" style={{ width: '400px', height: '20px' }}></div>
            </div>

            <div className="col-lg-8 mx-auto">
                {[1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className="card border mb-3">
                        <div className="card-header">
                            <div className="placeholder rounded" style={{ width: '80%', height: '20px' }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// Main Loading Component
const CourseDetailLoading = () => {
    return (
        <div className="animate__animated animate__fadeIn">
            <CourseHeroSkeleton />
            
            <div className="container mt-5">
                <div className="row">
                    <div className="col-lg-8">
                        <CourseInstructorSkeleton />
                        <CourseReviewsSkeleton />
                        <CourseStatisticsSkeleton />
                        <CourseFAQSkeleton />
                    </div>
                    
                    <div className="col-lg-4">
                        <CourseSidebarSkeleton />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CourseDetailLoading;