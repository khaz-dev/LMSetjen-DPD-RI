import React, { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import CourseCard from "../../components/CourseCard";
import EmptyState from "../../components/EmptyState";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { getActualCourseStatus } from "../../utils/courseUtils";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { usePageCache } from "../../utils/usePageCache";
import "./Courses.css";

function Courses() {
    const isCollapsed = useInstructorSidebarCollapse();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [selectedLevel, setSelectedLevel] = useState("all");
    const [sortBy, setSortBy] = useState("newest");
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // View mode: 'grid' or 'list', persisted in localStorage
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem("instructorCoursesViewMode") || "grid";
    });

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        localStorage.setItem("instructorCoursesViewMode", mode);
    };

    // Fetch courses data for instructor
    const fetchCoursesData = useCallback(async () => {
        const response = await useAxios.get(`teacher/course-lists/${UserData()?.teacher_id}/`);
        
        // Handle both array and paginated response formats
        const coursesData = Array.isArray(response.data) 
            ? response.data 
            : (response.data?.results || []);
        
        return coursesData;
    }, []);

    // Page cache hook
    const { data: rawCourses, loading, refetch } = usePageCache(
        "instructor-courses",
        fetchCoursesData,
        { showLoadingOnStale: false }
    );

    // Ensure courses is always an array even if cache returns null
    const courses = useMemo(() => (Array.isArray(rawCourses) ? rawCourses : []), [rawCourses]);

    // Refresh handler
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refetch(false);
            Toast().fire({
                icon: "success",
                title: "Daftar kursus berhasil diperbarui",
            });
        } catch (err) {
            console.error("Error refreshing courses:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui kursus",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        const total = courses.length;
        if (total === 0) {
            return {
                totalCourses: 0,
                publishedCourses: 0,
                draftCourses: 0,
                totalStudents: 0,
            };
        }

        const published = courses.filter((c) => {
            const status = getActualCourseStatus(c);
            return status.status === "Published" || c.is_published_version === true;
        }).length;

        const draft = courses.filter((c) => {
            const status = getActualCourseStatus(c);
            return status.status === "Draft" || status.status === "Review" || status.status === "Rejected";
        }).length;

        const totalStudents = courses.reduce((acc, c) => {
            return acc + (c.students?.length || 0);
        }, 0);

        return {
            totalCourses: total,
            publishedCourses: published,
            draftCourses: draft,
            totalStudents: totalStudents,
        };
    }, [courses]);

    // Filter and Sort Courses
    const filteredCourses = useMemo(() => {
        let result = [...courses];

        // Search Query (title, category, or level)
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter((course) => {
                const titleMatch = (course.title || "").toLowerCase().includes(query);
                const catMatch = (course.category?.title || "").toLowerCase().includes(query);
                const levelMatch = (course.level || "").toLowerCase().includes(query);
                return titleMatch || catMatch || levelMatch;
            });
        }

        // Status Filter
        if (selectedStatus !== "all") {
            result = result.filter((course) => {
                const actualStatus = getActualCourseStatus(course).status;
                if (selectedStatus === "Published") {
                    return actualStatus === "Published" || course.is_published_version === true;
                }
                if (selectedStatus === "Draft") {
                    return actualStatus === "Draft";
                }
                if (selectedStatus === "Review") {
                    return actualStatus === "Review";
                }
                if (selectedStatus === "Rejected") {
                    return actualStatus === "Rejected";
                }
                return true;
            });
        }

        // Level Filter
        if (selectedLevel !== "all") {
            result = result.filter((course) => {
                return (course.level || "").toLowerCase() === selectedLevel.toLowerCase();
            });
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === "newest") {
                return new Date(b.date || 0) - new Date(a.date || 0);
            }
            if (sortBy === "oldest") {
                return new Date(a.date || 0) - new Date(b.date || 0);
            }
            if (sortBy === "students_desc") {
                return (b.students?.length || 0) - (a.students?.length || 0);
            }
            if (sortBy === "title_asc") {
                return (a.title || "").localeCompare(b.title || "");
            }
            if (sortBy === "title_desc") {
                return (b.title || "").localeCompare(a.title || "");
            }
            return 0;
        });

        return result;
    }, [courses, searchQuery, selectedStatus, selectedLevel, sortBy]);

    // Reset filters
    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedStatus("all");
        setSelectedLevel("all");
        setSortBy("newest");
    };

    const isFilterActive = searchQuery.trim() !== "" || selectedStatus !== "all" || selectedLevel !== "all" || sortBy !== "newest";

    return (
        <>
            <BaseHeader />

            <section className="courses-container courses-main-section">
                <div className="container">
                    <Header />
                    <div className="row courses-sidebar-content-row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {loading ? (
                                <div className="courses-spinner-wrapper">
                                    <div className="courses-spinner-center">
                                        <div className="spinner-border text-teal courses-spinner" role="status">
                                            <span className="visually-hidden">Memuat...</span>
                                        </div>
                                        <p className="mt-3 text-muted">Memuat Daftar Kursus...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Header Card (Compact & Modern) */}
                                    <div className="courses-header-card">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    <div className="courses-header-meta">
                                        <h2 className="courses-title mb-1">
                                            <i className="fas fa-graduation-cap text-teal me-2"></i>
                                            Kursus Saya
                                        </h2>
                                        <p className="courses-subtitle mb-0">
                                            Kelola, pantau, dan publikasikan program pelatihan Anda di LMSetjen DPD RI
                                        </p>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-teal"
                                            onClick={handleRefresh}
                                            disabled={isRefreshing}
                                            title="Segarkan daftar kursus"
                                        >
                                            <i className={`fas fa-sync-alt me-1.5 ${isRefreshing ? "fa-spin" : ""}`}></i>
                                            Segarkan
                                        </button>

                                        <span className="courses-counter-pill">
                                            <i className="fas fa-book-open me-2"></i>
                                            <span>{courses.length} Kursus</span>
                                        </span>

                                        <Link 
                                            to="/instructor/create-course/" 
                                            className="btn btn-sm btn-teal"
                                            title="Buat kursus baru"
                                        >
                                            <i className="fas fa-plus me-1.5"></i>
                                            Kursus Baru
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* 2. KPI Metrics Strip (Compact 4-Card Grid) */}
                            <div className="courses-metrics-grid">
                                <div className="course-metric-card">
                                    <div className="metric-icon-box bg-teal-subtle text-teal">
                                        <i className="fas fa-book-open"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.totalCourses}</span>
                                        <span className="metric-label">Total Kursus</span>
                                    </div>
                                    <span className="metric-badge bg-light text-muted">Semua status</span>
                                </div>

                                <div className="course-metric-card">
                                    <div className="metric-icon-box bg-emerald-subtle text-emerald">
                                        <i className="fas fa-check-circle"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.publishedCourses}</span>
                                        <span className="metric-label">Terbit & Aktif</span>
                                    </div>
                                    <span className="metric-badge bg-emerald-subtle text-emerald">Bisa Diakses</span>
                                </div>

                                <div className="course-metric-card">
                                    <div className="metric-icon-box bg-amber-subtle text-amber">
                                        <i className="fas fa-edit"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.draftCourses}</span>
                                        <span className="metric-label">Draf & Review</span>
                                    </div>
                                    <span className="metric-badge bg-amber-subtle text-amber">Perlu Tindakan</span>
                                </div>

                                <div className="course-metric-card">
                                    <div className="metric-icon-box bg-purple-subtle text-purple">
                                        <i className="fas fa-user-graduate"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.totalStudents}</span>
                                        <span className="metric-label">Total Peserta</span>
                                    </div>
                                    <span className="metric-badge bg-purple-subtle text-purple">Siswa Terdaftar</span>
                                </div>
                            </div>

                            {/* 3. Integrated Compact Control Toolbar (Filter & Search) */}
                            <div className="courses-control-bar">
                                <div className="d-flex align-items-center flex-wrap gap-2 w-100">
                                    {/* Search Input */}
                                    <div className="courses-search-wrapper flex-grow-1">
                                        <i className="fas fa-search search-icon"></i>
                                        <input 
                                            type="text" 
                                            className="form-control courses-search-input" 
                                            placeholder="Cari judul kursus atau kategori..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button 
                                                type="button" 
                                                className="search-clear-btn"
                                                onClick={() => setSearchQuery("")}
                                                title="Hapus pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Filter: Status */}
                                    <div className="courses-filter-item">
                                        <select 
                                            className="form-select courses-select"
                                            value={selectedStatus}
                                            onChange={(e) => setSelectedStatus(e.target.value)}
                                            title="Filter berdasarkan status"
                                        >
                                            <option value="all">Semua Status</option>
                                            <option value="Published">Dipublikasikan</option>
                                            <option value="Draft">Draf</option>
                                            <option value="Review">Menunggu Review</option>
                                            <option value="Rejected">Ditolak</option>
                                        </select>
                                    </div>

                                    {/* Filter: Level */}
                                    <div className="courses-filter-item">
                                        <select 
                                            className="form-select courses-select"
                                            value={selectedLevel}
                                            onChange={(e) => setSelectedLevel(e.target.value)}
                                            title="Filter berdasarkan level"
                                        >
                                            <option value="all">Semua Level</option>
                                            <option value="Beginner">Pemula</option>
                                            <option value="Intermediate">Menengah</option>
                                            <option value="Advanced">Lanjutan</option>
                                        </select>
                                    </div>

                                    {/* Sort By */}
                                    <div className="courses-filter-item">
                                        <select 
                                            className="form-select courses-select"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            title="Urutkan kursus"
                                        >
                                            <option value="newest">Terbaru</option>
                                            <option value="oldest">Terlama</option>
                                            <option value="students_desc">Siswa Terbanyak</option>
                                            <option value="title_asc">Judul (A-Z)</option>
                                            <option value="title_desc">Judul (Z-A)</option>
                                        </select>
                                    </div>

                                    {/* View Mode Switcher: Grid vs List */}
                                    <div className="courses-view-toggle">
                                        <button 
                                            type="button" 
                                            className={`view-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                                            onClick={() => handleViewModeChange("grid")}
                                            title="Tampilan Grid (Kartu)"
                                        >
                                            <i className="fas fa-th-large"></i>
                                        </button>
                                        <button 
                                            type="button" 
                                            className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                                            onClick={() => handleViewModeChange("list")}
                                            title="Tampilan List (Baris Kompak)"
                                        >
                                            <i className="fas fa-list"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Active Filters Status Bar */}
                                {isFilterActive && (
                                    <div className="courses-active-filters-bar mt-2 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                            <span className="active-filters-label text-muted">
                                                <i className="fas fa-filter me-1"></i>Filter Aktif:
                                            </span>

                                            {searchQuery.trim() !== "" && (
                                                <span className="filter-chip">
                                                    Kata Kunci: &ldquo;{searchQuery}&rdquo;
                                                    <i className="fas fa-times ms-1.5" onClick={() => setSearchQuery("")}></i>
                                                </span>
                                            )}

                                            {selectedStatus !== "all" && (
                                                <span className="filter-chip">
                                                    Status: {selectedStatus}
                                                    <i className="fas fa-times ms-1.5" onClick={() => setSelectedStatus("all")}></i>
                                                </span>
                                            )}

                                            {selectedLevel !== "all" && (
                                                <span className="filter-chip">
                                                    Level: {selectedLevel}
                                                    <i className="fas fa-times ms-1.5" onClick={() => setSelectedLevel("all")}></i>
                                                </span>
                                            )}

                                            {sortBy !== "newest" && (
                                                <span className="filter-chip">
                                                    Urutan: {sortBy === "oldest" ? "Terlama" : sortBy === "students_desc" ? "Siswa Terbanyak" : sortBy === "title_asc" ? "Judul A-Z" : "Judul Z-A"}
                                                    <i className="fas fa-times ms-1.5" onClick={() => setSortBy("newest")}></i>
                                                </span>
                                            )}

                                            <button 
                                                type="button" 
                                                className="btn btn-link btn-xs text-danger text-decoration-none p-0 ms-1 fw-semibold"
                                                onClick={handleResetFilters}
                                            >
                                                Reset Semua
                                            </button>
                                        </div>

                                        <span className="filtered-count-badge text-muted">
                                            Menampilkan <strong>{filteredCourses.length}</strong> dari {courses.length} kursus
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 4. Courses Display (Grid or List Mode) */}
                            <div className="courses-items-container">
                                {filteredCourses?.length > 0 ? (
                                    <div className="row g-3 courses-grid-row">
                                        {filteredCourses.map((course, index) => (
                                            <CourseCard 
                                                key={course.course_id || course.id || index} 
                                                course={course} 
                                                index={index}
                                                viewMode={viewMode}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState 
                                        onReset={handleResetFilters} 
                                        isFilterActive={isFilterActive} 
                                    />
                                )}
                            </div>
                                </>
                            )}

                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(Courses);