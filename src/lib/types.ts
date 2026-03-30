export interface Profile {
  skills: {
    [category: string]: string[];
  };
  projects: {
    name: string;
    description: string;
  }[];
  experience?: string[];
  experience_highlights?: string[];
  summary?: string;
  profile_summary?: string;
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
