import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PATCH } from './route';
import { Storage } from '@/lib/storage';

const mockSearchJobs = vi.fn();
const mockGetJobDetails = vi.fn();
const mockClose = vi.fn();
const mockCompareJob = vi.fn();
const emitMock = vi.fn();

vi.mock('@/lib/scraper', () => ({
  JobScraper: vi.fn().mockImplementation(() => ({
    searchJobs: mockSearchJobs,
    getJobDetails: mockGetJobDetails,
    close: mockClose,
  })),
}));

vi.mock('@/lib/llm', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    compareJob: mockCompareJob,
  })),
}));

vi.mock('@/lib/events', () => ({
  scanEmitter: {
    emit: (...args: unknown[]) => emitMock(...args),
  },
}));

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return {
    ...actual,
    Storage: {
      ...actual.Storage,
      getProfile: vi.fn(),
      getJobs: vi.fn(),
      getAnalysis: vi.fn(),
      saveJobs: vi.fn(),
      saveAnalysis: vi.fn(),
    },
  };
});

const mockGetProfile = vi.mocked(Storage.getProfile);
const mockGetJobs = vi.mocked(Storage.getJobs);
const mockGetAnalysis = vi.mocked(Storage.getAnalysis);
const mockSaveJobs = vi.mocked(Storage.saveJobs);
const mockSaveAnalysis = vi.mocked(Storage.saveAnalysis);

describe('/api/jobs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockReturnValue({
      skills: { core: ['react'] },
      projects: [],
    });
    mockGetAnalysis.mockReturnValue({
      'https://x.com/analyzed': {
        matchScore: 90,
        pros: ['good'],
        cons: [],
        recommendation: 'Apply',
        reasoning: 'already done',
      },
    });
    mockGetJobDetails.mockResolvedValue({
      description: 'new description',
      skills: 'React',
    });
    mockSearchJobs.mockResolvedValue([
      { title: 'Analyzed', link: 'https://x.com/analyzed/' },
      { title: 'New Job', link: 'https://x.com/new-job/' },
    ]);
    mockCompareJob.mockResolvedValue({
      matchScore: 81,
      pros: ['fit'],
      cons: [],
      recommendation: 'Apply',
      reasoning: 'strong fit',
    });
  });

  it('skips re-analysis for links already present in analysis cache', async () => {
    mockGetJobs.mockReturnValue([
      {
        title: 'Analyzed',
        link: 'https://x.com/analyzed',
        description: 'already has desc',
      },
      {
        title: 'Analyzed Duplicate',
        link: 'https://x.com/analyzed/',
        description: 'duplicate row',
      },
    ]);

    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ queries: ['react'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSaveJobs).toHaveBeenCalled();
    expect(mockCompareJob).toHaveBeenCalledTimes(1);
    const comparedContext = String(mockCompareJob.mock.calls[0][1]);
    expect(comparedContext).toContain('New Job');
    expect(comparedContext).not.toContain('Analyzed');
  });

  it('dedupes existing jobs on PATCH action dedupe and returns stats', async () => {
    mockGetJobs.mockReturnValue([
      { title: 'A', link: 'https://x.com/job/1/', tags: ['react'] },
      {
        title: 'A',
        link: 'https://x.com/job/1',
        description: 'details',
        tags: ['typescript'],
      },
      { title: 'B', link: 'https://x.com/job/2' },
    ]);

    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'dedupe' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.beforeCount).toBe(3);
    expect(body.afterCount).toBe(2);
    expect(body.removedDuplicates).toBe(1);
    expect(mockSaveJobs).toHaveBeenCalledTimes(1);
  });
});
