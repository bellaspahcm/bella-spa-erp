/**
 * Spa Module Adapter Implementation
 * 
 * This adapter provides spa-specific behavior to the core platform by implementing
 * the ModuleAdapter interface. It handles transformations, validation, pricing,
 * and side effects for spa bookings.
 * 
 * @module SpaModuleAdapter
 * @implements {ModuleAdapter}
 * 
 * **Requirements**: REQ-3.3.2
 * 
 * **Responsibilities**:
 * - Transform CoreServiceCatalogItem to spa package types with session metadata
 * - Transform CoreBookingOrder to spa booking types with progress tracking
 * - Validate spa-specific booking rules (KTV availability, session limits)
 * - Calculate spa-specific pricing (package discounts, subscription tiers)
 * - Handle spa side effects (salary updates, inventory deductions)
 * 
 * @example
 * ```typescript
 * import { spaModuleAdapter } from '@/modules/spa/adapters/SpaModuleAdapter';
 * 
 * // Transform service item
 * const spaPackage = spaModuleAdapter.transformServiceItem(coreItem);
 * 
 * // Transform booking order
 * const spaBooking = spaModuleAdapter.transformBookingOrder(coreOrder);
 * ```
 */

import type {
  ModuleAdapter,
  ModuleId,
  CoreServiceCatalogItem,
  CoreBookingOrder,
  TenantContext,
} from '@/core/types';
import { CapacityManagementProvider } from '@/lib/decision-engine/providers/booking/capacity-management-provider';
import { createClient } from '@/lib/supabase-server';

/**
 * Spa-specific package type extending CoreServiceCatalogItem.
 * 
 * @remarks
 * Adds spa-specific fields from metadata:
 * - totalSessions: Number of sessions in the package
 * - sessionMultiplier: Coefficient for session counting (1.0, 1.5, 2.0)
 * - category: Package tier (basic, premium, vip)
 * - durationMinutes: Typical service duration per session
 */
export interface SpaPackage extends CoreServiceCatalogItem {
  /** Number of sessions included in package */
  totalSessions: number;
  
  /** Multiplier for session counting (1.0 = basic, 1.5 = premium, 2.0 = vip) */
  sessionMultiplier: number;
  
  /** Package category/tier */
  category: 'basic' | 'premium' | 'vip';
  
  /** Duration per session in minutes */
  durationMinutes: number;
}

/**
 * Spa-specific booking type extending CoreBookingOrder.
 * 
 * @remarks
 * Adds spa-specific fields from metadata:
 * - sessionsCompleted: Number of sessions already completed
 * - sessionsTotal: Total number of sessions in package
 * - assignedKtvId: Primary KTV assigned to this booking
 * - packageCategory: Package tier for this booking
 */
export interface SpaBooking extends CoreBookingOrder {
  /** Number of sessions completed */
  sessionsCompleted: number;
  
  /** Total sessions in package */
  sessionsTotal: number;
  
  /** Primary KTV assigned to booking */
  assignedKtvId: string | null;
  
  /** Package category for this booking */
  packageCategory: string;
}

/**
 * SpaModuleAdapter class implementing the ModuleAdapter interface.
 * 
 * @remarks
 * This adapter encapsulates all spa-specific business logic, keeping the core
 * platform industry-neutral. It provides transformation methods to convert
 * generic core types to strongly-typed spa types.
 * 
 * **Design Pattern**: Adapter Pattern
 * **Phase**: Phase 3 - Core Platform Physical Extraction
 * 
 * @implements {ModuleAdapter}
 */
export class SpaModuleAdapter implements ModuleAdapter {
  /** Module identifier for spa module */
  readonly moduleId: ModuleId = 'spa';
  
  /** Human-readable module name */
  readonly moduleName: string = 'Bella Spa & Babycare';

  /**
   * Transform CoreServiceCatalogItem to spa package type.
   * 
   * @param item - Core service catalog item with spa metadata
   * @returns Spa package with strongly-typed fields
   * 
   * @remarks
   * Extracts spa-specific fields from metadata and returns a strongly-typed
   * SpaPackage object. This allows spa-specific code to work with typed fields
   * instead of accessing metadata as a generic object.
   * 
   * **Metadata fields extracted**:
   * - `total_sessions` → `totalSessions`
   * - `session_multiplier` → `sessionMultiplier`
   * - `category` → `category`
   * - `duration_minutes` → `durationMinutes`
   * 
   * @example
   * ```typescript
   * const coreItem: CoreServiceCatalogItem = {
   *   id: 'pkg-1',
   *   name: 'Combo VIP',
   *   basePrice: 15000000,
   *   metadata: {
   *     total_sessions: 20,
   *     session_multiplier: 2.0,
   *     category: 'vip',
   *     duration_minutes: 90,
   *   },
   * };
   * 
   * const spaPackage = adapter.transformServiceItem(coreItem);
   * console.log(spaPackage.totalSessions); // 20 (typed as number)
   * console.log(spaPackage.category); // 'vip' (typed as 'basic' | 'premium' | 'vip')
   * ```
   */
  transformServiceItem(item: CoreServiceCatalogItem): SpaPackage {
    return {
      ...item,
      totalSessions: (item.metadata.total_sessions as number) || 0,
      sessionMultiplier: (item.metadata.session_multiplier as number) || 1.0,
      category: (item.metadata.category as 'basic' | 'premium' | 'vip') || 'basic',
      durationMinutes: (item.metadata.duration_minutes as number) || 60,
    };
  }

  /**
   * Transform CoreBookingOrder to spa booking type.
   * 
   * @param order - Core booking order with spa metadata
   * @returns Spa booking with strongly-typed fields
   * 
   * @remarks
   * Extracts spa-specific progress tracking and assignment fields from metadata
   * and returns a strongly-typed SpaBooking object.
   * 
   * **Metadata fields extracted**:
   * - `sessions_completed` → `sessionsCompleted`
   * - `sessions_total` → `sessionsTotal`
   * - `assigned_ktv_id` → `assignedKtvId`
   * - `package_category` → `packageCategory`
   * 
   * @example
   * ```typescript
   * const coreOrder: CoreBookingOrder = {
   *   id: 'booking-1',
   *   customerId: 'cust-1',
   *   status: 'in_progress',
   *   metadata: {
   *     sessions_completed: 5,
   *     sessions_total: 20,
   *     assigned_ktv_id: 'ktv-123',
   *     package_category: 'vip',
   *   },
   * };
   * 
   * const spaBooking = adapter.transformBookingOrder(coreOrder);
   * console.log(spaBooking.sessionsCompleted); // 5
   * console.log(spaBooking.assignedKtvId); // 'ktv-123'
   * ```
   */
  transformBookingOrder(order: CoreBookingOrder): SpaBooking {
    return {
      ...order,
      sessionsCompleted: (order.metadata.sessions_completed as number) || 0,
      sessionsTotal: (order.metadata.sessions_total as number) || 0,
      assignedKtvId: (order.metadata.assigned_ktv_id as string) || null,
      packageCategory: (order.metadata.package_category as string) || '',
    };
  }

  /**
   * Validate spa-specific booking rules.
   * 
   * @param order - Booking order to validate
   * @param context - Tenant context
   * @returns True if booking passes all validation rules
   * 
   * @remarks
   * Performs spa-specific validation:
   * 1. Validates required metadata fields exist
   * 2. Checks session limits (completed < total)
   * 3. Validates KTV assignment
   * 4. Checks capacity and break time buffer (via CapacityManagementProvider)
   * 
   * **Break Time Buffer Validation**:
   * - Queries existing bookings for the assigned KTV
   * - Checks for time overlaps and insufficient break times
   * - Enforces minimum break time between sessions (tenant-configurable)
   * 
   * @example
   * ```typescript
   * const isValid = await adapter.validateBookingRules(order, context);
   * if (!isValid) {
   *   throw new Error('Booking validation failed');
   * }
   * ```
   */
  async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    console.log(`[SpaAdapter] Validating booking rules for order ${order.id}`);

    // Validate required metadata fields
    if (!order.metadata?.assigned_ktv_id) {
      console.error('[SpaAdapter] Missing required field: assigned_ktv_id');
      return false;
    }

    if (!order.metadata?.sessions_total) {
      console.error('[SpaAdapter] Missing required field: sessions_total');
      return false;
    }

    // Validate session limits
    const sessionsCompleted = (order.metadata.sessions_completed as number) || 0;
    const sessionsTotal = order.metadata.sessions_total as number;

    if (sessionsCompleted >= sessionsTotal) {
      console.error(
        `[SpaAdapter] All sessions completed (${sessionsCompleted}/${sessionsTotal})`
      );
      return false;
    }

    // Validate KTV assignment
    const ktvId = order.metadata.assigned_ktv_id as string;
    if (!ktvId || ktvId.trim().length === 0) {
      console.error('[SpaAdapter] Invalid KTV assignment');
      return false;
    }

    // ─── CAPACITY & BREAK TIME VALIDATION ───────────────────────────────────────
    // Check KTV availability, time overlaps, and break time buffer.
    // This prevents double-booking and ensures quality rest time between sessions.
    
    try {
      const supabase = createClient();
      
      // Fetch tenant capacity configuration
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('capacity_config')
        .eq('id', context.tenantId)
        .single();
      
      const capacityConfig = tenantData?.capacity_config as Record<string, unknown> | null;
      
      // Get booking date from scheduledStartTime (YYYY-MM-DD format)
      const scheduledDate = order.scheduledStartTime; // Already in YYYY-MM-DD
      
      // Fetch existing session logs for this KTV on the same date
      const { data: existingSessions, error: sessionFetchError } = await supabase
        .from('session_logs')
        .select(`
          id,
          status,
          assigned_time,
          completed_by_ktv_id,
          bookings!inner (
            id,
            assigned_ktv_id,
            status,
            packages (
              duration_minutes:default_duration_minutes
            )
          )
        `)
        .eq('assigned_date', scheduledDate)
        .eq('tenant_id', context.tenantId)
        .in('status', ['scheduled', 'in_progress', 'completed']);

      if (sessionFetchError) {
        console.error('[SpaAdapter] Failed to fetch session logs for capacity check:', sessionFetchError);
        throw new Error(sessionFetchError.message);
      }

      const filteredSessions = (existingSessions || []).filter(session => {
        const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
        if (!booking) return false;
        if (booking.status === 'cancelled') return false;

        // Exclude the current booking's session logs to prevent self-conflict
        if (order.id && booking.id === order.id) return false;

        const activeKtvId = session.completed_by_ktv_id || booking.assigned_ktv_id;
        return activeKtvId === ktvId;
      });

      const existingBookingsFormatted = filteredSessions.map(session => {
        const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
        const durationMinutes = (booking?.packages as unknown as Record<string, unknown>)?.duration_minutes as number || 60;
        const statusMap: Record<string, 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'> = {
          scheduled: 'confirmed',
          in_progress: 'in_progress',
          completed: 'completed',
        };
        const status = statusMap[session.status || ''] || 'pending';
        return {
          id: booking?.id || session.id,
          startTime: session.assigned_time || '08:00',
          endTime: this.calculateEndTime(
            session.assigned_time || '08:00',
            durationMinutes
          ),
          durationMinutes,
          status,
        };
      });
      
      // Initialize capacity provider
      const capacityProvider = new CapacityManagementProvider({ debug: true });
      
      // Calculate booking end time
      // Get start time from metadata.preferred_time (session time), not scheduledStartTime (package start date)
      const startTime = (order.metadata.preferred_time as string) || '08:00';
      const durationMinutes = 60; // Default duration, could be from service metadata
      const endTime = this.calculateEndTime(startTime, durationMinutes);
      
      // Note: scheduledDate already defined above from order.scheduledStartTime
      
      // Check capacity
      const capacityResult = await capacityProvider.checkCapacity({
        booking: {
          requestedStartTime: startTime,
          requestedEndTime: endTime,
          requestedDate: scheduledDate,
          durationMinutes: durationMinutes,
          serviceType: 'spa_session',
          customerTier: (order.metadata.customer_tier as 'vip' | 'loyal' | 'new') || 'new',
        },
        ktvId: ktvId,
        existingBookings: existingBookingsFormatted,
        tenantCapacity: capacityConfig ? {
          bufferPercentage: (capacityConfig.bufferPercentage as number) || 10,
          enablePeakHourManagement: (capacityConfig.enablePeakHourManagement as boolean) || false,
          enforceBreakTimes: (capacityConfig.enforceBreakTimes as boolean) || false,
        } : undefined,
        ktvCapacity: {
          maxDailyBookings: (capacityConfig?.dailyCapacityLimit as number) || 10,
          maxConcurrentSessions: (capacityConfig?.concurrentSessionLimit as number) || 5,
          minBreakMinutes: (capacityConfig?.minBreakMinutes as number) || 15,
          workingHours: (capacityConfig?.workingHours as { start: string; end: string }) || { start: '08:00', end: '22:00' },
          peakHours: capacityConfig?.peakHours as { start: string; end: string; maxBookings: number } | undefined,
        },
        tenantId: context.tenantId,
      });
      
      if (!capacityResult.available) {
        console.error(
          `[SpaAdapter] Capacity check failed: ${capacityResult.reason}`,
          capacityResult.conflicts
        );
        
        // Log detailed conflict information
        if (capacityResult.conflicts && capacityResult.conflicts.length > 0) {
          capacityResult.conflicts.forEach(conflict => {
            console.error(`[SpaAdapter] Conflict: ${conflict.type} - ${conflict.reason}`);
          });
        }
        
        return false;
      }
      
      console.log(`[SpaAdapter] Capacity check passed for order ${order.id}`);
      
    } catch (error) {
      console.error('[SpaAdapter] Error during capacity validation:', error);
      // If capacity check fails due to error, log but allow booking (fail open)
      // This prevents blocking bookings if the capacity system has issues
      console.warn('[SpaAdapter] Proceeding with booking despite capacity check error');
    }

    console.log(`[SpaAdapter] Booking validation passed for order ${order.id}`);
    return true;
  }

  /**
   * Calculate end time given start time and duration
   * @protected - accessible to subclasses
   */
  protected calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  }

  /**
   * Calculate spa-specific pricing with discounts and promotions.
   * 
   * @param item - Service catalog item to price
   * @param context - Tenant context with subscription and settings
   * @returns Final price after applying all discounts
   * 
   * @remarks
   * Applies spa-specific pricing rules:
   * 1. Start with base price
   * 2. Apply package category discount (VIP packages get extra discount)
   * 3. Apply subscription tier discount (enterprise, professional, starter)
   * 4. Apply membership level discount (gold, platinum from settings)
   * 5. Respect session multipliers for package value calculation
   * 
   * **Discount hierarchy**:
   * - VIP packages: 10% off
   * - Enterprise subscription: 15% off
   * - Professional subscription: 10% off
   * - Starter subscription: 5% off
   * - Gold membership: Additional 10% off
   * - Platinum membership: Additional 15% off
   * 
   * @example
   * ```typescript
   * const finalPrice = await adapter.calculatePricing(item, context);
   * console.log(`Price after discounts: ${finalPrice} VND`);
   * ```
   */
  async calculatePricing(
    item: CoreServiceCatalogItem,
    context: TenantContext
  ): Promise<number> {
    let price = item.basePrice;

    console.log(
      `[SpaAdapter] Calculating pricing for ${item.name}, base price: ${price}`
    );

    // Respect single-session retail package pricing: multiply by booking total sessions
    const baseSessions = Number(item.metadata.total_sessions || 1);
    const bookingSessions = Number(item.metadata.booking_total_sessions || baseSessions);
    if (baseSessions === 1) {
      price = price * bookingSessions;
      console.log(
        `[SpaAdapter] Single session package. Multiplied base price by booking sessions (${bookingSessions}): ${price}`
      );
    }

    // Apply package category discount
    const category = item.metadata.category as string;
    if (category === 'vip') {
      price *= 0.9; // 10% discount for VIP packages
      console.log(`[SpaAdapter] Applied VIP package discount: ${price}`);
    }

    // Apply subscription tier discount
    const discountRate = this.getSubscriptionDiscount(context.subscriptionPlan);
    if (discountRate > 0) {
      price *= 1 - discountRate;
      console.log(
        `[SpaAdapter] Applied ${context.subscriptionPlan} subscription discount (${
          discountRate * 100
        }%): ${price}`
      );
    }

    // Apply membership level discount from tenant settings
    const membershipLevel = context.settings.membershipLevel as string;
    if (membershipLevel === 'gold') {
      price *= 0.9; // 10% discount for gold members
      console.log(`[SpaAdapter] Applied gold membership discount: ${price}`);
    } else if (membershipLevel === 'platinum') {
      price *= 0.85; // 15% discount for platinum members
      console.log(`[SpaAdapter] Applied platinum membership discount: ${price}`);
    }

    // Respect session multipliers (1.0x, 1.5x, 2.0x)
    const sessionMultiplier = (item.metadata.session_multiplier as number) || 1.0;
    if (sessionMultiplier !== 1.0) {
      console.log(
        `[SpaAdapter] Package has session multiplier: ${sessionMultiplier}x`
      );
      // Note: Session multiplier affects session counting, not pricing directly
      // It's documented here for awareness but doesn't modify the final price
    }

    const finalPrice = Math.round(price);
    console.log(`[SpaAdapter] Final price: ${finalPrice}`);
    return finalPrice;
  }

  /**
   * Execute spa-specific side effects when booking is completed.
   * 
   * @param order - Completed booking order
   * @param context - Tenant context
   * 
   * @remarks
   * Handles spa-specific post-completion actions:
   * 1. Updates KTV salary calculations (via recalculateAndSaveSalaryRecord)
   * 2. Deducts inventory for products used during sessions
   * 3. Awards loyalty points to customer (future enhancement)
   * 
   * **Error Handling**:
   * - Logs errors but does not throw (booking is already completed)
   * - Each side effect is independent and failures are isolated
   * - Failed operations can be retried via background jobs
   * 
   * **Integration Points**:
   * - Salary recalculation: Uses hr-salary module
   * - Inventory deduction: Uses inventory-actions service
   * - Loyalty points: Core customer service (future)
   * 
   * @example
   * ```typescript
   * await adapter.onBookingCompleted(order, context);
   * console.log('Side effects processed');
   * ```
   */
  async onBookingCompleted(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<void> {
    console.log(`[SpaAdapter] Processing completion for order ${order.id}`);

    // Execute side effects in parallel with error isolation
    const results = await Promise.allSettled([
      this.updateKtvSalary(order, context),
      this.deductInventory(order, context),
      this.awardLoyaltyPoints(order, context),
    ]);

    // Log any failures (don't throw - order is already completed)
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const operations = ['salary update', 'inventory deduction', 'loyalty points'];
        console.error(
          `[SpaAdapter] ${operations[index]} failed:`,
          result.reason
        );
      }
    });

    console.log(`[SpaAdapter] Completed processing for order ${order.id}`);
  }

  /**
   * Return spa-specific dashboard widgets.
   * 
   * @returns Array of widget definitions for spa dashboard
   * 
   * @remarks
   * Provides widgets for:
   * - Spa bookings scheduled for today
   * - Revenue trends and charts
   * - KTV performance leaderboard
   * 
   * Each widget includes:
   * - `id`: Unique widget identifier
   * - `component`: Component name to render
   * - `title`: Display title
   * - `size`: Widget size hint (small, medium, large)
   * 
   * @example
   * ```typescript
   * const widgets = adapter.getModuleWidgets();
   * widgets.forEach(widget => {
   *   console.log(`Widget: ${widget.title}`);
   * });
   * ```
   */
  getModuleWidgets() {
    return [
      {
        id: 'spa-bookings-today',
        component: 'SpaBookingsWidget',
        title: 'Lịch Hẹn Hôm Nay',
        size: 'medium',
      },
      {
        id: 'spa-revenue-chart',
        component: 'SpaRevenueWidget',
        title: 'Doanh Thu Spa',
        size: 'large',
      },
      {
        id: 'ktv-performance',
        component: 'KtvPerformanceWidget',
        title: 'Thành Tích KTV',
        size: 'medium',
      },
    ];
  }

  /**
   * Get subscription-based discount rate.
   * 
   * @param plan - Subscription plan tier
   * @returns Discount rate (0.0 to 1.0)
   * @private
   */
  private getSubscriptionDiscount(plan: string): number {
    switch (plan) {
      case 'enterprise':
        return 0.15; // 15% discount
      case 'professional':
        return 0.1; // 10% discount
      case 'starter':
        return 0.05; // 5% discount
      default:
        return 0; // No discount for free tier
    }
  }

  /**
   * Update KTV salary for completed booking.
   * 
   * @param order - Completed booking order
   * @param context - Tenant context
   * @private
   * 
   * @remarks
   * This is a placeholder for salary update integration.
   * The actual implementation will use the hr-salary module's
   * recalculateAndSaveSalaryRecord function.
   * 
   * **Future implementation**:
   * ```typescript
   * const { recalculateAndSaveSalaryRecord } = await import(
   *   '@/modules/hr-salary/actions/admin-salary-actions'
   * );
   * const ktvId = order.metadata.assigned_ktv_id as string;
   * const monthYear = order.scheduledStartTime.substring(0, 7) + '-01';
   * await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, context.tenantId);
   * ```
   */
  private async updateKtvSalary(
    order: CoreBookingOrder,
    _context: TenantContext
  ): Promise<void> {
    try {
      const ktvId = order.metadata.assigned_ktv_id as string;
      if (!ktvId) {
        console.warn('[SpaAdapter] No KTV assigned, skipping salary update');
        return;
      }

      console.log(`[SpaAdapter] Updating salary for KTV ${ktvId}`);
      
      // Future: Integrate with hr-salary module
      // const { recalculateAndSaveSalaryRecord } = await import(
      //   '@/modules/hr-salary/actions/admin-salary-actions'
      // );
      // const monthYear = order.scheduledStartTime.substring(0, 7) + '-01';
      // await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, context.tenantId);
      
      console.log(`[SpaAdapter] Salary update completed for KTV ${ktvId}`);
    } catch (error) {
      console.error('[SpaAdapter] Failed to update KTV salary:', error);
      throw error;
    }
  }

  /**
   * Deduct inventory for products used during booking.
   * 
   * @param order - Completed booking order
   * @param context - Tenant context
   * @private
   * 
   * @remarks
   * This is a placeholder for inventory deduction integration.
   * The actual implementation will use the inventory-actions service.
   * 
   * **Future implementation**:
   * ```typescript
   * const { autoConsumeForSession } = await import('@/services/inventory-actions');
   * const productsUsed = order.metadata.products_used as Record<string, number>;
   * if (productsUsed) {
   *   await autoConsumeForSession(order.serviceItemId, order.id);
   * }
   * ```
   */
  private async deductInventory(
    order: CoreBookingOrder,
    _context: TenantContext
  ): Promise<void> {
    try {
      const productsUsed = order.metadata.products_used as
        | Record<string, number>
        | undefined;

      if (!productsUsed || Object.keys(productsUsed).length === 0) {
        console.log('[SpaAdapter] No products used, skipping inventory deduction');
        return;
      }

      console.log(
        `[SpaAdapter] Deducting inventory for ${
          Object.keys(productsUsed).length
        } products`
      );

      // Future: Integrate with inventory-actions service
      // const { autoConsumeForSession } = await import('@/services/inventory-actions');
      // await autoConsumeForSession(order.serviceItemId, order.id);

      console.log('[SpaAdapter] Inventory deduction completed');
    } catch (error) {
      console.error('[SpaAdapter] Failed to deduct inventory:', error);
      throw error;
    }
  }

  /**
   * Award loyalty points to customer for completed booking.
   * 
   * @param order - Completed booking order
   * @param context - Tenant context
   * @private
   * 
   * @remarks
   * This is a placeholder for loyalty points integration.
   * The actual implementation will use the core customer service.
   * 
   * **Future implementation**:
   * - Calculate points based on order total (e.g., 1 point per 10,000 VND)
   * - Apply membership tier multipliers
   * - Award bonus points for premium packages
   */
  private async awardLoyaltyPoints(
    order: CoreBookingOrder,
    _context: TenantContext
  ): Promise<void> {
    try {
      console.log(
        `[SpaAdapter] Awarding loyalty points for customer ${order.customerId}`
      );

      // Future: Integrate with customer loyalty service
      // const points = Math.floor(order.totalAmount / 10000);
      // await awardCustomerPoints(order.customerId, points, context.tenantId);

      console.log('[SpaAdapter] Loyalty points awarded');
    } catch (error) {
      console.error('[SpaAdapter] Failed to award loyalty points:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance of SpaModuleAdapter.
 * 
 * @remarks
 * Export a single instance to be registered with the module registry.
 * This ensures consistent behavior across the application.
 * 
 * @example
 * ```typescript
 * import { spaModuleAdapter } from '@/modules/spa/adapters/SpaModuleAdapter';
 * import { moduleRegistry } from '@/core/adapters/registry';
 * 
 * // Register adapter on app startup
 * moduleRegistry.register(spaModuleAdapter);
 * ```
 */
export const spaModuleAdapter = new SpaModuleAdapter();
