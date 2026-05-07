import fs from 'fs';
import path from 'path';
import { Job, Profile, Analysis } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
const MANIFEST_PATH = path.join(process.cwd(), 'manifest.json');
const JOBS_PATH = path.join(DATA_DIR, 'jobs.json');
const ANALYSIS_PATH = path.join(DATA_DIR, 'analysis.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeJobLink(link: string): string {
  return link.trim().replace(/\/+$/, '');
}

export type DedupeJobsResult = {
  jobs: Job[];
  beforeCount: number;
  afterCount: number;
  removedDuplicates: number;
  mergedRecordCount: number;
};

export function dedupeJobsByLink(jobs: Job[]): DedupeJobsResult {
  const mergedByLink = new Map<string, Job>();
  let mergedRecordCount = 0;

  for (const job of jobs) {
    const normalizedLink = normalizeJobLink(job.link);
    const current: Job = { ...job, link: normalizedLink };
    const existing = mergedByLink.get(normalizedLink);
    if (!existing) {
      mergedByLink.set(normalizedLink, current);
      continue;
    }

    mergedRecordCount += 1;
    const merged: Job = { ...existing };

    // Prefer richer values for descriptive fields when available.
    const textFields: Array<keyof Job> = [
      'title',
      'typeOfWork',
      'salary',
      'hoursPerWeek',
      'description',
      'skills',
      'scrapeError',
    ];
    for (const field of textFields) {
      const currentValue = current[field];
      const existingValue = merged[field];
      if (!isNonEmptyString(existingValue) && isNonEmptyString(currentValue)) {
        (merged[field] as string | undefined) = currentValue;
      }
    }

    merged.isSaved = Boolean(merged.isSaved || current.isSaved);
    merged.hasApplied = Boolean(merged.hasApplied || current.hasApplied);
    merged.isClosed = Boolean(merged.isClosed || current.isClosed);
    merged.isBlacklisted = Boolean(merged.isBlacklisted || current.isBlacklisted);

    const tags = new Set<string>([...(merged.tags ?? []), ...(current.tags ?? [])]);
    if (tags.size > 0) {
      merged.tags = [...tags];
    }

    mergedByLink.set(normalizedLink, merged);
  }

  const deduped = [...mergedByLink.values()];
  const beforeCount = jobs.length;
  const afterCount = deduped.length;
  return {
    jobs: deduped,
    beforeCount,
    afterCount,
    removedDuplicates: beforeCount - afterCount,
    mergedRecordCount,
  };
}

export const Storage = {
  getProfile: (): Profile | null => {
    if (!fs.existsSync(PROFILE_PATH)) return null;
    return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
  },
  getJobs: (): Job[] => {
    if (!fs.existsSync(JOBS_PATH)) return [];
    return JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8'));
  },
  getAnalysis: (): Record<string, Analysis> => {
    if (!fs.existsSync(ANALYSIS_PATH)) return {};
    return JSON.parse(fs.readFileSync(ANALYSIS_PATH, 'utf-8'));
  },
  saveJobs: (jobs: Job[]) => {
    fs.writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2));
  },
  saveAnalysis: (analysis: Record<string, Analysis>) => {
    fs.writeFileSync(ANALYSIS_PATH, JSON.stringify(analysis, null, 2));
  },
  saveProfile: (profile: Profile) => {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  }
};
