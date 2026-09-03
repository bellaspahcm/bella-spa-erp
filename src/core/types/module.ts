/**
 * Valid industry module identifiers.
 * 
 * @remarks
 * Each module represents a distinct industry vertical with its own
 * data models, business rules, and UI components.
 * 
 * **Current Modules**:
 * - `spa`: Beauty spa and wellness services (Bella Spa)
 * - `babycare`: Baby and mother care services
 * - `cleaning`: Home and office cleaning services
 * - `home-service`: General home maintenance and repair
 * 
 * **Adding New Modules**: Update this union type and register the module
 * in the core platform's module registry (Phase 3).
 */
export type ModuleId = 'spa' | 'babycare' | 'cleaning' | 'home-service' | 'beauty_spa' | 'real_estate' | 'bella_healthcare' | 'bella_auto' | 'industrial_cleaning';

/**
 * Type guard to validate ModuleId at runtime.
 * 
 * @param value - Value to check
 * @returns True if value is a valid ModuleId
 */
export function isModuleId(value: unknown): value is ModuleId {
  return (
    typeof value === 'string' &&
    (['spa', 'babycare', 'cleaning', 'home-service', 'beauty_spa', 'real_estate', 'bella_healthcare', 'bella_auto', 'industrial_cleaning'] as const).includes(value as ModuleId)
  );
}

/**
 * All valid module identifiers as a readonly array.
 * Useful for iteration and validation.
 */
export const ALL_MODULE_IDS: readonly ModuleId[] = ['spa', 'babycare', 'cleaning', 'home-service', 'beauty_spa', 'real_estate', 'bella_healthcare', 'bella_auto', 'industrial_cleaning'] as const;

/**
 * Human-readable display names for each module.
 */
export const MODULE_DISPLAY_NAMES: Readonly<Record<ModuleId, string>> = {
  spa: 'Beauty Spa & Wellness',
  babycare: 'Baby & Mother Care',
  cleaning: 'Cleaning Services',
  'home-service': 'Home Services',
  beauty_spa: 'Beauty Spa with Resources',
  real_estate: 'Real Estate Management',
  bella_healthcare: 'Healthcare',
  bella_auto: 'Automotive',
  industrial_cleaning: 'Industrial Cleaning',
} as const;
