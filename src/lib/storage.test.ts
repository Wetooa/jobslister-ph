import { describe, it, expect } from 'vitest';
import { dedupeJobsByLink, normalizeJobLink } from './storage';
import { Job } from './types';

describe('normalizeJobLink', () => {
  it('trims and removes trailing slashes', () => {
    expect(normalizeJobLink(' https://x.com/job/ ')).toBe('https://x.com/job');
  });
});

describe('dedupeJobsByLink', () => {
  it('merges duplicate jobs by normalized link', () => {
    const jobs: Job[] = [
      {
        title: 'Role A',
        link: 'https://x.com/job/123/',
        tags: ['react'],
        isSaved: true,
      },
      {
        title: 'Role A',
        link: 'https://x.com/job/123',
        description: 'Full details',
        skills: 'React, TypeScript',
        tags: ['typescript'],
        hasApplied: true,
      },
      {
        title: 'Role B',
        link: 'https://x.com/job/999',
      },
    ];

    const result = dedupeJobsByLink(jobs);

    expect(result.beforeCount).toBe(3);
    expect(result.afterCount).toBe(2);
    expect(result.removedDuplicates).toBe(1);
    expect(result.mergedRecordCount).toBe(1);

    const merged = result.jobs.find((job) => job.link === 'https://x.com/job/123');
    expect(merged).toBeTruthy();
    expect(merged?.description).toBe('Full details');
    expect(merged?.skills).toBe('React, TypeScript');
    expect(merged?.isSaved).toBe(true);
    expect(merged?.hasApplied).toBe(true);
    expect(merged?.tags).toEqual(['react', 'typescript']);
  });
});
