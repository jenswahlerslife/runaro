import { describe, it, expect } from 'vitest';
import { formatDistance, formatTime, formatSpeed } from '@/utils/format';

describe('format utils', () => {
  it('formats distance in km with 2 decimals', () => {
    expect(formatDistance(0)).toBe('0.00 km');
    expect(formatDistance(1234)).toBe('1.23 km');
  });

  it('formats time as hours/minutes', () => {
    expect(formatTime(59)).toBe('0m');
    expect(formatTime(60)).toBe('1m');
    expect(formatTime(3600)).toBe('1t 0m');
    expect(formatTime(3661)).toBe('1t 1m');
  });

  it('formats speed as km/t with 1 decimal', () => {
    expect(formatSpeed(0)).toBe('0.0 km/t');
    expect(formatSpeed(2.7778)).toBe('10.0 km/t');
  });
});

