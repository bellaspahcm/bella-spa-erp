#!/usr/bin/env tsx
/**
 * E9 + E9.1 Integration Test
 * 
 * Verify automated evidence collection flows into E9 decision engine correctly.
 * Tests full pipeline: Repository → Collector → Evidence → Decision Engine → Scope Decision
 */

import { collectEvidence, collectIndustryEvidence } from './evidence-collector';
import { deriveCanonicalScope } from './canonical-scope-derivation';

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log(`❌ FAIL: ${message}`);
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual: ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runIntegrationTests() {
  console.log('🧪 Testing E9 + E9.1 Integration\n');

  const options = {
    industryScope: 'education',
    migrationsPath: 'supabase/migrations',
    generatedTypesPath: 'src/types/database.types.ts',
    domainBasePath: 'src/platform',
    testBasePath: 'src/platform',
  };

  // Test 1: Course (complete) → CONFORM
  console.log('📋 Test 1: Course (complete evidence) → CONFORM');
  const courseEvidence = await collectEvidence('Course', options);
  const courseDecision = deriveCanonicalScope(courseEvidence);
  assertEqual(courseDecision.decision, 'CONFORM', 'Course decision');
  console.log(`   Reason: ${courseDecision.reason}\n`);

  // Test 2: Attendance (canonical persistence but was reconstructed) → CONFORM now
  console.log('📋 Test 2: Attendance (reconstructed, now complete) → CONFORM');
  const attendanceEvidence = await collectEvidence('Attendance', options);
  const attendanceDecision = deriveCanonicalScope(attendanceEvidence);
  assertEqual(attendanceDecision.decision, 'CONFORM', 'Attendance decision');
  console.log(`   Reason: ${attendanceDecision.reason}\n`);

  // Test 3: Student (no evidence) → DEFER
  console.log('📋 Test 3: Student (no evidence) → DEFER');
  const studentEvidence = await collectEvidence('Student', options);
  const studentDecision = deriveCanonicalScope(studentEvidence);
  assertEqual(studentDecision.decision, 'DEFER', 'Student decision');
  console.log(`   Reason: ${studentDecision.reason}\n`);

  // Test 4: Industry-wide scan → decisions for all entities
  console.log('📋 Test 4: Industry-wide evidence collection + decision derivation');
  const industryEvidence = await collectIndustryEvidence('education');
  
  const decisions = new Map();
  for (const [entityName, evidence] of industryEvidence.entries()) {
    const decision = deriveCanonicalScope(evidence);
    decisions.set(entityName, decision);
  }

  console.log(`   Found ${decisions.size} entities:`);
  for (const [entityName, decision] of decisions.entries()) {
    console.log(`   - ${entityName}: ${decision.decision}`);
  }

  // Verify all Education entities resulted in CONFORM
  assertEqual(decisions.get('Course')?.decision, 'CONFORM', 'Course → CONFORM');
  assertEqual(decisions.get('Enrollment')?.decision, 'CONFORM', 'Enrollment → CONFORM');
  assertEqual(decisions.get('Attendance')?.decision, 'CONFORM', 'Attendance → CONFORM');
  assertEqual(decisions.get('Assessment')?.decision, 'CONFORM', 'Assessment → CONFORM');

  // Test 5: E8 Retrospective - reproduce E8 scope derivation
  console.log('\n📋 Test 5: E8 Retrospective - reproduce autonomous scope derivation');
  
  const e8Entities = ['Course', 'Enrollment', 'Attendance', 'Assessment'];
  const e8Decisions: string[] = [];
  
  for (const entityName of e8Entities) {
    const evidence = await collectEvidence(entityName, options);
    const decision = deriveCanonicalScope(evidence);
    e8Decisions.push(decision.decision);
    console.log(`   ${entityName}: ${decision.decision}`);
  }

  // All 4 entities should be CONFORM (after E8.1 reconstruction)
  assertEqual(
    e8Decisions,
    ['CONFORM', 'CONFORM', 'CONFORM', 'CONFORM'],
    'E8 retrospective: 4 entities all CONFORM'
  );

  // Test 6: Student decision (not in E8 scope)
  const studentE8Evidence = await collectEvidence('Student', options);
  const studentE8Decision = deriveCanonicalScope(studentE8Evidence);
  assertEqual(studentE8Decision.decision, 'DEFER', 'E8 Student → DEFER (no evidence)');
  console.log(`   Student: ${studentE8Decision.decision} (not in canonical scope)\n`);

  console.log('✅ All integration tests PASS');
  console.log('\n🎯 E9 + E9.1 Integration Complete');
  console.log('   Repository → Collector → Evidence → Decision Engine → Scope Decision');
  console.log('   Factory can now autonomously derive scope from repository evidence');
}

runIntegrationTests().catch((error) => {
  console.error('❌ Integration test failed:', error);
  process.exit(1);
});
