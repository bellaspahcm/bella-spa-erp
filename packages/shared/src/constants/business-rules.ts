/**
 * Business Rules Constants - Di chuyển từ src/constants/business-rules.ts
 */

export const BUSINESS_RULES = {
  PAYROLL: {
    WORKING_DAYS_PER_MONTH: 26,
    MIN_WORKING_DAYS_FOR_BONUS: 22,
  },
  SESSIONS: {
    MULTIPLIERS: {
      BASIC: 1.0,
      HAPPY: 1.5,
      VIP: 2.0
    },
    MIN_RATING_FOR_BONUS: 4.5
  },
  INVENTORY: {
    LOW_STOCK_THRESHOLD: 10,
    REORDER_POINT: 20
  }
} as const;

export type BusinessRules = typeof BUSINESS_RULES;
export type SessionMultiplier = typeof BUSINESS_RULES.SESSIONS.MULTIPLIERS[keyof typeof BUSINESS_RULES.SESSIONS.MULTIPLIERS];
