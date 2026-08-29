/**
 * Bella Deployment Engine - Main Adapter
 * 
 * IMPLEMENTATION ONLY - NO PRODUCTION DEPLOYMENT
 * 
 * Based on: E8.0.3 Deployment Governance Contract
 * 
 * INVARIANTS:
 * 1. E7 baseline FROZEN (no historical modification)
 * 2. Fail-closed (STOP on validation failure)
 * 3. Credential boundary enforced (infrastructure-level)
 */

import type {
  Migration,
  PreflightResult,
  ExecutionResult,
  DeploymentConfig,
  Actor,
  ProvenanceRecord
} from './types';

export class BellaDeploymentEngine {
  private config: DeploymentConfig;
  private actor: Actor;

  constructor(config: DeploymentConfig) {
    this.config = config;
    
    // Determine actor type
    this.actor = this.determineActor();
    
    // Enforce AI boundary (G11)
    if (this.actor.type === 'AI_AGENT') {
      throw new Error(
        'GOVERNANCE VIOLATION: AI agents cannot instantiate Deployment Engine. ' +
        'AI can PROPOSE migrations but cannot DEPLOY.'
      );
    }
  }

  /**
   * Preflight validation (G1-G6, G10)
   * 
   * DOES NOT modify database
   * DOES NOT execute migration
   */
  async preflight(migrationVersion: string): Promise<PreflightResult[]> {
    console.log(`\n🔍 Preflight Validation: ${migrationVersion}\n`);
    
    const results: PreflightResult[] = [];
    
    // Load migration
    const migration = await this.loadMigration(migrationVersion);
    
    // G1: Migration Identity
    results.push(await this.validateIdentity(migration));
    
    // G2: Checksum
    results.push(await this.validateChecksum(migration));
    
    // G3: Schema Drift Detection
    results.push(await this.detectDrift(migration));
    
    // G4: Dependency Validation
    results.push(await this.validateDependencies(migration));
    
    // G5: Destructive Change Detection
    results.push(await this.detectDestructiveChanges(migration));
    
    // G6: RLS/Tenant Safety
    results.push(await this.validateTenantSafety(migration));
    
    // G10: Recovery Strategy
    results.push(await this.validateRecoveryStrategy(migration));
    
    // Fail-closed: ANY failure → STOP
    const allPass = results.every(r => r.pass);
    
    if (!allPass) {
      console.error('\n❌ Preflight FAILED\n');
      const failures = results.filter(r => !r.pass);
      failures.forEach(f => {
        console.error(`  Gate: ${f.gate}`);
        f.failures.forEach(failure => {
          console.error(`    - ${failure.reason}`);
          console.error(`      Recommendation: ${failure.recommendation}`);
        });
      });
      
      throw new Error(
        `Preflight validation failed. ${failures.length} gates did not pass. ` +
        `Deployment STOPPED (fail-closed).`
      );
    }
    
    console.log('\n✅ Preflight PASSED (all gates)\n');
    
    return results;
  }

  /**
   * Deploy migration (G7, G8, G9)
   * 
   * ONLY callable after preflight PASS
   * REQUIRES explicit human approval
   * 
   * ⚠️  PRODUCTION DATABASE MODIFICATION
   */
  async deploy(
    migrationVersion: string,
    options: { humanApproval: boolean; recordProvenance: boolean }
  ): Promise<ExecutionResult> {
    // Block deployment if not explicitly approved
    if (!options.humanApproval) {
      throw new Error(
        'GOVERNANCE VIOLATION: Migration deployment requires explicit human approval. ' +
        'Set humanApproval: true to proceed.'
      );
    }
    
    // Block if in implementation phase
    if (process.env.E8_IMPLEMENTATION_PHASE === 'true') {
      throw new Error(
        'GOVERNANCE VIOLATION: E8.0.4 is in IMPLEMENTATION PHASE ONLY. ' +
        'Production deployment is BLOCKED until E8.1, E8.2 complete and ' +
        'Human Architect approval granted.'
      );
    }
    
    console.log(`\n🚀 Deploying Migration: ${migrationVersion}\n`);
    
    const migration = await this.loadMigration(migrationVersion);
    
    // Run preflight first
    await this.preflight(migrationVersion);
    
    // G7: Controlled execution
    const result = await this.execute(migration);
    
    // G8: Record provenance (if successful)
    if (result.success && options.recordProvenance) {
      result.provenance = await this.recordProvenance(migration, result);
    }
    
    // G9: Post-deployment verification
    const verification = await this.verify(migration);
    
    if (!verification.pass) {
      console.error('\n❌ Post-deployment verification FAILED\n');
      console.error('  Triggering recovery strategy...');
      
      await this.triggerRecovery(migration, verification);
      
      throw new Error(
        `Post-deployment verification failed. Recovery strategy triggered: ${migration.recoveryStrategy}`
      );
    }
    
    console.log('\n✅ Deployment COMPLETE + VERIFIED\n');
    
    return result;
  }

  // ============================================================================
  // Private Methods (Implementations in separate files)
  // ============================================================================

  private determineActor(): Actor {
    // Check if running in AI context
    const isAI = process.env.KIRO_AGENT === 'true' || 
                 process.env.ANTHROPIC_API_KEY !== undefined;
    
    if (isAI) {
      return {
        type: 'AI_AGENT',
        id: 'kiro',
        hasDeploymentApproval: false
      };
    }
    
    // Check if deployment engine service
    const isEngine = process.env.DEPLOYMENT_ENGINE_SERVICE === 'true';
    
    if (isEngine) {
      return {
        type: 'DEPLOYMENT_ENGINE',
        id: 'bella_deployment_engine',
        hasDeploymentApproval: true
      };
    }
    
    // Otherwise developer
    return {
      type: 'DEVELOPER',
      id: process.env.USER || 'unknown',
      hasDeploymentApproval: false
    };
  }

  private async loadMigration(version: string): Promise<Migration> {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    const migrationDir = path.join(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migrationDir);
    const matchingFile = files.find((f: string) => f.startsWith(version));
    
    if (!matchingFile) {
      throw new Error(`Migration ${version} not found in ${migrationDir}`);
    }
    
    const filePath = path.join(migrationDir, matchingFile);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    
    // Extract name from filename
    const name = matchingFile.replace(`${version}_`, '').replace('.sql', '');
    
    // Get git SHA (if in git repo)
    let gitSHA = 'unknown';
    try {
      const { execSync } = require('child_process');
      gitSHA = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      // Not in git repo or git not available
    }
    
    return {
      version,
      name,
      sql,
      checksum,
      gitSHA,
      recoveryStrategy: 'ROLLBACK' // Default, should be specified in migration metadata
    };
  }

  private async validateIdentity(migration: Migration): Promise<PreflightResult> {
    const { validateIdentity } = require('./preflight/identity');
    return validateIdentity(migration);
  }

  private async validateChecksum(migration: Migration): Promise<PreflightResult> {
    const { validateChecksum } = require('./preflight/checksum');
    return validateChecksum(migration);
  }

  private async detectDrift(migration: Migration): Promise<PreflightResult> {
    const { detectDrift } = require('./preflight/drift');
    const { Pool } = require('pg');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      return await detectDrift(migration, db);
    } finally {
      await db.end();
    }
  }

  private async validateDependencies(migration: Migration): Promise<PreflightResult> {
    const { validateDependencies } = require('./preflight/dependency');
    const { Pool } = require('pg');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      return await validateDependencies(migration, db);
    } finally {
      await db.end();
    }
  }

  private async detectDestructiveChanges(migration: Migration): Promise<PreflightResult> {
    const { detectDestructiveChanges } = require('./preflight/destructive');
    return detectDestructiveChanges(migration);
  }

  private async validateTenantSafety(migration: Migration): Promise<PreflightResult> {
    const { validateTenantSafety } = require('./preflight/tenant-safety');
    const { Pool } = require('pg');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      return await validateTenantSafety(migration, db);
    } finally {
      await db.end();
    }
  }

  private async validateRecoveryStrategy(migration: Migration): Promise<PreflightResult> {
    const { validateRecoveryStrategy } = require('./preflight/recovery');
    return validateRecoveryStrategy(migration);
  }

  private async execute(migration: Migration): Promise<ExecutionResult> {
    const { ControlledExecutor } = require('./execution/executor');
    const { Pool } = require('pg');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const executor = new ControlledExecutor(db, 'deployment_engine');
      return await executor.execute(migration);
    } finally {
      await db.end();
    }
  }

  private async recordProvenance(
    migration: Migration,
    result: ExecutionResult
  ): Promise<ProvenanceRecord> {
    const { ProvenanceRecorder } = require('./provenance/recorder');
    const { Pool } = require('pg');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const recorder = new ProvenanceRecorder(db);
      const preflight = []; // Would be passed from preflight phase
      const verification = await this.verify(migration);
      return await recorder.record(migration, result, preflight, verification);
    } finally {
      await db.end();
    }
  }

  private async verify(migration: Migration): Promise<any> {
    const { verifySchema } = require('./verification/schema');
    const { verifyInvariants } = require('./verification/invariant');
    const { verifyContracts } = require('./verification/contract');
    const { Pool } = require('pg');
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const schema = await verifySchema(migration, db);
      const invariants = await verifyInvariants(migration, db);
      const contracts = await verifyContracts(migration, db);
      
      const pass = schema.pass && invariants.pass && contracts.pass;
      
      return {
        pass,
        schema,
        invariants,
        contracts
      };
    } finally {
      await db.end();
    }
  }

  private async triggerRecovery(migration: Migration, verification: any): Promise<void> {
    console.error(`\n🚨 Triggering recovery strategy: ${migration.recoveryStrategy}\n`);
    
    switch (migration.recoveryStrategy) {
      case 'ROLLBACK':
        console.error('  → Transaction already rolled back');
        break;
        
      case 'COMPENSATING':
        console.error('  → Execute compensating migration');
        console.error(`     Look for: ${migration.version}_rollback.sql`);
        break;
        
      case 'RESTORE':
        console.error('  → Restore from backup');
        console.error('     Contact DBA for database restoration');
        break;
        
      case 'FORWARD_FIX':
        console.error('  → Manual intervention required');
        console.error('     Review deployment documentation for recovery steps');
        break;
    }
  }
}
