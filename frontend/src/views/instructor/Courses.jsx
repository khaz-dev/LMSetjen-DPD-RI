import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import CourseCard from "../../components/CourseCard";
import EmptyState from "../../components/EmptyState";
import SearchSection from "../../components/SearchSection";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { usePageCache } from "../../utils/usePageCache"; // ✨ PHASE 11.12+: Fix page reload issue
import "./Courses.css";

function Courses() {
    const isCollapsed = useInstructorSidebarCollapse();
    const [displayedCourses, setDisplayedCourses] = useState([]);

    // ✨ PHASE 11.12+: Wrap fetch logic for usePageCache
    const fetchCoursesData = useCallback(async () => {
        const response = await useAxios.get(`teacher/course-lists/${UserData()?.teacher_id}/`);
        
        // Handle both array and paginated response formats
        const coursesData = Array.isArray(response.data) 
            ? response.data 
            : (response.data?.results || []);
        
        return coursesData;
    }, []);

    // ✨ PHASE 11.12+: Use page cache to prevent reloads on navigation
    const { data: courses = [], loading } = usePageCache(
        'instructor-courses',
        fetchCoursesData,
        { showLoadingOnStale: false }
    );

    // Update displayedCourses when courses data changes
    useEffect(() => {
        setDisplayedCourses(courses);
    }, [courses]);

    const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();

        if (query === "") {
            setDisplayedCourses(courses);
        } else {
            const filtered = courses.filter((course) => {
                return course.title?.toLowerCase().includes(query);
            });
            setDisplayedCourses(filtered);
        }
    };

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="courses-container courses-loading-section">
                    <div className="courses-loading-container">
                        <div className="container">
                            <Header />
                            <div className="row courses-sidebar-content-row-loading">
                                <Sidebar />
                                <div className={`col-lg-9 col-md-8 col-12 courses-spinner-wrapper ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                                    <div className="courses-spinner-center">
                                        <div className="spinner-border text-primary courses-spinner" role="status">
                                            <span className="visually-hidden">Memuat...</span>
                                        </div>
                                        <p className="mt-3 text-muted">Memuat Kursus...</p>
                                    </div>
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

            <section className="courses-container courses-main-section">
                <div className="container">
                    <Header />
                    <div className="row courses-sidebar-content-row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Toolbar Section - Distinct from instructor Header */}
                            <div className="courses-toolbar-section mb-4">
                                <div className="courses-toolbar-gradient"></div>
                                <div className="courses-toolbar-content">
                                    <div className="courses-toolbar-title-group">
                                        <h1 className="courses-toolbar-title">
                                            <i className="fas fa-graduation-cap courses-toolbar-icon"></i>Kursus Saya
                                        </h1>
                                        <p className="courses-toolbar-subtitle">
                                            Kelola dan pantau koleksi kursus Anda
                                        </p>
                                    </div>
                                    <div className="courses-toolbar-actions">
                                        <div className="courses-stat-badge">
                                            <i className="fas fa-book courses-stat-icon"></i>
                                            {courses?.length || 0} Kursus
                                        </div>
                                        <Link 
                                            to="/instructor/create-course/" 
                                            className="courses-create-btn"
                                        >
                                            <i className="fas fa-plus courses-create-icon"></i>
                                            Kursus Baru
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Search Section */}
                            <SearchSection onSearch={handleSearch} />

                            {/* Courses Grid */}
                            <div className="modern-courses-container">
                                {displayedCourses?.length > 0 ? (
                                    <div className="row g-3 courses-grid-row">
                                        {displayedCourses.map((course, index) => (
                                            <CourseCard 
                                                key={course.course_id || course.id || index} 
                                                course={course} 
                                                index={index}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(Courses);