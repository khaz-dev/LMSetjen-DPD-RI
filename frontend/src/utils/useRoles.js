/**
 * useRoles - Custom hook for accessing multi-role context
 * 
 * Phase 4: Multi-role support hook
 * 
 * Usage:
 *   const { availableRoles, currentRole, rolesLoading, fetchAvailableRoles } = useRoles();
 *   
 *   if (availableRoles.includes('admin')) {
 *     // User has admin role
 *   }
 *   
 *   if (currentRole === 'teacher') {
 *     // User is currently in teacher role
 *   }
 */

import { useContext } from 'react';
import { RolesContext } from '../views/plugin/Context';

export const useRoles = () => {
  const context = useContext(RolesContext);
  
  if (!context) {
    console.warn('useRoles: RolesContext not provided. Make sure RolesContext.Provider wraps your component tree.');
    return {
      availableRoles: [],
      currentRole: null,
      rolesLoading: false,
      fetchAvailableRoles: () => {}
    };
  }
  
  return context;
};

export default useRoles;
