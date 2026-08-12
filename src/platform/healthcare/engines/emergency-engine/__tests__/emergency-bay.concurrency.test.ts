/**
 * EmergencyBay Concurrency Protection Integration Test
 *
 * Verifies Race-Condition Defense for Emergency Bay Resource Allocation.
 *
 * Invariant:
 * When 2 concurrent requests attempt to allocate the SAME EmergencyBay via `Promise.all`:
 * - Request 1 -> SUCCESS (allocated to encounter 1)
 * - Request 2 -> CONFLICT ERROR ('Occupancy conflict...')
 *
 * @module platform/healthcare/engines/emergency-engine/__tests__
 */

import { SupabaseEmergencyBayRepository } from '../infrastructure/supabase-emergency-bay.repository';
import { EmergencyBay } from '../domain/emergency-bay.resource';

describe('EmergencyBay Concurrency Defense — Integration Tests', () => {
  let repository: SupabaseEmergencyBayRepository;

  beforeEach(() => {
    repository = new SupabaseEmergencyBayRepository();
  });

  it('should successfully handle sequential allocation and release', async () => {
    const bay = EmergencyBay.create({
      id: 'bay-resuscitation-1',
      tenantId: 'tenant-ed-01',
      bayCode: 'RESUS-01',
      bayName: 'Resuscitation Bay 01',
    });

    await repository.save(bay);

    const allocated = await repository.allocateConditional(
      'tenant-ed-01',
      'bay-resuscitation-1',
      'enc-001',
      'patient-001',
      1
    );

    expect(allocated.status).toBe('OCCUPIED');
    expect(allocated.currentEncounterId).toBe('enc-001');
    expect(allocated.version).toBe(2);
  });

  it('should REJECT concurrent race-condition allocations via Promise.all (1 SUCCESS, 1 CONFLICT)', async () => {
    const bay = EmergencyBay.create({
      id: 'bay-resuscitation-2',
      tenantId: 'tenant-ed-01',
      bayCode: 'RESUS-02',
      bayName: 'Resuscitation Bay 02',
    });

    await repository.save(bay);

    // Two concurrent allocation attempts for the same available bay (expectedVersion = 1)
    const req1 = repository.allocateConditional(
      'tenant-ed-01',
      'bay-resuscitation-2',
      'enc-001',
      'patient-001',
      1
    );

    const req2 = repository.allocateConditional(
      'tenant-ed-01',
      'bay-resuscitation-2',
      'enc-002',
      'patient-002',
      1
    );

    const results = await Promise.allSettled([req1, req2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly 1 request MUST succeed, and exactly 1 request MUST fail with conflict
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const failureReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toMatch(/Occupancy conflict/);

    // Verify persisted state: bay is occupied by the winning encounter
    const finalBayState = await repository.findById('tenant-ed-01', 'bay-resuscitation-2');
    expect(finalBayState).not.toBeNull();
    expect(finalBayState!.status).toBe('OCCUPIED');
    expect(finalBayState!.version).toBe(2);
  });
});
