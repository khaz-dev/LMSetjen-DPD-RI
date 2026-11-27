import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
    FaPlus, FaSearch, FaEdit, FaTrash, FaEye, FaUserGraduate, FaUserTie, 
    FaUsers, FaChartLine, FaUserCheck, FaUserTimes, FaFilter, FaLandmark, FaIdBadge, FaGlobe,
    FaCog, FaUserCog, FaChevronDown, FaBell, FaSpinner, FaArrowRight, FaTimes, FaCheck,
    FaPhone, FaBriefcase, FaBuilding, FaMapMarkerAlt, FaCalendarAlt, FaHistory, FaAward, FaBook, FaKey, FaShieldAlt, FaCheckCircle, FaUser, FaEnvelope
} from "react-icons/fa";
import { 
    MdFilterList, MdCheckBox, MdCheckBoxOutlineBlank,
    MdPersonAdd, MdPeople, MdTrendingUp, MdDashboard, MdSync
} from "react-icons/md";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import Toast, { DeleteConfirmation } from "../plugin/Toast";
import dayjs from "../../utils/dayjs";
import {
    ASN_POSITIONS,
    ASN_INSTITUTIONS_GROUPS,
    PROFESSIONS_LIST,
    COUNTRIES_LIST,
    INDONESIA_PROVINCES_AND_CITIES,
} from "../../data/onboardingData";
import { getValidProfileImageUrl } from "../../utils/imageUtils";
import "./UsersAdmin.css";
import "../../styles/PasswordInput.css";

// Helper to resolve user avatar safely from multiple potential image fields
const resolveUserAvatar = (user) => {
    if (!user) return null;
    const rawImage = user.image || user.profile_image || user.profile?.image;
    if (!rawImage || typeof rawImage !== "string") return null;
    let url = rawImage.trim();
    if (!url || ["default-user.jpg", "default.jpg", "placeholder.jpg"].includes(url)) {
        return null;
    }
    // If relative path without leading slash or /media/
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:image/")) {
        if (!url.startsWith("/")) {
            url = `/media/${url}`;
        }
    }
    return getValidProfileImageUrl(url, null);
};

function UsersAdmin() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({
        show: false,
        status: "initializing", // initializing, syncing, completed, error, cancelled
        message: "Preparing to sync...",
        created: 0,
        updated: 0,
        failed: 0,
        total: 0,
        errors: [],
        currentPage: 0,  // Current page being fetched
        totalPages: 0    // Total pages to fetch
    });
    // Initialize from localStorage for persistence across sessions
    const [lastSuccessfulSyncTime, setLastSuccessfulSyncTime] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("lastSuccessfulSyncTime");
        }
        return null;
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [userTypeFilter, setUserTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    // ✨ PHASE X: Make itemsPerPage configurable (ISSUE FIX #2)
    const [itemsPerPage, setItemsPerPage] = useState(25); // Display 25 users per page by default
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState("create"); // create, edit, view
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);
    
    // ✨ PHASE 67: Simplified backend stats (no pagination refs needed)
    const [backendStats, setBackendStats] = useState({
        total_users: 0,
        active_users: 0,
        students: 0,
        teachers: 0,
        admins: 0,
        inactive_users: 0,
        new_30d: 0,
        active_7d: 0,
        active_rate: 0
    });

    // ✨ PHASE X: Memoized statistics calculation using backend stats (ISSUE FIX #1-4)
    // Now uses pre-calculated backend stats instead of filtering from loaded pages
    const stats = useMemo(() => ({
        total_users: backendStats.total_users,
        active_users: backendStats.active_users,
        students: backendStats.students,
        teachers: backendStats.teachers,
        admins: backendStats.admins,
        inactive_users: backendStats.inactive_users,
        new_30d: backendStats.new_30d,
        active_7d: backendStats.active_7d,
        active_rate: backendStats.active_rate
    }), [backendStats]);
    
    // AbortController for cancelling sync
    const abortControllerRef = useRef(null);
    
    // ✨ PHASE 4.22: Track filter state changes
    const prevFilterState = useRef({ 
        searchTerm: "", 
        roleFilter: "all", 
        statusFilter: "all" 
    });
    
    const [showPasswords, setShowPasswords] = useState({
        password: false,
        password2: false
    });

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };
    
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        phone: "",
        role: "student",
        is_student: true,
        is_instructor: false,
        is_admin: false,
        is_active: true,
        user_type: "UMUM",
        nip: "",
        jenis_jabatan: "",
        instansi_asal: "",
        pekerjaan: "",
        negara: "Indonesia",
        provinsi: "",
        kota_kabupaten: "",
        password: "",
        password2: ""
    });
    const [showEditPassword, setShowEditPassword] = useState(false);
    
    const [passwordValidation, setPasswordValidation] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
        notCommon: true
    });

    // Cascading cities for modal form
    const availableModalCities = useMemo(() => {
        if (!formData.provinsi || !INDONESIA_PROVINCES_AND_CITIES[formData.provinsi]) {
            return [];
        }
        return INDONESIA_PROVINCES_AND_CITIES[formData.provinsi];
    }, [formData.provinsi]);

    const api = useAxios;

    // ✨ PHASE X: Fetch aggregated user stats from backend (ISSUE FIX #1-4)
    // This gets stats for ALL users, not just loaded pages
    const fetchUserStats = useCallback(async () => {
        try {
            const response = await api.get(`/admin/user-stats/?_t=${Date.now()}`);
            if (response.data) {
                setBackendStats({
                    total_users: response.data.total_users || 0,
                    active_users: response.data.active_users || 0,
                    students: response.data.students || 0,
                    teachers: response.data.teachers || 0,
                    admins: response.data.admins || 0,
                    inactive_users: response.data.inactive_users || 0,
                    new_30d: response.data.new_30d || 0,
                    active_7d: response.data.active_7d || 0,
                    active_rate: response.data.active_rate || 0
                });
            }
        } catch (error) {
            console.error("Error fetching user stats:", error);
            // Keep default stats if error
        }
    }, [api]);

    // ✨ PHASE X: Load additional pages on-demand (PERFORMANCE FIX: Load only page 1 on mount)
    // ✨ PHASE 67: Removed loadMorePages - no longer needed with all-data loading

    // ✨ PHASE 67: Simplified fetch - Load ALL users at once
    // New backend endpoint /admin/user-management/all/ returns all users without pagination
    // This eliminates complex on-demand loading logic (1000+ lines reduced to 15 lines)
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            
            // ✨ PHASE 67: Load all users in a single request
            const response = await api.get(`/admin/user-management/all/?_t=${Date.now()}`);
            const usersData = response.data;
            
            // Handle response format: { count, results }
            const allUsers = usersData.results || usersData || [];
            setUsers(allUsers);
            setFilteredUsers(allUsers);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching users:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal mengambil data pengguna"
            });
            setLoading(false);
        }
    }, [api]);

    // Filter users based on search and filters - OPTIMIZED
    // Use useMemo to avoid recreating the filtered array
    const filteredUsersData = useMemo(() => {
        let filtered = [...users];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(user => 
                user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // User Type filter (INTERNAL, ASN, UMUM)
        if (userTypeFilter !== "all") {
            filtered = filtered.filter(user => {
                const ut = (user.user_type || (user.is_internal ? "INTERNAL" : "UMUM")).toUpperCase();
                return ut === userTypeFilter.toUpperCase();
            });
        }

        // Role filter (mendukung multi-role boolean flags yang konsisten dengan KPI card)
        if (roleFilter !== "all") {
            filtered = filtered.filter(user => {
                if (roleFilter === "teacher" || roleFilter === "instructor") {
                    return Boolean(user.is_instructor);
                }
                if (roleFilter === "student") {
                    return Boolean(user.is_student);
                }
                if (roleFilter === "admin") {
                    return Boolean(user.is_admin);
                }
                return user.role === roleFilter;
            });
        }

        // Status filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(user => 
                statusFilter === "active" ? user.is_active : !user.is_active
            );
        }

        return filtered;
    }, [searchTerm, roleFilter, userTypeFilter, statusFilter, users]);

    // Apply filters and reset pagination
    // ✨ PHASE 4.22: Only reset page when FILTERS change, not when data is added (pages loaded)
    // This fixes the bug where last page button didn't work - pages would load but page reset to 1
    useEffect(() => {
        // Check if filters actually changed (not just data updated)
        const filtersChanged = 
            prevFilterState.current.searchTerm !== searchTerm ||
            prevFilterState.current.roleFilter !== roleFilter ||
            prevFilterState.current.userTypeFilter !== userTypeFilter ||
            prevFilterState.current.statusFilter !== statusFilter;
        
        // Update filtered users
        setFilteredUsers(filteredUsersData);
        
        // Only reset to page 1 if filters actually changed
        if (filtersChanged) {
            setCurrentPage(1);
            // Update the stored filter state
            prevFilterState.current = { searchTerm, roleFilter, userTypeFilter, statusFilter };
        }
    }, [filteredUsersData, searchTerm, roleFilter, userTypeFilter, statusFilter]);

    // Keep applyFilters for backward compatibility (no-op now)
    const applyFilters = useCallback(() => {
        // Filtering is now handled by filteredUsersData useMemo
    }, []);

    // ✨ PHASE 67: Removed on-demand pagination state - all data loaded at once
    
    // ✨ PHASE 67: Simplified pagination - all data already loaded, just change displayed page
    const handlePageChange = useCallback((newPage) => {
        setCurrentPage(newPage);
    }, []);

    // ✨ PHASE 67: Simple pagination calculation - all data already loaded
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    // Handle last page correctly - may have fewer items than itemsPerPage
    const isLastPage = currentPage === totalPages;
    const endIndex = isLastPage 
        ? Math.min(startIndex + itemsPerPage, filteredUsers.length)
        : startIndex + itemsPerPage;
    // ✨ PHASE 67: Simple pagination - all data loaded, so no loading state needed
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    // Validate password strength
    const validatePassword = useCallback((password) => {
        const commonPasswords = ["password", "12345678", "qwerty", "abc123", "password123", "admin", "letmein"];
        
        setPasswordValidation({
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            notCommon: !commonPasswords.includes(password.toLowerCase())
        });
    }, []);

    // Handle form submission for create/edit user
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        
        // Validate at least one role is selected
        if (!formData.is_student && !formData.is_instructor && !formData.is_admin) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih setidaknya satu peran"
            });
            return;
        }
        
        try {
            // Prepare submission data with boolean role fields and participant fields
            const submitData = {
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone || "",
                is_student: formData.is_student,
                is_instructor: formData.is_instructor,
                is_admin: formData.is_admin,
                is_active: formData.is_active,
                user_type: formData.user_type,
                nip: formData.nip || "",
                jenis_jabatan: formData.jenis_jabatan || "",
                instansi_asal: formData.instansi_asal || "",
                pekerjaan: formData.pekerjaan || "",
                negara: formData.negara || "Indonesia",
                provinsi: formData.provinsi || "",
                kota_kabupaten: formData.kota_kabupaten || "",
                ...(formData.password && { password: formData.password, password2: formData.password2 || formData.password }),
                ...(modalType === "create" && { role: formData.role || (formData.is_admin ? "admin" : formData.is_instructor ? "teacher" : "student") })
            };

            if (modalType === "create") {
                await api.post("/admin/user-create/", submitData);
                Toast().fire({
                    icon: "success",
                    title: "Pengguna berhasil dibuat"
                });
            } else if (modalType === "edit") {
                await api.put(`/admin/user-update/${selectedUser.id}/`, submitData);
                Toast().fire({
                    icon: "success",
                    title: "Pengguna berhasil diperbarui"
                });
            }
            
            setShowModal(false);
            resetForm();
            fetchUsers();
            fetchUserStats(); // ✨ Refresh stats after user changes
        } catch (error) {
            console.error("Error saving user:", error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal menyimpan pengguna"
            });
        }
    }, [modalType, selectedUser, formData, api, fetchUsers]);

    // Handle delete user
    const handleDeleteUser = useCallback(async (userId) => {
        const confirm = await DeleteConfirmation({
            title: "Hapus Pengguna",
            text: "Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan."
        });
        if (!confirm.isConfirmed) return;

        try {
            await api.delete(`/admin/user-delete/${userId}/`);
            Toast().fire({
                icon: "success",
                title: "Pengguna berhasil dihapus"
            });
            fetchUsers();
            fetchUserStats(); // ✨ Refresh stats after user deletion
        } catch (error) {
            console.error("Error deleting user:", error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal menghapus pengguna"
            });
        }
    }, [api, fetchUsers]);

    // Handle bulk actions
    const handleBulkAction = useCallback(async (action) => {
        if (selectedUsers.length === 0) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih pengguna terlebih dahulu"
            });
            return;
        }

        const confirm = await DeleteConfirmation({
            title: "Hapus Pengguna",
            text: "Apakah Anda yakin ingin menghapus pengguna-pengguna ini? Tindakan ini tidak dapat dibatalkan."
        });
        if (!confirm.isConfirmed) return;

        try {
            await api.post("/admin/user-bulk-actions/", {
                action: action,
                user_ids: selectedUsers
            });

            Toast().fire({
                icon: "success",
                title: `Successfully ${action}d selected users`
            });
            setSelectedUsers([]);
            setShowBulkActions(false);
            fetchUsers();
            fetchUserStats(); // ✨ Refresh stats after bulk actions
        } catch (error) {
            console.error("Error performing bulk action:", error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || "Gagal melakukan tindakan massal"
            });
        }
    }, [selectedUsers, api, fetchUsers]);

    // Sync external users data - ENHANCED WITH SMART POLLING
    const syncData = async () => {
        const syncStartedAt = new Date();
        
        // Create new AbortController for this sync operation
        abortControllerRef.current = new AbortController();
        
        setSyncing(true);
        let progressPollInterval = null;
        let pollTimeout = null;
        let autoCloseTimeout = null;
        
        const initialProgress = {
            show: true,
            status: "initializing",
            message: "Connecting to external API...",
            created: 0,
            updated: 0,
            failed: 0,
            total: 0,
            errors: [],
            new: 0,
            changed: 0,
            unchanged: 0,
            comparisonComplete: false,
            lastSuccessfulSyncTimestamp: null
        };
        
        // Set initial progress state IMMEDIATELY to show the modal
        setSyncProgress(initialProgress);
        
        // Add a small delay to ensure state is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // SMART POLLING: Stop when backend signals completion
        // DECLARE OUTSIDE TRY BLOCK so it's accessible in catch block
        let shouldStopPolling = false;
        
        try {
            // Update progress to syncing
            setSyncProgress(prev => ({
                ...prev,
                show: true,
                status: "syncing",
                message: "Syncing user data from external source..."
            }));
            
            // Start the actual sync on backend
            const syncPromise = api.post("/admin/sync-external-users/", {}, {
                signal: abortControllerRef.current.signal
            });
            
            // Poll the backend for real progress updates
            // This gets actual live progress from the backend with completion detection
            progressPollInterval = setInterval(async () => {
                if (shouldStopPolling) return;
                
                try {
                    const progressResponse = await api.get("/admin/sync-progress/");
                    
                    if (progressResponse.data) {
                        setSyncProgress(prev => ({
                            ...prev,
                            created: progressResponse.data.created || 0,
                            updated: progressResponse.data.updated || 0,
                            failed: progressResponse.data.failed || 0,
                            total: progressResponse.data.total || prev.total,
                            errors: progressResponse.data.errors || [],
                            new: progressResponse.data.new || 0,
                            changed: progressResponse.data.changed || 0,
                            unchanged: progressResponse.data.unchanged || 0,
                            comparisonComplete: progressResponse.data.comparison_complete || false,
                            lastSuccessfulSyncTimestamp: progressResponse.data.last_successful_sync_timestamp || null,
                            currentPage: progressResponse.data.current_page || 0,
                            totalPages: progressResponse.data.total_pages || 0
                        }));
                        
                        // SMART POLLING: Check if backend says sync is done
                        // Stop polling when backend explicitly signals completion
                        if (progressResponse.data.completion_timestamp && !progressResponse.data.is_syncing) {
                            console.log("Backend completed sync, stopping polling");
                            shouldStopPolling = true;
                        }
                    }
                } catch (pollError) {
                    // Silently fail on poll errors - polling is best-effort
                    console.debug("Progress poll error (non-critical):", pollError);
                }
            }, 500); // Poll every 500ms for real-time updates
            
            // TIMEOUT FALLBACK: If polling doesn't stop in 5 minutes, force completion
            pollTimeout = setTimeout(() => {
                console.log("Polling timeout reached, forcing completion detection");
                shouldStopPolling = true;
            }, 5 * 60 * 1000); // 5 minutes max
            
            // Wait for the actual sync to complete
            const response = await syncPromise;
            
            // Sync completed! Stop polling immediately
            shouldStopPolling = true;
            if (progressPollInterval) clearInterval(progressPollInterval);
            if (pollTimeout) clearTimeout(pollTimeout);
            
            const { results } = response.data;
            
            // Update progress with final results from server
            setSyncProgress(prev => ({
                ...prev,
                status: "completed",
                message: "Sync completed successfully! ✓",
                created: results.created || 0,
                updated: results.updated || 0,
                failed: results.failed || 0,
                total: results.total_users || 0,
                errors: results.errors || []
            }));
            
            // Fetch the last sync info from database (source of truth)
            try {
                const syncInfoResponse = await api.get("/admin/last-sync-info/");
                if (syncInfoResponse.data && syncInfoResponse.data.last_sync_time) {
                    setLastSuccessfulSyncTime(syncInfoResponse.data.last_sync_time);
                    localStorage.setItem("lastSuccessfulSyncTime", syncInfoResponse.data.last_sync_time);
                    console.log("Updated last sync time from database:", syncInfoResponse.data.last_sync_time);
                }
            } catch (error) {
                console.debug("Failed to fetch updated sync info from database:", error);
                // Fallback: use current time if database fetch fails
                const now = new Date().toISOString();
                setLastSuccessfulSyncTime(now);
                localStorage.setItem("lastSuccessfulSyncTime", now);
            }
            
            Toast().fire({
                icon: "success",
                title: `Sync completed! Created: ${results.created}, Updated: ${results.updated}`,
            });
            
            if (results.errors && results.errors.length > 0) {
                console.warn("Sync errors:", results.errors);
            }
            
            // AUTO-CLOSE: Show completion screen for 2.5 seconds then auto-close
            // This gives user time to see the success message
            autoCloseTimeout = setTimeout(() => {
                console.log("Auto-closing sync progress modal");
                closeSyncProgress();
            }, 2500); // 2.5 seconds
            
            // Refresh users list after sync (no need to wait for auto-close)
            await fetchUsers();
            await fetchUserStats(); // ✨ Refresh stats after sync
            
        } catch (error) {
            // Stop polling on error
            shouldStopPolling = true;
            if (progressPollInterval) clearInterval(progressPollInterval);
            if (pollTimeout) clearTimeout(pollTimeout);
            
            // Check if it was cancelled
            if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
                setSyncProgress(prev => ({
                    ...prev,
                    status: "cancelled",
                    message: "Sync operation was cancelled by user"
                }));
                
                Toast().fire({
                    icon: "info",
                    title: "Sync operation cancelled"
                });
                
                // Auto-close cancelled after 1.5 seconds
                autoCloseTimeout = setTimeout(() => {
                    closeSyncProgress();
                }, 1500);
            } else {
                console.error("Error syncing external users:", error);

                // Recovery path for transient CORS/network failures:
                // backend may still complete sync while browser request fails.
                const isNetworkLikeError = !error.response && (
                    error.code === "ERR_NETWORK" ||
                    error.message === "Network Error" ||
                    error.message?.toLowerCase().includes("network")
                );

                if (isNetworkLikeError) {
                    setSyncProgress(prev => ({
                        ...prev,
                        status: "syncing",
                        message: "Koneksi terputus sesaat. Memverifikasi status sinkronisasi..."
                    }));

                    let recoveredFromProgress = false;

                    // Retry a few times to confirm whether sync actually finished on backend.
                    for (let attempt = 0; attempt < 8; attempt++) {
                        try {
                            const progressResponse = await api.get("/admin/sync-progress/");
                            const progress = progressResponse?.data || {};

                            const backendCompleted = (
                                progress.status === "completed" ||
                                (progress.completion_timestamp && progress.is_syncing === false)
                            );

                            if (backendCompleted) {
                                recoveredFromProgress = true;
                                const recoveredTotal = progress.total || (progress.created + progress.updated + progress.failed);

                                setSyncProgress(prev => ({
                                    ...prev,
                                    status: "completed",
                                    message: "Sync completed successfully! ✓",
                                    created: progress.created || 0,
                                    updated: progress.updated || 0,
                                    failed: progress.failed || 0,
                                    total: recoveredTotal || prev.total,
                                    errors: progress.errors || []
                                }));

                                const lastSyncTs = progress.last_successful_sync_timestamp;
                                if (lastSyncTs) {
                                    setLastSuccessfulSyncTime(lastSyncTs);
                                    localStorage.setItem("lastSuccessfulSyncTime", lastSyncTs);
                                }

                                Toast().fire({
                                    icon: "success",
                                    title: `Sync completed! Created: ${progress.created || 0}, Updated: ${progress.updated || 0}`,
                                });

                                await fetchUsers();
                                await fetchUserStats();

                                autoCloseTimeout = setTimeout(() => {
                                    closeSyncProgress();
                                }, 2500);

                                break;
                            }
                        } catch (recoveryError) {
                            console.debug("Recovery progress check failed (non-critical):", recoveryError);
                        }

                        await new Promise(resolve => setTimeout(resolve, 1200));
                    }

                    // Secondary fallback: if DB last sync timestamp moved after this run started,
                    // treat operation as completed to avoid false negative UI state.
                    if (!recoveredFromProgress) {
                        try {
                            const lastSyncResponse = await api.get("/admin/last-sync-info/");
                            const lastSyncTime = lastSyncResponse?.data?.last_sync_time;
                            if (lastSyncTime && new Date(lastSyncTime) >= syncStartedAt) {
                                recoveredFromProgress = true;
                                setLastSuccessfulSyncTime(lastSyncTime);
                                localStorage.setItem("lastSuccessfulSyncTime", lastSyncTime);

                                setSyncProgress(prev => ({
                                    ...prev,
                                    status: "completed",
                                    message: "Sinkronisasi selesai. Respons akhir jaringan tidak stabil.",
                                }));

                                Toast().fire({
                                    icon: "success",
                                    title: "Sinkronisasi selesai (terverifikasi dari server)",
                                });

                                await fetchUsers();
                                await fetchUserStats();

                                autoCloseTimeout = setTimeout(() => {
                                    closeSyncProgress();
                                }, 2500);
                            }
                        } catch (lastSyncError) {
                            console.debug("Recovery last-sync check failed (non-critical):", lastSyncError);
                        }
                    }

                    if (recoveredFromProgress) {
                        return;
                    }
                }
                
                setSyncProgress(prev => ({
                    ...prev,
                    status: "error",
                    message: error.response?.data?.error || "Gagal menyinkronkan data pengguna eksternal",
                    errors: [error.response?.data?.error || error.message]
                }));
                
                Toast().fire({
                    icon: "error",
                    title: error.response?.data?.error || "Gagal menyinkronkan data pengguna eksternal"
                });
            }
        } finally {
            setSyncing(false);
            abortControllerRef.current = null;
            
            // Cleanup all timeouts and intervals
            if (progressPollInterval) clearInterval(progressPollInterval);
            if (pollTimeout) clearTimeout(pollTimeout);
            // Note: Don't clear autoCloseTimeout here as it might be needed for auto-close
        }
    };
    
    // Cancel sync operation
    const cancelSync = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setSyncing(false);
        }
    };
    
    // Close sync progress modal
    const closeSyncProgress = () => {
        setSyncProgress(prev => ({
            ...prev,
            show: false
        }));
    };



    // Modal handlers - optimized with useCallback
    const openCreateModal = useCallback(() => {
        setShowModal(true);
        setModalType("create");
        resetForm();
    }, []);

    const openEditModal = useCallback((user) => {
        setShowModal(true);
        setModalType("edit");
        setSelectedUser(user);
        setShowEditPassword(false);
        setFormData({
            full_name: user.full_name || "",
            email: user.email || "",
            phone: user.phone || "",
            role: user.role || "student",
            is_student: user.is_student || false,
            is_instructor: user.is_instructor || false,
            is_admin: user.is_admin || false,
            is_active: user.is_active !== undefined ? user.is_active : true,
            user_type: user.user_type || (user.is_internal ? "INTERNAL" : "UMUM"),
            nip: user.nip || "",
            jenis_jabatan: user.jenis_jabatan || "",
            instansi_asal: user.instansi_asal || "",
            pekerjaan: user.pekerjaan || "",
            negara: user.negara || "Indonesia",
            provinsi: user.provinsi || "",
            kota_kabupaten: user.kota_kabupaten || "",
            password: "",
            password2: ""
        });
    }, []);

    const openViewModal = useCallback(async (user) => {
        try {
            const response = await api.get(`/admin/user-detail/${user.id}/`);
            setSelectedUser(response.data);
            setShowModal(true);
            setModalType("view");
        } catch (error) {
            console.error("Error fetching user details:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail pengguna"
            });
        }
    }, [api]);

    const resetForm = useCallback(() => {
        setFormData({
            full_name: "",
            email: "",
            phone: "",
            role: "student",
            is_student: true,
            is_instructor: false,
            is_admin: false,
            is_active: true,
            user_type: "UMUM",
            nip: "",
            jenis_jabatan: "",
            instansi_asal: "",
            pekerjaan: "",
            negara: "Indonesia",
            provinsi: "",
            kota_kabupaten: "",
            password: "",
            password2: ""
        });
        setShowEditPassword(false);
        setSelectedUser(null);
    }, []);

    // Selection handlers - optimized with useCallback
    const handleSelectAll = useCallback(() => {
        if (selectedUsers.length === paginatedUsers.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(paginatedUsers.map(user => user.id));
        }
    }, [selectedUsers, paginatedUsers]);

    const handleSelectUser = useCallback((userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    }, []);

    // Effects - OPTIMIZED
    useEffect(() => {
        // Only fetch on mount
        if (users.length === 0) {
            fetchUsers();
        }
        // ✨ PHASE X: Fetch user stats on mount (for all users, not just loaded pages)
        fetchUserStats();
    }, []); // Only run on mount

    // ✨ PHASE X: Preload pages based on itemsPerPage (ISSUE FIX #4 - PHASE 4.13)
    // Intelligently preload enough pages to support selected itemsPerPage
    // itemsPerPage 10/25: preload 2-3 pages (40-60 users)
    // itemsPerPage 50: preload 3-4 pages (60-80 users) 
    // itemsPerPage 100: preload 5-6 pages (100-120 users)
    // ✨ PHASE 67: Removed preload effect - all data loaded at once on mount

    // ✨ PHASE 67: Removed itemsPerPage sync effect - all data already loaded

    // Fetch last sync info from database on component mount
    useEffect(() => {
        const fetchLastSyncInfo = async () => {
            try {
                const response = await api.get("/admin/last-sync-info/");
                if (response.data && response.data.last_sync_time) {
                    // Update state from database (source of truth)
                    setLastSuccessfulSyncTime(response.data.last_sync_time);
                    // Also update localStorage for consistency
                    localStorage.setItem("lastSuccessfulSyncTime", response.data.last_sync_time);
                    console.log("Loaded last sync time from database:", response.data.last_sync_time);
                }
            } catch (error) {
                // Silently fail - this is non-critical
                console.debug("Failed to fetch last sync info from database:", error);
                // Fall back to localStorage if available
                const localTime = localStorage.getItem("lastSuccessfulSyncTime");
                if (localTime) {
                    setLastSuccessfulSyncTime(localTime);
                }
            }
        };
        
        fetchLastSyncInfo();
    }, []); // Only run on mount

    useEffect(() => {
        // Apply filters only when filters change, not when users change
        applyFilters();
    }, [searchTerm, roleFilter, userTypeFilter, statusFilter, applyFilters]);

    // ✨ PHASE 67: Removed complex sync effect - no longer needed with all-data loading
    // The old sync effect (PHASE 4.17) coordinated pagination and loading state
    // With all data loaded at once, page changes are instant (no async loading needed)

    useEffect(() => {
        setShowBulkActions(selectedUsers.length > 0);
    }, [selectedUsers]);

    if (loading) {
        return (
            <div className="admin-page-wrapper users-admin-page">
                <AdminHeader />
                <main className="admin-dashboard-container d-flex align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
                    <div className="text-center p-4">
                        <div className="spinner-border text-primary mb-3" style={{ width: "2.5rem", height: "2.5rem" }} role="status">
                            <span className="visually-hidden">Memuat...</span>
                        </div>
                        <h6 className="fw-bold text-dark mb-1">Memuat Data Pengguna...</h6>
                        <p className="text-muted small mb-0">Mengambil data akun real-time dan metrik sistem</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="admin-page-wrapper users-admin-page">
            <AdminHeader />
            
            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    {/* Executive Header Bar */}
                    <div className="admin-exec-header mb-3">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <div>
                                <span className="admin-gov-badge">
                                    <i className="fas fa-landmark me-1"></i> SETJEN DPD RI &bull; ADMIN PANEL
                                </span>
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <h1 className="admin-exec-title mb-0">
                                        <MdPeople className="text-primary fs-3" />
                                        Manajemen Pengguna
                                    </h1>
                                    <span className="admin-live-pulse">
                                        <span className="pulse-dot"></span>
                                        Live Data: {stats.total_users} Akun
                                    </span>
                                </div>
                                <p className="admin-exec-subtitle mb-0">
                                    Kelola akun, hak akses multi-peran, aktivitas sistem, dan sinkronisasi data pengguna secara real-time
                                </p>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                {/* Real Database Sync Info Badge */}
                                <div className="sync-info-compact" title="Waktu sinkronisasi terakhir dari database">
                                    <span className="sync-info-label">Sinkronisasi:</span>
                                    <span className="sync-info-value">
                                        {lastSuccessfulSyncTime ? (
                                            dayjs(lastSuccessfulSyncTime).format("DD MMM YYYY, HH:mm:ss")
                                        ) : (
                                            "Belum Pernah"
                                        )}
                                    </span>
                                </div>

                                <button 
                                    className="admin-btn-sync" 
                                    onClick={syncData}
                                    disabled={syncing}
                                    title="Sinkronisasi data pengguna dari API eksternal"
                                >
                                    {syncing ? (
                                        <>
                                            <FaSpinner className="fa-spin" />
                                            <span>Sinkronisasi...</span>
                                        </>
                                    ) : (
                                        <>
                                            <MdSync />
                                            <span>Sinkronisasi Data</span>
                                        </>
                                    )}
                                </button>

                                <button className="admin-btn-add-user" onClick={openCreateModal}>
                                    <MdPersonAdd />
                                    <span>Tambah Pengguna</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Compact KPI Metric Cards - 100% Real Live Values */}
                    <div className="row g-2 mb-3">
                        {/* 1. Total Pengguna */}
                        <div className="col-xl-2 col-md-4 col-sm-6">
                            <div className="kpi-compact-card kpi-blue">
                                <div className="kpi-icon-wrap">
                                    <FaUsers />
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Total Pengguna</span>
                                    <div className="kpi-number">{stats.total_users}</div>
                                    <span className="kpi-meta info">
                                        {backendStats.new_30d > 0 ? `+${backendStats.new_30d} baru (30 hr)` : 'Terdaftar di LMS'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Pengguna Aktif */}
                        <div className="col-xl-2 col-md-4 col-sm-6">
                            <div className="kpi-compact-card kpi-emerald">
                                <div className="kpi-icon-wrap">
                                    <FaUserCheck />
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Pengguna Aktif</span>
                                    <div className="kpi-number">{stats.active_users}</div>
                                    <span className="kpi-meta positive">
                                        {stats.total_users > 0 ? `${((stats.active_users / stats.total_users) * 100).toFixed(1)}% rasio aktif` : '0%'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Siswa */}
                        <div className="col-xl-2 col-md-4 col-sm-6">
                            <div className="kpi-compact-card kpi-amber">
                                <div className="kpi-icon-wrap">
                                    <FaUserGraduate />
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Peserta</span>
                                    <div className="kpi-number">{stats.students}</div>
                                    <span className="kpi-meta warning">
                                        {stats.total_users > 0 ? `${((stats.students / stats.total_users) * 100).toFixed(1)}% dari total` : '0%'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Instruktur */}
                        <div className="col-xl-2 col-md-4 col-sm-6">
                            <div className="kpi-compact-card kpi-teal">
                                <div className="kpi-icon-wrap">
                                    <FaUserTie />
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Instruktur</span>
                                    <div className="kpi-number">{stats.teachers}</div>
                                    <span className="kpi-meta info">
                                        {stats.total_users > 0 ? `${((stats.teachers / stats.total_users) * 100).toFixed(1)}% dari total` : '0%'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Admin */}
                        <div className="col-xl-2 col-md-4 col-sm-6">
                            <div className="kpi-compact-card kpi-indigo">
                                <div className="kpi-icon-wrap">
                                    <FaUserCog />
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Administrator</span>
                                    <div className="kpi-number">{stats.admins}</div>
                                    <span className="kpi-meta neutral">
                                        {stats.total_users > 0 ? `${((stats.admins / stats.total_users) * 100).toFixed(1)}% dari total` : '0%'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 6. Tidak Aktif */}
                        <div className="col-xl-2 col-md-4 col-sm-6">
                            <div className="kpi-compact-card kpi-rose">
                                <div className="kpi-icon-wrap">
                                    <FaUserTimes />
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Tidak Aktif</span>
                                    <div className="kpi-number">{backendStats.inactive_users}</div>
                                    <span className="kpi-meta neutral">
                                        {stats.total_users > 0 ? `${((backendStats.inactive_users / stats.total_users) * 100).toFixed(1)}% nonaktif` : '0 akun'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Unified User Management Table Card */}
                    <div className="users-main-card mb-4">
                        {/* Compact Toolbar */}
                        <div className="users-toolbar-compact">
                            <div className="toolbar-left-group">
                                <div className="search-box-compact">
                                    <FaSearch className="search-icon-compact" />
                                    <input
                                        type="text"
                                        className="search-input-compact"
                                        placeholder="Cari nama, email, username..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <button
                                            className="search-clear-btn-compact"
                                            onClick={() => setSearchTerm("")}
                                            title="Hapus pencarian"
                                        >
                                            <FaTimes />
                                        </button>
                                    )}
                                </div>

                                <div className="filter-count-badge">
                                    <span className="badge-count-num">{filteredUsers.length}</span>
                                    <span className="badge-count-text">
                                        {filteredUsers.length === users.length ? "Pengguna" : `dari ${users.length} pengguna`}
                                    </span>
                                </div>
                            </div>

                            <div className="toolbar-right-group">
                                <div className="filter-select-wrap">
                                    <select 
                                        className="filter-select-compact" 
                                        value={userTypeFilter} 
                                        onChange={(e) => setUserTypeFilter(e.target.value)}
                                        title="Filter Tipe Peserta"
                                    >
                                        <option value="all">Semua Tipe Peserta</option>
                                        <option value="INTERNAL">🏛️ Internal DPD RI</option>
                                        <option value="ASN">🏢 ASN</option>
                                        <option value="UMUM">👥 Umum</option>
                                    </select>
                                </div>

                                <div className="filter-select-wrap">
                                    <select 
                                        className="filter-select-compact" 
                                        value={roleFilter} 
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                    >
                                        <option value="all">Semua Peran</option>
                                        <option value="student">🎓 Peserta</option>
                                        <option value="teacher">👨‍🏫 Instruktur</option>
                                        <option value="admin">⚙️ Admin</option>
                                    </select>
                                </div>

                                <div className="filter-select-wrap">
                                    <select 
                                        className="filter-select-compact" 
                                        value={statusFilter} 
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="all">Semua Status</option>
                                        <option value="active">● Aktif</option>
                                        <option value="inactive">○ Tidak Aktif</option>
                                    </select>
                                </div>

                                <div className="filter-select-wrap">
                                    <select 
                                        className="filter-select-compact per-page-select" 
                                        value={itemsPerPage} 
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        title="Jumlah per halaman"
                                    >
                                        <option value={10}>10 / hal</option>
                                        <option value={25}>25 / hal</option>
                                        <option value={50}>50 / hal</option>
                                        <option value={100}>100 / hal</option>
                                    </select>
                                </div>

                                {(searchTerm || roleFilter !== "all" || userTypeFilter !== "all" || statusFilter !== "all") && (
                                    <button 
                                        className="btn-filter-reset" 
                                        onClick={() => {
                                            setSearchTerm("");
                                            setRoleFilter("all");
                                            setUserTypeFilter("all");
                                            setStatusFilter("all");
                                        }}
                                        title="Reset semua filter"
                                    >
                                        <FaTimes /> Reset
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bulk Actions Banner */}
                        {showBulkActions && (
                            <div className="bulk-actions-compact">
                                <div className="bulk-count-wrap">
                                    <FaUsers />
                                    <span><strong>{selectedUsers.length}</strong> pengguna dipilih</span>
                                </div>
                                <div className="bulk-buttons-wrap">
                                    <button 
                                        className="bulk-btn-compact activate"
                                        onClick={() => handleBulkAction("activate")}
                                    >
                                        <FaUserCheck /> Aktifkan
                                    </button>
                                    <button 
                                        className="bulk-btn-compact deactivate"
                                        onClick={() => handleBulkAction("deactivate")}
                                    >
                                        <FaUserTimes /> Nonaktifkan
                                    </button>
                                    <button 
                                        className="bulk-btn-compact delete"
                                        onClick={() => handleBulkAction("delete")}
                                    >
                                        <FaTrash /> Hapus
                                    </button>
                                    <button 
                                        className="bulk-btn-compact cancel"
                                        onClick={() => setSelectedUsers([])}
                                    >
                                        <FaTimes /> Batal
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Table */}
                        <div className="users-table-scroll-container">
                            <table className="users-table-compact">
                                <thead>
                                    <tr>
                                        <th className="col-select">
                                            <div className="compact-checkbox">
                                                {selectedUsers.length > 0 && selectedUsers.length === paginatedUsers.length ? (
                                                    <MdCheckBox 
                                                        className="checkbox-active" 
                                                        onClick={handleSelectAll}
                                                        title="Batalkan pilihan semua"
                                                    />
                                                ) : (
                                                    <MdCheckBoxOutlineBlank 
                                                        className="checkbox-blank" 
                                                        onClick={handleSelectAll}
                                                        title="Pilih semua di halaman ini"
                                                    />
                                                )}
                                            </div>
                                        </th>
                                        <th className="col-no">#</th>
                                        <th className="col-user">Informasi Pengguna</th>
                                        <th className="col-roles">Peran</th>
                                        <th className="col-status">Status</th>
                                        <th className="col-login">Aktivitas Terakhir</th>
                                        <th className="col-date">Pendaftaran</th>
                                        <th className="col-activity">Aktivitas Sistem</th>
                                        <th className="col-actions text-end">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map((user, index) => (
                                        <tr 
                                            key={user.id} 
                                            className={`user-row-compact ${selectedUsers.includes(user.id) ? "row-selected" : ""}`}
                                        >
                                            <td className="col-select">
                                                <div className="compact-checkbox">
                                                    {selectedUsers.includes(user.id) ? (
                                                        <MdCheckBox 
                                                            className="checkbox-active" 
                                                            onClick={() => handleSelectUser(user.id)}
                                                        />
                                                    ) : (
                                                        <MdCheckBoxOutlineBlank 
                                                            className="checkbox-blank" 
                                                            onClick={() => handleSelectUser(user.id)}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-no">
                                                <span className="row-num-badge">
                                                    {((currentPage - 1) * itemsPerPage) + index + 1}
                                                </span>
                                            </td>
                                            <td className="col-user">
                                                <div className="user-profile-compact">
                                                    {(() => {
                                                        const avatarUrl = resolveUserAvatar(user);
                                                        return (
                                                            <div className="avatar-compact user-avatar-compact">
                                                                {avatarUrl ? (
                                                                    <img 
                                                                        src={avatarUrl} 
                                                                        alt={user.full_name || user.username || "Avatar"} 
                                                                        className="user-avatar-img"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            if (e.currentTarget.nextElementSibling) {
                                                                                e.currentTarget.nextElementSibling.style.display = 'inline-flex';
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <span 
                                                                    className="user-avatar-initials"
                                                                    style={{ display: avatarUrl ? 'none' : 'inline-flex' }}
                                                                >
                                                                    {(user.full_name || user.username || "U").charAt(0).toUpperCase()}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="user-texts">
                                                        <div className="user-name-line" title={user.full_name}>
                                                            {user.full_name || "-"}
                                                        </div>
                                                        <div className="user-sub-line">
                                                            <span className="user-email-text" title={user.email}>{user.email}</span>
                                                            <span className="user-uname-text">@{user.username}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="col-roles">
                                                <div className="roles-pills-wrap">
                                                    {user.is_student && (
                                                        <span className="role-pill-compact student" title="Peserta Pembelajaran">
                                                            <FaUserGraduate className="role-pill-icon" /> Peserta
                                                        </span>
                                                    )}
                                                    {user.is_instructor && (
                                                        <span className="role-pill-compact teacher" title="Instruktur Kursus">
                                                            <FaUserTie className="role-pill-icon" /> Instruktur
                                                        </span>
                                                    )}
                                                    {user.is_admin && (
                                                        <span className="role-pill-compact admin" title="Administrator Sistem">
                                                            <FaUserCog className="role-pill-icon" /> Admin
                                                        </span>
                                                    )}
                                                    {!(user.is_student || user.is_instructor || user.is_admin) && (
                                                        <span className="role-pill-compact none">
                                                            Tanpa Peran
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-status">
                                                <span className={`status-pill-compact ${user.is_active ? "active" : "inactive"}`}>
                                                    <span className="status-dot"></span>
                                                    {user.is_active ? "Aktif" : "Nonaktif"}
                                                </span>
                                            </td>
                                            <td className="col-login">
                                                <div className="login-date-text">
                                                    {user.last_login ? (
                                                        dayjs(user.last_login).format("DD MMM YYYY, HH:mm")
                                                    ) : (
                                                        <span className="text-muted-custom">Belum pernah</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-date">
                                                <div className="joined-date-text">
                                                    {user.date_joined ? (
                                                        dayjs(user.date_joined).format("DD MMM YYYY")
                                                    ) : (
                                                        <span className="text-muted-custom">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-activity">
                                                <div className="metrics-compact-wrap">
                                                    {user.is_student && (
                                                        <span className="metric-chip-compact enrollments" title="Pendaftaran Kursus">
                                                            <FaChartLine /> {user.enrollment_count || 0} Daftar
                                                        </span>
                                                    )}
                                                    {user.is_instructor && (
                                                        <span className="metric-chip-compact courses" title="Kursus Diajar">
                                                            <FaChartLine /> {user.course_count || 0} Kursus
                                                        </span>
                                                    )}
                                                    {user.is_admin && !user.is_student && !user.is_instructor && (
                                                        <span className="metric-chip-compact admin">
                                                            <FaCog /> Administrator
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-actions text-end">
                                                <div className="action-buttons-compact">
                                                    <button 
                                                        className="action-btn-compact view" 
                                                        onClick={() => openViewModal(user)}
                                                        title="Lihat Detail Pengguna"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button 
                                                        className="action-btn-compact edit" 
                                                        onClick={() => openEditModal(user)}
                                                        title="Edit Pengguna"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button 
                                                        className="action-btn-compact delete" 
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        title="Hapus Pengguna"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredUsers.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="empty-state-compact">
                                                <div className="empty-state-wrap">
                                                    <FaUsers className="empty-state-icon" />
                                                    <h6>Tidak Ada Pengguna Ditemukan</h6>
                                                    <p>Tidak ada akun yang sesuai dengan pencarian atau filter yang diterapkan.</p>
                                                    <button 
                                                        className="btn-empty-reset"
                                                        onClick={() => {
                                                            setSearchTerm("");
                                                            setRoleFilter("all");
                                                            setStatusFilter("all");
                                                        }}
                                                    >
                                                        Reset Filter
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Compact Pagination Footer */}
                        <div className="users-pagination-bar">
                            <div className="pagination-info-text">
                                Menampilkan <strong>{filteredUsers.length > 0 ? startIndex + 1 : 0}</strong> - <strong>{Math.min(endIndex, filteredUsers.length)}</strong> dari <strong>{filteredUsers.length}</strong> pengguna
                                {filteredUsers.length !== users.length && (
                                    <span className="text-muted-custom ms-1">(terfilter dari total {users.length})</span>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div className="pagination-compact-nav">
                                    <button 
                                        className="btn-page-compact"
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                        title="Halaman Pertama"
                                    >
                                        &laquo;
                                    </button>
                                    <button 
                                        className="btn-page-compact"
                                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        title="Halaman Sebelumnya"
                                    >
                                        &lsaquo;
                                    </button>

                                    <div className="pagination-page-pills">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }
                                            return pageNum;
                                        }).map(page => (
                                            <button
                                                key={page}
                                                className={`page-pill ${currentPage === page ? "active" : ""}`}
                                                onClick={() => handlePageChange(page)}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        className="btn-page-compact"
                                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                        title="Halaman Berikutnya"
                                    >
                                        &rsaquo;
                                    </button>
                                    <button 
                                        className="btn-page-compact"
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages}
                                        title="Halaman Terakhir"
                                    >
                                        &raquo;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modern User Modal */}
                    {showModal && (
                        <div className="modal-overlay-modern user-admin-modal-overlay">
                            <div className="modal-content-modern user-admin-modal-content">
                                <div className="modal-header-modern user-admin-modal-header">
                                    <div className="modal-title-section user-admin-modal-title-section">
                                        <div className="modal-icon user-admin-modal-icon">
                                            {modalType === "create" && <MdPersonAdd />}
                                            {modalType === "edit" && <FaEdit />}
                                            {modalType === "view" && <FaEye />}
                                        </div>
                                        <div className="modal-title-text user-admin-modal-title-text">
                                            <h2>
                                                {modalType === "create" && "Buat Akun Pengguna Baru"}
                                                {modalType === "edit" && "Edit Pengguna"}
                                                {modalType === "view" && "Detail Profil Pengguna"}
                                            </h2>
                                            <p>
                                                {modalType === "create" && "Tambah pengguna baru ke sistem manajemen pembelajaran"}
                                                {modalType === "edit" && "Perbarui informasi dan izin pengguna"}
                                                {modalType === "view" && "Gambaran lengkap profil dan aktivitas pengguna"}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        className="modal-close-modern user-admin-modal-close"
                                        onClick={() => setShowModal(false)}
                                    >
                                        ×
                                    </button>
                                </div>
                                
                                <div className="modal-body-modern user-admin-modal-body">
                                    {modalType === "view" ? (
                                        <div className="user-details-view-compact">
                                            {/* User Identity Hero Card */}
                                            <div className="view-hero-card">
                                                {(() => {
                                                    const heroAvatarUrl = resolveUserAvatar(selectedUser?.user_info || selectedUser);
                                                    return (
                                                        <div className="view-hero-avatar">
                                                            {heroAvatarUrl ? (
                                                                <img 
                                                                    src={heroAvatarUrl} 
                                                                    alt={selectedUser?.user_info?.full_name || "Avatar"} 
                                                                    className="view-hero-avatar-img"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        if (e.currentTarget.nextElementSibling) {
                                                                            e.currentTarget.nextElementSibling.style.display = 'inline-flex';
                                                                        }
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <span 
                                                                className="view-hero-avatar-initials"
                                                                style={{ display: heroAvatarUrl ? 'none' : 'inline-flex' }}
                                                            >
                                                                {selectedUser?.user_info?.full_name ? selectedUser.user_info.full_name.charAt(0).toUpperCase() : "U"}
                                                            </span>
                                                            <span className={`hero-status-dot ${selectedUser?.user_info?.is_active ? "active" : "inactive"}`} title={selectedUser?.user_info?.is_active ? "Akun Aktif" : "Akun Nonaktif"}></span>
                                                        </div>
                                                    );
                                                })()}
                                                <div className="view-hero-info">
                                                    <div className="view-hero-name-row">
                                                        <h3 className="view-hero-name">{selectedUser?.user_info?.full_name || "Nama Tidak Disediakan"}</h3>
                                                        <span className={`status-badge-compact ${selectedUser?.user_info?.is_active ? "active" : "inactive"}`}>
                                                            {selectedUser?.user_info?.is_active ? "✓ Aktif" : "✕ Nonaktif"}
                                                        </span>
                                                        {(selectedUser?.user_info?.user_type === 'INTERNAL' || selectedUser?.user_info?.is_internal) ? (
                                                            <span className="user-type-badge internal">
                                                                <FaLandmark className="ut-icon" /> Internal Setjen DPD RI
                                                            </span>
                                                        ) : selectedUser?.user_info?.user_type === 'ASN' ? (
                                                            <span className="user-type-badge asn">
                                                                <FaIdBadge className="ut-icon" /> ASN Luar
                                                            </span>
                                                        ) : (
                                                            <span className="user-type-badge umum">
                                                                <FaGlobe className="ut-icon" /> Masyarakat Umum
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="view-hero-meta-row">
                                                        <span className="meta-pill"><FaEnvelope className="me-1" /> {selectedUser?.user_info?.email || "-"}</span>
                                                        <span className="meta-pill"><FaUser className="me-1" /> @{selectedUser?.user_info?.username || "-"}</span>
                                                        {selectedUser?.user_info?.phone && (
                                                            <span className="meta-pill"><FaPhone className="me-1" /> {selectedUser?.user_info?.phone}</span>
                                                        )}
                                                        <span className="meta-pill"><FaCalendarAlt className="me-1" /> Bergabung {selectedUser?.user_info?.date_joined ? dayjs(selectedUser.user_info.date_joined).format("DD MMM YYYY") : "-"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 2-Column Main Info Sections */}
                                            <div className="view-sections-grid">
                                                {/* Section 1: Data Kepesertaan & Wilayah */}
                                                <div className="view-compact-card">
                                                    <div className="view-card-header">
                                                        <FaIdBadge className="card-header-icon" />
                                                        <span>Data Kepesertaan & Instansi</span>
                                                    </div>
                                                    <div className="view-compact-table">
                                                        <div className="view-table-row">
                                                            <span className="v-label">Kategori Peserta</span>
                                                            <span className="v-value font-medium">
                                                                {selectedUser?.user_info?.user_type === 'INTERNAL' || selectedUser?.user_info?.is_internal ? "Internal Setjen DPD RI" : selectedUser?.user_info?.user_type === 'ASN' ? "Aparatur Sipil Negara (ASN)" : "Masyarakat Umum"}
                                                            </span>
                                                        </div>
                                                        {(selectedUser?.user_info?.nip || selectedUser?.user_info?.user_type === 'INTERNAL' || selectedUser?.user_info?.user_type === 'ASN') && (
                                                            <div className="view-table-row">
                                                                <span className="v-label">NIP</span>
                                                                <span className="v-value font-mono">
                                                                    {selectedUser?.user_info?.nip || <em className="text-muted">Belum disinkronkan</em>}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {(selectedUser?.user_info?.jenis_jabatan || selectedUser?.user_info?.user_type !== 'UMUM') && (
                                                            <div className="view-table-row">
                                                                <span className="v-label">Jabatan Saat Ini</span>
                                                                <span className="v-value">
                                                                    {selectedUser?.user_info?.jenis_jabatan || <em className="text-muted">Tidak ada data</em>}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {(selectedUser?.user_info?.instansi_asal || selectedUser?.user_info?.is_internal) && (
                                                            <div className="view-table-row">
                                                                <span className="v-label">Asal Instansi</span>
                                                                <span className="v-value">
                                                                    {selectedUser?.user_info?.is_internal ? "Sekretariat Jenderal DPD RI" : (selectedUser?.user_info?.instansi_asal || <em className="text-muted">Tidak ada data</em>)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {selectedUser?.user_info?.golongan && (
                                                            <div className="view-table-row">
                                                                <span className="v-label">Golongan / Ruang</span>
                                                                <span className="v-value">{selectedUser?.user_info?.golongan}</span>
                                                            </div>
                                                        )}
                                                        {selectedUser?.user_info?.pekerjaan && (
                                                            <div className="view-table-row">
                                                                <span className="v-label">Profesi / Pekerjaan</span>
                                                                <span className="v-value">{selectedUser?.user_info?.pekerjaan}</span>
                                                            </div>
                                                        )}
                                                        <div className="view-table-row">
                                                            <span className="v-label">Domisili / Wilayah</span>
                                                            <span className="v-value">
                                                                {[selectedUser?.user_info?.kota_kabupaten, selectedUser?.user_info?.provinsi, selectedUser?.user_info?.negara].filter(Boolean).join(', ') || <em className="text-muted">Indonesia</em>}
                                                            </span>
                                                        </div>
                                                        <div className="view-table-row">
                                                            <span className="v-label">Status Onboarding</span>
                                                            <span className="v-value">
                                                                {selectedUser?.user_info?.onboarding_completed ? (
                                                                    <span className="text-success"><FaCheckCircle className="me-1" /> Lengkap Terverifikasi</span>
                                                                ) : (
                                                                    <span className="text-warning"><FaTimes className="me-1" /> Belum Lengkap</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Section 2: Hak Akses & Aktivitas Akun */}
                                                <div className="view-compact-card">
                                                    <div className="view-card-header">
                                                        <FaShieldAlt className="card-header-icon" />
                                                        <span>Hak Akses & Riwayat Sistem</span>
                                                    </div>
                                                    <div className="view-compact-table">
                                                        <div className="view-table-row">
                                                            <span className="v-label">Peran Terdaftar</span>
                                                            <div className="v-value role-chips-wrap">
                                                                {selectedUser?.user_info?.is_student && <span className="role-chip student">🎓 Peserta</span>}
                                                                {selectedUser?.user_info?.is_instructor && <span className="role-chip teacher">👨‍🏫 Instruktur</span>}
                                                                {selectedUser?.user_info?.is_admin && <span className="role-chip admin">⚙️ Admin</span>}
                                                            </div>
                                                        </div>
                                                        <div className="view-table-row">
                                                            <span className="v-label">Peran Aktif</span>
                                                            <span className="v-value text-capitalize font-semibold text-primary">
                                                                {selectedUser?.user_info?.role || "student"}
                                                            </span>
                                                        </div>
                                                        <div className="view-table-row">
                                                            <span className="v-label">Metode Otentikasi</span>
                                                            <span className="v-value">
                                                                {selectedUser?.user_info?.is_internal ? "SSO Nusa DPD RI (Internal)" : "Google OAuth / Email Mandiri"}
                                                            </span>
                                                        </div>
                                                        <div className="view-table-row">
                                                            <span className="v-label">Login Terakhir</span>
                                                            <span className="v-value font-medium">
                                                                {selectedUser?.user_info?.last_login ? dayjs(selectedUser.user_info.last_login).format("DD MMM YYYY, HH:mm [WIB]") : <em className="text-muted">Belum pernah login</em>}
                                                            </span>
                                                        </div>
                                                        <div className="view-table-row">
                                                            <span className="v-label">ID Pengguna (PK)</span>
                                                            <span className="v-value font-mono">#{selectedUser?.user_info?.id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Real Live Statistics Section */}
                                            {(selectedUser?.user_info?.is_student || selectedUser?.user_info?.is_instructor) && (
                                                <div className="view-stats-container">
                                                    <div className="view-stats-title">
                                                        <FaChartLine className="me-2 text-primary" /> Statistik Pembelajaran & Instruktur Nyata
                                                    </div>
                                                    <div className="view-stats-grid">
                                                        {selectedUser?.user_info?.is_student && (
                                                            <>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number">{selectedUser?.enrollment_stats?.total_enrollments || 0}</span>
                                                                    <span className="stat-text">Pendaftaran Kursus</span>
                                                                </div>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number text-success">{selectedUser?.enrollment_stats?.completed_courses || 0}</span>
                                                                    <span className="stat-text">Kursus Selesai</span>
                                                                </div>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number text-info">{selectedUser?.enrollment_stats?.in_progress_courses || 0}</span>
                                                                    <span className="stat-text">Sedang Berjalan</span>
                                                                </div>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number text-warning">{selectedUser?.enrollment_stats?.certificates_earned || 0}</span>
                                                                    <span className="stat-text">Sertifikat Diperoleh</span>
                                                                </div>
                                                            </>
                                                        )}
                                                        {selectedUser?.user_info?.is_instructor && selectedUser?.teaching_stats && (
                                                            <>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number">{selectedUser?.teaching_stats?.total_courses || 0}</span>
                                                                    <span className="stat-text">Total Kursus Dibuat</span>
                                                                </div>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number text-success">{selectedUser?.teaching_stats?.published_courses || 0}</span>
                                                                    <span className="stat-text">Kursus Dipublikasikan</span>
                                                                </div>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number text-primary">{selectedUser?.teaching_stats?.total_students || 0}</span>
                                                                    <span className="stat-text">Total Peserta Terdaftar</span>
                                                                </div>
                                                                <div className="stat-tile">
                                                                    <span className="stat-number text-warning">{selectedUser?.teaching_stats?.total_reviews || 0}</span>
                                                                    <span className="stat-text">Ulasan Diterima</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Modal Actions */}
                                            <div className="modal-view-footer">
                                                <button type="button" className="btn-cancel-modern" onClick={() => setShowModal(false)}>
                                                    Tutup
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn-submit-modern"
                                                    onClick={() => {
                                                        if (selectedUser?.user_info) {
                                                            openEditModal(selectedUser.user_info);
                                                        }
                                                    }}
                                                >
                                                    <FaEdit className="me-1" /> Edit Pengguna Ini
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="form-modern-compact">
                                            {/* Section 1: Informasi Dasar Akun */}
                                            <div className="form-section-header-compact">
                                                <FaUser className="section-icon" />
                                                <span>1. Informasi Dasar Akun</span>
                                            </div>
                                            <div className="form-grid-2col">
                                                <div className="form-group-compact">
                                                    <label className="form-label-compact" htmlFor="f_name">
                                                        Nama Lengkap <span className="req">*</span>
                                                    </label>
                                                    <input
                                                        id="f_name"
                                                        type="text"
                                                        className="form-input-compact"
                                                        placeholder="Masukkan nama lengkap pengguna"
                                                        value={formData.full_name}
                                                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                                        required
                                                    />
                                                </div>

                                                <div className="form-group-compact">
                                                    <label className="form-label-compact" htmlFor="f_email">
                                                        Alamat Email <span className="req">*</span>
                                                    </label>
                                                    <input
                                                        id="f_email"
                                                        type="email"
                                                        className="form-input-compact"
                                                        placeholder="contoh: nama@dpd.go.id"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                        required
                                                    />
                                                </div>

                                                <div className="form-group-compact">
                                                    <label className="form-label-compact" htmlFor="f_phone">
                                                        No. Telepon / WhatsApp
                                                    </label>
                                                    <input
                                                        id="f_phone"
                                                        type="tel"
                                                        className="form-input-compact"
                                                        placeholder="Contoh: 081234567890"
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                                    />
                                                </div>

                                                <div className="form-group-compact">
                                                    <label className="form-label-compact" htmlFor="f_active">
                                                        Status Akun <span className="req">*</span>
                                                    </label>
                                                    <select
                                                        id="f_active"
                                                        className="form-select-compact"
                                                        value={formData.is_active ? "true" : "false"}
                                                        onChange={(e) => setFormData({...formData, is_active: e.target.value === "true"})}
                                                    >
                                                        <option value="true">✓ Aktif (Dapat Login & Akses Pembelajaran)</option>
                                                        <option value="false">✕ Tidak Aktif (Ditangguhkan)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Section 2: Kategori Peserta & Data Kepegawaian / Profesi */}
                                            <div className="form-section-header-compact">
                                                <FaIdBadge className="section-icon" />
                                                <span>2. Kategori Peserta & Data Wilayah</span>
                                            </div>
                                            <div className="form-grid-2col">
                                                <div className="form-group-compact full-width">
                                                    <label className="form-label-compact" htmlFor="f_user_type">
                                                        Kategori Peserta <span className="req">*</span>
                                                    </label>
                                                    <select
                                                        id="f_user_type"
                                                        className="form-select-compact"
                                                        value={formData.user_type}
                                                        onChange={(e) => setFormData({...formData, user_type: e.target.value})}
                                                    >
                                                        <option value="INTERNAL">Internal Setjen DPD RI (Pegawai / Sinkronisasi SSO Nusa)</option>
                                                        <option value="ASN">ASN Luar / Instansi Pemerintah Lain (Kementerian/Lembaga/Pemda)</option>
                                                        <option value="UMUM">Masyarakat Umum (Publik / Profesional / Akademisi / Mahasiswa)</option>
                                                    </select>
                                                </div>

                                                {/* Conditional Fields based on user_type */}
                                                {(formData.user_type === "INTERNAL" || formData.user_type === "ASN") ? (
                                                    <>
                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_nip">
                                                                Nomor Induk Pegawai (NIP) {formData.user_type === "ASN" && <span className="req">*</span>}
                                                            </label>
                                                            <input
                                                                id="f_nip"
                                                                type="text"
                                                                className="form-input-compact font-mono"
                                                                placeholder="Contoh: 198501012010011001"
                                                                value={formData.nip}
                                                                onChange={(e) => setFormData({...formData, nip: e.target.value.replace(/\D/g, "").slice(0, 18)})}
                                                                maxLength={18}
                                                                required={formData.user_type === "ASN"}
                                                            />
                                                            <span className="field-hint-compact">{formData.nip.length}/18 Digit Resmi BKN</span>
                                                        </div>

                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_jabatan">
                                                                Jabatan Saat Ini
                                                            </label>
                                                            <select
                                                                id="f_jabatan"
                                                                className="form-select-compact"
                                                                value={formData.jenis_jabatan}
                                                                onChange={(e) => setFormData({...formData, jenis_jabatan: e.target.value})}
                                                            >
                                                                <option value="">-- Pilih Jabatan / Jenjang ASN --</option>
                                                                {ASN_POSITIONS.map((pos) => (
                                                                    <option key={pos} value={pos}>{pos}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="form-group-compact full-width">
                                                            <label className="form-label-compact" htmlFor="f_instansi">
                                                                Asal Instansi Pemerintah <span className="req">*</span>
                                                            </label>
                                                            {formData.user_type === "INTERNAL" ? (
                                                                <input
                                                                    id="f_instansi"
                                                                    type="text"
                                                                    className="form-input-compact bg-light"
                                                                    value="Sekretariat Jenderal DPD RI"
                                                                    readOnly
                                                                />
                                                            ) : (
                                                                <select
                                                                    id="f_instansi"
                                                                    className="form-select-compact"
                                                                    value={formData.instansi_asal}
                                                                    onChange={(e) => setFormData({...formData, instansi_asal: e.target.value})}
                                                                    required
                                                                >
                                                                    <option value="">-- Pilih Instansi / Kementerian / Lembaga / Pemda --</option>
                                                                    {ASN_INSTITUTIONS_GROUPS.map((group) => (
                                                                        <optgroup key={group.category} label={`── ${group.category} ──`}>
                                                                            {group.items.map((item) => (
                                                                                <option key={item} value={item}>{item}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_pekerjaan">
                                                                Pekerjaan / Profesi <span className="req">*</span>
                                                            </label>
                                                            <select
                                                                id="f_pekerjaan"
                                                                className="form-select-compact"
                                                                value={formData.pekerjaan}
                                                                onChange={(e) => setFormData({...formData, pekerjaan: e.target.value})}
                                                                required
                                                            >
                                                                <option value="">-- Pilih Bidang Pekerjaan --</option>
                                                                {PROFESSIONS_LIST.map((prof) => (
                                                                    <option key={prof} value={prof}>{prof}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_negara">
                                                                Negara Domisili <span className="req">*</span>
                                                            </label>
                                                            <select
                                                                id="f_negara"
                                                                className="form-select-compact"
                                                                value={formData.negara}
                                                                onChange={(e) => setFormData({...formData, negara: e.target.value})}
                                                            >
                                                                {COUNTRIES_LIST.map((country) => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_provinsi">
                                                                Provinsi Asal
                                                            </label>
                                                            <select
                                                                id="f_provinsi"
                                                                className="form-select-compact"
                                                                value={formData.provinsi}
                                                                onChange={(e) => setFormData({...formData, provinsi: e.target.value, kota_kabupaten: ""})}
                                                            >
                                                                <option value="">-- Pilih 38 Provinsi --</option>
                                                                {Object.keys(INDONESIA_PROVINCES_AND_CITIES).map((prov) => (
                                                                    <option key={prov} value={prov}>{prov}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_kota">
                                                                Kota / Kabupaten
                                                            </label>
                                                            <select
                                                                id="f_kota"
                                                                className="form-select-compact"
                                                                value={formData.kota_kabupaten}
                                                                onChange={(e) => setFormData({...formData, kota_kabupaten: e.target.value})}
                                                                disabled={!formData.provinsi}
                                                            >
                                                                <option value="">{formData.provinsi ? "-- Pilih Kota / Kabupaten --" : "-- Pilih Provinsi Dulu --"}</option>
                                                                {availableModalCities.map((city) => (
                                                                    <option key={city} value={city}>{city}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Section 3: Hak Akses & Peran Pengguna */}
                                            <div className="form-section-header-compact">
                                                <FaShieldAlt className="section-icon" />
                                                <span>3. Hak Akses Peran Pengguna <span className="req">*</span></span>
                                            </div>
                                            <div className="roles-pill-selector">
                                                <label className={`role-pill-card ${formData.is_student ? "selected" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_student}
                                                        onChange={(e) => setFormData({...formData, is_student: e.target.checked})}
                                                    />
                                                    <div className="pill-card-body">
                                                        <span className="pill-title">🎓 Peserta</span>
                                                        <span className="pill-subtitle">Akses pembelajaran kursus</span>
                                                    </div>
                                                    {formData.is_student && <FaCheckCircle className="pill-check" />}
                                                </label>

                                                <label className={`role-pill-card ${formData.is_instructor ? "selected" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_instructor}
                                                        onChange={(e) => setFormData({...formData, is_instructor: e.target.checked})}
                                                    />
                                                    <div className="pill-card-body">
                                                        <span className="pill-title">👨‍🏫 Instruktur</span>
                                                        <span className="pill-subtitle">Kelola & terbitkan materi</span>
                                                    </div>
                                                    {formData.is_instructor && <FaCheckCircle className="pill-check" />}
                                                </label>

                                                <label className={`role-pill-card ${formData.is_admin ? "selected" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.is_admin}
                                                        onChange={(e) => setFormData({...formData, is_admin: e.target.checked})}
                                                    />
                                                    <div className="pill-card-body">
                                                        <span className="pill-title">⚙️ Administrator</span>
                                                        <span className="pill-subtitle">Kontrol manajemen sistem</span>
                                                    </div>
                                                    {formData.is_admin && <FaCheckCircle className="pill-check" />}
                                                </label>
                                            </div>
                                            {!(formData.is_student || formData.is_instructor || formData.is_admin) && (
                                                <p className="form-helper-text error mt-1">⚠️ Pengguna harus memiliki setidaknya satu peran aktif.</p>
                                            )}

                                            {/* Section 4: Keamanan / Kata Sandi */}
                                            {modalType === "create" ? (
                                                <>
                                                    <div className="form-section-header-compact">
                                                        <FaKey className="section-icon" />
                                                        <span>4. Kata Sandi Baru <span className="req">*</span></span>
                                                    </div>
                                                    <div className="form-grid-2col">
                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_pass">
                                                                Kata Sandi <span className="req">*</span>
                                                            </label>
                                                            <div className="password-input-wrapper-compact">
                                                                <input
                                                                    type={showPasswords.password ? "text" : "password"}
                                                                    id="f_pass"
                                                                    className="form-input-compact"
                                                                    placeholder="Kata sandi aman"
                                                                    value={formData.password}
                                                                    onChange={(e) => {
                                                                        setFormData({...formData, password: e.target.value});
                                                                        validatePassword(e.target.value);
                                                                    }}
                                                                    required
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="pass-eye-toggle-compact"
                                                                    onClick={() => togglePasswordVisibility("password")}
                                                                    aria-label="Toggle password visibility"
                                                                >
                                                                    <i className={showPasswords.password ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="form-group-compact">
                                                            <label className="form-label-compact" htmlFor="f_pass2">
                                                                Konfirmasi Kata Sandi <span className="req">*</span>
                                                            </label>
                                                            <div className="password-input-wrapper-compact">
                                                                <input
                                                                    type={showPasswords.password2 ? "text" : "password"}
                                                                    id="f_pass2"
                                                                    className="form-input-compact"
                                                                    placeholder="Ketik ulang kata sandi"
                                                                    value={formData.password2}
                                                                    onChange={(e) => setFormData({...formData, password2: e.target.value})}
                                                                    required
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="pass-eye-toggle-compact"
                                                                    onClick={() => togglePasswordVisibility("password2")}
                                                                    aria-label="Toggle confirm password visibility"
                                                                >
                                                                    <i className={showPasswords.password2 ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                                                                </button>
                                                            </div>
                                                            {formData.password2 && formData.password !== formData.password2 && (
                                                                <span className="password-match-badge error">✕ Tidak cocok</span>
                                                            )}
                                                            {formData.password2 && formData.password === formData.password2 && (
                                                                <span className="password-match-badge success">✓ Cocok</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Compact Password Checklist */}
                                                    <div className="password-checklist-inline">
                                                        <span className={`chk-item ${passwordValidation.length ? "ok" : ""}`}>
                                                            {passwordValidation.length ? "✓" : "○"} Min. 8 Karakter
                                                        </span>
                                                        <span className={`chk-item ${passwordValidation.uppercase ? "ok" : ""}`}>
                                                            {passwordValidation.uppercase ? "✓" : "○"} Huruf Besar (A-Z)
                                                        </span>
                                                        <span className={`chk-item ${passwordValidation.lowercase ? "ok" : ""}`}>
                                                            {passwordValidation.lowercase ? "✓" : "○"} Huruf Kecil (a-z)
                                                        </span>
                                                        <span className={`chk-item ${passwordValidation.number ? "ok" : ""}`}>
                                                            {passwordValidation.number ? "✓" : "○"} Angka (0-9)
                                                        </span>
                                                        <span className={`chk-item ${passwordValidation.special ? "ok" : ""}`}>
                                                            {passwordValidation.special ? "✓" : "○"} Karakter Khusus (!@#)
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                /* Edit Mode: Optional Password Change */
                                                <div className="edit-password-toggle-section">
                                                    <button
                                                        type="button"
                                                        className="btn-toggle-password-edit"
                                                        onClick={() => setShowEditPassword(!showEditPassword)}
                                                    >
                                                        <FaKey className="me-1" />
                                                        {showEditPassword ? "Batalkan Penggantian Kata Sandi" : "Atur Ulang Kata Sandi Pengguna (Opsional)"}
                                                    </button>

                                                    {showEditPassword && (
                                                        <div className="form-grid-2col mt-2">
                                                            <div className="form-group-compact">
                                                                <label className="form-label-compact" htmlFor="f_edit_pass">
                                                                    Kata Sandi Baru
                                                                </label>
                                                                <input
                                                                    type="password"
                                                                    id="f_edit_pass"
                                                                    className="form-input-compact"
                                                                    placeholder="Kosongkan jika tidak ingin diubah"
                                                                    value={formData.password}
                                                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                                                />
                                                            </div>
                                                            <div className="form-group-compact">
                                                                <label className="form-label-compact" htmlFor="f_edit_pass2">
                                                                    Konfirmasi Kata Sandi Baru
                                                                </label>
                                                                <input
                                                                    type="password"
                                                                    id="f_edit_pass2"
                                                                    className="form-input-compact"
                                                                    placeholder="Ulangi kata sandi baru"
                                                                    value={formData.password2}
                                                                    onChange={(e) => setFormData({...formData, password2: e.target.value})}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Form Actions */}
                                            <div className="form-actions-compact">
                                                <button type="button" className="btn-cancel-modern" onClick={() => setShowModal(false)}>
                                                    Batal
                                                </button>
                                                <button type="submit" className="btn-submit-modern">
                                                    <div className="btn-content">
                                                        {modalType === "create" ? <MdPersonAdd /> : <FaEdit />}
                                                        <span>{modalType === "create" ? "Buat Akun Pengguna" : "Simpan Perubahan"}</span>
                                                    </div>
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Sync Progress Modal */}
            {syncProgress.show && (
                <div 
                    className="sync-modal"
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !syncing) {
                            closeSyncProgress();
                        }
                    }}
                >
                    <div className="sync-progress-modal">
                        {/* Modal Header */}
                        <div className={`sync-progress-header ${syncProgress.status}`}>
                            <div className="sync-header-left">
                                <div className={`sync-header-icon ${syncing ? "spinning" : ""}`}>
                                    {syncProgress.status === "initializing" && <FaSpinner />}
                                    {syncProgress.status === "syncing" && <MdSync />}
                                    {syncProgress.status === "completed" && <FaCheck />}
                                    {syncProgress.status === "error" && <FaTimes />}
                                    {syncProgress.status === "cancelled" && <FaTimes />}
                                </div>
                                <div className="sync-header-text">
                                    <div className="sync-header-title-row">
                                        <h3>
                                            {syncProgress.status === "initializing" && "Inisialisasi Sinkronisasi"}
                                            {syncProgress.status === "syncing" && "Sinkronisasi Berjalan"}
                                            {syncProgress.status === "completed" && "Sinkronisasi Selesai"}
                                            {syncProgress.status === "error" && "Sinkronisasi Gagal"}
                                            {syncProgress.status === "cancelled" && "Sinkronisasi Dibatalkan"}
                                        </h3>
                                        <span className={`sync-status-badge ${syncProgress.status}`}>
                                            {syncProgress.status === "initializing" && "Koneksi"}
                                            {syncProgress.status === "syncing" && "Proses"}
                                            {syncProgress.status === "completed" && "Sukses"}
                                            {syncProgress.status === "error" && "Error"}
                                            {syncProgress.status === "cancelled" && "Batal"}
                                        </span>
                                    </div>
                                    <p>{syncProgress.message}</p>
                                </div>
                            </div>
                            {!syncing && (
                                <button 
                                    type="button"
                                    className="sync-header-close-btn" 
                                    onClick={closeSyncProgress}
                                    title="Tutup"
                                    aria-label="Tutup modal sinkronisasi"
                                >
                                    <FaTimes />
                                </button>
                            )}
                        </div>

                        {/* Modal Body */}
                        <div className="sync-progress-body">
                            {/* Initializing State Banner - Prevents awkward empty white space */}
                            {syncProgress.status === "initializing" && (
                                <div className="sync-initializing-box">
                                    <div className="sync-initializing-pulse">
                                        <FaSpinner className="fa-spin" />
                                    </div>
                                    <div className="sync-initializing-info">
                                        <span className="sync-initializing-title">Menghubungkan ke API Eksternal...</span>
                                        <span className="sync-initializing-sub">Mengunduh data dan memverifikasi perubahan akun pengguna</span>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar (during syncing) */}
                            {syncing && (
                                <div className="sync-progress-bar-container">
                                    <div className="sync-progress-label">
                                        <div className="sync-progress-label-left">
                                            <span>Progress Eksekusi</span>
                                            {syncProgress.totalPages > 0 && syncProgress.currentPage > 0 && (
                                                <span className="sync-page-pill">
                                                    Hal {syncProgress.currentPage}/{syncProgress.totalPages}
                                                </span>
                                            )}
                                        </div>
                                        <span className="sync-progress-percentage">
                                            {syncProgress.total > 0 
                                                ? Math.min(100, Math.round(((syncProgress.created + syncProgress.updated + syncProgress.failed) / syncProgress.total) * 100))
                                                : 0}%
                                        </span>
                                    </div>
                                    <div className="sync-progress-bar-track">
                                        <div 
                                            className="sync-progress-bar-fill"
                                            style={{
                                                width: syncProgress.total > 0 
                                                    ? `${Math.min(100, Math.round(((syncProgress.created + syncProgress.updated + syncProgress.failed) / syncProgress.total) * 100))}%`
                                                    : "0%"
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Compact Feedback Banner for Completed / Error / Cancelled */}
                            {syncProgress.status === "completed" && (
                                <div className="sync-banner success">
                                    <div className="sync-banner-icon">
                                        <FaCheck />
                                    </div>
                                    <div className="sync-banner-content">
                                        <div className="sync-banner-title">Data Berhasil Disinkronkan</div>
                                        <div className="sync-banner-desc">
                                            {syncProgress.created > 0 && `${syncProgress.created} akun baru dibuat. `}
                                            {syncProgress.updated > 0 && `${syncProgress.updated} akun diperbarui. `}
                                            {syncProgress.created === 0 && syncProgress.updated === 0 && "Semua data akun telah mutakhir dengan sistem eksternal."}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {syncProgress.status === "error" && (
                                <div className="sync-banner error">
                                    <div className="sync-banner-icon">
                                        <FaTimes />
                                    </div>
                                    <div className="sync-banner-content">
                                        <div className="sync-banner-title">Sinkronisasi Mengalami Kendala</div>
                                        <div className="sync-banner-desc">
                                            {syncProgress.message || "Terjadi kesalahan saat menyinkronkan data pengguna."}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {syncProgress.status === "cancelled" && (
                                <div className="sync-banner cancelled">
                                    <div className="sync-banner-icon">
                                        <FaTimes />
                                    </div>
                                    <div className="sync-banner-content">
                                        <div className="sync-banner-title">Sinkronisasi Dibatalkan</div>
                                        <div className="sync-banner-desc">
                                            Operasi sinkronisasi data telah dihentikan atas permintaan pengguna.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Metric Grid - High-density 4-tile Dashboard */}
                            {(syncProgress.status === "syncing" || syncProgress.status === "completed" || syncProgress.total > 0) && (
                                <>
                                    <div className="sync-metrics-grid">
                                        <div className="sync-metric-card created">
                                            <div className="sync-metric-header">
                                                <span className="sync-metric-label">Dibuat</span>
                                                <span className="sync-metric-badge">Baru</span>
                                            </div>
                                            <div className="sync-metric-val">{syncProgress.created}</div>
                                        </div>

                                        <div className="sync-metric-card updated">
                                            <div className="sync-metric-header">
                                                <span className="sync-metric-label">Diperbarui</span>
                                                <span className="sync-metric-badge">Update</span>
                                            </div>
                                            <div className="sync-metric-val">{syncProgress.updated}</div>
                                        </div>

                                        <div className="sync-metric-card failed">
                                            <div className="sync-metric-header">
                                                <span className="sync-metric-label">Gagal</span>
                                                <span className="sync-metric-badge">Error</span>
                                            </div>
                                            <div className="sync-metric-val">{syncProgress.failed}</div>
                                        </div>

                                        <div className="sync-metric-card total">
                                            <div className="sync-metric-header">
                                                <span className="sync-metric-label">Sumber</span>
                                                <span className="sync-metric-badge">Total</span>
                                            </div>
                                            <div className="sync-metric-val">{syncProgress.total}</div>
                                        </div>
                                    </div>

                                    {/* Secondary Details Chip Row */}
                                    <div className="sync-summary-strip">
                                        <div className="sync-summary-chip">
                                            <span className="chip-label">LMS Saat Ini:</span>
                                            <span className="chip-value">{stats.total_users}</span>
                                        </div>
                                        <div className="sync-summary-chip">
                                            <span className="chip-label">Diproses:</span>
                                            <span className="chip-value">{syncProgress.created + syncProgress.updated + syncProgress.failed}</span>
                                        </div>
                                        {syncProgress.comparisonComplete && syncProgress.unchanged > 0 && (
                                            <div className="sync-summary-chip">
                                                <span className="chip-label">Tidak Berubah:</span>
                                                <span className="chip-value">{syncProgress.unchanged}</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Error List */}
                            {syncProgress.errors && syncProgress.errors.length > 0 && (
                                <div className="sync-errors">
                                    <div className="sync-errors-header">
                                        <FaTimes />
                                        <span>Daftar Kendala ({syncProgress.errors.length})</span>
                                    </div>
                                    <div className="sync-errors-list">
                                        {syncProgress.errors.slice(0, 4).map((error, index) => (
                                            <div key={index} className="sync-error-item">
                                                <span className="sync-error-bullet">•</span>
                                                <span className="sync-error-text">
                                                    {typeof error === "string" ? (
                                                        error
                                                    ) : (
                                                        <>
                                                            {error.external_id && <strong>ID: {error.external_id} | </strong>}
                                                            {error.name && <span>{error.name} | </span>}
                                                            {error.error ? error.error : (error.errors ? JSON.stringify(error.errors) : "Kesalahan tidak diketahui")}
                                                        </>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                        {syncProgress.errors.length > 4 && (
                                            <div className="sync-error-item more">
                                                <span>...dan {syncProgress.errors.length - 4} kesalahan lainnya</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="sync-actions">
                                {syncing && (
                                    <button 
                                        type="button"
                                        className="sync-action-btn cancel"
                                        onClick={cancelSync}
                                    >
                                        <FaTimes />
                                        <span>Batal</span>
                                    </button>
                                )}
                                
                                {!syncing && syncProgress.status === "completed" && (
                                    <button 
                                        type="button"
                                        className="sync-action-btn done"
                                        onClick={closeSyncProgress}
                                    >
                                        <FaCheck />
                                        <span>Selesai</span>
                                    </button>
                                )}
                                
                                {!syncing && (syncProgress.status === "error" || syncProgress.status === "cancelled") && (
                                    <>
                                        <button 
                                            type="button"
                                            className="sync-action-btn retry"
                                            onClick={() => {
                                                closeSyncProgress();
                                                setTimeout(syncData, 300);
                                            }}
                                        >
                                            <MdSync />
                                            <span>Coba Lagi</span>
                                        </button>
                                        <button 
                                            type="button"
                                            className="sync-action-btn close"
                                            onClick={closeSyncProgress}
                                        >
                                            <FaTimes />
                                            <span>Tutup</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer /> 
        </div>
    );
}

export default React.memo(UsersAdmin);