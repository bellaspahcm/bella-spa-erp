/**
 * @module foundation/contracts
 *
 * Public API for all Foundation contracts.
 * Import from here — never import from sub-modules directly.
 *
 * @example
 * import type { AssignableReference, OrgQueryService } from '@/foundation/contracts';
 */

export type {
  // Organization
  OrgUnitType,
  OrgUnitRef,
  OrgRelationshipType,
  OrgRelationship,
  BranchRef,
  TeamRef,
} from './organization';

export type {
  // People
  AssignableType,
  AssignableReference,
  PersonProfile,
  AssignableAvailability,
} from './people';

export type {
  // Query Services (read-only — safe to import from any layer)
  AssignableFilterOptions,
  OrgQueryService,
  AssignableFilter,
  PeopleQueryService,
  EligibilityFilter,
  AssignmentQueryService,
  // Command Services (write — import only from owning service layer)
  CreateOrgUnitInput,
  OrgCommandService,
  RegisterPersonInput,
  PeopleCommandService,
} from './services';

export type {
  // Registry
  FoundationRegistry,
} from './registry';

export {
  // Registry functions
  registerFoundation,
  getFoundation,
  isFoundationReady,
  resetFoundation,
} from './registry';
