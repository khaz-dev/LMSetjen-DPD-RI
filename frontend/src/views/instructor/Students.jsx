import React, { useState, useEffect } from "react";
import dayjs, { moment } from "../../utils/dayjs";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { getMediaUrl } from "../../utils/constants";

// Import Students specific styles
import "./Students.css";

function Students() {
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const teacherId = UserData()?.teacher_id;
            
            if (!teacherId) {
                throw new Error("Teacher ID not found");
            }

            const response = await useAxios.get(`teacher/student-lists/${teacherId}/`);
            
            // Validate and sanitize the response data
            const studentsData = Array.isArray(response.data) ? response.data : [];
            
            // Log any students with missing data for debugging
            studentsData.forEach((student, index) => {
                if (!student.full_name) {
                    console.warn(`Student at index ${index} missing full_name:`, student);
                }
            });
            
            setStudents(studentsData);
        } catch (err) {
            console.error("Error fetching students:", err);
            setError("Failed to load students. Please try again.");
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    const getStudentImage = (student) => {
        // Check if student has image
        if (student?.image) {
            // Handle absolute URLs
            if (student.image.startsWith('http://') || student.image.startsWith('https://')) {
                return student.image;
            }
            // Use centralized helper for relative URLs
            return getMediaUrl(student.image);
        }
        
        // Generate initials-based placeholder
        const name = student?.full_name || 'Student';
        const initials = name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
        
        // Use initials in placeholder
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=80&background=667eea&color=ffffff&bold=true`;
    };

    const getStudentName = (student) => {
        // Multiple fallback options for student name
        if (student?.full_name && student.full_name.trim()) {
            return student.full_name;
        }
        if (student?.email) {
            return student.email.split('@')[0];
        }
        if (student?.user_id) {
            return `Student #${student.user_id}`;
        }
        return 'Unknown Student';
    };

    if (isLoading) {
        return (
            <>
                <BaseHeader />
                <section className="modern-students">
                    <div className="container">
                        <Header />
                        <div className="row mt-0 mt-md-4">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12">
                                <div className="students-loading">
                                    <div className="spinner-border text-primary" role="status">
                                        <span className="visually-hidden">Loading students...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Loading students...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />

            <section className="modern-students">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Header Section */}
                            <div className="students-header mb-4">
                                <div className="students-header-bg"></div>
                                <div className="d-flex justify-content-between align-items-center flex-wrap">
                                    <div className="mb-3 mb-md-0">
                                        <h3 className="students-header-title mb-2">
                                            <i className="fas fa-users me-3"></i>
                                            My Students
                                        </h3>
                                        <p className="students-header-desc text-muted mb-0">Connect with learners who are taking your courses</p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                        <div className="students-stat-badge">
                                            <i className="fas fa-user-graduate me-2"></i>
                                            {students.length} Total Students
                                        </div>
                                    </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error State */}
                            {error && (
                                <div className="error-state">
                                    <i className="fas fa-exclamation-triangle text-warning mb-3" style={{ fontSize: '3rem' }}></i>
                                    <h5 className="text-danger mb-3">Error Loading Students</h5>
                                    <p className="text-muted mb-3">{error}</p>
                                    <button className="btn btn-primary" onClick={fetchStudents}>
                                        <i className="fas fa-redo me-2"></i>Try Again
                                    </button>
                                </div>
                            )}

                            {/* Students Grid */}
                            {!error && (
                                <div className="row">
                                    {students.length > 0 ? (
                                        students.map((student, index) => (
                                            <div key={student.id || student.user_id || index} className="col-lg-4 col-md-6 col-12 mb-4">
                                                <div className="student-card">
                                                    <div className="card-body text-center p-4">
                                                        <img
                                                            src={getStudentImage(student)}
                                                            className="student-avatar"
                                                            alt={`${getStudentName(student)} avatar`}
                                                            onError={(e) => {
                                                                console.warn('Image load failed for student:', student);
                                                                const name = getStudentName(student);
                                                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=80&background=667eea&color=ffffff&bold=true`;
                                                            }}
                                                        />
                                                        <h4 className="student-name">{getStudentName(student)}</h4>
                                                        <div className="student-location">
                                                            <i className="fas fa-map-marker-alt text-primary"></i>
                                                            <span>{student.country || 'Location not specified'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="student-info">
                                                        <div className="student-date">
                                                            <span className="text-muted">
                                                                <i className="fas fa-calendar-alt me-2"></i>
                                                                Enrolled
                                                            </span>
                                                            <span className="fw-bold text-dark">
                                                                {moment(student.date).format("MMM DD, YYYY")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-12">
                                            <div className="empty-state">
                                                <i className="fas fa-user-graduate"></i>
                                                <h5 className="text-secondary mb-3">No Students Enrolled Yet</h5>
                                                <p className="text-muted">
                                                    When students start enrolling in your courses, you'll see them here. 
                                                    Create engaging content to attract more learners!
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(Students);