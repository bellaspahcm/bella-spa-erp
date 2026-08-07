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
 * - Law 5: All engines publish domain events
 * - Law 7: Capabilities registered in Capability Registry
 * 
 * @module platform/healthcare
 * @since Phase 0 (2026-08-07)
 */

// Healthcare Platform Engines
export * from './engines/bed-engine';
export * from './engines/nursing-engine';
export * from './engines/pharmacy-engine';
export * from './engines/mpi-engine';
export * from './engines/encounter-engine';
export * from './engines/clinical-engine';
export * from './engines/order-engine';
export * from './engines/billing-engine';
export * from './engines/insurance-engine';
export * from './engines/scheduling-engine';
export * from './engines/queue-engine';
export * from './engines/laboratory-engine';
export * from './engines/imaging-engine';

// Healthcare Platform Contracts
export * from './contracts';

// Healthcare Shared Kernel
export * from './shared-kernel';

// Platform Metadata
export const HEALTHCARE_PLATFORM_VERSION = '1.0.0';
export const HEALTHCARE_PLATFORM_NAME = 'Bella Healthcare Platform';
