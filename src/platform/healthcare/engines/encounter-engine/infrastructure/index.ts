/**
 * Encounter Engine - Infrastructure Layer Exports
 * 
 * @module platform/healthcare/engines/encounter-engine/infrastructure
 */

export { SupabaseEncounterRepository } from './supabase-encounter.repository';

export type {
  IEncounterRepository,
  EncounterSearchQuery,
  PaginatedResult,
  RepositoryTransaction,
} from './repository.interface';

export {
  RepositoryError,
  EncounterNotFoundError,
  TenantIsolationViolationError,
  DatabaseConnectionError,
  TransactionError,
} from './repository.interface';
