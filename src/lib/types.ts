export interface Profile {
  skills: {
    [category: string]: string[];
  };
  projects: {
    name: string;
    description: string;
    technologies?: string[];
    url?: string;
    achievements?: string[];
  }[];
  experience?: string[];
  experience_highlights?: string[];
  summary?: string;
  profile_summary?: string;
  portfolios?: string[];
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    other?: string[];
  };
}

export interface Job {
  title: string;
  link: string;
  typeOfWork?: string;
  salary?: string;
  hoursPerWeek?: string;
  description?: string;
  skills?: string;
  isSaved?: boolean;
  hasApplied?: boolean;
  isClosed?: boolean;
  isBlacklisted?: boolean;
  tags?: string[];
  scrapeError?: string;
}

export interface Analysis {
  matchScore: number;
  match_score?: number;
  pros: string[];
  cons: string[];
  recommendation: 'Apply' | 'Skip';
  reasoning: string;
}

export interface Manifest {
  lastParsed: string;
}
