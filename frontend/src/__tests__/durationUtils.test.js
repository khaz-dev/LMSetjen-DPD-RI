import { describe, it, expect } from 'vitest';
import {
  parseDurationToSeconds,
  formatDuration,
  calculateTotalDuration,
  formatDurationStyle,
  compareDurations,
  exceedsThreshold,
  secondsToJP,
  formatDurationWithJP,
  getDurationStats
} from '../utils/durationUtils';

describe('durationUtils', () => {
  describe('parseDurationToSeconds', () => {
    it('returns 0 for empty or invalid inputs', () => {
      expect(parseDurationToSeconds(null)).toBe(0);
      expect(parseDurationToSeconds(undefined)).toBe(0);
      expect(parseDurationToSeconds('')).toBe(0);
      expect(parseDurationToSeconds('0')).toBe(0);
      expect(parseDurationToSeconds('0s')).toBe(0);
      expect(parseDurationToSeconds('0m 0s')).toBe(0);
      expect(parseDurationToSeconds(-10)).toBe(0);
      expect(parseDurationToSeconds(NaN)).toBe(0);
    });

    it('returns rounded number when passed a number', () => {
      expect(parseDurationToSeconds(120.4)).toBe(120);
      expect(parseDurationToSeconds(45)).toBe(45);
    });

    it('parses clock formats (HH:MM:SS and MM:SS)', () => {
      expect(parseDurationToSeconds('01:30')).toBe(90);
      expect(parseDurationToSeconds('01:15:30')).toBe(4530);
      expect(parseDurationToSeconds('2:00:00')).toBe(7200);
    });

    it('parses human-readable english strings', () => {
      expect(parseDurationToSeconds('1h 30m 15s')).toBe(5415);
      expect(parseDurationToSeconds('45m')).toBe(2700);
      expect(parseDurationToSeconds('2 hours')).toBe(7200);
      expect(parseDurationToSeconds('15 mins 30 secs')).toBe(930);
    });

    it('parses Indonesian strings', () => {
      expect(parseDurationToSeconds('2 jam 15 menit 30 detik')).toBe(8130);
      expect(parseDurationToSeconds('10 menit')).toBe(600);
      expect(parseDurationToSeconds('45 detik')).toBe(45);
    });
  });

  describe('formatDuration', () => {
    it('returns default for 0 or negative numbers', () => {
      expect(formatDuration(0)).toBe('0m 0s');
      expect(formatDuration(-5)).toBe('0m 0s');
      expect(formatDuration(null)).toBe('0m 0s');
    });

    it('formats seconds, minutes and hours', () => {
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(90)).toBe('1m 30s');
      // For durations >= 1 hour, default omits seconds unless showSeconds is specified
      expect(formatDuration(3665)).toBe('1h 1m');
      expect(formatDuration(3665, { showSeconds: true })).toBe('1h 1m 5s');
    });

    it('supports compact format', () => {
      expect(formatDuration(3600, { compact: true })).toBe('1h');
      expect(formatDuration(3660, { compact: true })).toBe('1h 1m');
      expect(formatDuration(120, { compact: true })).toBe('2m');
      expect(formatDuration(125, { compact: true, showSeconds: true })).toBe('2m 5s');
      expect(formatDuration(40, { compact: true })).toBe('40s');
    });
  });

  describe('calculateTotalDuration', () => {
    it('handles empty or non-array inputs gracefully', () => {
      expect(calculateTotalDuration(null)).toEqual({
        formatted: '0m 0s',
        withJP: '0m 0s (0JP)'
      });
      expect(calculateTotalDuration([])).toEqual({
        formatted: '0m 0s',
        withJP: '0m 0s (0JP)'
      });
    });

    it('calculates total correctly from items with content_duration strings', () => {
      const items = [
        { content_duration: '10m' },
        { content_duration: '20m 30s' },
        null,
        { content_duration: '0s' }
      ];
      const result = calculateTotalDuration(items);
      expect(result.formatted).toBe('30m 30s');
      expect(result.withJP).toBe('30m 30s (1JP)');
    });

    it('handles items with numeric duration_seconds', () => {
      const items = [
        { duration_seconds: 120 },
        { duration_seconds: 180 }
      ];
      const result = calculateTotalDuration(items);
      expect(result.formatted).toBe('5m 0s');
    });
  });

  describe('formatDurationStyle', () => {
    it('formats as clock style', () => {
      expect(formatDurationStyle('1h 23m 45s', 'clock')).toBe('01:23:45');
      expect(formatDurationStyle('5m 30s', 'clock')).toBe('05:30');
    });

    it('formats as long style', () => {
      expect(formatDurationStyle('1h 1m 1s', 'long')).toBe('1 hour, 1 minute, 1 second');
      expect(formatDurationStyle('2h 15m 30s', 'long')).toBe('2 hours, 15 minutes, 30 seconds');
    });

    it('formats as medium style', () => {
      expect(formatDurationStyle('2h 15m 30s', 'medium')).toBe('2h 15min 30sec');
    });

    it('defaults to short style', () => {
      expect(formatDurationStyle('2h 15m 30s')).toBe('2h 15m');
    });
  });

  describe('compareDurations and exceedsThreshold', () => {
    it('compares two duration strings accurately', () => {
      expect(compareDurations('10m', '20m')).toBe(-1);
      expect(compareDurations('20m', '10m')).toBe(1);
      expect(compareDurations('1h', '60m')).toBe(0);
    });

    it('checks threshold exceeding correctly', () => {
      expect(exceedsThreshold('15m', 600)).toBe(true);
      expect(exceedsThreshold('5m', 600)).toBe(false);
    });
  });

  describe('secondsToJP and formatDurationWithJP', () => {
    it('calculates Jam Pelajaran (1 JP = 45 min = 2700s)', () => {
      expect(secondsToJP(0)).toBe(0);
      expect(secondsToJP(-10)).toBe(0);
      expect(secondsToJP(100)).toBe(1);
      expect(secondsToJP(2700)).toBe(1);
      expect(secondsToJP(2701)).toBe(2);
      expect(secondsToJP(5400)).toBe(2);
    });

    it('formats duration with JP notation', () => {
      expect(formatDurationWithJP(2700)).toBe('45m 0s (1JP)');
      expect(formatDurationWithJP(0)).toBe('0m 0s (0JP)');
    });
  });

  describe('getDurationStats', () => {
    it('handles empty, null, or invalid items list without throwing', () => {
      const emptyStats = {
        total: '0m 0s',
        totalWithJP: '0m 0s (0JP)',
        average: '0m 0s',
        averageWithJP: '0m 0s (0JP)',
        min: '0m 0s',
        minWithJP: '0m 0s (0JP)',
        max: '0m 0s',
        maxWithJP: '0m 0s (0JP)',
        count: 0
      };
      expect(getDurationStats(null)).toEqual(emptyStats);
      expect(getDurationStats([])).toEqual(emptyStats);
      expect(getDurationStats([null, undefined])).toEqual(emptyStats);
    });

    it('computes correct statistics for valid items', () => {
      const items = [
        { content_duration: '10m' }, // 600s
        { content_duration: '20m' }, // 1200s
        { content_duration: '30m' }  // 1800s
      ];
      const stats = getDurationStats(items);
      expect(stats.count).toBe(3);
      expect(stats.totalSeconds).toBe(3600);
      expect(stats.averageSeconds).toBe(1200);
      expect(stats.minSeconds).toBe(600);
      expect(stats.maxSeconds).toBe(1800);
      expect(stats.total).toBe('1h 0m');
      expect(stats.average).toBe('20m 0s');
      expect(stats.min).toBe('10m 0s');
      expect(stats.max).toBe('30m 0s');
    });

    it('safely handles items with null elements or alternative keys', () => {
      const items = [
        { content_duration: '10m' },
        null,
        { duration: '20m' }
      ];
      const stats = getDurationStats(items);
      expect(stats.count).toBe(2);
      expect(stats.totalSeconds).toBe(1800);
    });
  });
});
