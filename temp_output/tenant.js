"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTenantContext = isTenantContext;
/**
 * Type guard to validate TenantContext structure at runtime.
 *
 * @param value - Value to check
 * @returns True if value is a valid TenantContext
 *
 * @example
 * ```typescript
 * if (isTenantContext(req.context)) {
 *   // TypeScript now knows req.context is TenantContext
 *   console.log(req.context.tenantId);
 * }
 * ```
 */
function isTenantContext(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    var ctx = value;
    return (typeof ctx.tenantId === 'string' &&
        typeof ctx.tenantName === 'string' &&
        Array.isArray(ctx.enabledModules) &&
        typeof ctx.subscriptionPlan === 'string' &&
        typeof ctx.featureFlags === 'object' &&
        typeof ctx.settings === 'object');
}
