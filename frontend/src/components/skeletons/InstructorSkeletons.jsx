import React from 'react';
import './SkeletonComponents.css';
import { SkeletonBox, SkeletonCircle, SkeletonCard } from './SkeletonComponents';

/**
 * Instructor-specific Skeleton Loaders
 * Professional loading states for instructor dashboard and pages
 */

// ==========================================
// INSTRUCTOR DASHBOARD SKELETON
// ==========================================

export const SkeletonInstructorDashboard = () => {
    return (
        <div className="skeleton-instructor-dashboard">
            {/* Stats Cards Row */}
            <div className="row g-4 mb-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="col-xl-3 col-lg-6 col-md-6">
                        <div className="card border-0 skeleton-stat-card">
                            <div className="card-body p-4">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div style={{ flex: 1 }}>
                                        <SkeletonBox width="60%" height="14px" style={{ marginBottom: '12px' }} />
                                        <SkeletonBox width="50%" height="32px" style={{ marginBottom: '8px' }} />
                                        <SkeletonBox width="70%" height="12px" />
                                    </div>
                                    <SkeletonCircle size="48px" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="row g-4 mb-4">
                <div className="col-xl-8 col-lg-7">
                    <div className="card border-0">
                        <div className="card-body p-4">
                            <SkeletonBox width="30%" height="20px" style={{ marginBottom: '20px' }} />
                            <SkeletonBox width="100%" height="300px" borderRadius="12px" />
                        </div>
                    </div>
                </div>
                <div className="col-xl-4 col-lg-5">
                    <div className="card border-0">
                        <div className="card-body p-4">
                            <SkeletonBox width="40%" height="20px" style={{ marginBottom: '20px' }} />
                            <SkeletonBox width="100%" height="300px" borderRadius="12px" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity & Top Courses */}
            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card border-0">
                        <div className="card-body p-4">
                            <SkeletonBox width="40%" height="20px" style={{ marginBottom: '20px' }} />
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="d-flex align-items-center mb-3 pb-3" style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <SkeletonCircle size="40px" style={{ marginRight: '15px' }} />
                                    <div style={{ flex: 1 }}>
                                        <SkeletonBox width="80%" height="14px" style={{ marginBottom: '6px' }} />
                                        <SkeletonBox width="50%" height="12px" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="col-lg-6">
                    <div className="card border-0">
                        <div className="card-body p-4">
                            <SkeletonBox width="40%" height="20px" style={{ marginBottom: '20px' }} />
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="mb-3">
                                    <SkeletonBox width="100%" height="60px" borderRadius="8px" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Overview */}
            <div className="row g-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="col-lg-4 col-md-6">
                        <div className="card border-0">
                            <div className="card-body p-4">
                                <SkeletonBox width="100%" height="150px" borderRadius="12px" style={{ marginBottom: '15px' }} />
                                <SkeletonBox width="80%" height="16px" style={{ marginBottom: '8px' }} />
                                <SkeletonBox width="60%" height="14px" style={{ marginBottom: '12px' }} />
                                <div className="d-flex justify-content-between">
                                    <SkeletonBox width="45%" height="12px" />
                                    <SkeletonBox width="30%" height="12px" />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==========================================
// INSTRUCTOR COURSES SKELETON
// ==========================================

export const SkeletonInstructorCourses = ({ count = 6 }) => {
    return (
        <div className="row g-4">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="col-lg-4 col-md-6">
                    <div className="card border-0 skeleton-course-card">
                        <SkeletonBox width="100%" height="200px" borderRadius="12px 12px 0 0" />
                        <div className="card-body p-4">
                            <SkeletonBox width="40%" height="12px" style={{ marginBottom: '12px' }} />
                            <SkeletonBox width="90%" height="18px" style={{ marginBottom: '8px' }} />
                            <SkeletonBox width="70%" height="18px" style={{ marginBottom: '15px' }} />
                            <SkeletonBox width="60%" height="14px" style={{ marginBottom: '15px' }} />
                            <div className="d-flex justify-content-between mb-3">
                                <SkeletonBox width="45%" height="14px" />
                                <SkeletonBox width="30%" height="14px" />
                            </div>
                            <div className="d-flex gap-2">
                                <SkeletonBox width="48%" height="38px" borderRadius="8px" />
                                <SkeletonBox width="48%" height="38px" borderRadius="8px" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ==========================================
// INSTRUCTOR STUDENTS SKELETON
// ==========================================

export const SkeletonInstructorStudents = ({ rows = 10 }) => {
    return (
        <div className="card border-0">
            <div className="card-body p-4">
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                {['Student', 'Email', 'Courses', 'Progress', 'Status', 'Actions'].map((header, i) => (
                                    <th key={i}>
                                        <SkeletonBox width="80%" height="14px" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(rows)].map((_, i) => (
                                <tr key={i}>
                                    <td>
                                        <div className="d-flex align-items-center">
                                            <SkeletonCircle size="40px" style={{ marginRight: '12px' }} />
                                            <div>
                                                <SkeletonBox width="100px" height="14px" style={{ marginBottom: '4px' }} />
                                                <SkeletonBox width="80px" height="12px" />
                                            </div>
                                        </div>
                                    </td>
                                    <td><SkeletonBox width="150px" height="14px" /></td>
                                    <td><SkeletonBox width="60px" height="14px" /></td>
                                    <td><SkeletonBox width="100%" height="8px" borderRadius="10px" /></td>
                                    <td><SkeletonBox width="80px" height="24px" borderRadius="12px" /></td>
                                    <td><SkeletonBox width="100px" height="32px" borderRadius="6px" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// INSTRUCTOR QA SKELETON
// ==========================================

export const SkeletonInstructorQA = ({ count = 8 }) => {
    return (
        <div className="skeleton-qa-list">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="card border-0 mb-3">
                    <div className="card-body p-4">
                        <div className="d-flex align-items-start mb-3">
                            <SkeletonCircle size="48px" style={{ marginRight: '15px' }} />
                            <div style={{ flex: 1 }}>
                                <SkeletonBox width="85%" height="18px" style={{ marginBottom: '8px' }} />
                                <SkeletonBox width="70%" height="16px" style={{ marginBottom: '12px' }} />
                                <div className="d-flex gap-3">
                                    <SkeletonBox width="80px" height="12px" />
                                    <SkeletonBox width="100px" height="12px" />
                                    <SkeletonBox width="60px" height="12px" />
                                </div>
                            </div>
                        </div>
                        <div className="d-flex gap-2">
                            <SkeletonBox width="100px" height="32px" borderRadius="6px" />
                            <SkeletonBox width="80px" height="32px" borderRadius="6px" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ==========================================
// INSTRUCTOR REVIEWS SKELETON
// ==========================================

export const SkeletonInstructorReviews = ({ count = 6 }) => {
    return (
        <div className="row g-4">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="col-lg-6">
                    <div className="card border-0">
                        <div className="card-body p-4">
                            <div className="d-flex align-items-center mb-3">
                                <SkeletonCircle size="50px" style={{ marginRight: '15px' }} />
                                <div style={{ flex: 1 }}>
                                    <SkeletonBox width="60%" height="16px" style={{ marginBottom: '5px' }} />
                                    <SkeletonBox width="40%" height="12px" />
                                </div>
                            </div>
                            <SkeletonBox width="100px" height="16px" style={{ marginBottom: '12px' }} />
                            <SkeletonBox width="100%" height="14px" style={{ marginBottom: '5px' }} />
                            <SkeletonBox width="90%" height="14px" style={{ marginBottom: '5px' }} />
                            <SkeletonBox width="70%" height="14px" style={{ marginBottom: '12px' }} />
                            <SkeletonBox width="50%" height="12px" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ==========================================
// INSTRUCTOR PROFILE SKELETON
// ==========================================

export const SkeletonInstructorProfile = () => {
    return (
        <div className="skeleton-profile">
            <div className="row g-4">
                <div className="col-lg-4">
                    <div className="card border-0">
                        <div className="card-body p-4 text-center">
                            <SkeletonCircle size="120px" style={{ margin: '0 auto 20px' }} />
                            <SkeletonBox width="70%" height="20px" style={{ margin: '0 auto 12px' }} />
                            <SkeletonBox width="50%" height="14px" style={{ margin: '0 auto 20px' }} />
                            <SkeletonBox width="100%" height="45px" borderRadius="8px" />
                        </div>
                    </div>
                </div>
                <div className="col-lg-8">
                    <div className="card border-0">
                        <div className="card-body p-4">
                            <SkeletonBox width="150px" height="20px" style={{ marginBottom: '20px' }} />
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="mb-3">
                                    <SkeletonBox width="30%" height="14px" style={{ marginBottom: '8px' }} />
                                    <SkeletonBox width="100%" height="45px" borderRadius="6px" />
                                </div>
                            ))}
                            <div className="d-flex gap-2 mt-4">
                                <SkeletonBox width="120px" height="40px" borderRadius="8px" />
                                <SkeletonBox width="100px" height="40px" borderRadius="8px" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// INSTRUCTOR NOTIFICATIONS SKELETON
// ==========================================

export const SkeletonInstructorNotifications = ({ count = 10 }) => {
    return (
        <div className="skeleton-notifications">
            {[...Array(count)].map((_, i) => (
                <div key={i} className="card border-0 mb-3">
                    <div className="card-body p-3">
                        <div className="d-flex align-items-start">
                            <SkeletonCircle size="45px" style={{ marginRight: '15px' }} />
                            <div style={{ flex: 1 }}>
                                <SkeletonBox width="80%" height="16px" style={{ marginBottom: '8px' }} />
                                <SkeletonBox width="100%" height="14px" style={{ marginBottom: '5px' }} />
                                <SkeletonBox width="60%" height="14px" style={{ marginBottom: '8px' }} />
                                <SkeletonBox width="40%" height="12px" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default {
    SkeletonInstructorDashboard,
    SkeletonInstructorCourses,
    SkeletonInstructorStudents,
    SkeletonInstructorQA,
    SkeletonInstructorReviews,
    SkeletonInstructorProfile,
    SkeletonInstructorNotifications
};
