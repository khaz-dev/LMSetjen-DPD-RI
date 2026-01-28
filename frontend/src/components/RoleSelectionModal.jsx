import React, { useState } from 'react';
import { switchRole } from '../utils/roleUtils';
import Toast from '../views/plugin/Toast';
import './RoleSelectionModal.css';

/**
 * Role Selection Modal Component
 * 
 * Displayed when a multi-role user logs in to allow them to select
 * their active role for the current session.
 * 
 * @param {Object} props
 * @param {boolean} props.show - Controls modal visibility
 * @param {Array} props.roles - Array of available roles
 * @param {string} props.currentRole - Currently selected role
 * @param {Function} props.onRoleSelected - Callback when role is selected
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {Object} props.user - User data (name, email)
 */
const RoleSelectionModal = ({
  show = false,
  roles = [],
  currentRole = null,
  onRoleSelected = () => {},
  onCancel = () => {},
  user = {}
}) => {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [isLoading, setIsLoading] = useState(false);

  if (!show || !roles || roles.length === 0) {
    return null;
  }

  /**
   * Get display name for role
   */
  const getRoleDisplayName = (role) => {
    const roleMap = {
      student: 'Peserta',
      teacher: 'Instruktur',
      instructor: 'Instruktur',
      admin: 'Administrator',
      super_admin: 'Super Administrator'
    };
    return roleMap[role] || role;
  };

  /**
   * Get icon for role
   */
  const getRoleIcon = (role) => {
    const iconMap = {
      student: 'fa-graduation-cap',
      teacher: 'fa-chalkboard-user',
      instructor: 'fa-chalkboard-user',
      admin: 'fa-user-shield',
      super_admin: 'fa-crown'
    };
    return iconMap[role] || 'fa-user';
  };

  /**
   * Get description for role
   */
  const getRoleDescription = (role) => {
    const descMap = {
      student: 'Akses sebagai peserta kursus',
      teacher: 'Akses sebagai instruktur',
      instructor: 'Akses sebagai instruktur',
      admin: 'Akses administrasi sistem',
      super_admin: 'Akses penuh sebagai super admin'
    };
    return descMap[role] || 'Akses pengguna';
  };

  /**
   * Handle role selection
   */
  const handleSelectRole = async (role) => {
    if (isLoading) return;

    setSelectedRole(role);
    setIsLoading(true);

    try {
      // Call backend to switch role
      const result = await switchRole(role);

      if (result.success) {
        Toast().fire({
          icon: 'success',
          title: 'Peran Dipilih',
          text: `Anda sekarang masuk sebagai ${getRoleDisplayName(role).toLowerCase()}.`,
        });

        // Call callback with selected role
        onRoleSelected(role);
      } else {
        Toast().fire({
          icon: 'error',
          title: 'Gagal Memilih Peran',
          text: result.error || 'Terjadi kesalahan saat memilih peran.',
        });
        setSelectedRole(currentRole);
      }
    } catch (error) {
      console.error('Error selecting role:', error);
      Toast().fire({
        icon: 'error',
        title: 'Gagal Memilih Peran',
        text: 'Terjadi kesalahan saat memilih peran.',
      });
      setSelectedRole(currentRole);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="role-selection-modal-overlay" onClick={onCancel}>
      <div 
        className="role-selection-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="role-selection-modal-header">
          <div className="header-content">
            <h3 className="modal-title">
              <i className="fas fa-user-circle"></i> Pilih Peran Anda
            </h3>
            <p className="modal-subtitle">
              Selamat datang{user?.full_name ? `, ${user.full_name}` : ''}!
            </p>
            {user?.email && (
              <p className="modal-email">{user.email}</p>
            )}
          </div>
          <button 
            className="modal-close" 
            onClick={onCancel}
            aria-label="Close"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Body - Role Options */}
        <div className="role-selection-modal-body">
          <p className="role-instruction">
            Pilih peran untuk melanjutkan:
          </p>

          <div className="roles-grid">
            {roles.map((role) => (
              <button
                key={role}
                className={`role-option ${selectedRole === role ? 'selected' : ''} ${isLoading ? 'disabled' : ''}`}
                onClick={() => handleSelectRole(role)}
                disabled={isLoading}
              >
                <div className="role-option-icon">
                  <i className={`fas ${getRoleIcon(role)}`}></i>
                </div>
                <div className="role-option-content">
                  <h4 className="role-option-name">
                    {getRoleDisplayName(role)}
                  </h4>
                  <p className="role-option-desc">
                    {getRoleDescription(role)}
                  </p>
                </div>
                {selectedRole === role && (
                  <div className="role-option-checkmark">
                    <i className="fas fa-check-circle"></i>
                  </div>
                )}
                {isLoading && selectedRole === role && (
                  <div className="role-option-spinner">
                    <div className="spinner-border spinner-border-sm"></div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Info message */}
          <div className="role-selection-info">
            <i className="fas fa-info-circle"></i>
            <span>
              Anda dapat mengubah peran kapan saja dari menu profil anda.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="role-selection-modal-footer">
          <p className="footer-text">
            Pilih peran di atas untuk melanjutkan
          </p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(RoleSelectionModal);
