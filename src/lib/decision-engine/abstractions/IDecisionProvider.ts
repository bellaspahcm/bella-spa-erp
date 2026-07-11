/**
 * IDecisionProvider - Decision Provider Abstraction
 *
 * Interface for all decision engine providers.
 * Providers are pluggable components that implement specific decision logic
 * (e.g., rule-based, AI-based, BI-based).
 *
 * @module lib/decision-engine/abstractions/IDecisionProvider
 */

import type { DecisionResult } from '../types';

/**
 * Decision provider input context
 */
export interface DecisionProviderInput {
  /** Provider type identifier (e.g., 'rule', 'ai', 'bi') */
  type: string;
  /** Input data for the decision */
  data: Record<string, unknown>;
  /** Tenant context */
  tenantId?: string;
  /** User context */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Decision Provider Interface
 *
 * All decision providers must implement this interface.
 * Providers are registered with the ExtensionRegistry and
 * resolved by the DecisionEngine at runtime.
 */
export interface IDecisionProvider {
  /**
   * Unique name identifying this provider
   * @example 'rule', 'ai', 'bi'
   */
  readonly name: string;

  /**
   * Human-readable description of the provider
   */
  readonly description?: string;

  /**
   * Provider version (for compatibility tracking)
   */
  readonly version?: string;

  /**
   * Check if this provider can handle the given input type
   */
  canHandle(input: DecisionProviderInput): boolean;

  /**
   * Execute the decision logic and return a result
   */
  decide(input: DecisionProviderInput): Promise<DecisionResult>;

  /**
   * Optional initialization (called once on registration)
   */
  initialize?(): Promise<void>;

  /**
   * Optional cleanup (called on disposal)
   */
  dispose?(): Promise<void>;
}
