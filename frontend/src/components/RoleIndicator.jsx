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
import { switchRole } from '../utils/roleUtils';
import Toast from '../views/plugin/Toast';
import useAxios from '../utils/useAxios';
import './RoleIndicator.css';

const RoleIndicator = ({ compact = false, variant = 'light', isAdmin = false }) => {
  const navigate = useNavigate();
  const { currentRole, availableRoles, rolesLoading, fetchAvailableRoles } = useRoles();
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

  // Handle role switch
  const handleRoleSwitch = async (role) => {
    if (role === currentRole) {
      setIsDropdownOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      // Determine destination dashboard URL based on role
      const getRoleDashboardUrl = (switchedRole) => {
        const normalizedRole = switchedRole?.toLowerCase().trim();
        
        switch (normalizedRole) {
          case 'student':
            return '/student/dashboard/';
          case 'teacher':
          case 'instructor':
            return '/instructor/dashboard/';
          case 'admin':
            return '/admin/dashboard/';
          default:
            return '/';
        }
      };

      // Callback to navigate to role-specific dashboard after role switch
      const onRoleSwitchCallback = (newRole, newAvailableRoles) => {
        console.log('PHASE 4.19: Role switch callback triggered, new role:', newRole);
        // Delay to ensure RolesContext updates before navigation
        setTimeout(() => {
          const dashboardUrl = getRoleDashboardUrl(newRole);
          console.log(`PHASE 4.19: Navigating to ${dashboardUrl} for role: ${newRole}`);
          navigate(dashboardUrl);
          // Trigger a full refresh of available roles
          fetchAvailableRoles();
        }, 500);
        return Promise.resolve();
      };

      const result = await switchRole(role, { onRoleSwitch: onRoleSwitchCallback });
      
      if (result.success) {
        const newRole = result.current_role;
        Toast().fire({
          icon: 'success',
          title: 'Role Switched',
          html: `You are now in <strong>${roleLabels[newRole] || newRole}</strong> mode`,
          timer: 3000
        });
        
        // Close dropdown after successful switch
        setIsDropdownOpen(false);
        
        // Navigate to role-specific dashboard - callback above will trigger this
      } else {
        setIsSwitching(false);
        Toast().fire({
          icon: 'error',
          title: 'Error',
          text: result.error || 'Gagal beralih peran',
          timer: 3000
        });
      }
    } catch (error) {
      console.error('Error switching role:', error);
      Toast().fire({
        icon: 'error',
        title: 'Error',
        text: 'Terjadi kesalahan saat beralih peran',
        timer: 3000
      });
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
          className={`role-badge-compact ${getCurrentRoleBadgeColor()}`}
          type="button"
          onClick={() => (availableRoles?.length || 0) > 1 && setIsDropdownOpen(!isDropdownOpen)}
          title={`Peran saat ini: ${getCurrentRoleLabel()}`}
          disabled={isSwitching}
        >
          <i className={`${getCurrentRoleIcon()} me-1`}></i>
          <span>{getCurrentRoleLabel()}</span>
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
            {availableRoles?.map((role) => (
              <button
                key={role}
                className={`${isAdmin ? "admin-role-dropdown-item" : "role-dropdown-item"} ${role === currentRole ? 'active' : ''} ${isSwitching ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleSwitch(role);
                }}
                disabled={isSwitching}
              >
                <i className={`${roleIcons[role?.toLowerCase()] || 'fas fa-user'} me-2`}></i>
                <span className={isAdmin ? "admin-role-label" : "role-label"}>{roleLabels[role?.toLowerCase()] || role}</span>
                {role === currentRole && (
                  <i className="fas fa-check-circle ms-auto text-success"></i>
                )}
              </button>
            ))}
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
            {availableRoles?.map((role) => (
              <button
                key={role}
                className={`role-dropdown-item ${role === currentRole ? 'active' : ''} ${isSwitching ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleSwitch(role);
                }}
                disabled={isSwitching}
              >
                <i className={`${roleIcons[role?.toLowerCase()] || 'fas fa-user'} me-2`}></i>
                <span className="role-label">{roleLabels[role?.toLowerCase()] || role}</span>
                <span className="role-description">
                  {role === currentRole ? 'Currently selected' : `Switch to ${roleLabels[role?.toLowerCase()]}`}
                </span>
                {role === currentRole && (
                  <i className="fas fa-check-circle ms-auto text-success"></i>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(RoleIndicator);
