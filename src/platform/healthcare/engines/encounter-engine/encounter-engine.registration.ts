/**
 * Encounter Engine Registration
 * 
 * @layer Healthcare Platform → Engine Lifecycle
 * @責任 Register Encounter Engine with Contract Registry at startup
 * 
 * Flow:
 * App Startup → Healthcare Platform Init → Register All Engines → Encounter Engine Registration
 */

import { ContractRegistryService } from '@/platform/host/contract-registry/contract-registry.service';
import { EncounterEngineContract } from './encounter-engine.contract';
import type { ContractMetadata } from '@/platform/host/contract-registry/types';

/**
 * ✅ Phase 3 - Register Encounter Engine
 * 
 * Gọi hàm này khi Healthcare Platform khởi động.
 * Từ đây Encounter Engine trở thành năng lực chính thức của Platform.
 */
export async function registerEncounterEngine(
  contractRegistry: ContractRegistryService
): Promise<void> {
  try {
    // 1. Register engine contract
    const contractMetadata: ContractMetadata = {
      name: EncounterEngineContract.engineId,
      version: EncounterEngineContract.version,
      type: 'engine',
      description: EncounterEngineContract.description,
      owner: 'Healthcare Platform Team',
      status: 'active',
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    contractRegistry.registerContract(contractMetadata);

    console.log(
      `[EncounterEngine] Contract registered: ${EncounterEngineContract.engineId} v${EncounterEngineContract.version}`
    );

    console.log(
      `[EncounterEngine] ${EncounterEngineContract.capabilities.length} capabilities declared`
    );

    console.log(
      `[EncounterEngine] ${EncounterEngineContract.events.length} event types registered`
    );

    console.log('[EncounterEngine] Registration complete ✅');
  } catch (error) {
    console.error('[EncounterEngine] Registration failed:', error);
    throw error;
  }
}

/**
 * ✅ Phase 3 - Unregister Encounter Engine (for graceful shutdown)
 */
export async function unregisterEncounterEngine(): Promise<void> {
  try {
    console.log('[EncounterEngine] Unregistration not implemented yet');
  } catch (error) {
    console.error('[EncounterEngine] Unregistration failed:', error);
    throw error;
  }
}
