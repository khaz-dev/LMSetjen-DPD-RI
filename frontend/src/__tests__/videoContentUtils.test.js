import { describe, it, expect } from 'vitest';
import {
  isVideoFile,
  extractGoogleDriveFileId,
  isVideoContent,
  getVideoUrl,
  getFileTypeIcon,
  getFileTypeLabel,
  getFileTypeTitle
} from '../utils/videoContentUtils';

describe('videoContentUtils', () => {
  describe('isVideoFile', () => {
    it('returns false for non-string, null or undefined input', () => {
      expect(isVideoFile(null)).toBe(false);
      expect(isVideoFile(undefined)).toBe(false);
      expect(isVideoFile(12345)).toBe(false);
      expect(isVideoFile('')).toBe(false);
    });

    it('identifies valid video extensions', () => {
      expect(isVideoFile('https://example.com/video.mp4')).toBe(true);
      expect(isVideoFile('https://example.com/movie.mkv?token=abc')).toBe(true);
      expect(isVideoFile('lecture.webm')).toBe(true);
      expect(isVideoFile('presentation.avi')).toBe(true);
      expect(isVideoFile('clip.mov')).toBe(true);
      expect(isVideoFile('sound.ogg')).toBe(true);
    });

    it('returns false for non-video files', () => {
      expect(isVideoFile('document.pdf')).toBe(false);
      expect(isVideoFile('slide.pptx')).toBe(false);
      expect(isVideoFile('image.png')).toBe(false);
    });
  });

  describe('extractGoogleDriveFileId', () => {
    it('handles null, undefined or empty input', () => {
      expect(extractGoogleDriveFileId(null)).toBe(null);
      expect(extractGoogleDriveFileId('')).toBe(null);
      expect(extractGoogleDriveFileId(123)).toBe(null);
    });

    it('extracts file ID from standard /file/d/ URLs', () => {
      expect(extractGoogleDriveFileId('https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i_0j/view')).toBe('1a2B3c4D5e6F7g8H9i_0j');
      expect(extractGoogleDriveFileId('https://drive.google.com/file/d/MyFileId-123/preview')).toBe('MyFileId-123');
      expect(extractGoogleDriveFileId('https://drive.google.com/file/d/TestID/edit')).toBe('TestID');
    });

    it('extracts file ID from open?id= and uc?id= and query parameter URLs', () => {
      expect(extractGoogleDriveFileId('https://drive.google.com/open?id=DriveId_1234')).toBe('DriveId_1234');
      expect(extractGoogleDriveFileId('https://drive.google.com/uc?id=UcId_5678')).toBe('UcId_5678');
      expect(extractGoogleDriveFileId('https://drive.google.com/uc?export=download&id=StreamId_999')).toBe('StreamId_999');
      expect(extractGoogleDriveFileId('https://drive.google.com/thumbnail?id=ThumbId_111&sz=w1200')).toBe('ThumbId_111');
    });

    it('extracts file ID from docs.google.com URLs', () => {
      expect(extractGoogleDriveFileId('https://docs.google.com/presentation/d/PresentationId123')).toBe('PresentationId123');
      expect(extractGoogleDriveFileId('https://docs.google.com/spreadsheets/d/SheetId456')).toBe('SheetId456');
      expect(extractGoogleDriveFileId('https://docs.google.com/document/d/DocId789')).toBe('DocId789');
    });
  });

  describe('isVideoContent', () => {
    it('returns false for null or empty variantItem', () => {
      expect(isVideoContent(null)).toBe(false);
      expect(isVideoContent({})).toBe(false);
    });

    it('detects video files in variantItem', () => {
      expect(isVideoContent({ file: 'lecture.mp4' })).toBe(true);
    });

    it('detects Google Drive and YouTube links', () => {
      expect(isVideoContent({ file: 'https://drive.google.com/file/d/123/view' })).toBe(true);
      expect(isVideoContent({ file: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe(true);
      expect(isVideoContent({ file: 'https://youtu.be/dQw4w9WgXcQ' })).toBe(true);
    });

    it('returns false for pdf or text files', () => {
      expect(isVideoContent({ file: 'slides.pdf' })).toBe(false);
    });
  });

  describe('getVideoUrl', () => {
    it('returns null for empty variantItem or non-video', () => {
      expect(getVideoUrl(null)).toBe(null);
      expect(getVideoUrl({})).toBe(null);
      expect(getVideoUrl({ file: 'notes.pdf' })).toBe(null);
    });

    it('handles direct video file URL', () => {
      expect(getVideoUrl({ file: 'https://cdn.example.com/video.mp4' })).toBe('https://cdn.example.com/video.mp4');
    });

    it('converts Google Drive video links to direct streaming URL', () => {
      const url = getVideoUrl({ file: 'https://drive.google.com/file/d/VideoId123/view' });
      expect(url).toBe('https://drive.google.com/uc?export=download&id=VideoId123');
    });

    it('returns YouTube URLs as-is', () => {
      const yt = 'https://www.youtube.com/watch?v=123';
      expect(getVideoUrl({ file: yt })).toBe(yt);
    });
  });

  describe('getFileTypeIcon, getFileTypeLabel, getFileTypeTitle', () => {
    it('returns proper icon, label and title for videos', () => {
      expect(getFileTypeIcon('clip.mp4')).toBe('fas fa-play');
      expect(getFileTypeLabel('clip.mp4')).toBe('Video');
      expect(getFileTypeTitle('clip.mp4')).toBe('Putar video');
    });

    it('returns proper icon and label for documents and audio', () => {
      expect(getFileTypeIcon('doc.pdf')).toBe('fas fa-file-pdf');
      expect(getFileTypeLabel('doc.pdf')).toBe('PDF');
      expect(getFileTypeTitle('doc.pdf')).toBe('Buka pdf');

      expect(getFileTypeIcon('song.mp3')).toBe('fas fa-headphones');
      expect(getFileTypeLabel('song.mp3')).toBe('Audio');

      expect(getFileTypeIcon('photo.png')).toBe('fas fa-image');
      expect(getFileTypeLabel('photo.png')).toBe('Gambar');
    });

    it('handles non-string or unknown extensions gracefully', () => {
      expect(getFileTypeIcon(null)).toBe('fas fa-file');
      expect(getFileTypeLabel(undefined)).toBe('File');
      expect(getFileTypeTitle(null)).toBe('Buka file');
    });
  });
});

