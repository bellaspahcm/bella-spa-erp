/**
 * Procurement Validation Policy
 * 
 * Validates if a procurement requisition is valid before processing.
 * 
 * Universal validation rules:
 * - Budget availability check
 * - Vendor approval status
 * - Item specification completeness
 * - Compliance with procurement policies
 * 
 * Same logic, different thresholds per industry.
 */

import type {
  ProcurementDecisionContext,
  ValidationResult,
} from '@/lib/decision-engine/types/procurement-types';

export interface ProcurementPolicy<TResult> {
  readonly name: string;
  readonly version: string;
  readonly decisionType: string;
  evaluate(context: ProcurementDecisionContext): Promise<TResult>;
}

export class ValidationPolicy implements ProcurementPolicy<ValidationResult> {
  readonly name = 'ValidationPolicy';
  readonly version = '1.0.0';
  readonly decisionType = 'procurement-validation';

  async evaluate(
    context: ProcurementDecisionContext
  ): Promise<ValidationResult> {
    const requisition = context.requisition;
    const budget = context.budget || { available: 0, used: 0, total: 0 };
    const vendor = context.vendor || { id: '', name: 'Unknown', approved: false, rating: 0 };
    const matchedRules: string[] = [];
    const validationErrors: string[] = [];

    const budgetRaw = context.budget as unknown as Record<string, unknown> | undefined;
    const budgetAvailable = context.budget?.available ?? (typeof budgetRaw?.remaining === 'number' ? budgetRaw.remaining : 0);

    // Rule 1: Budget availability check
    const budgetCheck = {
      passed: budgetAvailable >= requisition.totalAmount,
      available: budgetAvailable,
      required: requisition.totalAmount,
    };

    if (!budgetCheck.passed) {
      validationErrors.push(
        `Insufficient budget: ${budgetAvailable.toLocaleString()}đ available, ${requisition.totalAmount.toLocaleString()}đ required`
      );
      matchedRules.push('budget-insufficient');
    } else {
      matchedRules.push('budget-available');
    }

    // Rule 2: Vendor approval check
    const vendorCheck = {
      passed: vendor.approved && vendor.rating >= 3.0,
      approved: vendor.approved,
      rating: vendor.rating,
    };

    if (!vendor.approved) {
      validationErrors.push(`Vendor ${vendor.name} is not approved`);
      matchedRules.push('vendor-not-approved');
    } else if (vendor.rating < 3.0) {
      validationErrors.push(
        `Vendor rating ${vendor.rating} is below minimum 3.0`
      );
      matchedRules.push('vendor-low-rating');
    } else {
      matchedRules.push('vendor-approved');
    }

    // Rule 3: Items validation
    const itemsIssues: string[] = [];
    
    for (const item of requisition.items) {
      // Check quantity
      if (item.quantity <= 0) {
        itemsIssues.push(`${item.name}: invalid quantity ${item.quantity}`);
      }
      
      // Check price
      if (item.unitPrice <= 0) {
        itemsIssues.push(`${item.name}: invalid unit price ${item.unitPrice}`);
      }
      
      // Check urgent items have justification
      if (requisition.urgency === 'critical' && !requisition.justification) {
        itemsIssues.push(`${item.name}: critical urgency requires justification`);
      }
    }

    const itemsCheck = {
      passed: itemsIssues.length === 0,
      issues: itemsIssues,
    };

    if (!itemsCheck.passed) {
      validationErrors.push(...itemsIssues);
      matchedRules.push('items-validation-failed');
    } else {
      matchedRules.push('items-validated');
    }

    // Overall validation result
    const valid = budgetCheck.passed && vendorCheck.passed && itemsCheck.passed;

    return {
      valid,
      reason: valid
        ? 'All validation checks passed'
        : `Validation failed: ${validationErrors.join('; ')}`,
      validationErrors,
      budgetCheck,
      vendorCheck,
      itemsCheck,
      matchedRules,
    };
  }
}
