import { NextResponse } from 'next/server';
import { Storage } from '@/lib/storage';
import { markClosedJobsWithPlaywright } from '@/lib/job-closed';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const jobCache = Storage.getJobs();

    const activeJobs = jobCache.filter((j) => !j.isClosed);

    const { updatedCount, checked, failed, logs } =
      await markClosedJobsWithPlaywright(activeJobs, {
        concurrency: 3,
        navigationTimeoutMs: 25000,
      });

    if (updatedCount > 0) {
      Storage.saveJobs(jobCache);
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      checked,
      failed,
      logs,
    });
  } catch (error) {
    console.error('Job sync failed:', error);
    return NextResponse.json(
      { error: 'Failed to sync job statuses' },
      { status: 500 }
    );
  }
}
