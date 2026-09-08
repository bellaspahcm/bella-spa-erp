/**
 * Factory Preflight Guard — Type Definitions
 * 
 * Origin: Bella Land learning (DB privilege gap detection)
 * Purpose: Catch environment configuration issues before expensive E2E runs
 */

export type PreflightCategory = 'database' | 'environment' | 'configuration';

export type PreflightStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

export interface PreflightResult {
  passed: boolean;
  status: PreflightStatus;
  message: string;
  evidence?: string;
  suggestion?: string;
  timestamp: string;
}

export interface PreflightCheck {
  id: string;
  name: string;
  category: PreflightCategory;
  required: boolean; // If true, failure blocks E2E
  check: () => Promise<PreflightResult>;
}

export interface PreflightSummary {
  passed: boolean;
  totalChecks: number;
  passed_count: number;
  failed_count: number;
  warned_count: number;
  skipped_count: number;
  checks: PreflightCheckSummary[];
  blockers: string[];
  warnings: string[];
  timeElapsed: number; // milliseconds
  timestamp: string;
}

export interface PreflightCheckSummary {
  id: string;
  name: string;
  category: PreflightCategory;
  status: PreflightStatus;
  message: string;
  suggestion?: string;
  required: boolean;
}

export interface PreflightConfig {
  product: string;
  checks: PreflightCategory[];
  skipOptional?: boolean; // Skip non-required checks
  verbose?: boolean;
}

// Database-specific types

export interface DatabasePrivilege {
  table: string;
  role: 'anon' | 'authenticated' | 'service_role';
  privilege: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
}

export interface RLSCheck {
  table: string;
  rlsEnabled: boolean;
  policies: string[];
}

export interface DatabaseCheckConfig {
  requiredTables: string[];
  requiredPrivileges: DatabasePrivilege[];
  rlsChecks: RLSCheck[];
}

// Environment-specific types

export interface EnvironmentVariable {
  name: string;
  required: boolean;
  sensitive?: boolean; // Don't log value
}

export interface EnvironmentCheckConfig {
  requiredVars: EnvironmentVariable[];
}

// Configuration-specific types

export interface ConfigurationCheckConfig {
  checkSchema?: boolean;
  checkRoutes?: boolean;
  checkServerActions?: boolean;
}
