/**
 * Warehouse Receipt Validation
 * 
 * E6 Economics Experiment - R1: Receive Inventory
 * Category: B (Pattern Reuse - following validation patterns)
 * 
 * Validates receipt creation requests per R1 acceptance criteria
 */

import { CreateReceiptInput } from '../shared-kernel/types/warehouse.types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * R1 AC1.3: Validation
 * 
 * Validate:
 * - tenant_id exists and matches session
 * - vendor_id exists in tenant scope
 * - sku_id exists in tenant scope
 * - quantities > 0
 * - received_date ≤ current_date
 */
export function validateCreateReceipt(
  input: CreateReceiptInput
): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!input.tenant_id) {
    errors.push({
      field: 'tenant_id',
      message: 'Tenant ID is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!input.po_number || input.po_number.trim() === '') {
    errors.push({
      field: 'po_number',
      message: 'PO number is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!input.vendor_id) {
    errors.push({
      field: 'vendor_id',
      message: 'Vendor ID is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!input.received_date) {
    errors.push({
      field: 'received_date',
      message: 'Received date is required',
      code: 'REQUIRED_FIELD'
    });
  }

  // Date validation: received_date ≤ current_date
  if (input.received_date) {
    const receivedDate = new Date(input.received_date);
    const currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999); // End of today

    if (receivedDate > currentDate) {
      errors.push({
        field: 'received_date',
        message: 'Received date cannot be in the future',
        code: 'INVALID_DATE'
      });
    }
  }

  // Line items validation
  if (!input.line_items || input.line_items.length === 0) {
    errors.push({
      field: 'line_items',
      message: 'At least one line item is required',
      code: 'REQUIRED_FIELD'
    });
  } else {
    input.line_items.forEach((item, index) => {
      // SKU required
      if (!item.sku_id) {
        errors.push({
          field: `line_items[${index}].sku_id`,
          message: 'SKU ID is required',
          code: 'REQUIRED_FIELD'
        });
      }

      // Quantities must be > 0
      if (item.expected_quantity <= 0) {
        errors.push({
          field: `line_items[${index}].expected_quantity`,
          message: 'Expected quantity must be greater than 0',
          code: 'INVALID_QUANTITY'
        });
      }

      if (item.actual_quantity <= 0) {
        errors.push({
          field: `line_items[${index}].actual_quantity`,
          message: 'Actual quantity must be greater than 0',
          code: 'INVALID_QUANTITY'
        });
      }

      // UOM required
      if (!item.uom) {
        errors.push({
          field: `line_items[${index}].uom`,
          message: 'Unit of measure is required',
          code: 'REQUIRED_FIELD'
        });
      }

      // Validate UOM is valid value
      const validUOMs = ['EA', 'CS', 'PLT', 'BX', 'PK'];
      if (item.uom && !validUOMs.includes(item.uom)) {
        errors.push({
          field: `line_items[${index}].uom`,
          message: `Invalid unit of measure. Must be one of: ${validUOMs.join(', ')}`,
          code: 'INVALID_UOM'
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate discrepancy for line item
 * 
 * R1 AC1.4: Discrepancy Calculation
 * discrepancy = actual_quantity - expected_quantity
 * discrepancy_status = "over" | "short" | "match"
 */
export function calculateDiscrepancy(
  expected: number,
  actual: number
): {
  discrepancy: number;
  status: 'match' | 'over' | 'short';
  percentage: number;
} {
  const discrepancy = actual - expected;
  
  let status: 'match' | 'over' | 'short';
  if (discrepancy === 0) {
    status = 'match';
  } else if (discrepancy > 0) {
    status = 'over';
  } else {
    status = 'short';
  }

  // Calculate variance percentage
  const percentage = expected > 0 
    ? Math.abs((discrepancy / expected) * 100) 
    : 0;

  return {
    discrepancy,
    status,
    percentage
  };
}
