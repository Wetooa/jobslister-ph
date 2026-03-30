import { NextRequest } from 'next/server';
import { scanEmitter } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const logHandler = (message: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'log', message })}\n\n`));
      };

      const errorHandler = (message: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'error', message })}\n\n`));
      };

      const completeHandler = () => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'complete' })}\n\n`));
      };

      // Ensure we clean up listeners when the client disconnects
      req.signal.addEventListener('abort', () => {
        scanEmitter.off('log', logHandler);
        scanEmitter.off('error', errorHandler);
        scanEmitter.off('complete', completeHandler);
      });

      // Attach listeners
      scanEmitter.on('log', logHandler);
      scanEmitter.on('error', errorHandler);
      scanEmitter.on('complete', completeHandler);

      // Welcome message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'log', message: 'Connected to background scan stream...' })}\n\n`));
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
