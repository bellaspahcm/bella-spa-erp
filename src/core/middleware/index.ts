/**
 * Core platform middleware exports.
 * 
 * @remarks
 * This module exports middleware utilities for API routes.
 * These middleware handle cross-cutting concerns like authentication,
 * tenant context extraction, and error handling.
 * 
 * @module core/middleware
 */

export {
  withTenantContext,
  extractTenantContext,
  type NextRequestWithContext,
  type TenantContextHandler,
} from './tenantContext';
