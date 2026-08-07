/**
 * Event Bus Wirings
 * Initialize all cross-engine event subscriptions
 */

import { wireBedToBilling } from './bed-to-billing.wiring';
import { wireMedicationToTimeline } from './medication-to-timeline.wiring';
import { wireVitalsToAIAlerts } from './vitals-to-ai-alerts.wiring';

/**
 * Initialize all event wirings
 * Call this once on app startup
 */
export function initializeEventWirings(): () => void {
  console.log('[EventBus] Initializing event wirings...');

  const unsubscribers = [
    wireBedToBilling(),
    wireMedicationToTimeline(),
    wireVitalsToAIAlerts(),
  ];

  console.log('[EventBus] ✅ All wirings initialized');

  // Return cleanup function
  return () => {
    console.log('[EventBus] Cleaning up wirings...');
    unsubscribers.forEach((unsub) => unsub());
  };
}

// Export individual wirings for testing
export { wireBedToBilling, wireMedicationToTimeline, wireVitalsToAIAlerts };
