/**
 * BELLA FACTORY — SCHEMA SPECIFICATION CONTRACT
 * 
 * Minimal contract for Product schema generation capability.
 * 
 * Purpose: Convert canonical Product specification → deterministic migration SQL
 * 
 * NOT building:
 * - ❌ Generic ORM framework
 * - ❌ Universal scaffolding system
 * - ❌ Database abstraction layer
 * 
 * ONLY building:
 * - ✅ Specification → Migration converter
 * - ✅ Standard patterns: tenant isolation + RLS + indexes + audit fields
 * - ✅ Deterministic output (same input → same SQL)
 */

// ============================================================================
// SPECIFICATION CONTRACT
// ============================================================================

/**
 * Column data types supported by Bella Platform schema generation
 */
export type ColumnType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'decimal'
  | 'boolean'
  | 'timestamp'
  | 'timestamptz'
  | 'date'
  | 'jsonb'
  | 'text[]'
  | 'uuid[]';

/**
 * Column definition in Product schema specification
 */
export interface ColumnSpec {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  default?: string;
  primaryKey?: boolean;
  unique?: boolean;
  check?: string; // CHECK constraint expression
  references?: {
    table: string;
    column: string;
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT';
  };
}

/**
 * Index specification for performance optimization
 */
export interface IndexSpec {
  name: string;
  columns: string[];
  unique?: boolean;
}

/**
 * RLS Policy specification for tenant isolation
 */
export interface RLSPolicySpec {
  name: string;
  operation: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  using: string; // SQL expression for policy
  withCheck?: string; // Optional WITH CHECK expression
}

/**
 * Table specification in Product schema
 */
export interface TableSpec {
  name: string;
  schema?: string; // Default: 'public'
  columns: ColumnSpec[];
  indexes?: IndexSpec[];
  rlsPolicies?: RLSPolicySpec[];
  
  // Standard Bella patterns (auto-applied if not explicitly false)
  tenantIsolation?: boolean; // Default: true
  auditFields?: boolean; // Default: true (created_at, updated_at, created_by, last_modified_by)
  enableRLS?: boolean; // Default: true
}

/**
 * Complete Product schema specification
 */
export interface ProductSchemaSpec {
  productId: string; // e.g., 'bella-medical', 'logistics-os'
  version: string; // Specification version
  migrationTimestamp?: string; // Optional override, default: auto-generated
  tables: TableSpec[];
  comment?: string; // Migration header comment
}

// ============================================================================
// GENERATION CONTRACT
// ============================================================================

/**
 * Schema generator output
 */
export interface SchemaGenerationResult {
  migrationSQL: string; // Complete migration file content
  migrationFilename: string; // Generated filename with timestamp
  deterministic: boolean; // True if same spec → same SQL
  validation: {
    tenantIsolationApplied: boolean;
    rlsEnabled: boolean;
    indexesCreated: number;
    tablesCreated: number;
  };
}

/**
 * Minimal schema generator interface
 */
export interface ISchemaGenerator {
  /**
   * Generate migration SQL from Product schema specification
   * 
   * Contract:
   * - Same input → same output (deterministic)
   * - Applies standard Bella patterns (tenant_id, RLS, indexes, audit fields)
   * - Validates against Platform constraints
   * - Produces Architecture Guard compliant SQL
   * 
   * @param spec Product schema specification
   * @returns Generated migration SQL + metadata
   */
  generate(spec: ProductSchemaSpec): SchemaGenerationResult;
  
  /**
   * Validate specification without generating
   * 
   * @param spec Product schema specification
   * @returns Validation errors (empty if valid)
   */
  validate(spec: ProductSchemaSpec): string[];
}

// ============================================================================
// STANDARD PATTERNS (Auto-Applied)
// ============================================================================

/**
 * Standard audit fields added to all tables (if auditFields=true)
 */
export const STANDARD_AUDIT_FIELDS: ColumnSpec[] = [
  {
    name: 'created_at',
    type: 'timestamptz',
    nullable: false,
    default: 'now()',
  },
  {
    name: 'updated_at',
    type: 'timestamptz',
    nullable: false,
    default: 'now()',
  },
  {
    name: 'created_by',
    type: 'uuid',
    nullable: false,
  },
  {
    name: 'last_modified_by',
    type: 'uuid',
    nullable: false,
  },
];

/**
 * Standard tenant isolation column (if tenantIsolation=true)
 */
export const STANDARD_TENANT_COLUMN: ColumnSpec = {
  name: 'tenant_id',
  type: 'uuid',
  nullable: false,
  references: {
    table: 'tenants',
    column: 'id',
    onDelete: 'CASCADE',
  },
};

/**
 * Standard tenant isolation RLS policy template
 */
export const STANDARD_TENANT_RLS_POLICY = (tableName: string): RLSPolicySpec => ({
  name: `tenant_isolation_${tableName}`,
  operation: 'ALL',
  using: 'tenant_id = public.get_auth_tenant_id()',
});

/**
 * Standard tenant index template
 */
export const STANDARD_TENANT_INDEX = (tableName: string): IndexSpec => ({
  name: `idx_${tableName}_tenant_id`,
  columns: ['tenant_id'],
});

// ============================================================================
// VALIDATION RULES
// ============================================================================

/**
 * Platform-level validation constraints
 */
export const VALIDATION_RULES = {
  /**
   * Tables with tenant_id MUST have RLS enabled
   */
  TENANT_TABLES_REQUIRE_RLS: true,
  
  /**
   * All Product tables MUST use Platform Core references (tenants, users, etc.)
   */
  REQUIRE_PLATFORM_CORE_REFS: true,
  
  /**
   * Foreign keys to tenant-isolated tables MUST preserve tenant isolation
   */
  PRESERVE_TENANT_ISOLATION: true,
  
  /**
   * Enum CHECK constraints MUST use explicit value lists
   */
  EXPLICIT_ENUM_CHECKS: true,
};
