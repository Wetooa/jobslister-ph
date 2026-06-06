import { NextRequest, NextResponse } from 'next/server';
import { Storage, dedupeJobsByLink, normalizeJobLink } from '@/lib/storage';
import { JobScraper } from '@/lib/scraper';
import { LLMClient } from '@/lib/llm';
import { Job, Analysis, Profile } from '@/lib/types';
import {
  BATCH_LIMIT,
  DEFAULT_JOBS_PER_QUERY,
  DEFAULT_MAX_AGE_DAYS,
  blendMatchScore,
  clampJobsPerQuery,
  computeRecencyScore,
  formatPostedContext,
  getJobAgeDays,
  getRecencySortValue,
  passesRecencyFilter,
} from '@/lib/job-recency';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jobs = Storage.getJobs();
  const analysis = Storage.getAnalysis();
  return NextResponse.json({ jobs, analysis });
}

import { scanEmitter } from '@/lib/events';

export type ScanOptions = {
  maxAgeDays?: number;
  reset?: boolean;
  jobsPerQuery?: number;
};

// Background scan worker
async function runBackgroundScan(queries: string[], profile: Profile, options: ScanOptions = {}) {
  const sendLog = (msg: string) => scanEmitter.emit('log', msg);
  const sendError = (msg: string) => scanEmitter.emit('error', msg);
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const jobsPerQuery = clampJobsPerQuery(options.jobsPerQuery ?? DEFAULT_JOBS_PER_QUERY);

  const scraper = new JobScraper();
  try {
    if (options.reset) {
      Storage.clearJobs();
      Storage.clearAnalysis();
      sendLog(`[System] Cleared all jobs and analysis cache for fresh scan.`);
    }

    sendLog(`**Initialization complete.** Starting background scanner for queries: [${queries.join(', ')}] (max age: ${maxAgeDays} days, up to ${jobsPerQuery} jobs per keyword)`);
    const llm = new LLMClient();

    const dedupeResult = dedupeJobsByLink(Storage.getJobs());
    let jobCache = dedupeResult.jobs;
    if (dedupeResult.removedDuplicates > 0) {
      Storage.saveJobs(jobCache);
      sendLog(
        `[System] Deduplicated job cache: removed ${dedupeResult.removedDuplicates} duplicate records.`
      );
    }
    let analysisCache = Storage.getAnalysis();
    const normalizedAnalysisCache = Object.entries(analysisCache).reduce<Record<string, Analysis>>(
      (acc, [link, value]) => {
        acc[normalizeJobLink(link)] = value;
        return acc;
      },
      {}
    );
    if (Object.keys(normalizedAnalysisCache).length !== Object.keys(analysisCache).length) {
      analysisCache = normalizedAnalysisCache;
      Storage.saveAnalysis(analysisCache);
    }

    // 1. Search and Scrape
    for (const query of queries) {
      sendLog(`[Search] Querying OnlineJobs.ph for keyword: **"${query}"**`);
      const searchResults = await scraper.searchJobs(query, jobsPerQuery);
      sendLog(`[Search] Found ${searchResults.length} recent results (top ${jobsPerQuery} by date) for **"${query}"**`);

      for (let i = 0; i < searchResults.length; i++) {
        const res = searchResults[i];

        if (!passesRecencyFilter(res, maxAgeDays)) {
          const ageDays = getJobAgeDays(res);
          sendLog(`[Recency] Skipping stale job **"${res.title}"** (${ageDays ?? 'unknown'} days old, max ${maxAgeDays})`);
          continue;
        }

        const normalizedLink = normalizeJobLink(res.link);
        const existingJob = jobCache.find(j => normalizeJobLink(j.link) === normalizedLink);

        let shouldSave = false;

        if (existingJob) {
          if (!existingJob.tags) existingJob.tags = [];
          if (!existingJob.tags.includes(query)) {
            existingJob.tags.push(query);
            shouldSave = true;
          }
          if (res.postedAt && !existingJob.postedAt) {
            existingJob.postedAt = res.postedAt;
            shouldSave = true;
          }
        }

        if (!existingJob || (!existingJob.description && !existingJob.scrapeError)) {
          sendLog(`[Scraping] Fetching full details dynamically for: ${res.title}...`);
          try {
            const details = await scraper.getJobDetails(res.link);
            if (details) {
              if (existingJob) {
                Object.assign(existingJob, details);
                if (res.postedAt) existingJob.postedAt = res.postedAt;
              } else {
                jobCache.push({ ...res, ...details, link: normalizedLink, tags: [query] } as Job);
              }
              shouldSave = true;
              sendLog(`[Scraping] Successfully cached description for: **${res.title}**`);
            }
          } catch (e: any) {
            sendLog(`[Scraping] Failed to retrieve details for: ${res.title}`);
            const job = existingJob || { ...res, link: normalizedLink, tags: [query] };
            (job as Job).scrapeError = e.message || 'Scrape failed';
            if (!existingJob) jobCache.push(job as Job);
            shouldSave = true;
          }
        }

        if (shouldSave) Storage.saveJobs(jobCache);
      }
    }

    // 2. Pre-Sort Unanalyzed Jobs
    sendLog(`[System] Scraping pipeline complete. Preparing LLM analysis queue...`);
    const seenLinks = new Set<string>();
    const unanalyzedJobs = jobCache.filter((job) => {
      if (!job.description || job.isClosed) return false;
      if (!passesRecencyFilter(job, maxAgeDays)) return false;
      const normalizedLink = normalizeJobLink(job.link);
      if (seenLinks.has(normalizedLink)) return false;
      seenLinks.add(normalizedLink);
      return !analysisCache[normalizedLink];
    });
    sendLog(`[Heuristics] Processing ${unanalyzedJobs.length} unanalyzed jobs through pre-screening.`);

    const getPreScore = (job: Job, prof: Profile) => {
      let score = 0;
      const text = `${job.title} ${job.description} ${job.skills}`.toLowerCase();
      Object.values(prof.skills || {}).flat().forEach(skill => {
        if (text.includes(skill.toLowerCase())) score++;
      });
      return score;
    };

    unanalyzedJobs.sort((a, b) => {
      const recencyDiff = getRecencySortValue(b) - getRecencySortValue(a);
      if (recencyDiff !== 0) return recencyDiff;
      return getPreScore(b, profile) - getPreScore(a, profile);
    });
    const analysisBatchCap = Math.min(BATCH_LIMIT, queries.length * jobsPerQuery);
    const jobsToAnalyze = unanalyzedJobs.slice(0, analysisBatchCap);

    if (jobsToAnalyze.length > 0) {
      sendLog(`[Heuristics] Isolated top ${jobsToAnalyze.length} jobs for deep **AI Analysis**.`);
    } else {
      sendLog(`[Heuristics] No new jobs meet the threshold for AI analysis.`);
    }

    // Process in batches
    const CONCURRENCY = 3;
    for (let i = 0; i < jobsToAnalyze.length; i += CONCURRENCY) {
      const batch = jobsToAnalyze.slice(i, i + CONCURRENCY);
      sendLog(`[AI Agent] Processing batch ${Math.floor(i / CONCURRENCY) + 1} (${batch.length} jobs concurrently)...`);

      await Promise.all(
        batch.map(async (job) => {
          try {
            sendLog(`[AI Agent] Analyzing: **${job.title}**`);
            const postedContext = formatPostedContext(job);
            const context = `Job Title: ${job.title}\nType: ${job.typeOfWork}\nSalary: ${job.salary}\nSkills: ${job.skills}\n${postedContext}\nDescription: ${job.description}`;
            const comparison = await llm.compareJob(profile, context);

            if ('matchScore' in comparison || 'match_score' in comparison) {
              const rawScore = (comparison as any).matchScore ?? (comparison as any).match_score ?? 0;
              const ageDays = getJobAgeDays(job) ?? 999;
              const recencyScore = computeRecencyScore(ageDays);
              const blendedScore = blendMatchScore(rawScore, recencyScore);

              const normalized: Analysis = {
                matchScore: blendedScore,
                rawMatchScore: rawScore,
                recencyScore,
                pros: Array.isArray((comparison as any).pros) ? (comparison as any).pros : [],
                cons: Array.isArray((comparison as any).cons) ? (comparison as any).cons : [],
                recommendation: (comparison as any).recommendation || 'Skip',
                reasoning: (comparison as any).reasoning || (comparison as any).reason || 'No reasoning provided.'
              };

              const jobIndex = jobCache.findIndex(j => normalizeJobLink(j.link) === normalizeJobLink(job.link));
              if (jobIndex !== -1) {
                jobCache[jobIndex].recencyScore = recencyScore;
                Storage.saveJobs(jobCache);
              }

              analysisCache[normalizeJobLink(job.link)] = normalized;
              sendLog(`[AI Agent] Rated **${job.title}**: ${normalized.matchScore}% Match (skill: ${rawScore}%, recency: ${recencyScore}%)`);
            } else {
              let errorMsg = (comparison as any).error;
              if (!errorMsg) {
                const keys = Object.keys(comparison).join(', ');
                errorMsg = `Schema mismatch: Expected "matchScore" but found keys [${keys || 'none'}]`;
              }
              analysisCache[normalizeJobLink(job.link)] = {
                matchScore: -1,
                pros: [],
                cons: [],
                recommendation: 'Skip',
                reasoning: `Analysis failed: ${errorMsg}`
              };
              sendLog(`[AI Agent] Analysis failed for **${job.title}**: ${errorMsg}`);
            }
          } catch (e: unknown) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            analysisCache[normalizeJobLink(job.link)] = {
              matchScore: -1,
              pros: [],
              cons: [],
              recommendation: 'Skip',
              reasoning: `Analysis failed: ${errorMsg}`
            };
            sendLog(`[AI Agent] Analysis failed for **${job.title}**: ${errorMsg}`);
          }

          Storage.saveAnalysis(analysisCache);
          scanEmitter.emit('analysisAdded');
        })
      );

      if (i + CONCURRENCY < jobsToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    sendLog(`**Finished.** All routines complete. Terminating stream...`);
    scanEmitter.emit('complete');

  } catch (error: any) {
    console.error('Job processing error:', error);
    sendError(error.message || 'Internal Server Error');
  } finally {
    await scraper.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { queries, maxAgeDays, reset, jobsPerQuery } = await req.json();
    const profile = Storage.getProfile();

    if (!profile) {
      return NextResponse.json({ error: 'No profile found. Please upload a CV first.' }, { status: 400 });
    }

    runBackgroundScan(queries ?? [], profile as Profile, { maxAgeDays, reset, jobsPerQuery }).catch(console.error);

    return NextResponse.json({ success: true, message: 'Scan started in background' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { link, isSaved, hasApplied, isClosed, isBlacklisted, action } = await req.json();
    if (action === 'dedupe') {
      const jobCache = Storage.getJobs();
      const result = dedupeJobsByLink(jobCache);
      if (result.removedDuplicates > 0) {
        Storage.saveJobs(result.jobs);
      }
      return NextResponse.json({
        success: true,
        beforeCount: result.beforeCount,
        afterCount: result.afterCount,
        removedDuplicates: result.removedDuplicates,
        mergedRecordCount: result.mergedRecordCount,
      });
    }
    if (!link) {
      return NextResponse.json({ error: 'Missing job link' }, { status: 400 });
    }

    const jobCache = Storage.getJobs();
    const jobIndex = jobCache.findIndex(j => j.link === link);

    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (isSaved !== undefined) jobCache[jobIndex].isSaved = isSaved;
    if (hasApplied !== undefined) jobCache[jobIndex].hasApplied = hasApplied;
    if (isClosed !== undefined) jobCache[jobIndex].isClosed = isClosed;
    if (isBlacklisted !== undefined) jobCache[jobIndex].isBlacklisted = isBlacklisted;

    Storage.saveJobs(jobCache);

    return NextResponse.json({ success: true, job: jobCache[jobIndex] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
