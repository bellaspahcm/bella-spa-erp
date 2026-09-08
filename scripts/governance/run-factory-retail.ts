#!/usr/bin/env tsx
/**
 * Retail OS Factory Pipeline Runner
 * 
 * Executes complete Factory pipeline for Retail Industry OS:
 * 1. Evidence Collection
 * 2. Scope Derivation
 * 3. Recommendations
 */

import { collectIndustryEvidence } from './evidence-collector';
import { deriveCanonicalScope, type ScopeDecision } from './canonical-scope-derivation';

async function main() {
  console.log('=== RETAIL OS FACTORY PIPELINE ===\n');
  
  const industryScope = 'retail';
  
  // Step 1: Evidence Collection
  console.log('[1/2] Collecting Retail OS Evidence...\n');
  
  const evidenceMap = await collectIndustryEvidence(industryScope, {
    migrationsPath: 'supabase/migrations',
    generatedTypesPath: 'src/types/database.types.ts',
    domainBasePath: 'src/platform/retail',
    testBasePath: 'src/platform/retail',
  });
  
  console.log(`📊 Discovered ${evidenceMap.size} entities\n`);
  
  // Step 2: Scope Derivation
  console.log('[2/2] Deriving Canonical Scope...\n');
  
  const results = new Map<string, ReturnType<typeof deriveCanonicalScope>>();
  const decisions: Record<ScopeDecision, string[]> = {
    'CONFORM': [],
    'RECONSTRUCT': [],
    'DEFER': [],
    'BLOCK': [],
    'DO_NOT_REVIVE': [],
  };
  
  for (const [entityName, evidence] of evidenceMap.entries()) {
    const result = deriveCanonicalScope(evidence);
    results.set(entityName, result);
    decisions[result.decision].push(entityName);
  }
  
  // Report
  console.log('=== SCOPE DERIVATION RESULTS ===\n');
  
  for (const [decision, entities] of Object.entries(decisions)) {
    if (entities.length > 0) {
      console.log(`${decision}: ${entities.length}`);
      entities.forEach(e => console.log(`  - ${e}`));
      console.log('');
    }
  }
  
  // Detailed Evidence
  console.log('\n=== DETAILED EVIDENCE ===\n');
  
  for (const [entityName, result] of results.entries()) {
    console.log(`${entityName}:`);
    console.log(`  Decision: ${result.decision}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Evidence:`);
    console.log(`    migration: ${result.evidence.migration}`);
    console.log(`    generatedTypes: ${result.evidence.generatedTypes}`);
    console.log(`    rls: ${result.evidence.rls}`);
    console.log(`    domain: ${result.evidence.domain}`);
    console.log(`    tests: ${result.evidence.tests}`);
    console.log('');
  }
  
  // Summary
  console.log('\n=== FACTORY PIPELINE SUMMARY ===\n');
  console.log(`Industry: ${industryScope}`);
  console.log(`Total Entities: ${evidenceMap.size}`);
  console.log(`CONFORM: ${decisions.CONFORM.length}`);
  console.log(`RECONSTRUCT: ${decisions.RECONSTRUCT.length}`);
  console.log(`DEFER: ${decisions.DEFER.length}`);
  console.log(`BLOCK: ${decisions.BLOCK.length}`);
  console.log(`DO_NOT_REVIVE: ${decisions.DO_NOT_REVIVE.length}`);
  
  // Next steps
  if (decisions.BLOCK.length > 0) {
    console.log('\n⚠️ BLOCKED entities detected - governance issues must be resolved first');
  } else if (decisions.RECONSTRUCT.length > 0) {
    console.log(`\n✅ ${decisions.RECONSTRUCT.length} entities ready for RECONSTRUCT`);
    console.log('Next: Build domain implementation for RECONSTRUCT entities');
  } else if (decisions.CONFORM.length === evidenceMap.size) {
    console.log('\n✅ All entities CONFORM - implementation complete');
  }
}

main().catch(console.error);
