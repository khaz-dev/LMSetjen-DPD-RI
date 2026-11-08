import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/axios', () => ({
  default: {
    post: vi.fn()
  }
}));

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('jwt-decode', () => ({
  default: vi.fn()
}));

import apiInstance from '../utils/axios';
import Cookie from 'js-cookie';
import jwt_decode from 'jwt-decode';
import { useAuthStore } from '../store/auth.jsx';
import {
  isAccessTokenExpired,
  redirectUserByRole,
  login,
  logout
} from '../utils/auth';

describe('auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().setUser(null);
  });

  describe('isAccessTokenExpired', () => {
    it('returns true for null, empty or non-string tokens', () => {
      expect(isAccessTokenExpired(null)).toBe(true);
      expect(isAccessTokenExpired(undefined)).toBe(true);
      expect(isAccessTokenExpired('')).toBe(true);
      expect(isAccessTokenExpired('   ')).toBe(true);
      expect(isAccessTokenExpired(12345)).toBe(true);
      expect(isAccessTokenExpired({})).toBe(true);
    });

    it('returns true if jwt_decode fails', () => {
      jwt_decode.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });
      expect(isAccessTokenExpired('malformed.token.value')).toBe(true);
    });

    it('returns true if exp is in the past', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 300; // 5 min ago
      jwt_decode.mockReturnValueOnce({ exp: pastExp });
      expect(isAccessTokenExpired('valid.looking.token')).toBe(true);
    });

    it('returns false if exp is in the future', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour ahead
      jwt_decode.mockReturnValueOnce({ exp: futureExp });
      expect(isAccessTokenExpired('valid.looking.token')).toBe(false);
    });
  });

  describe('redirectUserByRole', () => {
    let originalLocation;

    beforeEach(() => {
      originalLocation = window.location;
      delete window.location;
      window.location = { href: '' };
    });

    afterEach(() => {
      window.location = originalLocation;
    });

    it('redirects correctly based on string role', () => {
      redirectUserByRole('admin');
      expect(window.location.href).toBe('/admin/dashboard/');

      redirectUserByRole('teacher');
      expect(window.location.href).toBe('/instructor/dashboard/');

      redirectUserByRole('instructor');
      expect(window.location.href).toBe('/instructor/dashboard/');

      redirectUserByRole('student');
      expect(window.location.href).toBe('/student/dashboard/');
    });

    it('redirects correctly based on user object with role or current_role', () => {
      redirectUserByRole({ role: 'admin' });
      expect(window.location.href).toBe('/admin/dashboard/');

      redirectUserByRole({ current_role: 'instructor' });
      expect(window.location.href).toBe('/instructor/dashboard/');

      redirectUserByRole({ role: 'student' });
      expect(window.location.href).toBe('/student/dashboard/');
    });

    it('falls back to student dashboard when role is missing or unknown', () => {
      redirectUserByRole(null);
      expect(window.location.href).toBe('/student/dashboard/');

      redirectUserByRole({});
      expect(window.location.href).toBe('/student/dashboard/');
    });
  });

  describe('login', () => {
    it('sets auth cookies and returns data on 200 success', async () => {
      jwt_decode.mockReturnValueOnce({
        user_id: 42,
        email: 'user@dpd.go.id',
        role: 'student'
      });

      apiInstance.post.mockResolvedValueOnce({
        status: 200,
        data: {
          access: 'jwt-access-token',
          refresh: 'jwt-refresh-token'
        }
      });

      const res = await login('user@dpd.go.id', 'secret123');
      expect(res.error).toBe(null);
      expect(res.data.access).toBe('jwt-access-token');

      // Verify cookies set
      expect(Cookie.set).toHaveBeenCalledWith(
        'access_token',
        'jwt-access-token',
        expect.any(Object)
      );
      expect(Cookie.set).toHaveBeenCalledWith(
        'refresh_token',
        'jwt-refresh-token',
        expect.any(Object)
      );

      // Verify store updated
      expect(useAuthStore.getState().allUserData.user_id).toBe(42);
    });

    it('handles 401 unauthorized gracefully', async () => {
      apiInstance.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { detail: 'Email atau password salah.' }
        }
      });

      const res = await login('user@dpd.go.id', 'wrong');
      expect(res.data).toBe(null);
      expect(res.error).toBe('Email atau password salah.');
    });

    it('handles network error', async () => {
      apiInstance.post.mockRejectedValueOnce({
        request: {}
      });

      const res = await login('user@dpd.go.id', 'pass');
      expect(res.data).toBe(null);
      expect(res.error).toContain('Kesalahan jaringan');
    });
  });

  describe('logout', () => {
    it('removes cookies and clears state and storage', () => {
      useAuthStore.getState().setUser({ user_id: 99 });
      localStorage.setItem('user', '99');

      logout();

      expect(Cookie.remove).toHaveBeenCalledWith('access_token');
      expect(Cookie.remove).toHaveBeenCalledWith('refresh_token');
      expect(useAuthStore.getState().allUserData).toBe(null);
      expect(localStorage.getItem('user')).toBe(null);
    });
  });
});

