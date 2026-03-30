import fs from 'fs';
import path from 'path';
import { Job, Profile, Analysis } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILE_PATH = path.join(process.cwd(), 'profile.json');
const MANIFEST_PATH = path.join(process.cwd(), 'manifest.json');
const JOBS_PATH = path.join(DATA_DIR, 'jobs.json');
const ANALYSIS_PATH = path.join(DATA_DIR, 'analysis.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
  }
};
