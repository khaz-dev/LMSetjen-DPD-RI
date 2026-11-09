import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import Cookie from 'js-cookie';
import jwtDecode from 'jwt-decode';
import { useAuthStore } from '../store/auth.jsx';
import UserData from '../views/plugin/UserData';

describe('UserData utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().setUser(null);
  });

  it('returns null and does not clear cookies if no tokens are present', () => {
    Cookie.get.mockReturnValue(undefined);

    const user = UserData();
    expect(user).toBe(null);
    expect(Cookie.remove).not.toHaveBeenCalled();
  });

  it('returns decoded access_token if access_token is valid', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    Cookie.get.mockImplementation((key) => {
      if (key === 'access_token') return 'valid-access-token';
      return undefined;
    });
    jwtDecode.mockReturnValue({
      user_id: 123,
      role: 'student',
      exp: futureExp
    });

    const user = UserData();
    expect(user).toEqual({
      user_id: 123,
      role: 'student',
      exp: futureExp
    });
  });

  it('cleans up stale cookies and returns null if both access and refresh tokens are expired', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    Cookie.get.mockImplementation((key) => {
      if (key === 'access_token') return 'expired-access-token';
      if (key === 'refresh_token') return 'expired-refresh-token';
      return undefined;
    });
    jwtDecode.mockReturnValue({
      user_id: 776,
      role: 'student',
      exp: pastExp
    });

    const user = UserData();
    expect(user).toBe(null);
    expect(Cookie.remove).toHaveBeenCalledWith('access_token');
    expect(Cookie.remove).toHaveBeenCalledWith('access_token', { path: '/' });
    expect(Cookie.remove).toHaveBeenCalledWith('refresh_token');
    expect(Cookie.remove).toHaveBeenCalledWith('refresh_token', { path: '/' });
  });

  it('returns user if access_token is expired but refresh_token is still valid', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const futureExp = Math.floor(Date.now() / 1000) + 86400;

    Cookie.get.mockImplementation((key) => {
      if (key === 'access_token') return 'expired-access';
      if (key === 'refresh_token') return 'valid-refresh';
      return undefined;
    });

    jwtDecode.mockImplementation((token) => {
      if (token === 'expired-access') {
        return { user_id: 776, role: 'student', exp: pastExp };
      }
      if (token === 'valid-refresh') {
        return { user_id: 776, role: 'student', exp: futureExp };
      }
      return null;
    });

    const user = UserData();
    expect(user).toBeTruthy();
    expect(user.user_id).toBe(776);
    expect(Cookie.remove).not.toHaveBeenCalled();
  });
});

