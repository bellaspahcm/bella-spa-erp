/**
 * Logistics OS — Traceability Rules
 * 
 * Rules for lot/serial/compliance validation
 * 
 * @module logistics/domain/rules
 */

import type { Item } from '../item.types';
import type { Traceability } from '../traceability.types';
import type { Rule, RuleResult } from './rule.types';
import { RuleViolationCodes } from './rule.types';
import { pass, violation, createViolation, createEvidence } from './rule.helpers';

/**
 * Lot Validity Rule Context
 */
export interface LotValidityContext {
  item: Item;
  lot_number?: string | null;
}

/**
 * Lot Validity Check Rule
 * 
 * Evaluates whether lot number is provided for lot-tracked items.
 */
export class LotValidityRule implements Rule<LotValidityContext> {
  readonly id = 'TRACEABILITY_LOT_VALID';
  readonly version = '1.0.0';
  readonly description = 'Lot number must be valid for lot-tracked items';

  evaluate(context: LotValidityContext): RuleResult {
    const { item, lot_number } = context;
    const evaluationDate = new Date();

    const evidenceInput = {
      item_id: item.id.value,
      sku_code: item.skuCode.value,
      lot_tracked: item.lotTracked,
      lot_number: lot_number || null,
    };

    // If item is not lot-tracked → PASS
    if (!item.lotTracked) {
      return pass(
        this.id,
        this.version,
        createEvidence(evidenceInput, {
          is_valid: true,
          reason: 'not_lot_tracked',
        }),
        evaluationDate
      );
    }

    // If lot-tracked but no lot_number → VIOLATION
    if (!lot_number || lot_number.trim() === '') {
      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.LOT_NUMBER_REQUIRED,
          `Lot number required for lot-tracked item ${item.skuCode.value}`,
          'ERROR',
          {
            field: 'lot_number',
            actual: lot_number || null,
            expected: 'non-empty string',
          }
        ),
        createEvidence(evidenceInput, { is_valid: false }),
        evaluationDate
      );
    }

    // Lot-tracked + lot_number provided → PASS
    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, { is_valid: true }),
      evaluationDate
    );
  }
}

/**
 * Serial Validity Rule Context
 */
export interface SerialValidityContext {
  item: Item;
  serial_number?: string | null;
}

/**
 * Serial Validity Check Rule
 * 
 * Evaluates whether serial number is provided for serial-tracked items.
 */
export class SerialValidityRule implements Rule<SerialValidityContext> {
  readonly id = 'TRACEABILITY_SERIAL_VALID';
  readonly version = '1.0.0';
  readonly description = 'Serial number must be valid for serial-tracked items';

  evaluate(context: SerialValidityContext): RuleResult {
    const { item, serial_number } = context;
    const evaluationDate = new Date();

    const evidenceInput = {
      item_id: item.id.value,
      sku_code: item.skuCode.value,
      serial_tracked: item.serialTracked,
      serial_number: serial_number || null,
    };

    // If item is not serial-tracked → PASS
    if (!item.serialTracked) {
      return pass(
        this.id,
        this.version,
        createEvidence(evidenceInput, {
          is_valid: true,
          reason: 'not_serial_tracked',
        }),
        evaluationDate
      );
    }

    // If serial-tracked but no serial_number → VIOLATION
    if (!serial_number || serial_number.trim() === '') {
      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.SERIAL_NUMBER_REQUIRED,
          `Serial number required for serial-tracked item ${item.skuCode.value}`,
          'ERROR',
          {
            field: 'serial_number',
            actual: serial_number || null,
            expected: 'non-empty string',
          }
        ),
        createEvidence(evidenceInput, { is_valid: false }),
        evaluationDate
      );
    }

    // Serial-tracked + serial_number provided → PASS
    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, { is_valid: true }),
      evaluationDate
    );
  }
}

/**
 * Chain Integrity Rule Context
 */
export interface ChainIntegrityContext {
  traceability: Traceability;
  requiredEvents: string[]; // Expected custody actions
}

/**
 * Traceability Chain Integrity Rule
 * 
 * Evaluates whether traceability chain is complete.
 */
export class ChainIntegrityRule implements Rule<ChainIntegrityContext> {
  readonly id = 'TRACEABILITY_CHAIN_INTEGRITY';
  readonly version = '1.0.0';
  readonly description = 'Traceability chain must be complete';

  evaluate(context: ChainIntegrityContext): RuleResult {
    const { traceability, requiredEvents } = context;
    const evaluationDate = new Date();

    const actualActions = traceability.custodyEvents.map(e => e.action);
    const missing = requiredEvents.filter(req => !actualActions.includes(req));

    const evidenceInput = {
      traceability_id: traceability.id,
      lot_number: traceability.lotNumber || null,
      serial_number: traceability.serialNumber || null,
      required_events: requiredEvents,
      actual_events: actualActions,
    };

    if (missing.length > 0) {
      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.BROKEN_TRACEABILITY_CHAIN,
          `Broken traceability chain: missing events [${missing.join(', ')}]`,
          'ERROR',
          {
            field: 'custody_events',
            actual: actualActions,
            expected: requiredEvents,
          }
        ),
        createEvidence(evidenceInput, {
          is_complete: false,
          missing_events: missing,
        }),
        evaluationDate
      );
    }

    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, {
        is_complete: true,
        event_count: actualActions.length,
      }),
      evaluationDate
    );
  }
}

/**
 * Compliance Status Rule Context
 */
export interface ComplianceStatusContext {
  traceability: Traceability;
}

/**
 * Compliance Status Check Rule
 * 
 * Evaluates whether traceability is compliant.
 */
export class ComplianceStatusRule implements Rule<ComplianceStatusContext> {
  readonly id = 'TRACEABILITY_COMPLIANCE_STATUS';
  readonly version = '1.0.0';
  readonly description = 'Traceability must be compliant';

  evaluate(context: ComplianceStatusContext): RuleResult {
    const { traceability } = context;
    const evaluationDate = new Date();

    const evidenceInput = {
      traceability_id: traceability.id,
      compliance_status: traceability.complianceStatus,
      recall_status: traceability.recallStatus,
    };

    if (traceability.complianceStatus !== 'COMPLIANT') {
      return violation(
        this.id,
        this.version,
        createViolation(
          RuleViolationCodes.COMPLIANCE_VIOLATION,
          `Traceability not compliant: status ${traceability.complianceStatus}`,
          'ERROR',
          {
            field: 'compliance_status',
            actual: traceability.complianceStatus,
            expected: 'COMPLIANT',
          }
        ),
        createEvidence(evidenceInput, {
          is_compliant: false,
          recall_status: traceability.recallStatus,
        }),
        evaluationDate
      );
    }

    return pass(
      this.id,
      this.version,
      createEvidence(evidenceInput, {
        is_compliant: true,
        recall_status: traceability.recallStatus,
      }),
      evaluationDate
    );
  }
}
