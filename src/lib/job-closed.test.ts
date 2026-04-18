import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLaunch = vi.fn();

vi.mock('playwright', () => ({
  chromium: {
    launch: (...args: unknown[]) => mockLaunch(...args),
  },
}));

type PageScenario = {
  status?: number;
  bodyText?: string;
  html?: string;
  gotoError?: Error;
};

let scenarios: PageScenario[] = [];
let scenarioIndex = 0;

function nextScenario(): PageScenario {
  return scenarios[scenarioIndex++] ?? {
    status: 200,
    bodyText: 'open listing',
    html: '<html><body>ok</body></html>',
  };
}

function createMockBrowser() {
  return {
    newContext: vi.fn(async () => ({
      newPage: vi.fn(async () => {
        const s = nextScenario();
        return {
          goto: vi.fn(async () => {
            if (s.gotoError) throw s.gotoError;
            const st = s.status ?? 200;
            return { status: () => st };
          }),
          evaluate: vi.fn(async () => (s.bodyText ?? '').toLowerCase()),
          content: vi.fn(async () => (s.html ?? '<html></html>').toLowerCase()),
          close: vi.fn().mockResolvedValue(undefined),
        };
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

import {
  checkJobClosedWithPage,
  markClosedJobsWithPlaywright,
} from './job-closed';

describe('checkJobClosedWithPage', () => {
  beforeEach(() => {
    scenarios = [];
    scenarioIndex = 0;
    mockLaunch.mockResolvedValue(createMockBrowser());
  });

  it('returns closed true on HTTP 404', async () => {
    scenarios = [{ status: 404 }];
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const result = await checkJobClosedWithPage(ctx, 'https://example.com/job', 5000);
    expect(result).toEqual({ ok: true, closed: true, httpStatus: 404 });
  });

  it('detects closed from page text', async () => {
    scenarios = [
      {
        status: 200,
        bodyText: 'Sorry this job has been closed',
        html: '<html></html>',
      },
    ];
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const result = await checkJobClosedWithPage(ctx, 'https://example.com/job', 5000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.closed).toBe(true);
      expect(result.httpStatus).toBe(200);
    }
  });

  it('returns open when listing is active', async () => {
    scenarios = [
      {
        status: 200,
        bodyText: 'We are hiring apply now',
        html: '<html><body>apply</body></html>',
      },
    ];
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const result = await checkJobClosedWithPage(ctx, 'https://example.com/job', 5000);
    expect(result).toEqual({ ok: true, closed: false, httpStatus: 200 });
  });

  it('returns error when navigation fails', async () => {
    scenarios = [{ status: 200, gotoError: new Error('net::ERR_ABORTED') }];
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const result = await checkJobClosedWithPage(ctx, 'https://example.com/job', 5000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('ERR_ABORTED');
    }
  });
});

describe('markClosedJobsWithPlaywright', () => {
  beforeEach(() => {
    scenarios = [];
    scenarioIndex = 0;
    mockLaunch.mockClear();
    mockLaunch.mockResolvedValue(createMockBrowser());
  });

  it('returns empty message when no jobs', async () => {
    const result = await markClosedJobsWithPlaywright([]);
    expect(result.checked).toBe(0);
    expect(result.logs).toEqual(['No active jobs to check.']);
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('marks jobs closed and preserves log order by index', async () => {
    scenarios = [
      { status: 200, bodyText: 'still open', html: '<html>x</html>' },
      { status: 404 },
      {
        status: 200,
        bodyText: 'this job has been closed',
        html: '<html></html>',
      },
    ];

    const jobs = [
      { link: 'https://a.com/1', title: 'Job A' },
      { link: 'https://a.com/2', title: 'Job B' },
      { link: 'https://a.com/3', title: 'Job C' },
    ];

    const result = await markClosedJobsWithPlaywright(jobs, {
      concurrency: 2,
      navigationTimeoutMs: 5000,
    });

    expect(result.checked).toBe(3);
    expect(result.updatedCount).toBe(2);
    expect(result.failed).toBe(0);
    expect(jobs[0].isClosed).toBeFalsy();
    expect(jobs[1].isClosed).toBe(true);
    expect(jobs[2].isClosed).toBe(true);

    const joined = result.logs.join('\n');
    expect(joined).toContain('Job A');
    expect(joined).toContain('Job B');
    expect(joined).toContain('Job C');
    expect(joined).toContain('Starting closed-job check (3 jobs');
    expect(joined).toMatch(/HTTP 200/);
    expect(joined).toMatch(/HTTP 404/);
  });

  it('truncates logs when exceeding maxLogLines', async () => {
    mockLaunch.mockResolvedValue(createMockBrowser());
    const many = Array.from({ length: 30 }, (_, i) => ({
      link: `https://x.com/j${i}`,
      title: `T${i}`,
    }));
    scenarios = many.map(() => ({
      status: 200,
      bodyText: 'ok',
      html: '<html></html>',
    }));

    const result = await markClosedJobsWithPlaywright(many, {
      concurrency: 5,
      maxLogLines: 8,
      navigationTimeoutMs: 3000,
    });

    expect(result.logs.some((l) => l.includes('truncated'))).toBe(true);
  });

  it('counts failed when page check returns error', async () => {
    scenarios = [
      { status: 200, gotoError: new Error('timeout') },
      { status: 200, bodyText: 'ok', html: '<html></html>' },
    ];
    const jobs = [
      { link: 'https://bad.com', title: 'Bad' },
      { link: 'https://good.com', title: 'Good' },
    ];

    const result = await markClosedJobsWithPlaywright(jobs, {
      concurrency: 1,
      navigationTimeoutMs: 3000,
    });

    expect(result.failed).toBe(1);
    expect(result.logs.join('\n')).toContain('timeout');
  });
});
