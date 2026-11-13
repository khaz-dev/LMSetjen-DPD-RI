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
  getUnassignedActiveQuizzes
} from '../utils/courseEditValidation';

describe('courseEditValidation', () => {
  describe('validateTitle', () => {
    it('handles empty or missing title', () => {
      expect(validateTitle('')).toEqual({
        errors: ['Course title is required'],
        warnings: []
      });
      expect(validateTitle(null)).toEqual({
        errors: ['Course title is required'],
        warnings: []
      });
    });

    it('warns for short title and errors for long title', () => {
      expect(validateTitle('Short').warnings).toContain('Title is too short. Consider adding more descriptive words');
      expect(validateTitle('a'.repeat(101)).errors).toContain('Title is too long. Maximum 100 characters allowed');
    });

    it('validates special character constraints', () => {
      expect(validateTitle('Valid Title - 2026: Edition!').errors).toHaveLength(0);
      expect(validateTitle('Invalid Title <script>').errors).toContain('Title contains invalid characters');
    });
  });

  describe('validateDescription', () => {
    it('handles missing description', () => {
      expect(validateDescription('').errors).toContain('Course description is required');
      expect(validateDescription(null).errors).toContain('Course description is required');
    });

    it('warns when description is under 50 chars or over 2000 chars', () => {
      expect(validateDescription('<p>Under 50 chars</p>').warnings).toContain(
        'Description is too short. Add more details about your course'
      );
      expect(validateDescription('x'.repeat(2005)).warnings).toContain(
        'Description is very long. Consider making it more concise'
      );
    });

    it('passes for valid description', () => {
      const valid = 'This is a comprehensive description of the advanced training course for professionals.';
      const res = validateDescription(valid);
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });
  });

  describe('validateImage, validateCategory, validateLevel', () => {
    it('warns if image is not provided', () => {
      expect(validateImage(null).warnings[0]).toContain('thumbnail');
      expect(validateImage('image.png').warnings).toHaveLength(0);
    });

    it('errors if category is missing', () => {
      expect(validateCategory(null).errors[0]).toContain('category');
      expect(validateCategory('tech').errors).toHaveLength(0);
    });

    it('warns if level is missing', () => {
      expect(validateLevel(null).warnings[0]).toContain('difficulty level');
      expect(validateLevel('Beginner').warnings).toHaveLength(0);
    });
  });

  describe('validateAllFields', () => {
    it('handles null/undefined course data safely', () => {
      const res = validateAllFields(null);
      expect(res.errorFields).toContain('title');
      expect(res.errorFields).toContain('description');
      expect(res.errorFields).toContain('category');
    });

    it('handles object category (e.g. { id: 5 }) correctly', () => {
      const res = validateAllFields({
        title: 'Mastering Fullstack Engineering',
        description: 'Complete hands-on curriculum covering modern frontend and backend development paradigms.',
        category: { id: 10 },
        image: 'thumb.jpg',
        level: 'Advanced'
      });
      expect(res.errorFields).toEqual([]);
    });
  });

  describe('getValidationClass and getSelectValidationClass', () => {
    it('returns proper bootstrap classes', () => {
      expect(getValidationClass('title', { title: ['Err'] }, {}, 'val')).toBe('form-control is-invalid');
      expect(getValidationClass('title', {}, { title: ['Warn'] }, 'val')).toBe('form-control is-warning');
      expect(getValidationClass('title', {}, {}, 'val')).toBe('form-control is-valid');
      expect(getValidationClass('title', {}, {}, '')).toBe('form-control');

      expect(getSelectValidationClass('cat', { cat: ['Err'] }, {}, 'val')).toBe('form-select is-invalid');
      expect(getSelectValidationClass('cat', null, null, 'val')).toBe('form-select is-valid');
    });
  });

  describe('getUnassignedActiveQuizzes', () => {
    it('returns empty array when courseData is null or has no quizzes', () => {
      expect(getUnassignedActiveQuizzes(null)).toEqual([]);
      expect(getUnassignedActiveQuizzes({})).toEqual([]);
      expect(getUnassignedActiveQuizzes({ quizzes: [] })).toEqual([]);
    });

    it('identifies unassigned active regular quizzes', () => {
      const courseData = {
        quizzes: [
          { id: 1, quiz_id: '150640', title: 'Quiz 1', quiz_type: 'quiz', is_active: true },
          { id: 2, quiz_id: '217846', title: 'Pre/Post Test', quiz_type: 'pre_post_test', is_active: true }
        ],
        curriculum: [
          {
            title: 'Section 1',
            variant_items: [
              { title: 'Lesson 1', item_type: 'lesson' }
            ]
          }
        ]
      };

      const unassigned = getUnassignedActiveQuizzes(courseData);
      expect(unassigned).toHaveLength(1);
      expect(unassigned[0].quiz_id).toBe('150640');
      // Pre/Post-test is excluded
    });

    it('returns empty when all active regular quizzes are embedded in curriculum', () => {
      const courseData = {
        quizzes: [
          { id: 1, quiz_id: '150640', title: 'Quiz 1', quiz_type: 'quiz', is_active: true },
          { id: 2, quiz_id: '217846', title: 'Pre/Post Test', quiz_type: 'pre_post_test', is_active: true }
        ],
        curriculum: [
          {
            title: 'Section 1',
            items: [
              { title: 'Lesson 1', item_type: 'lesson' },
              { title: 'Quiz 1', item_type: 'quiz', quiz_id: '150640' }
            ]
          }
        ]
      };

      const unassigned = getUnassignedActiveQuizzes(courseData);
      expect(unassigned).toHaveLength(0);
    });

    it('ignores inactive regular quizzes', () => {
      const courseData = {
        quizzes: [
          { id: 1, quiz_id: '150640', title: 'Quiz 1', quiz_type: 'quiz', is_active: false },
          { id: 2, quiz_id: '217846', title: 'Pre/Post Test', quiz_type: 'pre_post_test', is_active: true }
        ],
        curriculum: [
          {
            title: 'Section 1',
            variant_items: [
              { title: 'Lesson 1', item_type: 'lesson' }
            ]
          }
        ]
      };

      const unassigned = getUnassignedActiveQuizzes(courseData);
      expect(unassigned).toHaveLength(0);
    });

    it('handles nested quiz objects in variant_items', () => {
      const courseData = {
        quizzes: [
          { id: 10, quiz_id: 'q-10', title: 'Quiz 10', quiz_type: 'quiz', is_active: true }
        ],
        curriculum: [
          {
            variant_items: [
              { title: 'Item 1', quiz: { quiz_id: 'q-10', id: 10 } }
            ]
          }
        ]
      };

      expect(getUnassignedActiveQuizzes(courseData)).toHaveLength(0);
    });
  });
});

