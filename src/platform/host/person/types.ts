/**
 * Person Platform Capability - Type Definitions
 * 
 * Person represents IDENTITY ONLY - "Who is this person?"
 * Vertical-specific roles (Patient, Student, Customer) reference Person.
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, no `any` types allowed
 * 
 * @module platform/host/person/types
 */

// ============================================================================
// Core Person Types
// ============================================================================

/**
 * Person - Platform identity primitive
 * 
 * Represents "who someone is" independent of their roles.
 * Patient/Student/Customer reference Person, they don't extend it.
 */
export interface Person {
  /** Unique identifier for this person (UUID) */
  personId: string;
  
  /** Tenant this person belongs to */
  tenantId: string;
  
  /** Legal first name */
  firstName: string;
  
  /** Legal last name */
  lastName: string;
  
  /** Middle name (optional) */
  middleName?: string;
  
  /** Date of birth (ISO 8601 date: YYYY-MM-DD) */
  dateOfBirth: string;
  
  /** Gender */
  gender: Gender;
  
  /** Nationality (ISO 3166-1 alpha-2 country code) */
  nationality?: string;
  
  /** Government and institutional identifiers */
  identifiers: PersonIdentifier[];
  
  /** Contact information */
  contacts: PersonContact[];
  
  /** Physical addresses */
  addresses: PersonAddress[];
  
  /** Profile photo URL */
  photoUrl?: string;
  
  /** Preferred language (ISO 639-1 code) */
  preferredLanguage?: string;
  
  /** Record status */
  status: PersonStatus;
  
  /** Metadata for tenant-specific extensions */
  metadata?: Record<string, unknown>;
  
  /** Record creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** Record last update timestamp (ISO 8601) */
  updatedAt: string;
  
  /** User who created this record */
  createdBy?: string;
  
  /** User who last updated this record */
  updatedBy?: string;
}

export type Gender = 
  | 'male' 
  | 'female' 
  | 'other' 
  | 'prefer-not-to-say';

export type PersonStatus = 
  | 'active' 
  | 'inactive' 
  | 'deceased' 
  | 'merged'; // Merged into another person record (duplicate resolution)

// ============================================================================
// Person Identifier Types
// ============================================================================

/**
 * Government-issued or institutional identifiers for a person
 */
export interface PersonIdentifier {
  /** Identifier type */
  type: IdentifierType;
  
  /** Identifier value (e.g., passport number, national ID) */
  value: string;
  
  /** Issuing authority */
  issuedBy?: string;
  
  /** Issue date (ISO 8601 date) */
  issuedDate?: string;
  
  /** Expiry date (ISO 8601 date) */
  expiryDate?: string;
  
  /** Is this the primary identifier? */
  isPrimary?: boolean;
}

export type IdentifierType = 
  | 'national-id'        // National ID card
  | 'passport'           // Passport
  | 'driver-license'     // Driver's license
  | 'health-insurance'   // Health insurance number
  | 'social-security'    // Social security number
  | 'tax-id'             // Tax ID
  | 'voter-id'           // Voter registration
  | 'military-id'        // Military ID
  | 'student-id'         // Student ID (institutional)
  | 'employee-id'        // Employee ID (institutional)
  | 'other';             // Other identifier

// ============================================================================
// Contact Types
// ============================================================================

/**
 * Contact information for a person
 */
export interface PersonContact {
  /** Contact type */
  type: ContactType;
  
  /** Contact value (phone number, email address) */
  value: string;
  
  /** Is this the primary contact? */
  isPrimary?: boolean;
  
  /** Is this contact verified? */
  isVerified?: boolean;
  
  /** Purpose/label (e.g., "work", "home", "emergency") */
  label?: string;
}

export type ContactType = 
  | 'phone' 
  | 'email' 
  | 'mobile' 
  | 'fax' 
  | 'other';

// ============================================================================
// Address Types
// ============================================================================

/**
 * Physical address for a person
 */
export interface PersonAddress {
  /** Address use/purpose */
  use: AddressUse;
  
  /** Address line 1 (street, building) */
  line1: string;
  
  /** Address line 2 (apartment, suite, floor) */
  line2?: string;
  
  /** City/town */
  city: string;
  
  /** State/province/region */
  state?: string;
  
  /** Postal/ZIP code */
  postalCode?: string;
  
  /** Country (ISO 3166-1 alpha-2 code) */
  country: string;
  
  /** Is this the primary address? */
  isPrimary?: boolean;
  
  /** Effective from date (ISO 8601 date) */
  effectiveFrom?: string;
  
  /** Effective to date (ISO 8601 date) */
  effectiveTo?: string;
}

export type AddressUse = 
  | 'home' 
  | 'work' 
  | 'billing' 
  | 'shipping' 
  | 'temp' 
  | 'old';

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to create a new person
 */
export interface CreatePersonRequest {
  tenantId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: Gender;
  nationality?: string;
  identifiers?: PersonIdentifier[];
  contacts?: PersonContact[];
  addresses?: PersonAddress[];
  photoUrl?: string;
  preferredLanguage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request to update an existing person
 */
export interface UpdatePersonRequest {
  personId: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  nationality?: string;
  identifiers?: PersonIdentifier[];
  contacts?: PersonContact[];
  addresses?: PersonAddress[];
  photoUrl?: string;
  preferredLanguage?: string;
  status?: PersonStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Request to query persons
 */
export interface QueryPersonsRequest {
  tenantId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  identifierType?: IdentifierType;
  identifierValue?: string;
  email?: string;
  phone?: string;
  status?: PersonStatus;
  limit?: number;
  offset?: number;
}

/**
 * Standard response wrapper for person operations
 */
export interface PersonResponse<T> {
  success: boolean;
  data?: T;
  error?: PersonError;
  metadata?: ResponseMetadata;
}

export interface PersonError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ResponseMetadata {
  requestId: string;
  executionTimeMs: number;
  version: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Domain events published by Person capability
 */
export interface PersonDomainEvent<T = Record<string, unknown>> {
  eventType: PersonEventType;
  eventVersion: string;
  eventId: string;
  timestamp: string;
  tenantId: string;
  personId: string;
  payload: T;
  metadata?: EventMetadata;
}

export type PersonEventType = 
  | 'person.created' 
  | 'person.updated' 
  | 'person.deleted' 
  | 'person.merged' 
  | 'person.status-changed';

export interface EventMetadata {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  causationId?: string;
  source: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation result for person operations
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

