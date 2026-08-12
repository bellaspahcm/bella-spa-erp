/**
 * Healthcare Platform Bootstrap
 * 
 * @layer Healthcare Platform → Platform Initialization
 * @責任 Initialize and register all Healthcare engines at startup
 * 
 * Flow:
 * App Startup → Host Platform Init → Healthcare Platform Bootstrap → Register All Engines
 */

import { ContractRegistryService } from '@/platform/host/contract-registry/contract-registry.service';
import { registerEncounterEngine } from './engines/encounter-engine/encounter-engine.registration';
import { registerOrderEngine } from './engines/order-engine/order-engine.registration';
import { registerPharmacyEngine } from './engines/pharmacy-engine/pharmacy-engine.registration';

/**
 * ✅ Phase 3 - Bootstrap Healthcare Platform
 * 
 * Gọi hàm này khi app khởi động (trong app/layout.tsx hoặc middleware)
 */
export async function bootstrapHealthcarePlatform(
  contractRegistry?: ContractRegistryService
): Promise<void> {
  const registry = contractRegistry || ContractRegistryService.getInstance();
  console.log('[HealthcarePlatform] Bootstrapping...');

  try {
    // ===========================
    // Register Encounter Engine
    // ===========================
    await registerEncounterEngine(registry);

    // ===========================
    // Register Order Engine
    // ===========================
    await registerOrderEngine(registry);

    // ===========================
    // Register Pharmacy Engine
    // ===========================
    await registerPharmacyEngine(contractRegistry);

    console.log('[HealthcarePlatform] Bootstrap complete ✅');
  } catch (error) {
    console.error('[HealthcarePlatform] Bootstrap failed:', error);
    throw error;
  }
}

/**
 * ✅ Phase 3 - Shutdown Healthcare Platform (for graceful shutdown)
 */
export async function shutdownHealthcarePlatform(): Promise<void> {
  console.log('[HealthcarePlatform] Shutting down...');

  try {
    // Unregister engines in reverse order
    // await unregisterEncounterEngine();

    console.log('[HealthcarePlatform] Shutdown complete');
  } catch (error) {
    console.error('[HealthcarePlatform] Shutdown failed:', error);
    throw error;
  }
}
