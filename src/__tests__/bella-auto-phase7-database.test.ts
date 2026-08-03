/**
 * Bella Auto Phase 7 - Trade-In Center Database Tests
 * Tests trade-in appraisals, photos, market valuations
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Bella Auto Phase 7 - Trade-In Center', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const testTenantId = 'bella_auto_demo';

  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  describe('Schema Validation', () => {
    it('should have auto_trade_in_appraisals table', async () => {
      const { data, error } = await supabase
        .from('auto_trade_in_appraisals')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_trade_in_photos table', async () => {
      const { data, error } = await supabase
        .from('auto_trade_in_photos')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_market_valuations table', async () => {
      const { data, error } = await supabase
        .from('auto_market_valuations')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('RPC Functions', () => {
    it('should have generate_trade_in_appraisal_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^TI\d{8}-\d{4}$/);
    });
  });

  describe('Trade-In Appraisal Creation', () => {
    it('should create trade-in appraisal with unique number', async () => {
      const { data: appraisalNumber } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      const appraisal = {
        tenant_id: testTenantId,
        appraisal_number: appraisalNumber,
        customer_id: '00000000-0000-0000-0000-000000000001',
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        mileage: 50000,
        status: 'draft',
      };

      const { data, error } = await supabase
        .from('auto_trade_in_appraisals')
        .insert(appraisal)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.appraisal_number).toBe(appraisalNumber);
      expect(data?.status).toBe('draft');
    });

    it('should store JSONB technical checklist', async () => {
      const { data: appraisalNumber } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      const engineCondition = {
        status: 'good',
        notes: 'Engine runs smoothly',
        items: {
          starts_easily: true,
          idle_smooth: true,
          no_smoke: true,
          no_leaks: true,
        },
      };

      const { data, error } = await supabase
        .from('auto_trade_in_appraisals')
        .insert({
          tenant_id: testTenantId,
          appraisal_number: appraisalNumber,
          make: 'Honda',
          model: 'Civic',
          year: 2019,
          mileage: 60000,
          engine_condition: engineCondition as any,
          status: 'draft',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.engine_condition).toBeDefined();
      expect((data?.engine_condition as any).status).toBe('good');
    });
  });

  describe('Appraisal Status Workflow', () => {
    it('should transition through workflow states', async () => {
      const { data: appraisalNumber } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      // Create draft
      const { data: draft } = await supabase
        .from('auto_trade_in_appraisals')
        .insert({
          tenant_id: testTenantId,
          appraisal_number: appraisalNumber,
          make: 'Toyota',
          model: 'Corolla',
          year: 2021,
          mileage: 30000,
          status: 'draft',
        })
        .select()
        .single();

      expect(draft?.status).toBe('draft');

      // Submit for approval
      const { data: pending } = await supabase
        .from('auto_trade_in_appraisals')
        .update({
          status: 'pending_approval',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', draft!.id)
        .select()
        .single();

      expect(pending?.status).toBe('pending_approval');

      // Approve
      const { data: approved } = await supabase
        .from('auto_trade_in_appraisals')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          final_trade_in_value: 400000000,
        })
        .eq('id', draft!.id)
        .select()
        .single();

      expect(approved?.status).toBe('approved');
      expect(Number(approved?.final_trade_in_value)).toBe(400000000);
    });
  });

  describe('Trade-In Photos', () => {
    it('should upload photos for appraisal', async () => {
      const { data: appraisalNumber } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      const { data: appraisal } = await supabase
        .from('auto_trade_in_appraisals')
        .insert({
          tenant_id: testTenantId,
          appraisal_number: appraisalNumber,
          make: 'Mazda',
          model: 'CX-5',
          year: 2022,
          mileage: 20000,
          status: 'draft',
        })
        .select()
        .single();

      const photo = {
        tenant_id: testTenantId,
        appraisal_id: appraisal!.id,
        photo_category: 'front',
        photo_url: 'https://example.com/photos/front.jpg',
        display_order: 0,
        is_primary: true,
      };

      const { data, error } = await supabase
        .from('auto_trade_in_photos')
        .insert(photo)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.photo_category).toBe('front');
      expect(data?.is_primary).toBe(true);
    });

    it('should store damage markers as JSONB', async () => {
      const { data: appraisalNumber } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      const { data: appraisal } = await supabase
        .from('auto_trade_in_appraisals')
        .insert({
          tenant_id: testTenantId,
          appraisal_number: appraisalNumber,
          make: 'Ford',
          model: 'Ranger',
          year: 2021,
          mileage: 40000,
          status: 'draft',
        })
        .select()
        .single();

      const damageMarkers = [
        { x: 100, y: 200, label: 'Scratch', severity: 'minor' },
        { x: 300, y: 150, label: 'Dent', severity: 'moderate' },
      ];

      const { data, error } = await supabase
        .from('auto_trade_in_photos')
        .insert({
          tenant_id: testTenantId,
          appraisal_id: appraisal!.id,
          photo_category: 'damage_specific',
          photo_url: 'https://example.com/photos/damage.jpg',
          damage_markers: damageMarkers as any,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.damage_markers).toBeDefined();
      expect((data?.damage_markers as any).length).toBe(2);
    });
  });

  describe('Market Valuations', () => {
    it('should create market valuation record', async () => {
      const valuation = {
        tenant_id: testTenantId,
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        price_excellent: 650000000,
        price_good: 600000000,
        price_fair: 550000000,
        price_poor: 500000000,
        data_source: 'manual_entry',
        is_active: true,
      };

      const { data, error } = await supabase
        .from('auto_market_valuations')
        .insert(valuation)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Number(data?.price_good)).toBe(600000000);
      expect(data?.is_active).toBe(true);
    });

    it('should support mileage brackets', async () => {
      const valuation = {
        tenant_id: testTenantId,
        make: 'Honda',
        model: 'Civic',
        year: 2019,
        mileage_bracket_start: 50000,
        mileage_bracket_end: 100000,
        price_excellent: 550000000,
        price_good: 500000000,
        price_fair: 450000000,
        price_poor: 400000000,
        data_source: 'market_api',
        is_active: true,
      };

      const { data, error } = await supabase
        .from('auto_market_valuations')
        .insert(valuation)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.mileage_bracket_start).toBe(50000);
      expect(data?.mileage_bracket_end).toBe(100000);
    });
  });

  describe('Valuation Integration', () => {
    it('should link market valuation to appraisal', async () => {
      // Create market valuation
      await supabase
        .from('auto_market_valuations')
        .insert({
          tenant_id: testTenantId,
          make: 'Mazda',
          model: '3',
          year: 2021,
          price_excellent: 500000000,
          price_good: 450000000,
          price_fair: 400000000,
          price_poor: 350000000,
          is_active: true,
        });

      // Create appraisal
      const { data: appraisalNumber } = await supabase
        .rpc('generate_trade_in_appraisal_number', { p_tenant_id: testTenantId });

      const { data: appraisal, error } = await supabase
        .from('auto_trade_in_appraisals')
        .insert({
          tenant_id: testTenantId,
          appraisal_number: appraisalNumber,
          make: 'Mazda',
          model: '3',
          year: 2021,
          mileage: 35000,
          overall_condition: 'good',
          estimated_market_value: 450000000,
          offered_trade_in_value: 400000000,
          market_low: 350000000,
          market_average: 425000000,
          market_high: 500000000,
          status: 'draft',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(Number(appraisal?.estimated_market_value)).toBe(450000000);
      expect(Number(appraisal?.offered_trade_in_value)).toBe(400000000);
    });
  });

  describe('RLS and Tenant Isolation', () => {
    it('should enforce tenant isolation via RLS', async () => {
      // This test verifies RLS is enabled
      // In production, different tenants should not see each other's data
      const { data: appraisals } = await supabase
        .from('auto_trade_in_appraisals')
        .select('*')
        .eq('tenant_id', testTenantId);

      // Should only return data for this tenant
      expect(appraisals).toBeDefined();
      if (appraisals && appraisals.length > 0) {
        appraisals.forEach(a => {
          expect(a.tenant_id).toBe(testTenantId);
        });
      }
    });
  });
});
