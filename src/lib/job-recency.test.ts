import { describe, expect, it } from 'vitest';
import {
  blendMatchScore,
  clampJobsPerQuery,
  computeRecencyScore,
  DEFAULT_JOBS_PER_QUERY,
  formatPostedContext,
  formatPostedLabel,
  getJobAgeDays,
  parsePostedAt,
  passesRecencyFilter,
} from './job-recency';

const NOW = new Date('2026-06-06T12:00:00.000Z');

describe('job-recency', () => {
  it('parses data-temp and Posted on strings', () => {
    expect(parsePostedAt('2026-06-06 10:12:03')).toBe('2026-06-06T02:12:03.000Z');
    expect(parsePostedAt('Posted on 2026-06-04 08:00:00')).toBe('2026-06-04T00:00:00.000Z');
    expect(parsePostedAt('')).toBeNull();
  });

  it('computes age in days', () => {
    expect(getJobAgeDays({ postedAt: '2026-06-06T10:00:00.000Z' }, NOW)).toBe(0);
    expect(getJobAgeDays({ postedAt: '2026-06-04T10:00:00.000Z' }, NOW)).toBe(2);
    expect(getJobAgeDays({ postedAt: '2026-05-30T10:00:00.000Z' }, NOW)).toBe(7);
    expect(getJobAgeDays({}, NOW)).toBeNull();
  });

  it('scores recency with steep drop after 3 days', () => {
    expect(computeRecencyScore(0)).toBe(100);
    expect(computeRecencyScore(2)).toBe(100);
    expect(computeRecencyScore(3)).toBe(75);
    expect(computeRecencyScore(4)).toBe(75);
    expect(computeRecencyScore(5)).toBe(40);
    expect(computeRecencyScore(6)).toBe(40);
    expect(computeRecencyScore(7)).toBe(0);
    expect(computeRecencyScore(30)).toBe(0);
  });

  it('blends match and recency scores', () => {
    expect(blendMatchScore(80, 100)).toBe(85);
    expect(blendMatchScore(-1, 100)).toBe(-1);
  });

  it('filters by max age', () => {
    const recent = { postedAt: '2026-06-05T10:00:00.000Z' };
    const stale = { postedAt: '2026-05-20T10:00:00.000Z' };
    const unknown = {};

    expect(passesRecencyFilter(recent, 7, NOW)).toBe(true);
    expect(passesRecencyFilter(stale, 7, NOW)).toBe(false);
    expect(passesRecencyFilter(unknown, 7, NOW)).toBe(false);
    expect(passesRecencyFilter(unknown, null, NOW)).toBe(true);
    expect(passesRecencyFilter(stale, null, NOW)).toBe(true);
  });

  it('clamps jobs per query to valid presets', () => {
    expect(clampJobsPerQuery(5)).toBe(5);
    expect(clampJobsPerQuery(15)).toBe(15);
    expect(clampJobsPerQuery(99)).toBe(DEFAULT_JOBS_PER_QUERY);
  });

  it('formats posted labels and context', () => {
    expect(formatPostedLabel({ postedAt: '2026-06-06T10:00:00.000Z' }, NOW)).toBe('Posted today');
    expect(formatPostedLabel({ postedAt: '2026-06-05T10:00:00.000Z' }, NOW)).toBe('Posted 1 day ago');
    expect(formatPostedLabel({ postedAt: '2026-06-03T10:00:00.000Z' }, NOW)).toBe('Posted 3 days ago');
    expect(formatPostedLabel({}, NOW)).toBe('Date unknown');
    expect(formatPostedContext({ postedAt: '2026-06-04T10:00:00.000Z' }, NOW)).toContain('2 days ago');
  });
});
