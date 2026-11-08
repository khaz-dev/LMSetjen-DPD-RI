import { describe, it, expect } from 'vitest';
import {
  validateCurriculumTitle,
  validateCurriculumDescription,
  validateCurriculumImage,
  validateCurriculumCategory,
  validateCurriculumLevel,
  validateCurriculumIntroVideo,
  validateAllCurriculumFields,
  getCurriculumValidationClass,
  getCurriculumSelectValidationClass
} from '../utils/curriculumValidation';

describe('curriculumValidation', () => {
  describe('validateCurriculumTitle', () => {
    it('requires title', () => {
      expect(validateCurriculumTitle('')).toEqual({
        errors: ['Judul kursus diperlukan'],
        warnings: []
      });
      expect(validateCurriculumTitle(null)).toEqual({
        errors: ['Judul kursus diperlukan'],
        warnings: []
      });
    });

    it('warns on short (<10 chars) or long (>60 chars) title', () => {
      expect(validateCurriculumTitle('Short').warnings).toContain('Judul harus lebih deskriptif (minimal 10 karakter)');
      expect(validateCurriculumTitle('a'.repeat(65)).warnings).toContain(
        'Judul terlalu panjang. Pertahankan di bawah 60 karakter untuk tampilan yang lebih baik'
      );
    });

    it('errors on invalid characters', () => {
      expect(validateCurriculumTitle('Judul Kursus #1 <script>').errors).toContain(
        'Judul berisi karakter yang tidak valid'
      );
    });
  });

  describe('validateCurriculumDescription', () => {
    it('requires description', () => {
      expect(validateCurriculumDescription('').errors).toContain('Deskripsi kursus diperlukan');
      expect(validateCurriculumDescription(null).errors).toContain('Deskripsi kursus diperlukan');
    });

    it('warns on description shorter than 30 or longer than 1000 chars', () => {
      expect(validateCurriculumDescription('<p>Pendek</p>').warnings).toContain(
        'Deskripsi terlalu pendek. Tambahkan lebih banyak detail tentang kursus Anda'
      );
      expect(validateCurriculumDescription('x'.repeat(1005)).warnings).toContain(
        'Deskripsi cukup panjang. Pertimbangkan untuk membuatnya lebih ringkas'
      );
    });
  });

  describe('validateCurriculumImage, Category, Level, IntroVideo', () => {
    it('warns if image missing', () => {
      expect(validateCurriculumImage(null).warnings[0]).toContain('thumbnail kursus');
    });

    it('errors if category missing', () => {
      expect(validateCurriculumCategory(null).errors[0]).toContain('pilih kategori kursus');
    });

    it('warns if level missing', () => {
      expect(validateCurriculumLevel(null).warnings[0]).toContain('tingkat kesulitan');
    });

    it('warns if intro video missing', () => {
      expect(validateCurriculumIntroVideo(null).warnings[0]).toContain('Video pengantar');
    });
  });

  describe('validateAllCurriculumFields', () => {
    it('handles null/undefined gracefully', () => {
      const res = validateAllCurriculumFields(null);
      expect(res.hasErrors).toBe(true);
      expect(res.errors.title).toHaveLength(1);
      expect(res.errors.description).toHaveLength(1);
      expect(res.errors.category).toHaveLength(1);
    });

    it('validates a complete valid course data', () => {
      const res = validateAllCurriculumFields({
        title: 'Manajemen Proyek Digital dan Kepemimpinan',
        description: 'Membahas langkah demi langkah dalam mengeksekusi proyek digital secara terarah dan terukur.',
        image: 'thumb.png',
        category: 'it',
        level: 'Intermediate',
        file: 'https://youtube.com/watch?v=123'
      });
      expect(res.hasErrors).toBe(false);
      expect(res.errors.title).toHaveLength(0);
      expect(res.warnings.title).toHaveLength(0);
    });
  });

  describe('getCurriculumValidationClass and getCurriculumSelectValidationClass', () => {
    it('returns classes properly based on errors, warnings, and values', () => {
      expect(getCurriculumValidationClass('title', { title: ['Err'] }, {}, {})).toBe('form-control is-invalid');
      expect(getCurriculumValidationClass('title', {}, { title: ['Warn'] }, {})).toBe('form-control is-warning');
      expect(getCurriculumValidationClass('title', {}, {}, { title: 'ok' })).toBe('form-control is-valid');
      expect(getCurriculumValidationClass('title', null, null, {})).toBe('form-control');

      expect(getCurriculumSelectValidationClass('category', { category: ['Err'] }, {}, {})).toBe('form-select is-invalid');
    });
  });
});

