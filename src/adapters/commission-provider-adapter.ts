/**
 * Commission Provider Adapter
 * 
 * Bridges existing commission calculation system with new Decision Engine CommissionProvider.
 * Converts current data structures to CommissionDecisionInput format.
 * 
 * **Usage:**
 * ```typescript
 * const adapter = new CommissionProviderAdapter();
 * const result = await adapter.calculateCommission({
 *   tenantId: 'bella-spa-hcm',
 *   employeeId: 'ktv-001',
 *   monthYear: '2024-06',
 *   serviceItems: [...],
 *   productSales: [...],
 *   sessions: [...],
 *   employee: {...},
 *   config: {...}
 * });
 * 
 * // Use result in salary_records
 * await saveSalaryRecord({
 *   service_commission: result.serviceCommission,
 *   product_sales_commission: result.productSalesCommission,
 *   position_bonus: result.positionBonus,
 *   seniority_bonus: result.seniorityBonus,
 *   manual_adjustments: result.manualAdjustments,
 * });
 * ```
 * 
 * @module adapters/commission-provider-adapter
 */

import { CommissionProvider } from '@/lib/decision-engine/providers/commission';
import type {
  CommissionDecisionInput,
  CommissionDecisionOutput,
  CommissionConfig,
  ServiceItem,
  ProductSale,
  ManualAdjustment,
} from '@/lib/decision-engine/providers/commission';
import type { Database } from '@/types/supabase';

/**
 * Commission-specific configuration from tenant settings
 */
export interface TenantCommissionConfig {
  /** Commission calculation strategy: 'fixed' | 'percentage' */
  commissionStrategy: 'fixed' | 'percentage';
  
  // Service commission defaults
  serviceCommissionFixed?: number;
  serviceCommissionRate?: number;
  
  // Product commission defaults
  productCommissionFixed?: number;
  productCommissionRate?: number;
  
  // Volume tier configuration
  enableVolumeTiers?: boolean;
  volumeTierThresholds?: {
    high: number;
    premium: number;
    elite: number;
  };
  volumeTierMultipliers?: {
    standard: number;
    high: number;
    premium: number;
    elite: number;
  };
  
  // Performance tier configuration
  enablePerformanceMultipliers?: boolean;
  performanceTierThresholds?: {
    standard: number;
    good: number;
    excellent: number;
    perfect: number;
  };
  performanceTierMultipliers?: {
    belowStandard: number;
    standard: number;
    good: number;
    excellent: number;
    perfect: number;
  };
  
  // Position & seniority bonuses
  positionMultipliers?: {
    junior: number;
    senior: number;
    lead: number;
  };
  seniorityBonusRates?: {
    '0_to_1_year': number;
    '1_to_3_years': number;
    '3_to_5_years': number;
    '5_plus_years': number;
  };
  
  // Gate configuration (optional)
  enableMinSessionsGate?: boolean;
  minSessionsForCommission?: number;
  enableQualityGate?: boolean;
  minRatingForCommission?: number;
  gracePerDays?: number;
}

/**
 * Flexible types for service items and product sales
 */
type BookingServiceItemLike = {
  id: string;
  ktv_id: string;
  subtotal: number;
  calculated_commission?: number | null;
  override_commission_type?: 'fixed' | 'percentage' | null;
  override_commission_value?: number | null;
  status: string;
  completed_date?: string | null;
};

type ProductSaleLike = {
  id: string;
  ktv_id: string;
  sales_amount: number;
  calculated_commission?: number | null;
  override_commission_type?: 'fixed' | 'percentage' | null;
  override_commission_value?: number | null;
  status: string;
  sale_date?: string | null;
};

type SessionLike = {
  id: string;
  rating?: number | null;
  status?: string;
  package_multiplier?: number;
};

type EmployeeLike = {
  id: string;
  position_tier?: 'junior' | 'senior' | 'lead' | null;
  hire_date?: string | null;
  tenant_id: string;
};

type ManualAdjustmentLike = {
  adjustment_type: 'bonus' | 'deduction';
  amount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  reason?: string | null;
  created_by?: string | null;
};

/**
 * Input for adapter (from existing system)
 */
export interface CommissionCalculationContext {
  tenantId: string;
  employeeId: string;
  monthYear: string; // YYYY-MM format
  
  /** Service items from booking_service_items table */
  serviceItems: BookingServiceItemLike[];
  
  /** Product sales from product_sales table */
  productSales: ProductSaleLike[];
  
  /** Session records (for volume tier and rating tier) */
  sessions: SessionLike[];
  
  /** Employee data from users table */
  employee: EmployeeLike;
  
  /** Manual adjustments from salary_adjustments table */
  manualAdjustments?: ManualAdjustmentLike[];
  
  /** Manual override (highest priority) */
  manualOverride?: number | null;
  manualOverrideReason?: string;
  manualOverrideBy?: string;
  
  /** Tenant commission configuration */
  config: TenantCommissionConfig;
}

/**
 * Output for salary_records table
 */
export interface CommissionRecordComponents {
  /** Service items commission (VND) */
  serviceCommission: number;
  
  /** Product sales commission (VND) */
  productSalesCommission: number;
  
  /** Position bonus (VND) */
  positionBonus: number;
  
  /** Seniority bonus (VND) */
  seniorityBonus: number;
  
  /** Net manual adjustments (bonuses - deductions, VND) */
  manualAdjustments: number;
  
  /** Total commission (all components, VND) */
  totalCommission: number;
  
  /** Metadata for audit trail */
  calculation_metadata: {
    provider: string;
    volumeTier: string;
    performanceTier: string;
    volumeMultiplier: number;
    performanceMultiplier: number;
    combinedMultiplier: number;
    matchedRules: string[];
    executionTime: number;
    confidence: number;
    timestamp: string;
  };
}

/**
 * Commission Provider Adapter
 * 
 * Converts existing commission calculation data structures to/from CommissionProvider format.
 */
export class CommissionProviderAdapter {
  private provider: CommissionProvider;

  constructor(options?: { debug?: boolean }) {
    this.provider = new CommissionProvider(options);
  }

  /**
   * Calculate commission components using CommissionProvider
   * 
   * Main integration point between existing system and Decision Engine.
   */
  async calculateCommission(
    context: CommissionCalculationContext
  ): Promise<CommissionRecordComponents> {
    // 1. Transform context to CommissionDecisionInput
    const input = this.transformToDecisionInput(context);

    // 2. Evaluate via CommissionProvider
    const result = await this.provider.evaluate(input);

    // 3. Transform result to salary_records format
    return this.transformToCommissionRecord(result);
  }

  /**
   * Transform existing context to CommissionDecisionInput
   * @private
   */
  private transformToDecisionInput(
    context: CommissionCalculationContext
  ): CommissionDecisionInput {
    // Aggregate sessions data for volume and performance tiers
    const sessionsData = this.aggregateSessions(context.sessions);

    // Map service items to Decision Engine format
    const serviceItems: ServiceItem[] = context.serviceItems
      .filter(item => item.status === 'completed')
      .map(item => ({
        subtotal: item.subtotal,
        overrideType: item.override_commission_type || null,
        overrideValue: item.override_commission_value || null,
      }));

    // Map product sales to Decision Engine format
    const productSales: ProductSale[] = context.productSales
      .filter(sale => sale.status === 'completed')
      .map(sale => ({
        salesAmount: sale.sales_amount,
        overrideType: sale.override_commission_type || null,
        overrideValue: sale.override_commission_value || null,
      }));

    // Map manual adjustments (only approved adjustments)
    const manualAdjustments: ManualAdjustment[] = (context.manualAdjustments || [])
      .filter(adj => adj.status === 'approved')
      .map(adj => ({
        adjustment_type: adj.adjustment_type,
        amount: adj.amount,
        status: adj.status,
        reason: adj.reason || undefined,
        created_by: adj.created_by || undefined,
      }));

    // Build commission config
    const config: CommissionConfig = {
      commissionStrategy: context.config.commissionStrategy || 'fixed',
      
      // Service commission defaults
      serviceCommissionFixed: context.config.serviceCommissionFixed,
      serviceCommissionRate: context.config.serviceCommissionRate,
      
      // Product commission defaults
      productCommissionFixed: context.config.productCommissionFixed,
      productCommissionRate: context.config.productCommissionRate,
      
      // Volume tiers
      enableVolumeTiers: context.config.enableVolumeTiers,
      volumeTierThresholds: context.config.volumeTierThresholds,
      volumeTierMultipliers: context.config.volumeTierMultipliers,
      
      // Performance tiers
      enablePerformanceMultipliers: context.config.enablePerformanceMultipliers,
      performanceTierThresholds: context.config.performanceTierThresholds,
      performanceTierMultipliers: context.config.performanceTierMultipliers,
      
      // Bonuses
      positionMultipliers: context.config.positionMultipliers,
      seniorityBonusRates: context.config.seniorityBonusRates,
      
      // Gates
      enableMinSessionsGate: context.config.enableMinSessionsGate,
      minSessionsForCommission: context.config.minSessionsForCommission,
      enableQualityGate: context.config.enableQualityGate,
      minRatingForCommission: context.config.minRatingForCommission,
      gracePerDays: context.config.gracePerDays,
    };

    return {
      tenantId: context.tenantId,
      employeeId: context.employeeId,
      monthYear: context.monthYear,
      
      serviceItems,
      productSales,
      
      totalSessions: sessionsData.totalSessions,
      completedSessions: sessionsData.completedSessions,
      avgRating: sessionsData.avgRating,
      
      positionTier: context.employee.position_tier || 'junior',
      hireDate: context.employee.hire_date || null,
      daysSinceHired: this.calculateDaysSinceHired(context.employee.hire_date),
      
      manualAdjustments,
      manualOverride: context.manualOverride,
      manualOverrideReason: context.manualOverrideReason,
      manualOverrideBy: context.manualOverrideBy,
      
      config,
    };
  }

  /**
   * Aggregate sessions into summary data for volume and performance tiers
   * @private
   */
  private aggregateSessions(sessions: SessionLike[]): {
    totalSessions: number;
    completedSessions: number;
    avgRating: number;
  } {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        avgRating: 0,
      };
    }

    // Filter completed sessions only
    const completedSessions = sessions.filter(s => s.status === 'completed');

    // Sum sessions with package multipliers (decimal count)
    const totalSessions = completedSessions.reduce((sum, session) => {
      const multiplier = session.package_multiplier || 1.0;
      return sum + multiplier;
    }, 0);

    // Calculate average rating (only from rated sessions)
    const ratedSessions = completedSessions.filter(s => s.rating && s.rating > 0);
    const avgRating = ratedSessions.length > 0
      ? ratedSessions.reduce((sum, s) => sum + (s.rating || 0), 0) / ratedSessions.length
      : 0;

    return {
      totalSessions,
      completedSessions: completedSessions.length,
      avgRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
    };
  }

  /**
   * Calculate days since hired
   * @private
   */
  private calculateDaysSinceHired(hireDate: string | null | undefined): number {
    if (!hireDate) return 0;

    const hired = new Date(hireDate);
    const now = new Date();

    if (isNaN(hired.getTime())) {
      return 0;
    }

    const diffMs = now.getTime() - hired.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Transform CommissionDecisionOutput to salary_records format
   * @private
   */
  private transformToCommissionRecord(
    result: CommissionDecisionOutput
  ): CommissionRecordComponents {
    return {
      // Map components to salary_records columns
      serviceCommission: result.serviceCommission,
      productSalesCommission: result.productSalesCommission,
      positionBonus: result.positionBonus,
      seniorityBonus: result.seniorityBonus,
      manualAdjustments: result.manualAdjustments,
      
      // Total commission (all components combined)
      totalCommission: result.totalCommission,
      
      // Metadata for audit trail
      calculation_metadata: {
        provider: 'commission',
        volumeTier: result.volumeTier,
        performanceTier: result.performanceTier,
        volumeMultiplier: result.volumeMultiplier,
        performanceMultiplier: result.performanceMultiplier,
        combinedMultiplier: result.combinedMultiplier,
        matchedRules: result.matchedRules,
        executionTime: result.executionTimeMs,
        confidence: result.confidence,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Validate result consistency (for migration testing)
   * 
   * Compares Decision Engine result with legacy calculation result.
   * Returns discrepancies if any.
   */
  validateAgainstLegacy(
    decisionEngineResult: CommissionRecordComponents,
    legacyResult: {
      service_commission: number;
      product_sales_commission: number;
      position_bonus: number;
      seniority_bonus: number;
      manual_adjustments: number;
    }
  ): {
    isConsistent: boolean;
    discrepancies: Array<{
      component: string;
      legacy: number;
      decisionEngine: number;
      diff: number;
    }>;
  } {
    const discrepancies: Array<{
      component: string;
      legacy: number;
      decisionEngine: number;
      diff: number;
    }> = [];

    // Compare each component
    const components = [
      { name: 'service_commission', legacy: legacyResult.service_commission, de: decisionEngineResult.serviceCommission },
      { name: 'product_sales_commission', legacy: legacyResult.product_sales_commission, de: decisionEngineResult.productSalesCommission },
      { name: 'position_bonus', legacy: legacyResult.position_bonus, de: decisionEngineResult.positionBonus },
      { name: 'seniority_bonus', legacy: legacyResult.seniority_bonus, de: decisionEngineResult.seniorityBonus },
      { name: 'manual_adjustments', legacy: legacyResult.manual_adjustments, de: decisionEngineResult.manualAdjustments },
    ];

    components.forEach(({ name, legacy, de }) => {
      const diff = Math.abs(legacy - de);
      if (diff > 1) { // Allow 1đ rounding difference
        discrepancies.push({
          component: name,
          legacy,
          decisionEngine: de,
          diff,
        });
      }
    });

    return {
      isConsistent: discrepancies.length === 0,
      discrepancies,
    };
  }
}

/**
 * Feature flag for gradual rollout
 */
export const USE_COMMISSION_PROVIDER = process.env.FEATURE_COMMISSION_PROVIDER === 'true';

/**
 * Helper: Calculate commission with Decision Engine (new)
 */
export async function calculateCommissionWithDecisionEngine(
  context: CommissionCalculationContext
): Promise<CommissionRecordComponents> {
  const adapter = new CommissionProviderAdapter();
  return await adapter.calculateCommission(context);
}

/**
 * Helper: Get adapter instance (singleton pattern)
 */
let adapterInstance: CommissionProviderAdapter | null = null;

export function getCommissionProviderAdapter(): CommissionProviderAdapter {
  if (!adapterInstance) {
    adapterInstance = new CommissionProviderAdapter();
  }
  return adapterInstance;
}
