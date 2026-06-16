"use strict";
/**
 * Core Service Contracts - Type Definitions
 *
 * This barrel export file provides convenient access to all core service contract
 * interfaces defined in Phase 2 of the Core Platform Extraction Roadmap.
 *
 * @remarks
 * These are compile-time-only TypeScript interfaces with zero runtime overhead.
 * They establish industry-neutral primitives that work across spa, cleaning,
 * home-service, and babycare modules.
 *
 * **Phase 2 Status**: Contract definitions complete
 * **Phase 3 Plan**: Migrate existing code to use these contracts
 *
 * @see {@link ../README.md} for usage guidance and examples
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditEvent = exports.isInvoiceOverdue = exports.getInvoiceBalance = exports.isActiveBooking = exports.isFullyPaid = exports.getRemainingBalance = exports.isCoreServiceCatalogItem = exports.isFeatureEnabled = exports.MODULE_DISPLAY_NAMES = exports.ALL_MODULE_IDS = exports.isModuleId = exports.isTenantContext = void 0;
var tenant_1 = require("./tenant");
Object.defineProperty(exports, "isTenantContext", { enumerable: true, get: function () { return tenant_1.isTenantContext; } });
var module_1 = require("./module");
Object.defineProperty(exports, "isModuleId", { enumerable: true, get: function () { return module_1.isModuleId; } });
Object.defineProperty(exports, "ALL_MODULE_IDS", { enumerable: true, get: function () { return module_1.ALL_MODULE_IDS; } });
Object.defineProperty(exports, "MODULE_DISPLAY_NAMES", { enumerable: true, get: function () { return module_1.MODULE_DISPLAY_NAMES; } });
var feature_flag_1 = require("./feature-flag");
Object.defineProperty(exports, "isFeatureEnabled", { enumerable: true, get: function () { return feature_flag_1.isFeatureEnabled; } });
var service_catalog_1 = require("./service-catalog");
Object.defineProperty(exports, "isCoreServiceCatalogItem", { enumerable: true, get: function () { return service_catalog_1.isCoreServiceCatalogItem; } });
var booking_order_1 = require("./booking-order");
Object.defineProperty(exports, "getRemainingBalance", { enumerable: true, get: function () { return booking_order_1.getRemainingBalance; } });
Object.defineProperty(exports, "isFullyPaid", { enumerable: true, get: function () { return booking_order_1.isFullyPaid; } });
Object.defineProperty(exports, "isActiveBooking", { enumerable: true, get: function () { return booking_order_1.isActiveBooking; } });
var payment_1 = require("./payment");
Object.defineProperty(exports, "getInvoiceBalance", { enumerable: true, get: function () { return payment_1.getInvoiceBalance; } });
Object.defineProperty(exports, "isInvoiceOverdue", { enumerable: true, get: function () { return payment_1.isInvoiceOverdue; } });
var audit_1 = require("./audit");
Object.defineProperty(exports, "createAuditEvent", { enumerable: true, get: function () { return audit_1.createAuditEvent; } });
