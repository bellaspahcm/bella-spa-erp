#!/usr/bin/env tsx
/**
 * Manual test runner for Evidence Collector
 * 
 * Tests evidence collection against E8.1 Education OS.
 */

import { collectEvidence, collectIndustryEvidence, type EvidenceCollectorOptions } from './evidence-collector';
import type { CanonicalEvidence } from './canonical-scope-derivation';

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.log(`❌ FAIL: ${message}`);
    console.log(`  Expected: ${JSON.stringify(expected)}`);
    console.log(`  Actual: ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertTrue(condition: boolean, message: string) {
  if (!condition) {
    console.log(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('🧪 Testing Evidence Collector\n');

  const defaultOptions: EvidenceCollectorOptions = {
    industryScope: 'education',
    migrationsPath: 'supabase/migrations',
    generatedTypesPath: 'src/types/database.types.ts',
    domainBasePath: 'src/platform',
    testBasePath: 'src/platform',
  };

  // Test 1: Course evidence (complete canonical)
  const courseEvidence = await collectEvidence('Course', defaultOptions);
  assertEqual(courseEvidence.migration, true, 'Course migration detected');
  assertEqual(courseEvidence.generatedTypes, true, 'Course type detected');
  assertEqual(courseEvidence.rls, true, 'Course RLS detected');
  assertEqual(courseEvidence.domain, true, 'Course domain detected');
  assertEqual(courseEvidence.tests, true, 'Course tests detected');

  // Test 2: Enrollment evidence (complete canonical)
  const enrollmentEvidence = await collectEvidence('Enrollment', defaultOptions);
  assertEqual(enrollmentEvidence.migration, true, 'Enrollment migration detected');
  assertEqual(enrollmentEvidence.generatedTypes, true, 'Enrollment type detected');
  assertEqual(enrollmentEvidence.rls, true, 'Enrollment RLS detected');
  assertEqual(enrollmentEvidence.domain, true, 'Enrollment domain detected');
  assertEqual(enrollmentEvidence.tests, true, 'Enrollment tests detected');

  // Test 3: Attendance evidence (reconstructed)
  const attendanceEvidence = await collectEvidence('Attendance', defaultOptions);
  assertEqual(attendanceEvidence.migration, true, 'Attendance migration detected');
  assertEqual(attendanceEvidence.generatedTypes, true, 'Attendance type detected');
  assertEqual(attendanceEvidence.rls, true, 'Attendance RLS detected');
  assertEqual(attendanceEvidence.domain, true, 'Attendance domain detected');
  assertEqual(attendanceEvidence.tests, true, 'Attendance tests detected');

  // Test 4: Assessment evidence (reconstructed)
  const assessmentEvidence = await collectEvidence('Assessment', defaultOptions);
  assertEqual(assessmentEvidence.migration, true, 'Assessment migration detected');
  assertEqual(assessmentEvidence.generatedTypes, true, 'Assessment type detected');
  assertEqual(assessmentEvidence.rls, true, 'Assessment RLS detected');
  assertEqual(assessmentEvidence.domain, true, 'Assessment domain detected');
  assertEqual(assessmentEvidence.tests, true, 'Assessment tests detected');

  // Test 5: Student (no evidence)
  const studentEvidence = await collectEvidence('Student', defaultOptions);
  assertEqual(studentEvidence.migration, false, 'Student migration not found');
  assertEqual(studentEvidence.generatedTypes, false, 'Student type not found');
  assertEqual(studentEvidence.rls, false, 'Student RLS not found');
  assertEqual(studentEvidence.domain, false, 'Student domain not found');
  assertEqual(studentEvidence.tests, false, 'Student tests not found');

  // Test 6: E8 retrospective - Course complete evidence
  const courseComplete: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: true,
    tests: true,
  };
  assertEqual(courseEvidence, courseComplete, 'E8 Course complete evidence');

  // Test 7: E8 retrospective - Attendance reconstructed
  const attendanceComplete: CanonicalEvidence = {
    migration: true,
    generatedTypes: true,
    rls: true,
    domain: true,
    tests: true,
  };
  assertEqual(attendanceEvidence, attendanceComplete, 'E8 Attendance reconstructed evidence');

  // Test 8: E8 retrospective - Student no evidence
  const studentEmpty: CanonicalEvidence = {
    migration: false,
    generatedTypes: false,
    rls: false,
    domain: false,
    tests: false,
  };
  assertEqual(studentEvidence, studentEmpty, 'E8 Student no evidence');

  // Test 9: Determinism
  const courseEvidence2 = await collectEvidence('Course', defaultOptions);
  assertEqual(courseEvidence, courseEvidence2, 'Evidence collection is deterministic');

  // Test 10: Scope awareness - healthcare entity not found in education scope
  const patientEvidence = await collectEvidence('Patient', defaultOptions);
  assertEqual(patientEvidence.migration, false, 'Healthcare Patient not in education scope');
  assertEqual(patientEvidence.domain, false, 'Healthcare Patient domain not in education scope');

  // Test 11: Industry-wide collection
  console.log('\n🔍 Testing industry-wide evidence collection...');
  const industryEvidence = await collectIndustryEvidence('education');
  console.log(`  Found ${industryEvidence.size} entities: ${Array.from(industryEvidence.keys()).join(', ')}`);
  assertTrue(industryEvidence.size >= 4, 'Industry collection found at least 4 entities');
  assertTrue(industryEvidence.has('Course'), 'Industry collection includes Course');
  assertTrue(industryEvidence.has('Enrollment'), 'Industry collection includes Enrollment');
  assertTrue(industryEvidence.has('Attendance'), 'Industry collection includes Attendance');
  assertTrue(industryEvidence.has('Assessment'), 'Industry collection includes Assessment');

  console.log('\n✅ All tests PASS');
  console.log('Evidence Collector verified');
}

runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
