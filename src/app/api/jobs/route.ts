import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@/lib/storage';
import { JobScraper } from '@/lib/scraper';
import { LLMClient } from '@/lib/llm';
import { Job, Analysis, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const jobs = Storage.getJobs();
  const analysis = Storage.getAnalysis();
  return NextResponse.json({ jobs, analysis });
}

import { scanEmitter } from '@/lib/events';

// Background scan worker
async function runBackgroundScan(queries: string[], profile: Profile) {
  const sendLog = (msg: string) => scanEmitter.emit('log', msg);
  const sendError = (msg: string) => scanEmitter.emit('error', msg);

  const scraper = new JobScraper();
  try {
    sendLog(`**Initialization complete.** Starting background scanner for queries: [${queries.join(', ')}]`);
    const llm = new LLMClient();

    let jobCache = Storage.getJobs();
    let analysisCache = Storage.getAnalysis();

    // 1. Search and Scrape
    for (const query of queries) {
      sendLog(`[Search] Querying OnlineJobs.ph for keyword: **"${query}"**`);
      const searchResults = await scraper.searchJobs(query);
      sendLog(`[Search] Found ${searchResults.length} initial matching results for **"${query}"**`);

      for (let i = 0; i < searchResults.length; i++) {
        const res = searchResults[i];
        const existingJob = jobCache.find(j => j.link === res.link);

        let shouldSave = false;

        if (existingJob) {
          if (!existingJob.tags) existingJob.tags = [];
          if (!existingJob.tags.includes(query)) {
            existingJob.tags.push(query);
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
              } else {
                jobCache.push({ ...res, ...details, tags: [query] } as Job);
              }
              shouldSave = true;
              sendLog(`[Scraping] Successfully cached description for: **${res.title}**`);
            }
          } catch (e: any) {
            sendLog(`[Scraping] Failed to retrieve details for: ${res.title}`);
            const job = existingJob || { ...res, tags: [query] };
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
    const unanalyzedJobs = jobCache.filter(j => j.description && !analysisCache[j.link] && !j.isClosed);
    sendLog(`[Heuristics] Processing ${unanalyzedJobs.length} unanalyzed jobs through pre-screening.`);

    const getPreScore = (job: Job, prof: Profile) => {
      let score = 0;
      const text = `${job.title} ${job.description} ${job.skills}`.toLowerCase();
      Object.values(prof.skills || {}).flat().forEach(skill => {
        if (text.includes(skill.toLowerCase())) score++;
      });
      return score;
    };

    unanalyzedJobs.sort((a, b) => getPreScore(b, profile) - getPreScore(a, profile));
    const BATCH_LIMIT = 500;
    const jobsToAnalyze = unanalyzedJobs.slice(0, BATCH_LIMIT);

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

      await Promise.all(batch.map(async (job) => {
        sendLog(`[AI Agent] Analyzing: **${job.title}**`);
        const context = `Job Title: ${job.title}\nType: ${job.typeOfWork}\nSalary: ${job.salary}\nSkills: ${job.skills}\nDescription: ${job.description}`;
        const comparison = await llm.compareJob(profile, context);

        if ('matchScore' in comparison || 'match_score' in comparison) {
          const score = (comparison as any).matchScore ?? (comparison as any).match_score ?? 0;
          const normalized: Analysis = {
            matchScore: score,
            pros: Array.isArray((comparison as any).pros) ? (comparison as any).pros : [],
            cons: Array.isArray((comparison as any).cons) ? (comparison as any).cons : [],
            recommendation: (comparison as any).recommendation || 'Skip',
            reasoning: (comparison as any).reasoning || (comparison as any).reason || 'No reasoning provided.'
          };
          analysisCache[job.link] = normalized;
          sendLog(`[AI Agent] Rated **${job.title}**: ${normalized.matchScore}% Match`);
        } else {
          let errorMsg = (comparison as any).error;
          if (!errorMsg) {
            const keys = Object.keys(comparison).join(', ');
            errorMsg = `Schema mismatch: Expected "matchScore" but found keys [${keys || 'none'}]`;
          }
          analysisCache[job.link] = {
            matchScore: -1,
            pros: [],
            cons: [],
            recommendation: 'Skip',
            reasoning: `Analysis failed: ${errorMsg}`
          };
          sendLog(`[AI Agent] Analysis failed for **${job.title}**: ${errorMsg}`);
        }

        // Save after EACH job completes to ensure no progress is lost
        Storage.saveAnalysis(analysisCache);
        scanEmitter.emit('analysisAdded');
      }));

      // Polite delay between batches instead of jobs
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
    const { queries } = await req.json();
    const profile = Storage.getProfile();

    if (!profile) {
      return NextResponse.json({ error: 'No profile found. Please upload a CV first.' }, { status: 400 });
    }

    // Start background task without awaiting it
    runBackgroundScan(queries, profile as Profile).catch(console.error);

    return NextResponse.json({ success: true, message: 'Scan started in background' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { link, isSaved, hasApplied, isClosed, isBlacklisted } = await req.json();
    if (!link) {
      return NextResponse.json({ error: 'Missing job link' }, { status: 400 });
    }

    const jobCache = Storage.getJobs();
    const jobIndex = jobCache.findIndex(j => j.link === link);

    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Update partial fields
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
