import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
vi.mock('../utils/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('../views/plugin/Toast', () => ({
  default: () => ({
    fire: vi.fn()
  })
}));

import apiInstance from '../utils/axios';
import Cookie from 'js-cookie';
import { useAuthStore } from '../store/auth.jsx';
import {
  getRoleDashboardUrl,
  getRoleDisplayName,
  switchRole,
  switchRoleAndNavigate,
  getAvailableRoles,
  hasRole,
  isCurrentRole
} from '../utils/roleUtils';

describe('roleUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setUser(null);
  });

  describe('getRoleDashboardUrl', () => {
    it('returns proper dashboard route for each role', () => {
      expect(getRoleDashboardUrl('admin')).toBe('/admin/dashboard/');
      expect(getRoleDashboardUrl('ADMIN')).toBe('/admin/dashboard/');
      expect(getRoleDashboardUrl('teacher')).toBe('/instructor/dashboard/');
      expect(getRoleDashboardUrl('instructor')).toBe('/instructor/dashboard/');
      expect(getRoleDashboardUrl('student')).toBe('/student/dashboard/');
      expect(getRoleDashboardUrl('guest')).toBe('/');
      expect(getRoleDashboardUrl('')).toBe('/');
      expect(getRoleDashboardUrl(null)).toBe('/');
    });
  });

  describe('getRoleDisplayName', () => {
    it('returns Indonesian display names', () => {
      expect(getRoleDisplayName('admin')).toBe('Administrator');
      expect(getRoleDisplayName('teacher')).toBe('Instruktur');
      expect(getRoleDisplayName('instructor')).toBe('Instruktur');
      expect(getRoleDisplayName('student')).toBe('Peserta');
      expect(getRoleDisplayName('custom')).toBe('custom');
      expect(getRoleDisplayName('')).toBe('Pengguna');
      expect(getRoleDisplayName(null)).toBe('Pengguna');
    });
  });

  describe('switchRole', () => {
    it('returns error when role is falsy', async () => {
      const res = await switchRole('');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Pilihan peran tidak valid');
    });

    it('successfully switches role and updates store and cookies', async () => {
      useAuthStore.getState().setUser({
        user_id: 1,
        username: 'johndoe',
        current_role: 'student'
      });

      apiInstance.post.mockResolvedValueOnce({
        data: {
          success: true,
          current_role: 'instructor',
          available_roles: ['student', 'instructor'],
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          message: 'Berhasil beralih peran'
        }
      });

      const onRoleSwitchMock = vi.fn();
      const res = await switchRole('teacher', { onRoleSwitch: onRoleSwitchMock });

      expect(res.success).toBe(true);
      expect(res.current_role).toBe('instructor');
      expect(apiInstance.post).toHaveBeenCalledWith(
        'auth/select-role/',
        { role: 'instructor' },
        expect.any(Object)
      );

      // Verify cookies updated
      expect(Cookie.set).toHaveBeenCalledWith(
        'access_token',
        'new_access_token',
        expect.any(Object)
      );
      expect(Cookie.set).toHaveBeenCalledWith(
        'refresh_token',
        'new_refresh_token',
        expect.any(Object)
      );

      // Verify Zustand store updated
      const updatedUser = useAuthStore.getState().allUserData;
      expect(updatedUser.current_role).toBe('instructor');
      expect(updatedUser.available_roles).toEqual(['student', 'instructor']);

      // Verify callback triggered
      expect(onRoleSwitchMock).toHaveBeenCalledWith('instructor', ['student', 'instructor']);
    });

    it('handles backend 400 error', async () => {
      apiInstance.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'Role tidak tersedia' }
        }
      });

      const res = await switchRole('admin');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Role tidak tersedia');
    });

    it('handles backend 401 error', async () => {
      apiInstance.post.mockRejectedValueOnce({
        response: {
          status: 401
        }
      });

      const res = await switchRole('student');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Sesi login tidak valid');
    });

    it('handles backend 403 error', async () => {
      apiInstance.post.mockRejectedValueOnce({
        response: {
          status: 403,
          data: { error: 'Tidak memiliki izin' }
        }
      });

      const res = await switchRole('admin');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Tidak memiliki izin');
    });
  });

  describe('getAvailableRoles', () => {
    it('fetches roles successfully from api', async () => {
      apiInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          available_roles: ['student', 'teacher'],
          current_role: 'student',
          user_id: 123,
          has_multiple_roles: true
        }
      });

      const res = await getAvailableRoles();
      expect(res.success).toBe(true);
      expect(res.available_roles).toEqual(['student', 'teacher']);
      expect(res.has_multiple_roles).toBe(true);
    });

    it('handles network failure', async () => {
      apiInstance.get.mockRejectedValueOnce(new Error('Network error'));
      const res = await getAvailableRoles();
      expect(res.success).toBe(false);
      expect(res.available_roles).toEqual([]);
    });
  });

  describe('hasRole and isCurrentRole', () => {
    it('checks if user has required roles', () => {
      useAuthStore.getState().setUser({
        current_role: 'student',
        available_roles: ['student', 'instructor']
      });

      expect(hasRole('student')).toBe(true);
      expect(hasRole('instructor')).toBe(true);
      expect(hasRole('admin')).toBe(false);
      expect(hasRole(['admin', 'student'])).toBe(true);
      expect(hasRole(['admin', 'superadmin'])).toBe(false);
    });

    it('checks active role with isCurrentRole', () => {
      useAuthStore.getState().setUser({
        current_role: 'instructor'
      });

      expect(isCurrentRole('instructor')).toBe(true);
      expect(isCurrentRole('student')).toBe(false);
      expect(isCurrentRole(['instructor', 'admin'])).toBe(true);
    });
  });

  describe('switchRoleAndNavigate', () => {
    it('navigates directly if already in target role', async () => {
      useAuthStore.getState().setUser({
        current_role: 'instructor'
      });

      const navigateMock = vi.fn();
      const res = await switchRoleAndNavigate('instructor', '/custom-url', navigateMock);
      expect(res.success).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('/custom-url');
      expect(apiInstance.post).not.toHaveBeenCalled();
    });

    it('calls switchRole and navigates on success', async () => {
      useAuthStore.getState().setUser({
        current_role: 'student'
      });

      apiInstance.post.mockResolvedValueOnce({
        data: {
          success: true,
          current_role: 'instructor',
          available_roles: ['student', 'instructor']
        }
      });

      const navigateMock = vi.fn();
      const res = await switchRoleAndNavigate('instructor', null, navigateMock);

      expect(res.success).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('/instructor/dashboard/', { replace: true });
    });
  });
});

