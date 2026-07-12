/**
 * Action Schema Registry
 * 
 * Central registry for all provider action schemas.
 * Provides lookup functions for dynamic action editing in UI.
 */

import { ActionSchema } from './action-schema.types';
import { BOOKING_ACTIONS } from './providers/booking/action-schema';
import { DISCOUNT_ACTIONS } from './providers/discount/action-schema';
import { PAYROLL_ACTIONS } from './providers/payroll/action-schema';
import { COMMISSION_ACTIONS } from './providers/commission/action-schema';
import { INVENTORY_ACTIONS } from './providers/inventory/action-schema';

export const ACTION_SCHEMA_REGISTRY: Record<string, ActionSchema[]> = {
  booking: BOOKING_ACTIONS,
  discount: DISCOUNT_ACTIONS,
  payroll: PAYROLL_ACTIONS,
  commission: COMMISSION_ACTIONS,
  inventory: INVENTORY_ACTIONS,
};

/**
 * Get a specific action schema by provider and action type
 */
export function getActionSchema(provider: string, actionType: string): ActionSchema | undefined {
  const actions = ACTION_SCHEMA_REGISTRY[provider] || [];
  return actions.find(a => a.type === actionType);
}

/**
 * Get all action schemas for a provider
 */
export function getActionsByProvider(provider: string): ActionSchema[] {
  return ACTION_SCHEMA_REGISTRY[provider] || [];
}

/**
 * Get grouped actions for dropdown display
 */
export function getGroupedActions(provider: string): Record<string, ActionSchema[]> {
  const actions = getActionsByProvider(provider);
  const grouped: Record<string, ActionSchema[]> = {};
  
  actions.forEach(action => {
    const group = action.group || 'Other';
    if (!grouped[group]) {
      grouped[group] = [];
    }
    grouped[group].push(action);
  });
  
  return grouped;
}
