import { moduleRegistry } from '@/core/adapters/registry';
import { RealEstateModuleAdapter } from './adapters/RealEstateModuleAdapter';

/**
 * Register Real Estate vertical module.
 * 
 * Registers the RealEstateModuleAdapter in the global module registry
 * to enable real estate functionalities.
 */
export function registerRealEstateModule(): void {
  try {
    if (!moduleRegistry.has('real_estate')) {
      const realEstateAdapter = new RealEstateModuleAdapter();
      moduleRegistry.register(realEstateAdapter);
      console.log('[RealEstateModule] ✅ Registered adapter for module: real_estate (Real Estate Management)');
    }
  } catch (error) {
    console.error('[RealEstateModule] ❌ Failed to register Real Estate module adapter:', error);
  }
}

// Auto-register on import
registerRealEstateModule();
