/**
 * Logistics OS — Quantity Rules
 * 
 * Rules for quantity validation
 * 
 * @module logistics/domain/rules
 */

import type { Rule, RuleResult } from './rule.types';
import { RuleViolationCodes } from './rule.types';
import { pass, violation, createViolation, createEvidence } from './rule.helpers';

/**
 * Quantity Positive Rule Context
 */
export interface QuantityPositiveContext {
  quantity: number;
  operation: string; // For evidence (e.g., "reserve", "issue")
}

/**
 * Quantity Positive Check Rule
 * 
 * Evaluates whether quantity is positive (> 0).
 */
export class QuantityPositiveRule implements Rule<QuantityPositiveContext> {
  readonly id = 'QUANTITY_POSITIVE_CHECK';
  readonly version = '1.0.0';
  readonly description = 'Quantity must be greater than zero';

  evaluate(context: QuantityPositiveContext): RuleResult {
    const { quantity, operation } = context;
    const evaluationDate = new Date();

    const evidenceInput = {
      quantity,
      operation,
    };

    if (quantity <= 0) {
      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.QUANTITY_MUST_BE_POSITIVE,
          `Quantity must be positive, got ${quantity}`,
          'ERROR',
          {
            field: 'quantity',
            actual: quantity,
            expected: '> 0',
          }
        ),
        createEvidence(evidenceInput, { is_positive: false }),
        evaluationDate
      );
    }

    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, { is_positive: true }),
      evaluationDate
    );
  }
}

/**
 * Available Quantity Rule Context
 */
export interface AvailableQuantityContext {
  requested: number;
  available: number;
  inventory_id: string;
}

/**
 * Available Quantity Check Rule
 * 
 * Evaluates whether requested quantity does not exceed available.
 */
export class AvailableQuantityRule implements Rule<AvailableQuantityContext> {
  readonly id = 'QUANTITY_AVAILABLE_CHECK';
  readonly version = '1.0.0';
  readonly description = 'Requested quantity must not exceed available';

  evaluate(context: AvailableQuantityContext): RuleResult {
    const { requested, available, inventory_id } = context;
    const evaluationDate = new Date();

    const evidenceInput = {
      requested,
      available,
      inventory_id,
    };

    if (requested > available) {
      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.INSUFFICIENT_AVAILABLE_QUANTITY,
          `Insufficient available quantity: requested ${requested}, available ${available}`,
          'ERROR',
          {
            field: 'quantity_available',
            actual: available,
            expected: `>= ${requested}`,
          }
        ),
        createEvidence(evidenceInput, {
          is_sufficient: false,
          shortfall: requested - available,
        }),
        evaluationDate
      );
    }

    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, {
        is_sufficient: true,
        remaining: available - requested,
      }),
      evaluationDate
    );
  }
}
