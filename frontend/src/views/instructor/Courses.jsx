import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import CourseCard from "../../components/CourseCard";
import EmptyState from "../../components/EmptyState";
import SearchSection from "../../components/SearchSection";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import "../../styles/Courses.css";

function Courses() {
    const [courses, setCourses] = useState([]);
    const [originalCourses, setOriginalCourses] = useState([]);

    const fetchCourseData = async () => {
        try {
            const response = await useAxios.get(`teacher/course-lists/${UserData()?.teacher_id}/`);
            setCourses(response.data);
            setOriginalCourses(response.data);
        } catch (error) {
            console.error("Error fetching courses:", error);
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

    return (
        <>
            <BaseHeader />

            <section className="courses-container">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Header Section */}
                            <div className="modern-header-section mb-4">
                                <div className="header-gradient-bg"></div>
                                <div className="d-flex align-items-center justify-content-between position-relative" style={{ zIndex: 2 }}>
                                    <div>
                                        <h1 className="mb-2 header-title">
                                            <i className="fas fa-graduation-cap me-3"></i>My Courses
                                        </h1>
                                        <p className="mb-0 text-muted" style={{ fontSize: '1.1rem' }}>
                                            Manage and monitor your course collection
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="stat-badge">
                                                <i className="fas fa-book me-2"></i>
                                                {courses?.length || 0} Courses
                                            </div>
                                            <Link 
                                                to="/instructor/create-course/" 
                                                className="btn modern-create-btn"
                                            >
                                                <i className="fas fa-plus me-2"></i>
                                                New Course
                                            </Link>
                                        </div>
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