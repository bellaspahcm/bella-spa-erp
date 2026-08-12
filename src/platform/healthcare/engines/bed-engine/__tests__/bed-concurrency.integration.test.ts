/**
 * Bed Engine Concurrency Race-Condition Integration Test
 *
 * Verifies that when two concurrent requests (Request A & Request B) attempt to allocate
 * the exact same available bed simultaneously:
 * - Request A succeeds (RETURNS SUCCESS)
 * - Request B is rejected (RETURNS CONFLICT / BedOccupancyConflictError)
 * - Invariant: 1 Bed MUST have at most ONE active occupancy at any point in time.
 *
 * @module platform/healthcare/engines/bed-engine/__tests__
 */

import { BedEngineService } from '../bed-engine.service';
import { IBedRepository, BedOccupancyConflictError } from '../repositories/supabase-bed.repository';
import { Bed } from '../domain/bed.entity';

class MockConcurrentBedRepository implements IBedRepository {
  private beds = new Map<string, Bed>();

  constructor() {
    // Seed initial available bed
    const bed = Bed.create({
      id: 'bed-101',
      tenantId: 'tenant-test',
      wardId: 'ward-icu',
      bedCode: 'ICU-101',
      bedType: 'icu',
      dailyRate: 1500000,
    });
    this.beds.set(bed.id, bed);
  }

  async findById(tenantId: string, id: string): Promise<Bed | null> {
    const bed = this.beds.get(id);
    if (!bed || bed.tenantId !== tenantId) return null;
    return Bed.rehydrate(bed.toSnapshot());
  }

  async findAvailableBed(tenantId: string, wardId: string, preferredBedId?: string): Promise<Bed | null> {
    const targetId = preferredBedId || 'bed-101';
    const bed = this.beds.get(targetId);
    if (!bed || bed.tenantId !== tenantId || bed.status !== 'available') return null;
    return Bed.rehydrate(bed.toSnapshot());
  }

  async findAllInWard(tenantId: string, wardId: string): Promise<Bed[]> {
    return Array.from(this.beds.values()).map((b) => Bed.rehydrate(b.toSnapshot()));
  }

  async save(bed: Bed): Promise<Bed> {
    const current = this.beds.get(bed.id);
    if (!current) throw new Error('Bed not found');

    // Simulate atomic DB conditional update: eq('status', 'available')
    if (bed.status === 'occupied') {
      if (current.status !== 'available') {
        throw new BedOccupancyConflictError(bed.id, bed.bedCode);
      }
    }

    const updated = Bed.rehydrate(bed.toSnapshot());
    this.beds.set(bed.id, updated);
    return updated;
  }
}

describe('Bed Engine Concurrency Protection', () => {
  let repository: MockConcurrentBedRepository;
  let service: BedEngineService;

  beforeEach(() => {
    repository = new MockConcurrentBedRepository();
    service = new BedEngineService(repository);
  });

  test('Race Condition: Concurrent allocation of same bed allows only 1 winner and rejects the second with CONCURRENCY_CONFLICT', async () => {
    const requestA = {
      tenantId: 'tenant-test',
      wardId: 'ward-icu',
      preferredBedId: 'bed-101',
      patientId: 'patient-a',
      admissionId: 'admission-a',
      encounterId: 'encounter-a',
    };

    const requestB = {
      tenantId: 'tenant-test',
      wardId: 'ward-icu',
      preferredBedId: 'bed-101',
      patientId: 'patient-b',
      admissionId: 'admission-b',
      encounterId: 'encounter-b',
    };

    // Execute Request A and Request B concurrently
    const [resultA, resultB] = await Promise.all([
      service.allocateBed(requestA),
      service.allocateBed(requestB),
    ]);

    // One request must succeed, and one request must be rejected with CONCURRENCY_CONFLICT
    const successResults = [resultA, resultB].filter((r) => r.success);
    const conflictResults = [resultA, resultB].filter(
      (r) => !r.success && r.error?.code === 'CONCURRENCY_CONFLICT'
    );

    expect(successResults.length).toBe(1);
    expect(conflictResults.length).toBe(1);

    // Verify bed state in DB is occupied by exactly 1 patient
    const finalBedRes = await service.getBedById('tenant-test', 'bed-101');
    expect(finalBedRes.success).toBe(true);
    expect(finalBedRes.data?.status).toBe('occupied');
  });
});
