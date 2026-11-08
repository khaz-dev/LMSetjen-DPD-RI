import { describe, it, expect } from 'vitest';
import {
  validateTitle,
  validateDescription,
  validateImage,
  validateCategory,
  validateLevel,
  validateAllFields,
  getValidationClass,
  getSelectValidationClass,
  courseValidationRules
} from '../utils/courseValidation';

describe('courseValidation', () => {
  describe('validateTitle', () => {
    it('returns error when title is empty, null, or undefined', () => {
      expect(validateTitle('')).toEqual({
        errors: ['Judul kursus diperlukan'],
        warnings: []
      });
      expect(validateTitle(null)).toEqual({
        errors: ['Judul kursus diperlukan'],
        warnings: []
      });
      expect(validateTitle(undefined)).toEqual({
        errors: ['Judul kursus diperlukan'],
        warnings: []
      });
      expect(validateTitle('   ')).toEqual({
        errors: ['Judul kursus diperlukan'],
        warnings: []
      });
    });

    it('returns warning when title is shorter than minLength (10 chars)', () => {
      const res = validateTitle('Short');
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toContain('Judul terlalu pendek. Pertimbangkan untuk menambahkan kata-kata yang lebih deskriptif');
    });

    it('returns error when title exceeds maxLength (100 chars)', () => {
      const longTitle = 'a'.repeat(101);
      const res = validateTitle(longTitle);
      expect(res.errors[0]).toContain('Judul terlalu panjang');
    });

    it('returns error when title contains invalid characters', () => {
      const res = validateTitle('Valid Title with <script>');
      expect(res.errors).toContain('Judul berisi karakter yang tidak valid');
    });

    it('passes for a valid course title', () => {
      const res = validateTitle('Pengenalan Dasar Python dan Data Science (2026)');
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });
  });

  describe('validateDescription', () => {
    it('returns error for empty or stripped HTML description', () => {
      expect(validateDescription('').errors).toContain('Deskripsi kursus diperlukan');
      expect(validateDescription('<p>   </p>').errors).toContain('Deskripsi kursus diperlukan');
      expect(validateDescription(null).errors).toContain('Deskripsi kursus diperlukan');
    });

    it('warns when description is too short (< 50 chars)', () => {
      const res = validateDescription('<p>Ini deskripsi singkat</p>');
      expect(res.errors).toHaveLength(0);
      expect(res.warnings[0]).toContain('Deskripsi terlalu pendek');
    });

    it('warns when description is too long (> 2000 chars)', () => {
      const longDesc = 'A'.repeat(2005);
      const res = validateDescription(longDesc);
      expect(res.warnings[0]).toContain('Deskripsi sangat panjang');
    });

    it('passes for a well-formed description', () => {
      const desc = '<p>Kursus ini dirancang untuk memberikan pemahaman menyeluruh tentang tata kelola pemerintahan dan sistem informasi.</p>';
      const res = validateDescription(desc);
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });
  });

  describe('validateImage, validateCategory, validateLevel', () => {
    it('validates image thumbnail presence with warning if missing', () => {
      expect(validateImage(null).warnings[0]).toContain('thumbnail');
      expect(validateImage('https://example.com/thumb.jpg').warnings).toHaveLength(0);
    });

    it('validates category requirement', () => {
      expect(validateCategory(null).errors[0]).toContain('pilih kategori');
      expect(validateCategory('').errors[0]).toContain('pilih kategori');
      expect(validateCategory('tech').errors).toHaveLength(0);
    });

    it('validates level with warning if missing', () => {
      expect(validateLevel(null).warnings[0]).toContain('tingkat kesulitan');
      expect(validateLevel('Beginner').warnings).toHaveLength(0);
    });
  });

  describe('validateAllFields', () => {
    it('handles undefined or empty course data safely', () => {
      const res = validateAllFields();
      expect(res.errorFields).toContain('title');
      expect(res.errorFields).toContain('description');
      expect(res.errorFields).toContain('category');
    });

    it('identifies errors and warnings correctly for full object', () => {
      const validData = {
        title: 'Kursus Kepemimpinan dan Manajemen Modern',
        description: '<p>Penjelasan komprehensif mengenai strategi kepemimpinan di era digital secara mendalam dan terstruktur.</p>',
        category: '1',
        image: 'https://example.com/banner.png',
        level: 'Intermediate'
      };
      const res = validateAllFields(validData);
      expect(res.errorFields).toEqual([]);
      expect(res.allErrors.title).toHaveLength(0);
      expect(res.allWarnings.title).toHaveLength(0);
    });
  });

  describe('getValidationClass and getSelectValidationClass', () => {
    it('returns is-invalid class when errors exist for the field', () => {
      const cls = getValidationClass('title', { title: ['Error'] }, {}, 'Some value');
      expect(cls).toBe('form-control-modern is-invalid');
    });

    it('returns is-warning class when warnings exist without errors', () => {
      const cls = getValidationClass('title', { title: [] }, { title: ['Warning'] }, 'Some value');
      expect(cls).toBe('form-control-modern is-warning');
    });

    it('returns is-valid when value exists without errors or warnings', () => {
      const cls = getValidationClass('title', {}, {}, 'Valid Title');
      expect(cls).toBe('form-control-modern is-valid');
    });

    it('handles null errors/warnings gracefully', () => {
      expect(getValidationClass('title', null, null, '')).toBe('form-control-modern');
      expect(getSelectValidationClass('category', null, null, 'val')).toBe('form-control-modern is-valid');
    });
  });
});

