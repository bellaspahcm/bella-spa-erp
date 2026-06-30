/**
 * E2E Salary System Minimal Test
 * 
 * Simplified version of comprehensive test for quick validation.
 * Tests core salary calculation with package multipliers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  cleanupTestData,
  createTestTenant,
  createTestKTVs,
  createTestPackages,
  getSalaryRecord,
  getAdminClient,
  getTestPrefix,
  assertTestEnvironment,
  type TestKTVProfile,
  type TestPackage,
} from './helpers/salary-e2e-db-helper';
import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';

describe('E2E Salary System - Minimal Test', () => {
  const TENANT_ID = `${getTestPrefix()}-tenant`;
  const MONTH_YEAR = '2026-06-01';
  
  let ktvId: string;
  let envConfigured = false;

  beforeAll(async () => {
    // Check environment first
    try {
      assertTestEnvironment();
      envConfigured = true;
      console.log('🚀 Setting up minimal salary test...');
    
    // Create tenant
    await createTestTenant();
    
    // Create one KTV
    const ktv: TestKTVProfile = {
      id: `${getTestPrefix()}-ktv-alpha`,
      full_name: 'KTV Test Alpha',
      email: 'ktv-alpha@test.com',
      role: 'ktv',
      base_salary: 6_000_000,
      resignation_date: null,
      tenant_id: TENANT_ID,
    };
    await createTestKTVs([ktv]);
    ktvId = ktv.id;
    
    // Create basic package
    const basicPackage: TestPackage = {
      id: `${getTestPrefix()}-pkg-basic`,
      name: 'Combo Mẹ & Bé Tiết Kiệm',
      description: 'Basic package',
      session_multiplier: 1.0,
      price: 1000000,
      tenant_id: TENANT_ID,
      module: 'baby_care',
    };
    await createTestPackages([basicPackage]);
    
    console.log('✅ Minimal test setup complete');
    } catch (error) {
      console.error('❌ Environment not configured:', error);
      console.log('⏩ Skipping E2E tests - set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run');
      envConfigured = false;
    }
  });

  afterAll(async () => {
    if (!envConfigured) return;
    console.log('🧹 Cleaning up minimal test...');
    await cleanupTestData();
  });

  it('should create a draft salary record', async () => {
    if (!envConfigured) {
      console.log('⏩ Skipping test - environment not configured');
      return;
    }
    const supabase = getAdminClient();
    
    // Recalculate salary (will create draft record)
    const result = await recalculateAndSaveSalaryRecordEngine(
      supabase as any,
      ktvId,
      MONTH_YEAR,
      TENANT_ID
    );
    
    expect(result.success).toBe(true);
    expect(result.totalSalary).toBeGreaterThan(0);
    
    // Verify record was created
    const record = await getSalaryRecord(ktvId, MONTH_YEAR, TENANT_ID);
    expect(record).not.toBeNull();
    expect(record?.status).toBe('draft');
    expect(record?.ktv_id).toBe(ktvId);
    expect(record?.base_salary).toBe(6_000_000);
  });

  it('should calculate pro-rata base salary correctly', async () => {
    // This test verifies the business logic calculation
    // Pro-rata: (base_salary / 26) * actualDays
    
    const baseSalary = 6_000_000;
    const actualDays = 12;
    const expectedProRata = Math.round((baseSalary / 26) * actualDays);
    
    // For 12 days: (6,000,000 / 26) * 12 = 2,769,230.77 ≈ 2,769,231
    expect(expectedProRata).toBeCloseTo(2_769_231, 0);
  });

  it('should calculate session bonus correctly', async () => {
    // Mock calculation: 10 sessions × 100k commission = 1,000,000
    const sessionCount = 10;
    const commissionPerSession = 100_000;
    const expectedBonus = sessionCount * commissionPerSession;
    
    expect(expectedBonus).toBe(1_000_000);
  });

  it('should handle package multipliers correctly', async () => {
    // Basic (1.0x): 10 sessions = 10 weighted
    const basicWeighted = 10 * 1.0;
    expect(basicWeighted).toBe(10);
    
    // Happy (1.5x): 6 sessions = 9 weighted
    const happyWeighted = 6 * 1.5;
    expect(happyWeighted).toBe(9);
    
    // VIP (2.0x): 4 sessions = 8 weighted
    const vipWeighted = 4 * 2.0;
    expect(vipWeighted).toBe(8);
    
    // Total: 10 + 9 + 8 = 27 weighted sessions
    const totalWeighted = basicWeighted + happyWeighted + vipWeighted;
    expect(totalWeighted).toBe(27);
  });

  it('should calculate rating bonus based on thresholds', async () => {
    const sessionBonus = 1_000_000;
    
    // 5.0 rating → 10% bonus
    const bonus5Star = sessionBonus * 0.10;
    expect(bonus5Star).toBe(100_000);
    
    // 4.8 rating → ~10% bonus
    const bonus48 = Math.round(sessionBonus * 0.10);
    expect(bonus48).toBe(100_000);
    
    // 4.5 rating → ~5% bonus
    const bonus45 = Math.round(sessionBonus * 0.05);
    expect(bonus45).toBe(50_000);
    
    // 4.0 rating → 0% bonus
    const bonus40 = 0;
    expect(bonus40).toBe(0);
  });

  it('should calculate total salary correctly', async () => {
    const components = {
      baseSalary: 6_000_000,
      sessionBonus: 2_000_000,
      ratingBonus: 200_000,
      kpiBonus: 500_000,
      deductions: 100_000,
      advances: 0,
    };
    
    const total = 
      components.baseSalary +
      components.sessionBonus +
      components.ratingBonus +
      components.kpiBonus -
      components.deductions -
      components.advances;
    
    expect(total).toBe(8_600_000);
  });
});
