import { EventEmitter } from 'events';

// Create a global singleton to prevent re-initialization during HMR in development
const globalForEvents = global as unknown as { eventEmitter: EventEmitter };

export const scanEmitter =
  globalForEvents.eventEmitter || new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.eventEmitter = scanEmitter;
}
