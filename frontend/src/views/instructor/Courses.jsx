import React, { useState, useEffect } from "react";
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
import "./Courses.css";

function Courses() {
    const [courses, setCourses] = useState([]);
    const [originalCourses, setOriginalCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCourseData = async () => {
        try {
            setLoading(true);
            const response = await useAxios.get(`teacher/course-lists/${UserData()?.teacher_id}/`);
            setCourses(response.data);
            setOriginalCourses(response.data);
        } catch (error) {
            console.error("Error fetching courses:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourseData();
    }, []);

    const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();

        if (query === "") {
            setCourses(originalCourses);
        } else {
            const filtered = originalCourses.filter((course) => {
                return course.title?.toLowerCase().includes(query);
            });
            setCourses(filtered);
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
                            <div className="row">
                                <Sidebar />
                                <div className="col-lg-9 col-md-8 col-12 courses-spinner-wrapper">
                                    <div className="courses-spinner-center">
                                        <div className="spinner-border text-primary courses-spinner" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                        <p className="mt-3 text-muted">Loading Courses...</p>
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
                    <div className="row">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Header Section */}
                            <div className="courses-header-section mb-4">
                                <div className="courses-header-gradient"></div>
                                <div className="courses-header-content">
                                    <div className="courses-header-title-group">
                                        <h1 className="courses-header-title">
                                            <i className="fas fa-graduation-cap courses-header-icon"></i>My Courses
                                        </h1>
                                        <p className="courses-header-subtitle">
                                            Manage and monitor your course collection
                                        </p>
                                    </div>
                                    <div className="courses-header-actions">
                                        <div className="courses-stat-badge">
                                            <i className="fas fa-book courses-stat-icon"></i>
                                            {courses?.length || 0} Courses
                                        </div>
                                        <Link 
                                            to="/instructor/create-course/" 
                                            className="courses-create-btn"
                                        >
                                            <i className="fas fa-plus courses-create-icon"></i>
                                            New Course
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Search Section */}
                            <SearchSection onSearch={handleSearch} />

                            {/* Courses Grid */}
                            <div className="modern-courses-container">
                                {courses?.length > 0 ? (
                                    <div className="row g-4">
                                        {courses.map((course, index) => (
                                            <CourseCard 
                                                key={course.course_id || course.id || index} 
                                                course={course} 
                                                index={index}
                                                onDelete={fetchCourseData}
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