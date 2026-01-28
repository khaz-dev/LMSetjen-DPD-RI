/**
 * Role Selection API Utilities
 * 
 * Phase 4: Frontend utilities for role management
 * 
 * Provides functions to:
 * - Switch user's current role
 * - Get available roles
 * - Update JWT tokens after role switch
 */

import apiInstance from './axios';
import Cookie from 'js-cookie';
import { useAuthStore } from '../store/auth.jsx';

/**
 * Switch user's active role
 * 
 * @param {string} role - Target role to switch to (student, teacher, admin)
 * @param {object} options - Optional configuration
 * @param {function} options.onRoleSwitch - Callback to refresh RolesContext (e.g., from App.jsx)
 * @returns {Promise} - Response with new tokens and role info
 * 
 * Example:
 *   const result = await switchRole('teacher', { onRoleSwitch: () => window.location.reload() });
 *   if (result.success) {
 *     // Role switched successfully
 *     console.log('New role:', result.current_role);
 *   }
 */
export const switchRole = async (role, options = {}) => {
  try {
    console.log(`PHASE 4.17: Switching to role: ${role}`);
    
    const response = await apiInstance.post(`auth/select-role/`, {
      role: role.toLowerCase().trim()
    });
    
    if (response.data.success) {
      console.log('PHASE 4.17: Role switched successfully');
      
      // Update JWT tokens
      const { access_token, refresh_token } = response.data;
      if (access_token && refresh_token) {
        updateAuthTokens(access_token, refresh_token);
        console.log('PHASE 4.17: Auth tokens updated in cookies');
      }
      
      // Update Zustand store
      const currentUser = useAuthStore.getState().allUserData;
      const updatedUser = {
        ...currentUser,
        current_role: response.data.current_role,
        available_roles: response.data.available_roles
      };
      useAuthStore.getState().setUser(updatedUser);
      console.log('PHASE 4.17: Zustand store updated');
      
      // Call callback to refresh RolesContext if provided (from App.jsx)
      if (options.onRoleSwitch && typeof options.onRoleSwitch === 'function') {
        console.log('PHASE 4.17: Calling onRoleSwitch callback to refresh RolesContext');
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
    console.error('PHASE 4.17: Error switching role:', error);
    
    if (error.response?.status === 400) {
      return {
        success: false,
        error: error.response.data.error || 'Invalid role selection'
      };
    }
    
    return {
      success: false,
      error: 'Network error. Please check your connection.'
    };
  }
};

/**
 * Fetch available roles for current user
 * 
 * @returns {Promise} - Available roles and current role
 * 
 * Example:
 *   const roles = await getAvailableRoles();
 *   console.log('Available:', roles.available_roles); // ['student', 'teacher']
 *   console.log('Current:', roles.current_role);      // 'student'
 */
export const getAvailableRoles = async () => {
  try {
    console.log('PHASE 4: Fetching available roles');
    
    const response = await apiInstance.get(`auth/available-roles/`);
    
    if (response.data.success) {
      console.log('PHASE 4: Available roles:', response.data.available_roles);
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
    console.error('PHASE 4: Error fetching available roles:', error);
    return {
      success: false,
      available_roles: [],
      error: 'Network error'
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
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const cookieOptions = {
    expires: isLocalhost ? 1 : 1,
    secure: !isLocalhost,
    sameSite: isLocalhost ? 'Lax' : 'strict'
  };

  Cookie.set('access_token', access_token, cookieOptions);
  Cookie.set('refresh_token', refresh_token, {
    ...cookieOptions,
    expires: isLocalhost ? 7 : 7
  });
  
  console.log('PHASE 4: Tokens updated');
};

/**
 * Check if user has a specific role
 * 
 * @param {string|array} requiredRoles - Role(s) to check for
 * @returns {boolean} - True if user has the role(s)
 * 
 * Example:
 *   if (hasRole('admin')) { console.log('show admin panel'); }
 *   if (hasRole(['teacher', 'admin'])) { console.log('show instructor features'); }
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
    console.error('PHASE 4: Error checking role:', error);
    return false;
  }
};

/**
 * Check if user's current active role matches
 * 
 * @param {string|array} requiredRoles - Role(s) to check for
 * @returns {boolean} - True if current role matches
 * 
 * Example:
 *   if (isCurrentRole('admin')) { console.log('user is in admin mode'); }
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
    console.error('PHASE 4: Error checking current role:', error);
    return false;
  }
};

export default {
  switchRole,
  getAvailableRoles,
  hasRole,
  isCurrentRole
};
