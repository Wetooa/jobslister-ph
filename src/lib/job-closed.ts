import { Browser, BrowserContext, chromium } from 'playwright';

/** Phrases seen on OnlineJobs.ph and similar listings when a post is no longer active. */
const CLOSED_SUBSTRINGS = [
  'this job has been closed',
  'job has been closed',
  'this position has been closed',
  'this listing has been closed',
  'no longer accepting applications',
  'no longer available',
  'position has been filled',
  'job has been filled',
  'this job is no longer',
];

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_URL_LOG_LEN = 96;

export type PageCheckResult =
  | { ok: true; closed: boolean; httpStatus: number | null }
  | { ok: false; error: string };

function truncateUrl(url: string): string {
  if (url.length <= MAX_URL_LOG_LEN) return url;
  return `${url.slice(0, MAX_URL_LOG_LEN)}…`;
}

export async function checkJobClosedWithPage(
  context: BrowserContext,
  url: string,
  navigationTimeoutMs: number
): Promise<PageCheckResult> {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });
    const httpStatus = response?.status() ?? null;
    if (httpStatus === 404 || httpStatus === 410) {
      return { ok: true, closed: true, httpStatus };
    }

    const text = (
      await page.evaluate(() => document.body?.innerText ?? '')
    ).toLowerCase();
    const html = (await page.content()).toLowerCase();
    const blob = `${text}\n${html}`;
    const closed = CLOSED_SUBSTRINGS.some((p) => blob.includes(p));
    return { ok: true, closed, httpStatus };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    await page.close();
  }
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const queue = [...items];
  const n = Math.min(concurrency, queue.length);
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        await worker(item);
      }
    })
  );
}

export type ClosedCheckResult = {
  updatedCount: number;
  checked: number;
  failed: number;
  logs: string[];
};

type IndexedJob = { job: { link: string; title?: string; isClosed?: boolean }; index: number };

function buildJobLogBlock(
  total: number,
  { job, index }: IndexedJob,
  check: PageCheckResult,
  markedClosed: boolean
): string[] {
  const label = job.title?.trim() || 'Untitled job';
  const lines = [
    `**[${index + 1}/${total}]** ${label}`,
    `  URL: ${truncateUrl(job.link)}`,
  ];

  if (!check.ok) {
    lines.push(`  **Error:** ${check.error}`);
    return lines;
  }

  const statusLabel =
    check.httpStatus === null ? '—' : String(check.httpStatus);
  lines.push(`  HTTP ${statusLabel}`);

  if (markedClosed) {
    lines.push(`  Result: **closed** (inactive)`);
  } else {
    lines.push(`  Result: open (still listed)`);
  }

  return lines;
}

export async function markClosedJobsWithPlaywright<
  T extends { link: string; title?: string; isClosed?: boolean },
>(
  activeJobs: T[],
  options?: {
    concurrency?: number;
    navigationTimeoutMs?: number;
    maxLogLines?: number;
  }
): Promise<ClosedCheckResult> {
  const concurrency = options?.concurrency ?? 3;
  const navigationTimeoutMs = options?.navigationTimeoutMs ?? 25000;
  const maxLogLines = options?.maxLogLines ?? 500;

  let updatedCount = 0;
  let failed = 0;

  const total = activeJobs.length;

  if (total === 0) {
    return {
      updatedCount: 0,
      checked: 0,
      failed: 0,
      logs: ['No active jobs to check.'],
    };
  }

  const indexed: IndexedJob[] = activeJobs.map((job, index) => ({
    job,
    index,
  }));

  const logBuckets: string[][] = new Array(total);

  const browser: Browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: DEFAULT_UA,
      locale: 'en-US',
    });

    await runPool(indexed, concurrency, async (entry) => {
      const { job, index } = entry;
      const lines: string[] = [];

      try {
        const check = await checkJobClosedWithPage(
          context,
          job.link,
          navigationTimeoutMs
        );

        let markedClosed = false;
        if (check.ok && check.closed) {
          job.isClosed = true;
          updatedCount++;
          markedClosed = true;
        }

        if (!check.ok) {
          failed++;
        }

        lines.push(
          ...buildJobLogBlock(total, entry, check, markedClosed)
        );
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        lines.push(
          `**[${index + 1}/${total}]** ${job.title?.trim() || 'Untitled job'}`,
          `  URL: ${truncateUrl(job.link)}`,
          `  **Error:** ${msg}`
        );
      }

      logBuckets[index] = lines;
    });

    await context.close();
  } finally {
    await browser.close();
  }

  const flatLogs = logBuckets.flat();
  const logs =
    flatLogs.length > maxLogLines
      ? [
          ...flatLogs.slice(0, maxLogLines),
          `… truncated (${flatLogs.length} lines total, max ${maxLogLines})`,
        ]
      : flatLogs;

  const header = [
    `Starting closed-job check (${total} job${total === 1 ? '' : 's'}, concurrency ${concurrency})`,
    '—',
  ];

  return {
    updatedCount,
    checked: total,
    failed,
    logs: [...header, ...logs],
  };
}
