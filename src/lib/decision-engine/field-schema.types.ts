/**
 * Field Schema Types
 * 
 * Type definitions for dynamic field selection and validation
 * in the Rule Management UI.
 */

export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime'
  | 'enum' 
  | 'array'
  | 'object';

export type ComparisonOperator = 
  | 'equals'                    // ===
  | 'not_equals'                // !==
  | 'greater_than'              // >
  | 'greater_than_or_equal'     // >=
  | 'less_than'                 // <
  | 'less_than_or_equal'        // <=
  | 'contains'                  // string.includes()
  | 'starts_with'               // string.startsWith()
  | 'ends_with'                 // string.endsWith()
  | 'in'                        // value in array
  | 'not_in'                    // value not in array
  | 'matches'                   // regex.test()
  | 'is_empty'                  // null/undefined/''
  | 'is_not_empty';             // not null/undefined/''

export interface EnumOption {
  value: string | number;
  label: string;
  description?: string;
}

export interface FieldValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: (value: any) => boolean | string;
}

export interface FieldSchema {
  key: string;                  // e.g., 'customer.tier'
  label: string;                // e.g., 'Customer Tier'
  type: FieldType;
  operators: ComparisonOperator[];
  defaultOperator?: ComparisonOperator;
  enumValues?: EnumOption[];    // For enum type
  validation?: FieldValidation;
  description?: string;
  placeholder?: string;
  group?: string;               // For grouping in dropdown
}

/**
 * Operator Labels (for UI display)
 */
export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'is greater than',
  greater_than_or_equal: 'is greater than or equal to',
  less_than: 'is less than',
  less_than_or_equal: 'is less than or equal to',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  in: 'is one of',
  not_in: 'is not one of',
  matches: 'matches pattern',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};
