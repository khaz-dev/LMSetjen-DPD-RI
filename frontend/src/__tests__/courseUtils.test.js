import { describe, it, expect, vi } from 'vitest';
import {
  getImageUrl,
  getStatusBadgeStyle,
  getLevelBadgeStyle,
  getLevelText,
  getStatusText,
  getActualCourseStatus,
  handleDeleteCourse
} from '../utils/courseUtils';
import { DEFAULT_IMAGE_URL } from '../utils/constants';

describe('courseUtils', () => {
  describe('getImageUrl', () => {
    it('returns default image URL when input is empty or null', () => {
      expect(getImageUrl(null)).toBe(DEFAULT_IMAGE_URL);
      expect(getImageUrl('')).toBe(DEFAULT_IMAGE_URL);
      expect(getImageUrl(undefined)).toBe(DEFAULT_IMAGE_URL);
    });

    it('converts Google Drive URLs to high-quality thumbnail endpoint', () => {
      const gdrive = 'https://drive.google.com/file/d/DriveThumbnail123/view';
      expect(getImageUrl(gdrive)).toBe('https://drive.google.com/thumbnail?id=DriveThumbnail123&sz=w1200');
    });

    it('returns full http/https URLs directly', () => {
      const cdnUrl = 'https://images.unsplash.com/photo-12345';
      expect(getImageUrl(cdnUrl)).toBe(cdnUrl);
    });

    it('decodes encoded URLs properly', () => {
      const encoded = 'https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2FEncodedId456%2Fview';
      expect(getImageUrl(encoded)).toBe('https://drive.google.com/thumbnail?id=EncodedId456&sz=w1200');
    });

    it('preserves /media/ prefix on relative media paths', () => {
      const mediaPath = '/media/courses/thumb.png';
      expect(getImageUrl(mediaPath)).toContain('/media/courses/thumb.png');
    });
  });

  describe('getStatusBadgeStyle and getLevelBadgeStyle', () => {
    it('returns gradients for course status', () => {
      expect(getStatusBadgeStyle('Published')).toContain('#0d9488');
      expect(getStatusBadgeStyle('Draft')).toContain('#2dd4bf');
      expect(getStatusBadgeStyle('Review')).toContain('#14b8a6');
      expect(getStatusBadgeStyle('Disabled')).toContain('#115e59');
      expect(getStatusBadgeStyle('Unknown')).toContain('#0d9488');
    });

    it('returns gradients for course level', () => {
      expect(getLevelBadgeStyle('Beginner')).toContain('#2dd4bf');
      expect(getLevelBadgeStyle('Intermediate')).toContain('#0d9488');
      expect(getLevelBadgeStyle('Advanced')).toContain('#115e59');
      expect(getLevelBadgeStyle('All Levels')).toContain('#0ea5e9');
      expect(getLevelBadgeStyle('Unknown')).toContain('#0d9488');
    });
  });

  describe('getLevelText and getStatusText', () => {
    it('maps level keys to Indonesian formatted text', () => {
      expect(getLevelText('Beginner')).toBe('🟢 Pemula');
      expect(getLevelText('Intermediate')).toBe('🟡 Menengah');
      expect(getLevelText('Advanced')).toBe('🔴 Lanjutan');
      expect(getLevelText('All Levels')).toBe('🔵 Semua Level');
      expect(getLevelText('unknown')).toBe('N/A');
    });

    it('maps status keys to Indonesian text', () => {
      expect(getStatusText('Draft')).toBe('Draf');
      expect(getStatusText('Published')).toBe('Dipublikasikan');
      expect(getStatusText('Disabled')).toBe('Dinonaktifkan');
      expect(getStatusText('Review')).toBe('Ditinjau');
      expect(getStatusText('invalid')).toBe('Tidak Tersedia');
    });
  });

  describe('getActualCourseStatus', () => {
    it('handles null or undefined course safely', () => {
      const res = getActualCourseStatus(null);
      expect(res.status).toBe('Unknown');
      expect(res.text).toBe('Tidak Tersedia');
    });

    it('prioritizes rejection reason', () => {
      const course = {
        rejection_reason: 'Foto sampul melanggar hak cipta',
        platform_status: 'Published',
        teacher_course_status: 'Published'
      };
      const res = getActualCourseStatus(course);
      expect(res.status).toBe('Rejected');
      expect(res.text).toBe('Ditolak');
    });

    it('detects Review status', () => {
      const course = {
        platform_status: 'Review'
      };
      expect(getActualCourseStatus(course).status).toBe('Review');
      expect(getActualCourseStatus(course).text).toBe('Menunggu Review');
    });

    it('detects Draft status', () => {
      const course = {
        teacher_course_status: 'Draft'
      };
      expect(getActualCourseStatus(course).status).toBe('Draft');
      expect(getActualCourseStatus(course).text).toBe('Draf');
    });

    it('detects Published status', () => {
      const course = {
        platform_status: 'Published'
      };
      expect(getActualCourseStatus(course).status).toBe('Published');
      expect(getActualCourseStatus(course).text).toBe('Dipublikasikan');
    });
  });
});

