/**
 * ICU Bed Atomic Conditional Lock Concurrency Protection Test (Tier 1 & 2)
 * 
 * Verifies Law of Concurrency Defense:
 * Two concurrent allocations for the same ICU Bed must result in 1 SUCCESS and 1 CONFLICT.
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * 
 * @module platform/healthcare/engines/icu-engine/__tests__
 */

import { SupabaseIcuStayRepository, IcuResourceConflictError } from '../infrastructure/supabase-icu-stay.repository';
import { IcuStay } from '../domain/icu-stay.entity';

describe('ICU Bed Allocation — Concurrency Defense Test', () => {
  const TENANT_ID = 'tenant-icu-concurrency';
  const BED_ID = 'bed-icu-resus-99';
  const WARD_ID = 'ward-icu-cardiac';

  let repository: SupabaseIcuStayRepository;

  beforeEach(() => {
    repository = new SupabaseIcuStayRepository();
  });

  it('should allow 1 success and throw 1 conflict when 2 requests allocate the same ICU bed concurrently', async () => {
    const stay1 = IcuStay.create({
      id: 'icu-stay-concurrent-1',
      tenantId: TENANT_ID,
      encounterId: 'enc-patient-A',
      patientId: 'patient-A',
      bedId: BED_ID,
      wardId: WARD_ID,
    });

    const stay2 = IcuStay.create({
      id: 'icu-stay-concurrent-2',
      tenantId: TENANT_ID,
      encounterId: 'enc-patient-B',
      patientId: 'patient-B',
      bedId: BED_ID,
      wardId: WARD_ID,
    });

    // Execute concurrent allocations via Promise.allSettled
    const results = await Promise.allSettled([
      repository.allocateConditional(stay1),
      repository.allocateConditional(stay2),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedError).toBeInstanceOf(IcuResourceConflictError);
  });
});
