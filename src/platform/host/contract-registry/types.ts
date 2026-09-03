/**
 * Contract Registry Types
 * 
 * Type definitions for API contracts, event schemas, and versioning.
 * Supports Constitution Law 8 (Registry-First & ADR).
 * 
 * @module platform/host/contract-registry/types
 */

// ============================================================================
// Contract Metadata
// ============================================================================

/**
 * Complete contract metadata for an engine or service
 */
export interface ContractMetadata {
  name: string; // e.g., 'bed-engine', 'nursing-engine'
  version: string; // Semantic version (e.g., '1.0.0')
  type: ContractType;
  description: string;
  owner: string; // Team or person responsible
  status: ContractStatus;
  endpoints?: EndpointDefinition[];
  events?: EventDefinition[];
  schemas?: SchemaDefinition[];
  dependencies?: ContractDependency[];
  deprecation?: DeprecationInfo;
  metadata?: Record<string, unknown>;
  registeredAt: string; // ISO 8601 datetime
  updatedAt: string; // ISO 8601 datetime
}

export type ContractType = 
  | 'engine' // Healthcare Platform engines
  | 'service' // Host Platform services
  | 'api' // REST API contracts
  | 'event' // Event schemas
  | 'rpc'; // RPC/function contracts

export type ContractStatus = 
  | 'draft' 
  | 'active' 
  | 'deprecated' 
  | 'retired';

// ============================================================================
// Engine Contract Definition (Lightweight Capability Declaration)
// ============================================================================

/**
 * Lightweight contract definition for platform engines
 * 
 * Used by Host Platform engines (temporal, rollback, rule, analytics) to declare
 * their capabilities without full registry metadata overhead.
 * 
 * Distinct from ContractMetadata:
 * - EngineContractDefinition = capability declaration (what methods engine provides)
 * - ContractMetadata = registry metadata (formal API contract registration)
 */
export interface EngineContractDefinition {
  id: string; // Unique engine identifier (e.g., 'platform.temporal-engine')
  name: string; // Human-readable name
  version: string; // Semantic version
  description: string; // Engine purpose and capabilities
  provider: string; // Owning module (e.g., 'platform.host')
  consumers?: string[]; // Known consumers (for documentation)
  methods: EngineMethodDefinition[]; // Available methods/operations
  events?: string[]; // Events published by this engine
  featureFlag?: string; // Feature flag controlling engine availability
  status: ContractStatus;
  createdAt: string; // ISO 8601 datetime
}

/**
 * Method definition for engine capability
 */
export interface EngineMethodDefinition {
  name: string; // Method name (e.g., 'captureSnapshot', 'rollback')
  description: string; // What this method does
  inputSchema: JSONSchema; // Input parameters schema
  outputSchema: JSONSchema; // Return value schema
}

// ============================================================================
// Endpoint Definitions (API Contracts)
// ============================================================================

export interface EndpointDefinition {
  path: string; // e.g., '/api/bed-engine/allocate'
  method: HttpMethod;
  operationId: string; // Unique identifier
  summary: string;
  description?: string;
  requestSchema: SchemaReference;
  responseSchema: SchemaReference;
  errorSchemas?: ErrorSchemaDefinition[];
  authentication?: AuthenticationRequirement[];
  rateLimit?: RateLimitConfig;
  deprecated?: boolean;
  deprecationMessage?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SchemaReference {
  schemaId: string; // Reference to SchemaDefinition
  version: string;
  inline?: boolean; // If true, schema is embedded
  schema?: JSONSchema; // Inline schema definition
}

export interface ErrorSchemaDefinition {
  statusCode: number;
  errorCode: string;
  schema: SchemaReference;
  description: string;
}

export interface AuthenticationRequirement {
  type: 'bearer' | 'api-key' | 'session' | 'none';
  scopes?: string[];
  roles?: string[];
}

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  burstSize?: number;
}

// ============================================================================
// Event Definitions (Event Bus Contracts)
// ============================================================================

export interface EventDefinition {
  eventType: string; // e.g., 'BedAllocated', 'PatientAdmitted'
  version: string; // Event schema version
  summary: string;
  description?: string;
  payloadSchema: SchemaReference;
  publisher: string; // Engine/service that publishes this event
  subscribers?: string[]; // Known subscribers (for documentation)
  retryPolicy?: RetryPolicy;
  deprecated?: boolean;
  examples?: EventExample[];
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface EventExample {
  title: string;
  description?: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Schema Definitions (JSON Schema)
// ============================================================================

export interface SchemaDefinition {
  schemaId: string; // Unique identifier
  version: string; // Schema version
  name: string;
  description?: string;
  schema: JSONSchema;
  examples?: Record<string, unknown>[];
  registeredAt: string;
  updatedAt: string;
}

/**
 * Simplified JSON Schema definition
 * Supports basic validation rules
 */
export interface JSONSchema {
  type: JSONSchemaType | JSONSchemaType[];
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema; // For arrays
  enum?: unknown[];
  format?: string; // e.g., 'date-time', 'email', 'uuid'
  pattern?: string; // Regex pattern
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean | JSONSchema;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;
  const?: unknown;
  default?: unknown;
}

export type JSONSchemaType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'object' 
  | 'array' 
  | 'null';

// ============================================================================
// Contract Dependencies
// ============================================================================

export interface ContractDependency {
  contractName: string;
  version: string; // Can use semver ranges (e.g., '^1.0.0', '>=2.0.0')
  required: boolean;
  description?: string;
}

// ============================================================================
// Deprecation Info
// ============================================================================

export interface DeprecationInfo {
  deprecatedSince: string; // ISO 8601 datetime
  retirementDate?: string; // ISO 8601 datetime
  reason: string;
  migrationGuide?: string; // URL or markdown
  replacementContract?: {
    name: string;
    version: string;
  };
}

// ============================================================================
// Contract Validation Results
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string; // JSON path to error location
  message: string;
  expected?: unknown;
  actual?: unknown;
  schemaRule?: string; // e.g., 'required', 'type', 'pattern'
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Contract Query Filters
// ============================================================================

export interface ContractQueryFilter {
  name?: string;
  type?: ContractType;
  status?: ContractStatus;
  version?: string; // Exact version or semver range
  owner?: string;
  tags?: string[];
}

// ============================================================================
// Contract Registry Events
// ============================================================================

export interface ContractRegisteredEvent {
  eventType: 'ContractRegistered';
  timestamp: string;
  contractName: string;
  contractVersion: string;
  contractType: ContractType;
  registeredBy: string;
}

export interface ContractDeprecatedEvent {
  eventType: 'ContractDeprecated';
  timestamp: string;
  contractName: string;
  contractVersion: string;
  reason: string;
  retirementDate?: string;
}

export interface ContractRetiredEvent {
  eventType: 'ContractRetired';
  timestamp: string;
  contractName: string;
  contractVersion: string;
  replacementContract?: {
    name: string;
    version: string;
  };
}

// ============================================================================
// Exports
// ============================================================================


