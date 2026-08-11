/**
 * Encounter Engine Factory
 * 
 * @layer Healthcare Platform → Engine Lifecycle
 * @責任 Create and configure Encounter Engine instances with dependencies
 * 
 * Usage:
 * ```typescript
 * const encounterEngine = createEncounterEngine(supabase);
 * const result = await encounterEngine.createEncounter({ ... });
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EventBusService } from '@/platform/host/event-bus/event-bus.service';
import { EncounterEngineService } from './encounter-engine.service';
import { SupabaseEncounterRepository } from './infrastructure/supabase-encounter.repository';
import type { IEncounterEngine } from './encounter-engine.interface';
import type { Database } from '@/types/database.types';

/**
 * ✅ Phase 3 - Create Encounter Engine Instance
 * 
 * Factory pattern ensures:
 * 1. Dependencies injected correctly
 * 2. Single configuration point
 * 3. Easy to mock for testing
 */
export function createEncounterEngine(
  supabase: SupabaseClient<Database>
): IEncounterEngine {
  // Create dependencies
  const repository = new SupabaseEncounterRepository(supabase);
  const eventBus = new EventBusService();

  // Create service with dependencies
  const service = new EncounterEngineService(repository, eventBus);

  return service;
}

/**
 * ✅ Phase 3 - Singleton pattern for global access
 * 
 * Use this in Next.js Server Actions:
 * ```typescript
 * import { getEncounterEngine } from '@/platform/healthcare/engines/encounter-engine';
 * 
 * export async function createEncounterAction(request: CreateEncounterRequest) {
 *   const supabase = await createServerClient();
 *   const engine = getEncounterEngine(supabase);
 *   return engine.createEncounter(request);
 * }
 * ```
 */
let globalEngine: IEncounterEngine | null = null;

export function getEncounterEngine(
  supabase: SupabaseClient<Database>
): IEncounterEngine {
  if (!globalEngine) {
    globalEngine = createEncounterEngine(supabase);
  }
  return globalEngine;
}

/**
 * ✅ Phase 3 - Reset for testing
 */
export function resetEncounterEngine(): void {
  globalEngine = null;
}
