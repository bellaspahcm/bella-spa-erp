/**
 * @fileoverview Inventory Allocation Rules
 * 
 * Rules for stock allocation decisions when bookings are confirmed.
 * Handles VIP priority, stock reservation, and multi-location transfers.
 * 
 * **Priority Range:** 450-480 (Allocation category)
 * 
 * **Rule Execution Order:**
 * 1. VIP Priority Allocation (450) - Reserve best stock for VIP customers
 * 2. Standard Allocation (460) - Normal stock allocation for regular bookings
 * 3. Stock Reservation (470) - Lock stock for confirmed bookings
 * 4. Transfer Decision (480) - Transfer from other locations if stock low
 * 
 * @module decision-engine/providers/inventory/rules/allocation
 */

import type { Rule } from '@/lib/decision-engine/types';

/**
 * Rule 6: VIP Priority Allocation
 * 
 * **Priority:** 450 (highest in allocation category)
 * 
 * **Trigger:** Booking from VIP customer + sufficient stock
 * 
 * **Action:** Allocate best quality stock, reserve immediately
 * 
 * **Business Logic:**
 * - VIP customers get priority access
 * - Allocate freshest stock (highest days until expiry)
 * - Reserve immediately (24h reservation)
 * - High priority processing
 */
export const vipPriorityAllocationRule: Rule = {
  id: 'inventory_allocation_vip_priority',
  name: 'VIP Priority Allocation',
  description: 'Allocate best quality stock with priority reservation for VIP customers',
  priority: 450,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'allocation',
      },
      {
        type: 'simple',
        field: 'allocationRequest.customerTier',
        operator: 'equals',
        value: 'vip',
      },
      {
        type: 'simple',
        field: 'productStock.currentStock',
        operator: 'greaterThanOrEqual',
        value: 'REQUESTED_QUANTITY', // allocationRequest.quantity
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      canAllocate: true,
      allocatedQuantity: 'REQUESTED_QUANTITY',
      priority: 'high',
      shouldReserve: true,
      reservationExpiry: 'ADD_24_HOURS', // Current date + 24 hours
      reason: 'VIP customer. Best quality stock allocated with priority reservation.',
      stockSelection: 'FRESHEST_FIRST', // Highest daysUntilExpiry
    },
    message: 'VIP allocation approved. Stock reserved for 24 hours.',
  },
  metadata: {
    category: 'allocation',
    tags: ['vip', 'priority', 'reservation'],
    businessImpact: 'high',
    automatable: true,
  },
};

/**
 * Rule 7: Standard Allocation
 * 
 * **Priority:** 460
 * 
 * **Trigger:** Booking from regular customer + sufficient stock
 * 
 * **Action:** Allocate standard stock with normal priority
 * 
 * **Business Logic:**
 * - Regular customers get standard allocation
 * - Use FEFO (First Expiry First Out) logic
 * - Reserve if booking is confirmed
 * - Normal priority processing
 */
export const standardAllocationRule: Rule = {
  id: 'inventory_allocation_standard',
  name: 'Standard Allocation',
  description: 'Allocate stock for regular customers using FEFO logic',
  priority: 460,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'allocation',
      },
      {
        type: 'simple',
        field: 'allocationRequest.customerTier',
        operator: 'in',
        value: ['loyal', 'regular', 'new'],
      },
      {
        type: 'simple',
        field: 'productStock.currentStock',
        operator: 'greaterThanOrEqual',
        value: 'REQUESTED_QUANTITY',
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      canAllocate: true,
      allocatedQuantity: 'REQUESTED_QUANTITY',
      priority: 'normal',
      shouldReserve: 'IF_CONFIRMED', // Reserve only if allocationRequest.isConfirmed = true
      reservationExpiry: 'ADD_12_HOURS', // Current date + 12 hours (shorter than VIP)
      reason: 'Standard allocation. Stock allocated using FEFO logic.',
      stockSelection: 'FEFO', // First Expiry First Out
    },
    message: 'Standard allocation approved. Stock will be reserved if booking is confirmed.',
  },
  metadata: {
    category: 'allocation',
    tags: ['standard', 'fefo', 'normal-priority'],
    businessImpact: 'medium',
    automatable: true,
  },
};

/**
 * Rule 8: Insufficient Stock - Partial Allocation
 * 
 * **Priority:** 470
 * 
 * **Trigger:** Stock available but less than requested
 * 
 * **Action:** Allocate available stock + suggest alternatives
 * 
 * **Business Logic:**
 * - Allocate whatever is available
 * - Suggest alternative products
 * - Alert for potential reorder
 * - Mark as partial allocation
 */
export const partialAllocationRule: Rule = {
  id: 'inventory_allocation_partial',
  name: 'Partial Allocation - Insufficient Stock',
  description: 'Allocate available stock when insufficient, suggest alternatives',
  priority: 470,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'allocation',
      },
      {
        type: 'simple',
        field: 'productStock.currentStock',
        operator: 'greaterThan',
        value: 0,
      },
      {
        type: 'simple',
        field: 'productStock.currentStock',
        operator: 'lessThan',
        value: 'REQUESTED_QUANTITY',
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      canAllocate: true, // Partial allocation
      allocatedQuantity: 'CURRENT_STOCK', // Allocate all available
      priority: 'normal',
      shouldReserve: true,
      reservationExpiry: 'ADD_6_HOURS', // Short reservation
      reason: 'Insufficient stock. Partial allocation. Consider alternatives or reorder.',
      suggestAlternatives: true,
      alertReorder: true,
    },
    message: 'Partial allocation. Alternatives recommended.',
  },
  metadata: {
    category: 'allocation',
    tags: ['partial', 'insufficient-stock', 'alternatives'],
    businessImpact: 'medium',
    automatable: false, // Requires manual review
  },
};

/**
 * Rule 9: No Stock - Transfer Decision
 * 
 * **Priority:** 480
 * 
 * **Trigger:** No stock at current location + stock available at other locations
 * 
 * **Action:** Initiate transfer from nearest location
 * 
 * **Business Logic:**
 * - Check stock at other locations
 * - Transfer from nearest location (within 50km)
 * - Calculate transfer cost and timing
 * - Alert staff for transfer coordination
 */
export const transferDecisionRule: Rule = {
  id: 'inventory_allocation_transfer',
  name: 'Transfer Decision - Multi-Location',
  description: 'Transfer stock from other locations when local stock unavailable',
  priority: 480,
  enabled: true,
  version: 1,
  condition: {
    type: 'all',
    conditions: [
      {
        type: 'simple',
        field: 'decisionType',
        operator: 'equals',
        value: 'allocation',
      },
      {
        type: 'simple',
        field: 'productStock.currentStock',
        operator: 'equals',
        value: 0,
      },
      {
        type: 'simple',
        field: 'locationStocks',
        operator: 'greaterThan',
        value: 0, // At least one other location has stock
      },
    ],
  },
  action: {
    type: 'modify',
    data: {
      canAllocate: false, // Cannot allocate immediately
      allocatedQuantity: 0,
      shouldTransfer: true,
      transferFrom: 'NEAREST_LOCATION', // Location with stock, minimum distanceKm
      transferQuantity: 'REQUESTED_QUANTITY',
      transferUrgency: 'BASED_ON_BOOKING_DATE', // Urgent if booking within 48h
      reason: 'No local stock. Transfer recommended from nearest location.',
      estimatedTransferTime: 'CALCULATE_BY_DISTANCE', // Distance / 50km/h avg
    },
    message: 'Transfer required. Stock will be allocated after transfer completion.',
  },
  metadata: {
    category: 'allocation',
    tags: ['transfer', 'multi-location', 'coordination'],
    businessImpact: 'high',
    automatable: false, // Requires logistics coordination
  },
};

/**
 * All Allocation Rules (sorted by priority)
 */
export const allocationRules: Rule[] = [
  vipPriorityAllocationRule,
  standardAllocationRule,
  partialAllocationRule,
  transferDecisionRule,
];

