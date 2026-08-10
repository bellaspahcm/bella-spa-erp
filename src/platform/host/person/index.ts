/**
 * Person Platform Capability - Public API
 * 
 * Person represents the identity primitive of Bella Platform.
 * Vertical-specific roles (Patient, Student, Customer) reference Person.
 * 
 * @module platform/host/person
 */

// Types
export type {
  Person,
  Gender,
  PersonStatus,
  PersonIdentifier,
  IdentifierType,
  PersonContact,
  ContactType,
  PersonAddress,
  AddressUse,
  CreatePersonRequest,
  UpdatePersonRequest,
  QueryPersonsRequest,
  PersonResponse,
  PersonError,
  ResponseMetadata,
  PersonDomainEvent,
  PersonEventType,
  EventMetadata,
  ValidationResult,
  ValidationError,
} from './types';

// Domain
export { PersonAggregate } from './person.aggregate';

// Infrastructure
export { PersonRepository } from './person.repository';
export { PersonService } from './person.service';

