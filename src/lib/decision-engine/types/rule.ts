/**
 * Extended Rule Type for Decision Engine
 * 
 * This type extends the basic DecisionRule with additional fields
 * for enterprise-grade rule management (name, description, enabled, metadata).
 * 
 * Used by Providers (Discount, Booking, Payroll, Commission) for declarative rule definitions.
 */

/**
 * Context passed to function-based rule conditions and actions.
 * Used by CommissionProvider rules.
 */
export interface RuleContext {
  /** The primary input data for this rule evaluation */
  input: unknown;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Simple condition (field comparison)
 */
export interface SimpleCondition {
  type: 'simple';
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual' | 'contains' | 'in' | 'exists';
  value: unknown;
}

/**
 * Composite condition (AND/OR logic)
 */
export interface CompositeCondition {
  type: 'all' | 'any';
  conditions: Array<SimpleCondition | CompositeCondition>;
}

/**
 * Rule condition — can be a declarative object OR a predicate function.
 */
export type RuleCondition =
  | SimpleCondition
  | CompositeCondition
  | ((context: RuleContext) => boolean);

/**
 * Rule action object (declarative style)
 */
export interface RuleActionObject {
  type: 'approve' | 'reject' | 'escalate' | 'modify';
  data?: Record<string, unknown>;
  message?: string;
}

/**
 * Rule action — can be a declarative object OR an action function.
 */
export type RuleAction =
  | RuleActionObject
  | ((context: RuleContext) => Record<string, unknown>);

/**
 * Extended Rule with full metadata
 */
export interface Rule {
  /**
   * Unique rule identifier
   */
  id: string;

  /**
   * Human-readable rule name
   */
  name: string;

  /**
   * Detailed rule description
   */
  description?: string;

  /**
   * Rule priority (higher = evaluated first)
   * Discount Provider uses priority 10-110
   * Commission Provider uses priority 195-240
   * Payroll Provider will use 200-280
   */
  priority: number;

  /**
   * Is rule enabled?
   */
  enabled: boolean;

  /**
   * Rule version (for auditing) — optional
   */
  version?: number;

  /**
   * Rule condition (when to apply this rule)
   */
  condition: RuleCondition;

  /**
   * Rule action (what to do when condition matches)
   */
  action: RuleAction;

  /**
   * Rule category (for grouping/filtering)
   */
  category?: string;

  /**
   * Rule metadata (tags, owner, etc.)
   */
  metadata?: Record<string, unknown>;
}

/**
 * Type alias for backward compatibility
 */
export type { Rule as ExtendedRule };
