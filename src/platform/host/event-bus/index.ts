/**
 * Event Bus - Public API
 * Platform-of-Platforms: Host Platform
 */

export * from './types';
export * from './event-bus.service';
export * from './memory-adapter';
export * from './initialize';

// Re-export singleton
export { eventBus } from './event-bus.service';
