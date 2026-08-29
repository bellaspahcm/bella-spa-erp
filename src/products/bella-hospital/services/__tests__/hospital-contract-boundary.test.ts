/**
 * BELLA HOSPITAL — CONTRACT BOUNDARY REFACTOR TEST SUITE
 *
 * Verifies that hospital services delegate to verified Kernel Contracts without direct internal DB access.
 *
 * @module src/products/bella-hospital/services/__tests__/hospital-contract-boundary.test
 */

import { randomUUID } from 'crypto';
import { InpatientAdmissionService } from '@/services/healthcare-hospital-services';
import { ClinicalAlertsService } from '@/services/healthcare/clinical-alerts-service';
import { HealthcareTestFixtures } from '@/platform/healthcare/__tests__/fixtures/healthcare-test-fixtures';
import { createClient } from '@/lib/supabase-server';

// Mock getSupabase to return service-role client for tests to bypass RLS
jest.mock('@/lib/supabase-client', () => {
  const original = jest.requireActual('@/lib/supabase-client') as any;
  let serverClient: any = null;
  return {
    ...original,
    getSupabase: jest.fn(() => {
      if (!serverClient) {
        const { createClient } = require('@/lib/supabase-server');
        serverClient = createClient();
      }
      return serverClient;
    })
  };
});

jest.setTimeout(20000);

describe('Bella Hospital Contract Boundary Refactor Tests', () => {
  test('InpatientAdmissionService delegates admission and discharge to Product Service and Kernel Contracts', async () => {
    const fixture = await HealthcareTestFixtures.setup();
    const supabase = await createClient();

    const wardId = randomUUID();
    const roomId = randomUUID();
    const bedId = randomUUID();

    try {
      // Create Patient MPI resolve foreign key check
      const { error: mpiErr } = await supabase.from('hc_master_patient_index').insert({
        id: fixture.patientId,
        tenant_id: fixture.tenantId,
        mrn_code: 'MRN-BOUNDARY-TEST',
        full_name: 'Boundary Test Patient',
        gender: 'other'
      });
      if (mpiErr) throw new Error(`MPI creation failed: ${mpiErr.message}`);

      // Create Ward fixture
      const { error: wardErr } = await supabase.from('hc_wards').insert({
        id: wardId,
        tenant_id: fixture.tenantId,
        code: 'WARD-BOUNDARY-TEST',
        name: 'Boundary Test Ward'
      });
      if (wardErr) throw new Error(`Ward creation failed: ${wardErr.message}`);

      // Create Room fixture
      const { error: roomErr } = await supabase.from('hc_rooms').insert({
        id: roomId,
        tenant_id: fixture.tenantId,
        ward_id: wardId,
        room_number: 'Room-101'
      });
      if (roomErr) throw new Error(`Room creation failed: ${roomErr.message}`);

      const { error: bedErr } = await supabase.from('hc_beds').insert({
        id: bedId,
        tenant_id: fixture.tenantId,
        ward_id: wardId,
        room_id: roomId,
        bed_code: 'BED-BOUNDARY-TEST',
        bed_type: 'standard',
        status: 'available'
      });
      if (bedErr) throw new Error(`Bed creation failed: ${bedErr.message}`);

      const admission = await InpatientAdmissionService.createInpatientAdmission({
        tenantId: fixture.tenantId,
        encounterId: fixture.encounterId,
        patientId: fixture.patientId,
        bedId: bedId,
        wardId: wardId,
        admittingDoctorId: fixture.providerId,
        attendingDoctorId: fixture.providerId,
        admissionDiagnosis: [{ icd10_code: 'I50.9', icd10_name_vi: 'Suy tim', is_primary: true }]
      });

      expect(admission).toBeDefined();
      expect(admission.status).toBe('admitted');

      const discharged = await InpatientAdmissionService.dischargePatient(admission.id, 'Patient fully recovered');
      expect(discharged.status).toBe('discharged');
    } finally {
      // Cleanup custom fixtures in reverse order (FK constraint order)
      await supabase.from('hc_inpatient_admissions').delete().eq('tenant_id', fixture.tenantId);
      await supabase.from('hc_beds').delete().eq('id', bedId);
      await supabase.from('hc_rooms').delete().eq('id', roomId);
      await supabase.from('hc_wards').delete().eq('id', wardId);
      await supabase.from('hc_master_patient_index').delete().eq('id', fixture.patientId);
      await fixture.cleanup();
    }
  });

  test('ClinicalAlertsService delegates order safety check to H8 CDS Contract', async () => {
    const safetyRes = await ClinicalAlertsService.evaluateOrderSafetyWithCds({
      tenantId: '00000000-0000-0000-0000-000000000001',
      encounterId: randomUUID(),
      patientId: randomUUID(),
      clinicianId: randomUUID(),
      medicationCode: 'MED-PARACETAMOL',
      medicationName: 'Paracetamol',
      dosageMg: 500,
      route: 'PO'
    });

    expect(safetyRes.decision).toBe('REQUIRES_OVERRIDE');
    expect(safetyRes.safetyEvaluation).toBeDefined();
  });
});
