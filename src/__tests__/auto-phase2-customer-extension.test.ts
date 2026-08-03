import { describe, it, expect } from '@jest/globals';
import { AutoCustomerProvider } from '@/modules/bella-auto/services/AutoCustomerProvider';

// Mock SupabaseClient
function makeSupabaseMock(dbState: any) {
  const chain: any = {};
  chain.eq = (field: string, value: any) => {
    return chain;
  };
  chain.in = (field: string, values: any) => {
    return chain;
  };
  chain.maybeSingle = () => {
    const profiles = dbState['auto_customer_profiles'] ?? [];
    return Promise.resolve({ data: profiles[0] ?? null, error: null });
  };
  chain.single = () => {
    const items = dbState['auto_vehicle_owners'] ?? [];
    return Promise.resolve({ data: items[0] ?? { id: 'owner-new-id' }, error: null });
  };
  
  // Cho phép chain.then và giải quyết như Promise nếu select().eq() được gọi mà không có .maybeSingle() hay .single()
  chain.then = (onfulfilled: any) => {
    return Promise.resolve({ data: dbState['auto_vehicle_owners'] ?? [], error: null }).then(onfulfilled);
  };

  return {
    from: (table: string) => {
      return {
        select: (columns: string, options?: any) => {
          if (options && options.count) {
            // Cho phép chuỗi eq() sau select(..., {count})
            return chain; 
          }
          if (table === 'auto_vehicle_owners') {
            return chain;
          }
          return chain;
        },
        upsert: (payload: any, options?: any) => {
          if (!dbState[table]) dbState[table] = [];
          dbState[table].push(payload);
          return Promise.resolve({ error: null });
        },
        insert: (payload: any) => {
          if (!dbState[table]) dbState[table] = [];
          dbState[table].push({ id: 'owner-new-id', ...payload });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'owner-new-id' }, error: null })
            })
          };
        },
        update: (payload: any) => {
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null })
            })
          };
        }
      } as any;
    }
  } as any;
}

describe('Phase 2: Customer 360 Extension — Unit Tests', () => {

  it('should get customer automotive profile & owned vehicles', async () => {
    const dbState = {
      auto_customer_profiles: [
        {
          customer_id: 'cust-001',
          tenant_id: 'tenant-001',
          preferred_brands: ['BMW'],
          preferred_segments: ['SUV'],
          budget_range: '3B - 5B',
          purchasing_purpose: 'Family',
          total_vehicles_owned: 1,
          total_value_spent: 2439000000
        }
      ],
      auto_vehicle_owners: [
        {
          id: 'owner-record-1',
          tenant_id: 'tenant-001',
          customer_id: 'cust-001',
          ownership_type: 'primary',
          license_plate: '30K-999.99',
          registration_date: '2026-07-28',
          is_active: true,
          auto_vehicles: {
            id: 'veh-001',
            vin: 'WBAHF3C01L7D34567',
            color_exterior: 'White',
            model_year: 2026,
            auto_variants: {
              name: 'Luxury Line',
              auto_models: {
                name: '3 Series',
                auto_brands: { name: 'BMW' }
              }
            }
          }
        }
      ]
    };

    const supabase = makeSupabaseMock(dbState);
    const { profile, ownedVehicles } = await AutoCustomerProvider.getProfile(supabase, 'tenant-001', 'cust-001');

    expect(profile).not.toBeNull();
    expect(profile?.customerId).toBe('cust-001');
    expect(profile?.preferredBrands).toContain('BMW');
    expect(ownedVehicles.length).toBe(1);
    expect(ownedVehicles[0].vin).toBe('WBAHF3C01L7D34567');
    expect(ownedVehicles[0].licensePlate).toBe('30K-999.99');
  });

  it('should upsert automotive preference profile', async () => {
    const dbState: any = { auto_customer_profiles: [] };
    const supabase = makeSupabaseMock(dbState);

    await AutoCustomerProvider.upsertProfile(supabase, 'tenant-001', {
      customerId: 'cust-002',
      preferredBrands: ['Mercedes-Benz'],
      preferredSegments: ['Sedan'],
      budgetRange: '2B - 4B',
      purchasingPurpose: 'Business'
    });

    expect(dbState.auto_customer_profiles.length).toBe(1);
    expect(dbState.auto_customer_profiles[0].preferred_brands).toContain('Mercedes-Benz');
    expect(dbState.auto_customer_profiles[0].customer_id).toBe('cust-002');
  });

  it('should link customer to new owned vehicle', async () => {
    const dbState: any = { auto_vehicle_owners: [] };
    const supabase = makeSupabaseMock(dbState);

    const recordId = await AutoCustomerProvider.addVehicleOwner(supabase, {
      tenantId: 'tenant-001',
      customerId: 'cust-001',
      vehicleId: 'veh-999',
      ownershipType: 'primary',
      licensePlate: '51K-999.99',
      registrationDate: '2026-08-01'
    });

    expect(recordId).toBe('owner-new-id');
    expect(dbState.auto_vehicle_owners.length).toBe(1);
    expect(dbState.auto_vehicle_owners[0].vehicle_id).toBe('veh-999');
  });
});
