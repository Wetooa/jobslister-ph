'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Terminal, Loader2 } from 'lucide-react';

interface ScanTerminalProps {
  logs: string[];
  isComplete: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
}

export function ScanTerminal({
  logs,
  isComplete,
  title = 'Automated Scan Progress',
  description = 'Real-time backend execution logs for scraping and AI analysis.',
  emptyMessage = 'Initializing scanner...',
}: ScanTerminalProps) {
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
    isAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  return (
    <Card className="overflow-hidden rounded-2xl border border-emerald-900/40 bg-slate-950 font-mono text-emerald-400 shadow-xl backdrop-blur-sm">
      <CardHeader className="border-b border-slate-800/80 bg-black/40">
        <CardTitle className="flex items-center gap-2 font-sans text-xl tracking-tight text-slate-200">
          <Terminal className="h-5 w-5 text-emerald-500" />
          {title}
          {!isComplete && <Loader2 className="ml-auto h-4 w-4 animate-spin text-emerald-500" />}
        </CardTitle>
        <CardDescription className="font-sans text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-[400px] space-y-1.5 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-emerald-900"
        >
          {logs.length === 0 ? (
            <div className="italic text-emerald-700">{emptyMessage}</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="break-words text-sm leading-relaxed whitespace-pre-wrap">
                <span className="mr-2 text-slate-500">
                  [{new Date().toLocaleTimeString(undefined, { hour12: false, second: '2-digit' })}]
                </span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: log
                      .replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-bold">$1</span>')
                      .replace(/Error:|Failed:/g, '<span class="text-red-400 font-bold">$&</span>'),
                  }}
                />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
