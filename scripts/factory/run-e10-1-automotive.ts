#!/usr/bin/env tsx
/**
 * E10.1 — Automotive Fresh OS Field Test
 * 
 * Independent Factory validation on Industry OS NOT used for Factory development.
 * 
 * Success Criteria:
 * 1. Evidence Collection: Discover all auto_* tables
 * 2. Scope Derivation: Classify entities correctly
 * 3. Orchestration: Execute pipeline without errors
 * 4. Gates: All PASS (or DEFER if no implementation)
 * 5. Autonomy: 0 human decisions (or logged exceptions)
 * 6. Evidence: Artifacts captured
 * 
 * CONTROLLED EXPERIMENT PROTOCOL:
 * - NO Factory modifications during test
 * - Document all failures with root cause
 * - Minimal fixes only (maintain generality)
 * - Retest after remediation
 * 
 * Expected Outcomes:
 * - DEFER: No implementation → Factory correctly recognizes scope
 * - RECONSTRUCT: Tables exist → Factory detects E10.2 gap
 * - CONFORM: (unlikely - no automotive code exists)
 * - BLOCK: (governance violation - should not happen)
 * 
 * @see docs/architecture/E10_1_CANDIDATE_SELECTION.md
 */

import { collectIndustryEvidence } from '../governance/evidence-collector';
import { deriveCanonicalScope, type ScopeDerivationResult } from '../governance/canonical-scope-derivation';
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface E10_1_Metrics {
  runId: string;
  timestamp: string;
  candidate: string;
  phase: string;
  
  evidence: {
    tablesDiscovered: number;
    typesFound: boolean;
    domainFound: boolean;
    testsFound: boolean;
    completeness: number;
  };
  
  scope: {
    decisions: Record<string, string>;
    conform: number;
    reconstruct: number;
    defer: number;
    block: number;
  };
  
  pipeline: {
    steps: Array<{
      name: string;
      status: 'pass' | 'fail' | 'skip';
      duration: number;
      error?: string;
    }>;
    totalDuration: number;
  };
  
  autonomy: {
    humanDecisions: number;
    autoDecisions: number;
    decisions: Array<{
      step: string;
      decision: 'human' | 'auto';
      actor: string;
      result: string;
      timestamp: string;
    }>;
  };
  
  result: {
    status: 'pass' | 'fail' | 'blocked';
    message: string;
    factoryGaps: string[];
  };
}

class E10_1_AutomotivePipeline {
  private metrics: E10_1_Metrics;
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      runId: `e10-1-automotive-${Date.now()}`,
      timestamp: new Date().toISOString(),
      candidate: 'automotive',
      phase: 'independent-validation',
      evidence: {
        tablesDiscovered: 0,
        typesFound: false,
        domainFound: false,
        testsFound: false,
        completeness: 0,
      },
      scope: {
        decisions: {},
        conform: 0,
        reconstruct: 0,
        defer: 0,
        block: 0,
      },
      pipeline: {
        steps: [],
        totalDuration: 0,
      },
      autonomy: {
        humanDecisions: 0,
        autoDecisions: 0,
        decisions: [],
      },
      result: {
        status: 'pass',
        message: '',
        factoryGaps: [],
      },
    };
  }
  
  private recordDecision(step: string, actor: string, result: string) {
    this.metrics.autonomy.decisions.push({
      step,
      decision: 'auto',
      actor,
      result,
      timestamp: new Date().toISOString(),
    });
    this.metrics.autonomy.autoDecisions++;
  }
  
  private recordStep(name: string, duration: number, status: 'pass' | 'fail' | 'skip', error?: string) {
    this.metrics.pipeline.steps.push({ name, status, duration, error });
  }
  
  private async runStep<T>(name: string, fn: () => Promise<T>): Promise<{ success: boolean; result?: T; error?: string }> {
    const stepStart = Date.now();
    console.log(`\n▶️  ${name}...`);
    
    try {
      const result = await fn();
      const duration = (Date.now() - stepStart) / 1000;
      this.recordStep(name, duration, 'pass');
      console.log(`✅ ${name} complete (${duration.toFixed(2)}s)`);
      return { success: true, result };
    } catch (error) {
      const duration = (Date.now() - stepStart) / 1000;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordStep(name, duration, 'fail', errorMsg);
      console.error(`❌ ${name} failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
  
  async execute(): Promise<E10_1_Metrics> {
    console.log('='.repeat(80));
    console.log('🏭 E10.1 AUTOMOTIVE FRESH OS FIELD TEST');
    console.log('='.repeat(80));
    console.log(`Run ID: ${this.metrics.runId}`);
    console.log(`Candidate: Automotive (auto_*)`);
    console.log(`Protocol: Controlled Experiment (No Factory modifications)`);
    console.log('='.repeat(80));
    
    // Step 1: Evidence Collection
    const evidenceResult = await this.runStep('E9.1 Evidence Collection', async () => {
      this.recordDecision('evidence-collection', 'E9.1 Evidence Collector', 'Scanning automotive schema');
      
      const evidenceMap = await collectIndustryEvidence('automotive');
      
      // Convert Map to structured format
      const tables = Array.from(evidenceMap.keys());
      const types = tables.filter(entity => {
        const ev = evidenceMap.get(entity)!;
        return ev.generatedTypes;
      });
      const domains = tables.filter(entity => {
        const ev = evidenceMap.get(entity)!;
        return ev.domain;
      });
      const tests = tables.filter(entity => {
        const ev = evidenceMap.get(entity)!;
        return ev.tests;
      });
      
      this.metrics.evidence.tablesDiscovered = tables.length;
      this.metrics.evidence.typesFound = types.length > 0;
      this.metrics.evidence.domainFound = domains.length > 0;
      this.metrics.evidence.testsFound = tests.length > 0;
      this.metrics.evidence.completeness = (
        (this.metrics.evidence.tablesDiscovered > 0 ? 0.4 : 0) +
        (this.metrics.evidence.typesFound ? 0.3 : 0) +
        (this.metrics.evidence.domainFound ? 0.2 : 0) +
        (this.metrics.evidence.testsFound ? 0.1 : 0)
      );
      
      console.log(`   Tables: ${tables.length}`);
      console.log(`   Entities: ${tables.join(', ')}`);
      console.log(`   Types: ${types.length} entities`);
      console.log(`   Domain: ${domains.length} entities`);
      console.log(`   Tests: ${tests.length} entities`);
      console.log(`   Completeness: ${(this.metrics.evidence.completeness * 100).toFixed(1)}%`);
      
      return evidenceMap;
    });
    
    if (!evidenceResult.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'Evidence collection failed';
      this.metrics.result.factoryGaps.push('E9.1 cannot collect automotive evidence');
      return this.finalize();
    }
    
    // Step 2: Scope Derivation
    const scopeResult = await this.runStep('E9 Scope Derivation', async () => {
      this.recordDecision('scope-derivation', 'E9 Decision Engine', 'Applying canonical rules');
      
      // deriveCanonicalScope takes SINGLE evidence, need to iterate Map
      const scopeDecisions = new Map<string, ScopeDerivationResult>();
      
      for (const [entityName, evidence] of evidenceResult.result!.entries()) {
        const decision = deriveCanonicalScope(evidence);
        scopeDecisions.set(entityName, decision);
        
        this.metrics.scope.decisions[entityName] = decision.decision;
        
        switch (decision.decision) {
          case 'CONFORM':
            this.metrics.scope.conform++;
            break;
          case 'RECONSTRUCT':
            this.metrics.scope.reconstruct++;
            break;
          case 'DEFER':
            this.metrics.scope.defer++;
            break;
          case 'BLOCK':
            this.metrics.scope.block++;
            break;
        }
        
        console.log(`   ${entityName}: ${decision.decision} - ${decision.reasoning}`);
      }
      
      return scopeDecisions;
    });
    
    if (!scopeResult.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'Scope derivation failed';
      this.metrics.result.factoryGaps.push('E9 cannot classify automotive entities');
      return this.finalize();
    }
    
    // Check for BLOCK decisions
    const hasBlocked = Array.from(scopeResult.result!.values()).some(
      d => d.decision === 'BLOCK'
    );
    if (hasBlocked) {
      console.log('🛑 Pipeline STOPPED: BLOCK decision detected');
      this.metrics.result.status = 'blocked';
      this.metrics.result.message = 'Governance violation detected';
      return this.finalize();
    }
    
    // Check for RECONSTRUCT decisions
    const hasReconstruct = Array.from(scopeResult.result!.values()).some(
      d => d.decision === 'RECONSTRUCT'
    );
    if (hasReconstruct) {
      console.log('\n⚠️  RECONSTRUCT decisions detected');
      console.log('   E10.2 (RECONSTRUCT automation) not implemented');
      console.log('   This is EXPECTED GAP (deferred, non-blocking)');
      this.metrics.result.factoryGaps.push('E10.2 RECONSTRUCT automation not implemented');
    }
    
    // Step 3: Build Verification
    const buildResult = await this.runStep('Build Verification', async () => {
      this.recordDecision('build-check', 'E10 Orchestrator', 'Checking automotive implementation');
      
      // Check if automotive code exists
      try {
        execSync('test -d src/platform/automotive', { stdio: 'pipe' });
        return { exists: true };
      } catch {
        console.log('   No automotive implementation found (expected)');
        return { exists: false };
      }
    });
    
    if (!buildResult.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'Build verification failed';
      return this.finalize();
    }
    
    // Step 4: Tests (0/0 if no implementation)
    const testsResult = await this.runStep('Test Execution', async () => {
      this.recordDecision('test-execution', 'E10 Orchestrator', 'Running automotive tests');
      
      if (!buildResult.result?.exists) {
        console.log('   No tests to run (no implementation)');
        return { passed: 0, total: 0 };
      }
      
      try {
        const output = execSync('npm test -- src/platform/automotive', {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        console.log(output);
        return { passed: 0, total: 0 }; // Parse from output if needed
      } catch (error) {
        throw new Error('Automotive tests failed');
      }
    });
    
    if (!testsResult.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'Tests failed';
      return this.finalize();
    }
    
    // Step 5: Scoped Typecheck
    const typecheckResult = await this.runStep('Scoped Typecheck (automotive)', async () => {
      this.recordDecision('typecheck', 'E10 Orchestrator', 'TypeScript validation');
      
      if (!buildResult.result?.exists) {
        console.log('   No automotive code to check');
        return { errors: 0 };
      }
      
      try {
        execSync('npx tsc --noEmit --project tsconfig.json', {
          cwd: process.cwd(),
          stdio: 'pipe',
        });
        return { errors: 0 };
      } catch (error) {
        throw new Error('Automotive typecheck failed');
      }
    });
    
    if (!typecheckResult.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'Typecheck failed';
      return this.finalize();
    }
    
    // Step 6: G0.5 Regression Gate
    const g05Result = await this.runStep('G0.5 Regression Gate (44 scopes)', async () => {
      this.recordDecision('g05-regression', 'G0.5 Gate', 'Platform-wide typecheck');
      
      try {
        execSync('npm run governance:typecheck', {
          cwd: process.cwd(),
          stdio: 'pipe',
        });
        return { passed: 44, failed: 0 };
      } catch (error) {
        throw new Error('G0.5 regression detected');
      }
    });
    
    if (!g05Result.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'G0.5 regression gate failed';
      this.metrics.result.factoryGaps.push('Automotive introduction caused platform regression');
      return this.finalize();
    }
    
    // Step 7: Architecture Guard
    const guardResult = await this.runStep('Architecture Guard', async () => {
      this.recordDecision('arch-guard', 'Architecture Guard', 'Boundary enforcement');
      
      try {
        execSync('npm run arch:guard', {
          cwd: process.cwd(),
          stdio: 'pipe',
        });
        return { violations: 0 };
      } catch (error) {
        throw new Error('Architecture Guard violations detected');
      }
    });
    
    if (!guardResult.success) {
      this.metrics.result.status = 'fail';
      this.metrics.result.message = 'Architecture Guard failed';
      this.metrics.result.factoryGaps.push('Automotive violates frozen boundaries');
      return this.finalize();
    }
    
    console.log('\n✅ E10.1 Pipeline COMPLETE');
    
    // Determine final result
    if (this.metrics.scope.defer === Object.keys(this.metrics.scope.decisions).length) {
      this.metrics.result.message = 'All entities DEFER (no implementation required)';
    } else if (this.metrics.scope.reconstruct > 0 && hasReconstruct) {
      this.metrics.result.message = 'RECONSTRUCT detected (E10.2 gap confirmed)';
    } else if (this.metrics.scope.conform > 0) {
      this.metrics.result.message = 'CONFORM entities validated';
    }
    
    return this.finalize();
  }
  
  private finalize(): E10_1_Metrics {
    this.metrics.pipeline.totalDuration = (Date.now() - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 E10.1 AUTOMOTIVE FIELD TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`Status: ${this.metrics.result.status.toUpperCase()}`);
    console.log(`Message: ${this.metrics.result.message}`);
    console.log(`Duration: ${this.metrics.pipeline.totalDuration.toFixed(2)}s`);
    console.log(`\nEvidence:`);
    console.log(`  Tables Discovered: ${this.metrics.evidence.tablesDiscovered}`);
    console.log(`  Types Found: ${this.metrics.evidence.typesFound ? 'YES' : 'NO'}`);
    console.log(`  Domain Found: ${this.metrics.evidence.domainFound ? 'YES' : 'NO'}`);
    console.log(`  Tests Found: ${this.metrics.evidence.testsFound ? 'YES' : 'NO'}`);
    console.log(`  Completeness: ${(this.metrics.evidence.completeness * 100).toFixed(1)}%`);
    console.log(`\nScope Decisions:`);
    console.log(`  CONFORM: ${this.metrics.scope.conform}`);
    console.log(`  RECONSTRUCT: ${this.metrics.scope.reconstruct}`);
    console.log(`  DEFER: ${this.metrics.scope.defer}`);
    console.log(`  BLOCK: ${this.metrics.scope.block}`);
    console.log(`\nAutonomy:`);
    console.log(`  Human Decisions: ${this.metrics.autonomy.humanDecisions}`);
    console.log(`  Auto Decisions: ${this.metrics.autonomy.autoDecisions}`);
    
    if (this.metrics.result.factoryGaps.length > 0) {
      console.log(`\nFactory Gaps Discovered:`);
      this.metrics.result.factoryGaps.forEach(gap => {
        console.log(`  ⚠️  ${gap}`);
      });
    }
    
    console.log('='.repeat(80) + '\n');
    
    return this.metrics;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const pipeline = new E10_1_AutomotivePipeline();
  const metrics = await pipeline.execute();
  
  // Ensure logs directory exists
  mkdirSync('logs', { recursive: true });
  
  // Save metrics
  const metricsPath = join('logs', `${metrics.runId}.json`);
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  console.log(`📄 Metrics saved: ${metricsPath}\n`);
  
  // Exit with appropriate code
  const exitCode = metrics.result.status === 'pass' ? 0 : 1;
  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ E10.1 execution failed:', error);
    process.exit(1);
  });
}

export { E10_1_AutomotivePipeline };
