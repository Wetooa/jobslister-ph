import {
  DEFAULT_JOBS_PER_QUERY,
  JOBS_PER_QUERY_OPTIONS,
  clampJobsPerQuery,
} from './job-recency';

export const JOBS_PER_QUERY_STORAGE_KEY = 'jobsph-jobs-per-query';

export const JOBS_PER_QUERY_PRESETS: { value: number; label: string }[] = [
  { value: 3, label: '3 (minimal)' },
  { value: 5, label: '5' },
  { value: 8, label: '8 (default)' },
  { value: 10, label: '10' },
  { value: 15, label: '15 (max recommended)' },
];

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function getJobsPerQuery(): number {
  if (!canUseStorage()) return DEFAULT_JOBS_PER_QUERY;
  const raw = localStorage.getItem(JOBS_PER_QUERY_STORAGE_KEY);
  if (!raw) return DEFAULT_JOBS_PER_QUERY;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return DEFAULT_JOBS_PER_QUERY;
  return clampJobsPerQuery(parsed);
}

export function setJobsPerQuery(n: number): void {
  if (!canUseStorage()) return;
  localStorage.setItem(JOBS_PER_QUERY_STORAGE_KEY, String(clampJobsPerQuery(n)));
}

export { JOBS_PER_QUERY_OPTIONS };
