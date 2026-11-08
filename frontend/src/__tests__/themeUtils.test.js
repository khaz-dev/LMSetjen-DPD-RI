import { describe, it, expect, beforeEach } from 'vitest';
import { setTheme, THEMES } from '../utils/themeUtils';

describe('themeUtils', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  it('exposes theme constants', () => {
    expect(THEMES.ADMIN).toBe('admin');
    expect(THEMES.INSTRUCTOR).toBe('instructor');
    expect(THEMES.STUDENT).toBe('student');
  });

  it('sets instructor theme classes on document body', () => {
    setTheme('instructor');
    expect(document.body.classList.contains('instructor-theme')).toBe(true);
    expect(document.body.classList.contains('is-instructor-portal')).toBe(true);
    expect(document.body.classList.contains('student-theme')).toBe(false);
  });

  it('sets student theme classes on document body', () => {
    setTheme('student');
    expect(document.body.classList.contains('student-theme')).toBe(true);
    expect(document.body.classList.contains('is-student-portal')).toBe(true);
    expect(document.body.classList.contains('instructor-theme')).toBe(false);
  });

  it('removes themes for admin', () => {
    setTheme('student');
    setTheme('admin');
    expect(document.body.classList.contains('instructor-theme')).toBe(false);
    expect(document.body.classList.contains('student-theme')).toBe(false);
  });
});

