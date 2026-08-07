/**
 * Event Bus Initialization
 * Initialize all event wirings on app startup
 */

import { initializeEventWirings } from './wiring';

let cleanupFn: (() => void) | null = null;

/**
 * Initialize Event Bus and all wirings
 * Call this ONCE on app startup
 */
export function initializeEventBus(): void {
  if (cleanupFn) {
    console.warn('[EventBus] Already initialized - skipping');
    return;
  }

  console.log('[EventBus] 🚀 Initializing Event Bus...');
  
  // Initialize all cross-engine wirings
  cleanupFn = initializeEventWirings();
  
  console.log('[EventBus] ✅ Event Bus initialized successfully');
}

/**
 * Cleanup Event Bus (for testing or shutdown)
 */
export function cleanupEventBus(): void {
  if (cleanupFn) {
    console.log('[EventBus] 🧹 Cleaning up Event Bus...');
    cleanupFn();
    cleanupFn = null;
  }
}

// Auto-initialize in non-test environments
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  initializeEventBus();
}
