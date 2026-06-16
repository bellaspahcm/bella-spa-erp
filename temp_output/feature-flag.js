"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFeatureEnabled = isFeatureEnabled;
/**
 * Check if a feature is accessible given tenant context.
 *
 * @param flag - Feature flag to evaluate
 * @param context - Tenant context
 * @returns True if feature is enabled and tenant meets requirements
 *
 * @example
 * ```typescript
 * const canUseAI = isFeatureEnabled(aiSalaryFlag, tenantContext);
 * if (canUseAI) {
 *   // Show AI salary reconciliation UI
 * }
 * ```
 */
function isFeatureEnabled(flag, context) {
    if (!flag.enabled)
        return false;
    // Check plan requirement
    if (flag.requiredPlan && !flag.requiredPlan.includes(context.subscriptionPlan)) {
        return false;
    }
    // Check module requirement
    if (flag.requiredModules) {
        var hasAllModules = flag.requiredModules.every(function (mod) {
            return context.enabledModules.includes(mod);
        });
        if (!hasAllModules)
            return false;
    }
    return true;
}
