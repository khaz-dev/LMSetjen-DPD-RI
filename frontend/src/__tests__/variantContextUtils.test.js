import { describe, it, expect } from 'vitest';
import {
  findVariantContext,
  getVariantContextData,
  getBagianList,
  getPelajaranList,
  formatVariantContextDisplay
} from '../utils/variantContextUtils';

describe('variantContextUtils', () => {
  const mockCurriculum = [
    {
      id: 1,
      variant_id: 'var_1',
      title: 'Bagian 1: Pengantar',
      variant_items: [
        { variant_item_id: 'item_1', title: 'Pelajaran 1.1' },
        { variant_item_id: 'item_2', title: 'Pelajaran 1.2' }
      ]
    },
    {
      id: 2,
      variant_id: 'var_2',
      title: 'Bagian 2: Implementasi',
      variant_items: [
        { variant_item_id: 'item_3', title: 'Pelajaran 2.1' }
      ]
    }
  ];

  describe('findVariantContext', () => {
    it('returns null for missing parameters or non-array curriculum', () => {
      expect(findVariantContext(null, mockCurriculum)).toBe(null);
      expect(findVariantContext({ variant_item_id: 'item_1' }, null)).toBe(null);
      expect(findVariantContext({ variant_item_id: 'item_1' }, 'not-an-array')).toBe(null);
    });

    it('locates the correct parent variant for an item', () => {
      const found = findVariantContext({ variant_item_id: 'item_2' }, mockCurriculum);
      expect(found).not.toBe(null);
      expect(found.title).toBe('Bagian 1: Pengantar');

      const found2 = findVariantContext({ variant_item_id: 'item_3' }, mockCurriculum);
      expect(found2.title).toBe('Bagian 2: Implementasi');
    });

    it('returns null when item is not in curriculum', () => {
      expect(findVariantContext({ variant_item_id: 'non_existent' }, mockCurriculum)).toBe(null);
    });
  });

  describe('getVariantContextData', () => {
    it('returns empty object if item or course.curriculum is missing', () => {
      expect(getVariantContextData(null, { curriculum: mockCurriculum })).toEqual({});
      expect(getVariantContextData({ variant_item_id: 'item_1' }, null)).toEqual({});
      expect(getVariantContextData({ variant_item_id: 'item_1' }, {})).toEqual({});
    });

    it('returns variant and variantItem when found', () => {
      const item = { variant_item_id: 'item_1' };
      const res = getVariantContextData(item, { curriculum: mockCurriculum });
      expect(res.variant.title).toBe('Bagian 1: Pengantar');
      expect(res.variantItem).toBe(item);
    });
  });

  describe('getBagianList and getPelajaranList', () => {
    it('extracts bagian list safely', () => {
      expect(getBagianList(null)).toEqual([]);
      expect(getBagianList('invalid')).toEqual([]);
      const list = getBagianList(mockCurriculum);
      expect(list).toHaveLength(2);
      expect(list[0].title).toBe('Bagian 1: Pengantar');
    });

    it('extracts pelajaran list safely', () => {
      expect(getPelajaranList(null)).toEqual([]);
      expect(getPelajaranList({})).toEqual([]);
      const items = getPelajaranList(mockCurriculum[0]);
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Pelajaran 1.1');
    });
  });

  describe('formatVariantContextDisplay', () => {
    it('formats title as "Bagian - Pelajaran"', () => {
      const variant = { title: 'Bagian 1' };
      const item = { title: 'Materi Dasar' };
      expect(formatVariantContextDisplay(variant, item)).toBe('Bagian 1 - Materi Dasar');
    });

    it('falls back if variantContext is missing', () => {
      expect(formatVariantContextDisplay(null, { title: 'Materi Dasar' })).toBe('Materi Dasar');
      expect(formatVariantContextDisplay(null, null)).toBe('Lesson');
    });
  });
});

