import { ContractRegistryService } from '@/platform/host/contract-registry/contract-registry.service';
import { ORDER_ENGINE_CONTRACT } from '../../contracts/order-engine.contract';

/**
 * Register Order Engine with Contract Registry at startup
 */
export async function registerOrderEngine(
  contractRegistry: ContractRegistryService
): Promise<void> {
  try {
    contractRegistry.registerContract(ORDER_ENGINE_CONTRACT);

    console.log(
      `[OrderEngine] Contract registered: ${ORDER_ENGINE_CONTRACT.name} v${ORDER_ENGINE_CONTRACT.version}`
    );

    console.log(
      `[OrderEngine] ${ORDER_ENGINE_CONTRACT.endpoints?.length || 0} endpoints declared`
    );

    console.log(
      `[OrderEngine] ${ORDER_ENGINE_CONTRACT.events?.length || 0} event types registered`
    );

    console.log('[OrderEngine] Registration complete ✅');
  } catch (error) {
    console.error('[OrderEngine] Registration failed:', error);
    throw error;
  }
}

/**
 * Unregister Order Engine (for graceful shutdown)
 */
export async function unregisterOrderEngine(): Promise<void> {
  try {
    console.log('[OrderEngine] Unregistration not implemented yet');
  } catch (error) {
    console.error('[OrderEngine] Unregistration failed:', error);
    throw error;
  }
}
