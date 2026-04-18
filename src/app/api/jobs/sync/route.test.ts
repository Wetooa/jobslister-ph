import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/storage', () => ({
  Storage: {
    getJobs: vi.fn(),
    saveJobs: vi.fn(),
  },
}));

vi.mock('@/lib/job-closed', () => ({
  markClosedJobsWithPlaywright: vi.fn(),
}));

import { POST } from './route';
import { Storage } from '@/lib/storage';
import { markClosedJobsWithPlaywright } from '@/lib/job-closed';

const mockGetJobs = vi.mocked(Storage.getJobs);
const mockSaveJobs = vi.mocked(Storage.saveJobs);
const mockMarkClosed = vi.mocked(markClosedJobsWithPlaywright);

describe('POST /api/jobs/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns logs and counts; saves when jobs marked closed', async () => {
    const jobs = [
      { title: 'A', link: 'https://x.com/a', isClosed: false },
      { title: 'B', link: 'https://x.com/b', isClosed: true },
    ];
    mockGetJobs.mockReturnValue(jobs);
    mockMarkClosed.mockImplementation(async (active) => {
      if (active[0]) active[0].isClosed = true;
      return {
        updatedCount: 1,
        checked: 1,
        failed: 0,
        logs: ['line1', 'line2'],
      };
    });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updatedCount).toBe(1);
    expect(body.checked).toBe(1);
    expect(body.failed).toBe(0);
    expect(body.logs).toEqual(['line1', 'line2']);

    expect(mockSaveJobs).toHaveBeenCalledWith(jobs);
  });

  it('does not save when updatedCount is zero', async () => {
    mockGetJobs.mockReturnValue([
      { title: 'Open', link: 'https://x.com/o', isClosed: false },
    ]);
    mockMarkClosed.mockResolvedValue({
      updatedCount: 0,
      checked: 1,
      failed: 0,
      logs: ['ok'],
    });

    const res = await POST();
    const body = await res.json();

    expect(body.updatedCount).toBe(0);
    expect(mockSaveJobs).not.toHaveBeenCalled();
  });

  it('returns 500 when markClosed throws', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockGetJobs.mockReturnValue([]);
      mockMarkClosed.mockRejectedValue(new Error('browser exploded'));

      const res = await POST();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Failed to sync job statuses');
    } finally {
      errSpy.mockRestore();
    }
  });
});
