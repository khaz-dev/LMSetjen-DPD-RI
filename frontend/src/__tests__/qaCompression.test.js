import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  getFileExtension,
  isImageFile,
  isPdfFile,
  validateQAFile,
  MAX_QA_FILE_SIZE,
  ALLOWED_QA_EXTENSIONS
} from '../utils/qaCompression';

describe('qaCompression', () => {
  describe('formatFileSize', () => {
    it('formats bytes correctly to B, KB, MB, GB, TB', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(-10)).toBe('0 B');
      expect(formatFileSize(null)).toBe('0 B');
      expect(formatFileSize(undefined)).toBe('0 B');
      expect(formatFileSize('not a number')).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
    });
  });

  describe('getFileExtension', () => {
    it('extracts lowercased file extensions without query params or hashes', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileExtension(null)).toBe('');
      expect(getFileExtension('file_without_ext')).toBe('');
      expect(getFileExtension('image.PNG')).toBe('.png');
      expect(getFileExtension('document.PDF?download=1#section')).toBe('.pdf');
      expect(getFileExtension('archive.tar.gz')).toBe('.gz');
    });
  });

  describe('isImageFile and isPdfFile', () => {
    it('detects supported image formats', () => {
      expect(isImageFile('avatar.png')).toBe(true);
      expect(isImageFile('photo.jpg')).toBe(true);
      expect(isImageFile('picture.jpeg')).toBe(true);
      expect(isImageFile('graphic.webp')).toBe(true);
      expect(isImageFile('animation.gif')).toBe(true);
      expect(isImageFile('bitmap.bmp')).toBe(true);
      expect(isImageFile('report.pdf')).toBe(false);
      expect(isImageFile('')).toBe(false);
    });

    it('detects pdf files', () => {
      expect(isPdfFile('document.pdf')).toBe(true);
      expect(isPdfFile('DOCUMENT.PDF')).toBe(true);
      expect(isPdfFile('image.png')).toBe(false);
      expect(isPdfFile(null)).toBe(false);
    });
  });

  describe('validateQAFile', () => {
    it('returns error if file is missing', () => {
      const res = validateQAFile(null);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('File tidak ditemukan.');
    });

    it('rejects unsupported extensions', () => {
      const file = { name: 'script.exe', size: 1000 };
      const res = validateQAFile(file);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('tidak didukung');
    });

    it('rejects files larger than MAX_QA_FILE_SIZE (5 MB)', () => {
      const file = { name: 'large_photo.png', size: MAX_QA_FILE_SIZE + 1024 };
      const res = validateQAFile(file);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('melebihi batas maksimal 5 MB');
    });

    it('accepts valid files within size limit', () => {
      const validImage = { name: 'diagram.png', size: 1024 * 1024 };
      expect(validateQAFile(validImage).valid).toBe(true);

      const validPdf = { name: 'handout.pdf', size: 3 * 1024 * 1024 };
      expect(validateQAFile(validPdf).valid).toBe(true);
    });
  });
});

