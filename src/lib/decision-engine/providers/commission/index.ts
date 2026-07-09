/**
 * @fileoverview Commission Provider Module
 * 
 * Decision Engine provider for commission calculation.
 * Replaces hardcoded commission logic with rule-based engine.
 * 
 * **Key Components:**
 * - CommissionProvider: Main provider class
 * - 16 commission rules (14 enabled, 2 disabled)
 * - Comprehensive type definitions
 * - Configurable strategies and multipliers
 * 
 * **Usage:**
 * ```typescript
 * import { CommissionProvider } from '@/lib/decision-engine/providers/commission';
 * 
 * const provider = new CommissionProvider();
 * const result = await provider.evaluate({ ... });
 * ```
 * 
 * @module decision-engine/providers/commission
 */

export { CommissionProvider } from './commission-provider';

export type {
  CommissionDecisionInput,
  CommissionDecisionOutput,
  CommissionConfig,
  CommissionType,
  CommissionStrategy,
  PositionTier,
  VolumeTier,
  PerformanceTier,
  ServiceItem,
  ProductSale,
  ManualAdjustment,
  CommissionBreakdown,
  CommissionKnowledge,
} from './types';

export {
  allCommissionRules,
  COMMISSION_RULE_STATS,
} from './rules';
