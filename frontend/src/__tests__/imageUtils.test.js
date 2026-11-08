import { describe, it, expect } from 'vitest';
import {
  isValidImageUrl,
  getSafeImageUrl,
  getFirstValidImageUrl,
  getImageUrl,
  getFallbackIcon,
  getValidProfileImageUrl,
  FALLBACK_ICONS,
  INVALID_PLACEHOLDERS
} from '../utils/imageUtils';

describe('imageUtils', () => {
  describe('isValidImageUrl', () => {
    it('rejects invalid or non-string inputs', () => {
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl(undefined)).toBe(false);
      expect(isValidImageUrl(123)).toBe(false);
      expect(isValidImageUrl('')).toBe(false);
    });

    it('rejects common invalid placeholder filenames', () => {
      INVALID_PLACEHOLDERS.forEach(placeholder => {
        expect(isValidImageUrl(placeholder)).toBe(false);
      });
    });

    it('accepts valid http, https, media, static, images, and data URLs', () => {
      expect(isValidImageUrl('https://example.com/photo.jpg')).toBe(true);
      expect(isValidImageUrl('http://example.com/photo.jpg')).toBe(true);
      expect(isValidImageUrl('/media/user_folder/avatar.png')).toBe(true);
      expect(isValidImageUrl('/static/img/logo.svg')).toBe(true);
      expect(isValidImageUrl('/images/placeholders/default-course.svg')).toBe(true);
      expect(isValidImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    });
  });

  describe('getSafeImageUrl and getFirstValidImageUrl', () => {
    it('returns valid URLs and null for invalid ones', () => {
      expect(getSafeImageUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
      expect(getSafeImageUrl('invalid-url')).toBe(null);
      expect(getSafeImageUrl(null)).toBe(null);
    });

    it('picks the first valid URL from multiple alternatives', () => {
      const firstValid = getFirstValidImageUrl('default.jpg', null, 'https://example.com/avatar.jpg', '/media/backup.jpg');
      expect(firstValid).toBe('https://example.com/avatar.jpg');

      expect(getFirstValidImageUrl(null, 'default.jpg')).toBe(null);
    });
  });

  describe('getImageUrl', () => {
    it('returns null for empty or non-string imagePath', () => {
      expect(getImageUrl(null)).toBe(null);
      expect(getImageUrl('')).toBe(null);
      expect(getImageUrl(123)).toBe(null);
    });

    it('returns full URLs directly if safe', () => {
      const fullUrl = 'https://cdn.example.com/image.png';
      expect(getImageUrl(fullUrl)).toBe(fullUrl);
    });

    it('returns data URLs directly', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
      expect(getImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('prepends base URL for relative paths', () => {
      const url = getImageUrl('courses/banner.jpg', 'http://127.0.0.1:8001/media');
      expect(url).toBe('http://127.0.0.1:8001/media/courses/banner.jpg');
    });
  });

  describe('getFallbackIcon', () => {
    it('returns appropriate icon class for each entity type', () => {
      expect(getFallbackIcon('user')).toBe(FALLBACK_ICONS.user);
      expect(getFallbackIcon('instructor')).toBe(FALLBACK_ICONS.instructor);
      expect(getFallbackIcon('student')).toBe(FALLBACK_ICONS.student);
      expect(getFallbackIcon('course')).toBe(FALLBACK_ICONS.course);
      expect(getFallbackIcon('unknown')).toBe(FALLBACK_ICONS.default);
      expect(getFallbackIcon()).toBe(FALLBACK_ICONS.default);
    });
  });

  describe('getValidProfileImageUrl', () => {
    it('returns fallback for null, undefined or non-string', () => {
      expect(getValidProfileImageUrl(null)).toBe('');
      expect(getValidProfileImageUrl(undefined, '/fallback.png')).toBe('/fallback.png');
      expect(getValidProfileImageUrl(12345, '/fallback.png')).toBe('/fallback.png');
      expect(getValidProfileImageUrl('   ', '/fallback.png')).toBe('/fallback.png');
    });

    it('returns fallback for invalid placeholders and default media avatars', () => {
      expect(getValidProfileImageUrl('default-user.jpg', '/fallback.png')).toBe('/fallback.png');
      expect(getValidProfileImageUrl('/media/default-user.jpg', '/fallback.png')).toBe('/fallback.png');
      expect(getValidProfileImageUrl('media/default-user.jpg', '/fallback.png')).toBe('/fallback.png');
    });

    it('returns actual valid image URL', () => {
      expect(getValidProfileImageUrl('https://example.com/profile.jpg')).toBe('https://example.com/profile.jpg');
      expect(getValidProfileImageUrl('/media/profile_photos/user1.png')).toBe('/media/profile_photos/user1.png');
    });
  });
});

