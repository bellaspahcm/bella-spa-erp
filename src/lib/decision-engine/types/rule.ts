/**
 * Extended Rule Type for Decision Engine
 * 
 * This type extends the basic DecisionRule with additional fields
 * for enterprise-grade rule management (name, description, enabled, metadata).
 * 
 * Used by Providers (Discount, Booking, Payroll) for declarative rule definitions.
 */

/**
 * Simple condition (field comparison)
 */
export interface SimpleCondition {
  type: 'simple';
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual' | 'contains' | 'in';
  value: any;
}

/**
 * Composite condition (AND/OR logic)
 */
export interface CompositeCondition {
  type: 'all' | 'any';
  conditions: Array<SimpleCondition | CompositeCondition>;
}

/**
 * Rule condition (can be simple or composite)
 */
export type RuleCondition = SimpleCondition | CompositeCondition;

/**
 * Rule action (what happens when rule matches)
 */
export interface RuleAction {
  type: 'approve' | 'reject' | 'escalate' | 'modify';
  data?: Record<string, any>;
  message?: string;
}

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
   * Payroll Provider will use 200-280
   */
  priority: number;

  /**
   * Is rule enabled?
   */
  enabled: boolean;

  /**
   * Rule version (for auditing)
   */
  version: number;

  /**
   * Rule condition (when to apply this rule)
   */
  condition: RuleCondition;

  /**
   * Rule action (what to do when condition matches)
   */
  action: RuleAction;

  /**
   * Rule metadata (tags, owner, category, etc.)
   */
  metadata?: Record<string, any>;
}

/**
 * Type alias for backward compatibility
 */
export type { Rule as ExtendedRule };
