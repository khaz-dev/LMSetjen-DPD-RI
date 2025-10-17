import React, { useState, useEffect } from 'react';
import { 
    FaPlus, FaSearch, FaEdit, FaTrash, FaEye, FaUserGraduate, FaUserTie, 
    FaUsers, FaChartLine, FaUserCheck, FaUserTimes, FaDownload, FaFilter,
    FaCog, FaUserCog, FaChevronDown, FaBell, FaSpinner, FaArrowRight
} from 'react-icons/fa';
import { 
    MdFilterList, MdDownload, MdCheckBox, MdCheckBoxOutlineBlank,
    MdPersonAdd, MdPeople, MdTrendingUp, MdDashboard, MdSync
} from 'react-icons/md';
import AdminHeader from '../partials/AdminHeader';
import Footer from '../partials/Footer';
import useAxios from '../../utils/useAxios';
import Toast, { DeleteConfirmation } from "../plugin/Toast";
import dayjs from '../../utils/dayjs';
import './UsersAdmin.css';

function UsersAdmin() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('create'); // create, edit, view
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);
    const [stats, setStats] = useState({
        total_users: 0,
        active_users: 0,
        students: 0,
        teachers: 0,
        admins: 0
    });
    
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        role: 'student',
        password: '',
        password2: ''
    });

    const api = useAxios;

    // Fetch users and statistics
    const fetchUsers = async () => {
        try {
            const response = await api.get('/admin/user-management/');
            const usersData = response.data;
            setUsers(usersData);
            setFilteredUsers(usersData);
            
            // Calculate statistics
            const totalUsers = usersData.length;
            const activeUsers = usersData.filter(user => user.is_active).length;
            const students = usersData.filter(user => user.role === 'student').length;
            const teachers = usersData.filter(user => user.role === 'teacher').length;
            const admins = usersData.filter(user => user.role === 'admin').length;
            
            setStats({
                total_users: totalUsers,
                active_users: activeUsers,
                students: students,
                teachers: teachers,
                admins: admins
            });
            
            setLoading(false);
        } catch (error) {
            console.error('Error fetching users:', error);
            Toast().fire({
                icon: "error",
                title: 'Failed to fetch users'
            });
            setLoading(false);
        }
    };

    // Filter users based on search and filters
    const applyFilters = () => {
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

        setFilteredUsers(filtered);
    };

    // Handle form submission for create/edit user
    const handleSubmit = async (e) => {
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
    };

    // Handle delete user
    const handleDeleteUser = async (userId) => {
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
    };

    // Handle bulk actions
    const handleBulkAction = async (action) => {
        if (selectedUsers.length === 0) {
            Toast().fire({
                icon: "warning",
                title: 'Please select users first'
            });
            return;
        }

        const confirmMessage = {
            'activate': 'Are you sure you want to activate selected users?',
            'deactivate': 'Are you sure you want to deactivate selected users?',
            'delete': 'Are you sure you want to delete selected users? This action cannot be undone.'
        };

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
    };

    // Sync external users data
    const syncData = async () => {
        setSyncing(true);
        try {
            const response = await api.post('/admin/sync-external-users/');
            const { results } = response.data;
            
            Toast().fire({
                icon: "success",
                title: `Sync completed successfully! Created: ${results.created}, Updated: ${results.updated}, Total: ${results.total_users}`,
            });
            if (results.errors && results.errors.length > 0) {
                console.warn('Sync errors:', results.errors);
                Toast().fire({
                    icon: "warning",
                    title: `Sync completed with ${results.errors.length} errors. Check console for details.`,
                });

            }
            
            // Refresh users list after sync
            await fetchUsers();
            
        } catch (error) {
            console.error('Error syncing external users:', error);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.error || 'Failed to sync external users data'
            });
        } finally {
            setSyncing(false);
        }
    };

    // Modal handlers
    const openCreateModal = () => {
        setModalType('create');
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (user) => {
        setModalType('edit');
        setSelectedUser(user);
        setFormData({
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            password: '',
            password2: ''
        });
        setShowModal(true);
    };

    const openViewModal = async (user) => {
        try {
            const response = await api.get(`/admin/user-detail/${user.id}/`);
            setSelectedUser(response.data);
            setModalType('view');
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching user details:', error);
            Toast().fire({
                icon: "error",
                title: 'Failed to fetch user details'
            });
        }
    };

    const resetForm = () => {
        setFormData({
            full_name: '',
            email: '',
            role: 'student',
            password: '',
            password2: ''
        });
        setSelectedUser(null);
    };

    // Selection handlers
    const handleSelectAll = () => {
        if (selectedUsers.length === filteredUsers.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(filteredUsers.map(user => user.id));
        }
    };

    const handleSelectUser = (userId) => {
        if (selectedUsers.includes(userId)) {
            setSelectedUsers(selectedUsers.filter(id => id !== userId));
        } else {
            setSelectedUsers([...selectedUsers, userId]);
        }
    };

    // Effects
    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, roleFilter, statusFilter, users]);

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
        <>
            <AdminHeader />
            
            <section className="pt-5 pb-5 modern-dashboard">
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
                                <button 
                                    className="btn-modern-primary btn-sync" 
                                    onClick={syncData}
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
                                <button className="btn-modern-primary" onClick={openCreateModal}>
                                    <MdPersonAdd />
                                    Add New User
                                </button>
                                <button className="btn-modern-secondary">
                                    <MdDownload />
                                    Export Data
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
                                {filteredUsers.map((user) => (
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
                            </tbody>
                        </table>

                        {filteredUsers.length === 0 && (
                            <tbody>
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
                            </tbody>
                        )}
                    </div>

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
                                            <div className="detail-section">
                                                <h3>Basic Information</h3>
                                                <div className="detail-grid">
                                                    <div className="detail-item">
                                                        <label>Full Name:</label>
                                                        <span>{selectedUser?.user_info?.full_name}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Email:</label>
                                                        <span>{selectedUser?.user_info?.email}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Username:</label>
                                                        <span>{selectedUser?.user_info?.username}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Role:</label>
                                                        <span className={`role-badge ${selectedUser?.user_info?.role}`}>
                                                            {selectedUser?.user_info?.role}
                                                        </span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Status:</label>
                                                        <span className={`status-badge ${selectedUser?.user_info?.is_active ? 'active' : 'inactive'}`}>
                                                            {selectedUser?.user_info?.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Date Joined:</label>
                                                        <span>{selectedUser?.user_info?.date_joined ? new Date(selectedUser.user_info.date_joined).toLocaleDateString() : 'N/A'}</span>
                                                    </div>
                                                    <div className="detail-item">
                                                        <label>Last Login:</label>
                                                        <span>{selectedUser?.user_info?.last_login ? new Date(selectedUser.user_info.last_login).toLocaleString() : 'Never'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="detail-section">
                                                <h3>Statistics</h3>
                                                <div className="stats-grid-modal">
                                                    {selectedUser?.user_info?.role === 'student' && (
                                                        <>
                                                            <div className="stat-item">
                                                                <label>Total Enrollments:</label>
                                                                <span>{selectedUser?.enrollment_stats?.total_enrollments || 0}</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <label>Completed Courses:</label>
                                                                <span>{selectedUser?.enrollment_stats?.completed_courses || 0}</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <label>In Progress:</label>
                                                                <span>{selectedUser?.enrollment_stats?.in_progress_courses || 0}</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <label>Reviews Given:</label>
                                                                <span>{selectedUser?.enrollment_stats?.reviews_count || 0}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    
                                                    {selectedUser?.user_info?.role === 'teacher' && (
                                                        <>
                                                            <div className="stat-item">
                                                                <label>Total Courses:</label>
                                                                <span>{selectedUser?.teaching_stats?.total_courses || 0}</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <label>Published Courses:</label>
                                                                <span>{selectedUser?.teaching_stats?.published_courses || 0}</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <label>Total Students:</label>
                                                                <span>{selectedUser?.teaching_stats?.total_students || 0}</span>
                                                            </div>
                                                            <div className="stat-item">
                                                                <label>Total Revenue:</label>
                                                                <span>${selectedUser?.teaching_stats?.total_revenue || 0}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
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
                                                            <input
                                                                type="password"
                                                                id="password"
                                                                className="form-input-modern"
                                                                placeholder="Enter secure password"
                                                                value={formData.password}
                                                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                                                required
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="form-row">
                                                        <div className="form-group-modern">
                                                            <label htmlFor="password2" className="form-label-modern">
                                                                <FaCog className="label-icon" />
                                                                Confirm Password *
                                                            </label>
                                                            <input
                                                                type="password"
                                                                id="password2"
                                                                className="form-input-modern"
                                                                placeholder="Confirm password"
                                                                value={formData.password2}
                                                                onChange={(e) => setFormData({...formData, password2: e.target.value})}
                                                                required
                                                            />
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

            <Footer /> 
        </>
    );
}

export default React.memo(UsersAdmin);