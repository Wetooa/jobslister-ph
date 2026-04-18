import { NextRequest, NextResponse } from 'next/server';
import { LLMClient } from '@/lib/llm';
import fs from 'fs';
import path from 'path';
import { Storage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profile = Storage.getProfile();
  
  // Also check for any PDF files in the root that could be CVs
  const files = fs.readdirSync(process.cwd());
  const localCVs = files.filter(f => f.toLowerCase().endsWith('.pdf') && !f.startsWith('temp_'));

  return NextResponse.json({ profile, localCVs });
}
export async function POST(req: NextRequest) {
  try {
    let filePath: string;
    let isTemp = false;

    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      
      const buffer = Buffer.from(await file.arrayBuffer());
      filePath = path.join(process.cwd(), 'temp_resume.pdf');
      fs.writeFileSync(filePath, buffer);
      isTemp = true;
    } else {
      const { localFileName } = await req.json();
      if (!localFileName) return NextResponse.json({ error: 'No file specified' }, { status: 400 });
      filePath = path.join(process.cwd(), localFileName);
      if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'File not found locally' }, { status: 404 });
    }

    // Parse PDF
    const { parseResume } = await import('@/lib/parser');
    const text = await parseResume(filePath);
    
    // Analyze with LLM
    const llm = new LLMClient();
    const profile = await llm.analyzeResume(text);

    // Save profile and manifest
    const profilePath = path.join(process.cwd(), 'profile.json');
    const manifestPath = path.join(process.cwd(), 'manifest.json');
    
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    fs.writeFileSync(manifestPath, JSON.stringify({ lastParsed: new Date().toISOString() }, null, 2));

    // Cleanup if temp
    if (isTemp && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
