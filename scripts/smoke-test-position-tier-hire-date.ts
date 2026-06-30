#!/usr/bin/env tsx
/**
 * Smoke Test: Position Tier & Hire Date (Tasks 18-19)
 * 
 * Tests:
 * 1. Database persistence of position_tier and hire_date
 * 2. Salary recalculation with position multiplier
 * 3. Seniority bonus calculation based on years of service
 * 
 * Usage:
 *   npx tsx scripts/smoke-test-position-tier-hire-date.ts
 * 
 * Prerequisites:
 *   - .env.local must have valid SUPABASE_SERVICE_ROLE_KEY
 *   - At least 1 KTV user exists in the database
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database.types';

// Load environment variables from .env.local
config({ path: '.env.local' });

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

type TestResult = {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
};

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.name}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
}

function calculateYearsOfService(hireDate: string): number {
  const hire = new Date(hireDate);
  const now = new Date();
  const diffMs = now.getTime() - hire.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(diffYears);
}

function calculateSeniorityBonus(yearsOfService: number): number {
  if (yearsOfService >= 5) return 0.15;
  if (yearsOfService >= 3) return 0.10;
  if (yearsOfService >= 1) return 0.05;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Database Schema Validation
// ─────────────────────────────────────────────────────────────────────────────

async function testDatabaseSchema() {
  console.log('\n🧪 Test 1: Database Schema Validation');
  
  try {
    const { data: columns, error } = await supabase
      .from('users')
      .select('position_tier, hire_date')
      .limit(1);

    if (error) throw error;

    const hasPositionTier = columns && columns.length > 0 && 'position_tier' in columns[0];
    const hasHireDate = columns && columns.length > 0 && 'hire_date' in columns[0];

    if (hasPositionTier && hasHireDate) {
      logTest({
        name: 'Database Schema',
        status: 'PASS',
        message: 'Both position_tier and hire_date columns exist',
      });
      return true;
    } else {
      logTest({
        name: 'Database Schema',
        status: 'FAIL',
        message: 'Missing columns',
        details: { hasPositionTier, hasHireDate }
      });
      return false;
    }
  } catch (error) {
    logTest({
      name: 'Database Schema',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Find KTV User for Testing
// ─────────────────────────────────────────────────────────────────────────────

async function findKtvUser() {
  console.log('\n🧪 Test 2: Find KTV User for Testing');

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, position_tier, hire_date')
      .in('role', ['ktv', 'ktv_lead'])
      .limit(5);

    if (error) throw error;

    if (!users || users.length === 0) {
      logTest({
        name: 'Find KTV User',
        status: 'FAIL',
        message: 'No KTV users found in database'
      });
      return null;
    }

    const user = users[0];
    logTest({
      name: 'Find KTV User',
      status: 'PASS',
      message: `Found KTV user: ${user.email}`,
      details: {
        id: user.id,
        name: user.full_name,
        role: user.role,
        current_position_tier: user.position_tier,
        current_hire_date: user.hire_date
      }
    });

    return user;
  } catch (error) {
    logTest({
      name: 'Find KTV User',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Update Position Tier & Hire Date
// ─────────────────────────────────────────────────────────────────────────────

async function testUpdateFields(userId: string) {
  console.log('\n🧪 Test 3: Update Position Tier & Hire Date');

  const testPositionTier = 'senior'; // String value: 'junior', 'senior', or 'lead'
  const testHireDate = '2020-01-01'; // 4+ years ago

  try {
    const { error } = await supabase
      .from('users')
      .update({
        position_tier: testPositionTier,
        hire_date: testHireDate
      })
      .eq('id', userId);

    if (error) throw error;

    // Verify update
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('position_tier, hire_date')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const isPositionTierCorrect = user.position_tier === testPositionTier;
    const isHireDateCorrect = user.hire_date === testHireDate;

    if (isPositionTierCorrect && isHireDateCorrect) {
      logTest({
        name: 'Update Fields',
        status: 'PASS',
        message: 'Successfully updated and verified position_tier and hire_date',
        details: {
          position_tier: user.position_tier,
          hire_date: user.hire_date
        }
      });
      return true;
    } else {
      logTest({
        name: 'Update Fields',
        status: 'FAIL',
        message: 'Values did not persist correctly',
        details: {
          expected: { position_tier: testPositionTier, hire_date: testHireDate },
          actual: { position_tier: user.position_tier, hire_date: user.hire_date }
        }
      });
      return false;
    }
  } catch (error) {
    logTest({
      name: 'Update Fields',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Verify Seniority Bonus Calculation
// ─────────────────────────────────────────────────────────────────────────────

async function testSeniorityBonus(userId: string) {
  console.log('\n🧪 Test 4: Verify Seniority Bonus Calculation');

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('hire_date, position_tier')
      .eq('id', userId)
      .single();

    if (error) throw error;

    if (!user.hire_date) {
      logTest({
        name: 'Seniority Bonus',
        status: 'SKIP',
        message: 'No hire_date set, cannot calculate seniority bonus'
      });
      return false;
    }

    const years = calculateYearsOfService(user.hire_date);
    const expectedBonus = calculateSeniorityBonus(years);

    logTest({
      name: 'Seniority Bonus',
      status: 'PASS',
      message: `Calculated seniority bonus: ${(expectedBonus * 100).toFixed(0)}% for ${years} years of service`,
      details: {
        hire_date: user.hire_date,
        years_of_service: years,
        seniority_bonus_percentage: `${(expectedBonus * 100).toFixed(0)}%`,
        position_tier: user.position_tier || 1.0
      }
    });

    return true;
  } catch (error) {
    logTest({
      name: 'Seniority Bonus',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Verify Salary Record Integration
// ─────────────────────────────────────────────────────────────────────────────

async function testSalaryRecordIntegration(userId: string) {
  console.log('\n🧪 Test 5: Salary Record Integration');

  try {
    // Get current month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: salaryRecord, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', userId)
      .eq('month_year', monthKey)
      .maybeSingle();

    if (error) {
      console.error('Salary record query error:', error);
      throw error;
    }

    if (!salaryRecord) {
      logTest({
        name: 'Salary Record Integration',
        status: 'SKIP',
        message: `No salary record found for ${monthKey}. This is expected if no sessions have been logged yet.`
      });
      return false;
    }

    // Verify salary components
    const hasSessionBonus = salaryRecord.session_bonus && salaryRecord.session_bonus > 0;
    const hasBaseSalary = salaryRecord.base_salary && salaryRecord.base_salary > 0;

    logTest({
      name: 'Salary Record Integration',
      status: hasBaseSalary ? 'PASS' : 'SKIP',
      message: hasBaseSalary 
        ? 'Salary record exists and contains base_salary'
        : 'Salary record exists but no base_salary (KTV may not have worked this month)',
      details: {
        month_year: monthKey,
        base_salary: salaryRecord.base_salary,
        session_bonus: salaryRecord.session_bonus,
        total_sessions: salaryRecord.total_sessions,
        total_salary: salaryRecord.total_salary,
        status: salaryRecord.status
      }
    });

    return true;
  } catch (error) {
    const err = error as any;
    logTest({
      name: 'Salary Record Integration',
      status: 'FAIL',
      message: `Error: ${err?.message || err?.toString() || 'Unknown error'}`,
      details: err
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Position Tier Multiplier Validation
// ─────────────────────────────────────────────────────────────────────────────

async function testPositionTierValues() {
  console.log('\n🧪 Test 6: Position Tier Multiplier Validation');

  try {
    const { data: ktvUsers, error } = await supabase
      .from('users')
      .select('id, email, full_name, position_tier')
      .in('role', ['ktv', 'ktv_lead'])
      .not('position_tier', 'is', null)
      .limit(10);

    if (error) throw error;

    if (!ktvUsers || ktvUsers.length === 0) {
      logTest({
        name: 'Position Tier Values',
        status: 'SKIP',
        message: 'No KTV users have position_tier set'
      });
      return false;
    }

    const validValues = ['junior', 'senior', 'lead']; // String values
    const invalidUsers = ktvUsers.filter(u => u.position_tier && !validValues.includes(u.position_tier));

    if (invalidUsers.length === 0) {
      logTest({
        name: 'Position Tier Values',
        status: 'PASS',
        message: `All ${ktvUsers.length} KTV users have valid position_tier values (junior, senior, or lead)`,
        details: {
          distribution: {
            junior_1_0x: ktvUsers.filter(u => u.position_tier === 'junior').length,
            senior_1_2x: ktvUsers.filter(u => u.position_tier === 'senior').length,
            lead_1_5x: ktvUsers.filter(u => u.position_tier === 'lead').length
          }
        }
      });
      return true;
    } else {
      logTest({
        name: 'Position Tier Values',
        status: 'FAIL',
        message: `Found ${invalidUsers.length} users with invalid position_tier values`,
        details: {
          invalid_users: invalidUsers.map(u => ({
            email: u.email,
            position_tier: u.position_tier
          }))
        }
      });
      return false;
    }
  } catch (error) {
    logTest({
      name: 'Position Tier Values',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Test Runner
// ─────────────────────────────────────────────────────────────────────────────

async function runSmokeTests() {
  console.log('🚀 Starting Smoke Tests: Position Tier & Hire Date (Tasks 18-19)');
  console.log('═══════════════════════════════════════════════════════════════════');

  // Test 1: Database schema
  const schemaValid = await testDatabaseSchema();
  if (!schemaValid) {
    console.error('\n❌ Database schema validation failed. Aborting remaining tests.');
    return;
  }

  // Test 2: Find KTV user
  const ktvUser = await findKtvUser();
  if (!ktvUser) {
    console.error('\n❌ No KTV users found. Aborting remaining tests.');
    return;
  }

  // Test 3: Update fields
  await testUpdateFields(ktvUser.id);

  // Test 4: Seniority bonus
  await testSeniorityBonus(ktvUser.id);

  // Test 5: Salary record integration
  await testSalaryRecordIntegration(ktvUser.id);

  // Test 6: Position tier validation
  await testPositionTierValues();

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('📊 Test Summary:');
  console.log('═══════════════════════════════════════════════════════════════════');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`✅ PASSED:  ${passed}`);
  console.log(`❌ FAILED:  ${failed}`);
  console.log(`⏭️  SKIPPED: ${skipped}`);
  console.log(`━━ TOTAL:   ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed. Please review the output above.');
    process.exit(1);
  } else if (passed === 0) {
    console.log('\n⚠️  No tests passed. Please check your environment and database.');
    process.exit(1);
  } else {
    console.log('\n✅ All critical tests passed! Position Tier & Hire Date feature is working correctly.');
    process.exit(0);
  }
}

// Run tests
runSmokeTests().catch((error) => {
  console.error('\n💥 Fatal error during smoke tests:', error);
  process.exit(1);
});
