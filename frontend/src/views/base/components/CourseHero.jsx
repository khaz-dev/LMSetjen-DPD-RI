import React from "react";
import dayjs from "../../../utils/dayjs";
import { Rating } from "react-simple-star-rating";

const CourseHero = ({ course }) => {
    if (!course) return null;

    return (
        <section 
            className="position-relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                paddingTop: '2rem',
                paddingBottom: '1.5rem'
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
                        <div className="text-center mb-3">
                            {/* Modern Breadcrumb */}
                            <nav aria-label="breadcrumb" className="mb-4">
                                <ol className="breadcrumb justify-content-center mb-0" style={{ fontSize: '0.85rem' }}>
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
                            <div className="mb-1">
                                <span 
                                    className="badge me-2 mb-2"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        border: '1px solid rgba(255, 255, 255, 0.3)',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: '500'
                                    }}
                                >
                                    <i className="fas fa-tag me-1"></i>
                                    {course.category?.title}
                                </span>
                                
                                {course.featured && (
                                    <span 
                                        className="badge me-2 mb-2"
                                        style={{
                                            background: 'linear-gradient(135deg, #ffc107 0%, #ff8c00 100%)',
                                            color: 'white',
                                            padding: '0.4rem 0.8rem',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            boxShadow: '0 3px 10px rgba(255, 193, 7, 0.3)'
                                        }}
                                    >
                                        <i className="fas fa-star me-1"></i>
                                        Unggulan
                                    </span>
                                )}
                                
                                <span 
                                    className="badge mb-2"
                                    style={{
                                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                        color: 'white',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: '500',
                                        boxShadow: '0 3px 10px rgba(40, 167, 69, 0.3)'
                                    }}
                                >
                                    <i className="fas fa-signal me-1"></i>
                                    {course.level}
                                </span>
                            </div>
                            
                            {/* Modern Course Title */}
                            <h3 
                                className="h1 fw-bold text-white mb-3"
                                style={{ 
                                    lineHeight: '1.3',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                {course.title}
                            </h3>
                            
                            {/* Modern Course Stats Cards - Centered & Compact */}
                            <div className="d-flex gap-2 justify-content-center flex-wrap" style={{ maxWidth: '500px', margin: '0 auto' }}>
                                {/* Rating Card */}
                                <div 
                                    className="text-center"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '0.5rem 0.4rem',
                                        minWidth: '105px'
                                    }}
                                >
                                    <div style={{ marginBottom: '0.3rem' }}>
                                        <Rating
                                            initialValue={course.average_rating || 0}
                                            readonly={true}
                                            size={14}
                                            fillColor="#ffc107"
                                            emptyColor="rgba(255, 255, 255, 0.3)"
                                        />
                                    </div>
                                    <div className="text-white fw-bold" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{(course.average_rating || 0).toFixed(1)}</div>
                                    <small className="text-white opacity-75" style={{ fontSize: '0.7rem', display: 'block', whiteSpace: 'nowrap' }}>{course.rating_count || 0} ulasan</small>
                                </div>

                                {/* Students Card */}
                                <div 
                                    className="text-center"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '0.5rem 0.4rem',
                                        minWidth: '90px'
                                    }}
                                >
                                    <div style={{ marginBottom: '0.3rem' }}>
                                        <i className="fas fa-users text-white" style={{ fontSize: '1.2rem' }}></i>
                                    </div>
                                    <div className="text-white fw-bold" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{course.students?.length || 0}</div>
                                    <small className="text-white opacity-75" style={{ fontSize: '0.7rem', display: 'block' }}>siswa</small>
                                </div>

                                {/* Duration Card */}
                                <div 
                                    className="text-center"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '0.5rem 0.4rem',
                                        minWidth: '90px'
                                    }}
                                >
                                    <div style={{ marginBottom: '0.3rem' }}>
                                        <i className="fas fa-clock text-white" style={{ fontSize: '1.2rem' }}></i>
                                    </div>
                                    <div className="text-white fw-bold" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{course.lectures?.length || 0} video</div>
                                    <small className="text-white opacity-75" style={{ fontSize: '0.7rem', display: 'block' }}>materi</small>
                                </div>

                                {/* Level Card */}
                                <div 
                                    className="text-center"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '10px',
                                        padding: '0.5rem 0.4rem',
                                        minWidth: '105px'
                                    }}
                                >
                                    <div style={{ marginBottom: '0.3rem' }}>
                                        <i className="fas fa-layer-group text-white" style={{ fontSize: '1.2rem' }}></i>
                                    </div>
                                    <div className="text-white fw-bold" style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>{course.curriculum?.length || 0} modul</div>
                                    <small className="text-white opacity-75" style={{ fontSize: '0.7rem', display: 'block' }}>pembelajaran</small>
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