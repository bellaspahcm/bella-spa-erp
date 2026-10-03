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

type LegacyValueRef = {
  value: string;
};

type InventoryBoundaryRecord = Omit<Inventory, 'id' | 'expiryDate'> & {
  id: string | LegacyValueRef;
  expiryDate?: Date | string | null;
  expiry_date?: Date | string | null;
};

function inventoryRecord(inventory: Inventory): InventoryBoundaryRecord {
  return inventory as InventoryBoundaryRecord;
}

function stringValue(value: string | LegacyValueRef): string {
  return typeof value === 'string' ? value : value.value;
}

function inventoryId(inventory: Inventory): string {
  return stringValue(inventoryRecord(inventory).id);
}

function inventoryExpiryDate(inventory: Inventory): Date | null {
  const expiryDate = inventoryRecord(inventory).expiryDate ?? inventoryRecord(inventory).expiry_date;

  if (!expiryDate) {
    return null;
  }

  return expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
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
    const expiryDate = inventoryExpiryDate(inventory);

    // Evidence input
    const evidenceInput = {
      inventory_id: inventoryId(inventory),
      expiry_date: expiryDate?.toISOString() || null,
      evaluation_date: evaluationDate.toISOString(),
    };

    // No expiry date → PASS (not expiry-tracked)
    if (!expiryDate) {
      return pass(
        this.id,
        this.version,
        createEvidence(evidenceInput, { is_expired: false, reason: 'no_expiry_date' }),
        evaluationDate
      );
    }

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
