/**
 * Bella Healthcare Platform
 * 
 * Industry-specific platform layer providing healthcare-focused engines and capabilities.
 * Sits between Host Platform and Product Packs (Hospital, Clinic, Pharmacy, Lab, etc.)
 * 
 * Architecture Layer: INDUSTRY PLATFORM
 * Consumers: Bella Hospital, Bella Medical Clinic, Bella Dental, Bella Pharmacy, Bella Lab
 * Dependencies: Host Platform (Contract Registry, Capability Registry, Event Bus, etc.)
 * 
 * Constitution Compliance:
 * - Law 2: Engines provide abstraction over direct DB access
 * - Law 3: Engines decoupled from product packs (Hospital, Clinic)
 * - Law 3 ENFORCED: Products access engines via Service Locator ONLY (Week 2 Day 3)
 * - Law 5: All engines publish domain events
 * - Law 7: Capabilities registered in Capability Registry
 * 
 * **ARCHITECTURE ENFORCEMENT (Week 2 Day 3):**
 * - Engine implementations are NO LONGER exported (prevents direct imports)
 * - Products MUST use getHealthcareService() to access engines
 * - This enforces Contract-First principle (ADR-002)
 * 
 * @module platform/healthcare
 * @since Phase 0 (2026-08-07)
 * @updated Week 2 Day 3 (P1 Remediation - Service Locator)
 */

// ===================================================================
// PUBLIC API: Service Locator (Contract-First Access)
// ===================================================================

/**
 * Service Locator - ONLY way to access Healthcare engines
 * 
 * Products MUST use this instead of importing engines directly.
 * 
 * @example
 * ```typescript
 * import { getHealthcareService } from '@/platform/healthcare';
 * import type { BedEngineContract } from '@/platform/healthcare/contracts/bed-engine.contract';
 * 
 * const bedEngine = getHealthcareService<BedEngineContract>('bed-engine', supabase);
 * ```
 */
export { getHealthcareService, clearServiceCache, isServiceCached } from './service-locator';
export type { HealthcareServiceMap, ServiceKey } from './service-locator';

// ===================================================================
// PUBLIC API: Contracts (Type-Safe Interfaces)
// ===================================================================

/**
 * Healthcare Platform Contracts
 * 
 * These are the ONLY imports Products should use (along with Service Locator).
 * Contracts define interfaces, NOT implementations.
 */
export * from './contracts';

// ===================================================================
// PUBLIC API: Shared Kernel (DTOs, Types, Events)
// ===================================================================

/**
 * Healthcare Shared Kernel
 * 
 * Shared types, DTOs, and domain events used across Healthcare products.
 */
export * from './shared-kernel';

// ===================================================================
// INTERNAL: Engine Implementations (NOT exported)
// ===================================================================

/**
 * NOTE: Engine implementations are NO LONGER exported here.
 * 
 * **Before (Week 1 - P1 violation):**
 * ```typescript
 * export * from './engines/bed-engine'; // ❌ Allowed direct imports
 * ```
 * 
 * **After (Week 2 Day 3 - P1 closed):**
 * Engine implementations are internal to the Healthcare Kernel.
 * Products access them ONLY via getHealthcareService().
 * 
 * **Rationale:**
 * - Enforces Contract-First principle (ADR-002)
 * - Products depend on contracts, not implementations
 * - Enables implementation changes without breaking Products
 * - Prevents architectural violations at compile-time
 * 
 * **For Testing:**
 * Engine tests can still import engines directly from './engines/*'
 * This is intentional - tests are internal to the Kernel.
 */

// ===================================================================
// Platform Metadata
// ===================================================================

export const HEALTHCARE_PLATFORM_VERSION = '1.0.0';
export const HEALTHCARE_PLATFORM_NAME = 'Bella Healthcare Platform';

