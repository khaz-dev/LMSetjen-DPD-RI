/**
 * RoleIndicator Component
 * 
 * Phase 7: Displays current active role and provides role switching UI
 * 
 * Features:
 * - Shows current role badge
 * - Displays role in human-readable format
 * - Shows loading state when switching roles
 * - Dropdown to switch between available roles (expanded mode only)
 * - Compact mode for headers/navbars (display only, no interactive elements)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoles } from '../utils/useRoles';
import { switchRole, getRoleDashboardUrl } from '../utils/roleUtils';
import Toast from '../views/plugin/Toast';
import useAxios from '../utils/useAxios';
import './RoleIndicator.css';

const RoleIndicator = ({ compact = false, variant = 'light', isAdmin = false }) => {
  const navigate = useNavigate();
  const { currentRole, availableRoles, rolesLoading, fetchAvailableRoles, setCurrentRole, setAvailableRoles } = useRoles();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef(null);

  // Human-readable role names
  const roleLabels = {
    student: 'Peserta',
    teacher: 'Instruktur',
    instructor: 'Instruktur',
    admin: 'Administrator'
  };

  // Role icons
  const roleIcons = {
    student: 'fas fa-graduation-cap',
    teacher: 'fas fa-chalkboard-user',
    instructor: 'fas fa-chalkboard-user',
    admin: 'fas fa-shield-alt'
  };

  // Role badge colors
  const roleBadgeColors = {
    student: 'badge-primary',
    teacher: 'badge-success',
    instructor: 'badge-success',
    admin: 'badge-danger'
  };

  const getCurrentRoleLabel = () => {
    return roleLabels[currentRole?.toLowerCase()] || currentRole || 'Tidak Ditugaskan';
  };

  const getCurrentRoleIcon = () => {
    return roleIcons[currentRole?.toLowerCase()] || 'fas fa-user';
  };

  const getCurrentRoleBadgeColor = () => {
    return roleBadgeColors[currentRole?.toLowerCase()] || 'badge-secondary';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // ✨ ROLE-NOTIF: Hitungan notifikasi aktif / belum dibaca untuk masing-masing peran
  const [roleNotifCounts, setRoleNotifCounts] = useState({
    student: 0,
    instructor: 0,
    teacher: 0,
    admin: 0
  });

  useEffect(() => {
    let isMounted = true;
    const fetchRoleNotifCounts = async () => {
      try {
        const res = await useAxios.get('user/role-notifications/');
        if (isMounted && res.data?.success && res.data?.counts) {
          setRoleNotifCounts(res.data.counts);
        }
      } catch (err) {
        // Silent fail jika belum login / unauthorized
        console.debug('Failed to fetch role notifications count:', err);
      }
    };

    fetchRoleNotifCounts();

    const handleRefresh = () => {
      fetchRoleNotifCounts();
    };

    window.addEventListener('notificationUpdated', handleRefresh);
    window.addEventListener('refreshNotifications', handleRefresh);
    window.addEventListener('focus', handleRefresh);

    const interval = setInterval(fetchRoleNotifCounts, 45000);

    return () => {
      isMounted = false;
      window.removeEventListener('notificationUpdated', handleRefresh);
      window.removeEventListener('refreshNotifications', handleRefresh);
      window.removeEventListener('focus', handleRefresh);
      clearInterval(interval);
    };
  }, []);

  const normalizeRole = (role) => {
    if (!role) return '';
    const r = role.toLowerCase().trim();
    return (r === 'teacher') ? 'instructor' : r;
  };

  const isRoleActive = (role) => {
    return normalizeRole(role) === normalizeRole(currentRole);
  };

  const getRoleNotificationCount = (role) => {
    if (!role) return 0;
    const r = role.toLowerCase().trim();
    if (r === 'teacher' || r === 'instructor') {
      return roleNotifCounts.instructor || roleNotifCounts.teacher || 0;
    }
    return roleNotifCounts[r] || 0;
  };

  const hasOtherRoleNotifications = (availableRoles || []).some(role => {
    if (isRoleActive(role)) return false;
    return getRoleNotificationCount(role) > 0;
  });

  // Handle role switch - changes role first, then navigates
  const handleRoleSwitch = async (role) => {
    if (isRoleActive(role)) {
      setIsDropdownOpen(false);
      return;
    }

    setIsSwitching(true);
    setIsDropdownOpen(false);

    try {
      const targetRoleLabel = roleLabels[normalizeRole(role)] || role;

      Toast().fire({
        icon: 'info',
        title: 'Memproses...',
        text: `Beralih ke peran ${targetRoleLabel}...`,
        timer: 1500,
        showConfirmButton: false
      });

      // 1. Perform role switch in backend API, update cookies & Zustand store & trigger authRoleChanged
      const result = await switchRole(role);

      if (result.success) {
        const newRole = result.current_role;

        // 2. Synchronously update RolesContext state before navigating
        if (setCurrentRole) {
          setCurrentRole(newRole);
        }
        if (result.available_roles && setAvailableRoles) {
          setAvailableRoles(result.available_roles);
        }

        Toast().fire({
          icon: 'success',
          title: 'Peran Berhasil Beralih',
          html: `Anda sekarang dalam mode <strong>${roleLabels[normalizeRole(newRole)] || newRole}</strong>`,
          timer: 2000,
          showConfirmButton: false
        });

        // 3. Navigate to target dashboard only AFTER the role switch has succeeded
        const dashboardUrl = getRoleDashboardUrl(newRole);
        navigate(dashboardUrl, { replace: true, state: { roleSwitchedTo: newRole } });
      } else {
        Toast().fire({
          icon: 'error',
          title: 'Gagal Beralih Peran',
          text: result.error || 'Terjadi kesalahan saat beralih peran',
          timer: 4000
        });
      }
    } catch (error) {
      console.error('Error switching role:', error);
      Toast().fire({
        icon: 'error',
        title: 'Kesalahan',
        text: 'Terjadi kesalahan saat beralih peran',
        timer: 4000
      });
    } finally {
      setIsSwitching(false);
    }
  };

  // Show loading state during initial role fetch
  if (rolesLoading) {
    return (
      <div className={`role-indicator loading ${compact ? 'compact' : ''}`}>
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Memuat peran...</span>
        </div>
      </div>
    );
  }

  // Show compact role badge - INTERACTIVE WITH DROPDOWN
  // ✨ PHASE 4.16: Compact mode now includes role switching dropdown
  if (compact) {
    return (
      <div className="role-indicator compact" ref={dropdownRef}>
        <button
          className={`role-badge-compact ${getCurrentRoleBadgeColor()} ${hasOtherRoleNotifications ? 'has-other-notif' : ''}`}
          type="button"
          onClick={() => (availableRoles?.length || 0) > 1 && setIsDropdownOpen(!isDropdownOpen)}
          title={`Peran saat ini: ${getCurrentRoleLabel()}${hasOtherRoleNotifications ? ' (Ada notifikasi di peran lain)' : ''}`}
          disabled={isSwitching}
        >
          <i className={`${getCurrentRoleIcon()} me-1`}></i>
          <span>{getCurrentRoleLabel()}</span>
          {hasOtherRoleNotifications && (
            <span className="role-compact-pulse-dot" title="Ada notifikasi aktif di peran lain"></span>
          )}
          {(availableRoles?.length || 0) > 1 && (
            <i className={`fas fa-chevron-down ms-1 role-chevron ${isDropdownOpen ? 'rotate' : ''}`}></i>
          )}
        </button>

        {/* Compact Role Dropdown Menu */}
        {isDropdownOpen && (availableRoles?.length || 0) > 1 && (
          <div className={isAdmin ? "admin-role-dropdown-menu" : "role-dropdown-menu compact"}>
            <div className={isAdmin ? "admin-role-dropdown-header" : "role-dropdown-header"}>
              <span>Ubah Peran</span>
            </div>
            <div className={isAdmin ? "admin-role-dropdown-divider" : "role-dropdown-divider"}></div>
            {availableRoles?.map((role) => {
              const notifCount = getRoleNotificationCount(role);
              const isActive = isRoleActive(role);
              return (
                <button
                  key={role}
                  className={`${isAdmin ? "admin-role-dropdown-item" : "role-dropdown-item"} ${isActive ? 'active' : ''} ${isSwitching ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSwitch(role);
                  }}
                  disabled={isSwitching}
                >
                  <i className={`${roleIcons[role?.toLowerCase()] || 'fas fa-user'} me-2`}></i>
                  <span className={isAdmin ? "admin-role-label" : "role-label"}>
                    {roleLabels[role?.toLowerCase()] || role}
                  </span>
                  {notifCount > 0 && (
                    <span 
                      className={`role-notif-pill ${isActive ? 'active-role-pill' : ''}`}
                      title={`${notifCount} notifikasi aktif`}
                    >
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                  {isActive && (
                    <i className="fas fa-check-circle ms-auto text-success role-active-check"></i>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Show expanded role indicator
  return (
    <div className="role-indicator expanded" ref={dropdownRef}>
      <div
        className={`role-indicator-card ${getCurrentRoleBadgeColor()} ${isSwitching ? 'switching' : ''}`}
        onClick={() => (availableRoles?.length || 0) > 1 && setIsDropdownOpen(!isDropdownOpen)}
        role={((availableRoles?.length || 0) > 1) ? 'button' : 'status'}
        tabIndex={(availableRoles?.length || 0) > 1 ? 0 : -1}
      >
        <div className="role-indicator-content">
          <i className={getCurrentRoleIcon()}></i>
          <div className="role-info">
            <span className="role-label-small">Peran Saat Ini</span>
            <span className="role-name">{getCurrentRoleLabel()}</span>
          </div>
          {hasOtherRoleNotifications && (
            <span className="role-compact-pulse-dot ms-2" title="Ada notifikasi aktif di peran lain"></span>
          )}
          {(availableRoles?.length || 0) > 1 && (
            <i className={`fas fa-chevron-down role-chevron ${isDropdownOpen ? 'rotate' : ''}`}></i>
          )}
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (availableRoles?.length || 0) > 1 && (
          <div className="role-dropdown-menu expanded">
            <div className="role-dropdown-header">
              <span>Ubah Peran</span>
            </div>
            <div className="role-dropdown-divider"></div>
            {availableRoles?.map((role) => {
              const notifCount = getRoleNotificationCount(role);
              const isActive = isRoleActive(role);
              return (
                <button
                  key={role}
                  className={`role-dropdown-item ${isActive ? 'active' : ''} ${isSwitching ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleSwitch(role);
                  }}
                  disabled={isSwitching}
                >
                  <i className={`${roleIcons[role?.toLowerCase()] || 'fas fa-user'} me-2`}></i>
                  <div className="role-dropdown-info">
                    <span className="role-label">{roleLabels[role?.toLowerCase()] || role}</span>
                    <span className="role-description">
                      {isActive ? 'Peran sedang aktif' : `Beralih ke peran ${roleLabels[role?.toLowerCase()] || role}`}
                    </span>
                  </div>
                  {notifCount > 0 && (
                    <span 
                      className={`role-notif-pill ${isActive ? 'active-role-pill' : ''}`}
                      title={`${notifCount} notifikasi aktif`}
                    >
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                  {isActive && (
                    <i className="fas fa-check-circle ms-auto text-success role-active-check"></i>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(RoleIndicator);
