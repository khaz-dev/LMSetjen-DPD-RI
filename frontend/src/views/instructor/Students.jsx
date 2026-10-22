import React, { useState, useCallback, useMemo } from "react";
import dayjs, { moment } from "../../utils/dayjs";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { getMediaUrl } from "../../utils/constants";
import { usePageCache } from "../../utils/usePageCache";
import Toast from "../plugin/Toast";

// Import Students specific styles
import "./Students.css";

function Students() {
    const isCollapsed = useInstructorSidebarCollapse();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCourse, setSelectedCourse] = useState("all");
    const [sortBy, setSortBy] = useState("newest");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' or 'table'
    const [selectedStudent, setSelectedStudent] = useState(null); // for detail modal
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch students data with teacher ID
    const fetchStudentsData = useCallback(async () => {
        const teacherId = UserData()?.teacher_id;
        if (!teacherId) {
            throw new Error("Teacher ID not found");
        }

        const response = await useAxios.get(`teacher/student-lists/${teacherId}/`);
        return Array.isArray(response.data) ? response.data : [];
    }, []);

    // Use page cache to prevent reloads on navigation
    const { data: rawStudents = [], loading: isLoading, error, refetch } = usePageCache(
        "instructor-students",
        fetchStudentsData,
        { showLoadingOnStale: false }
    );

    const students = useMemo(() => {
        return Array.isArray(rawStudents) ? rawStudents : [];
    }, [rawStudents]);

    // Handle manual refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await refetch();
            Toast().fire({
                icon: "success",
                title: "Data siswa berhasil diperbarui",
            });
        } catch (err) {
            console.error("Refresh students error:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui data siswa",
            });
        } finally {
            setIsRefreshing(false);
        }
    };

    // Helper: Image fallback
    const getStudentImage = (student) => {
        if (student?.image) {
            if (student.image.startsWith("http://") || student.image.startsWith("https://")) {
                return student.image;
            }
            if (student.image.startsWith("/media/")) {
                return student.image;
            }
            return getMediaUrl(student.image);
        }

        const name = student?.full_name || "Peserta Didik";
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=96&background=0f766e&color=ffffff&bold=true`;
    };

    // Helper: Display Name
    const getStudentName = (student) => {
        if (student?.full_name && student.full_name.trim()) {
            return student.full_name.trim();
        }
        if (student?.email) {
            return student.email.split("@")[0];
        }
        if (student?.user_id) {
            return `Siswa #${student.user_id}`;
        }
        return "Peserta Didik";
    };

    // Helper: Unit Kerja / Asal
    const getStudentUnit = (student) => {
        return student?.unit_kerja || student?.country || "Setjen DPD RI";
    };

    // Extract list of all unique courses for filter dropdown
    const availableCourses = useMemo(() => {
        const courseMap = new Map();
        students.forEach((s) => {
            if (Array.isArray(s.courses)) {
                s.courses.forEach((c) => {
                    if (c && c.id && c.title) {
                        courseMap.set(String(c.id), c.title);
                    }
                });
            }
        });
        return Array.from(courseMap.entries()).map(([id, title]) => ({ id, title }));
    }, [students]);

    // Calculate Summary Metrics
    const metrics = useMemo(() => {
        const total = students.length;
        if (total === 0) {
            return {
                totalStudents: 0,
                totalEnrollments: 0,
                newStudentsCount: 0,
                totalUnits: 0,
            };
        }

        // Total enrollments
        const totalEnrollments = students.reduce((acc, s) => {
            const count = s.courses_count || (Array.isArray(s.courses) ? s.courses.length : 1);
            return acc + count;
        }, 0);

        // Registered in last 30 days
        const thirtyDaysAgo = dayjs().subtract(30, "day");
        const newStudentsCount = students.filter((s) => {
            if (!s.date) return false;
            return dayjs(s.date).isAfter(thirtyDaysAgo);
        }).length;

        // Unique units / locations
        const unitSet = new Set();
        students.forEach((s) => {
            const unit = s.unit_kerja || s.country;
            if (unit && unit.trim()) {
                unitSet.add(unit.trim().toLowerCase());
            }
        });
        const totalUnits = Math.max(unitSet.size, total > 0 ? 1 : 0);

        return {
            totalStudents: total,
            totalEnrollments,
            newStudentsCount,
            totalUnits,
        };
    }, [students]);

    // Filter and Sort students
    const filteredStudents = useMemo(() => {
        let result = [...students];

        // Search query filter (matches name, email, nip, unit, or course title)
        if (searchQuery.trim() !== "") {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((s) => {
                const name = (s.full_name || "").toLowerCase();
                const email = (s.email || "").toLowerCase();
                const nip = (s.nip || "").toLowerCase();
                const unit = (s.unit_kerja || s.country || "").toLowerCase();
                const position = (s.position || "").toLowerCase();
                const courseMatch = Array.isArray(s.courses)
                    ? s.courses.some((c) => (c.title || "").toLowerCase().includes(q))
                    : false;

                return (
                    name.includes(q) ||
                    email.includes(q) ||
                    nip.includes(q) ||
                    unit.includes(q) ||
                    position.includes(q) ||
                    courseMatch
                );
            });
        }

        // Course filter
        if (selectedCourse !== "all") {
            result = result.filter((s) => {
                if (!Array.isArray(s.courses)) return false;
                return s.courses.some((c) => String(c.id) === String(selectedCourse));
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
            if (sortBy === "name_asc") {
                return (a.full_name || "").localeCompare(b.full_name || "");
            }
            if (sortBy === "name_desc") {
                return (b.full_name || "").localeCompare(a.full_name || "");
            }
            if (sortBy === "courses_desc") {
                const countA = a.courses_count || a.courses?.length || 0;
                const countB = b.courses_count || b.courses?.length || 0;
                return countB - countA;
            }
            return 0;
        });

        return result;
    }, [students, searchQuery, selectedCourse, sortBy]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredStudents.slice(start, start + itemsPerPage);
    }, [filteredStudents, currentPage, itemsPerPage]);

    // Copy all filtered emails to clipboard
    const handleCopyEmails = () => {
        const emails = filteredStudents
            .map((s) => s.email)
            .filter(Boolean);
        if (emails.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada email siswa untuk disalin",
            });
            return;
        }

        navigator.clipboard.writeText(emails.join("; "));
        Toast().fire({
            icon: "success",
            title: `${emails.length} email siswa berhasil disalin!`,
        });
    };

    // Reset all filters
    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedCourse("all");
        setSortBy("newest");
        setCurrentPage(1);
    };

    // Check if any filter is active
    const isFilterActive = searchQuery.trim() !== "" || selectedCourse !== "all" || sortBy !== "newest";

    return (
        <>
            <BaseHeader />

            <section className="modern-students">
                <div className="container">
                    <Header />

                    <div className="row">
                        <Sidebar />

                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* 1. Header Card (Compact & Modern) */}
                            <div className="students-header-card">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                    <div className="students-header-meta">
                                        <h2 className="students-title mb-1">
                                            <i className="fas fa-user-graduate text-teal me-2"></i>
                                            Siswa Saya
                                        </h2>
                                        <p className="students-subtitle mb-0">
                                            Pantau peserta didik yang terdaftar dalam program pelatihan Anda di LMSetjen DPD RI
                                        </p>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-teal"
                                            onClick={handleRefresh}
                                            disabled={isLoading || isRefreshing}
                                            title="Perbarui daftar siswa"
                                        >
                                            <i className={`fas fa-sync-alt me-1.5 ${isRefreshing ? "fa-spin" : ""}`}></i>
                                            Perbarui
                                        </button>

                                        {filteredStudents.length > 0 && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary"
                                                onClick={handleCopyEmails}
                                                title="Salin semua email siswa yang sedang ditampilkan"
                                            >
                                                <i className="fas fa-copy me-1"></i>
                                                Salin Email ({filteredStudents.filter((s) => s.email).length})
                                            </button>
                                        )}

                                        <span className="students-counter-pill">
                                            <i className="fas fa-users me-1"></i>
                                            {students.length} Total Siswa
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. KPI Metrics Strip (Compact 4-Card Grid) */}
                            <div className="students-metrics-grid">
                                <div className="student-metric-card">
                                    <div className="metric-icon-box bg-teal-subtle text-teal">
                                        <i className="fas fa-users"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.totalStudents}</span>
                                        <span className="metric-label">Total Peserta</span>
                                    </div>
                                    <span className="metric-badge bg-light text-muted">Semua Kursus</span>
                                </div>

                                <div className="student-metric-card">
                                    <div className="metric-icon-box bg-emerald-subtle text-emerald">
                                        <i className="fas fa-book-reader"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.totalEnrollments}</span>
                                        <span className="metric-label">Total Pendaftaran</span>
                                    </div>
                                    <span className="metric-badge bg-emerald-subtle text-emerald">Partisipasi Aktif</span>
                                </div>

                                <div className="student-metric-card">
                                    <div className="metric-icon-box bg-amber-subtle text-amber">
                                        <i className="fas fa-user-plus"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.newStudentsCount}</span>
                                        <span className="metric-label">Pendaftaran Baru</span>
                                    </div>
                                    <span className="metric-badge bg-amber-subtle text-amber">30 Hari Terakhir</span>
                                </div>

                                <div className="student-metric-card">
                                    <div className="metric-icon-box bg-purple-subtle text-purple">
                                        <i className="fas fa-building"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.totalUnits}</span>
                                        <span className="metric-label">Unit Kerja / Lokasi</span>
                                    </div>
                                    <span className="metric-badge bg-purple-subtle text-purple">Sebaran Asal</span>
                                </div>
                            </div>

                            {/* 3. Filter & Control Toolbar */}
                            <div className="students-toolbar-card">
                                <div className="row g-2 align-items-center">
                                    {/* Search Input */}
                                    <div className="col-lg-5 col-md-12">
                                        <div className="students-search-box">
                                            <i className="fas fa-search search-icon"></i>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm search-input"
                                                placeholder="Cari nama, NIP, email, unit kerja, atau kursus..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setCurrentPage(1);
                                                }}
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
                                    </div>

                                    {/* Course Filter Dropdown */}
                                    {availableCourses.length > 0 && (
                                        <div className="col-lg-3 col-md-5 col-sm-6">
                                            <div className="students-filter-group">
                                                <select
                                                    className="form-select form-select-sm"
                                                    value={selectedCourse}
                                                    onChange={(e) => {
                                                        setSelectedCourse(e.target.value);
                                                        setCurrentPage(1);
                                                    }}
                                                >
                                                    <option value="all">Semua Kursus ({availableCourses.length})</option>
                                                    {availableCourses.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sort Dropdown */}
                                    <div className={availableCourses.length > 0 ? "col-lg-2 col-md-4 col-sm-6" : "col-lg-4 col-md-6"}>
                                        <div className="students-filter-group">
                                            <select
                                                className="form-select form-select-sm"
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value)}
                                            >
                                                <option value="newest">Terbaru</option>
                                                <option value="oldest">Terlama</option>
                                                <option value="name_asc">Nama (A-Z)</option>
                                                <option value="name_desc">Nama (Z-A)</option>
                                                <option value="courses_desc">Kursus Terbanyak</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* View Mode Toggle & Reset */}
                                    <div className="col-lg col-md-3 col-12 d-flex align-items-center justify-content-end gap-2">
                                        {isFilterActive && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none text-danger p-0 me-1"
                                                onClick={handleResetFilters}
                                                title="Reset semua filter"
                                            >
                                                <i className="fas fa-undo-alt me-1"></i>Reset
                                            </button>
                                        )}

                                        <div className="btn-group btn-group-sm view-mode-group" role="group" aria-label="Mode Tampilan">
                                            <button
                                                type="button"
                                                className={`btn btn-sm ${viewMode === "grid" ? "active" : ""}`}
                                                onClick={() => setViewMode("grid")}
                                                title="Tampilan Grid"
                                            >
                                                <i className="fas fa-th-large"></i>
                                                <span>Grid</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn btn-sm ${viewMode === "table" ? "active" : ""}`}
                                                onClick={() => setViewMode("table")}
                                                title="Tampilan Tabel"
                                            >
                                                <i className="fas fa-list"></i>
                                                <span>Tabel</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Filters Feedback */}
                                {isFilterActive && (
                                    <div className="active-filters-bar mt-2 pt-2 border-top d-flex align-items-center justify-content-between flex-wrap gap-1">
                                        <div className="d-flex align-items-center gap-1 flex-wrap">
                                            <span className="text-muted small">Filter aktif:</span>
                                            {searchQuery && (
                                                <span className="badge bg-light text-dark border">
                                                    Kata kunci: "{searchQuery}"
                                                </span>
                                            )}
                                            {selectedCourse !== "all" && (
                                                <span className="badge bg-light text-dark border">
                                                    Kursus: {availableCourses.find((c) => String(c.id) === String(selectedCourse))?.title || selectedCourse}
                                                </span>
                                            )}
                                            {sortBy !== "newest" && (
                                                <span className="badge bg-light text-dark border">
                                                    Urutan: {sortBy === "name_asc" ? "Nama A-Z" : sortBy === "name_desc" ? "Nama Z-A" : sortBy === "oldest" ? "Terlama" : "Kursus Terbanyak"}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-muted small">
                                            Ditemukan <strong>{filteredStudents.length}</strong> siswa
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Error State */}
                            {error && (
                                <div className="students-empty-card error-card">
                                    <i className="fas fa-exclamation-triangle text-danger mb-2"></i>
                                    <h5>Gagal Memuat Data Siswa</h5>
                                    <p className="text-muted small mb-3">{error?.message || "Terjadi kendala jaringan saat menghubungi server."}</p>
                                    <button className="btn btn-sm btn-teal" onClick={() => refetch()}>
                                        <i className="fas fa-redo me-1"></i> Coba Lagi
                                    </button>
                                </div>
                            )}

                            {/* Loading State */}
                            {isLoading && !error && students.length === 0 && (
                                <div className="students-loading-card">
                                    <div className="spinner-border text-teal mb-3" role="status">
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <h6 className="text-dark fw-bold mb-1">Memuat Siswa Anda...</h6>
                                    <p className="text-muted small mb-0">Menyiapkan daftar peserta didik dan statistik kelas</p>
                                </div>
                            )}

                            {/* 4. Student List Content */}
                            {!isLoading && !error && filteredStudents.length === 0 && (
                                <div className="students-empty-card">
                                    <div className="empty-icon-wrap mb-2">
                                        <i className="fas fa-user-friends"></i>
                                    </div>
                                    <h5 className="fw-bold text-dark mb-1">
                                        {isFilterActive ? "Tidak Ada Siswa yang Cocok" : "Belum Ada Siswa Terdaftar"}
                                    </h5>
                                    <p className="text-muted small mb-3" style={{ maxWidth: "480px", margin: "0 auto" }}>
                                        {isFilterActive
                                            ? "Tidak ditemukan siswa yang sesuai dengan kriteria pencarian atau filter yang Anda terapkan."
                                            : "Peserta didik yang mendaftar ke kelas Anda akan muncul secara otomatis di halaman ini."}
                                    </p>
                                    {isFilterActive ? (
                                        <button className="btn btn-sm btn-outline-teal" onClick={handleResetFilters}>
                                            <i className="fas fa-undo-alt me-1"></i> Reset Filter
                                        </button>
                                    ) : (
                                        <span className="badge bg-light text-muted border py-2 px-3">
                                            <i className="fas fa-info-circle me-1"></i> Pastikan kursus Anda telah diterbitkan untuk menerima siswa
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Content Display: GRID VIEW */}
                            {!error && filteredStudents.length > 0 && viewMode === "grid" && (
                                <div className="row g-3">
                                    {paginatedStudents.map((student, index) => {
                                        const studentName = getStudentName(student);
                                        const studentUnit = getStudentUnit(student);
                                        const studentAvatar = getStudentImage(student);
                                        const enrolledCount = student.courses_count || student.courses?.length || 1;
                                        const isNew = student.date && dayjs().diff(dayjs(student.date), "day") <= 7;

                                        return (
                                            <div key={student.user_id || index} className="col-xl-3 col-lg-4 col-md-6 col-12">
                                                <div className="student-compact-card">
                                                    {/* Card Header Top Ribbon */}
                                                    <div className="student-card-ribbon d-flex align-items-center justify-content-between">
                                                        <div className="d-flex align-items-center gap-1">
                                                            {isNew && (
                                                                <span className="badge badge-new" title="Baru bergabung 7 hari terakhir">
                                                                    Baru
                                                                </span>
                                                            )}
                                                            <span className="badge badge-courses" title={`${enrolledCount} Kursus Diikuti`}>
                                                                <i className="fas fa-book me-1"></i>
                                                                {enrolledCount} Kursus
                                                            </span>
                                                        </div>

                                                        {student.email && (
                                                            <a
                                                                href={`mailto:${student.email}`}
                                                                className="quick-email-btn"
                                                                title={`Kirim email ke ${student.email}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <i className="fas fa-envelope"></i>
                                                            </a>
                                                        )}
                                                    </div>

                                                    {/* Card Body */}
                                                    <div className="student-card-main text-center">
                                                        <div className="student-avatar-wrap">
                                                            <img
                                                                src={studentAvatar}
                                                                className="student-avatar-img"
                                                                alt={`${studentName} avatar`}
                                                                loading="lazy"
                                                                onError={(e) => {
                                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                }}
                                                            />
                                                        </div>

                                                        <h4 className="student-card-name" title={studentName}>
                                                            {studentName}
                                                        </h4>

                                                        {student.nip && (
                                                            <div className="student-card-nip" title={`NIP: ${student.nip}`}>
                                                                <i className="fas fa-id-badge me-1"></i>
                                                                {student.nip}
                                                            </div>
                                                        )}

                                                        <div className="student-card-unit" title={studentUnit}>
                                                            <i className="fas fa-building text-teal me-1"></i>
                                                            <span>{studentUnit}</span>
                                                        </div>

                                                        {/* Kursus tags preview */}
                                                        {Array.isArray(student.courses) && student.courses.length > 0 && (
                                                            <div className="student-courses-preview mt-2">
                                                                <div className="course-pill-preview text-truncate" title={student.courses[0].title}>
                                                                    <i className="fas fa-play-circle me-1 text-teal"></i>
                                                                    {student.courses[0].title}
                                                                </div>
                                                                {student.courses.length > 1 && (
                                                                    <span className="course-more-pill">
                                                                        +{student.courses.length - 1} kursus lainnya
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Card Footer */}
                                                    <div className="student-card-footer d-flex align-items-center justify-content-between">
                                                        <div className="student-joined-date" title="Tanggal Terdaftar">
                                                            <i className="fas fa-calendar-alt text-muted me-1"></i>
                                                            <span>{moment(student.date).format("D MMM YYYY")}</span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="btn btn-xs btn-detail-trigger"
                                                            onClick={() => setSelectedStudent(student)}
                                                            title="Lihat detail lengkap siswa"
                                                        >
                                                            Detail <i className="fas fa-chevron-right ms-1"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Content Display: TABLE VIEW */}
                            {!error && filteredStudents.length > 0 && viewMode === "table" && (
                                <div className="students-table-card">
                                    <div className="table-responsive">
                                        <table className="table table-hover align-middle mb-0 students-table">
                                            <thead>
                                                <tr>
                                                    <th scope="col" style={{ width: "32%" }}>Siswa</th>
                                                    <th scope="col" style={{ width: "24%" }}>Unit Kerja / Asal</th>
                                                    <th scope="col" style={{ width: "24%" }}>Kursus Diikuti</th>
                                                    <th scope="col" style={{ width: "12%" }}>Terdaftar</th>
                                                    <th scope="col" style={{ width: "8%" }} className="text-end">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedStudents.map((student, index) => {
                                                    const studentName = getStudentName(student);
                                                    const studentUnit = getStudentUnit(student);
                                                    const studentAvatar = getStudentImage(student);
                                                    const enrolledCount = student.courses_count || student.courses?.length || 1;

                                                    return (
                                                        <tr key={student.user_id || index}>
                                                            <td>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <img
                                                                        src={studentAvatar}
                                                                        className="table-avatar"
                                                                        alt={studentName}
                                                                        loading="lazy"
                                                                        onError={(e) => {
                                                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&size=80&background=0f766e&color=ffffff&bold=true`;
                                                                        }}
                                                                    />
                                                                    <div className="table-student-info">
                                                                        <div className="table-student-name" title={studentName}>
                                                                            {studentName}
                                                                        </div>
                                                                        <div className="table-student-sub text-muted">
                                                                            {student.nip ? (
                                                                                <span>NIP: {student.nip}</span>
                                                                            ) : student.email ? (
                                                                                <span>{student.email}</span>
                                                                            ) : (
                                                                                <span>ID #{student.user_id}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="table-unit-box">
                                                                    <span className="table-unit-text" title={studentUnit}>
                                                                        <i className="fas fa-building text-teal me-1"></i>
                                                                        {studentUnit}
                                                                    </span>
                                                                    {student.position && (
                                                                        <span className="table-position-text text-muted d-block small">
                                                                            {student.position}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="table-courses-wrap">
                                                                    <span className="badge badge-courses me-1">
                                                                        {enrolledCount} Kursus
                                                                    </span>
                                                                    {Array.isArray(student.courses) && student.courses[0] && (
                                                                        <span className="table-course-title text-truncate" title={student.courses[0].title}>
                                                                            {student.courses[0].title}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <span className="table-date text-muted">
                                                                    {moment(student.date).format("D MMM YYYY")}
                                                                </span>
                                                            </td>

                                                            <td className="text-end">
                                                                <div className="d-inline-flex align-items-center gap-1">
                                                                    {student.email && (
                                                                        <a
                                                                            href={`mailto:${student.email}`}
                                                                            className="btn btn-xs btn-outline-secondary"
                                                                            title={`Kirim email ke ${student.email}`}
                                                                        >
                                                                            <i className="fas fa-envelope"></i>
                                                                        </a>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-xs btn-outline-teal"
                                                                        onClick={() => setSelectedStudent(student)}
                                                                        title="Lihat rincian siswa"
                                                                    >
                                                                        <i className="fas fa-info-circle"></i>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* 5. Pagination & Counter Bar */}
                            {!error && filteredStudents.length > 0 && (
                                <div className="students-pagination-bar d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
                                    <div className="pagination-info small text-muted">
                                        Menampilkan{" "}
                                        <strong>
                                            {(currentPage - 1) * itemsPerPage + 1}-
                                            {Math.min(currentPage * itemsPerPage, filteredStudents.length)}
                                        </strong>{" "}
                                        dari <strong>{filteredStudents.length}</strong> siswa
                                        {filteredStudents.length !== students.length && (
                                            <span className="ms-1">(difilter dari {students.length} total)</span>
                                        )}
                                    </div>

                                    <div className="d-flex align-items-center gap-3">
                                        {/* Per page selector */}
                                        <div className="d-flex align-items-center gap-1 small text-muted">
                                            <span>Tampilkan:</span>
                                            <select
                                                className="form-select form-select-sm per-page-select"
                                                value={itemsPerPage}
                                                onChange={(e) => {
                                                    setItemsPerPage(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <option value={8}>8</option>
                                                <option value={12}>12</option>
                                                <option value={24}>24</option>
                                                <option value={48}>48</option>
                                            </select>
                                        </div>

                                        {/* Page navigation */}
                                        {totalPages > 1 && (
                                            <nav aria-label="Navigasi Halaman Siswa">
                                                <ul className="pagination pagination-sm mb-0">
                                                    <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                                                        <button
                                                            className="page-link"
                                                            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                                            disabled={currentPage === 1}
                                                        >
                                                            <i className="fas fa-chevron-left"></i>
                                                        </button>
                                                    </li>

                                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                                        // Show first, last, and window around current
                                                        if (
                                                            page === 1 ||
                                                            page === totalPages ||
                                                            (page >= currentPage - 1 && page <= currentPage + 1)
                                                        ) {
                                                            return (
                                                                <li
                                                                    key={page}
                                                                    className={`page-item ${currentPage === page ? "active" : ""}`}
                                                                >
                                                                    <button
                                                                        className="page-link"
                                                                        onClick={() => setCurrentPage(page)}
                                                                    >
                                                                        {page}
                                                                    </button>
                                                                </li>
                                                            );
                                                        }
                                                        if (page === currentPage - 2 || page === currentPage + 2) {
                                                            return (
                                                                <li key={page} className="page-item disabled">
                                                                    <span className="page-link">…</span>
                                                                </li>
                                                            );
                                                        }
                                                        return null;
                                                    })}

                                                    <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                                                        <button
                                                            className="page-link"
                                                            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                                            disabled={currentPage === totalPages}
                                                        >
                                                            <i className="fas fa-chevron-right"></i>
                                                        </button>
                                                    </li>
                                                </ul>
                                            </nav>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 6. Student Detail Quick Modal */}
                            {selectedStudent && (
                                <div className="student-modal-backdrop" onClick={() => setSelectedStudent(null)}>
                                    <div
                                        className="student-modal-content"
                                        onClick={(e) => e.stopPropagation()}
                                        role="dialog"
                                        aria-modal="true"
                                    >
                                        <div className="student-modal-header d-flex justify-content-between align-items-center">
                                            <h5 className="modal-title mb-0">
                                                <i className="fas fa-id-card text-teal me-2"></i>
                                                Rincian Peserta Didik
                                            </h5>
                                            <button
                                                type="button"
                                                className="btn-close-modal"
                                                onClick={() => setSelectedStudent(null)}
                                                aria-label="Tutup"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>

                                        <div className="student-modal-body">
                                            {/* Profile Meta Header */}
                                            <div className="modal-profile-header d-flex align-items-center gap-3 mb-3 p-3 rounded">
                                                <img
                                                    src={getStudentImage(selectedStudent)}
                                                    className="modal-profile-avatar"
                                                    alt={getStudentName(selectedStudent)}
                                                    onError={(e) => {
                                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(getStudentName(selectedStudent))}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                    }}
                                                />
                                                <div className="modal-profile-info flex-grow-1">
                                                    <h4 className="modal-profile-name mb-1">
                                                        {getStudentName(selectedStudent)}
                                                    </h4>
                                                    <div className="modal-profile-sub d-flex flex-wrap gap-2 text-muted small">
                                                        {selectedStudent.nip && (
                                                            <span>
                                                                <i className="fas fa-id-badge text-teal me-1"></i>
                                                                NIP: {selectedStudent.nip}
                                                            </span>
                                                        )}
                                                        {selectedStudent.email && (
                                                            <span>
                                                                <i className="fas fa-envelope text-teal me-1"></i>
                                                                {selectedStudent.email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="row g-2 mb-3">
                                                <div className="col-sm-6">
                                                    <div className="modal-info-box">
                                                        <span className="info-box-label">Unit Kerja / Satuan Kerja</span>
                                                        <span className="info-box-value">
                                                            <i className="fas fa-building text-teal me-1"></i>
                                                            {getStudentUnit(selectedStudent)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-sm-6">
                                                    <div className="modal-info-box">
                                                        <span className="info-box-label">Jabatan / Posisi</span>
                                                        <span className="info-box-value">
                                                            <i className="fas fa-briefcase text-teal me-1"></i>
                                                            {selectedStudent.position || "Pegawai / Peserta Didik"}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-sm-6">
                                                    <div className="modal-info-box">
                                                        <span className="info-box-label">Tanggal Terdaftar Pertama</span>
                                                        <span className="info-box-value">
                                                            <i className="fas fa-calendar-check text-teal me-1"></i>
                                                            {moment(selectedStudent.date).format("dddd, D MMMM YYYY")}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-sm-6">
                                                    <div className="modal-info-box">
                                                        <span className="info-box-label">Total Kursus Diikuti</span>
                                                        <span className="info-box-value">
                                                            <i className="fas fa-graduation-cap text-teal me-1"></i>
                                                            {selectedStudent.courses_count || selectedStudent.courses?.length || 1} Kursus
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Enrolled Courses List */}
                                            <div className="modal-courses-section">
                                                <h6 className="section-title mb-2">
                                                    <i className="fas fa-book text-teal me-1"></i>
                                                    Kursus yang Diikuti dengan Anda
                                                </h6>

                                                {Array.isArray(selectedStudent.courses) && selectedStudent.courses.length > 0 ? (
                                                    <div className="modal-courses-list">
                                                        {selectedStudent.courses.map((c, i) => (
                                                            <div key={c.id || i} className="modal-course-item d-flex justify-content-between align-items-center">
                                                                <div className="course-item-left">
                                                                    <div className="course-item-title fw-bold">
                                                                        <i className="fas fa-check-circle text-success me-2"></i>
                                                                        {c.title}
                                                                    </div>
                                                                    {c.enrollment_id && (
                                                                        <span className="course-item-enrollment-id text-muted small">
                                                                            ID Pendaftaran: #{c.enrollment_id}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="course-item-date text-muted small">
                                                                    {moment(c.date || selectedStudent.date).format("D MMM YYYY")}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-light rounded text-center small text-muted">
                                                        Terdaftar pada kursus instruktur
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="student-modal-footer d-flex justify-content-between align-items-center">
                                            <div>
                                                {selectedStudent.email && (
                                                    <a
                                                        href={`mailto:${selectedStudent.email}`}
                                                        className="btn btn-sm btn-teal"
                                                    >
                                                        <i className="fas fa-envelope me-1"></i> Kirim Email
                                                    </a>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => setSelectedStudent(null)}
                                            >
                                                Tutup
                                            </button>
                                        </div>
                                    </div>
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