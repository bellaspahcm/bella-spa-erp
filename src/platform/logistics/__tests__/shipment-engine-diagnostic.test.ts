/**
 * Diagnostic Test for Shipment Engine
 * Simplified test to identify the root cause of failures
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { ShipmentEngineService } from '../engines/shipment-engine';

// Mock event bus
jest.mock('@/platform/host/event-bus', () => ({
  eventBus: {
    publish: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Shipment Engine - Diagnostic', () => {
  it('should identify what is failing in createShipment', async () => {
    // Minimal mock that logs what methods are being called
    const callLog: string[] = [];
    
    const mockSupabase = {
      from: (table: string) => {
        callLog.push(`from(${table})`);
        return {
          insert: (data: unknown) => {
            callLog.push(`insert() with data keys: ${Object.keys(data as object).join(', ')}`);
            return {
              select: () => {
                callLog.push('select()');
                return {
                  single: async () => {
                    callLog.push('single()');
                    const row = {
                      id: 'test-id',
                      tenant_id: 'tenant-001',
                      shipment_number: 'SHIP-TEST',
                      status: 'draft',
                      type: 'standard',
                      priority: 'normal',
                      origin: {},
                      destination: {},
                      planned_pickup_date: '2026-08-22T10:00:00Z',
                      planned_delivery_date: '2026-08-25T16:00:00Z',
                      items: [],
                      total_weight: null,
                      total_volume: null,
                      special_instructions: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      created_by: 'user-001',
                      last_modified_by: 'user-001',
                      carrier_id: null,
                      route_id: null,
                      actual_pickup_date: null,
                      actual_delivery_date: null,
                    };
                    return { data: row, error: null };
                  },
                },
              },
            };
          },
          select: () => {
            callLog.push('select()');
            return {
              eq: () => ({
                single: async () => {
                  callLog.push('select().eq().single() - returning null for idempotency');
                  return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
                },
              }),
            };
          },
          upsert: async (data: unknown) => {
            callLog.push('upsert()');
            return { error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    const engine = new ShipmentEngineService(mockSupabase);

    try {
      const result = await engine.createShipment({
        requestId: 'diagnostic-001',
        tenantId: 'tenant-001',
        type: 'standard',
        priority: 'normal',
        origin: {
          type: 'warehouse',
          address: {
            line1: '123 Main St',
            city: 'New York',
            postalCode: '10001',
            country: 'USA',
            countryCode: 'US',
          },
        },
        destination: {
          type: 'customer',
          address: {
            line1: '456 Oak Ave',
            city: 'Los Angeles',
            postalCode: '90001',
            country: 'USA',
            countryCode: 'US',
          },
        },
        plannedPickupDate: '2026-08-22T10:00:00Z',
        plannedDeliveryDate: '2026-08-25T16:00:00Z',
        items: [],
        createdBy: 'user-001',
      });

      console.log('===== CALL LOG =====');
      console.log(callLog.join('\n'));
      console.log('====================');
      console.log('Result success:', result.success);
      if (!result.success) {
        console.log('Error code:', result.error?.code);
        console.log('Error message:', result.error?.message);
        console.log('Error details:', JSON.stringify(result.error?.details, null, 2));
      } else {
        console.log('Data:', result.data);
      }

      expect(result.success).toBe(true);
    } catch (error) {
      console.error('Exception thrown:', error);
      throw error;
    }
  });
});
