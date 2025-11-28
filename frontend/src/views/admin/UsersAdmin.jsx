import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    FaPlus, FaSearch, FaEdit, FaTrash, FaEye, FaUserGraduate, FaUserTie, 
    FaUsers, FaChartLine, FaUserCheck, FaUserTimes, FaFilter,
    FaCog, FaUserCog, FaChevronDown, FaBell, FaSpinner, FaArrowRight, FaTimes, FaCheck
} from 'react-icons/fa';
import { 
    MdFilterList, MdCheckBox, MdCheckBoxOutlineBlank,
    MdPersonAdd, MdPeople, MdTrendingUp, MdDashboard, MdSync
} from 'react-icons/md';
import AdminHeader from '../partials/AdminHeader';
import Footer from '../partials/Footer';
import useAxios from '../../utils/useAxios';
import Toast, { DeleteConfirmation } from "../plugin/Toast";
import dayjs from '../../utils/dayjs';
import './UsersAdmin.css';
import '../../styles/PasswordInput.css';

function UsersAdmin() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({
        show: false,
        status: 'initializing', // initializing, syncing, completed, error, cancelled
        message: 'Preparing to sync...',
        created: 0,
        updated: 0,
        failed: 0,
        total: 0,
        errors: []
    });
    // Initialize from localStorage for persistence across sessions
    const [lastSuccessfulSyncTime, setLastSuccessfulSyncTime] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('lastSuccessfulSyncTime');
        }
        return null;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25; // Display 25 users per page
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('create'); // create, edit, view
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);
    // Memoized statistics calculation
    const stats = useMemo(() => ({
        total_users: users.length,
        active_users: users.filter(user => user.is_active).length,
        students: users.filter(user => user.role === 'student').length,
        teachers: users.filter(user => user.role === 'teacher').length,
        admins: users.filter(user => user.role === 'admin').length
    }), [users]);
    
    // AbortController for cancelling sync
    const abortControllerRef = useRef(null);
    
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
        full_name: '',
        email: '',
        role: 'student',
        password: '',
        password2: ''
    });
    
    const [passwordValidation, setPasswordValidation] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
        notCommon: true
    });

    const api = useAxios;

    // Fetch users and statistics - OPTIMIZED
    const fetchUsers = useCallback(async () => {
        try {
            // Fetch with query parameter optimization
            const response = await api.get('/admin/user-management/?_t=' + Date.now());
            const usersData = response.data;
            
            // Handle both array and paginated response
            const users = Array.isArray(usersData) ? usersData : usersData.results || [];
            
            setUsers(users);
            setFilteredUsers(users);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            Toast().fire({
                icon: "error",
                title: 'Failed to fetch users'
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

        // Role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(user => 
                statusFilter === 'active' ? user.is_active : !user.is_active
            );
        }

        return filtered;
    }, [searchTerm, roleFilter, statusFilter, users]);

    // Apply filters and reset pagination
    useEffect(() => {
        setFilteredUsers(filteredUsersData);
        setCurrentPage(1); // Reset to first page when filters change
    }, [filteredUsersData]);

    // Keep applyFilters for backward compatibility (no-op now)
    const applyFilters = useCallback(() => {
        // Filtering is now handled by filteredUsersData useMemo
    }, []);

    // Calculate pagination
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    // Validate password strength
    const validatePassword = useCallback((password) => {
        const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123', 'admin', 'letmein'];
        
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
        
        try {
            if (modalType === 'create') {
                await api.post('/admin/user-create/', formData);
                Toast().fire({
                    icon: "success",
                    title: 'User created successfully'
                });
            } else if (modalType === 'edit') {
                await api.put(`/admin/user-update/${selectedUser.id}/`, formData);
                Toast().fire({
                    icon: "success",
                    title: 'User updated successfully'
                });
            }
            
            setShowModal(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || 'Failed to save user'
            });
        }
    }, [modalType, selectedUser, formData, api, fetchUsers]);

    // Handle delete user
    const handleDeleteUser = useCallback(async (userId) => {
        const confirm = await DeleteConfirmation({
            title: "Delete User",
            text: "Are you sure you want to delete this user? This action cannot be undone."
        });
        if (!confirm.isConfirmed) return;

        try {
            await api.delete(`/admin/user-delete/${userId}/`);
            Toast().fire({
                icon: "success",
                title: 'User deleted successfully'
            });
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || 'Failed to delete user'
            });
        }
    }, [api, fetchUsers]);

    // Handle bulk actions
    const handleBulkAction = useCallback(async (action) => {
        if (selectedUsers.length === 0) {
            Toast().fire({
                icon: "warning",
                title: 'Please select users first'
            });
            return;
        }

        const confirm = await DeleteConfirmation({
            title: "Delete Users",
            text: "Are you sure you want to delete these users? This action cannot be undone."
        });
        if (!confirm.isConfirmed) return;

        try {
            await api.post('/admin/user-bulk-actions/', {
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
        } catch (error) {
            console.error('Error performing bulk action:', error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || 'Failed to perform bulk action'
            });
        }
    }, [selectedUsers, api, fetchUsers]);

    // Sync external users data - ENHANCED WITH SMART POLLING
    const syncData = async () => {
        
        // Create new AbortController for this sync operation
        abortControllerRef.current = new AbortController();
        
        setSyncing(true);
        let progressPollInterval = null;
        let pollTimeout = null;
        let autoCloseTimeout = null;
        
        const initialProgress = {
            show: true,
            status: 'initializing',
            message: 'Connecting to external API...',
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
                status: 'syncing',
                message: 'Syncing user data from external source...'
            }));
            
            // Start the actual sync on backend
            const syncPromise = api.post('/admin/sync-external-users/', {}, {
                signal: abortControllerRef.current.signal
            });
            
            // Poll the backend for real progress updates
            // This gets actual live progress from the backend with completion detection
            progressPollInterval = setInterval(async () => {
                if (shouldStopPolling) return;
                
                try {
                    const progressResponse = await api.get('/admin/sync-progress/');
                    
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
                            lastSuccessfulSyncTimestamp: progressResponse.data.last_successful_sync_timestamp || null
                        }));
                        
                        // SMART POLLING: Check if backend says sync is done
                        // Stop polling when backend explicitly signals completion
                        if (progressResponse.data.completion_timestamp && !progressResponse.data.is_syncing) {
                            console.log('Backend completed sync, stopping polling');
                            shouldStopPolling = true;
                        }
                    }
                } catch (pollError) {
                    // Silently fail on poll errors - polling is best-effort
                    console.debug('Progress poll error (non-critical):', pollError);
                }
            }, 500); // Poll every 500ms for real-time updates
            
            // TIMEOUT FALLBACK: If polling doesn't stop in 5 minutes, force completion
            pollTimeout = setTimeout(() => {
                console.log('Polling timeout reached, forcing completion detection');
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
                status: 'completed',
                message: 'Sync completed successfully! ✓',
                created: results.created || 0,
                updated: results.updated || 0,
                failed: results.failed || 0,
                total: results.total_users || 0,
                errors: results.errors || []
            }));
            
            // Fetch the last sync info from database (source of truth)
            try {
                const syncInfoResponse = await api.get('/admin/last-sync-info/');
                if (syncInfoResponse.data && syncInfoResponse.data.last_sync_time) {
                    setLastSuccessfulSyncTime(syncInfoResponse.data.last_sync_time);
                    localStorage.setItem('lastSuccessfulSyncTime', syncInfoResponse.data.last_sync_time);
                    console.log('Updated last sync time from database:', syncInfoResponse.data.last_sync_time);
                }
            } catch (error) {
                console.debug('Failed to fetch updated sync info from database:', error);
                // Fallback: use current time if database fetch fails
                const now = new Date().toISOString();
                setLastSuccessfulSyncTime(now);
                localStorage.setItem('lastSuccessfulSyncTime', now);
            }
            
            Toast().fire({
                icon: "success",
                title: `Sync completed! Created: ${results.created}, Updated: ${results.updated}`,
            });
            
            if (results.errors && results.errors.length > 0) {
                console.warn('Sync errors:', results.errors);
            }
            
            // AUTO-CLOSE: Show completion screen for 2.5 seconds then auto-close
            // This gives user time to see the success message
            autoCloseTimeout = setTimeout(() => {
                console.log('Auto-closing sync progress modal');
                closeSyncProgress();
            }, 2500); // 2.5 seconds
            
            // Refresh users list after sync (no need to wait for auto-close)
            await fetchUsers();
            
        } catch (error) {
            // Stop polling on error
            shouldStopPolling = true;
            if (progressPollInterval) clearInterval(progressPollInterval);
            if (pollTimeout) clearTimeout(pollTimeout);
            
            // Check if it was cancelled
            if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                setSyncProgress(prev => ({
                    ...prev,
                    status: 'cancelled',
                    message: 'Sync operation was cancelled by user'
                }));
                
                Toast().fire({
                    icon: "info",
                    title: 'Sync operation cancelled'
                });
                
                // Auto-close cancelled after 1.5 seconds
                autoCloseTimeout = setTimeout(() => {
                    closeSyncProgress();
                }, 1500);
            } else {
                console.error('Error syncing external users:', error);
                
                setSyncProgress(prev => ({
                    ...prev,
                    status: 'error',
                    message: error.response?.data?.error || 'Failed to sync external users data',
                    errors: [error.response?.data?.error || error.message]
                }));
                
                Toast().fire({
                    icon: "error",
                    title: error.response?.data?.error || 'Failed to sync external users data'
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
        setModalType('create');
        resetForm();
    }, []);

    const openEditModal = useCallback((user) => {
        setShowModal(true);
        setModalType('edit');
        setSelectedUser(user);
        setFormData({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            password: '',
            password2: ''
        });
    }, []);

    const openViewModal = useCallback(async (user) => {
        try {
            const response = await api.get(`/admin/user-detail/${user.id}/`);
            setSelectedUser(response.data);
            setShowModal(true);
            setModalType('view');
        } catch (error) {
            console.error('Error fetching user details:', error);
            Toast().fire({
                icon: "error",
                title: 'Failed to load user details'
            });
        }
    }, [api]);

    const resetForm = useCallback(() => {
        setFormData({
            full_name: '',
            email: '',
            role: 'student',
            password: '',
            password2: ''
        });
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
    }, []); // Only run on mount

    // Fetch last sync info from database on component mount
    useEffect(() => {
        const fetchLastSyncInfo = async () => {
            try {
                const response = await api.get('/admin/last-sync-info/');
                if (response.data && response.data.last_sync_time) {
                    // Update state from database (source of truth)
                    setLastSuccessfulSyncTime(response.data.last_sync_time);
                    // Also update localStorage for consistency
                    localStorage.setItem('lastSuccessfulSyncTime', response.data.last_sync_time);
                    console.log('Loaded last sync time from database:', response.data.last_sync_time);
                }
            } catch (error) {
                // Silently fail - this is non-critical
                console.debug('Failed to fetch last sync info from database:', error);
                // Fall back to localStorage if available
                const localTime = localStorage.getItem('lastSuccessfulSyncTime');
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
    }, [searchTerm, roleFilter, statusFilter, applyFilters]);

    useEffect(() => {
        setShowBulkActions(selectedUsers.length > 0);
    }, [selectedUsers]);

    if (loading) {
        return (
            <div className="users-admin modern-dashboard">
                <AdminHeader />
                <div className="users-admin-container">
                    <div className="loading-state-modern">
                        <FaSpinner className="fa-spin" />
                        <p>Loading user management system...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AdminHeader />
            
            <section className="pt-5 pb-5 modern-dashboard" style={{ flex: 1 }}>
                <div className='container'>
                    {/* Modern Header Section */}
                    <div className="dashboard-header-modern">
                        <div className="header-content">
                            <div className="header-text">
                                <h1 className="dashboard-title">
                                    <MdPeople className="title-icon" />
                                    User Management
                                </h1>
                                <p className="dashboard-subtitle">
                                    Comprehensive user control and monitoring dashboard
                                </p>
                            </div>
                            <div className="dashboard-actions">
                                <div className="sync-button-group">
                                    <button 
                                        className="btn-modern-primary btn-sync" 
                                        onClick={() => {
                                            syncData();
                                        }}
                                        disabled={syncing}
                                    >
                                        {syncing ? (
                                            <>
                                                <FaSpinner className="spinner fa-spin" />
                                                Syncing...
                                            </>
                                        ) : (
                                            <>
                                                <MdSync />
                                                Sync Data
                                            </>
                                        )}
                                    </button>
                                    {lastSuccessfulSyncTime ? (
                                        <div className="last-sync-info">
                                            <small className="last-sync-label">Last Sync:</small>
                                            <div className="last-sync-time">
                                                {new Date(lastSuccessfulSyncTime).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="last-sync-info">
                                            <small className="last-sync-label">Last Sync:</small>
                                            <div className="last-sync-time">
                                                Never
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button className="btn-modern-primary" onClick={openCreateModal}>
                                    <MdPersonAdd />
                                    Add New User
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Statistics Cards */}
                    <div className="row">
                        <div className="col-lg-3 col-md-6 mb-4">
                            <div className="stat-card-enhanced total-users">
                                <FaUsers className="stat-icon-enhanced" />
                                <div className="stat-content">
                                    <div className="stat-number-enhanced">{stats.total_users}</div>
                                    <div className="stat-label-enhanced">Total Users</div>
                                    <div className="stat-change positive">
                                        <MdTrendingUp /> +12.5%
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-3 col-md-6 mb-4">
                            <div className="stat-card-enhanced active-users">
                                <FaUserCheck className="stat-icon-enhanced" />
                                <div className="stat-content">
                                    <div className="stat-number-enhanced">{stats.active_users}</div>
                                    <div className="stat-label-enhanced">Active Users</div>
                                    <div className="stat-change positive">
                                        <MdTrendingUp /> +8.2%
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-2 col-md-4 mb-4">
                            <div className="mini-stat-card-modern students">
                                <FaUserGraduate className="mini-stat-icon" />
                                <div className="mini-stat-content">
                                    <div className="mini-stat-number">{stats.students}</div>
                                    <div className="mini-stat-label">Students</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-2 col-md-4 mb-4">
                            <div className="mini-stat-card-modern teachers">
                                <FaUserTie className="mini-stat-icon" />
                                <div className="mini-stat-content">
                                    <div className="mini-stat-number">{stats.teachers}</div>
                                    <div className="mini-stat-label">Teachers</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-2 col-md-4 mb-4">
                            <div className="mini-stat-card-modern admins">
                                <FaUserCog className="mini-stat-icon" />
                                <div className="mini-stat-content">
                                    <div className="mini-stat-number">{stats.admins}</div>
                                    <div className="mini-stat-label">Admins</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modern Filters and Search */}
                    <div className="control-panel-modern">
                        <div className="panel-header-modern">
                            <h3 className="panel-title-modern">
                                <MdDashboard />
                                User Management Controls
                            </h3>
                        </div>
                        <div className="panel-content-modern">
                            <div className="filters-row-modern">
                                <div className="search-group-modern">
                                    <FaSearch className="search-icon-modern" />
                                    <input
                                        type="text"
                                        className="search-input-modern"
                                        placeholder="Search users by name, email, or username..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                
                                <div className="filter-group-modern">
                                    <select 
                                        className="filter-select-modern"
                                        value={roleFilter} 
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                    >
                                        <option value="all">All Roles</option>
                                        <option value="student">Students Only</option>
                                        <option value="teacher">Teachers Only</option>
                                        <option value="admin">Admins Only</option>
                                    </select>
                                </div>
                                
                                <div className="filter-group-modern">
                                    <select 
                                        className="filter-select-modern"
                                        value={statusFilter} 
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="active">Active Users</option>
                                        <option value="inactive">Inactive Users</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modern Bulk Actions */}
                    {showBulkActions && (
                        <div className="bulk-actions-modern">
                            <div className="bulk-info-modern">
                                <FaUsers className="bulk-icon" />
                                <span className="bulk-text">{selectedUsers.length} users selected</span>
                            </div>
                            <div className="bulk-actions-buttons">
                                <button 
                                    className="bulk-btn"
                                    onClick={() => handleBulkAction('activate')}
                                >
                                    <FaUserCheck /> Activate
                                </button>
                                <button 
                                    className="bulk-btn"
                                    onClick={() => handleBulkAction('deactivate')}
                                >
                                    <FaUserTimes /> Deactivate
                                </button>
                                <button 
                                    className="bulk-btn"
                                    onClick={() => handleBulkAction('delete')}
                                >
                                    <FaTrash /> Delete
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Modern Users Table */}
                    <div className="users-table-container table-responsive-wrapper">
                        <div className="table-scroll-indicator">
                            <FaArrowRight /> Scroll for more
                        </div>
                        <table className="users-table-modern" role="table" aria-label="Users management table">
                            <thead>
                                <tr>
                                    <th className="select-column" scope="col">
                                        <div className="checkbox-modern">
                                            {selectedUsers.length === filteredUsers.length ? 
                                                <MdCheckBox 
                                                    className="checkbox-icon selected" 
                                                    onClick={handleSelectAll}
                                                    title="Deselect all users"
                                                    role="checkbox"
                                                    aria-checked="true"
                                                /> : 
                                                <MdCheckBoxOutlineBlank 
                                                    className="checkbox-icon" 
                                                    onClick={handleSelectAll}
                                                    title="Select all users"
                                                    role="checkbox"
                                                    aria-checked="false"
                                                />
                                            }
                                        </div>
                                    </th>
                                    <th className="user-column" scope="col">User Information</th>
                                    <th className="role-column" scope="col">Role & Permissions</th>
                                    <th className="status-column" scope="col">Account Status</th>
                                    <th className="login-column" scope="col">Last Activity</th>
                                    <th className="date-column" scope="col">Registration</th>
                                    <th className="activity-column" scope="col">System Activity</th>
                                    <th className="actions-column" scope="col">Management</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUsers.map((user) => (
                                    <tr key={user.id} className={`user-row-modern ${selectedUsers.includes(user.id) ? 'selected-row' : ''}`}>
                                        <td className="select-cell">
                                            <div className="checkbox-modern">
                                                {selectedUsers.includes(user.id) ? 
                                                    <MdCheckBox 
                                                        className="checkbox-icon selected" 
                                                        onClick={() => handleSelectUser(user.id)}
                                                        title={`Deselect ${user.full_name}`}
                                                        role="checkbox"
                                                        aria-checked="true"
                                                        tabIndex="0"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSelectUser(user.id)}
                                                    /> : 
                                                    <MdCheckBoxOutlineBlank 
                                                        className="checkbox-icon" 
                                                        onClick={() => handleSelectUser(user.id)}
                                                        title={`Select ${user.full_name}`}
                                                        role="checkbox"
                                                        aria-checked="false"
                                                        tabIndex="0"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSelectUser(user.id)}
                                                    />
                                                }
                                            </div>
                                        </td>
                                        <td className="user-info-cell">
                                            <div className="user-info-modern">
                                                <div className="user-avatar-modern">
                                                    {user.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="user-details-modern">
                                                    <div className="user-name-modern">{user.full_name}</div>
                                                    <div className="user-email-modern">{user.email}</div>
                                                    <div className="user-username-modern">@{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="role-cell">
                                            <div className={`role-badge-modern ${user.role}`}>
                                                <div className="role-icon">
                                                    {user.role === 'student' && <FaUserGraduate />}
                                                    {user.role === 'teacher' && <FaUserTie />}
                                                    {user.role === 'admin' && <FaUserCog />}
                                                </div>
                                                <div className="role-text">
                                                    <span className="role-name">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                                                    <span className="role-desc">
                                                        {user.role === 'student' && 'Learning Access'}
                                                        {user.role === 'teacher' && 'Content Creator'}
                                                        {user.role === 'admin' && 'Full Control'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="status-cell">
                                            <div className={`status-badge-modern ${user.is_active ? 'active' : 'inactive'}`}>
                                                <div className="status-indicator"></div>
                                                <span className="status-text">{user.is_active ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        </td>
                                        <td className="login-cell">
                                            <div className="login-info-modern">
                                                <FaBell className="date-cell" />
                                                <span className="date-info-modern">{user.last_login ? dayjs(user.last_login).format("DD MMM, YYYY") : "No Data"}</span>
                                            </div>
                                        </td>
                                        <td className="date-cell">
                                            <div className="date-info-modern">
                                                {new Date(user.date_joined).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        </td>
                                        <td className="activity-cell">
                                            <div className="activity-metrics-modern">
                                                {user.role === 'student' && (
                                                    <>
                                                        <div className="metric-item">
                                                            <FaChartLine className="metric-icon" />
                                                            <span>{user.enrollment_count} Enrollments</span>
                                                        </div>
                                                    </>
                                                )}
                                                {user.role === 'teacher' && (
                                                    <>
                                                        <div className="metric-item">
                                                            <FaChartLine className="metric-icon" />
                                                            <span>{user.course_count} Courses</span>
                                                        </div>
                                                    </>
                                                )}
                                                {user.role === 'admin' && (
                                                    <div className="metric-item admin">
                                                        <FaCog className="metric-icon" />
                                                        <span>Administrator</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="actions-cell">
                                            <div className="action-buttons-modern">
                                                <button 
                                                    className="action-btn-modern view-btn"
                                                    onClick={() => openViewModal(user)}
                                                    title="View Full Profile"
                                                >
                                                    <FaEye />
                                                </button>
                                                <button 
                                                    className="action-btn-modern edit-btn"
                                                    onClick={() => openEditModal(user)}
                                                    title="Edit User Settings"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button 
                                                    className="action-btn-modern delete-btn"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    title="Remove User"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="empty-state-cell">
                                        <div className="empty-state-modern">
                                            <FaUsers className="empty-icon" />
                                            <h5>No Users Found</h5>
                                            <p>No users match your current search and filter criteria. Try adjusting your filters or search terms.</p>
                                            <button className="btn-modern-primary" onClick={openCreateModal}>
                                                <MdPersonAdd /> Add First User
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls - Compact Professional */}
                    {filteredUsers.length > itemsPerPage && (
                        <div className="pagination-controls-compact">
                            <button 
                                className="pagination-btn-compact"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                title="First page"
                            >
                                ⟨⟨
                            </button>
                            <button 
                                className="pagination-btn-compact"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                title="Previous page"
                            >
                                ⟨
                            </button>
                            
                            <div className="pagination-display">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) {
                                        // Show all pages if 5 or fewer total
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        // Show 1-5 when near start
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        // Show last 5 when near end
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        // Show current page centered: -2, -1, current, +1, +2
                                        pageNum = currentPage - 2 + i;
                                    }
                                    return pageNum;
                                }).map(page => (
                                    <button
                                        key={page}
                                        className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            
                            <span className="pagination-counter">
                                {currentPage} / {totalPages}
                            </span>
                            
                            <button 
                                className="pagination-btn-compact"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                title="Next page"
                            >
                                ⟩
                            </button>
                            <button 
                                className="pagination-btn-compact"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                title="Last page"
                            >
                                ⟩⟩
                            </button>
                        </div>
                    )}

                    {/* Modern User Modal */}
                    {showModal && (
                        <div className="modal-overlay-modern">
                            <div className="modal-content-modern">
                                <div className="modal-header-modern">
                                    <div className="modal-title-section">
                                        <div className="modal-icon">
                                            {modalType === 'create' && <MdPersonAdd />}
                                            {modalType === 'edit' && <FaEdit />}
                                            {modalType === 'view' && <FaEye />}
                                        </div>
                                        <div className="modal-title-text">
                                            <h2>
                                                {modalType === 'create' && 'Create New User Account'}
                                                {modalType === 'edit' && 'Edit User Information'}
                                                {modalType === 'view' && 'User Profile Details'}
                                            </h2>
                                            <p>
                                                {modalType === 'create' && 'Add a new user to the learning management system'}
                                                {modalType === 'edit' && 'Update user information and permissions'}
                                                {modalType === 'view' && 'Comprehensive user profile and activity overview'}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        className="modal-close-modern"
                                        onClick={() => setShowModal(false)}
                                    >
                                        ×
                                    </button>
                                </div>
                                
                                <div className="modal-body-modern">
                                    {modalType === 'view' ? (
                                        <div className="user-details-view">
                                            {/* Basic Information Section */}
                                            <div className="detail-section">
                                                <h3>👤 Basic Information</h3>
                                                <div className="detail-grid">
                                                    <div className="detail-item">
                                                        <label>Full Name</label>
                                                        <span>{selectedUser?.user_info?.full_name}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Email Address</label>
                                                        <span>{selectedUser?.user_info?.email}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Username</label>
                                                        <span>{selectedUser?.user_info?.username}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>User Role</label>
                                                        <span className={`role-badge ${selectedUser?.user_info?.role}`}>
                                                            {selectedUser?.user_info?.role === 'student' && '🎓 Student'}
                                                            {selectedUser?.user_info?.role === 'teacher' && '👨‍🏫 Teacher'}
                                                            {selectedUser?.user_info?.role === 'admin' && '⚙️ Administrator'}
                                                        </span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Account Status</label>
                                                        <span className={`status-badge ${selectedUser?.user_info?.is_active ? 'active' : 'inactive'}`}>
                                                            {selectedUser?.user_info?.is_active ? '✓ Active' : '✕ Inactive'}
                                                        </span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Member Since</label>
                                                        <span>{selectedUser?.user_info?.date_joined ? new Date(selectedUser.user_info.date_joined).toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'}) : 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Activity Information Section */}
                                            <div className="detail-section">
                                                <h3>📊 Account Activity</h3>
                                                <div className="detail-grid">
                                                    <div className="detail-item">
                                                        <label>Last Login</label>
                                                        <span>{selectedUser?.user_info?.last_login ? new Date(selectedUser.user_info.last_login).toLocaleString('en-US', {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'Never logged in'}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Account Created</label>
                                                        <span>{selectedUser?.user_info?.date_joined ? new Date(selectedUser.user_info.date_joined).toLocaleString('en-US', {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Statistics Section - For Students */}
                                            {selectedUser?.user_info?.role === 'student' && selectedUser?.enrollment_stats && (
                                                <div className="detail-section">
                                                    <h3>📚 Learning Statistics</h3>
                                                    <div className="stats-grid-modal">
                                                        <div className="stat-item">
                                                            <label>Total Enrollments</label>
                                                            <span>{selectedUser?.enrollment_stats?.total_enrollments || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <label>Completed Courses</label>
                                                            <span>{selectedUser?.enrollment_stats?.completed_courses || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <label>In Progress Courses</label>
                                                            <span>{selectedUser?.enrollment_stats?.in_progress_courses || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <label>Certificates Earned</label>
                                                            <span>{selectedUser?.enrollment_stats?.certificates_earned || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Statistics Section - For Teachers */}
                                            {selectedUser?.user_info?.role === 'teacher' && selectedUser?.teaching_stats && (
                                                <div className="detail-section">
                                                    <h3>🎓 Teaching Statistics</h3>
                                                    <div className="stats-grid-modal">
                                                        <div className="stat-item">
                                                            <label>Total Courses Created</label>
                                                            <span>{selectedUser?.teaching_stats?.total_courses || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <label>Published Courses</label>
                                                            <span>{selectedUser?.teaching_stats?.published_courses || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <label>Total Students</label>
                                                            <span>{selectedUser?.teaching_stats?.total_students || 0}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <label>Course Reviews</label>
                                                            <span>{selectedUser?.teaching_stats?.total_reviews || 0}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="form-modern">
                                            <div className="form-row">
                                                <div className="form-group-modern">
                                                    <label htmlFor="full_name" className="form-label-modern">
                                                        <FaUsers className="label-icon" />
                                                        Full Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="full_name"
                                                        className="form-input-modern"
                                                        placeholder="Enter user's full name"
                                                        value={formData.full_name}
                                                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="form-row">
                                                <div className="form-group-modern">
                                                    <label htmlFor="email" className="form-label-modern">
                                                        <FaBell className="label-icon" />
                                                        Email Address *
                                                    </label>
                                                    <input
                                                        type="email"
                                                        id="email"
                                                        className="form-input-modern"
                                                        placeholder="Enter email address"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="form-row">
                                                <div className="form-group-modern">
                                                    <label htmlFor="role" className="form-label-modern">
                                                        <FaCog className="label-icon" />
                                                        User Role *
                                                    </label>
                                                    <select
                                                        id="role"
                                                        className="form-select-modern"
                                                        value={formData.role}
                                                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                                                        required
                                                    >
                                                        <option value="student">Student - Learning Access</option>
                                                        <option value="teacher">Teacher - Content Creator</option>
                                                        <option value="admin">Administrator - Full Control</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            {modalType === 'create' && (
                                                <>
                                                    <div className="form-row">
                                                        <div className="form-group-modern">
                                                            <label htmlFor="password" className="form-label-modern">
                                                                <FaCog className="label-icon" />
                                                                Password *
                                                            </label>
                                                            <div className="password-input-wrapper">
                                                                <input
                                                                    type={showPasswords.password ? "text" : "password"}
                                                                    id="password"
                                                                    className="form-control password-input"
                                                                    placeholder="Enter secure password"
                                                                    value={formData.password}
                                                                    onChange={(e) => {
                                                                        setFormData({...formData, password: e.target.value});
                                                                        validatePassword(e.target.value);
                                                                    }}
                                                                    required
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="password-visibility-toggle"
                                                                    onClick={() => togglePasswordVisibility('password')}
                                                                    aria-label="Toggle password visibility"
                                                                >
                                                                    <i className={showPasswords.password ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                                                                </button>
                                                            </div>
                                                            <div className="password-requirements">
                                                                <p className="requirements-title">Password must contain:</p>
                                                                <div className="requirement-list">
                                                                    <div className={`requirement-item ${passwordValidation.length ? 'valid' : ''}`}>
                                                                        {passwordValidation.length ? <FaCheck /> : <FaTimes />}
                                                                        <span>At least 8 characters</span>
                                                                    </div>
                                                                    <div className={`requirement-item ${passwordValidation.uppercase ? 'valid' : ''}`}>
                                                                        {passwordValidation.uppercase ? <FaCheck /> : <FaTimes />}
                                                                        <span>One uppercase letter (A-Z)</span>
                                                                    </div>
                                                                    <div className={`requirement-item ${passwordValidation.lowercase ? 'valid' : ''}`}>
                                                                        {passwordValidation.lowercase ? <FaCheck /> : <FaTimes />}
                                                                        <span>One lowercase letter (a-z)</span>
                                                                    </div>
                                                                    <div className={`requirement-item ${passwordValidation.number ? 'valid' : ''}`}>
                                                                        {passwordValidation.number ? <FaCheck /> : <FaTimes />}
                                                                        <span>One number (0-9)</span>
                                                                    </div>
                                                                    <div className={`requirement-item ${passwordValidation.special ? 'valid' : ''}`}>
                                                                        {passwordValidation.special ? <FaCheck /> : <FaTimes />}
                                                                        <span>One special character (!@#$%...)</span>
                                                                    </div>
                                                                    <div className={`requirement-item ${passwordValidation.notCommon ? 'valid' : ''}`}>
                                                                        {passwordValidation.notCommon ? <FaCheck /> : <FaTimes />}
                                                                        <span>Not a common password</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="form-row">
                                                        <div className="form-group-modern">
                                                            <label htmlFor="password2" className="form-label-modern">
                                                                <FaCog className="label-icon" />
                                                                Confirm Password *
                                                            </label>
                                                            <div className="password-input-wrapper">
                                                                <input
                                                                    type={showPasswords.password2 ? "text" : "password"}
                                                                    id="password2"
                                                                    className="form-control password-input"
                                                                    placeholder="Confirm password"
                                                                    value={formData.password2}
                                                                    onChange={(e) => setFormData({...formData, password2: e.target.value})}
                                                                    required
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="password-visibility-toggle"
                                                                    onClick={() => togglePasswordVisibility('password2')}
                                                                    aria-label="Toggle confirm password visibility"
                                                                >
                                                                    <i className={showPasswords.password2 ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                                                                </button>
                                                            </div>
                                                            {formData.password2 && formData.password !== formData.password2 && (
                                                                <div className="password-match-error">
                                                                    <FaTimes /> Passwords do not match
                                                                </div>
                                                            )}
                                                            {formData.password2 && formData.password === formData.password2 && (
                                                                <div className="password-match-success">
                                                                    <FaCheck /> Passwords match
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            
                                            <div className="form-actions-modern">
                                                <button type="button" className="btn-cancel-modern" onClick={() => setShowModal(false)}>
                                                    Cancel
                                                </button>
                                                <button type="submit" className="btn-submit-modern">
                                                    <div className="btn-content">
                                                        {modalType === 'create' ? <MdPersonAdd /> : <FaEdit />}
                                                        <span>{modalType === 'create' ? 'Create User Account' : 'Update User Information'}</span>
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
            </section>

            {/* Sync Progress Modal */}
            {(() => {
                return syncProgress.show;
            })() && (
                <div className="sync-modal">
                    <div className="sync-progress-modal">
                        {/* Modal Header */}
                        <div className={`sync-progress-header ${syncProgress.status}`}>
                            <div className={`sync-header-icon ${syncing ? 'spinning' : ''}`}>
                                {syncProgress.status === 'initializing' && <FaSpinner />}
                                {syncProgress.status === 'syncing' && <MdSync />}
                                {syncProgress.status === 'completed' && <FaCheck />}
                                {syncProgress.status === 'error' && <FaTimes />}
                                {syncProgress.status === 'cancelled' && <FaTimes />}
                            </div>
                            <div className="sync-header-text">
                                <h3>
                                    {syncProgress.status === 'initializing' && 'Initializing Sync...'}
                                    {syncProgress.status === 'syncing' && 'Syncing Data...'}
                                    {syncProgress.status === 'completed' && 'Sync Completed!'}
                                    {syncProgress.status === 'error' && 'Sync Failed'}
                                    {syncProgress.status === 'cancelled' && 'Sync Cancelled'}
                                </h3>
                                <p>{syncProgress.message}</p>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="sync-progress-body">
                            {/* Show stats during syncing and after completion */}
                            {(syncProgress.status === 'syncing' || syncProgress.status === 'completed') && (
                                <>
                                    {/* Comparison Results - Show after comparison complete */}
                                    {syncProgress.comparisonComplete && (
                                        <div className="sync-comparison-results">
                                            <div className="comparison-title">Data Comparison Results</div>
                                            <div className="comparison-breakdown">
                                                <div className="comparison-item new">
                                                    <div className="comparison-label">New Users</div>
                                                    <div className="comparison-value">{syncProgress.new}</div>
                                                    <div className="comparison-desc">Not in system</div>
                                                </div>
                                                <div className="comparison-item changed">
                                                    <div className="comparison-label">Updated Users</div>
                                                    <div className="comparison-value">{syncProgress.changed}</div>
                                                    <div className="comparison-desc">Data changed</div>
                                                </div>
                                                <div className="comparison-item unchanged">
                                                    <div className="comparison-label">Unchanged</div>
                                                    <div className="comparison-value">{syncProgress.unchanged}</div>
                                                    <div className="comparison-desc">Skipped</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Statistics Grid - Processing Results */}
                                    <div className="sync-stats">
                                        <div className="sync-stat-item created">
                                            <div className="sync-stat-label">Created</div>
                                            <div className="sync-stat-value">{syncProgress.created}</div>
                                        </div>
                                        <div className="sync-stat-item updated">
                                            <div className="sync-stat-label">Updated</div>
                                            <div className="sync-stat-value">{syncProgress.updated}</div>
                                        </div>
                                        <div className="sync-stat-item failed">
                                            <div className="sync-stat-label">Failed</div>
                                            <div className="sync-stat-value">{syncProgress.failed}</div>
                                        </div>
                                        <div className="sync-stat-item total">
                                            <div className="sync-stat-label">Total</div>
                                            <div className="sync-stat-value">{syncProgress.total}</div>
                                        </div>
                                    </div>

                                    {/* Progress Bar (only show during syncing) */}
                                    {syncing && (
                                        <div className="sync-progress-bar-container">
                                            <div className="sync-progress-label">
                                                <span>Syncing in progress...</span>
                                                <span className="sync-progress-percentage">
                                                    {syncProgress.total > 0 
                                                        ? Math.round(((syncProgress.created + syncProgress.updated) / syncProgress.total) * 100)
                                                        : 0}%
                                                </span>
                                            </div>
                                            <div className="sync-progress-bar-track">
                                                <div 
                                                    className="sync-progress-bar-fill"
                                                    style={{
                                                        width: syncProgress.total > 0 
                                                            ? `${Math.round(((syncProgress.created + syncProgress.updated) / syncProgress.total) * 100)}%`
                                                            : '0%'
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Success Status Message */}
                            {syncProgress.status === 'completed' && (
                                <div className="sync-status-message">
                                    <div className="sync-status-icon success">
                                        <FaCheck />
                                    </div>
                                    <h4>Successfully Synced!</h4>
                                    <p>
                                        All user data has been synchronized from the external source.
                                        {syncProgress.created > 0 && ` ${syncProgress.created} new user(s) created.`}
                                        {syncProgress.updated > 0 && ` ${syncProgress.updated} user(s) updated.`}
                                    </p>
                                </div>
                            )}

                            {/* Error Status Message */}
                            {syncProgress.status === 'error' && (
                                <div className="sync-status-message">
                                    <div className="sync-status-icon error">
                                        <FaTimes />
                                    </div>
                                    <h4>Sync Failed</h4>
                                    <p>An error occurred while syncing user data. Please try again.</p>
                                </div>
                            )}

                            {/* Cancelled Status Message */}
                            {syncProgress.status === 'cancelled' && (
                                <div className="sync-status-message">
                                    <div className="sync-status-icon cancelled">
                                        <FaTimes />
                                    </div>
                                    <h4>Sync Cancelled</h4>
                                    <p>The sync operation was cancelled before completion.</p>
                                </div>
                            )}

                            {/* Error List */}
                            {syncProgress.errors && syncProgress.errors.length > 0 && (
                                <div className="sync-errors">
                                    <h4>
                                        <FaTimes />
                                        Errors Encountered ({syncProgress.errors.length})
                                    </h4>
                                    {syncProgress.errors.slice(0, 5).map((error, index) => (
                                        <div key={index} className="sync-error-item">
                                            <FaTimes />
                                            <span>
                                                {typeof error === 'string' ? (
                                                    error
                                                ) : (
                                                    <>
                                                        {error.external_id && (
                                                            <>ID: {error.external_id} | </>
                                                        )}
                                                        {error.name && (
                                                            <>Name: {error.name} | </>
                                                        )}
                                                        {error.email && (
                                                            <>Email: {error.email} | </>
                                                        )}
                                                        {error.error ? error.error : (error.errors ? JSON.stringify(error.errors) : 'Unknown error')}
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                    {syncProgress.errors.length > 5 && (
                                        <div className="sync-error-item">
                                            <FaTimes />
                                            <span>...and {syncProgress.errors.length - 5} more errors</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="sync-actions">
                                {syncing && (
                                    <button 
                                        className="sync-action-btn cancel"
                                        onClick={cancelSync}
                                    >
                                        <FaTimes />
                                        Cancel Sync
                                    </button>
                                )}
                                
                                {!syncing && syncProgress.status === 'completed' && (
                                    <button 
                                        className="sync-action-btn done"
                                        onClick={closeSyncProgress}
                                    >
                                        <FaCheck />
                                        Done
                                    </button>
                                )}
                                
                                {!syncing && (syncProgress.status === 'error' || syncProgress.status === 'cancelled') && (
                                    <>
                                        <button 
                                            className="sync-action-btn retry"
                                            onClick={() => {
                                                closeSyncProgress();
                                                setTimeout(syncData, 300);
                                            }}
                                        >
                                            <MdSync />
                                            Retry
                                        </button>
                                        <button 
                                            className="sync-action-btn done"
                                            onClick={closeSyncProgress}
                                        >
                                            Close
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