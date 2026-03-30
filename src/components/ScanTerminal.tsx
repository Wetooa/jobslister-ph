'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Terminal, Loader2 } from 'lucide-react';

interface ScanTerminalProps {
  logs: string[];
  isComplete: boolean;
}

export function ScanTerminal({ logs, isComplete }: ScanTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScroll = useRef(true);

  useEffect(() => {
    if (!containerRef.current || !isAutoScroll.current) return;
    const { scrollHeight, clientHeight } = containerRef.current;
    containerRef.current.scrollTop = scrollHeight - clientHeight;
  }, [logs]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // If user is within 50px of the bottom, enable auto-scroll, otherwise stop it
    isAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden bg-slate-950 text-emerald-400 font-mono">
      <CardHeader className="border-b border-slate-800 bg-black/40">
        <CardTitle className="text-xl flex items-center gap-2 text-slate-200 font-sans tracking-tight">
          <Terminal className="w-5 h-5 text-emerald-500" />
          Automated Scan Progress
          {!isComplete && <Loader2 className="w-4 h-4 ml-auto text-emerald-500 animate-spin" />}
        </CardTitle>
        <CardDescription className="text-slate-400 font-sans">
          Real-time backend execution logs for scraping and AI analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-emerald-900 scrollbar-track-transparent"
        >
          {logs.length === 0 ? (
            <div className="text-emerald-700 italic">Initializing scanner...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString(undefined, { hour12: false, second: '2-digit' })}]</span>
                <span dangerouslySetInnerHTML={{ __html: log.replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-bold">$1</span>').replace(/Error:|Failed:/g, '<span class="text-red-400 font-bold">$&</span>') }} />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
