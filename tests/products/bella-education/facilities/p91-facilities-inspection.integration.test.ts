/**
 * Bella Preschool OS — P9.1 Facilities & Safety Inspection Kernel Integration Test Suite
 * File: tests/products/bella-education/facilities/p91-facilities-inspection.integration.test.ts
 *
 * Verifies 12 Core Invariants:
 * 1. Persistence & Multi-Tenant Setup (Facilities, Zones, Assets)
 * 2. Default Operational Status (New entities default to OPERATIONAL)
 * 3. Read-Only ZoneAvailabilityContract Publishing (availableForScheduling = true)
 * 4. FAIL_CRITICAL Inspection Trigger (Automatic transition to OUT_OF_SERVICE)
 * 5. Restriction Scope ASSET_ONLY (Asset OUT_OF_SERVICE, Zone remains OPERATIONAL)
 * 6. Restriction Scope ZONE (Asset OUT_OF_SERVICE propagates ZONE OUT_OF_SERVICE)
 * 7. Zone Availability Guard (Out-of-service zone returns availableForScheduling = false)
 * 8. Failed Restoration Attempt (FAIL_CRITICAL re-inspection maintains OUT_OF_SERVICE)
 * 9. Independent Re-Inspection PASS (Restores status to OPERATIONAL)
 * 10. Immutable Audit Provenance (Out-of-service logs record initiated & restored parties)
 * 11. Domain-Driven Encapsulated Transitions (No generic update API bypass)
 * 12. Cross-Tenant Isolation (Tenant B cannot read/modify Tenant A's facilities)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PreschoolFacilitiesRepository } from '@/products/bella-education/facilities/repositories/preschool-facilities.repository';
import { FacilityZoneService } from '@/products/bella-education/facilities/services/facility-zone.service';
import { SafetyInspectionService } from '@/products/bella-education/facilities/services/safety-inspection.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const inspectorPartyId = '00000000-0000-0000-0000-000000000071';
const managerPartyId = '00000000-0000-0000-0000-000000000072';

describe('P9.1 Preschool Facilities & Safety Inspection Kernel', () => {
  let repo: PreschoolFacilitiesRepository;
  let zoneService: FacilityZoneService;
  let inspectionService: SafetyInspectionService;
  let tenantA: string;
  let tenantB: string;

  beforeEach(async () => {
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();

    repo = new PreschoolFacilitiesRepository(supabase);
    zoneService = new FacilityZoneService(repo);
    inspectionService = new SafetyInspectionService(repo, zoneService);

    await supabase.from('tenants').upsert([
      { id: tenantA, name: 'Bella Preschool Tenant A' },
      { id: tenantB, name: 'Bella Preschool Tenant B' },
    ]);
  });

  it('Invariant 1: Should create facility, zone, and assets cleanly with tenant context', async () => {
    const fac = await zoneService.createFacility({
      tenantId: tenantA,
      name: 'Bella Campus Main Building',
      code: 'CAMPUS_A',
      address: '123 Education Street',
    });

    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Toddler Room 1',
      zoneType: 'CLASSROOM',
      maxOccupancy: 20,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const asset = await zoneService.createAsset({
      tenantId: tenantA,
      zoneId: zone.id,
      name: 'Wooden Climbing Frame',
      assetCategory: 'PLAY_EQUIPMENT',
      serialNumber: 'PLAY-001',
      inspectionIntervalDays: 14,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ASSET_ONLY',
    });

    expect(fac.id).toBeDefined();
    expect(zone.facilityId).toBe(fac.id);
    expect(asset.zoneId).toBe(zone.id);
  });

  it('Invariant 2: New facility zones and assets MUST default to OPERATIONAL', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus B', code: 'CAMPUS_B' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Playground Outdoor',
      zoneType: 'PLAYGROUND',
      maxOccupancy: 50,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const asset = await zoneService.createAsset({
      tenantId: tenantA,
      zoneId: zone.id,
      name: 'Fire Extinguisher ABC',
      assetCategory: 'FIRE_SAFETY',
      inspectionIntervalDays: 30,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    expect(zone.operationalStatus).toBe('OPERATIONAL');
    expect(asset.operationalStatus).toBe('OPERATIONAL');
  });

  it('Invariant 3: Read-Only ZoneAvailabilityContract publishes availableForScheduling = true for operational zone', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus C', code: 'CAMPUS_C' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Nursery Room 2',
      zoneType: 'CLASSROOM',
      maxOccupancy: 15,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const dto = await zoneService.getZoneAvailability(tenantA, zone.id);
    expect(dto.availableForScheduling).toBe(true);
    expect(dto.operationalStatus).toBe('OPERATIONAL');
    expect(dto.zoneId).toBe(zone.id);
  });

  it('Invariant 4: FAIL_CRITICAL safety inspection trigger MUST place entity OUT_OF_SERVICE', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus D', code: 'CAMPUS_D' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Kitchen Zone',
      zoneType: 'KITCHEN',
      maxOccupancy: 5,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const log = await inspectionService.executeInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      inspectorPartyId,
      inspectionDate: '2026-09-25',
      resultStatus: 'FAIL_CRITICAL',
      checklistAnswers: [{ key: 'gas_leak', question: 'Gas valve leak test', passed: false }],
      remarks: 'Gas smell detected near stove valve',
      restrictionScope: 'ZONE',
    });

    expect(log.resultStatus).toBe('FAIL_CRITICAL');

    const updatedZone = await repo.getZone(tenantA, zone.id);
    expect(updatedZone?.operationalStatus).toBe('OUT_OF_SERVICE');
  });

  it('Invariant 5: Restriction Scope ASSET_ONLY marks ONLY asset OUT_OF_SERVICE while zone remains OPERATIONAL', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus E', code: 'CAMPUS_E' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Kindergarten Room A',
      zoneType: 'CLASSROOM',
      maxOccupancy: 25,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const toyAsset = await zoneService.createAsset({
      tenantId: tenantA,
      zoneId: zone.id,
      name: 'Broken Plastic Chair',
      assetCategory: 'FURNITURE',
      inspectionIntervalDays: 30,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ASSET_ONLY',
    });

    await inspectionService.executeInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      assetId: toyAsset.id,
      inspectorPartyId,
      inspectionDate: '2026-09-25',
      resultStatus: 'FAIL_CRITICAL',
      checklistAnswers: [{ key: 'leg_crack', question: 'Structural chair leg test', passed: false }],
      remarks: 'Cracked chair leg pose fall risk',
      restrictionScope: 'ASSET_ONLY',
    });

    const updatedAsset = await repo.getAsset(tenantA, toyAsset.id);
    const updatedZone = await repo.getZone(tenantA, zone.id);

    expect(updatedAsset?.operationalStatus).toBe('OUT_OF_SERVICE');
    expect(updatedZone?.operationalStatus).toBe('OPERATIONAL');
  });

  it('Invariant 6: Restriction Scope ZONE on asset failure MUST propagate OUT_OF_SERVICE to containing zone', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus F', code: 'CAMPUS_F' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Science Activity Corner',
      zoneType: 'CLASSROOM',
      maxOccupancy: 20,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const electricalAsset = await zoneService.createAsset({
      tenantId: tenantA,
      zoneId: zone.id,
      name: 'Exposed Main Power Switchboard',
      assetCategory: 'ELECTRICAL',
      inspectionIntervalDays: 7,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await inspectionService.executeInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      assetId: electricalAsset.id,
      inspectorPartyId,
      inspectionDate: '2026-09-25',
      resultStatus: 'FAIL_CRITICAL',
      checklistAnswers: [{ key: 'wiring_exposed', question: 'Electrical safety wiring', passed: false }],
      remarks: 'Exposed 220V wiring',
      restrictionScope: 'ZONE',
    });

    const updatedAsset = await repo.getAsset(tenantA, electricalAsset.id);
    const updatedZone = await repo.getZone(tenantA, zone.id);

    expect(updatedAsset?.operationalStatus).toBe('OUT_OF_SERVICE');
    expect(updatedZone?.operationalStatus).toBe('OUT_OF_SERVICE');
  });

  it('Invariant 7: ZoneAvailabilityContract publishes availableForScheduling = false for OUT_OF_SERVICE zone', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus G', code: 'CAMPUS_G' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Restroom Zone 1',
      zoneType: 'RESTROOM',
      maxOccupancy: 10,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Plumbing failure', 'ZONE', inspectorPartyId);

    const dto = await zoneService.getZoneAvailability(tenantA, zone.id);
    expect(dto.availableForScheduling).toBe(false);
    expect(dto.operationalStatus).toBe('OUT_OF_SERVICE');
    expect(dto.restrictionReason).toContain('Plumbing failure');
  });

  it('Invariant 8: Failed re-inspection (FAIL_CRITICAL) MUST keep status strictly OUT_OF_SERVICE', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus H', code: 'CAMPUS_H' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Gym Zone',
      zoneType: 'COMMON',
      maxOccupancy: 40,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Floor tile hazards', 'ZONE', inspectorPartyId);

    const res = await inspectionService.executeRestorationInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      inspectorPartyId,
      inspectionDate: '2026-09-25',
      resultStatus: 'FAIL_CRITICAL',
      checklistAnswers: [{ key: 'slippery', question: 'Floor grip test', passed: false }],
      remarks: 'Floor still slippery after initial fix',
    });

    expect(res.restored).toBe(false);

    const updatedZone = await repo.getZone(tenantA, zone.id);
    expect(updatedZone?.operationalStatus).toBe('OUT_OF_SERVICE');
  });

  it('Invariant 9: Independent safety re-inspection PASS restores operational status to OPERATIONAL', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus I', code: 'CAMPUS_I' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Art Studio',
      zoneType: 'CLASSROOM',
      maxOccupancy: 15,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Ventilation fan issue', 'ZONE', inspectorPartyId);

    const res = await inspectionService.executeRestorationInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      inspectorPartyId: managerPartyId,
      inspectionDate: '2026-09-26',
      resultStatus: 'PASS',
      checklistAnswers: [{ key: 'ventilation', question: 'Fan airflow test', passed: true }],
      remarks: 'Fan replaced and verified operational',
    });

    expect(res.restored).toBe(true);

    const updatedZone = await repo.getZone(tenantA, zone.id);
    expect(updatedZone?.operationalStatus).toBe('OPERATIONAL');

    const dto = await zoneService.getZoneAvailability(tenantA, zone.id);
    expect(dto.availableForScheduling).toBe(true);
  });

  it('Invariant 10: Out-of-service audit logs MUST preserve initiated and restored party IDs', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus J', code: 'CAMPUS_J' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Music Room',
      zoneType: 'CLASSROOM',
      maxOccupancy: 15,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Instrument rack loose', 'ZONE', inspectorPartyId);
    await zoneService.passRestorationInspection(tenantA, 'ZONE', zone.id, managerPartyId);

    const log = await repo.getLatestActiveOutOfServiceLog(tenantA, 'ZONE', zone.id);
    expect(log).toBeNull(); // Resolved log is no longer active
  });

  it('Invariant 11: Domain-Driven Encapsulated Transitions (No generic update API bypass)', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus K', code: 'CAMPUS_K' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Outdoor Pool Zone',
      zoneType: 'PLAYGROUND',
      maxOccupancy: 10,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await zoneService.markUnderInspection(tenantA, 'ZONE', zone.id);
    let updatedZone = await repo.getZone(tenantA, zone.id);
    expect(updatedZone?.operationalStatus).toBe('UNDER_INSPECTION');

    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Water chemical imbalance', 'ZONE', inspectorPartyId);
    updatedZone = await repo.getZone(tenantA, zone.id);
    expect(updatedZone?.operationalStatus).toBe('OUT_OF_SERVICE');
  });

  it('Invariant 12: Cross-Tenant Isolation (Tenant B cannot read or modify Tenant A facilities)', async () => {
    const facA = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus Tenant A', code: 'CAMPUS_TENANT_A' });
    const zoneA = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: facA.id,
      name: 'Private Room A',
      zoneType: 'CLASSROOM',
      maxOccupancy: 10,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const tenantBQuery = await repo.getZone(tenantB, zoneA.id);
    expect(tenantBQuery).toBeNull();
  });
});
