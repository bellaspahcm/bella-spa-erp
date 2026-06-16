"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_DISPLAY_NAMES = exports.ALL_MODULE_IDS = void 0;
exports.isModuleId = isModuleId;
/**
 * Type guard to validate ModuleId at runtime.
 *
 * @param value - Value to check
 * @returns True if value is a valid ModuleId
 */
function isModuleId(value) {
    return (typeof value === 'string' &&
        ['spa', 'babycare', 'cleaning', 'home-service'].includes(value));
}
/**
 * All valid module identifiers as a readonly array.
 * Useful for iteration and validation.
 */
exports.ALL_MODULE_IDS = ['spa', 'babycare', 'cleaning', 'home-service'];
/**
 * Human-readable display names for each module.
 */
exports.MODULE_DISPLAY_NAMES = {
    spa: 'Beauty Spa & Wellness',
    babycare: 'Baby & Mother Care',
    cleaning: 'Cleaning Services',
    'home-service': 'Home Services',
};
