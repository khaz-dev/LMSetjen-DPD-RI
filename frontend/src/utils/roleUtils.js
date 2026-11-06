/**
 * Role Selection API Utilities
 * 
 * Phase 4: Frontend utilities for role management
 * 
 * Provides functions to:
 * - Switch user's current role
 * - Get available roles
 * - Update JWT tokens after role switch
 * - Synchronize role across state, context, and router navigation
 */

import apiInstance from './axios';
import Cookie from 'js-cookie';
import { useAuthStore } from '../store/auth.jsx';
import jwtDecode from 'jwt-decode';
import Toast from '../views/plugin/Toast';

/**
 * Map role to its dashboard URL
 * 
 * @param {string} role - Role name (student, teacher, instructor, admin)
 * @returns {string} - Dashboard URL
 */
export const getRoleDashboardUrl = (role) => {
  const r = (role || '').toLowerCase().trim();
  if (r === 'admin') return '/admin/dashboard/';
  if (r === 'teacher' || r === 'instructor') return '/instructor/dashboard/';
  if (r === 'student') return '/student/dashboard/';
  return '/';
};

/**
 * Get human readable display label for role
 * 
 * @param {string} role - Role name
 * @returns {string} - Label in Indonesian
 */
export const getRoleDisplayName = (role) => {
  const r = (role || '').toLowerCase().trim();
  if (r === 'admin') return 'Administrator';
  if (r === 'teacher' || r === 'instructor') return 'Instruktur';
  if (r === 'student') return 'Peserta';
  return role || 'Pengguna';
};

/**
 * Switch user's active role
 * 
 * @param {string} role - Target role to switch to (student, teacher, instructor, admin)
 * @param {object} options - Optional configuration
 * @param {function} options.onRoleSwitch - Callback to refresh RolesContext
 * @returns {Promise} - Response with new tokens and role info
 */
export const switchRole = async (role, options = {}) => {
  try {
    const normalizedTargetRole = role.toLowerCase().trim() === 'teacher' ? 'instructor' : role.toLowerCase().trim();
    console.log(`[RoleSystem] Switching to role: ${normalizedTargetRole}`);
    
    // Set global and session switching flags to prevent old routes from auto-reverting roles during transit
    if (typeof window !== 'undefined') {
      window.__roleSwitchingTarget = normalizedTargetRole;
      try {
        sessionStorage.setItem('role_switching_target', normalizedTargetRole);
      } catch (e) {}
    }
    
    // Explicitly guarantee Authorization header from cookies or options
    const token = options.accessToken || Cookie.get('access_token');
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      };
    }
    
    const response = await apiInstance.post('auth/select-role/', {
      role: normalizedTargetRole
    }, config);
    
    if (response.data.success) {
      console.log('[RoleSystem] Role switched successfully in backend');
      
      // 1. Update JWT tokens in cookies
      const { access_token, refresh_token } = response.data;
      if (access_token && refresh_token) {
        updateAuthTokens(access_token, refresh_token);
        console.log('[RoleSystem] Auth tokens updated in cookies');
      }
      
      // 2. Update Zustand store
      const currentUser = useAuthStore.getState().allUserData;
      const updatedUser = {
        ...currentUser,
        current_role: response.data.current_role,
        role: response.data.current_role,
        available_roles: response.data.available_roles
      };
      useAuthStore.getState().setUser(updatedUser);
      console.log('[RoleSystem] Zustand store updated');
      
      // 3. Dispatch global window event so React root (App.jsx) and components immediately update context
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('authRoleChanged', {
            detail: {
              current_role: response.data.current_role,
              available_roles: response.data.available_roles
            }
          }));
          console.log('[RoleSystem] Dispatched authRoleChanged event');
        }
      } catch (evtErr) {
        console.warn('Could not dispatch authRoleChanged event', evtErr);
      }

      // 4. Call callback to refresh RolesContext if provided
      if (options.onRoleSwitch && typeof options.onRoleSwitch === 'function') {
        console.log('[RoleSystem] Calling onRoleSwitch callback');
        await options.onRoleSwitch(response.data.current_role, response.data.available_roles);
      }
      
      return {
        success: true,
        current_role: response.data.current_role,
        available_roles: response.data.available_roles,
        message: response.data.message
      };
    }
    
    return {
      success: false,
      error: response.data.error || 'Failed to switch role'
    };
    
  } catch (error) {
    console.error('[RoleSystem] Error switching role:', error);

    if (typeof window !== 'undefined') {
      delete window.__roleSwitchingTarget;
      try { sessionStorage.removeItem('role_switching_target'); } catch (e) {}
    }

    if (error.response?.status === 400) {
      return {
        success: false,
        error: error.response.data.error || 'Pilihan peran tidak valid'
      };
    }

    if (error.response?.status === 401) {
      return {
        success: false,
        error: 'Sesi login tidak valid atau telah berakhir. Silakan login kembali.'
      };
    }

    if (error.response?.status === 403) {
      return {
        success: false,
        error: error.response?.data?.error || 'Akses ditolak untuk mengganti peran.'
      };
    }

    if (error.response?.data?.error) {
      return {
        success: false,
        error: error.response.data.error
      };
    }
    
    return {
      success: false,
      error: 'Kesalahan jaringan. Silakan periksa koneksi Anda.'
    };
  }
};

/**
 * Switch role first, and then navigate to destination page.
 * Guarantees that token, cookies, Zustand, and React context are 100% updated BEFORE page navigation.
 * 
 * @param {string} role - Target role to switch to (student, instructor, admin)
 * @param {string|null} destinationUrl - Optional target URL (defaults to role dashboard)
 * @param {function|null} navigateFn - React Router navigate function
 * @returns {Promise<object>} - Result of role switch
 */
export const switchRoleAndNavigate = async (role, destinationUrl = null, navigateFn = null) => {
  const targetRole = (role || '').toLowerCase().trim();
  const normalizedTarget = (targetRole === 'teacher') ? 'instructor' : targetRole;
  const destUrl = destinationUrl || getRoleDashboardUrl(normalizedTarget);
  
  // Check active role
  let currentActiveRole = '';
  try {
    const rawUserData = useAuthStore.getState().allUserData;
    currentActiveRole = rawUserData?.current_role || rawUserData?.role || '';
  } catch (e) {}
  
  if (!currentActiveRole) {
    const token = Cookie.get('access_token') || Cookie.get('refresh_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        currentActiveRole = decoded?.current_role || decoded?.role || '';
      } catch (e) {}
    }
  }
  
  const normalizedActive = (currentActiveRole === 'teacher') ? 'instructor' : currentActiveRole.toLowerCase().trim();
  
  // If already in target role, navigate directly without API call
  if (normalizedActive === normalizedTarget) {
    if (navigateFn) {
      navigateFn(destUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = destUrl;
    }
    return { success: true, current_role: normalizedTarget };
  }

  // Show transition notification
  Toast().fire({
    icon: 'info',
    title: 'Memproses...',
    text: `Beralih ke peran ${getRoleDisplayName(normalizedTarget)}...`,
    timer: 1500,
    showConfirmButton: false
  });

  // Switch role FIRST: updates backend DB, cookies, Zustand, and dispatches authRoleChanged event
  const result = await switchRole(normalizedTarget);
  
  if (result.success) {
    Toast().fire({
      icon: 'success',
      title: 'Peran Berhasil Beralih',
      text: `Anda sekarang aktif dalam peran ${getRoleDisplayName(result.current_role)}`,
      timer: 2000,
      showConfirmButton: false
    });

    // Navigate to destination ONLY AFTER role switch has fully settled
    if (navigateFn) {
      navigateFn(destUrl, { replace: true });
    } else if (typeof window !== 'undefined') {
      window.location.href = destUrl;
    }
  } else {
    Toast().fire({
      icon: 'error',
      title: 'Gagal Beralih Peran',
      text: result.error || 'Terjadi kesalahan saat beralih peran',
      timer: 4000
    });
  }
  
  return result;
};

/**
 * Fetch available roles for current user
 * 
 * @returns {Promise} - Available roles and current role
 */
export const getAvailableRoles = async () => {
  try {
    console.log('[RoleSystem] Fetching available roles');
    
    const response = await apiInstance.get('auth/available-roles/');
    
    if (response.data.success) {
      console.log('[RoleSystem] Available roles:', response.data.available_roles);
      return {
        success: true,
        available_roles: response.data.available_roles || [],
        current_role: response.data.current_role || null,
        user_id: response.data.user_id,
        has_multiple_roles: response.data.has_multiple_roles
      };
    }
    
    return {
      success: false,
      available_roles: [],
      error: 'Failed to fetch roles'
    };
    
  } catch (error) {
    console.error('[RoleSystem] Error fetching available roles:', error);
    return {
      success: false,
      available_roles: [],
      error: 'Kesalahan jaringan'
    };
  }
};

/**
 * Update authentication tokens after role switch
 * 
 * @private
 * @param {string} access_token - New access token
 * @param {string} refresh_token - New refresh token
 */
const updateAuthTokens = (access_token, refresh_token) => {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  const cookieOptions = {
    expires: 1,
    secure: isHttps,
    sameSite: isHttps ? 'Strict' : 'Lax',
    path: '/'
  };

  Cookie.set('access_token', access_token, cookieOptions);
  Cookie.set('refresh_token', refresh_token, {
    ...cookieOptions,
    expires: 7
  });
  
  console.log('[RoleSystem] Tokens updated in cookies');
};

/**
 * Check if user has a specific role
 * 
 * @param {string|array} requiredRoles - Role(s) to check for
 * @returns {boolean} - True if user has the role(s)
 */
export const hasRole = (requiredRoles) => {
  try {
    const userData = useAuthStore.getState().allUserData;
    if (!userData) return false;
    
    const userRoles = userData.available_roles || [];
    
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.some(role => userRoles.includes(role));
    }
    
    return userRoles.includes(requiredRoles);
  } catch (error) {
    console.error('[RoleSystem] Error checking role:', error);
    return false;
  }
};

/**
 * Check if user's current active role matches
 * 
 * @param {string|array} requiredRoles - Role(s) to check for
 * @returns {boolean} - True if current role matches
 */
export const isCurrentRole = (requiredRoles) => {
  try {
    const userData = useAuthStore.getState().allUserData;
    if (!userData) return false;
    
    const currentRole = userData.current_role || userData.role;
    
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(currentRole);
    }
    
    return currentRole === requiredRoles;
  } catch (error) {
    console.error('[RoleSystem] Error checking current role:', error);
    return false;
  }
};

export default {
  switchRole,
  switchRoleAndNavigate,
  getRoleDashboardUrl,
  getRoleDisplayName,
  getAvailableRoles,
  hasRole,
  isCurrentRole
};
