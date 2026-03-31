import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@/lib/storage';
import { ProfileScraper } from '@/lib/scraper';
import { LLMClient } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { portfolioUrl } = await req.json();
    if (!portfolioUrl) {
      return NextResponse.json({ error: 'Portfolio URL is required' }, { status: 400 });
    }

    const currentProfile = Storage.getProfile();
    if (!currentProfile) {
      return NextResponse.json({ error: 'Please upload a CV first' }, { status: 400 });
    }

    // Initialize scraper and AI
    const scraper = new ProfileScraper();
    const llm = new LLMClient();

    // 1. Recursive Crawl
    console.log(`[API] Starting recursive scan of ${portfolioUrl}...`);
    const scrapedContent = await scraper.scanPortfolio(portfolioUrl, 2);
    await scraper.close();

    // 2. AI Enhancement
    console.log(`[API] Enhancing profile with ${scrapedContent.length} chars of web data...`);
    const enhancedProfile = await llm.enhanceProfileWithScrapedData(currentProfile, scrapedContent);

    if ('error' in enhancedProfile) {
      return NextResponse.json({ error: enhancedProfile.error }, { status: 500 });
    }

    // 3. Update current portfolios list
    const updatedPortfolios = Array.from(new Set([...(currentProfile.portfolios || []), portfolioUrl]));
    enhancedProfile.portfolios = updatedPortfolios;

    // 4. Persistence
    Storage.saveProfile(enhancedProfile);

    return NextResponse.json({ success: true, profile: enhancedProfile });
  } catch (error: any) {
    console.error('Portfolio scan error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const profile = Storage.getProfile();
  return NextResponse.json({ profile });
}
