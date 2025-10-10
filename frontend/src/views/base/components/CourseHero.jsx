import React from "react";
import moment from "moment";
import { Rating } from "react-simple-star-rating";

const CourseHero = ({ course }) => {
    if (!course) return null;

    return (
        <section 
            className="position-relative overflow-hidden py-4"
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                minHeight: '40vh'
            }}
        >
            {/* Modern Background Pattern */}
            <div 
                className="position-absolute w-100 h-100"
                style={{
                    background: 'url("data:image/svg+xml,%3Csvg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Cpath d="M0 0h80v80H0V0zm20 20v40h40V20H20zm20 20h20v20H40V40z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                    zIndex: 1
                }}
            />
            
            <div className="container position-relative" style={{ zIndex: 2 }}>
                <div className="row justify-content-center">
                    <div className="col-lg-10">
                        <div className="text-center mb-4">
                            {/* Modern Breadcrumb */}
                            <nav aria-label="breadcrumb" className="mb-3">
                                <ol className="breadcrumb justify-content-center mb-0">
                                    <li className="breadcrumb-item">
                                        <a href="/" className="text-white text-decoration-none opacity-75">
                                            <i className="fas fa-home me-1"></i>Beranda
                                        </a>
                                    </li>
                                    <li className="breadcrumb-item">
                                        <a href="/courses" className="text-white text-decoration-none opacity-75">
                                            Kursus
                                        </a>
                                    </li>
                                    <li className="breadcrumb-item">
                                        <span className="text-white opacity-75">{course.category?.title}</span>
                                    </li>
                                </ol>
                            </nav>

                            {/* Modern Category Badges */}
                            <div className="mb-3">
                                <span 
                                    className="badge me-2 mb-2"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '25px',
                                        fontSize: '0.85rem',
                                        fontWeight: '500'
                                    }}
                                >
                                    <i className="fas fa-tag me-2"></i>
                                    {course.category?.title}
                                </span>
                                
                                {course.featured && (
                                    <span 
                                        className="badge me-2 mb-2"
                                        style={{
                                            background: 'linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)',
                                            color: 'white',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '25px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600',
                                            boxShadow: '0 4px 15px rgba(255, 193, 7, 0.3)'
                                        }}
                                    >
                                        <i className="fas fa-star me-2"></i>
                                        Unggulan
                                    </span>
                                )}
                                
                                <span 
                                    className="badge mb-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                        color: 'white',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '25px',
                                        fontSize: '0.85rem',
                                        fontWeight: '500',
                                        boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
                                    }}
                                >
                                    <i className="fas fa-signal me-2"></i>
                                    {course.level}
                                </span>
                            </div>
                            
                            {/* Modern Course Title */}
                            <h1 
                                className="display-4 fw-bold text-white mb-3"
                                style={{ 
                                    lineHeight: '1.2',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                {course.title}
                            </h1>
                            
                            {/* Modern Course Description */}
                            <p 
                                className="lead text-white mb-4"
                                style={{ 
                                    fontSize: '1.1rem',
                                    lineHeight: '1.6',
                                    opacity: '0.9',
                                    maxWidth: '800px',
                                    margin: '0 auto'
                                }}
                            >
                                {course?.description?.replace(/<[^>]*>/g, '').slice(0, 200)}...
                            </p>
                            
                            {/* Modern Course Stats Cards */}
                            <div className="row g-3 justify-content-center">
                                {/* Rating Card */}
                                <div className="col-lg-3 col-md-6">
                                    <div 
                                        className="card border-0 h-100"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <div className="card-body text-center p-3">
                                            <div className="mb-2">
                                                <Rating
                                                    initialValue={course.average_rating || 0}
                                                    readonly={true}
                                                    size={20}
                                                    fillColor="#ffc107"
                                                    emptyColor="rgba(255, 255, 255, 0.3)"
                                                />
                                            </div>
                                            <h6 className="text-white fw-bold mb-1">{(course.average_rating || 0).toFixed(1)}</h6>
                                            <small className="text-white opacity-75">{course.rating_count || 0} ulasan</small>
                                        </div>
                                    </div>
                                </div>

                                {/* Students Card */}
                                <div className="col-lg-3 col-md-6">
                                    <div 
                                        className="card border-0 h-100"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <div className="card-body text-center p-3">
                                            <div className="mb-2">
                                                <i className="fas fa-users text-white" style={{ fontSize: '1.5rem' }}></i>
                                            </div>
                                            <h6 className="text-white fw-bold mb-1">{course.students?.length || 0}</h6>
                                            <small className="text-white opacity-75">siswa terdaftar</small>
                                        </div>
                                    </div>
                                </div>

                                {/* Duration Card */}
                                <div className="col-lg-3 col-md-6">
                                    <div 
                                        className="card border-0 h-100"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <div className="card-body text-center p-3">
                                            <div className="mb-2">
                                                <i className="fas fa-clock text-white" style={{ fontSize: '1.5rem' }}></i>
                                            </div>
                                            <h6 className="text-white fw-bold mb-1">{course.lectures?.length || 0} video</h6>
                                            <small className="text-white opacity-75">total materi</small>
                                        </div>
                                    </div>
                                </div>

                                {/* Level Card */}
                                <div className="col-lg-3 col-md-6">
                                    <div 
                                        className="card border-0 h-100"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.15)',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: '15px'
                                        }}
                                    >
                                        <div className="card-body text-center p-3">
                                            <div className="mb-2">
                                                <i className="fas fa-layer-group text-white" style={{ fontSize: '1.5rem' }}></i>
                                            </div>
                                            <h6 className="text-white fw-bold mb-1">{course.curriculum?.length || 0} modul</h6>
                                            <small className="text-white opacity-75">pembelajaran</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CourseHero;