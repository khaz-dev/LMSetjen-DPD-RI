import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";
import { getImageUrl, getCourseCurriculumSummary, calculateCourseJP } from "../../../utils/courseUtils";

/**
 * Course Review Tab Component (Redesigned Compact & Live)
 * Setjen DPD RI Learning Platform
 */
function CourseReviewTab({ onCountsUpdated }) {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [stats, setStats] = useState({
        all: 0,
        review: 0,
        published: 0,
        draft: 0,
        rejected: 0,
        disabled: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processingCourseId, setProcessingCourseId] = useState(null);

    // Multi-select & Bulk Action states (Fase 3)
    const [selectedCourseIds, setSelectedCourseIds] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Drawer preview states (Fase 2B)
    const [previewCourse, setPreviewCourse] = useState(null);
    const [previewActiveTab, setPreviewActiveTab] = useState("curriculum");
    const [expandedSections, setExpandedSections] = useState({});

    const handleOpenPreview = (course) => {
        if (!course) return;
        setPreviewCourse(course);
        setPreviewActiveTab("curriculum");
        if (course.curriculum && Array.isArray(course.curriculum)) {
            const initialExpanded = {};
            course.curriculum.forEach((sec, idx) => {
                initialExpanded[sec.variant_id || idx] = true;
            });
            setExpandedSections(initialExpanded);
        }
    };

    const handleClosePreview = () => {
        setPreviewCourse(null);
    };

    // Close preview drawer on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && previewCourse) {
                handleClosePreview();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [previewCourse]);

    // Keep ref for onCountsUpdated to avoid unnecessary re-fetch loops
    const onCountsUpdatedRef = useRef(onCountsUpdated);
    useEffect(() => {
        onCountsUpdatedRef.current = onCountsUpdated;
    }, [onCountsUpdated]);

    // Filters & view options (Fase 2C: Advanced Filters & Sorting)
    const [filterStatus, setFilterStatus] = useState("Review");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedLevel, setSelectedLevel] = useState("all");
    const [quizCompleteness, setQuizCompleteness] = useState("all");
    const [sortOrder, setSortOrder] = useState("recent");
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem("cm_course_view_mode") || "grid";
    });

    const navigate = useNavigate();

    // Reset all filters to default
    const handleResetAllFilters = () => {
        setSearchQuery("");
        setDebouncedSearch("");
        setSelectedCategory("all");
        setSelectedLevel("all");
        setQuizCompleteness("all");
        setSortOrder("recent");
    };

    // Check if any secondary filter is currently active
    const hasActiveFilters = useMemo(() => {
        return Boolean(
            searchQuery.trim() ||
            selectedCategory !== "all" ||
            selectedLevel !== "all" ||
            quizCompleteness !== "all" ||
            sortOrder !== "recent"
        );
    }, [searchQuery, selectedCategory, selectedLevel, quizCompleteness, sortOrder]);

    // Debounce search query to prevent network request spam
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Clear selection when filters or search change
    useEffect(() => {
        setSelectedCourseIds([]);
    }, [filterStatus, selectedCategory, selectedLevel, quizCompleteness, debouncedSearch, sortOrder]);

    // Toggle view mode and persist
    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem("cm_course_view_mode", mode);
        } catch {
            // Ignore localStorage errors
        }
    };

    // Fetch categories for filtering dropdown
    const fetchCategories = useCallback(async () => {
        try {
            const response = await apiInstance.get("admin/category/");
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setCategories(data);
        } catch (error) {
            console.error("[CourseReviewTab] Error fetching categories:", error);
        }
    }, []);

    // Fetch courses with real live parameters
    const fetchCourses = useCallback(async (isSilentRefresh = false) => {
        if (!isSilentRefresh) setLoading(true);
        else setRefreshing(true);

        try {
            const params = new URLSearchParams();
            if (filterStatus) params.append("status", filterStatus);
            if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
            if (sortOrder) params.append("ordering", sortOrder);
            if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());

            const url = `/admin/courses-pending-review/?${params.toString()}`;
            const response = await apiInstance.get(url);

            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }

            setCourses(data);

            // Update live stats from backend response if available
            if (response.data?.stats) {
                setStats(response.data.stats);
            }

            // Sync parent metrics callback when silently refreshed or refreshed by action
            if (isSilentRefresh && typeof onCountsUpdatedRef.current === "function") {
                onCountsUpdatedRef.current();
            }
        } catch (error) {
            console.error("[CourseReviewTab] Error fetching courses:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data kursus",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus, selectedCategory, sortOrder, debouncedSearch]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    // Quick Approve Course
    const handleQuickApprove = async (course) => {
        if (!course?.course_id) return;
        const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur";

        const result = await Swal.fire({
            title: "Setujui & Terbitkan Kursus?",
            html: `
                <div class="text-start" style="font-size: 0.88rem;">
                    <p class="mb-2">Anda akan menyetujui dan mempublikasikan kursus:</p>
                    <div class="p-2 rounded border bg-light mb-2">
                        <strong class="text-dark d-block mb-1">${course.title}</strong>
                        <span class="text-muted small"><i class="fas fa-chalkboard-teacher me-1 text-teal"></i> ${teacherName}</span>
                    </div>
                    <div class="alert alert-info py-2 px-2 mb-0" style="font-size: 0.78rem;">
                        <i class="fas fa-info-circle me-1"></i> Kursus ini akan langsung berstatus <b>Terbit (Published)</b> dan dapat diakses oleh seluruh pegawai Setjen DPD RI.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-check-circle me-1"></i> Ya, Setujui & Terbitkan',
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setProcessingCourseId(course.course_id);
        try {
            await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                action: "approve"
            });

            Toast().fire({
                icon: "success",
                title: "Kursus Berhasil Disetujui",
                text: `"${course.title}" telah dipublikasikan secara resmi.`
            });

            await fetchCourses(true);
            if (typeof onCountsUpdatedRef.current === "function") {
                onCountsUpdatedRef.current();
            }
        } catch (error) {
            console.error("[CourseReviewTab] Error approving course:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Menyetujui Kursus",
                text: error.response?.data?.error || error.response?.data?.detail || "Terjadi kesalahan saat memproses persetujuan"
            });
        } finally {
            setProcessingCourseId(null);
        }
    };

    // Quick Reject / Request Revision with Reason
    const handleQuickReject = async (course) => {
        if (!course?.course_id) return;
        const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur";

        const { value: reason } = await Swal.fire({
            title: "Tolak / Minta Revisi Kursus",
            html: `
                <div class="text-start mb-2" style="font-size: 0.88rem;">
                    <p class="mb-2">Berikan catatan perbaikan atau alasan penolakan untuk:</p>
                    <div class="p-2 rounded border bg-light mb-2">
                        <strong class="text-dark d-block mb-1">${course.title}</strong>
                        <span class="text-muted small"><i class="fas fa-user-tie me-1"></i> ${teacherName}</span>
                    </div>
                    <p class="mb-1 text-muted small">Catatan ini akan tersimpan dan dapat dibaca oleh instruktur untuk memperbaiki kursus:</p>
                </div>
            `,
            input: "textarea",
            inputPlaceholder: "Contoh: Mohon lengkapi kuis evaluasi akhir bab 2 dan perbaiki video pengantar...",
            inputAttributes: {
                "aria-label": "Catatan evaluasi atau revisi",
                style: "min-height: 100px; font-size: 0.85rem;"
            },
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-paper-plane me-1"></i> Kirim Catatan & Tolak',
            cancelButtonText: "Batal",
            reverseButtons: true,
            inputValidator: (val) => {
                if (!val || !val.trim()) {
                    return "Catatan perbaikan / alasan penolakan wajib diisi!";
                }
            }
        });

        if (!reason || !reason.trim()) return;

        setProcessingCourseId(course.course_id);
        try {
            await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                action: "reject",
                rejection_reason: reason.trim()
            });

            Toast().fire({
                icon: "warning",
                title: "Kursus Ditolak / Diminta Revisi",
                text: `Catatan perbaikan telah dikirim untuk "${course.title}".`
            });

            await fetchCourses(true);
            if (typeof onCountsUpdatedRef.current === "function") {
                onCountsUpdatedRef.current();
            }
        } catch (error) {
            console.error("[CourseReviewTab] Error rejecting course:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Menolak Kursus",
                text: error.response?.data?.error || error.response?.data?.detail || "Terjadi kesalahan saat memproses penolakan"
            });
        } finally {
            setProcessingCourseId(null);
        }
    };

    // Quick Toggle Archive / Disable / Restore
    const handleQuickToggleDisable = async (course) => {
        if (!course?.course_id) return;
        const isCurrentlyDisabled = course.platform_status === "Disabled";
        const newStatus = isCurrentlyDisabled ? "Published" : "Disabled";

        const result = await Swal.fire({
            title: isCurrentlyDisabled ? "Aktifkan Kembali Kursus?" : "Nonaktifkan / Arsipkan Kursus?",
            html: `
                <div class="text-start" style="font-size: 0.88rem;">
                    <p class="mb-2">Anda akan mengubah status kursus:</p>
                    <div class="p-2 rounded border bg-light mb-2">
                        <strong class="text-dark">${course.title}</strong>
                    </div>
                    <p class="mb-0 text-muted small">
                        ${isCurrentlyDisabled
                    ? '<i class="fas fa-check-circle me-1 text-teal"></i> Kursus ini akan kembali berstatus <b>Terbit</b> dan dapat diakses peserta pembelajaran.'
                    : '<i class="fas fa-exclamation-triangle me-1 text-danger"></i> Kursus yang dinonaktifkan akan disembunyikan dari katalog peserta dan diarsipkan.'}
                    </p>
                </div>
            `,
            icon: isCurrentlyDisabled ? "question" : "warning",
            showCancelButton: true,
            confirmButtonColor: isCurrentlyDisabled ? "#0d9488" : "#e11d48",
            cancelButtonColor: "#64748b",
            confirmButtonText: isCurrentlyDisabled ? '<i class="fas fa-undo me-1"></i> Ya, Aktifkan Kembali' : '<i class="fas fa-ban me-1"></i> Ya, Nonaktifkan',
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setProcessingCourseId(course.course_id);
        try {
            await apiInstance.patch(`/admin/course-direct-edit/${course.course_id}/`, {
                platform_status: newStatus
            });

            Toast().fire({
                icon: "success",
                title: isCurrentlyDisabled ? "Kursus Diaktifkan Kembali" : "Kursus Berhasil Dinonaktifkan",
                text: isCurrentlyDisabled ? `"${course.title}" kini kembali aktif.` : `"${course.title}" telah diarsipkan.`
            });

            await fetchCourses(true);
            if (typeof onCountsUpdatedRef.current === "function") {
                onCountsUpdatedRef.current();
            }
        } catch (error) {
            console.error("[CourseReviewTab] Error toggling status:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Mengubah Status",
                text: error.response?.data?.error || error.response?.data?.detail || "Terjadi kesalahan saat mengubah status kursus"
            });
        } finally {
            setProcessingCourseId(null);
        }
    };

    // Handle view details navigation
    const handleViewDetails = (course) => {
        if (course.course_id) {
            navigate(`/admin/review-course/${course.course_id}/`);
        } else {
            Toast().fire({
                icon: "error",
                title: "Error",
                text: "Course ID tidak ditemukan."
            });
        }
    };

    // Format Indonesian readable dates
    const formatDate = (dateString) => {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return String(dateString);
        }
    };

    // Client-side quick filter fallback, multi-field match & smart sorting (Fase 2C)
    const filteredCourses = useMemo(() => {
        const result = courses.filter((course) => {
            // Search query filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const titleMatch = (course.title || "").toLowerCase().includes(query);
                const teacherMatch = (course.teacher?.full_name || course.user?.full_name || "").toLowerCase().includes(query);
                const catMatch = (course.category?.title || "").toLowerCase().includes(query);
                const idMatch = (course.course_id || "").toLowerCase().includes(query);
                const reasonMatch = (course.rejection_reason || "").toLowerCase().includes(query);
                if (!titleMatch && !teacherMatch && !catMatch && !idMatch && !reasonMatch) {
                    return false;
                }
            }

            // Category filter
            if (selectedCategory && selectedCategory !== "all") {
                const catId = course.category?.id;
                const catSlug = course.category?.slug;
                if (String(catId) !== String(selectedCategory) && catSlug !== selectedCategory) {
                    return false;
                }
            }

            // Level filter
            if (selectedLevel && selectedLevel !== "all") {
                const courseLevel = (course.level || "").toLowerCase();
                if (courseLevel !== selectedLevel.toLowerCase()) {
                    return false;
                }
            }

            // Quiz completeness filter
            if (quizCompleteness && quizCompleteness !== "all") {
                const quizCount = course.quizzes?.length || 0;
                if (quizCompleteness === "has_quiz" && quizCount === 0) {
                    return false;
                }
                if (quizCompleteness === "no_quiz" && quizCount > 0) {
                    return false;
                }
            }

            return true;
        });

        // Smart client-side sorting
        return result.sort((a, b) => {
            if (sortOrder === "recent") {
                const dateA = new Date(a.review_submitted_date || a.date || 0);
                const dateB = new Date(b.review_submitted_date || b.date || 0);
                return dateB - dateA;
            }
            if (sortOrder === "oldest") {
                const dateA = new Date(a.review_submitted_date || a.date || 0);
                const dateB = new Date(b.review_submitted_date || b.date || 0);
                return dateA - dateB;
            }
            if (sortOrder === "title_asc") {
                return (a.title || "").localeCompare(b.title || "", "id");
            }
            if (sortOrder === "title_desc") {
                return (b.title || "").localeCompare(a.title || "", "id");
            }
            if (sortOrder === "lessons_desc") {
                const { lessonsCount: countA } = getCourseCurriculumSummary(a);
                const { lessonsCount: countB } = getCourseCurriculumSummary(b);
                return countB - countA;
            }
            if (sortOrder === "sections_desc") {
                const { sectionsCount: countA } = getCourseCurriculumSummary(a);
                const { sectionsCount: countB } = getCourseCurriculumSummary(b);
                return countB - countA;
            }
            return 0;
        });
    }, [courses, searchQuery, selectedCategory, selectedLevel, quizCompleteness, sortOrder]);

    // Export current course list to CSV (Excel compatible with UTF-8 BOM)
    const handleExportCSV = () => {
        if (!filteredCourses || filteredCourses.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada data untuk diekspor",
                text: "Daftar kursus saat ini kosong berdasarkan filter yang dipilih."
            });
            return;
        }

        try {
            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
                return `"${s}"`;
            };

            const headers = [
                "No",
                "Judul Kursus",
                "Course ID",
                "Kategori",
                "Instruktur",
                "Level",
                "Bobot JP",
                "Status Platform",
                "Tipe Pengajuan",
                "Jumlah Bagian",
                "Jumlah Pelajaran",
                "Jumlah Kuis",
                "Tanggal Pengajuan",
                "Disetujui Oleh",
                "Tanggal Persetujuan",
                "Catatan Revisi / Penolakan"
            ];

            const rows = filteredCourses.map((c, idx) => {
                const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(c);
                const teacherName = c.teacher?.full_name || c.user?.full_name || "-";
                const dateStr = formatDate(c.review_submitted_date || c.date);
                const approvalDateStr = c.approval_date ? formatDate(c.approval_date) : "-";
                const submissionType = c.platform_status === "Review" 
                    ? (c.rejection_reason ? "Revisi Diajukan Ulang" : "Pengajuan Baru")
                    : c.platform_status;
                const jpStr = `${calculateCourseJP(c)} JP`;

                return [
                    idx + 1,
                    escapeCSV(c.title || "Tanpa Judul"),
                    escapeCSV(c.course_id || "-"),
                    escapeCSV(c.category?.title || "Umum"),
                    escapeCSV(teacherName),
                    escapeCSV(c.level || "Semua Level"),
                    escapeCSV(jpStr),
                    escapeCSV(c.platform_status || "Draft"),
                    escapeCSV(submissionType),
                    sectionsCount,
                    lessonsCount,
                    quizzesCount,
                    escapeCSV(dateStr),
                    escapeCSV(c.approved_by_name || "-"),
                    escapeCSV(approvalDateStr),
                    escapeCSV(c.rejection_reason || "-")
                ].join(",");
            });

            const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\r\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const dateStamp = new Date().toISOString().slice(0, 10);
            const statusLabel = filterStatus || "semua";
            link.href = URL.createObjectURL(blob);
            link.download = `Rekap_Kursus_SetjenDPDRI_${statusLabel}_${dateStamp}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            Toast().fire({
                icon: "success",
                title: "Berhasil Mengekspor Data",
                text: `${filteredCourses.length} data kursus berhasil diekspor ke file CSV.`
            });
        } catch (err) {
            console.error("[CourseReviewTab] Export error:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal Mengekspor",
                text: "Terjadi kesalahan saat mengekspor data ke CSV."
            });
        }
    };

    // Multi-select helpers & derived collections (Fase 3: Batch Actions)
    const isAllSelected = useMemo(() => {
        return filteredCourses.length > 0 && filteredCourses.every(c => selectedCourseIds.includes(c.course_id));
    }, [filteredCourses, selectedCourseIds]);

    const isSomeSelected = useMemo(() => {
        return selectedCourseIds.length > 0 && !isAllSelected;
    }, [selectedCourseIds, isAllSelected]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedCourseIds([]);
        } else {
            setSelectedCourseIds(filteredCourses.map(c => c.course_id));
        }
    };

    const handleToggleSelectOne = (courseId) => {
        if (!courseId) return;
        setSelectedCourseIds(prev =>
            prev.includes(courseId)
                ? prev.filter(id => id !== courseId)
                : [...prev, courseId]
        );
    };

    const handleClearSelection = () => {
        setSelectedCourseIds([]);
    };

    const selectedCourses = useMemo(() => {
        return courses.filter(c => selectedCourseIds.includes(c.course_id));
    }, [courses, selectedCourseIds]);

    const pendingInSelected = useMemo(() => {
        return selectedCourses.filter(c => c.platform_status === "Review" || c.platform_status === "Rejected" || c.platform_status === "Draft");
    }, [selectedCourses]);

    const reviewInSelected = useMemo(() => {
        return selectedCourses.filter(c => c.platform_status === "Review");
    }, [selectedCourses]);

    const activeInSelected = useMemo(() => {
        return selectedCourses.filter(c => c.platform_status !== "Disabled");
    }, [selectedCourses]);

    const disabledInSelected = useMemo(() => {
        return selectedCourses.filter(c => c.platform_status === "Disabled");
    }, [selectedCourses]);

    // Bulk Approve Course Action
    const handleBulkApprove = async () => {
        if (pendingInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada kursus yang perlu disetujui",
                text: "Pilih kursus dengan status 'Review', 'Draft', atau 'Ditolak' terlebih dahulu."
            });
            return;
        }

        const result = await Swal.fire({
            title: `Setujui ${pendingInSelected.length} Kursus Sekaligus?`,
            html: `
                <div class="text-start" style="font-size: 0.86rem;">
                    <p class="mb-2">Anda akan menyetujui dan mempublikasikan <b>${pendingInSelected.length} kursus</b> berikut:</p>
                    <div class="p-2 border rounded bg-light mb-2" style="max-height: 160px; overflow-y: auto;">
                        <ul class="list-unstyled mb-0">
                            ${pendingInSelected.map((c, i) => `
                                <li class="py-1 border-bottom d-flex align-items-center justify-content-between">
                                    <span class="text-truncate me-2 fw-semibold" style="max-width: 300px;">${i + 1}. ${c.title}</span>
                                    <span class="badge bg-secondary" style="font-size: 0.68rem;">${c.platform_status}</span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                    <div class="alert alert-info py-2 px-2 mb-0" style="font-size: 0.78rem;">
                        <i class="fas fa-info-circle me-1"></i> Seluruh kursus ini akan langsung berstatus <b>Terbit (Published)</b> dan dapat diakses pegawai Setjen DPD RI.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-check-double me-1"></i> Ya, Setujui Semua (${pendingInSelected.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;

        for (const course of pendingInSelected) {
            try {
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "approve"
                });
                successCount++;
            } catch (err) {
                console.error(`[CourseReviewTab] Error bulk approving course ${course.course_id}:`, err);
                failCount++;
            }
        }

        setBulkProcessing(false);
        setSelectedCourseIds([]);

        if (failCount === 0) {
            Toast().fire({
                icon: "success",
                title: "Persetujuan Massal Berhasil",
                text: `${successCount} kursus berhasil disetujui & dipublikasikan.`
            });
        } else {
            Swal.fire({
                icon: "warning",
                title: "Persetujuan Selesai dengan Catatan",
                text: `${successCount} kursus berhasil disetujui, namun ${failCount} kursus mengalami kendala.`
            });
        }

        await fetchCourses(true);
        if (typeof onCountsUpdatedRef.current === "function") {
            onCountsUpdatedRef.current();
        }
    };

    // Bulk Reject / Request Revision with Reason
    const handleBulkReject = async () => {
        if (reviewInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada kursus yang perlu ditinjau",
                text: "Pilih kursus dengan status 'Review' untuk melakukan penolakan atau permintaan revisi."
            });
            return;
        }

        const { value: reason } = await Swal.fire({
            title: `Tolak / Minta Revisi ${reviewInSelected.length} Kursus?`,
            html: `
                <div class="text-start mb-2" style="font-size: 0.86rem;">
                    <p class="mb-2">Anda akan menolak dan meminta perbaikan untuk <b>${reviewInSelected.length} kursus</b> berikut:</p>
                    <div class="p-2 border rounded bg-light mb-2" style="max-height: 140px; overflow-y: auto;">
                        <ul class="list-unstyled mb-0">
                            ${reviewInSelected.map((c, i) => `
                                <li class="py-1 border-bottom text-truncate">
                                    <span class="fw-semibold">${i + 1}. ${c.title}</span>
                                    <span class="text-muted ms-1" style="font-size: 0.72rem;">(${c.teacher?.full_name || c.user?.full_name || "Instruktur"})</span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                    <p class="mb-1 text-muted small">Catatan perbaikan berikut akan dikirimkan kepada seluruh instruktur terkait:</p>
                </div>
            `,
            input: "textarea",
            inputPlaceholder: "Contoh: Mohon lengkapi kuis evaluasi akhir bab dan perbaiki silabus materi sesuai standar Setjen DPD RI...",
            inputAttributes: {
                "aria-label": "Catatan evaluasi atau revisi massal",
                style: "min-height: 90px; font-size: 0.85rem;"
            },
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-paper-plane me-1"></i> Tolak & Kirim Catatan (${reviewInSelected.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true,
            inputValidator: (val) => {
                if (!val || !val.trim()) {
                    return "Catatan perbaikan / alasan penolakan wajib diisi!";
                }
            }
        });

        if (!reason || !reason.trim()) return;

        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;

        for (const course of reviewInSelected) {
            try {
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "reject",
                    rejection_reason: reason.trim()
                });
                successCount++;
            } catch (err) {
                console.error(`[CourseReviewTab] Error bulk rejecting course ${course.course_id}:`, err);
                failCount++;
            }
        }

        setBulkProcessing(false);
        setSelectedCourseIds([]);

        if (failCount === 0) {
            Toast().fire({
                icon: "warning",
                title: "Penolakan Massal Berhasil",
                text: `${successCount} kursus berhasil ditolak dengan catatan perbaikan.`
            });
        } else {
            Swal.fire({
                icon: "warning",
                title: "Penolakan Selesai dengan Catatan",
                text: `${successCount} kursus berhasil ditolak, namun ${failCount} kursus mengalami kendala.`
            });
        }

        await fetchCourses(true);
        if (typeof onCountsUpdatedRef.current === "function") {
            onCountsUpdatedRef.current();
        }
    };

    // Bulk Disable / Archive Course Action
    const handleBulkDisable = async () => {
        if (activeInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada kursus aktif",
                text: "Semua kursus terpilih sudah dalam status nonaktif."
            });
            return;
        }

        const result = await Swal.fire({
            title: `Nonaktifkan / Arsipkan ${activeInSelected.length} Kursus?`,
            html: `
                <div class="text-start" style="font-size: 0.86rem;">
                    <p class="mb-2">Anda akan menonaktifkan & mengarsipkan <b>${activeInSelected.length} kursus</b> berikut:</p>
                    <div class="p-2 border rounded bg-light mb-2" style="max-height: 160px; overflow-y: auto;">
                        <ul class="list-unstyled mb-0">
                            ${activeInSelected.map((c, i) => `
                                <li class="py-1 border-bottom text-truncate">
                                    <span class="fw-semibold">${i + 1}. ${c.title}</span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                    <p class="mb-0 text-muted small">
                        <i class="fas fa-exclamation-triangle me-1 text-danger"></i> Kursus yang dinonaktifkan akan disembunyikan dari katalog peserta.
                    </p>
                </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-ban me-1"></i> Ya, Nonaktifkan Semua (${activeInSelected.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;

        for (const course of activeInSelected) {
            try {
                await apiInstance.patch(`/admin/course-direct-edit/${course.course_id}/`, {
                    platform_status: "Disabled"
                });
                successCount++;
            } catch (err) {
                console.error(`[CourseReviewTab] Error bulk disabling course ${course.course_id}:`, err);
                failCount++;
            }
        }

        setBulkProcessing(false);
        setSelectedCourseIds([]);

        Toast().fire({
            icon: "success",
            title: "Arsip Massal Berhasil",
            text: `${successCount} kursus telah dinonaktifkan / diarsipkan.`
        });

        await fetchCourses(true);
        if (typeof onCountsUpdatedRef.current === "function") {
            onCountsUpdatedRef.current();
        }
    };

    // Bulk Restore / Activate Course Action
    const handleBulkRestore = async () => {
        if (disabledInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada kursus nonaktif",
                text: "Tidak ada kursus nonaktif di antara item yang dipilih."
            });
            return;
        }

        const result = await Swal.fire({
            title: `Aktifkan Kembali ${disabledInSelected.length} Kursus?`,
            html: `
                <div class="text-start" style="font-size: 0.86rem;">
                    <p class="mb-2">Anda akan mengaktifkan kembali <b>${disabledInSelected.length} kursus</b> berikut ke status Terbit (Published):</p>
                    <div class="p-2 border rounded bg-light mb-2" style="max-height: 160px; overflow-y: auto;">
                        <ul class="list-unstyled mb-0">
                            ${disabledInSelected.map((c, i) => `
                                <li class="py-1 border-bottom text-truncate">
                                    <span class="fw-semibold">${i + 1}. ${c.title}</span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-undo me-1"></i> Ya, Aktifkan Semua (${disabledInSelected.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setBulkProcessing(true);
        let successCount = 0;

        for (const course of disabledInSelected) {
            try {
                await apiInstance.patch(`/admin/course-direct-edit/${course.course_id}/`, {
                    platform_status: "Published"
                });
                successCount++;
            } catch (err) {
                console.error(`[CourseReviewTab] Error bulk restoring course ${course.course_id}:`, err);
            }
        }

        setBulkProcessing(false);
        setSelectedCourseIds([]);

        Toast().fire({
            icon: "success",
            title: "Aktivasi Massal Berhasil",
            text: `${successCount} kursus berhasil diaktifkan kembali ke status Terbit.`
        });

        await fetchCourses(true);
        if (typeof onCountsUpdatedRef.current === "function") {
            onCountsUpdatedRef.current();
        }
    };

    // Bulk Export Selected Courses to CSV
    const handleBulkExportSelectedCSV = () => {
        if (!selectedCourses || selectedCourses.length === 0) return;

        try {
            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
                return `"${s}"`;
            };

            const headers = [
                "No",
                "Judul Kursus",
                "Course ID",
                "Kategori",
                "Instruktur",
                "Level",
                "Bobot JP",
                "Status Platform",
                "Tipe Pengajuan",
                "Jumlah Bagian",
                "Jumlah Pelajaran",
                "Jumlah Kuis",
                "Tanggal Pengajuan",
                "Disetujui Oleh",
                "Tanggal Persetujuan",
                "Catatan Revisi / Penolakan"
            ];

            const rows = selectedCourses.map((c, idx) => {
                const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(c);
                const teacherName = c.teacher?.full_name || c.user?.full_name || "-";
                const dateStr = formatDate(c.review_submitted_date || c.date);
                const approvalDateStr = c.approval_date ? formatDate(c.approval_date) : "-";
                const submissionType = c.platform_status === "Review" 
                    ? (c.rejection_reason ? "Revisi Diajukan Ulang" : "Pengajuan Baru")
                    : c.platform_status;
                const jpStr = `${calculateCourseJP(c)} JP`;

                return [
                    idx + 1,
                    escapeCSV(c.title || "Tanpa Judul"),
                    escapeCSV(c.course_id || "-"),
                    escapeCSV(c.category?.title || "Umum"),
                    escapeCSV(teacherName),
                    escapeCSV(c.level || "Semua Level"),
                    escapeCSV(jpStr),
                    escapeCSV(c.platform_status || "Draft"),
                    escapeCSV(submissionType),
                    sectionsCount,
                    lessonsCount,
                    quizzesCount,
                    escapeCSV(dateStr),
                    escapeCSV(c.approved_by_name || "-"),
                    escapeCSV(approvalDateStr),
                    escapeCSV(c.rejection_reason || "-")
                ].join(",");
            });

            const csvContent = [headers.map(h => `"${h}"`).join(","), ...rows].join("\r\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const dateStamp = new Date().toISOString().slice(0, 10);
            link.href = URL.createObjectURL(blob);
            link.download = `Rekap_Kursus_Pilihan_SetjenDPDRI_${dateStamp}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            Toast().fire({
                icon: "success",
                title: "Berhasil Mengekspor Pilihan",
                text: `${selectedCourses.length} kursus terpilih berhasil diekspor ke file CSV.`
            });
        } catch (err) {
            console.error("[CourseReviewTab] Export selected error:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal Mengekspor",
                text: "Terjadi kesalahan saat mengekspor data terpilih."
            });
        }
    };

    // Get status display badge
    const renderStatusBadge = (status, course = null) => {
        switch (status) {
            case "Review": {
                const isResubmission = Boolean(course?.rejection_reason);
                return (
                    <span
                        className={`course-card-badge-status status-review ${isResubmission ? "status-resubmission" : ""}`}
                        title={isResubmission ? `Revisi diajukan ulang oleh instruktur. Catatan sebelumnya: ${course.rejection_reason}` : "Pengajuan baru dari instruktur"}
                    >
                        <i className={`fas ${isResubmission ? "fa-history" : "fa-clock"}`}></i>
                        {isResubmission ? "Revisi Diajukan" : "Pengajuan Baru"}
                    </span>
                );
            }
            case "Published":
                return (
                    <span className="course-card-badge-status status-published">
                        <i className="fas fa-check-circle"></i>
                        Terbit
                    </span>
                );
            case "Draft":
                return (
                    <span className="course-card-badge-status status-draft">
                        <i className="fas fa-pencil-alt"></i>
                        Draft
                    </span>
                );
            case "Rejected":
                return (
                    <span className="course-card-badge-status status-rejected">
                        <i className="fas fa-times-circle"></i>
                        Ditolak
                    </span>
                );
            case "Disabled":
                return (
                    <span className="course-card-badge-status status-disabled">
                        <i className="fas fa-ban"></i>
                        Nonaktif
                    </span>
                );
            default:
                return (
                    <span className="course-card-badge-status status-draft">
                        {status || "Draft"}
                    </span>
                );
        }
    };

    return (
        <div className="cm-courses-tab">
            {/* 1. Header Bar with Module Info on Left and Interactive Stats Ribbon sticking to Right on Same Row */}
            <div className="cm-compact-header-card mb-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <div className="cm-header-icon-box bg-teal-subtle text-teal">
                            <i className="fas fa-check-circle"></i>
                        </div>
                        <div>
                            <h3 className="cm-module-title mb-0">Review & Kurasi Kursus</h3>
                            <p className="cm-module-desc mb-0">Tinjau kelayakan silabus, evaluasi materi pembelajaran, dan persetujuan penerbitan kursus</p>
                        </div>
                    </div>

                    {/* Live Stats Ribbon (Interactive High-Density KPI Quick Filters) */}
                    <div className="cm-stats-ribbon">
                        <div
                            className={`cm-stat-card ${filterStatus === "all" ? "active" : ""}`}
                            onClick={() => setFilterStatus("all")}
                            title="Klik untuk melihat semua kursus"
                        >
                            <div className="cm-stat-icon-wrap stat-all">
                                <i className="fas fa-layer-group"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val">{stats.all}</span>
                                <span className="cm-stat-name">Semua Kursus</span>
                            </div>
                        </div>

                        <div
                            className={`cm-stat-card stat-card-review ${filterStatus === "Review" ? "active" : ""} ${stats.review > 0 ? "has-pending" : ""}`}
                            onClick={() => setFilterStatus("Review")}
                            title="Klik untuk memfilter kursus yang menunggu reviu admin"
                        >
                            <div className="cm-stat-icon-wrap stat-review">
                                <i className="fas fa-hourglass-half"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: stats.review > 0 ? "#d97706" : "inherit" }}>
                                    {stats.review}
                                </span>
                                <span className="cm-stat-name">Perlu Review</span>
                            </div>
                            {stats.review > 0 && (
                                <span className="cm-stat-alert-dot" title="Ada kursus menunggu persetujuan"></span>
                            )}
                        </div>

                        <div
                            className={`cm-stat-card ${filterStatus === "Published" ? "active" : ""}`}
                            onClick={() => setFilterStatus("Published")}
                            title="Klik untuk memfilter kursus yang sudah dipublikasikan"
                        >
                            <div className="cm-stat-icon-wrap stat-published">
                                <i className="fas fa-check-circle"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: "#059669" }}>{stats.published}</span>
                                <span className="cm-stat-name">Dipublikasi</span>
                            </div>
                        </div>

                        <div
                            className={`cm-stat-card ${filterStatus === "Rejected" ? "active" : ""}`}
                            onClick={() => setFilterStatus("Rejected")}
                            title="Klik untuk memfilter kursus yang ditolak / perlu revisi"
                        >
                            <div className="cm-stat-icon-wrap stat-rejected">
                                <i className="fas fa-times-circle"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: stats.rejected > 0 ? "#dc2626" : "inherit" }}>
                                    {stats.rejected}
                                </span>
                                <span className="cm-stat-name">Ditolak</span>
                            </div>
                        </div>

                        <div
                            className={`cm-stat-card ${filterStatus === "Disabled" ? "active" : ""}`}
                            onClick={() => setFilterStatus("Disabled")}
                            title="Klik untuk memfilter kursus yang dinonaktifkan / diarsipkan"
                        >
                            <div className="cm-stat-icon-wrap stat-disabled">
                                <i className="fas fa-ban"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: stats.disabled > 0 ? "#475569" : "inherit" }}>
                                    {stats.disabled || 0}
                                </span>
                                <span className="cm-stat-name">Nonaktif</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Single-Row Unified Executive Control Toolbar */}
            <div className="cm-toolbar-wrapper">
                <div className="cm-controls-left">
                    {/* Search Input */}
                    <div className="cm-search-box">
                        <i className="fas fa-search cm-search-icon"></i>
                        <input
                            type="text"
                            className="cm-search-input"
                            placeholder="Cari kursus, instruktur, kategori..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="cm-search-clear"
                                onClick={() => setSearchQuery("")}
                                title="Hapus pencarian"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    {/* Category Dropdown with Icon */}
                    <div className="cm-select-wrap">
                        <i className="fas fa-filter cm-select-icon"></i>
                        <select
                            className="cm-select-control"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            title="Filter kategori"
                        >
                            <option value="all">Semua Kategori ({categories.length})</option>
                            {categories.map((cat) => (
                                <option key={cat.id || cat.slug} value={cat.id || cat.slug}>
                                    {cat.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Level Dropdown with Icon (Fase 2C) */}
                    <div className="cm-select-wrap">
                        <i className="fas fa-layer-group cm-select-icon"></i>
                        <select
                            className="cm-select-control"
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                            title="Filter tingkat kesulitan / level"
                        >
                            <option value="all">Semua Level</option>
                            <option value="Beginner">Pemula (Beginner)</option>
                            <option value="Intermediate">Menengah (Intermediate)</option>
                            <option value="Advanced">Mahir (Advanced)</option>
                        </select>
                    </div>

                    {/* Quiz Completeness Dropdown (Fase 2C) */}
                    <div className="cm-select-wrap">
                        <i className="fas fa-clipboard-question cm-select-icon"></i>
                        <select
                            className="cm-select-control"
                            value={quizCompleteness}
                            onChange={(e) => setQuizCompleteness(e.target.value)}
                            title="Filter kelengkapan kuis evaluasi"
                        >
                            <option value="all">Semua Evaluasi</option>
                            <option value="has_quiz">Ada Kuis</option>
                            <option value="no_quiz">Tanpa Kuis</option>
                        </select>
                    </div>

                    {/* Sort Order Dropdown with Icon */}
                    <div className="cm-select-wrap">
                        <i className="fas fa-sort-amount-down cm-select-icon"></i>
                        <select
                            className="cm-select-control"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            title="Urutkan daftar kursus"
                        >
                            <option value="recent">Terbaru Diajukan</option>
                            <option value="oldest">Terlama Dibuat</option>
                            <option value="title_asc">Judul (A-Z)</option>
                            <option value="title_desc">Judul (Z-A)</option>
                            <option value="lessons_desc">Pelajaran Terbanyak</option>
                            <option value="sections_desc">Bagian Bab Terbanyak</option>
                        </select>
                    </div>
                </div>

                <div className="cm-controls-right">
                    {/* Quick Link to Central Reports & Evaluations Hub */}
                    <Link
                        to="/admin/reports/?tab=course-evaluations"
                        className="btn-cm-quick-link"
                        title="Buka Pusat Laporan Eksekutif & Evaluasi Mutu Seluruh Kursus"
                    >
                        <i className="fas fa-chart-pie"></i>
                        <span className="d-none d-lg-inline">Pusat Laporan & Evaluasi</span>
                    </Link>

                    {/* Export to CSV Button */}
                    <button
                        type="button"
                        className="btn-cm-export"
                        onClick={handleExportCSV}
                        title="Ekspor daftar kursus saat ini ke berkas CSV / Excel"
                        disabled={loading || filteredCourses.length === 0}
                    >
                        <i className="fas fa-file-export text-teal"></i>
                        <span className="d-none d-md-inline">Ekspor CSV</span>
                    </button>

                    {/* View Mode Toggle (Grid vs Table) */}
                    <div className="cm-view-toggle" title="Pilih tampilan">
                        <button
                            type="button"
                            className={`cm-view-btn ${viewMode === "grid" ? "active" : ""}`}
                            onClick={() => handleSetViewMode("grid")}
                            title="Tampilan Kartu Ringkas"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button
                            type="button"
                            className={`cm-view-btn ${viewMode === "table" ? "active" : ""}`}
                            onClick={() => handleSetViewMode("table")}
                            title="Tampilan Tabel Rapat"
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        className="cm-refresh-btn"
                        onClick={() => fetchCourses(true)}
                        disabled={refreshing || loading}
                        title="Segarkan daftar kursus"
                    >
                        <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
                    </button>
                </div>
            </div>

            {/* Active Filters Pill Bar (Fase 2C) */}
            {hasActiveFilters && (
                <div className="cm-active-filters-bar mb-2.5">
                    <span className="cm-active-filter-label">
                        <i className="fas fa-filter me-1 text-teal" style={{ color: "#0d9488" }}></i>
                        Filter Aktif:
                    </span>
                    <div className="cm-filter-pills-list">
                        {searchQuery.trim() && (
                            <span className="cm-filter-pill">
                                <span>Cari: <b>"{searchQuery}"</b></span>
                                <button type="button" onClick={() => setSearchQuery("")} title="Hapus pencarian">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {selectedCategory !== "all" && (
                            <span className="cm-filter-pill">
                                <span>Kategori: <b>{categories.find(c => String(c.id) === String(selectedCategory) || c.slug === selectedCategory)?.title || selectedCategory}</b></span>
                                <button type="button" onClick={() => setSelectedCategory("all")} title="Hapus filter kategori">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {selectedLevel !== "all" && (
                            <span className="cm-filter-pill">
                                <span>Level: <b>{selectedLevel}</b></span>
                                <button type="button" onClick={() => setSelectedLevel("all")} title="Hapus filter level">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {quizCompleteness !== "all" && (
                            <span className="cm-filter-pill">
                                <span>Kuis: <b>{quizCompleteness === "has_quiz" ? "Ada Kuis" : "Tanpa Kuis"}</b></span>
                                <button type="button" onClick={() => setQuizCompleteness("all")} title="Hapus filter kuis">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {sortOrder !== "recent" && (
                            <span className="cm-filter-pill">
                                <span>Urutan: <b>{
                                    sortOrder === "oldest" ? "Terlama" :
                                    sortOrder === "title_asc" ? "A-Z" :
                                    sortOrder === "title_desc" ? "Z-A" :
                                    sortOrder === "lessons_desc" ? "Pelajaran Terbanyak" :
                                    sortOrder === "sections_desc" ? "Bab Terbanyak" : sortOrder
                                }</b></span>
                                <button type="button" onClick={() => setSortOrder("recent")} title="Kembalikan urutan default">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}

                        <button
                            type="button"
                            className="cm-btn-reset-all"
                            onClick={handleResetAllFilters}
                            title="Reset semua filter ke default"
                        >
                            <i className="fas fa-undo-alt me-1"></i>
                            Reset Semua
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-teal" style={{ color: "#0f766e" }} role="status">
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                    <p className="mt-2 text-muted small">Memuat data kursus real-time...</p>
                </div>
            ) : filteredCourses.length === 0 ? (
                /* Compact Meaningful Empty State */
                <div className="cm-empty-container">
                    <div className="cm-empty-icon">
                        {filterStatus === "Review" ? (
                            <i className="fas fa-clipboard-check"></i>
                        ) : (
                            <i className="fas fa-search"></i>
                        )}
                    </div>
                    <h5 className="cm-empty-title">
                        {filterStatus === "Review"
                            ? "Semua Pengajuan Telah Ditinjau"
                            : "Tidak Ditemukan Kursus yang Cocok"}
                    </h5>
                    <p className="cm-empty-desc">
                        {filterStatus === "Review"
                            ? "Saat ini tidak ada kursus yang menunggu persetujuan review dari instruktur. Semua konten terkelola dengan baik."
                            : `Tidak ada data kursus yang sesuai dengan kriteria filter "${filterStatus}". Coba ubah kata kunci atau reset filter.`}
                    </p>
                    <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap">
                        {filterStatus !== "all" && (
                            <button
                                className="cm-btn-reset-filter"
                                onClick={() => {
                                    setFilterStatus("all");
                                    handleResetAllFilters();
                                }}
                            >
                                <i className="fas fa-layer-group me-1"></i>
                                Tampilkan Semua Kursus ({stats.all})
                            </button>
                        )}
                        {hasActiveFilters && (
                            <button
                                className="cm-btn-reset-filter"
                                style={{ background: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" }}
                                onClick={handleResetAllFilters}
                            >
                                <i className="fas fa-undo-alt me-1"></i>
                                Reset Filter Pencarian
                            </button>
                        )}
                    </div>
                </div>
            ) : viewMode === "grid" ? (
                /* Compact Grid View (4 Columns on Wide Screens, 3 on Large) */
                <div className="row g-2 g-xl-3">
                    {filteredCourses.map((course) => {
                        const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(course);
                        const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur";
                        const teacherInitial = teacherName.charAt(0).toUpperCase();

                        return (
                            <div key={course.course_id} className="col-xxl-3 col-xl-4 col-md-6 col-12">
                                <div className={`course-card-compact ${selectedCourseIds.includes(course.course_id) ? "is-selected" : ""}`}>
                                    {/* Thumbnail Header */}
                                    <div className="course-card-thumb-wrap">
                                        {/* Selection Checkbox (Fase 3: Batch Actions) */}
                                        <div
                                            className="course-card-select-box"
                                            onClick={(e) => e.stopPropagation()}
                                            title={selectedCourseIds.includes(course.course_id) ? "Batalkan pilihan kursus ini" : "Pilih kursus ini untuk aksi massal"}
                                        >
                                            <input
                                                type="checkbox"
                                                className="form-check-input cm-card-checkbox"
                                                checked={selectedCourseIds.includes(course.course_id)}
                                                onChange={() => handleToggleSelectOne(course.course_id)}
                                            />
                                        </div>

                                        <img
                                            src={getImageUrl(course.image)}
                                            alt={course.title}
                                            className="course-card-thumb"
                                            onError={(e) => {
                                                e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                            }}
                                        />
                                        {/* Status Badge */}
                                        {renderStatusBadge(course.platform_status, course)}

                                        {/* Level Badge */}
                                        <span className="course-card-badge-level">
                                            {course.level || "Semua Level"}
                                        </span>

                                        {/* JP Badge */}
                                        <span
                                            className="course-card-badge-jp"
                                            title={`Bobot Pelatihan: ${calculateCourseJP(course)} Jam Pelatihan (1 JP = 45 menit / UU No. 20/2023)`}
                                        >
                                            <i className="fas fa-business-time"></i>
                                            {calculateCourseJP(course)} JP
                                        </span>
                                    </div>

                                    {/* Card Body */}
                                    <div className="course-card-body">
                                        {/* Category & Date Meta Row */}
                                        <div className="course-card-meta-line">
                                            <span className="course-card-cat-tag">
                                                <i className="fas fa-folder-open me-1"></i>
                                                {course.category?.title || "Umum"}
                                            </span>
                                            <span className="course-card-date-compact" title={course.review_submitted_date || course.date}>
                                                <i className="far fa-clock me-1"></i>
                                                {formatDate(course.review_submitted_date || course.date)}
                                            </span>
                                        </div>
                                        {course.approved_by_name && (
                                            <div className="text-truncate text-muted mt-1" style={{ fontSize: "0.72rem" }} title={`Disetujui oleh: ${course.approved_by_name}`}>
                                                <i className="fas fa-user-check text-teal me-1"></i>
                                                Disetujui: <strong className="text-dark">{course.approved_by_name}</strong>
                                            </div>
                                        )}
                                        {course.platform_status === "Rejected" && course.rejection_reason && (
                                            <div className="course-card-rejection-note" title={`Alasan Penolakan: ${course.rejection_reason}`}>
                                                <i className="fas fa-exclamation-triangle flex-shrink-0"></i>
                                                <span className="text-truncate">Catatan: {course.rejection_reason}</span>
                                            </div>
                                        )}

                                        {/* Course Title */}
                                        <h5
                                            className="course-card-title"
                                            onClick={() => handleOpenPreview(course)}
                                            title="Klik untuk pratinjau cepat silabus & kurikulum (Drawer)"
                                            style={{ cursor: "pointer" }}
                                        >
                                            {course.title}
                                        </h5>

                                        {/* Instructor Info */}
                                        <div className="course-card-teacher">
                                            {course.teacher?.image ? (
                                                <img
                                                    src={getImageUrl(course.teacher.image)}
                                                    alt={teacherName}
                                                    className="course-card-avatar"
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="course-card-avatar">
                                                    {teacherInitial}
                                                </div>
                                            )}
                                            <span className="course-card-teacher-name">{teacherName}</span>
                                        </div>

                                        {/* Micro Metrics Bar */}
                                        <div className="course-card-metrics">
                                            <div className="course-card-metric-item" title={`Bobot Jam Pelatihan: ${calculateCourseJP(course)} JP (1 JP = 45 menit / UU No. 20/2023)`}>
                                                <i className="fas fa-award text-teal" style={{ color: "#0d9488" }}></i>
                                                <strong style={{ color: "#0f766e" }}>{calculateCourseJP(course)} JP</strong>
                                            </div>
                                            <div className="course-card-metric-item" title="Jumlah Bagian Kurikulum">
                                                <i className="fas fa-layer-group"></i>
                                                <span>{sectionsCount} Bagian</span>
                                            </div>
                                            <div className="course-card-metric-item" title="Jumlah Pelajaran">
                                                <i className="fas fa-play-circle"></i>
                                                <span>{lessonsCount} Pelajaran</span>
                                            </div>
                                            <div className="course-card-metric-item" title="Jumlah Kuis Evaluasi">
                                                <i className="fas fa-clipboard-question"></i>
                                                <span>{quizzesCount} Kuis</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="course-card-actions">
                                            <button
                                                type="button"
                                                className="btn-review-primary"
                                                onClick={() => handleViewDetails(course)}
                                                title="Lihat rincian materi, kuis, dan evaluasi kelayakan terbit (Halaman Telaah Lengkap)"
                                            >
                                                <i className="fas fa-clipboard-check"></i>
                                                <span>{course.platform_status === "Review" ? (course.rejection_reason ? "Telaah Revisi" : "Telaah Kursus") : "Tinjau"}</span>
                                            </button>

                                            {/* Quick Action: Preview Drawer */}
                                            <button
                                                type="button"
                                                className="btn-action-quick-preview"
                                                onClick={() => handleOpenPreview(course)}
                                                title="Pratinjau Cepat Silabus (Drawer)"
                                            >
                                                <i className="fas fa-eye"></i>
                                            </button>

                                            {/* Quick Action: Approve */}
                                            {(course.platform_status === "Review" || course.platform_status === "Rejected") && (
                                                <button
                                                    type="button"
                                                    className="btn-action-quick-approve"
                                                    onClick={() => handleQuickApprove(course)}
                                                    disabled={processingCourseId === course.course_id}
                                                    title={course.platform_status === "Rejected" ? "Setujui Ulang Kursus" : "Setujui Cepat & Publikasikan Langsung"}
                                                >
                                                    <i className={`fas ${processingCourseId === course.course_id ? "fa-spinner fa-spin" : "fa-check"}`}></i>
                                                </button>
                                            )}

                                            {/* Quick Action: Reject */}
                                            {course.platform_status === "Review" && (
                                                <button
                                                    type="button"
                                                    className="btn-action-quick-reject"
                                                    onClick={() => handleQuickReject(course)}
                                                    disabled={processingCourseId === course.course_id}
                                                    title="Tolak & Beri Catatan Revisi untuk Instruktur"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            )}

                                            {/* Quick Action: Disable */}
                                            {course.platform_status === "Published" && (
                                                <button
                                                    type="button"
                                                    className="btn-action-quick-disable"
                                                    onClick={() => handleQuickToggleDisable(course)}
                                                    disabled={processingCourseId === course.course_id}
                                                    title="Nonaktifkan / Arsipkan Kursus dari Katalog"
                                                >
                                                    <i className={`fas ${processingCourseId === course.course_id ? "fa-spinner fa-spin" : "fa-ban"}`}></i>
                                                </button>
                                            )}

                                            {/* Quick Action: Restore */}
                                            {course.platform_status === "Disabled" && (
                                                <button
                                                    type="button"
                                                    className="btn-action-quick-restore"
                                                    onClick={() => handleQuickToggleDisable(course)}
                                                    disabled={processingCourseId === course.course_id}
                                                    title="Aktifkan Kembali Kursus ke Status Terbit"
                                                >
                                                    <i className={`fas ${processingCourseId === course.course_id ? "fa-spinner fa-spin" : "fa-undo"}`}></i>
                                                </button>
                                            )}

                                            <Link
                                                to={`/admin/courses/${course.course_id}/edit/`}
                                                className="btn-review-evaluation"
                                                title="Edit materi, metadata, dan kurikulum kursus langsung ke versi publik"
                                            >
                                                <i className="fas fa-edit"></i>
                                                <span>Edit</span>
                                            </Link>

                                            {course.platform_status === "Published" && course.slug && (
                                                <a
                                                    href={`/course-detail/${course.slug}/`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-review-evaluation px-2"
                                                    title="Buka Halaman Publik Kursus (Tab Baru)"
                                                    style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}
                                                >
                                                    <i className="fas fa-external-link-alt"></i>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Dense Table View (High-Density List Mode) */
                <div className="cm-table-responsive">
                    <table className="cm-dense-table">
                        <thead>
                            <tr>
                                <th style={{ width: "38px", textAlign: "center" }}>
                                    <input
                                        type="checkbox"
                                        className="form-check-input cm-table-checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isSomeSelected;
                                        }}
                                        onChange={handleToggleSelectAll}
                                        title={isAllSelected ? "Batalkan pilihan semua" : "Pilih semua kursus pada tampilan ini"}
                                    />
                                </th>
                                <th style={{ width: "36px", textAlign: "center" }}>No</th>
                                <th>Kursus</th>
                                <th>Instruktur</th>
                                <th>Level</th>
                                <th>Kurikulum</th>
                                <th>Status</th>
                                <th>Tanggal</th>
                                <th style={{ textAlign: "right" }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCourses.map((course, idx) => {
                                const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(course);
                                const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur";
                                const isSelected = selectedCourseIds.includes(course.course_id);

                                return (
                                    <tr key={course.course_id} className={isSelected ? "cm-row-selected" : ""}>
                                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input cm-table-checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectOne(course.course_id)}
                                                title={isSelected ? "Batalkan pilihan" : "Pilih kursus ini"}
                                            />
                                        </td>
                                        <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
                                            {idx + 1}
                                        </td>
                                        <td>
                                            <div className="table-course-cell">
                                                <img
                                                    src={getImageUrl(course.image)}
                                                    alt={course.title}
                                                    className="table-course-thumb"
                                                    onError={(e) => {
                                                        e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                    }}
                                                />
                                                <div className="table-course-info">
                                                    <span
                                                        className="table-course-title"
                                                        onClick={() => handleOpenPreview(course)}
                                                        title="Klik untuk pratinjau cepat silabus & kurikulum (Drawer)"
                                                        style={{ cursor: "pointer" }}
                                                    >
                                                        {course.title}
                                                    </span>
                                                    <span className="table-course-cat">
                                                        {course.category?.title || "Umum"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: "#334155" }}>
                                                {teacherName}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-column gap-1">
                                                <span className="badge bg-light text-dark border align-self-start" style={{ fontSize: "0.72rem" }}>
                                                    {course.level || "Semua"}
                                                </span>
                                                <span
                                                    className="badge border align-self-start"
                                                    style={{ fontSize: "0.68rem", color: "#0d9488", borderColor: "#ccfbf1", backgroundColor: "#f0fdfa" }}
                                                    title={`Bobot Diklat: ${calculateCourseJP(course)} Jam Pelatihan (1 JP = 45 menit / UU No. 20/2023)`}
                                                >
                                                    <i className="fas fa-business-time me-1"></i>
                                                    {calculateCourseJP(course)} JP
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="small text-muted">
                                                <strong>{sectionsCount}</strong> bag · <strong>{lessonsCount}</strong> pel · <strong>{quizzesCount}</strong> kuis
                                            </span>
                                        </td>
                                        <td>
                                            {course.platform_status === "Review" && (
                                                <div>
                                                    <span className={`badge ${course.rejection_reason ? "bg-info text-white" : "bg-warning text-dark"}`} style={{ fontSize: "0.74rem" }}>
                                                        <i className={`fas ${course.rejection_reason ? "fa-history" : "fa-clock"} me-1`}></i>
                                                        {course.rejection_reason ? "Revisi Diajukan" : "Pengajuan Baru"}
                                                    </span>
                                                    {course.rejection_reason && (
                                                        <div className="text-muted mt-1 text-truncate" style={{ fontSize: "0.70rem", maxWidth: "160px" }} title={`Catatan Sebelumnya: ${course.rejection_reason}`}>
                                                            <i className="fas fa-info-circle me-1 text-info"></i>
                                                            Sebelumnya: {course.rejection_reason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {course.platform_status === "Published" && (
                                                <div>
                                                    <span className="badge bg-success text-white">
                                                        <i className="fas fa-check me-1"></i>
                                                        Terbit
                                                    </span>
                                                    {course.approved_by_name && (
                                                        <div className="text-muted mt-0" style={{ fontSize: "0.72rem" }} title={`Disetujui oleh: ${course.approved_by_name}`}>
                                                            <i className="fas fa-user-check text-teal me-1"></i>
                                                            {course.approved_by_name}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {course.platform_status === "Draft" && (
                                                <span className="badge bg-secondary text-white">
                                                    <i className="fas fa-file me-1"></i>
                                                    Draft
                                                </span>
                                            )}
                                            {course.platform_status === "Rejected" && (
                                                <div>
                                                    <span className="badge bg-danger text-white">
                                                        <i className="fas fa-times me-1"></i>
                                                        Ditolak
                                                    </span>
                                                    {course.rejection_reason && (
                                                        <div className="text-danger mt-1 text-truncate" style={{ fontSize: "0.70rem", maxWidth: "160px" }} title={`Catatan Revisi: ${course.rejection_reason}`}>
                                                            <i className="fas fa-info-circle me-1"></i>
                                                            {course.rejection_reason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {course.platform_status === "Disabled" && (
                                                <span className="badge bg-secondary text-white">
                                                    <i className="fas fa-ban me-1"></i>
                                                    Nonaktif
                                                </span>
                                            )}
                                            {!["Review", "Published", "Draft", "Rejected", "Disabled"].includes(course.platform_status) && (
                                                <span className="badge bg-secondary">
                                                    {course.platform_status || "Draft"}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="small text-muted" title={course.review_submitted_date || course.date}>
                                                {formatDate(course.review_submitted_date || course.date)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div className="d-flex align-items-center justify-content-end gap-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm py-1 px-2 d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{
                                                        fontSize: "0.78rem",
                                                        fontWeight: 600,
                                                        backgroundColor: course.platform_status === "Review" ? (course.rejection_reason ? "#0f766e" : "#0d9488") : "#002B49",
                                                        color: "#ffffff",
                                                        borderColor: course.platform_status === "Review" ? "#0d9488" : "#002B49",
                                                        borderRadius: "6px"
                                                    }}
                                                    onClick={() => handleViewDetails(course)}
                                                    title="Tinjau Detail & Kurikulum Kursus (Halaman Telaah Lengkap)"
                                                >
                                                    <i className="fas fa-clipboard-check"></i>
                                                    <span>{course.platform_status === "Review" ? (course.rejection_reason ? "Telaah Revisi" : "Telaah Kursus") : "Tinjau"}</span>
                                                </button>

                                                {/* Quick Action: Preview Drawer */}
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-teal py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm"
                                                    style={{ fontSize: "0.78rem", borderColor: "#0d9488", color: "#0d9488", borderRadius: "6px", height: "28px", minWidth: "28px" }}
                                                    onClick={() => handleOpenPreview(course)}
                                                    title="Pratinjau Cepat Silabus (Drawer)"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>

                                                {/* Quick Action: Approve */}
                                                {(course.platform_status === "Review" || course.platform_status === "Rejected") && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-success py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm"
                                                        style={{ fontSize: "0.78rem", borderRadius: "6px", height: "28px", minWidth: "28px" }}
                                                        onClick={() => handleQuickApprove(course)}
                                                        disabled={processingCourseId === course.course_id}
                                                        title={course.platform_status === "Rejected" ? "Setujui Ulang Kursus" : "Setujui Cepat & Terbitkan"}
                                                    >
                                                        <i className={`fas ${processingCourseId === course.course_id ? "fa-spinner fa-spin" : "fa-check"}`}></i>
                                                    </button>
                                                )}

                                                {/* Quick Action: Reject */}
                                                {course.platform_status === "Review" && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm"
                                                        style={{ fontSize: "0.78rem", borderRadius: "6px", height: "28px", minWidth: "28px" }}
                                                        onClick={() => handleQuickReject(course)}
                                                        disabled={processingCourseId === course.course_id}
                                                        title="Tolak & Beri Catatan Revisi"
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                )}

                                                {/* Quick Action: Disable */}
                                                {course.platform_status === "Published" && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm text-secondary"
                                                        style={{ fontSize: "0.78rem", borderRadius: "6px", height: "28px", minWidth: "28px" }}
                                                        onClick={() => handleQuickToggleDisable(course)}
                                                        disabled={processingCourseId === course.course_id}
                                                        title="Nonaktifkan / Arsipkan"
                                                    >
                                                        <i className={`fas ${processingCourseId === course.course_id ? "fa-spinner fa-spin" : "fa-ban"}`}></i>
                                                    </button>
                                                )}

                                                {/* Quick Action: Restore */}
                                                {course.platform_status === "Disabled" && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-primary py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm"
                                                        style={{ fontSize: "0.78rem", borderRadius: "6px", height: "28px", minWidth: "28px" }}
                                                        onClick={() => handleQuickToggleDisable(course)}
                                                        disabled={processingCourseId === course.course_id}
                                                        title="Aktifkan Kembali"
                                                    >
                                                        <i className={`fas ${processingCourseId === course.course_id ? "fa-spinner fa-spin" : "fa-undo"}`}></i>
                                                    </button>
                                                )}

                                                <Link
                                                    to={`/admin/courses/${course.course_id}/edit/`}
                                                    className="btn btn-sm btn-outline-teal py-1 px-2 d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{ fontSize: "0.78rem", fontWeight: 600, borderColor: "#0d9488", color: "#0d9488", borderRadius: "6px" }}
                                                    title="Edit Kursus & Konten Langsung (Live Update)"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                    <span>Edit</span>
                                                </Link>
                                                {course.platform_status === "Published" && course.slug && (
                                                    <a
                                                        href={`/course-detail/${course.slug}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-sm btn-light border py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm text-secondary"
                                                        style={{ fontSize: "0.78rem", borderRadius: "6px", height: "28px" }}
                                                        title="Buka Halaman Publik Kursus (Tab Baru)"
                                                    >
                                                        <i className="fas fa-external-link-alt"></i>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Slide-over Quick Preview Drawer (Fase 2B) */}
            {previewCourse && (
                <>
                    {/* Backdrop overlay */}
                    <div
                        className="cm-drawer-backdrop"
                        onClick={handleClosePreview}
                    />

                    {/* Slide-over Panel */}
                    <div className="cm-preview-drawer">
                        {/* 1. Drawer Header */}
                        <div className="cm-drawer-header">
                            <div className="d-flex align-items-center gap-2">
                                <div className="cm-drawer-icon-box">
                                    <i className="fas fa-eye"></i>
                                </div>
                                <div>
                                    <h5 className="cm-drawer-title mb-0">Pratinjau Cepat Kursus</h5>
                                    <div className="d-flex align-items-center gap-2 mt-0">
                                        <span className="badge bg-light text-dark border" style={{ fontSize: "0.72rem" }}>
                                            ID: {previewCourse.course_id}
                                        </span>
                                        <span className="text-muted" style={{ fontSize: "0.74rem" }}>
                                            {formatDate(previewCourse.review_submitted_date || previewCourse.date)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="cm-drawer-close-btn"
                                onClick={handleClosePreview}
                                title="Tutup Pratinjau (Esc)"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* 2. Drawer Body (Scrollable) */}
                        <div className="cm-drawer-body">
                            {/* Hero / Cover Image & Meta */}
                            <div className="cm-drawer-hero">
                                <div className="cm-drawer-thumb-wrap">
                                    <img
                                        src={getImageUrl(previewCourse.image)}
                                        alt={previewCourse.title}
                                        className="cm-drawer-thumb"
                                        onError={(e) => {
                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                        }}
                                    />
                                    <div className="cm-drawer-thumb-badges">
                                        {renderStatusBadge(previewCourse.platform_status, previewCourse)}
                                        <span className="badge bg-dark bg-opacity-75 text-white">
                                            {previewCourse.level || "Semua Level"}
                                        </span>
                                        <span className="badge bg-teal text-white shadow-xs" style={{ backgroundColor: "#0d9488" }}>
                                            <i className="fas fa-business-time me-1"></i>
                                            {calculateCourseJP(previewCourse)} JP
                                        </span>
                                    </div>
                                </div>

                                <div className="cm-drawer-hero-info">
                                    <div className="cm-drawer-cat-tag mb-1">
                                        <i className="fas fa-folder-open me-1 text-teal"></i>
                                        {previewCourse.category?.title || "Umum"}
                                    </div>
                                    <h4 className="cm-drawer-course-title mb-2">
                                        {previewCourse.title}
                                    </h4>

                                    {/* Rejection Alert if rejected */}
                                    {previewCourse.platform_status === "Rejected" && previewCourse.rejection_reason && (
                                        <div className="alert alert-danger py-2 px-2 mb-2" style={{ fontSize: "0.78rem" }}>
                                            <div className="fw-bold mb-0"><i className="fas fa-exclamation-triangle me-1"></i> Catatan Penolakan / Revisi:</div>
                                            <div>{previewCourse.rejection_reason}</div>
                                        </div>
                                    )}

                                    {/* Instructor Row */}
                                    <div className="d-flex align-items-center gap-2 p-2 bg-light rounded border mb-2">
                                        {previewCourse.teacher?.image ? (
                                            <img
                                                src={getImageUrl(previewCourse.teacher.image)}
                                                alt="Instruktur"
                                                className="rounded-circle"
                                                style={{ width: "34px", height: "34px", objectFit: "cover" }}
                                                onError={(e) => { e.target.style.display = "none"; }}
                                            />
                                        ) : (
                                            <div
                                                className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold"
                                                style={{ width: "34px", height: "34px", fontSize: "0.85rem", backgroundColor: "#0d9488" }}
                                            >
                                                {(previewCourse.teacher?.full_name || previewCourse.user?.full_name || "I").charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-grow-1 overflow-hidden">
                                            <div className="fw-semibold text-dark text-truncate" style={{ fontSize: "0.84rem" }}>
                                                {previewCourse.teacher?.full_name || previewCourse.user?.full_name || "Instruktur"}
                                            </div>
                                            <div className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>
                                                {previewCourse.teacher?.bio || "Instruktur Resmi Setjen DPD RI"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Curriculum Summary Metric Pills */}
                                    {(() => {
                                        const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(previewCourse);
                                        return (
                                            <div className="row g-2 mb-3">
                                                <div className="col-3">
                                                    <div className="p-2 text-center rounded border bg-white shadow-xs">
                                                        <div className="fw-bold text-teal" style={{ fontSize: "1.05rem", color: "#0d9488" }}>
                                                            {calculateCourseJP(previewCourse)} JP
                                                        </div>
                                                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>Bobot Diklat (UU ASN)</div>
                                                    </div>
                                                </div>
                                                <div className="col-3">
                                                    <div className="p-2 text-center rounded border bg-white shadow-xs">
                                                        <div className="fw-bold text-teal" style={{ fontSize: "1.05rem", color: "#0d9488" }}>{sectionsCount}</div>
                                                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>Bagian Bab</div>
                                                    </div>
                                                </div>
                                                <div className="col-3">
                                                    <div className="p-2 text-center rounded border bg-white shadow-xs">
                                                        <div className="fw-bold text-teal" style={{ fontSize: "1.05rem", color: "#0d9488" }}>{lessonsCount}</div>
                                                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>Pelajaran</div>
                                                    </div>
                                                </div>
                                                <div className="col-3">
                                                    <div className="p-2 text-center rounded border bg-white shadow-xs">
                                                        <div className="fw-bold text-teal" style={{ fontSize: "1.05rem", color: "#0d9488" }}>{quizzesCount}</div>
                                                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>Kuis Evaluasi</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <div className="cm-drawer-tabs">
                                <button
                                    type="button"
                                    className={`cm-drawer-tab-btn ${previewActiveTab === "curriculum" ? "active" : ""}`}
                                    onClick={() => setPreviewActiveTab("curriculum")}
                                >
                                    <i className="fas fa-stream me-1"></i>
                                    Silabus Materi
                                    {Array.isArray(previewCourse.curriculum) && (
                                        <span className="cm-drawer-tab-badge">
                                            {previewCourse.curriculum.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`cm-drawer-tab-btn ${previewActiveTab === "quizzes" ? "active" : ""}`}
                                    onClick={() => setPreviewActiveTab("quizzes")}
                                >
                                    <i className="fas fa-clipboard-question me-1"></i>
                                    Kuis Evaluasi
                                    {Array.isArray(previewCourse.quizzes) && previewCourse.quizzes.length > 0 && (
                                        <span className="cm-drawer-tab-badge">
                                            {previewCourse.quizzes.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className={`cm-drawer-tab-btn ${previewActiveTab === "overview" ? "active" : ""}`}
                                    onClick={() => setPreviewActiveTab("overview")}
                                >
                                    <i className="fas fa-info-circle me-1"></i>
                                    Ringkasan & Sasaran
                                </button>
                            </div>

                            {/* Tab 1: Curriculum / Silabus */}
                            {previewActiveTab === "curriculum" && (
                                <div className="cm-drawer-tab-content">
                                    {(!previewCourse.curriculum || !Array.isArray(previewCourse.curriculum) || previewCourse.curriculum.length === 0) ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="fas fa-layer-group fa-2x mb-2 text-muted opacity-50"></i>
                                            <p className="small mb-0">Belum ada kurikulum atau bab materi yang ditambahkan.</p>
                                        </div>
                                    ) : (
                                        <div className="cm-drawer-curriculum-list">
                                            {previewCourse.curriculum.map((section, secIdx) => {
                                                const secId = section.variant_id || secIdx;
                                                const isExpanded = !!expandedSections[secId];
                                                const lessons = section.variant_items || section.items || [];

                                                return (
                                                    <div key={secId} className="cm-drawer-section-card">
                                                        <div
                                                            className="cm-drawer-section-header"
                                                            onClick={() => {
                                                                setExpandedSections(prev => ({
                                                                    ...prev,
                                                                    [secId]: !prev[secId]
                                                                }));
                                                            }}
                                                        >
                                                            <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                                                                <span className="cm-drawer-section-num">
                                                                    {secIdx + 1}
                                                                </span>
                                                                <span className="cm-drawer-section-title text-truncate">
                                                                    {section.title || `Bagian ${secIdx + 1}`}
                                                                </span>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="cm-drawer-lesson-count">
                                                                    {lessons.length} materi
                                                                </span>
                                                                <i className={`fas fa-chevron-down cm-drawer-arrow ${isExpanded ? "rotated" : ""}`}></i>
                                                            </div>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="cm-drawer-section-body">
                                                                {lessons.length === 0 ? (
                                                                    <div className="p-2 text-muted small fst-italic">
                                                                        Belum ada materi pelajaran dalam bagian ini.
                                                                    </div>
                                                                ) : (
                                                                    <div className="cm-drawer-lessons-list">
                                                                        {lessons.map((lesson, lesIdx) => (
                                                                            <div key={lesson.variant_item_id || lesIdx} className="cm-drawer-lesson-item">
                                                                                <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                                                                                    <i className="fas fa-play-circle text-teal" style={{ fontSize: "0.78rem", color: "#0d9488" }}></i>
                                                                                    <span className="cm-drawer-lesson-name text-truncate">
                                                                                        {lesson.title || `Materi ${lesIdx + 1}`}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="d-flex align-items-center gap-2">
                                                                                    {lesson.preview && (
                                                                                        <span className="badge bg-light text-teal border border-teal-subtle" style={{ fontSize: "0.65rem", color: "#0d9488" }}>
                                                                                            Gratis
                                                                                        </span>
                                                                                    )}
                                                                                    {lesson.duration && (
                                                                                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                                                            <i className="far fa-clock me-0"></i>
                                                                                            {lesson.duration}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab 2: Quizzes */}
                            {previewActiveTab === "quizzes" && (
                                <div className="cm-drawer-tab-content">
                                    {(!previewCourse.quizzes || !Array.isArray(previewCourse.quizzes) || previewCourse.quizzes.length === 0) ? (
                                        <div className="text-center py-4 text-muted">
                                            <i className="fas fa-clipboard-question fa-2x mb-2 text-muted opacity-50"></i>
                                            <p className="small mb-0">Kursus ini belum memiliki kuis evaluasi materi.</p>
                                        </div>
                                    ) : (
                                        <div className="cm-drawer-quizzes-list">
                                            {previewCourse.quizzes.map((quiz, qIdx) => (
                                                <div key={quiz.quiz_id || quiz.id || qIdx} className="p-2 rounded border bg-white mb-2 shadow-xs">
                                                    <div className="d-flex align-items-center justify-content-between">
                                                        <div className="fw-semibold text-dark text-truncate" style={{ fontSize: "0.84rem" }}>
                                                            <i className="fas fa-tasks me-1" style={{ color: "#0d9488" }}></i>
                                                            {quiz.title || `Kuis Evaluasi ${qIdx + 1}`}
                                                        </div>
                                                        <span className="badge bg-light text-dark border" style={{ fontSize: "0.72rem" }}>
                                                            {quiz.quiz_type || "Pilihan Ganda"}
                                                        </span>
                                                    </div>
                                                    {quiz.description && (
                                                        <p className="text-muted small mt-1 mb-1 line-clamp-2" style={{ fontSize: "0.76rem" }}>
                                                            {quiz.description}
                                                        </p>
                                                    )}
                                                    <div className="d-flex align-items-center gap-3 mt-1 text-muted" style={{ fontSize: "0.72rem" }}>
                                                        {quiz.passing_score !== undefined && (
                                                            <span>
                                                                <i className="fas fa-percentage me-1" style={{ color: "#0d9488" }}></i>
                                                                Kelulusan: <strong>{quiz.passing_score}%</strong>
                                                            </span>
                                                        )}
                                                        {quiz.questions_count !== undefined && (
                                                            <span>
                                                                <i className="fas fa-question-circle me-1" style={{ color: "#0d9488" }}></i>
                                                                <strong>{quiz.questions_count}</strong> Soal
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab 3: Overview & Description */}
                            {previewActiveTab === "overview" && (
                                <div className="cm-drawer-tab-content">
                                    {/* Course Description */}
                                    <div className="mb-3">
                                        <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "0.82rem" }}>
                                            <i className="fas fa-align-left me-1" style={{ color: "#0d9488" }}></i> Deskripsi Kursus
                                        </h6>
                                        <div
                                            className="p-2 rounded bg-light border text-secondary"
                                            style={{ fontSize: "0.80rem", lineHeight: "1", maxHeight: "180px", overflowY: "auto" }}
                                            dangerouslySetInnerHTML={{
                                                __html: previewCourse.description || "<em>Belum ada deskripsi kursus.</em>"
                                            }}
                                        />
                                    </div>

                                    {/* Learning Outcomes */}
                                    {Array.isArray(previewCourse.learning_outcomes) && previewCourse.learning_outcomes.length > 0 && (
                                        <div className="mb-3">
                                            <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "0.82rem" }}>
                                                <i className="fas fa-check-circle me-1" style={{ color: "#0d9488" }}></i> Sasaran & Capaian Belajar
                                            </h6>
                                            <ul className="list-unstyled mb-0 ps-1" style={{ fontSize: "0.78rem" }}>
                                                {previewCourse.learning_outcomes.map((item, idx) => (
                                                    <li key={idx} className="mb-1 text-secondary d-flex align-items-start gap-1">
                                                        <i className="fas fa-check mt-1" style={{ fontSize: "0.68rem", color: "#0d9488" }}></i>
                                                        <span>{item.outcome || item.text || String(item)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Requirements */}
                                    {Array.isArray(previewCourse.requirements) && previewCourse.requirements.length > 0 && (
                                        <div className="mb-2">
                                            <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "0.82rem" }}>
                                                <i className="fas fa-clipboard-list me-1" style={{ color: "#0d9488" }}></i> Persyaratan Mengikuti
                                            </h6>
                                            <ul className="list-unstyled mb-0 ps-1" style={{ fontSize: "0.78rem" }}>
                                                {previewCourse.requirements.map((item, idx) => (
                                                    <li key={idx} className="mb-1 text-secondary d-flex align-items-start gap-1">
                                                        <i className="fas fa-arrow-right mt-1" style={{ fontSize: "0.68rem", color: "#0d9488" }}></i>
                                                        <span>{item.requirement || item.text || String(item)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 3. Sticky Drawer Footer with Direct Actions */}
                        <div className="cm-drawer-footer">
                            <div className="d-flex align-items-center justify-content-between gap-2 w-100 flex-wrap">
                                <div className="d-flex align-items-center gap-1">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-teal py-1 px-2 d-inline-flex align-items-center gap-1 shadow-sm"
                                        style={{ fontSize: "0.78rem", borderColor: "#0d9488", color: "#0d9488", borderRadius: "6px" }}
                                        onClick={() => {
                                            const c = previewCourse;
                                            handleClosePreview();
                                            handleViewDetails(c);
                                        }}
                                        title="Buka Halaman Review Penuh dengan Evaluator Checklist"
                                    >
                                        <i className="fas fa-external-link-alt"></i>
                                        <span>Review Lengkap</span>
                                    </button>
                                    <Link
                                        to={`/admin/courses/${previewCourse.course_id}/edit/`}
                                        className="btn btn-sm btn-light border py-1 px-2 text-secondary"
                                        style={{ fontSize: "0.78rem", borderRadius: "6px" }}
                                        title="Edit Kursus Langsung"
                                    >
                                        <i className="fas fa-edit"></i>
                                    </Link>
                                </div>

                                {/* Contextual Quick Actions */}
                                <div className="d-flex align-items-center gap-1">
                                    {(previewCourse.platform_status === "Review" || previewCourse.platform_status === "Rejected") && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-teal py-1 px-3 d-inline-flex align-items-center gap-1 shadow-sm text-white"
                                            style={{ fontSize: "0.78rem", backgroundColor: "#0d9488", borderColor: "#0d9488", borderRadius: "6px" }}
                                            onClick={async () => {
                                                const c = previewCourse;
                                                await handleQuickApprove(c);
                                                handleClosePreview();
                                            }}
                                            disabled={processingCourseId === previewCourse.course_id}
                                            title="Setujui dan Publikasikan Kursus Ini"
                                        >
                                            <i className={`fas ${processingCourseId === previewCourse.course_id ? "fa-spinner fa-spin" : "fa-check-circle"}`}></i>
                                            <span>Setujui</span>
                                        </button>
                                    )}

                                    {previewCourse.platform_status === "Review" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger py-1 px-2 d-inline-flex align-items-center gap-1 shadow-sm"
                                            style={{ fontSize: "0.78rem", borderRadius: "6px" }}
                                            onClick={async () => {
                                                const c = previewCourse;
                                                await handleQuickReject(c);
                                                handleClosePreview();
                                            }}
                                            disabled={processingCourseId === previewCourse.course_id}
                                            title="Tolak & Kirim Catatan Revisi"
                                        >
                                            <i className="fas fa-times"></i>
                                            <span>Tolak</span>
                                        </button>
                                    )}

                                    {previewCourse.platform_status === "Published" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary py-1 px-2 d-inline-flex align-items-center gap-1 shadow-sm text-secondary"
                                            style={{ fontSize: "0.78rem", borderRadius: "6px" }}
                                            onClick={async () => {
                                                const c = previewCourse;
                                                await handleQuickToggleDisable(c);
                                                handleClosePreview();
                                            }}
                                            disabled={processingCourseId === previewCourse.course_id}
                                            title="Nonaktifkan / Arsipkan Kursus"
                                        >
                                            <i className={`fas ${processingCourseId === previewCourse.course_id ? "fa-spinner fa-spin" : "fa-ban"}`}></i>
                                            <span>Arsipkan</span>
                                        </button>
                                    )}

                                    {previewCourse.platform_status === "Disabled" && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-teal py-1 px-2 d-inline-flex align-items-center gap-1 shadow-sm"
                                            style={{ fontSize: "0.78rem", borderColor: "#0d9488", color: "#0d9488", borderRadius: "6px" }}
                                            onClick={async () => {
                                                const c = previewCourse;
                                                await handleQuickToggleDisable(c);
                                                handleClosePreview();
                                            }}
                                            disabled={processingCourseId === previewCourse.course_id}
                                            title="Aktifkan Kembali Kursus"
                                        >
                                            <i className={`fas ${processingCourseId === previewCourse.course_id ? "fa-spinner fa-spin" : "fa-undo"}`}></i>
                                            <span>Aktifkan</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Floating Bulk Action Bar (Fase 3: Batch Actions - Modern Compact Pill Dock) */}
            {selectedCourseIds.length > 0 && (
                <div className="cm-floating-bulk-bar shadow-lg">
                    <div className="cm-bulk-bar-inner">
                        <div className="cm-bulk-count-box">
                            <span className="cm-bulk-count-badge">{selectedCourseIds.length}</span>
                            <span className="cm-bulk-count-text">Kursus Terpilih</span>
                        </div>

                        {/* Breakdown status chips (hidden on very small screens) */}
                        <div className="d-none d-lg-flex align-items-center gap-1 ms-1">
                            {reviewInSelected.length > 0 && (
                                <span className="badge bg-warning text-dark border" style={{ fontSize: "0.68rem" }}>
                                    {reviewInSelected.length} Perlu Review
                                </span>
                            )}
                            {activeInSelected.length > 0 && (
                                <span className="badge bg-success text-white" style={{ fontSize: "0.68rem" }}>
                                    {activeInSelected.length} Aktif
                                </span>
                            )}
                            {disabledInSelected.length > 0 && (
                                <span className="badge bg-secondary text-white" style={{ fontSize: "0.68rem" }}>
                                    {disabledInSelected.length} Nonaktif
                                </span>
                            )}
                        </div>

                        <div className="cm-bulk-divider"></div>

                        <div className="cm-bulk-actions-group">
                            {/* Bulk Approve */}
                            {pendingInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="cm-bulk-btn cm-bulk-approve"
                                    onClick={handleBulkApprove}
                                    disabled={bulkProcessing}
                                    title="Setujui dan publikasikan semua kursus terpilih yang berstatus Review, Draft, atau Ditolak"
                                >
                                    <i className={`fas ${bulkProcessing ? "fa-spinner fa-spin" : "fa-check-double"}`}></i>
                                    <span>Setujui ({pendingInSelected.length})</span>
                                </button>
                            )}

                            {/* Bulk Reject / Minta Revisi */}
                            {reviewInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="cm-bulk-btn cm-bulk-reject"
                                    onClick={handleBulkReject}
                                    disabled={bulkProcessing}
                                    title="Tolak dan minta revisi perbaikan untuk kursus terpilih yang menunggu review"
                                >
                                    <i className={`fas ${bulkProcessing ? "fa-spinner fa-spin" : "fa-times-circle"}`}></i>
                                    <span>Tolak ({reviewInSelected.length})</span>
                                </button>
                            )}

                            {/* Bulk Disable / Archive */}
                            {activeInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="cm-bulk-btn cm-bulk-archive"
                                    onClick={handleBulkDisable}
                                    disabled={bulkProcessing}
                                    title="Arsipkan dan sembunyikan semua kursus aktif terpilih"
                                >
                                    <i className={`fas ${bulkProcessing ? "fa-spinner fa-spin" : "fa-ban"}`}></i>
                                    <span>Arsipkan ({activeInSelected.length})</span>
                                </button>
                            )}

                            {/* Bulk Restore / Activate */}
                            {disabledInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="cm-bulk-btn cm-bulk-restore"
                                    onClick={handleBulkRestore}
                                    disabled={bulkProcessing}
                                    title="Aktifkan kembali semua kursus nonaktif terpilih"
                                >
                                    <i className={`fas ${bulkProcessing ? "fa-spinner fa-spin" : "fa-undo"}`}></i>
                                    <span>Aktifkan ({disabledInSelected.length})</span>
                                </button>
                            )}

                            {/* Bulk Export Selected */}
                            <button
                                type="button"
                                className="cm-bulk-btn cm-bulk-export"
                                onClick={handleBulkExportSelectedCSV}
                                disabled={bulkProcessing}
                                title="Unduh data kursus terpilih ke format file CSV"
                            >
                                <i className="fas fa-file-csv text-teal"></i>
                                <span>Ekspor</span>
                            </button>

                            <div className="cm-bulk-divider"></div>

                            {/* Deselect All */}
                            <button
                                type="button"
                                className="cm-bulk-btn cm-bulk-clear"
                                onClick={handleClearSelection}
                                disabled={bulkProcessing}
                                title="Batalkan semua pilihan"
                            >
                                <i className="fas fa-times"></i>
                                <span>Batal</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(CourseReviewTab);
