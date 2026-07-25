/**
 * Action Schema Types
 * 
 * Type definitions for dynamic action editing and validation
 * in the Rule Management UI.
 */

import { FieldType, EnumOption, FieldValidation } from './field-schema.types';

export interface ActionParam {
  key: string;                  // e.g., 'priority'
  label: string;                // e.g., 'Priority Value'
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  enumValues?: EnumOption[];
  validation?: FieldValidation;
  description?: string;
  placeholder?: string;
}

export interface ActionSchema {
  type: string;                 // e.g., 'approve', 'reject', 'set_priority'
  label: string;                // e.g., 'Approve Booking'
  description?: string;
  params: ActionParam[];
  group?: string;               // For grouping in dropdown
}
