/**
 * Event Bus - Public API
 * Platform-of-Platforms: Host Platform
 */

export * from './types';
export * from './event-bus.service';
export * from './memory-adapter';
// NOTE: initialize is NOT exported here to prevent transitive imports
// of domain-specific event wirings (Healthcare, Education, etc.)
// App initialization should import initialize.ts directly if needed.
// export * from './initialize';  // REMOVED - pulls Healthcare wirings into all consumers

// Re-export singleton
export { eventBus } from './event-bus.service';
