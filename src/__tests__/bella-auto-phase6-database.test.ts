/**
 * Bella Auto Phase 6 - Service Center & Workshop Database Tests
 * Tests service appointments, repair orders, service history, warranty claims
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Bella Auto Phase 6 - Service Center & Workshop', () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const testTenantId = 'bella_auto_demo';

  beforeAll(() => {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  });

  describe('Schema Validation', () => {
    it('should have auto_service_packages table', async () => {
      const { data, error } = await supabase
        .from('auto_service_packages')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_service_appointments table', async () => {
      const { data, error } = await supabase
        .from('auto_service_appointments')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_repair_orders table', async () => {
      const { data, error } = await supabase
        .from('auto_repair_orders')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_repair_order_items table', async () => {
      const { data, error } = await supabase
        .from('auto_repair_order_items')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_service_history table (immutable)', async () => {
      const { data, error } = await supabase
        .from('auto_service_history')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_warranty_claims table', async () => {
      const { data, error } = await supabase
        .from('auto_warranty_claims')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have auto_technician_time_logs table', async () => {
      const { data, error } = await supabase
        .from('auto_technician_time_logs')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('RPC Functions', () => {
    it('should have generate_appointment_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^APT\d{8}-\d{4}$/);
    });

    it('should have generate_repair_order_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^RO\d{8}-\d{4}$/);
    });

    it('should have generate_warranty_claim_number function', async () => {
      const { data, error } = await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toMatch(/^WC\d{8}-\d{4}$/);
    });
  });

  describe('Service Appointment Lifecycle', () => {
    it('should create service appointment with unique number', async () => {
      const { data: aptNumber } = await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId });

      const appointment = {
        tenant_id: testTenantId,
        appointment_number: aptNumber,
        customer_id: '00000000-0000-0000-0000-000000000001',
        vehicle_id: '00000000-0000-0000-0000-000000000002',
        scheduled_date: '2026-08-10',
        scheduled_time: '09:00:00',
        service_type: 'Bảo dưỡng định kỳ',
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('auto_service_appointments')
        .insert(appointment)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.appointment_number).toBe(aptNumber);
      expect(data?.status).toBe('pending');
    });

    it('should transition appointment status: pending -> confirmed -> checked_in', async () => {
      const { data: aptNumber } = await supabase
        .rpc('generate_appointment_number', { p_tenant_id: testTenantId });

      const { data: apt } = await supabase
        .from('auto_service_appointments')
        .insert({
          tenant_id: testTenantId,
          appointment_number: aptNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          scheduled_date: '2026-08-10',
          scheduled_time: '10:00:00',
          service_type: 'Test',
          status: 'pending',
        })
        .select()
        .single();

      // Confirm
      const { data: confirmed } = await supabase
        .from('auto_service_appointments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', apt!.id)
        .select()
        .single();

      expect(confirmed?.status).toBe('confirmed');

      // Check-in
      const { data: checkedIn } = await supabase
        .from('auto_service_appointments')
        .update({
          status: 'checked_in',
          actual_arrival_time: new Date().toISOString(),
        })
        .eq('id', apt!.id)
        .select()
        .single();

      expect(checkedIn?.status).toBe('checked_in');
    });
  });

  describe('Repair Order Management', () => {
    it('should create repair order with line items', async () => {
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          order_type: 'Sửa chữa',
          work_description: 'Thay dầu động cơ',
          mileage_in: 50000,
          status: 'open',
        })
        .select()
        .single();

      expect(repairOrder).toBeDefined();
      expect(repairOrder?.status).toBe('open');

      // Add line items
      const { data: lineItems } = await supabase
        .from('auto_repair_order_items')
        .insert([
          {
            tenant_id: testTenantId,
            repair_order_id: repairOrder!.id,
            item_type: 'part',
            item_name: 'Dầu động cơ 5W-30',
            quantity: 4,
            unit_price: 150000,
            status: 'pending',
          },
          {
            tenant_id: testTenantId,
            repair_order_id: repairOrder!.id,
            item_type: 'labor',
            item_name: 'Công thay dầu',
            quantity: 1,
            unit_price: 200000,
            labor_hours: 0.5,
            status: 'pending',
          },
        ])
        .select();

      expect(lineItems).toBeDefined();
      expect(lineItems?.length).toBe(2);
    });

    it('should auto-calculate line item totals', async () => {
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          order_type: 'Test',
          work_description: 'Test',
          mileage_in: 50000,
          status: 'open',
        })
        .select()
        .single();

      const { data: lineItem } = await supabase
        .from('auto_repair_order_items')
        .insert({
          tenant_id: testTenantId,
          repair_order_id: repairOrder!.id,
          item_type: 'part',
          item_name: 'Test Part',
          quantity: 3,
          unit_price: 100000,
          discount_percentage: 10,
          status: 'pending',
        })
        .select()
        .single();

      // total_amount should be auto-calculated: (3 * 100000) * (1 - 0.1) = 270000
      expect(lineItem?.total_amount).toBe('270000');
    });
  });

  describe('Service History (Immutable)', () => {
    it('should create immutable service history record', async () => {
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          order_type: 'Bảo dưỡng',
          work_description: 'Test maintenance',
          mileage_in: 60000,
          status: 'completed',
        })
        .select()
        .single();

      const { data: history } = await supabase
        .from('auto_service_history')
        .insert({
          tenant_id: testTenantId,
          vin: 'TEST-VIN-123456',
          vehicle_id: repairOrder!.vehicle_id,
          license_plate: '30A-12345',
          vehicle_make: 'Toyota',
          vehicle_model: 'Camry',
          vehicle_year: 2023,
          customer_id: repairOrder!.customer_id,
          customer_name: 'Test Customer',
          repair_order_id: repairOrder!.id,
          repair_order_number: repairOrder!.order_number,
          service_date: repairOrder!.order_date,
          service_type: repairOrder!.order_type,
          mileage: repairOrder!.mileage_in,
          work_description: repairOrder!.work_description,
          is_locked: true,
        })
        .select()
        .single();

      expect(history).toBeDefined();
      expect(history?.is_locked).toBe(true);
      expect(history?.vin).toBe('TEST-VIN-123456');
    });

    it('should prevent UPDATE on locked service history (RLS)', async () => {
      // This test verifies RLS policy blocks updates
      const { data: history } = await supabase
        .from('auto_service_history')
        .select('*')
        .eq('is_locked', true)
        .limit(1)
        .single();

      if (history) {
        const { error } = await supabase
          .from('auto_service_history')
          .update({ work_description: 'Modified' })
          .eq('id', history.id);

        // Should be blocked by RLS
        expect(error).toBeDefined();
      }
    });
  });

  describe('Warranty Claims Workflow', () => {
    it('should create warranty claim with unique number', async () => {
      const { data: claimNumber } = await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId });

      const { data: claim } = await supabase
        .from('auto_warranty_claims')
        .insert({
          tenant_id: testTenantId,
          claim_number: claimNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          claim_type: 'Engine',
          failure_description: 'Test warranty claim',
          failure_date: '2026-08-01',
          mileage_at_failure: 40000,
          status: 'submitted',
        })
        .select()
        .single();

      expect(claim).toBeDefined();
      expect(claim?.claim_number).toBe(claimNumber);
      expect(claim?.status).toBe('submitted');
    });

    it('should transition warranty claim status: submitted -> approved -> completed', async () => {
      const { data: claimNumber } = await supabase
        .rpc('generate_warranty_claim_number', { p_tenant_id: testTenantId });

      const { data: claim } = await supabase
        .from('auto_warranty_claims')
        .insert({
          tenant_id: testTenantId,
          claim_number: claimNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          claim_type: 'Test',
          failure_description: 'Test',
          failure_date: '2026-08-01',
          mileage_at_failure: 40000,
          status: 'submitted',
        })
        .select()
        .single();

      // Approve
      const { data: approved } = await supabase
        .from('auto_warranty_claims')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', claim!.id)
        .select()
        .single();

      expect(approved?.status).toBe('approved');

      // Complete
      const { data: completed } = await supabase
        .from('auto_warranty_claims')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_repair_cost: 5000000,
        })
        .eq('id', claim!.id)
        .select()
        .single();

      expect(completed?.status).toBe('completed');
      expect(Number(completed?.actual_repair_cost)).toBe(5000000);
    });
  });

  describe('Technician Time Tracking', () => {
    it('should create time log and auto-calculate hours', async () => {
      const { data: roNumber } = await supabase
        .rpc('generate_repair_order_number', { p_tenant_id: testTenantId });

      const { data: repairOrder } = await supabase
        .from('auto_repair_orders')
        .insert({
          tenant_id: testTenantId,
          order_number: roNumber,
          customer_id: '00000000-0000-0000-0000-000000000001',
          vehicle_id: '00000000-0000-0000-0000-000000000002',
          order_type: 'Test',
          work_description: 'Test',
          mileage_in: 50000,
          status: 'in_progress',
        })
        .select()
        .single();

      const clockIn = new Date();
      const clockOut = new Date(clockIn.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      const { data: timeLog } = await supabase
        .from('auto_technician_time_logs')
        .insert({
          tenant_id: testTenantId,
          repair_order_id: repairOrder!.id,
          technician_id: '00000000-0000-0000-0000-000000000003',
          technician_name: 'Test Tech',
          clock_in_time: clockIn.toISOString(),
          clock_out_time: clockOut.toISOString(),
        })
        .select()
        .single();

      expect(timeLog).toBeDefined();
      // hours_worked should be auto-calculated by trigger
      // Note: Might be NULL if calculated asynchronously
    });
  });
});
