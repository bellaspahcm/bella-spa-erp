import { SupabaseClient } from '@supabase/supabase-js';
import { ClinicalOrderService } from './services/clinical-order.service';
import { SupabaseOrderRepository } from './repositories/supabase-order-repository';
import { SupabaseEncounterReader } from './repositories/supabase-encounter-reader';
import { HostEventBusBridge } from './contracts/host-event-bus-bridge';
import { eventBus as hostEventBus } from '@/platform/host/event-bus/event-bus.service';
import type { Database } from '@/types/database.types';

/**
 * Factory pattern ensures:
 * 1. Dependencies are wired and injected correctly
 * 2. Single configuration entry point
 * 3. Support mocking for test isolations
 */
export function createClinicalOrderService(
  supabase: SupabaseClient<Database>
): ClinicalOrderService {
  const repository = new SupabaseOrderRepository(supabase);
  const encounterReader = new SupabaseEncounterReader(supabase);
  const eventBusBridge = new HostEventBusBridge(hostEventBus);
  
  return new ClinicalOrderService(repository, encounterReader, eventBusBridge);
}

let globalService: ClinicalOrderService | null = null;

/**
 * Singleton pattern for global access to the engine service
 */
export function getClinicalOrderService(
  supabase: SupabaseClient<Database>
): ClinicalOrderService {
  if (!globalService) {
    globalService = createClinicalOrderService(supabase);
  }
  return globalService;
}

/**
 * Reset service instance (useful for test suites cleanup)
 */
export function resetClinicalOrderService(): void {
  globalService = null;
}
