/**
 * Valid industry module identifiers.
 * 
 * @remarks
 * Each module represents a distinct industry vertical with its own
 * data models, business rules, and UI components.
 * 
 * **Current Modules**:
 * - `spa`: Legacy beauty spa and wellness services (Bella Spa)
 * - `babycare`: Baby and mother care services
 * - `cleaning`: Home and office cleaning services
 * - `home-service`: General home maintenance and repair
 * - `beauty_spa`: Beauty V2 services with resources
 * - `real_estate`: Real estate management
 * - `student_training`: Student training and education services
 * - `industrial_cleaning`: Industrial cleaning operations
 * - `bella_auto`: Automotive service operations
 * - `bella_healthcare`: Healthcare product vertical
 * - `bella_education`: Education product vertical
 * 
 * **Adding New Modules**: Update this union type and register the module
 * in the core platform's module registry (Phase 3).
 */
export const ALL_MODULE_IDS = [
  'spa',
  'babycare',
  'cleaning',
  'home-service',
  'beauty_spa',
  'real_estate',
  'student_training',
  'industrial_cleaning',
  'bella_auto',
  'bella_healthcare',
  'bella_education',
] as const;

export type ModuleId = (typeof ALL_MODULE_IDS)[number];

/**
 * Type guard to validate ModuleId at runtime.
 * 
 * @param value - Value to check
 * @returns True if value is a valid ModuleId
 */
export function isModuleId(value: unknown): value is ModuleId {
  return (
    typeof value === 'string' &&
    ALL_MODULE_IDS.includes(value as ModuleId)
  );
}

/**
 * All valid module identifiers as a readonly array.
 * Useful for iteration and validation.
 */

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
  student_training: 'Student Training',
  industrial_cleaning: 'Industrial Cleaning',
  bella_auto: 'Bella Auto',
  bella_healthcare: 'Bella Healthcare',
  bella_education: 'Bella Education',
} as const;
