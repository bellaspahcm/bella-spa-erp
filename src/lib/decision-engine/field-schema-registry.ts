/**
 * Field Schema Registry
 * 
 * Central registry for all provider field schemas.
 * Provides lookup functions for dynamic field selection in UI.
 */

import { FieldSchema, ComparisonOperator } from './field-schema.types';
import { BOOKING_FIELDS } from './providers/booking/field-schema';
import { DISCOUNT_FIELDS } from './providers/discount/field-schema';
import { PAYROLL_FIELDS } from './providers/payroll/field-schema';
import { COMMISSION_FIELDS } from './providers/commission/field-schema';
import { INVENTORY_FIELDS } from './providers/inventory/field-schema';

export const FIELD_SCHEMA_REGISTRY: Record<string, FieldSchema[]> = {
  booking: BOOKING_FIELDS,
  discount: DISCOUNT_FIELDS,
  payroll: PAYROLL_FIELDS,
  commission: COMMISSION_FIELDS,
  inventory: INVENTORY_FIELDS,
};

/**
 * Get a specific field schema by provider and field key
 */
export function getFieldSchema(provider: string, fieldKey: string): FieldSchema | undefined {
  const fields = FIELD_SCHEMA_REGISTRY[provider] || [];
  return fields.find(f => f.key === fieldKey);
}

/**
 * Get all field schemas for a provider
 */
export function getFieldsByProvider(provider: string): FieldSchema[] {
  return FIELD_SCHEMA_REGISTRY[provider] || [];
}

/**
 * Get valid operators for a specific field
 */
export function getOperatorsForField(provider: string, fieldKey: string): ComparisonOperator[] {
  const field = getFieldSchema(provider, fieldKey);
  return field?.operators || [];
}

/**
 * Get grouped fields for dropdown display
 */
export function getGroupedFields(provider: string): Record<string, FieldSchema[]> {
  const fields = getFieldsByProvider(provider);
  const grouped: Record<string, FieldSchema[]> = {};
  
  fields.forEach(field => {
    const group = field.group || 'Other';
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(field);
  });
  
  return grouped;
}
