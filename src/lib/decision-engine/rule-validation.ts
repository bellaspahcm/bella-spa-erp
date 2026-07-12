/**
 * Rule Validation Utilities
 * 
 * Client-side validation for rule conditions and actions.
 */

import { getFieldSchema } from './field-schema-registry';
import { getActionSchema } from './action-schema-registry';
import { ConditionExpression } from '@/components/rules/ConditionRow';
import { ActionExpression } from '@/components/rules/ActionRow';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate a single condition
 */
export function validateCondition(
  condition: ConditionExpression,
  provider: string,
  index: number
): { key: string; error: string } | null {
  const key = `condition-${index}`;

  // Check if field is selected
  if (!condition.field) {
    return { key, error: 'Please select a field' };
  }

  // Check if operator is selected
  if (!condition.operator) {
    return { key: `${key}-operator`, error: 'Please select an operator' };
  }

  // Get field schema for validation
  const fieldSchema = getFieldSchema(provider, condition.field);
  if (!fieldSchema) {
    return { key, error: 'Invalid field selected' };
  }

  // Check if operator is valid for this field type
  if (!fieldSchema.operators.includes(condition.operator)) {
    return { key: `${key}-operator`, error: `Operator '${condition.operator}' not valid for this field type` };
  }

  // Check if value is required
  const operatorNeedsValue = !['is_empty', 'is_not_empty'].includes(condition.operator);
  if (operatorNeedsValue) {
    if (condition.value === null || condition.value === undefined || condition.value === '') {
      return { key: `${key}-value`, error: 'Please enter a value' };
    }

    // Type-specific validation
    if (fieldSchema.type === 'number') {
      const numValue = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value);
      if (isNaN(numValue)) {
        return { key: `${key}-value`, error: 'Please enter a valid number' };
      }

      // Check min/max constraints
      if (fieldSchema.validation) {
        if (fieldSchema.validation.min !== undefined && numValue < fieldSchema.validation.min) {
          return { key: `${key}-value`, error: `Value must be at least ${fieldSchema.validation.min}` };
        }
        if (fieldSchema.validation.max !== undefined && numValue > fieldSchema.validation.max) {
          return { key: `${key}-value`, error: `Value must be at most ${fieldSchema.validation.max}` };
        }
      }
    }

    // Enum validation
    if (fieldSchema.type === 'enum' && fieldSchema.enumValues) {
      const validValues = fieldSchema.enumValues.map(e => e.value.toString());
      
      // For 'in' and 'not_in' operators, value is an array
      if (condition.operator === 'in' || condition.operator === 'not_in') {
        const values = Array.isArray(condition.value) ? condition.value : [condition.value];
        const invalidValues = values.filter(v => !validValues.includes(v.toString()));
        if (invalidValues.length > 0) {
          return { key: `${key}-value`, error: `Invalid value(s): ${invalidValues.join(', ')}` };
        }
      } else {
        if (!validValues.includes(condition.value.toString())) {
          return { key: `${key}-value`, error: `Value must be one of: ${validValues.join(', ')}` };
        }
      }
    }
  }

  return null; // Valid
}

/**
 * Validate all conditions
 */
export function validateConditions(
  conditions: ConditionExpression[],
  provider: string
): ValidationResult {
  const errors: Record<string, string> = {};

  if (conditions.length === 0) {
    errors['conditions-empty'] = 'Please add at least one condition';
    return { isValid: false, errors };
  }

  conditions.forEach((condition, index) => {
    const error = validateCondition(condition, provider, index);
    if (error) {
      errors[error.key] = error.error;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate a single action
 */
export function validateAction(
  action: ActionExpression,
  provider: string,
  index: number
): { key: string; errors: Record<string, string> } | null {
  const key = `action-${index}`;
  const errors: Record<string, string> = {};

  // Check if action type is selected
  if (!action.type) {
    errors.type = 'Please select an action type';
    return { key, errors };
  }

  // Get action schema for validation
  const actionSchema = getActionSchema(provider, action.type);
  if (!actionSchema) {
    errors.type = 'Invalid action type selected';
    return { key, errors };
  }

  // Validate required parameters
  actionSchema.params.forEach(param => {
    if (param.required) {
      const value = action.params?.[param.key];
      if (value === null || value === undefined || value === '') {
        errors[param.key] = `${param.label} is required`;
      }
    }

    // Type-specific validation
    const value = action.params?.[param.key];
    if (value !== null && value !== undefined && value !== '') {
      if (param.type === 'number') {
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(numValue)) {
          errors[param.key] = 'Please enter a valid number';
        } else if (param.validation) {
          if (param.validation.min !== undefined && numValue < param.validation.min) {
            errors[param.key] = `Value must be at least ${param.validation.min}`;
          }
          if (param.validation.max !== undefined && numValue > param.validation.max) {
            errors[param.key] = `Value must be at most ${param.validation.max}`;
          }
        }
      }

      // Enum validation
      if (param.type === 'enum' && param.enumValues) {
        const validValues = param.enumValues.map(e => e.value.toString());
        if (!validValues.includes(value.toString())) {
          errors[param.key] = `Value must be one of: ${validValues.join(', ')}`;
        }
      }
    }
  });

  return Object.keys(errors).length > 0 ? { key, errors } : null;
}

/**
 * Validate all actions
 */
export function validateActions(
  actions: ActionExpression[],
  provider: string
): ValidationResult {
  const errors: Record<string, string> = {};

  if (actions.length === 0) {
    errors['actions-empty'] = 'Please add at least one action';
    return { isValid: false, errors };
  }

  actions.forEach((action, index) => {
    const error = validateAction(action, provider, index);
    if (error) {
      errors[error.key] = JSON.stringify(error.errors);
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate complete rule form
 */
export function validateRuleForm(formData: {
  name: string;
  provider: string;
  category?: string;
  conditions: ConditionExpression[];
  actions: ActionExpression[];
}): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate metadata
  if (!formData.name || formData.name.trim() === '') {
    errors.name = 'Rule name is required';
  }

  if (!formData.provider) {
    errors.provider = 'Provider is required';
  }

  // Validate conditions
  const conditionsResult = validateConditions(formData.conditions, formData.provider);
  if (!conditionsResult.isValid) {
    Object.assign(errors, conditionsResult.errors);
  }

  // Validate actions
  const actionsResult = validateActions(formData.actions, formData.provider);
  if (!actionsResult.isValid) {
    Object.assign(errors, actionsResult.errors);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
