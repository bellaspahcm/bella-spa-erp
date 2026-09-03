/**
 * Bella Host Platform
 * 
 * Foundation platform layer providing cross-industry shared services and runtime.
 * Base layer for all Industry Platforms (Healthcare, Beauty, Auto, Retail, etc.)
 * 
 * Architecture Layer: HOST PLATFORM (Foundation)
 * Consumers: Healthcare Platform, Beauty Platform, Auto Platform, Retail Platform, etc.
 * Dependencies: Infrastructure (Supabase, External APIs)
 * 
 * Constitution Compliance:
 * - Law 7: Capability Registry enforces capability dependencies
 * - Law 8: Contract Registry manages API/Event contracts
 * - Law 9: Zero Regression via Feature Flags & Capability isolation
 * 
 * @module platform/host
 * @since Phase 0 (2026-08-07)
 */

// Host Platform Core Services
export * from './contract-registry';
export * from './capability-registry';
export * from './feature-flags';
export * from './event-bus';

// Host Platform Shared Services
export * from './policy';

// Note: The following modules exist but don't have barrel exports yet:
// - iam, notification, workflow, ai-runtime, metadata, integration
// Uncomment when barrel exports are added or when needed by consumers

// Platform Metadata
export const HOST_PLATFORM_VERSION = '1.0.0';
export const HOST_PLATFORM_NAME = 'Bella Host Platform';
