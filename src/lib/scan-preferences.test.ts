import { beforeEach, describe, expect, it } from 'vitest';
import {
  JOBS_PER_QUERY_STORAGE_KEY,
  getJobsPerQuery,
  setJobsPerQuery,
} from './scan-preferences';
import { DEFAULT_JOBS_PER_QUERY } from './job-recency';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

describe('scan-preferences', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      writable: true,
      configurable: true,
    });
  });

  it('returns default when localStorage is empty', () => {
    expect(getJobsPerQuery()).toBe(DEFAULT_JOBS_PER_QUERY);
  });

  it('persists and reads valid preset values', () => {
    setJobsPerQuery(5);
    expect(localStorage.getItem(JOBS_PER_QUERY_STORAGE_KEY)).toBe('5');
    expect(getJobsPerQuery()).toBe(5);
  });

  it('falls back to default for invalid stored values', () => {
    localStorage.setItem(JOBS_PER_QUERY_STORAGE_KEY, '99');
    expect(getJobsPerQuery()).toBe(DEFAULT_JOBS_PER_QUERY);

    localStorage.setItem(JOBS_PER_QUERY_STORAGE_KEY, 'not-a-number');
    expect(getJobsPerQuery()).toBe(DEFAULT_JOBS_PER_QUERY);
  });

  it('clamps invalid values on write', () => {
    setJobsPerQuery(99);
    expect(getJobsPerQuery()).toBe(DEFAULT_JOBS_PER_QUERY);
  });
});
