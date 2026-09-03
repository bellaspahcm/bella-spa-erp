#!/usr/bin/env tsx
/**
 * Manual test runner for canonical-scope-derivation rule
 * (Jest doesn't discover scripts/** tests)
 */

import { deriveCanonicalScope, type CanonicalEvidence } from './canonical-scope-derivation';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('🧪 Testing Factory Canonical Scope Derivation Rule\n');

// Test 1: CONFORM with complete evidence
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: true,
    tests: true,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'CONFORM', 'Complete evidence → CONFORM');
  assert(result.reason.toLowerCase().includes('complete'), 'Reason mentions completeness');
}

// Test 2: RECONSTRUCT - E8 Attendance case
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: false, // Missing
    tests: false,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'RECONSTRUCT', 'Canonical persistence + missing domain → RECONSTRUCT');
  assert(result.reason.toLowerCase().includes('drift'), 'Reason mentions drift');
}

// Test 3: DEFER - Domain without persistence
{
  const evidence: CanonicalEvidence = {
    migration: false,
    generatedTypes: false,
    rls: false,
    domain: true,
    tests: true,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'DEFER', 'Domain without persistence → DEFER');
  assert(result.reason.toLowerCase().includes('speculative'), 'Reason mentions speculative');
}

// Test 4: BLOCK - Contract drift
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: false, // DRIFT
    rls: true,
    domain: false,
    tests: false,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'BLOCK', 'Migration without types → BLOCK');
  assert(result.reason.toLowerCase().includes('drift') || result.reason.toLowerCase().includes('contract'), 'Reason mentions contract/drift');
}

// Test 5: BLOCK - Missing RLS
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: false, // MISSING
    domain: false,
    tests: false,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'BLOCK', 'Canonical table without RLS → BLOCK');
  assert(result.reason.toLowerCase().includes('rls') || result.reason.toLowerCase().includes('governance'), 'Reason mentions RLS/governance');
}

// Test 6: DO_NOT_REVIVE - Historical only
{
  const evidence: CanonicalEvidence = {
    migration: false,
    generatedTypes: false,
    rls: false,
    domain: false,
    tests: false,
    historical: true,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'DO_NOT_REVIVE', 'Historical only → DO_NOT_REVIVE');
  assert(result.reason.toLowerCase().includes('historical'), 'Reason mentions historical');
}

// Test 7: E8.1 Course retrospective
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: true,
    tests: true,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'CONFORM', 'E8 Course (complete) → CONFORM');
}

// Test 8: E8.1 Attendance retrospective
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: false,
    tests: false,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'RECONSTRUCT', 'E8 Attendance (drift) → RECONSTRUCT');
}

// Test 9: E8.1 Student (not built)
{
  const evidence: CanonicalEvidence = {
    migration: false,
    generatedTypes: false,
    rls: false,
    domain: false,
    tests: false,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'DEFER', 'E8 Student (no evidence) → DEFER, not RECONSTRUCT');
}

// Test 10: Historical but also canonical
{
  const evidence: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: false,
    tests: false,
    historical: true,
  };
  const result = deriveCanonicalScope(evidence);
  assert(result.decision === 'RECONSTRUCT', 'Canonical wins over historical → RECONSTRUCT not DO_NOT_REVIVE');
}

console.log('\n✅ All tests PASS');
console.log('Factory Canonical Scope Derivation Rule verified');
