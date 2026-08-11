/**
 * Encounter Engine - Public API
 * 
 * @layer Healthcare Platform → Encounter Engine
 * @status Phase 3 - Service + Contract + Event Bus Integration
 * 
 * Usage by Hospital Product Pack:
 * ```typescript
 * import { 
 *   getEncounterEngine, 
 *   type IEncounterEngine,
 *   type CreateEncounterRequest 
 * } from '@/platform/healthcare/engines/encounter-engine';
 * 
 * const engine = getEncounterEngine(supabase);
 * const result = await engine.createEncounter({ ... });
 * ```
 */

// ===========================
// Core Engine Interface
// ===========================
export type { IEncounterEngine } from './encounter-engine.interface';

// ===========================
// Request/Response Types
// ===========================
export type {
  CreateEncounterRequest,
  CreateEncounterResponse,
  UpdateEncounterStatusRequest,
  UpdateEncounterStatusResponse,
  AddDiagnosisRequest,
  AddDiagnosisResponse,
  AssignProviderRequest,
  AssignProviderResponse,
  TransferEncounterRequest,
  TransferEncounterResponse,
  GetEncounterRequest,
  GetEncounterResponse,
  SearchEncountersRequest,
  SearchEncountersResponse,
  EncounterDTO,
} from './encounter-engine.interface';

// ===========================
// Domain Types (DO NOT re-export Encounter/EncounterStatus/etc to avoid duplicates)
// ===========================
export type {
  EncounterState,
  EncounterDiagnosis,
  EncounterParticipant,
  EncounterDomainEvent,
  EncounterPriority,
} from './encounter.types';

// ===========================
// Factory Functions
// ===========================
export {
  createEncounterEngine,
  getEncounterEngine,
  resetEncounterEngine,
} from './encounter-engine.factory';

// ===========================
// Registration (for Platform initialization)
// ===========================
export {
  registerEncounterEngine,
  unregisterEncounterEngine,
} from './encounter-engine.registration';

// ===========================
// Contract (for Contract Registry)
// ===========================
export { EncounterEngineContract } from './encounter-engine.contract';

// ===========================
// Infrastructure Types
// ===========================
export type {
  IEncounterRepository,
  EncounterSearchQuery,
  PaginatedResult,
} from './infrastructure/repository.interface';

// ===========================
// NOTE: Encounter, EncounterClass, EncounterStatus, EncounterType
// are exported from shared-kernel, not here, to avoid duplicates
// ===========================

