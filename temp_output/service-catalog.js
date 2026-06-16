"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCoreServiceCatalogItem = isCoreServiceCatalogItem;
/**
 * Type guard for CoreServiceCatalogItem.
 *
 * @param value - Value to validate
 * @returns True if value matches CoreServiceCatalogItem structure
 *
 * @remarks
 * Use this for runtime validation when receiving data from external sources
 * (API responses, user input, database queries with unknown types).
 *
 * @example
 * ```typescript
 * const data = await fetchServiceItem(id);
 * if (isCoreServiceCatalogItem(data)) {
 *   console.log(`Service: ${data.name}, Price: ${data.basePrice}`);
 * } else {
 *   throw new Error('Invalid service catalog item');
 * }
 * ```
 */
function isCoreServiceCatalogItem(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    var item = value;
    return (typeof item.id === 'string' &&
        typeof item.tenantId === 'string' &&
        typeof item.moduleId === 'string' &&
        typeof item.name === 'string' &&
        typeof item.basePrice === 'number' &&
        typeof item.currency === 'string' &&
        typeof item.status === 'string' &&
        typeof item.metadata === 'object');
}
