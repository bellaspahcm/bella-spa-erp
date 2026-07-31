import type { ModuleAdapter, ModuleId } from '@/core/types';
import type { CoreBookingOrder } from '@/core/types/booking-order';
import type { TenantContext } from '@/core/types/tenant';

/**
 * Real Estate Module Adapter Implementation
 * 
 * Provides real estate specific business rules, pricing hooks,
 * and side effects.
 * 
 * @module RealEstateModuleAdapter
 * @implements {ModuleAdapter}
 */
export class RealEstateModuleAdapter implements ModuleAdapter {
  readonly moduleId: ModuleId = 'real_estate';
  readonly moduleName: string = 'Real Estate Management';

  /**
   * Validate booking/reservation rules for Real Estate.
   * 
   * @param order - Booking order representing unit reservation
   * @param context - Tenant context
   * @returns True if the reservation complies with business rules
   */
  async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    console.log(`[RealEstateAdapter] Validating reservation for order ${order.id}`);
    
    // Ensure tenant isolation
    if (order.tenantId && order.tenantId !== context.tenantId) {
      console.error('[RealEstateAdapter] Tenant leakage check failed!');
      return false;
    }

    // Default stub: allow booking
    return true;
  }

  /**
   * Return empty widgets list for now.
   */
  getModuleWidgets() {
    return [
      {
        id: 'real-estate-overview',
        component: 'RealEstateOverviewWidget',
        title: 'Tổng Quan Dự Án',
        size: 'large',
      }
    ];
  }
}
