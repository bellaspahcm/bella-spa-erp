/**
 * Phase 4B.3 — Database Verification Types
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * DO NOT modify types to be "smarter" than Contract.
 * If Contract doesn't define it → FAIL/CANNOT_VERIFY.
 */

/**
 * Verification Input (from BDGF / 4B.2)
 */
export interface VerificationInput {
  migration_id: string;
  migration_file: string;
  commit_sha: string;
  approval_id: string;
  environment: string;
  database_url: string;
}

/**
 * Migration Declaration (from YAML front-matter or .declaration.json)
 * 
 * Phase 1: Minimal structure
 * Format: YAML/JSON
 */
export interface MigrationDeclaration {
  tables?: {
    [tableName: string]: {
      columns?: {
        [columnName: string]: string; // e.g., "uuid", "text", "timestamptz"
      };
      primary_key?: string[];
      foreign_keys?: Array<{
        column: string;
        references: string; // e.g., "hc_patients(patient_id)"
      }>;
      rls?: 'required' | 'optional' | 'none';
    };
  };
}

/**
 * Expected State (Contract Invariants + Migration Declaration)
 * 
 * CRITICAL: Expected state MUST NOT be inferred from actual DB state.
 */
export interface ExpectedState {
  // Contract Invariants (always verified)
  securityInvariants: {
    tenantIsolation: {
      tables: string[]; // Security-critical tables requiring RLS
      rlsEnabled: boolean; // MUST be true
      policiesRequired: Array<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'>;
    };
    coreConstraints?: {
      primaryKeysRequired?: boolean;
      foreignKeysValidated?: boolean;
      notNullEnforced?: boolean;
    };
  };

  // Migration-specific expectations (from declaration)
  migrationExpectations: {
    tables?: {
      [tableName: string]: {
        columns?: {
          [columnName: string]: string; // Expected type
        };
        primary_key?: string[];
        foreign_keys?: Array<{
          column: string;
          references: string;
        }>;
        rls_required?: boolean;
      };
    };
  };
}

/**
 * Actual Database State (PostgreSQL introspection results)
 */
export interface ActualState {
  tables: {
    [tableName: string]: {
      exists: boolean;
      columns?: Array<{
        name: string;
        type: string;
        nullable: boolean;
      }>;
      primary_key?: string[];
      foreign_keys?: Array<{
        column: string;
        references: string;
        referenced_column: string;
      }>;
      rls?: {
        enabled: boolean;
        policies: Array<{
          name: string;
          command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
          using?: string;
          check?: string;
        }>;
      };
    };
  };
}

/**
 * Verification Check Result
 */
export interface VerificationCheck {
  check_id: string;
  check_type: 'RLS_VERIFICATION' | 'SCHEMA_STRUCTURE' | 'CONSTRAINT_VERIFICATION' | 'DRIFT_DETECTION';
  check_name: string;
  expected: unknown;
  actual: unknown;
  result: 'PASS' | 'WARNING' | 'FAIL';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'WARNING';
  message?: string;
}

/**
 * Verification Result (aggregate)
 */
export interface VerificationResult {
  verification_id: string;
  migration_id: string;
  commit_sha: string;
  approval_id?: string;
  environment?: string;
  overall_result: 'PASS' | 'WARNING' | 'FAIL' | 'ERROR';
  deployment_eligible: boolean;
  checks: VerificationCheck[];
  summary: {
    total_checks: number;
    passed: number;
    warnings: number;
    failed: number;
    errors: number;
    critical_passed?: number;
    critical_failed?: number;
  };
  error?: {
    type: string;
    code?: string;
    message: string;
    stack?: string;
    timestamp: string;
  };
  execution_time_ms: number;
  timestamp: string;
}

/**
 * Result Semantics (from Contract)
 * 
 * PASS: All checks passed → Deployment ELIGIBLE
 * WARNING: Non-critical issues (additive changes, no declaration) → Deployment ELIGIBLE
 * FAIL: Critical violations (RLS missing, drift) → Deployment BLOCKED
 * ERROR: Cannot verify (DB unreachable, unknown state) → Deployment BLOCKED (fail-closed)
 */
export type VerificationResultType = 'PASS' | 'WARNING' | 'FAIL' | 'ERROR';

/**
 * Deployment Eligibility (from Contract)
 */
export type DeploymentEligibility = boolean; // true = ELIGIBLE, false = BLOCKED

/**
 * Database Adapter Interface (PostgreSQL-agnostic)
 */
export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  queryTables(schema?: string): Promise<string[]>;
  queryTableExists(tableName: string): Promise<boolean>;
  queryColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>>;
  queryPrimaryKey(tableName: string): Promise<string[]>;
  queryForeignKeys(tableName: string): Promise<Array<{ column: string; references: string; referenced_column: string }>>;
  queryRLSStatus(tableName: string): Promise<{ enabled: boolean }>;
  queryRLSPolicies(tableName: string): Promise<Array<{ name: string; command: string; using?: string; check?: string }>>;
}

/**
 * Security-Critical Tables (from Healthcare/Education/Logistics Kernels)
 * 
 * NOTE: In production, this should be derived from Kernel metadata, not hardcoded.
 * Phase 1: Hardcoded for proof of concept.
 */
export const SECURITY_CRITICAL_TABLES = [
  // Healthcare Kernel
  'hc_patients',
  'hc_encounters',
  'hc_medications',
  'hc_prescriptions',
  'hc_patient_notes',
  'hc_appointments',

  // Education Kernel
  'edu_students',
  'edu_enrollments',
  'edu_grades',

  // Logistics Kernel
  'logistics_shipments',
  'logistics_inventory',
] as const;

/**
 * RLS Policy Requirements (from Contract)
 */
export const RLS_REQUIRED_POLICIES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
