# Task 10 Phase 3 - Architecture Design Document

**Date**: 2026-07-09  
**Version**: 1.0.0  
**Status**: Design Phase  
**Author**: AI Development Agent

---

## Executive Summary

This document defines the technical architecture for **Rule Management UI Phase 3**, focusing on:

1. **Visual Rule Builder** - Drag-and-drop condition/action editor
2. **Decision Simulator** - Test rules with live data preview
3. **Field Schema Registry** - Dynamic form generation system
4. **Component Architecture** - Modular, reusable components

**Target**: Enable business users to create and test decision rules without code.

**Estimated Effort**: 10-13 days  
**Estimated Code**: 2,600-3,600 lines  
**Estimated Tests**: 45+ tests

---

## Part 1: System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Rule Management UI                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Metadata   │  │  Conditions  │  │   Actions    │     │
│  │    Editor    │  │   Builder    │  │   Builder    │     │
│  │  (Phase 2)   │  │  (Phase 3)   │  │  (Phase 3)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Decision   │  │     Test     │  │   Version    │     │
│  │  Simulator   │  │   History    │  │  Comparison  │     │
│  │  (Phase 3)   │  │  (Phase 3)   │  │  (Optional)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│              Field Schema Registry (Phase 3)                 │
├─────────────────────────────────────────────────────────────┤
│                    Decision Engine Core                      │
│              (5 Providers: Booking, Discount, etc.)         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Dependency Graph

```
RuleEditor (Container)
  ├─ RuleMetadataForm ✅ (Phase 2)
  ├─ RuleConditionsBuilder ❌ (Phase 3)
  │    ├─ ConditionGroup
  │    │    ├─ ConditionRow
  │    │    │    ├─ FieldSelector
  │    │    │    ├─ OperatorSelector
  │    │    │    └─ ValueInput
  │    │    └─ AddConditionButton
  │    └─ AddGroupButton
  ├─ RuleActionsBuilder ❌ (Phase 3)
  │    ├─ ActionRow
  │    │    ├─ ActionTypeSelector
  │    │    ├─ ActionParamsForm
  │    │    └─ DeleteButton
  │    └─ AddActionButton
  └─ SaveButtons ✅ (Phase 2)

RuleSimulator (New Page) ❌ (Phase 3)
  ├─ RuleInputForm
  │    ├─ JsonEditor (fallback)
  │    └─ DynamicForm (provider-specific)
  ├─ ExecuteButton
  ├─ RuleExecutionTrace
  │    ├─ TraceTimeline
  │    ├─ ConditionResults
  │    └─ ActionResults
  └─ TestHistory
```

---

## Part 2: Field Schema Registry

### 2.1 Purpose

The Field Schema Registry provides:
- **Dynamic field selection** - Fields available per provider
- **Type-safe operators** - Only valid operators for each field type
- **Smart value inputs** - Appropriate input type (text, number, date, select, etc.)
- **Validation rules** - Client-side validation before submission


### 2.2 Field Schema Interface

```typescript
// src/lib/decision-engine/field-schema.types.ts

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
```


### 2.3 Provider Field Schemas

#### Booking Provider Fields

```typescript
// src/lib/decision-engine/providers/booking/field-schema.ts

export const BOOKING_FIELDS: FieldSchema[] = [
  // Customer Fields
  {
    key: 'customer.tier',
    label: 'Customer Tier',
    type: 'enum',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'VIP', label: 'VIP' },
      { value: 'Loyal', label: 'Loyal Customer' },
      { value: 'New', label: 'New Customer' },
    ],
    group: 'Customer',
    description: 'Customer membership tier',
  },
  {
    key: 'customer.totalBookings',
    label: 'Total Bookings',
    type: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Customer',
    description: 'Total number of bookings by this customer',
  },
  {
    key: 'customer.lifetimeValue',
    label: 'Lifetime Value (VND)',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Customer',
  },
  
  // Booking Fields
  {
    key: 'booking.serviceCount',
    label: 'Number of Services',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Booking',
    description: 'Number of services in this booking',
  },
  {
    key: 'booking.totalAmount',
    label: 'Total Amount (VND)',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Booking',
  },
  {
    key: 'booking.scheduledDate',
    label: 'Scheduled Date',
    type: 'datetime',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Booking',
  },
  {
    key: 'booking.status',
    label: 'Booking Status',
    type: 'enum',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    group: 'Booking',
  },
  
  // KTV Fields
  {
    key: 'ktv.availableCount',
    label: 'Available KTVs',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than',
    group: 'KTV',
    description: 'Number of available KTVs for this time slot',
  },
  {
    key: 'ktv.seniorCount',
    label: 'Senior KTVs Available',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal'],
    defaultOperator: 'greater_than',
    group: 'KTV',
  },
];
```


#### Discount Provider Fields

```typescript
// src/lib/decision-engine/providers/discount/field-schema.ts

export const DISCOUNT_FIELDS: FieldSchema[] = [
  {
    key: 'customer.membershipTier',
    label: 'Membership Tier',
    type: 'enum',
    operators: ['equals', 'in'],
    enumValues: [
      { value: 'VIP', label: 'VIP (15% discount)' },
      { value: 'Loyal', label: 'Loyal (10% discount)' },
      { value: 'New', label: 'New Customer (5% discount)' },
    ],
    group: 'Customer',
  },
  {
    key: 'order.totalAmount',
    label: 'Order Total (VND)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Order',
  },
  {
    key: 'order.itemCount',
    label: 'Number of Items',
    type: 'number',
    operators: ['greater_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Order',
  },
  {
    key: 'campaign.code',
    label: 'Campaign Code',
    type: 'string',
    operators: ['equals', 'in'],
    defaultOperator: 'equals',
    group: 'Campaign',
  },
  {
    key: 'campaign.isActive',
    label: 'Campaign Active',
    type: 'boolean',
    operators: ['equals'],
    defaultOperator: 'equals',
    group: 'Campaign',
  },
];
```

#### Payroll Provider Fields

```typescript
// src/lib/decision-engine/providers/payroll/field-schema.ts

export const PAYROLL_FIELDS: FieldSchema[] = [
  {
    key: 'ktv.totalSessions',
    label: 'Total Sessions (Weighted)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Performance',
    description: 'Total sessions with package multipliers applied',
  },
  {
    key: 'ktv.avgRating',
    label: 'Average Rating',
    type: 'number',
    operators: ['greater_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Performance',
  },
  {
    key: 'ktv.violationCount',
    label: 'Violation Count',
    type: 'number',
    operators: ['equals', 'greater_than'],
    defaultOperator: 'equals',
    group: 'Attendance',
  },
  {
    key: 'ktv.lateCount',
    label: 'Late Arrivals',
    type: 'number',
    operators: ['greater_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Attendance',
  },
  {
    key: 'period.month',
    label: 'Month',
    type: 'number',
    operators: ['equals'],
    defaultOperator: 'equals',
    group: 'Period',
  },
];
```

### 2.4 Field Schema Registry

```typescript
// src/lib/decision-engine/field-schema-registry.ts

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

export function getFieldSchema(provider: string, fieldKey: string): FieldSchema | undefined {
  const fields = FIELD_SCHEMA_REGISTRY[provider] || [];
  return fields.find(f => f.key === fieldKey);
}

export function getFieldsByProvider(provider: string): FieldSchema[] {
  return FIELD_SCHEMA_REGISTRY[provider] || [];
}

export function getOperatorsForField(provider: string, fieldKey: string): ComparisonOperator[] {
  const field = getFieldSchema(provider, fieldKey);
  return field?.operators || [];
}
```


---

## Part 3: Action Schema Registry

### 3.1 Action Schema Interface

```typescript
// src/lib/decision-engine/action-schema.types.ts

export interface ActionSchema {
  type: string;                 // e.g., 'approve', 'reject', 'set_priority'
  label: string;                // e.g., 'Approve Booking'
  description?: string;
  params: ActionParam[];
  group?: string;
}

export interface ActionParam {
  key: string;                  // e.g., 'priority'
  label: string;                // e.g., 'Priority Value'
  type: FieldType;
  required?: boolean;
  defaultValue?: any;
  enumValues?: EnumOption[];
  validation?: FieldValidation;
  description?: string;
  placeholder?: string;
}
```

### 3.2 Provider Action Schemas

#### Booking Provider Actions

```typescript
// src/lib/decision-engine/providers/booking/action-schema.ts

export const BOOKING_ACTIONS: ActionSchema[] = [
  {
    type: 'approve',
    label: 'Approve Booking',
    description: 'Automatically approve the booking without manual review',
    params: [
      {
        key: 'message',
        label: 'Approval Message',
        type: 'string',
        required: false,
        placeholder: 'e.g., VIP customer - auto-approved',
      },
    ],
    group: 'Approval',
  },
  {
    type: 'reject',
    label: 'Reject Booking',
    description: 'Automatically reject the booking',
    params: [
      {
        key: 'reason',
        label: 'Rejection Reason',
        type: 'string',
        required: true,
        placeholder: 'e.g., No available KTVs',
      },
    ],
    group: 'Approval',
  },
  {
    type: 'requiresDeposit',
    label: 'Require Deposit',
    description: 'Flag booking as requiring deposit payment',
    params: [
      {
        key: 'depositAmount',
        label: 'Deposit Amount (VND)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 500000',
      },
      {
        key: 'depositPercentage',
        label: 'Deposit Percentage',
        type: 'number',
        required: false,
        placeholder: 'e.g., 30 (for 30%)',
        validation: { min: 0, max: 100 },
      },
    ],
    group: 'Payment',
  },
  {
    type: 'set_priority',
    label: 'Set Priority',
    description: 'Assign priority level to booking',
    params: [
      {
        key: 'priority',
        label: 'Priority Value',
        type: 'number',
        required: true,
        defaultValue: 100,
        validation: { min: 0, max: 1000 },
        description: 'Higher values = higher priority',
      },
    ],
    group: 'Processing',
  },
  {
    type: 'assign_ktv',
    label: 'Assign Specific KTV',
    description: 'Assign a specific KTV to the booking',
    params: [
      {
        key: 'ktvLevel',
        label: 'KTV Level',
        type: 'enum',
        required: true,
        enumValues: [
          { value: 'senior', label: 'Senior KTV' },
          { value: 'intermediate', label: 'Intermediate KTV' },
          { value: 'junior', label: 'Junior KTV' },
        ],
      },
    ],
    group: 'Assignment',
  },
  {
    type: 'add_to_waitlist',
    label: 'Add to Waitlist',
    description: 'Add booking to waitlist if no KTV available',
    params: [
      {
        key: 'notifyCustomer',
        label: 'Notify Customer',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    group: 'Processing',
  },
];
```


#### Discount Provider Actions

```typescript
// src/lib/decision-engine/providers/discount/action-schema.ts

export const DISCOUNT_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_percentage_discount',
    label: 'Apply Percentage Discount',
    params: [
      {
        key: 'percentage',
        label: 'Discount Percentage',
        type: 'number',
        required: true,
        validation: { min: 0, max: 100 },
        placeholder: 'e.g., 15',
      },
      {
        key: 'reason',
        label: 'Discount Reason',
        type: 'string',
        required: false,
        placeholder: 'e.g., VIP membership',
      },
    ],
    group: 'Discount',
  },
  {
    type: 'apply_fixed_discount',
    label: 'Apply Fixed Amount Discount',
    params: [
      {
        key: 'amount',
        label: 'Discount Amount (VND)',
        type: 'number',
        required: true,
        placeholder: 'e.g., 100000',
      },
    ],
    group: 'Discount',
  },
  {
    type: 'apply_campaign_discount',
    label: 'Apply Campaign Discount',
    params: [
      {
        key: 'campaignCode',
        label: 'Campaign Code',
        type: 'string',
        required: true,
      },
    ],
    group: 'Campaign',
  },
];
```

#### Payroll Provider Actions

```typescript
// src/lib/decision-engine/providers/payroll/action-schema.ts

export const PAYROLL_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_kpi_bonus',
    label: 'Apply KPI Bonus',
    params: [
      {
        key: 'amount',
        label: 'Bonus Amount (VND)',
        type: 'number',
        required: true,
      },
      {
        key: 'reason',
        label: 'Bonus Reason',
        type: 'string',
        required: true,
      },
    ],
    group: 'Bonus',
  },
  {
    type: 'apply_deduction',
    label: 'Apply Deduction',
    params: [
      {
        key: 'amount',
        label: 'Deduction Amount (VND)',
        type: 'number',
        required: true,
      },
      {
        key: 'reason',
        label: 'Deduction Reason',
        type: 'enum',
        required: true,
        enumValues: [
          { value: 'late_arrival', label: 'Late Arrival' },
          { value: 'absent_unnotified', label: 'Absent Without Notice' },
          { value: 'policy_violation', label: 'Policy Violation' },
        ],
      },
    ],
    group: 'Deduction',
  },
  {
    type: 'apply_rating_bonus',
    label: 'Apply Rating Bonus',
    params: [
      {
        key: 'amount',
        label: 'Bonus Amount (VND)',
        type: 'number',
        required: true,
      },
    ],
    group: 'Bonus',
  },
];
```

### 3.3 Action Schema Registry

```typescript
// src/lib/decision-engine/action-schema-registry.ts

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

export function getActionSchema(provider: string, actionType: string): ActionSchema | undefined {
  const actions = ACTION_SCHEMA_REGISTRY[provider] || [];
  return actions.find(a => a.type === actionType);
}

export function getActionsByProvider(provider: string): ActionSchema[] {
  return ACTION_SCHEMA_REGISTRY[provider] || [];
}
```


---

## Part 4: Component Specifications

### 4.1 RuleConditionsBuilder Component

**File**: `src/components/rules/RuleConditionsBuilder.tsx`

**Purpose**: Visual editor for rule conditions with AND/OR logic

**Props**:
```typescript
interface RuleConditionsBuilderProps {
  provider: string;                           // Provider type (booking, discount, etc.)
  conditions: ConditionExpression[];          // Current conditions
  onChange: (conditions: ConditionExpression[]) => void;  // Update callback
  errors?: Record<string, string>;            // Validation errors
}
```

**State**:
```typescript
interface BuilderState {
  conditions: ConditionExpression[];
  logicalOperator: 'and' | 'or';              // Top-level operator
  isDirty: boolean;
}
```

**Features**:
- ✅ List all conditions
- ✅ Add new condition button
- ✅ Remove condition button
- ✅ Logical operator toggle (AND/OR)
- ✅ Real-time validation
- ✅ Empty state message
- ⏸️ Nested groups (Phase 4)
- ⏸️ Drag-and-drop reordering (Phase 4)

**UI Layout**:
```
┌─────────────────────────────────────────────────────┐
│ Conditions                                          │
├─────────────────────────────────────────────────────┤
│ Match [ALL ▼] of the following conditions:         │
│                                                     │
│ ┌─────────────────────────────────────────────┐  │
│ │ [Field ▼] [Operator ▼] [Value Input] [×]   │  │
│ └─────────────────────────────────────────────┘  │
│                                                     │
│ [AND]                                              │
│                                                     │
│ ┌─────────────────────────────────────────────┐  │
│ │ [Field ▼] [Operator ▼] [Value Input] [×]   │  │
│ └─────────────────────────────────────────────┘  │
│                                                     │
│ [+ Add Condition]                                  │
└─────────────────────────────────────────────────────┘
```

**Estimated Lines**: 200-250

---

### 4.2 ConditionRow Component

**File**: `src/components/rules/ConditionRow.tsx`

**Purpose**: Single condition editor (Field + Operator + Value)

**Props**:
```typescript
interface ConditionRowProps {
  provider: string;
  condition: ConditionExpression;
  onChange: (condition: ConditionExpression) => void;
  onDelete: () => void;
  error?: string;
}
```

**Features**:
- ✅ Field selector (searchable dropdown)
- ✅ Operator selector (filtered by field type)
- ✅ Dynamic value input (based on field type)
- ✅ Delete button
- ✅ Validation error display
- ✅ Field description tooltip

**Value Input Types**:
- `string`: Text input
- `number`: Number input with validation
- `boolean`: Switch/Toggle
- `date`: Date picker
- `datetime`: Date + time picker
- `enum`: Select dropdown
- `array`: Multi-select or comma-separated input

**UI Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Customer Tier ▼] [equals ▼] [VIP ▼] [× Delete]           │
│  ℹ Customer membership tier                                 │
└─────────────────────────────────────────────────────────────┘
```

**Estimated Lines**: 250-300


---

### 4.3 RuleActionsBuilder Component

**File**: `src/components/rules/RuleActionsBuilder.tsx`

**Purpose**: Visual editor for rule actions

**Props**:
```typescript
interface RuleActionsBuilderProps {
  provider: string;
  actions: ActionExpression[];
  onChange: (actions: ActionExpression[]) => void;
  errors?: Record<string, string>;
}
```

**Features**:
- ✅ List all actions
- ✅ Add new action button
- ✅ Remove action button
- ✅ Action order display (1, 2, 3...)
- ✅ Empty state message
- ⏸️ Drag-and-drop reordering (Phase 4)
- ⏸️ Preview action output (Phase 4)

**UI Layout**:
```
┌─────────────────────────────────────────────────────┐
│ Actions                                             │
├─────────────────────────────────────────────────────┤
│ When conditions match, perform these actions:       │
│                                                      │
│ 1. ┌──────────────────────────────────────────┐   │
│    │ [Approve Booking ▼]                      │   │
│    │ Message: [VIP customer - auto-approved]  │   │
│    │ [× Remove]                               │   │
│    └──────────────────────────────────────────┘   │
│                                                      │
│ 2. ┌──────────────────────────────────────────┐   │
│    │ [Set Priority ▼]                         │   │
│    │ Priority Value: [1000]                   │   │
│    │ [× Remove]                               │   │
│    └──────────────────────────────────────────┘   │
│                                                      │
│ [+ Add Action]                                      │
└─────────────────────────────────────────────────────┘
```

**Estimated Lines**: 150-200

---

### 4.4 ActionRow Component

**File**: `src/components/rules/ActionRow.tsx`

**Purpose**: Single action editor (Type + Parameters)

**Props**:
```typescript
interface ActionRowProps {
  provider: string;
  action: ActionExpression;
  actionNumber: number;
  onChange: (action: ActionExpression) => void;
  onDelete: () => void;
  error?: string;
}
```

**Features**:
- ✅ Action type selector
- ✅ Dynamic parameter form (based on action schema)
- ✅ Delete button
- ✅ Validation error display
- ✅ Action description tooltip

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Action 1                                                │
├─────────────────────────────────────────────────────────┤
│ Type: [Require Deposit ▼]                              │
│                                                         │
│ Deposit Amount (VND): [500000]                         │
│ Deposit Percentage:   [30]                             │
│                                                         │
│ [× Remove Action]                                      │
└─────────────────────────────────────────────────────────┘
```

**Estimated Lines**: 200-250


---

### 4.5 RuleSimulator Page

**File**: `src/app/dashboard/rules/[ruleId]/test/page.tsx`

**Purpose**: Test rules with sample data and view execution trace

**Features**:
- ✅ Input form (JSON editor or dynamic form)
- ✅ Sample data templates
- ✅ Execute button
- ✅ Result display (pass/fail)
- ✅ Execution trace visualization
- ✅ Performance metrics
- ✅ Save test result button
- ✅ Test history list

**UI Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Test Rule: "VIP Customer Priority"                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│ ┌─────────────────────┬──────────────────────────┐  │
│ │ Input Data          │ Execution Result         │  │
│ ├─────────────────────┼──────────────────────────┤  │
│ │                     │                          │  │
│ │ [Use Template ▼]    │ ✅ Passed                │  │
│ │                     │                          │  │
│ │ {                   │ Decision: Approve        │  │
│ │   "customer": {     │ Execution Time: 1.2ms    │  │
│ │     "tier": "VIP"   │                          │  │
│ │   },                │ Conditions:              │  │
│ │   "booking": {      │ ✓ customer.tier = VIP    │  │
│ │     "amount": 5000  │                          │  │
│ │   }                 │ Actions:                 │  │
│ │ }                   │ ✓ Approve Booking        │  │
│ │                     │ ✓ Set Priority = 1000    │  │
│ │ [Execute Test]      │                          │  │
│ │                     │ [Save Test Result]       │  │
│ └─────────────────────┴──────────────────────────┘  │
│                                                        │
│ Test History (Last 10)                                │
│ ┌────────────────────────────────────────────────┐  │
│ │ 2026-07-09 14:30 | ✅ Passed | VIP test case  │  │
│ │ 2026-07-09 14:25 | ❌ Failed | Edge case      │  │
│ └────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

**Components**:
- `RuleSimulator` (main container)
- `RuleInputForm` (JSON editor + templates)
- `RuleExecutionTrace` (visualization)
- `RuleTestHistory` (past results)

**Estimated Lines**: 400-500

---

## Part 5: Data Flow Architecture

### 5.1 Component Data Flow

```
User Interaction
      ↓
ConditionRow (emits change)
      ↓
RuleConditionsBuilder (aggregates)
      ↓
RuleEditor (stores in formData)
      ↓
API Call (POST /api/rules)
      ↓
Supabase (stores as JSONB)
      ↓
Decision Engine (evaluates at runtime)
```

### 5.2 Condition Expression Structure

**User-Friendly Format** (UI):
```json
{
  "field": "customer.tier",
  "operator": "equals",
  "value": "VIP"
}
```

**Decision Engine Format** (Backend):
```json
{
  "field": "customer.tier",
  "operator": "equals",
  "value": "VIP"
}
```

✅ **No transformation needed** - Same format for UI and backend!

### 5.3 Action Expression Structure

**User-Friendly Format** (UI):
```json
{
  "type": "requiresDeposit",
  "params": {
    "depositAmount": 500000,
    "depositPercentage": 30
  }
}
```

**Decision Engine Format** (Backend):
```json
{
  "type": "requiresDeposit",
  "value": {
    "depositAmount": 500000,
    "depositPercentage": 30
  }
}
```

⚠️ **Minor transformation**: `params` → `value` when saving to database


---

## Part 6: Validation Strategy

### 6.1 Client-Side Validation

**Condition Validation**:
```typescript
function validateCondition(condition: ConditionExpression, fieldSchema: FieldSchema): string | null {
  // 1. Check if field exists
  if (!fieldSchema) {
    return 'Field not found';
  }
  
  // 2. Check if operator is valid for field type
  if (!fieldSchema.operators.includes(condition.operator)) {
    return `Operator '${condition.operator}' not supported for field type '${fieldSchema.type}'`;
  }
  
  // 3. Check if value matches field type
  if (fieldSchema.type === 'number' && typeof condition.value !== 'number') {
    return 'Value must be a number';
  }
  
  // 4. Check enum values
  if (fieldSchema.type === 'enum' && fieldSchema.enumValues) {
    const validValues = fieldSchema.enumValues.map(e => e.value);
    if (!validValues.includes(condition.value)) {
      return `Value must be one of: ${validValues.join(', ')}`;
    }
  }
  
  // 5. Check required
  if (condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty') {
    if (condition.value === null || condition.value === undefined || condition.value === '') {
      return 'Value is required';
    }
  }
  
  return null; // Valid
}
```

**Action Validation**:
```typescript
function validateAction(action: ActionExpression, actionSchema: ActionSchema): string | null {
  // 1. Check if action type exists
  if (!actionSchema) {
    return 'Action type not found';
  }
  
  // 2. Check required params
  for (const param of actionSchema.params) {
    if (param.required && !action.params?.[param.key]) {
      return `Parameter '${param.label}' is required`;
    }
  }
  
  // 3. Check param types
  for (const param of actionSchema.params) {
    const value = action.params?.[param.key];
    if (value !== undefined) {
      if (param.type === 'number' && typeof value !== 'number') {
        return `Parameter '${param.label}' must be a number`;
      }
      // ... more type checks
    }
  }
  
  return null; // Valid
}
```

### 6.2 Server-Side Validation

**Database Schema Validation** (Supabase):
- JSONB schema validation
- Foreign key constraints
- Check constraints

**Business Logic Validation**:
- Circular dependency detection
- Conflicting rules detection
- Rule priority validation


---

## Part 7: Testing Strategy

### 7.1 Unit Tests

**Test Files**:
1. `RuleConditionsBuilder.test.tsx` (10 tests)
   - Render with empty conditions
   - Add new condition
   - Remove condition
   - Update condition field/operator/value
   - Validate conditions
   - Toggle logical operator (AND/OR)
   - Display validation errors
   - Handle invalid provider
   - Handle missing field schema
   - Callback prop invoked correctly

2. `ConditionRow.test.tsx` (8 tests)
   - Render with condition data
   - Field selector shows correct options
   - Operator selector filtered by field type
   - Value input type matches field type
   - Delete button works
   - onChange callback invoked
   - Validation errors displayed
   - Field description tooltip

3. `RuleActionsBuilder.test.tsx` (8 tests)
   - Render with empty actions
   - Add new action
   - Remove action
   - Update action type
   - Update action params
   - Action order displayed correctly
   - Validate actions
   - Callback prop invoked correctly

4. `ActionRow.test.tsx` (6 tests)
   - Render with action data
   - Action type selector shows correct options
   - Dynamic params form renders based on schema
   - Delete button works
   - onChange callback invoked
   - Validation errors displayed

5. `field-schema-registry.test.ts` (5 tests)
   - Get field schema by provider and key
   - Get all fields by provider
   - Get operators for field
   - Handle invalid provider
   - Handle invalid field key

6. `action-schema-registry.test.ts` (5 tests)
   - Get action schema by provider and type
   - Get all actions by provider
   - Handle invalid provider
   - Handle invalid action type
   - Param schemas correct

**Total Unit Tests**: 42 tests

---

### 7.2 Integration Tests

**Test File**: `rule-editor-integration.test.tsx` (15 tests)

1. Create rule with single condition
2. Create rule with multiple conditions (AND)
3. Create rule with multiple conditions (OR)
4. Create rule with single action
5. Create rule with multiple actions
6. Update rule conditions
7. Update rule actions
8. Validate condition field type mismatch
9. Validate condition operator invalid
10. Validate condition value required
11. Validate action params required
12. Validate action params type mismatch
13. Save rule to database
14. Load existing rule and edit
15. Delete condition/action

**Total Integration Tests**: 15 tests

---

### 7.3 E2E Tests

**Test File**: `rule-management-e2e.test.ts` (10 tests)

1. Navigate to rule creation page
2. Create complete rule (metadata + conditions + actions)
3. Save rule successfully
4. Navigate to rule list and verify rule appears
5. Edit existing rule
6. Test rule with simulator
7. View execution trace
8. Save test result
9. View test history
10. Archive rule

**Total E2E Tests**: 10 tests

---

### 7.4 Test Coverage Goals

| Layer | Target Coverage |
|-------|----------------|
| **Components** | 85%+ |
| **Field Schema** | 90%+ |
| **Action Schema** | 90%+ |
| **Validation Logic** | 95%+ |
| **Integration** | 80%+ |

**Total Tests**: 67 tests (42 unit + 15 integration + 10 E2E)


---

## Part 8: Implementation Plan

### 8.1 Phase Breakdown

**Phase 3A: Field & Action Schemas** (2 days)
- Day 1: Create field schema types and interfaces
- Day 1: Implement field schemas for all 5 providers
- Day 2: Create action schema types and interfaces
- Day 2: Implement action schemas for all 5 providers
- Day 2: Create schema registry utilities
- Day 2: Unit tests for schemas (10 tests)

**Deliverables**:
- `src/lib/decision-engine/field-schema.types.ts`
- `src/lib/decision-engine/action-schema.types.ts`
- `src/lib/decision-engine/field-schema-registry.ts`
- `src/lib/decision-engine/action-schema-registry.ts`
- `src/lib/decision-engine/providers/*/field-schema.ts` (5 files)
- `src/lib/decision-engine/providers/*/action-schema.ts` (5 files)
- **Estimated Lines**: 800-1,000

---

**Phase 3B: Visual Condition Builder** (3 days)
- Day 1: Create ConditionRow component
- Day 1: Field selector with autocomplete
- Day 1: Operator selector (filtered by field type)
- Day 2: Dynamic value input (all field types)
- Day 2: Create RuleConditionsBuilder component
- Day 2: Add/remove condition logic
- Day 3: Logical operator toggle (AND/OR)
- Day 3: Validation logic
- Day 3: Unit tests (18 tests)

**Deliverables**:
- `src/components/rules/ConditionRow.tsx`
- `src/components/rules/RuleConditionsBuilder.tsx`
- `src/components/rules/FieldSelector.tsx`
- `src/components/rules/OperatorSelector.tsx`
- `src/components/rules/ValueInput.tsx`
- **Estimated Lines**: 600-800

---

**Phase 3C: Visual Action Builder** (2 days)
- Day 1: Create ActionRow component
- Day 1: Action type selector
- Day 1: Dynamic params form
- Day 2: Create RuleActionsBuilder component
- Day 2: Add/remove action logic
- Day 2: Validation logic
- Day 2: Unit tests (14 tests)

**Deliverables**:
- `src/components/rules/ActionRow.tsx`
- `src/components/rules/RuleActionsBuilder.tsx`
- `src/components/rules/ActionTypeSelector.tsx`
- `src/components/rules/ActionParamsForm.tsx`
- **Estimated Lines**: 500-600

---

**Phase 3D: Integrate with Rule Editor** (1 day)
- Update RuleEditor to use new builders
- Remove hardcoded conditions/actions
- Handle form data transformation
- Integration tests (15 tests)

**Deliverables**:
- Update `src/components/rules/RuleEditor.tsx`
- **Estimated Lines**: 50-100 (modifications)

---

**Phase 3E: Decision Simulator UI** (3 days)
- Day 1: Create RuleSimulator page
- Day 1: RuleInputForm component (JSON editor)
- Day 2: RuleExecutionTrace component
- Day 2: Result visualization
- Day 3: Test history component
- Day 3: Sample data templates
- Day 3: Unit tests (10 tests)

**Deliverables**:
- `src/app/dashboard/rules/[ruleId]/test/page.tsx`
- `src/components/rules/RuleSimulator.tsx`
- `src/components/rules/RuleInputForm.tsx`
- `src/components/rules/RuleExecutionTrace.tsx`
- `src/components/rules/RuleTestHistory.tsx`
- **Estimated Lines**: 500-600

---

**Phase 3F: Documentation & Polish** (1 day)
- User guide documentation
- Component documentation
- Inline code comments
- README updates

**Deliverables**:
- `docs/RULE_MANAGEMENT_USER_GUIDE.md`
- `docs/RULE_MANAGEMENT_UI_PHASE_3_COMPLETE.md`
- **Estimated Lines**: 1,500-2,000 (docs)

---

**Phase 3G: Final Testing & Deployment** (1 day)
- Run all tests (67 tests)
- Fix any regressions
- Build verification
- Git commit & push
- Deployment verification

---

### 8.2 Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 3A: Schemas | 2 days | None |
| 3B: Condition Builder | 3 days | 3A |
| 3C: Action Builder | 2 days | 3A |
| 3D: Integration | 1 day | 3B, 3C |
| 3E: Simulator | 3 days | 3D |
| 3F: Documentation | 1 day | 3E |
| 3G: Testing & Deploy | 1 day | 3F |
| **TOTAL** | **13 days** | - |

**Critical Path**: 3A → 3B → 3D → 3E → 3F → 3G (11 days)  
**Parallel Work**: 3C can run parallel with 3B (saves 2 days if 2 developers)


---

## Part 9: Technical Decisions

### 9.1 Component Library Choices

**UI Components**: Continue using `shadcn/ui`
- ✅ Already integrated in Phase 1&2
- ✅ Consistent design language
- ✅ Accessible components
- Components needed: Select, Input, Button, Card, Badge, Tooltip, Switch

**Date Picker**: Use `react-datepicker` or `date-fns`
- For datetime field type inputs
- Lightweight and accessible

**JSON Editor**: Use `react-json-view` or `@monaco-editor/react`
- For advanced users who want raw JSON editing
- Fallback when dynamic form is insufficient

**Drag & Drop** (Optional Phase 4): Use `@dnd-kit/core`
- For condition/action reordering
- For priority drag-and-drop

---

### 9.2 State Management

**Component-Level State**: Use `useState` + `useCallback`
- RuleEditor: Single source of truth (formData)
- Child components: Local state + emit changes upward
- No Redux/Zustand needed (simple state tree)

**Form State Pattern**:
```typescript
// RuleEditor (parent)
const [formData, setFormData] = useState({
  name: '',
  provider: 'booking',
  conditions: [],
  actions: [],
  // ... other fields
});

// Child component updates
const handleConditionsChange = useCallback((conditions) => {
  setFormData(prev => ({ ...prev, conditions }));
}, []);
```

**Validation State**:
```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

// Validate before save
const validateForm = () => {
  const newErrors: Record<string, string> = {};
  
  // Validate conditions
  formData.conditions.forEach((condition, index) => {
    const error = validateCondition(condition, fieldSchema);
    if (error) {
      newErrors[`condition-${index}`] = error;
    }
  });
  
  // Validate actions
  formData.actions.forEach((action, index) => {
    const error = validateAction(action, actionSchema);
    if (error) {
      newErrors[`action-${index}`] = error;
    }
  });
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

---

### 9.3 Performance Optimizations

**Memoization**:
```typescript
// Expensive computations
const fieldOptions = useMemo(() => 
  getFieldsByProvider(provider), 
  [provider]
);

const operatorOptions = useMemo(() => 
  getOperatorsForField(provider, selectedField), 
  [provider, selectedField]
);
```

**Lazy Loading**:
```typescript
// Lazy load simulator page (not used in list/edit)
const RuleSimulator = lazy(() => import('@/components/rules/RuleSimulator'));
```

**Debouncing**:
```typescript
// Debounce validation to avoid excessive re-renders
const debouncedValidate = useMemo(
  () => debounce(validateForm, 300),
  [formData]
);
```

---

### 9.4 Error Handling Strategy

**Client-Side Errors**:
- Validation errors: Display inline next to field
- Network errors: Toast notification
- Component errors: Error boundary

**Server-Side Errors**:
- 400 Bad Request: Show validation errors
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show permission error
- 404 Not Found: Show "Rule not found"
- 500 Server Error: Show generic error + log to Sentry

**Error Boundary**:
```typescript
<ErrorBoundary fallback={<RuleEditorErrorFallback />}>
  <RuleEditor />
</ErrorBoundary>
```

---

### 9.5 Accessibility (a11y)

**Keyboard Navigation**:
- ✅ Tab through all inputs
- ✅ Enter to submit
- ✅ Escape to cancel/close
- ✅ Arrow keys in dropdowns

**Screen Reader Support**:
- ✅ aria-label on all inputs
- ✅ aria-describedby for hints
- ✅ aria-invalid for errors
- ✅ role="alert" for error messages

**Visual Accessibility**:
- ✅ WCAG AA contrast ratio (4.5:1)
- ✅ Focus indicators
- ✅ Color not sole indicator (use icons + text)


---

## Part 10: Migration Strategy

### 10.1 Backward Compatibility

**Existing Rules**: All existing rules in database will continue to work
- Phase 1&2 created rules with hardcoded conditions/actions
- Phase 3 will read those rules and display them in visual editor
- No database migration needed

**Database Schema**: No changes required
- `rules.conditions` is already JSONB (supports any structure)
- `rules.actions` is already JSONB (supports any structure)
- New format is compatible with existing Decision Engine

### 10.2 Deployment Strategy

**Phased Rollout**:
1. **Day 1**: Deploy schemas (backend only, no UI changes)
2. **Day 2-7**: Deploy visual builders (feature flag OFF)
3. **Day 8**: Enable for admin users only (beta testing)
4. **Day 9**: Enable for all users (general availability)

**Feature Flag**:
```typescript
// Feature flag check
const isVisualBuilderEnabled = user.role === 'admin' || 
  process.env.NEXT_PUBLIC_VISUAL_BUILDER_ENABLED === 'true';

// Render logic
{isVisualBuilderEnabled ? (
  <RuleConditionsBuilder {...props} />
) : (
  <JsonEditor {...props} /> // Fallback
)}
```

**Rollback Plan**:
- If critical bugs found, disable feature flag
- Users revert to JSON editor (existing Phase 2 functionality)
- No data loss (database unchanged)

---

## Part 11: Success Metrics

### 11.1 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test Coverage** | 85%+ | Jest coverage report |
| **Build Time** | <60s | GitHub Actions logs |
| **Component Size** | <500 lines | ESLint file size |
| **Bundle Size** | <50KB added | webpack-bundle-analyzer |
| **Load Time** | <2s | Lighthouse performance |

### 11.2 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to Create Rule** | <5 min | User testing |
| **Error Rate** | <5% | Error logs |
| **User Satisfaction** | >4/5 | User survey |
| **Feature Adoption** | >70% | Analytics (% using visual builder) |

### 11.3 Business Impact Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Rules Created/Week** | +200% | Database query |
| **Developer Support Tickets** | -80% | Ticket system |
| **Rule Change Time** | 5-10 min → <2 min | Time tracking |
| **Business User Adoption** | >50% | User analytics |

---

## Part 12: Risk Assessment

### 12.1 Technical Risks

**Risk #1: Complex UI State Management** ⚠️ MEDIUM
- **Impact**: Bugs in condition/action editing
- **Mitigation**: 
  - Comprehensive unit tests (42 tests)
  - State immutability patterns
  - TypeScript strict mode

**Risk #2: Field Schema Completeness** ⚠️ MEDIUM
- **Impact**: Missing fields → Users can't create rules
- **Mitigation**:
  - Review existing Decision Engine rules
  - Document all fields used in production
  - Provide JSON editor fallback

**Risk #3: Performance with Many Conditions** ⚠️ LOW
- **Impact**: Slow UI with 10+ conditions
- **Mitigation**:
  - Memoization
  - Virtual scrolling (if needed)
  - Pagination (Phase 4)

**Risk #4: Operator Compatibility** ⚠️ LOW
- **Impact**: Operator works in UI but fails in Decision Engine
- **Mitigation**:
  - Integration tests with real engine
  - Validate against engine's operator list

### 12.2 User Experience Risks

**Risk #1: Learning Curve** ⚠️ MEDIUM
- **Impact**: Users don't understand how to use visual builder
- **Mitigation**:
  - User guide with screenshots
  - Inline hints and tooltips
  - Sample templates
  - Training session

**Risk #2: Feature Expectations** ⚠️ LOW
- **Impact**: Users expect features not in Phase 3 (e.g., nested groups)
- **Mitigation**:
  - Clear roadmap communication
  - Phase 4 features documented
  - Feedback collection mechanism

### 12.3 Business Risks

**Risk #1: Adoption Resistance** ⚠️ LOW
- **Impact**: Users prefer JSON editor or manual coding
- **Mitigation**:
  - Gradual rollout (admin first)
  - Show benefits (time saved)
  - Provide both options (visual + JSON)

**Risk #2: Rule Validation Bugs** ⚠️ MEDIUM
- **Impact**: Invalid rules saved, causing runtime errors
- **Mitigation**:
  - Server-side validation (double-check)
  - Test rule before activating
  - Rule version history (rollback)

---

## Part 13: Conclusion

### 13.1 Architecture Summary

✅ **Solid Foundation**: Phase 1&2 provide robust backend (4 tables, 6 APIs, 23 tests)

✅ **Modular Design**: Components are small, focused, reusable

✅ **Scalable Schema**: Field/Action registries support all 5 providers

✅ **Type Safety**: Full TypeScript coverage with strict mode

✅ **Performance**: Optimized with memoization, lazy loading, debouncing

✅ **Accessibility**: WCAG AA compliant with keyboard + screen reader support

✅ **Testability**: 67 tests planned (42 unit + 15 integration + 10 E2E)

### 13.2 Deliverables Summary

| Category | Files | Lines of Code | Tests |
|----------|-------|---------------|-------|
| **Schemas** | 12 files | 800-1,000 | 10 |
| **Condition Builder** | 5 components | 600-800 | 18 |
| **Action Builder** | 4 components | 500-600 | 14 |
| **Simulator** | 5 components | 500-600 | 10 |
| **Integration** | 1 file (updated) | 50-100 | 15 |
| **Documentation** | 2 docs | 1,500-2,000 | 0 |
| **TOTAL** | **29 files** | **3,950-5,100** | **67** |

### 13.3 Timeline Summary

**Total Duration**: 13 days (single developer) or 11 days (2 developers)

**Critical Path**:
1. Schemas (2 days)
2. Condition Builder (3 days)
3. Integration (1 day)
4. Simulator (3 days)
5. Documentation (1 day)
6. Testing & Deploy (1 day)

**Parallel Work Opportunity**: Action Builder (2 days) can run parallel with Condition Builder

### 13.4 Next Steps

1. ✅ **Approve this architecture design**
2. ✅ **Start Phase 3A: Field & Action Schemas** (2 days)
3. ✅ **Continue with Phase 3B-G** (11 days)
4. ✅ **Deploy to production** (Day 13)

---

## Appendices

### Appendix A: File Structure

```
src/
├── lib/
│   └── decision-engine/
│       ├── field-schema.types.ts
│       ├── action-schema.types.ts
│       ├── field-schema-registry.ts
│       ├── action-schema-registry.ts
│       └── providers/
│           ├── booking/
│           │   ├── field-schema.ts
│           │   └── action-schema.ts
│           ├── discount/
│           │   ├── field-schema.ts
│           │   └── action-schema.ts
│           ├── payroll/
│           │   ├── field-schema.ts
│           │   └── action-schema.ts
│           ├── commission/
│           │   ├── field-schema.ts
│           │   └── action-schema.ts
│           └── inventory/
│               ├── field-schema.ts
│               └── action-schema.ts
├── components/
│   └── rules/
│       ├── RuleEditor.tsx (update)
│       ├── RuleConditionsBuilder.tsx (new)
│       ├── ConditionRow.tsx (new)
│       ├── FieldSelector.tsx (new)
│       ├── OperatorSelector.tsx (new)
│       ├── ValueInput.tsx (new)
│       ├── RuleActionsBuilder.tsx (new)
│       ├── ActionRow.tsx (new)
│       ├── ActionTypeSelector.tsx (new)
│       ├── ActionParamsForm.tsx (new)
│       ├── RuleSimulator.tsx (new)
│       ├── RuleInputForm.tsx (new)
│       ├── RuleExecutionTrace.tsx (new)
│       └── RuleTestHistory.tsx (new)
└── app/
    └── dashboard/
        └── rules/
            └── [ruleId]/
                └── test/
                    └── page.tsx (new)
```

### Appendix B: Dependencies to Add

```json
{
  "dependencies": {
    "react-datepicker": "^4.21.0",
    "date-fns": "^2.30.0",
    "@monaco-editor/react": "^4.6.0"
  },
  "devDependencies": {
    "@types/react-datepicker": "^4.19.0"
  }
}
```

### Appendix C: Environment Variables

```env
# Feature flag for visual builder (optional)
NEXT_PUBLIC_VISUAL_BUILDER_ENABLED=true
```

---

**Architecture Design Status**: ✅ COMPLETE  
**Ready for Implementation**: ✅ YES  
**Approval Required**: ✅ YES

**Next Action**: Start Phase 3A (Field & Action Schemas)

---

**END OF ARCHITECTURE DESIGN DOCUMENT**
