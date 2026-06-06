import { Job } from './types';

export const DEFAULT_MAX_AGE_DAYS = 7;
export const DEFAULT_JOBS_PER_QUERY = 8;
export const JOBS_PER_QUERY_OPTIONS = [3, 5, 8, 10, 15] as const;
export const BATCH_LIMIT = 120;

export function clampJobsPerQuery(n: number): number {
  if (JOBS_PER_QUERY_OPTIONS.includes(n as (typeof JOBS_PER_QUERY_OPTIONS)[number])) {
    return n;
  }
  return DEFAULT_JOBS_PER_QUERY;
}

export type RecencyFilterKey = '3d' | '7d' | '14d' | '30d' | 'all';

export const RECENCY_FILTER_OPTIONS: { key: RecencyFilterKey; label: string; maxDays: number | null }[] = [
  { key: '3d', label: 'Last 3 days', maxDays: 3 },
  { key: '7d', label: 'Last 7 days', maxDays: 7 },
  { key: '14d', label: 'Last 2 weeks', maxDays: 14 },
  { key: '30d', label: 'Last month', maxDays: 30 },
  { key: 'all', label: 'All', maxDays: null },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse OnlineJobs.ph date strings (data-temp or "Posted on …") into ISO 8601. */
export function parsePostedAt(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const postedMatch = trimmed.match(/Posted on\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i);
  const dateStr = postedMatch?.[1] ?? trimmed;

  // OnlineJobs.ph posting dates are in Philippines time (UTC+8).
  const normalized = `${dateStr.replace(' ', 'T')}+08:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function getJobAgeDays(job: Pick<Job, 'postedAt'>, now: Date = new Date()): number | null {
  if (!job.postedAt) return null;
  const posted = new Date(job.postedAt);
  if (Number.isNaN(posted.getTime())) return null;
  const diffMs = now.getTime() - posted.getTime();
  return Math.max(0, Math.floor(diffMs / MS_PER_DAY));
}

export function computeRecencyScore(ageDays: number): number {
  if (ageDays <= 2) return 100;
  if (ageDays <= 4) return 75;
  if (ageDays <= 6) return 40;
  return 0;
}

export function blendMatchScore(matchScore: number, recencyScore: number): number {
  if (matchScore < 0) return matchScore;
  return Math.round(matchScore * 0.75 + recencyScore * 0.25);
}

export function passesRecencyFilter(
  job: Pick<Job, 'postedAt'>,
  maxDays: number | null,
  now: Date = new Date()
): boolean {
  if (maxDays === null) return true;
  const ageDays = getJobAgeDays(job, now);
  if (ageDays === null) return false;
  return ageDays <= maxDays;
}

export function formatPostedLabel(job: Pick<Job, 'postedAt'>, now: Date = new Date()): string {
  const ageDays = getJobAgeDays(job, now);
  if (ageDays === null) return 'Date unknown';
  if (ageDays === 0) return 'Posted today';
  if (ageDays === 1) return 'Posted 1 day ago';
  return `Posted ${ageDays} days ago`;
}

export function getRecencyColorClass(ageDays: number | null): string {
  if (ageDays === null) return 'text-slate-400';
  if (ageDays <= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (ageDays <= 6) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function formatPostedContext(job: Pick<Job, 'postedAt'>, now: Date = new Date()): string {
  if (!job.postedAt) return 'Posted: unknown';
  const ageDays = getJobAgeDays(job, now);
  const datePart = job.postedAt.slice(0, 10);
  if (ageDays === null) return `Posted: ${datePart}`;
  const ageLabel = ageDays === 0 ? 'today' : ageDays === 1 ? '1 day ago' : `${ageDays} days ago`;
  return `Posted: ${datePart} (${ageLabel})`;
}

export function getRecencySortValue(job: Pick<Job, 'postedAt'>): number {
  if (!job.postedAt) return 0;
  const ts = new Date(job.postedAt).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}
