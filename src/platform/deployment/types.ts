/**
 * Bella Deployment Engine Types
 * 
 * Based on: E8.0.3 Deployment Governance Contract
 */

export interface Migration {
  version: string; // YYYYMMDDHHMMSS (14 digits)
  name: string;
  sql: string;
  checksum: string; // SHA-256
  gitSHA: string;
  recoveryStrategy: RecoveryStrategy;
}

export type RecoveryStrategy = 
  | 'ROLLBACK'
  | 'COMPENSATING'
  | 'RESTORE'
  | 'FORWARD_FIX';

export interface PreflightResult {
  pass: boolean;
  gate: string;
  failures: ValidationFailure[];
  timestamp: Date;
}

export interface ValidationFailure {
  gate: string;
  reason: string;
  severity: 'ERROR' | 'WARNING';
  recommendation: string;
}

export interface ExecutionResult {
  success: boolean;
  migrationVersion: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  provenance?: ProvenanceRecord;
  error?: Error;
}

export interface ProvenanceRecord {
  migrationVersion: string;
  migrationName: string;
  fileChecksum: string;
  gitCommitSHA: string;
  executor: string; // Must be 'deployment_engine'
  executedAt: Date;
  executionDurationMs: number;
  result: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  evidence: ProvenanceEvidence;
}

export interface ProvenanceEvidence {
  preflight: PreflightResult[];
  execution: {
    sqlStatements: number;
    objectsCreated: string[];
    objectsModified: string[];
    objectsDeleted: string[];
  };
  verification: VerificationResult;
}

export interface VerificationResult {
  pass: boolean;
  schema: SchemaVerification;
  invariants: InvariantVerification;
  contracts: ContractVerification;
}

export interface SchemaVerification {
  pass: boolean;
  expectedObjects: string[];
  actualObjects: string[];
  missing: string[];
  unexpected: string[];
}

export interface InvariantVerification {
  pass: boolean;
  checks: {
    rlsActive: boolean;
    constraintsEnforced: boolean;
    indexesExist: boolean;
    foreignKeysValid: boolean;
  };
}

export interface ContractVerification {
  pass: boolean;
  financeOS: boolean;
  healthcareOS: boolean;
  logisticsOS: boolean;
}

export interface DeploymentConfig {
  credentialSource: 'VAULT' | 'ENVIRONMENT';
  failClosed: boolean;
  validateE7Baseline: boolean;
  dryRun?: boolean;
}

export interface Credential {
  role: string;
  connectionString: string;
  permissions: string[];
}

export interface Actor {
  type: 'AI_AGENT' | 'DEVELOPER' | 'DEPLOYMENT_ENGINE';
  id: string;
  hasDeploymentApproval: boolean;
}
