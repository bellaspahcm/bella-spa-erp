/**
 * Logistics OS — Expiry Rule
 * 
 * Rule: Inventory cannot be used after expiry date
 * 
 * @module logistics/domain/rules
 */

import type { Inventory } from '../inventory.types';
import type { Rule, RuleResult } from './rule.types';
import { RuleViolationCodes } from './rule.types';
import { pass, violation, createViolation, createEvidence } from './rule.helpers';

/**
 * Expiry Rule Context
 */
export interface ExpiryRuleContext {
  inventory: Inventory;
  evaluationDate: Date;
}

/**
 * Inventory Expiry Check Rule
 * 
 * Evaluates whether inventory has expired.
 * 
 * Invariants:
 * - Deterministic (explicit evaluationDate)
 * - Side-effect-free (no mutations)
 * - Product-agnostic (generic constraint)
 */
export class InventoryExpiryRule implements Rule<ExpiryRuleContext> {
  readonly id = 'INVENTORY_EXPIRY_CHECK';
  readonly version = '1.0.0';
  readonly description = 'Inventory cannot be used after expiry date';

  evaluate(context: ExpiryRuleContext): RuleResult {
    const { inventory, evaluationDate } = context;

    // Evidence input
    const evidenceInput = {
      inventory_id: inventory.id.value,
      expiry_date: inventory.expiry_date?.toISOString() || null,
      evaluation_date: evaluationDate.toISOString(),
    };

    // No expiry date → PASS (not expiry-tracked)
    if (!inventory.expiry_date) {
      return pass(
        this.id,
        this.version,
        createEvidence(evidenceInput, { is_expired: false, reason: 'no_expiry_date' }),
        evaluationDate
      );
    }

    const expiryDate = new Date(inventory.expiry_date);
    const isExpired = expiryDate < evaluationDate;

    if (isExpired) {
      const daysPastExpiry = Math.floor(
        (evaluationDate.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.INVENTORY_EXPIRED,
          `Inventory expired ${daysPastExpiry} day(s) ago`,
          'ERROR',
          {
            field: 'expiry_date',
            actual: expiryDate.toISOString(),
            expected: `>= ${evaluationDate.toISOString()}`,
          }
        ),
        createEvidence(evidenceInput, {
          is_expired: true,
          days_past_expiry: daysPastExpiry,
        }),
        evaluationDate
      );
    }

    // Not expired → PASS
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - evaluationDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, {
        is_expired: false,
        days_until_expiry: daysUntilExpiry,
      }),
      evaluationDate
    );
  }
}
