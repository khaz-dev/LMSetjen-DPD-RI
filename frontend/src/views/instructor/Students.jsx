import React, { useState, useEffect, useCallback } from "react";
import dayjs, { moment } from "../../utils/dayjs";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { getMediaUrl } from "../../utils/constants";
import { usePageCache } from "../../utils/usePageCache"; // ✨ PHASE 11.12+: Fix page reload issue

// Import Students specific styles
import "./Students.css";

function Students() {
    const isCollapsed = useInstructorSidebarCollapse();
    const [error, setError] = useState(null);

    // ✨ PHASE 11.12+: Wrap fetch logic for usePageCache
    const fetchStudentsData = useCallback(async () => {
        const teacherId = UserData()?.teacher_id;
        
        if (!teacherId) {
            throw new Error("Teacher ID not found");
        }

        const response = await useAxios.get(`teacher/student-lists/${teacherId}/`);
        
        // Validate and sanitize the response data
        const studentsData = Array.isArray(response.data) ? response.data : [];
        
        // Log detailed debugging information
        console.log("=== STUDENT LIST API RESPONSE ===");
        console.log("Total students:", studentsData.length);
        studentsData.slice(0, 3).forEach((student, index) => {
            console.log(`Student ${index}:`, {
                user_id: student.user_id,
                full_name: student.full_name,
                image: student.image,
                image_type: typeof student.image,
                image_exists: !!student.image,
                country: student.country,
            });
        });
        
        // Log any students with missing data for debugging
        studentsData.forEach((student, index) => {
            if (!student.full_name) {
                console.warn(`Student at index ${index} missing full_name:`, student);
            }
            if (!student.image) {
                console.warn(`Student at index ${index} missing image:`, student.full_name);
            }
        });
        
        return studentsData;
    }, []);

    // ✨ PHASE 11.12+: Use page cache to prevent reloads on navigation
    const { data: students = [], isLoading } = usePageCache(
        'instructor-students',
        fetchStudentsData,
        { showLoadingOnStale: false }
    );

    const getStudentImage = (student) => {
        // Log the input
        console.log(`getStudentImage called for ${student?.full_name}:`, {
            image: student?.image,
            image_type: typeof student?.image,
        });

        // Check if student has image
        if (student?.image) {
            console.log(`  → Image exists: "${student.image}"`);
            
            // Handle absolute URLs (full http/https URLs)
            if (student.image.startsWith("http://") || student.image.startsWith("https://")) {
                console.log(`  → Returning absolute URL: ${student.image}`);
                return student.image;
            }
            
            // Handle already-prefixed /media/ URLs (shouldn't happen, but safe check)
            if (student.image.startsWith("/media/")) {
                console.log(`  → Returning /media/ prefixed URL: ${student.image}`);
                return student.image;
            }
            
            // Handle relative paths (e.g., 'user_folder/pic.jpg')
            // getMediaUrl() will add /media/ prefix
            const mediaUrl = getMediaUrl(student.image);
            console.log(`  → Returning getMediaUrl result: ${mediaUrl}`);
            return mediaUrl;
        }
        
        console.log("  → No image, using initials placeholder");
        
        // Generate initials-based placeholder when no image available
        const name = student?.full_name || "Student";
        const initials = name
            .split(" ")
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join("");
        
        // Use initials in placeholder
        const initialsUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=80&background=667eea&color=ffffff&bold=true`;
        console.log(`  → Returning initials URL: ${initialsUrl}`);
        return initialsUrl;
    };

    const getStudentName = (student) => {
        // Multiple fallback options for student name
        if (student?.full_name && student.full_name.trim()) {
            return student.full_name;
        }
        if (student?.email) {
            return student.email.split("@")[0];
        }
        if (student?.user_id) {
            return `Student #${student.user_id}`;
        }
        return "Unknown Student";
    };

    // Show full-page loading spinner on initial load
    if (isLoading) {
        return (
            <>
                <BaseHeader />
                <section className="modern-students" style={{ display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Siswa...</p>
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
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Header Section */}
                            <div className="students-header mb-4">
                                <div className="students-header-bg"></div>
                                <div className="d-flex justify-content-between align-items-center flex-wrap">
                                    <div className="mb-3 mb-md-0">
                                        <h3 className="students-header-title mb-2">
                                            <i className="fas fa-users me-3"></i>
                                            Siswa Saya
                                        </h3>
                                        <p className="students-header-desc text-muted mb-0">Terhubung dengan peserta didik yang mengikuti kursus Anda</p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                        <div className="students-stat-badge">
                                            <i className="fas fa-user-graduate me-2"></i>
                                            {students?.length || 0} Total Siswa
                                        </div>
                                    </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error State */}
                            {error && (
                                <div className="error-state">
                                    <i className="fas fa-exclamation-triangle text-warning mb-3" style={{ fontSize: "3rem" }}></i>
                                    <h5 className="text-danger mb-3">Kesalahan Memuat Siswa</h5>
                                    <p className="text-muted mb-3">{error}</p>
                                    <button className="btn btn-primary" onClick={fetchStudents}>
                                        <i className="fas fa-redo me-2"></i>Coba Lagi
                                    </button>
                                </div>
                            )}

                            {/* Students Grid */}
                            {!error && (
                                <div className="row">
                                    {(students?.length ?? 0) > 0 ? (
                                        students.map((student, index) => (
                                            <div key={student.id || student.user_id || index} className="col-lg-4 col-md-6 col-12 mb-4">
                                                <div className="student-card">
                                                    <div className="card-body text-center p-4">
                                                        <img
                                                            src={getStudentImage(student)}
                                                            className="student-avatar"
                                                            alt={`${getStudentName(student)} avatar`}
                                                            onError={(e) => {
                                                                console.error(`❌ Image load FAILED for student: ${student.full_name}`);
                                                                console.error(`   Attempted URL: ${e.target.src}`);
                                                                console.error("   Student data:", student);
                                                                const name = getStudentName(student);
                                                                const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=80&background=667eea&color=ffffff&bold=true`;
                                                                console.log(`   Fallback to initials: ${fallbackUrl}`);
                                                                e.target.src = fallbackUrl;
                                                            }}
                                                        />
                                                        <h4 className="student-name">{getStudentName(student)}</h4>
                                                        <div className="student-location">
                                                            <i className="fas fa-map-marker-alt text-primary"></i>
                                                            <span>{student.country || "Lokasi tidak ditentukan"}</span>
                                                        </div>
                                                    </div>
                                                    <div className="student-info">
                                                        <div className="student-date">
                                                            <span className="text-muted">
                                                                <i className="fas fa-calendar-alt me-2"></i>
                                                                Terdaftar
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
                                                <h5 className="text-secondary mb-3">Belum Ada Siswa Terdaftar</h5>
                                                <p className="text-muted">
                                                    Ketika siswa mulai mendaftar di kursus Anda, mereka akan muncul di sini. 
                                                    Buatlah konten yang menarik untuk menarik lebih banyak peserta didik!
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