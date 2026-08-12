/**
 * Bella Meta-Platform — Unified Platform Bootstrapper
 * 
 * Initializes Common Core primitives and registers both Healthcare OS and Education OS
 * contracts side-by-side on the exact same platform core.
 * 
 * @module platform/bootstrap
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CoreContractRegistry, MemoryEventBusAdapter, PlatformContractRegistry } from './core';
import { EducationEngineService, registerEducationEngine, SupabaseEducationRepository } from './education';
import { bootstrapHealthcarePlatform } from './healthcare/healthcare-platform.bootstrap';

export interface PlatformBootstrapOptions {
  supabaseClient: SupabaseClient<any>;
  contractRegistry?: PlatformContractRegistry;
  eventBus?: MemoryEventBusAdapter;
}

export interface PlatformContainer {
  contractRegistry: PlatformContractRegistry;
  eventBus: MemoryEventBusAdapter;
  educationService: EducationEngineService;
}

export async function bootstrapUnifiedPlatform(options: PlatformBootstrapOptions): Promise<PlatformContainer> {
  console.log('[MetaPlatform] Starting Unified Platform Bootstrap...');

  // 1. Common Core Infrastructure
  const contractRegistry = options.contractRegistry || new CoreContractRegistry();
  const eventBus = options.eventBus || new MemoryEventBusAdapter();

  // 2. Healthcare OS Registration
  await bootstrapHealthcarePlatform(contractRegistry as any);
  console.log('[MetaPlatform] Healthcare OS registered successfully.');

  // 3. Education OS Registration
  const educationRepo = new SupabaseEducationRepository(options.supabaseClient);
  const educationService = new EducationEngineService(educationRepo, eventBus);
  registerEducationEngine(contractRegistry, educationService);
  console.log('[MetaPlatform] Education OS registered successfully.');

  console.log('[MetaPlatform] Unified Platform Bootstrap Complete — Dual Domain Active.');

  return {
    contractRegistry,
    eventBus,
    educationService,
  };
}
