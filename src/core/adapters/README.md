# Module Adapters

This directory contains the module adapter system and registry.

## Purpose

Provides the adapter pattern infrastructure that allows industry modules to plug into the core platform and provide module-specific behavior.

## Key Components

### Module Registry
- Singleton registry for module adapters
- Registration and lookup methods
- Validation of adapter implementations
- Thread-safe adapter management

### Adapter Types
- TypeScript interfaces for adapters
- Utility types for adapter methods
- Generic adapter helpers

## Module Adapter Pattern

Module adapters implement the `ModuleAdapter` interface and provide module-specific behavior:

```typescript
interface ModuleAdapter {
  readonly moduleId: ModuleId;
  readonly moduleName: string;
  
  transformServiceItem(item: CoreServiceCatalogItem): any;
  transformBookingOrder(order: CoreBookingOrder): any;
  
  validateBookingRules(order: CoreBookingOrder, context: TenantContext): Promise<boolean>;
  calculatePricing(item: CoreServiceCatalogItem, context: TenantContext): Promise<number>;
  onBookingCompleted(order: CoreBookingOrder, context: TenantContext): Promise<void>;
  
  getModuleWidgets(): ModuleWidget[];
}
```

## Usage Patterns

### 1. Registering an Adapter

```typescript
import { moduleRegistry } from '@/core/adapters/registry';
import { SpaModuleAdapter } from '@/modules/spa/adapters/SpaModuleAdapter';

const adapter = new SpaModuleAdapter();
moduleRegistry.register(adapter);
```

### 2. Looking Up an Adapter

```typescript
import { moduleRegistry } from '@/core/adapters/registry';

const adapter = moduleRegistry.get('spa');
if (adapter) {
  const isValid = await adapter.validateBookingRules(order, context);
}
```

### 3. Using Adapters in Services

```typescript
// In core order service
import { moduleRegistry } from '@/core/adapters/registry';

export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Invoke module adapter for validation
  const adapter = moduleRegistry.get(context.moduleId);
  if (adapter) {
    const isValid = await adapter.validateBookingRules(orderData as CoreBookingOrder, context);
    if (!isValid) {
      throw new Error('Order validation failed');
    }
  }
  
  // Create order...
}
```

## File Organization

- **registry.ts** - ModuleRegistry singleton
- **types.ts** - Adapter interfaces and types

## Adapter Methods

### Transform Methods
- **transformServiceItem**: Converts `CoreServiceCatalogItem` to module-specific type
- **transformBookingOrder**: Converts `CoreBookingOrder` to module-specific type

### Validation Methods
- **validateBookingRules**: Validates module-specific business rules

### Pricing Methods
- **calculatePricing**: Applies module-specific pricing logic

### Side Effect Methods
- **onBookingCompleted**: Handles module-specific side effects after order completion

### UI Methods
- **getModuleWidgets**: Returns module-specific dashboard widgets

## Design Principles

1. **Adapters are optional**: Core services work without adapters (default behavior)
2. **Adapters are stateless**: No instance state, all state passed via parameters
3. **Adapters use core services**: No direct database access
4. **Adapters are registered once**: At application startup
