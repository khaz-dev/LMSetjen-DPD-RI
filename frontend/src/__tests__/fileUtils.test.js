import { describe, it, expect } from 'vitest';
import { getImageUrl, getVideoUrl, DEFAULT_IMAGE_URL } from '../utils/fileUtils';

describe('fileUtils', () => {
  it('returns default image URL when imageUrl is missing', () => {
    expect(getImageUrl(null)).toBe(DEFAULT_IMAGE_URL);
    expect(getImageUrl('')).toBe(DEFAULT_IMAGE_URL);
    expect(getImageUrl(undefined)).toBe(DEFAULT_IMAGE_URL);
  });

  it('returns given image URL as-is when present', () => {
    const url = 'https://example.com/custom-image.png';
    expect(getImageUrl(url)).toBe(url);
  });

  it('handles video URL returning empty string for falsy input or unchanged URL', () => {
    expect(getVideoUrl(null)).toBe('');
    expect(getVideoUrl('')).toBe('');
    expect(getVideoUrl('https://youtube.com/embed/123')).toBe('https://youtube.com/embed/123');
  });
});

