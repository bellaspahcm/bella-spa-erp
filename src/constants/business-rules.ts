/**
 * Business Rules Constants for Bella Spa ERP
 * 
 * This file contains all business logic constants extracted from magic numbers
 * across the codebase to improve maintainability and type safety.
 * 
 * @module constants/business-rules
 */

/**
 * Core business rules and thresholds for Bella Spa operations
 * 
 * Includes:
 * - Payroll calculation rules (working days, bonus thresholds)
 * - Session type multipliers (BASIC, HAPPY, VIP packages)
 * - Inventory management thresholds (low stock, reorder points)
 * - Performance rating thresholds
 */
export const BUSINESS_RULES = {
  /**
   * Payroll and attendance rules
   */
  PAYROLL: {
    /**
     * Standard working days per month used for salary calculations
     * Used for pro-rata salary: (base_salary / 26) * actualDays
     */
    WORKING_DAYS_PER_MONTH: 26,
    
    /**
     * Minimum working days required to qualify for monthly bonus
     * KTVs must work at least 22 days to receive KPI bonus
     */
    MIN_WORKING_DAYS_FOR_BONUS: 22,
  },
  
  /**
   * Session and package rules
   */
  SESSIONS: {
    /**
     * Session type multipliers for calculating total sessions (ca quy đổi)
     * 
     * - BASIC: Standard session packages (Combo Mẹ & Bé Tiết Kiệm)
     * - HAPPY: Premium session packages (Combo Mẹ & Bé Hạnh Phúc)
     * - VIP: Luxury session packages (Combo Mẹ & Bé VIP Toàn Diện)
     * 
     * Example: 10 VIP sessions = 10 * 2.0 = 20 equivalent sessions
     */
    MULTIPLIERS: {
      BASIC: 1.0,
      HAPPY: 1.5,
      VIP: 2.0
    },
    
    /**
     * Minimum average rating (stars) required to qualify for rating bonus
     * KTVs must maintain at least 4.5 stars to receive rating bonuses
     */
    MIN_RATING_FOR_BONUS: 4.5
  },
  
  /**
   * Inventory management rules
   */
  INVENTORY: {
    /**
     * Low stock threshold - triggers warning alerts in the system
     * When inventory quantity falls to or below this level, system shows low stock warning
     */
    LOW_STOCK_THRESHOLD: 10,
    
    /**
     * Reorder point - triggers purchase order recommendations
     * When inventory reaches this level, system recommends creating purchase orders
     */
    REORDER_POINT: 20
  }
} as const;

/**
 * Type representing the entire business rules structure
 * Provides full type safety for all nested properties
 */
export type BusinessRules = typeof BUSINESS_RULES;

/**
 * Type representing valid session multiplier values (1.0 | 1.5 | 2.0)
 * Use this type for type-safe session multiplier calculations
 */
export type SessionMultiplier = typeof BUSINESS_RULES.SESSIONS.MULTIPLIERS[keyof typeof BUSINESS_RULES.SESSIONS.MULTIPLIERS];
