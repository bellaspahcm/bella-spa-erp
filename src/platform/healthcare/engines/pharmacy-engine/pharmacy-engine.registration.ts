import { ContractRegistryService } from '@/platform/host/contract-registry/contract-registry.service';
import { PHARMACY_ENGINE_CONTRACT } from '../../contracts/pharmacy-engine.contract';

/**
 * Register Pharmacy Engine with Contract Registry at startup
 */
export async function registerPharmacyEngine(
  contractRegistry: ContractRegistryService
): Promise<void> {
  try {
    contractRegistry.registerContract(PHARMACY_ENGINE_CONTRACT);

    console.log(
      `[PharmacyEngine] Contract registered: ${PHARMACY_ENGINE_CONTRACT.name} v${PHARMACY_ENGINE_CONTRACT.version}`
    );

    console.log(
      `[PharmacyEngine] ${PHARMACY_ENGINE_CONTRACT.endpoints?.length || 0} endpoints declared`
    );

    console.log(
      `[PharmacyEngine] ${PHARMACY_ENGINE_CONTRACT.events?.length || 0} event types registered`
    );

    console.log('[PharmacyEngine] Registration complete ✅');
  } catch (error) {
    console.error('[PharmacyEngine] Registration failed:', error);
    throw error;
  }
}

/**
 * Unregister Pharmacy Engine (for graceful shutdown)
 */
export async function unregisterPharmacyEngine(): Promise<void> {
  try {
    console.log('[PharmacyEngine] Unregistration not implemented yet');
  } catch (error) {
    console.error('[PharmacyEngine] Unregistration failed:', error);
    throw error;
  }
}
