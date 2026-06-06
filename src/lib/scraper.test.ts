import { describe, expect, it } from 'vitest';
import { clampJobsPerQuery, parsePostedAt } from './job-recency';

describe('scraper search result processing', () => {
  it('limits and sorts search results by postedAt', () => {
    const limit = 8;
    const rawResults = Array.from({ length: 12 }, (_, i) => {
      const day = String(6 - Math.floor(i / 2)).padStart(2, '0');
      const raw = `2026-06-${day} 10:00:00`;
      return {
        title: `Job ${i}`,
        link: `https://www.onlinejobs.ph/job/${i}`,
        postedAtRaw: raw,
      };
    });

    const withDates = rawResults
      .map((job) => {
        let postedAt: string | undefined;
        if (job.postedAtRaw) {
          const parsed = parsePostedAt(job.postedAtRaw);
          if (parsed) postedAt = parsed;
        }
        return { title: job.title, link: job.link, postedAt };
      })
      .sort((a, b) => {
        const aTs = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const bTs = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return bTs - aTs;
      })
      .slice(0, clampJobsPerQuery(limit));

    expect(withDates).toHaveLength(8);
    expect(withDates[0].postedAt).toBe('2026-06-06T02:00:00.000Z');
    expect(withDates[7].postedAt).toBe('2026-06-03T02:00:00.000Z');
  });

  it('respects a custom per-query limit', () => {
    const rawResults = Array.from({ length: 12 }, (_, i) => ({
      title: `Job ${i}`,
      link: `https://www.onlinejobs.ph/job/${i}`,
      postedAtRaw: `2026-06-06 10:00:00`,
    }));

    const withDates = rawResults
      .map((job) => ({
        title: job.title,
        link: job.link,
        postedAt: parsePostedAt(job.postedAtRaw) ?? undefined,
      }))
      .slice(0, clampJobsPerQuery(3));

    expect(withDates).toHaveLength(3);
  });
});
