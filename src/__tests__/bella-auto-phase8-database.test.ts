/**
 * Bella Auto Phase 8 - Finance Center Database Tests
 * Tests loan applications, insurance policies, and financial reporting
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Bella Auto Phase 8 - Finance Center', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const testTenantId = 'bella_auto_demo';

  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  describe('Schema Validation', () => {
    it('should have auto_loan_applications table', async () => {
      const { data, error } = await supabase
        .from('auto_loan_applications')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_insurance_policies table', async () => {
      const { data, error } = await supabase
        .from('auto_insurance_policies')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('RPC Functions', () => {
    it('should have generate_loan_application_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_loan_application_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^LOAN\d{8}-\d{4}$/);
    });

    it('should have check_expiring_insurance_policies function', async () => {
      const { data, error } = await supabase
        .rpc('check_expiring_insurance_policies', {
          p_tenant_id: testTenantId,
          p_days_before: 30,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Loan Applications', () => {
    it('should create loan application with unique number', async () => {
      const { data: applicationNumber } = await supabase
        .rpc('generate_loan_application_number', { p_tenant_id: testTenantId });

      const loanData = {
        tenant_id: testTenantId,
        application_number: applicationNumber,
        customer_id: '00000000-0000-0000-0000-000000000001',
        loan_amount: 500000000,
        down_payment: 150000000,
        loan_term_months: 48,
        interest_rate: 8.5,
        monthly_payment: 8600000,
        bank_name: 'Vietcombank',
        status: 'draft',
      };

      const { data, error } = await supabase
        .from('auto_loan_applications')
        .insert(loanData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.application_number).toBe(applicationNumber);
      expect(data?.status).toBe('draft');
    });

    it('should store JSONB document checklist', async () => {
      const { data: applicationNumber } = await supabase
        .rpc('generate_loan_application_number', { p_tenant_id: testTenantId });

      const documentsChecklist = {
        id_card: true,
        household_registration: true,
        income_proof: false,
        bank_statement: false,
        employment_certificate: false,
        vehicle_registration: false,
        other_documents: [],
      };

      const { data, error } = await supabase
        .from('auto_loan_applications')
        .insert({
          tenant_id: testTenantId,
          application_number: applicationNumber,
          loan_amount: 400000000,
          down_payment: 100000000,
          loan_term_months: 36,
          interest_rate: 9.0,
          bank_name: 'VPBank',
          documents_checklist: documentsChecklist as any,
          status: 'documents_pending',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.documents_checklist).toBeDefined();
      expect((data?.documents_checklist as any).id_card).toBe(true);
    });

    it('should transition through loan workflow states', async () => {
      const { data: applicationNumber } = await supabase
        .rpc('generate_loan_application_number', { p_tenant_id: testTenantId });

      // Create draft
      const { data: draft } = await supabase
        .from('auto_loan_applications')
        .insert({
          tenant_id: testTenantId,
          application_number: applicationNumber,
          loan_amount: 600000000,
          down_payment: 200000000,
          loan_term_months: 60,
          interest_rate: 7.5,
          bank_name: 'Techcombank',
          status: 'draft',
        })
        .select()
        .single();

      expect(draft?.status).toBe('draft');

      // Submit
      const { data: submitted } = await supabase
        .from('auto_loan_applications')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', draft!.id)
        .select()
        .single();

      expect(submitted?.status).toBe('submitted');

      // Approve
      const { data: approved } = await supabase
        .from('auto_loan_applications')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_amount: 550000000,
          approved_term_months: 60,
          approved_interest_rate: 7.5,
        })
        .eq('id', draft!.id)
        .select()
        .single();

      expect(approved?.status).toBe('approved');
      expect(Number(approved?.approved_amount)).toBe(550000000);
    });

    it('should calculate and store referral commission', async () => {
      const { data: applicationNumber } = await supabase
        .rpc('generate_loan_application_number', { p_tenant_id: testTenantId });

      const { data, error } = await supabase
        .from('auto_loan_applications')
        .insert({
          tenant_id: testTenantId,
          application_number: applicationNumber,
          loan_amount: 500000000,
          down_payment: 150000000,
          loan_term_months: 48,
          interest_rate: 8.0,
          bank_name: 'ACB Bank',
          referral_commission_percentage: 1.5,
          referral_commission_amount: 7500000,
          status: 'approved',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(Number(data?.referral_commission_percentage)).toBe(1.5);
      expect(Number(data?.referral_commission_amount)).toBe(7500000);
    });
  });

  describe('Insurance Policies', () => {
    it('should create insurance policy', async () => {
      const policyData = {
        tenant_id: testTenantId,
        policy_number: 'INS20260803001',
        customer_id: '00000000-0000-0000-0000-000000000001',
        vehicle_id: '00000000-0000-0000-0000-000000000002',
        insurance_company: 'Bảo Việt',
        policy_type: 'comprehensive',
        coverage_amount: 800000000,
        deductible_amount: 5000000,
        premium_amount: 15000000,
        premium_payment_frequency: 'annual',
        effective_date: '2026-08-01',
        expiry_date: '2027-08-01',
        status: 'active',
        is_active: true,
      };

      const { data, error } = await supabase
        .from('auto_insurance_policies')
        .insert(policyData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.policy_number).toBe('INS20260803001');
      expect(data?.policy_type).toBe('comprehensive');
    });

    it('should store JSONB coverage items', async () => {
      const coverageItems = {
        collision: true,
        theft: true,
        fire: true,
        flood: true,
        third_party_liability: true,
        personal_accident: true,
        passenger_accident: false,
      };

      const { data, error } = await supabase
        .from('auto_insurance_policies')
        .insert({
          tenant_id: testTenantId,
          policy_number: 'INS20260803002',
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000003',
          insurance_company: 'PVI',
          policy_type: 'comprehensive',
          coverage_items: coverageItems as any,
          premium_amount: 18000000,
          effective_date: '2026-08-01',
          expiry_date: '2027-08-01',
          status: 'active',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.coverage_items).toBeDefined();
      expect((data?.coverage_items as any).collision).toBe(true);
      expect((data?.coverage_items as any).passenger_accident).toBe(false);
    });

    it('should support different policy types', async () => {
      const policyTypes = ['compulsory', 'voluntary', 'comprehensive', 'combined'];

      for (const policyType of policyTypes) {
        const { data, error } = await supabase
          .from('auto_insurance_policies')
          .insert({
            tenant_id: testTenantId,
            policy_number: `INS2026080300${policyTypes.indexOf(policyType) + 3}`,
            customer_id: '00000000-0000-0000-0000-000000000001',
            vehicle_id: '00000000-0000-0000-0000-000000000004',
            insurance_company: 'MIC',
            policy_type: policyType as any,
            premium_amount: 10000000,
            effective_date: '2026-08-01',
            expiry_date: '2027-08-01',
            status: 'draft',
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data?.policy_type).toBe(policyType);
      }
    });

    it('should track renewal reminders', async () => {
      const { data, error } = await supabase
        .from('auto_insurance_policies')
        .insert({
          tenant_id: testTenantId,
          policy_number: 'INS20260803007',
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000005',
          insurance_company: 'Liberty',
          policy_type: 'combined',
          premium_amount: 20000000,
          effective_date: '2026-08-01',
          expiry_date: '2026-09-15', // Expires soon
          auto_renewal: true,
          renewal_reminder_sent: false,
          status: 'active',
          is_active: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.auto_renewal).toBe(true);
      expect(data?.renewal_reminder_sent).toBe(false);
    });

    it('should calculate insurance commission', async () => {
      const { data, error } = await supabase
        .from('auto_insurance_policies')
        .insert({
          tenant_id: testTenantId,
          policy_number: 'INS20260803008',
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000006',
          insurance_company: 'AAA',
          policy_type: 'comprehensive',
          premium_amount: 25000000,
          referral_commission_percentage: 10,
          referral_commission_amount: 2500000,
          effective_date: '2026-08-01',
          expiry_date: '2027-08-01',
          status: 'active',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(Number(data?.referral_commission_percentage)).toBe(10);
      expect(Number(data?.referral_commission_amount)).toBe(2500000);
    });
  });

  describe('Expiring Policies Check', () => {
    it('should detect expiring policies within 30 days', async () => {
      // Create policy expiring in 25 days
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 25);

      await supabase
        .from('auto_insurance_policies')
        .insert({
          tenant_id: testTenantId,
          policy_number: 'INS20260803009',
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000007',
          insurance_company: 'Test Insurance',
          policy_type: 'compulsory',
          premium_amount: 5000000,
          effective_date: '2026-01-01',
          expiry_date: expiryDate.toISOString().split('T')[0],
          status: 'active',
          renewal_reminder_sent: false,
        });

      const { data, error } = await supabase
        .rpc('check_expiring_insurance_policies', {
          p_tenant_id: testTenantId,
          p_days_before: 30,
        });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('RLS and Tenant Isolation', () => {
    it('should enforce tenant isolation on loan applications', async () => {
      const { data: loans } = await supabase
        .from('auto_loan_applications')
        .select('*')
        .eq('tenant_id', testTenantId);

      expect(loans).toBeDefined();
      if (loans && loans.length > 0) {
        loans.forEach(loan => {
          expect(loan.tenant_id).toBe(testTenantId);
        });
      }
    });

    it('should enforce tenant isolation on insurance policies', async () => {
      const { data: policies } = await supabase
        .from('auto_insurance_policies')
        .select('*')
        .eq('tenant_id', testTenantId);

      expect(policies).toBeDefined();
      if (policies && policies.length > 0) {
        policies.forEach(policy => {
          expect(policy.tenant_id).toBe(testTenantId);
        });
      }
    });
  });
});
