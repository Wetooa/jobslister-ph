import { NextResponse } from 'next/server';
import { Storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const jobCache = Storage.getJobs();
    let updatedCount = 0;

    // We only check jobs that are NOT already closed to save bandwidth
    const activeJobs = jobCache.filter(j => !j.isClosed);
    
    // Process in batches to prevent overwhelming the application or target server
    const BATCH_SIZE = 15;
    
    for (let i = 0; i < activeJobs.length; i += BATCH_SIZE) {
      const batch = activeJobs.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (job) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const res = await fetch(job.link, { 
            signal: controller.signal,
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'text/html'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const text = await res.text();
            // Using the exact text match specified by user's raw HTML snippet
            if (text.includes('This job has been closed')) {
              job.isClosed = true;
              updatedCount++;
            }
          }
        } catch (e) {
          // Silently ignore individual network errors to keep batch processing
        }
      }));
    }

    if (updatedCount > 0) {
      Storage.saveJobs(jobCache);
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Job sync failed:', error);
    return NextResponse.json({ error: 'Failed to sync job statuses' }, { status: 500 });
  }
}
