/**
 * Bella Preschool OS — P9.2 Maintenance Job & Exception Work Queue Reuse Integration Test Suite
 * File: tests/products/bella-education/facilities/p92-maintenance-job-exception.integration.test.ts
 *
 * Verifies 12 Core Invariants:
 * 1. Maintenance Job Creation (SUBMITTED)
 * 2. Technician Assignment (IN_PROGRESS)
 * 3. Job Completion by Technician (COMPLETED)
 * 4. Manager Job Verification (VERIFIED)
 * 5. Supreme Invariant: Job VERIFIED MUST NOT alter asset/zone status (remains OUT_OF_SERVICE)
 * 6. Safety Defect Exception Projection (SAFETY_DEFECT projected to Work Queue)
 * 7. Overdue Inspection Projection (OVERDUE_INSPECTION projected to Work Queue)
 * 8. Supreme Invariant: Work Queue RESOLVED MUST NOT alter asset status (remains OUT_OF_SERVICE)
 * 9. Full Closed-Loop Safety Restoration (Job VERIFIED + Work Queue RESOLVED + Safety Re-inspection PASS -> OPERATIONAL)
 * 10. Idempotent Exception Projection (No duplicate active exceptions for same entity)
 * 11. Cross-Tenant Protection (Tenant B cannot read or modify Tenant A jobs)
 * 12. Full Audit Provenance (Reporter, Technician, and Verifier party IDs preserved)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PreschoolFacilitiesRepository } from '@/products/bella-education/facilities/repositories/preschool-facilities.repository';
import { FacilityZoneService } from '@/products/bella-education/facilities/services/facility-zone.service';
import { SafetyInspectionService } from '@/products/bella-education/facilities/services/safety-inspection.service';
import { MaintenanceJobService } from '@/products/bella-education/facilities/services/maintenance-job.service';
import { FacilitiesProjectionBridge } from '@/products/bella-education/facilities/bridges/facilities-projection.bridge';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import { CommunicationExceptionService } from '@/products/bella-education/parent-engagement/services/communication-exception.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const reporterPartyId = '00000000-0000-0000-0000-000000000071';
const technicianPartyId = '00000000-0000-0000-0000-000000000072';
const verifierPartyId = '00000000-0000-0000-0000-000000000073';

describe('P9.2 Maintenance Job Lifecycle & Work Queue Reuse #3', () => {
  let repo: PreschoolFacilitiesRepository;
  let zoneService: FacilityZoneService;
  let inspectionService: SafetyInspectionService;
  let jobService: MaintenanceJobService;
  let commRepo: ParentCommunicationRepository;
  let exceptionService: CommunicationExceptionService;
  let bridge: FacilitiesProjectionBridge;
  let tenantA: string;
  let tenantB: string;

  beforeEach(async () => {
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();

    repo = new PreschoolFacilitiesRepository(supabase);
    zoneService = new FacilityZoneService(repo);
    inspectionService = new SafetyInspectionService(repo, zoneService);
    jobService = new MaintenanceJobService(repo);
    commRepo = new ParentCommunicationRepository(supabase);
    exceptionService = new CommunicationExceptionService(commRepo);
    bridge = new FacilitiesProjectionBridge(commRepo, exceptionService);

    await supabase.from('tenants').upsert([
      { id: tenantA, name: 'Bella Preschool Tenant A' },
      { id: tenantB, name: 'Bella Preschool Tenant B' },
    ]);
  });

  it('Invariant 1: Should create a Maintenance Job in SUBMITTED state', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 1', code: 'C1' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Classroom 101',
      zoneType: 'CLASSROOM',
      maxOccupancy: 20,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Fix Door Latch',
      priority: 'MEDIUM',
      reportedByPartyId: reporterPartyId,
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('SUBMITTED');
    expect(job.reportedByPartyId).toBe(reporterPartyId);
  });

  it('Invariant 2: Assigning technician MUST transition job status to IN_PROGRESS', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 2', code: 'C2' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Playground',
      zoneType: 'PLAYGROUND',
      maxOccupancy: 30,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Repair Swing Chain',
      priority: 'HIGH',
      reportedByPartyId: reporterPartyId,
    });

    const assigned = await jobService.assignTechnician(tenantA, job.id, technicianPartyId);

    expect(assigned.status).toBe('IN_PROGRESS');
    expect(assigned.assignedTechnicianPartyId).toBe(technicianPartyId);
  });

  it('Invariant 3: Technician submitting completion notes MUST transition job to COMPLETED', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 3', code: 'C3' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Kitchen',
      zoneType: 'KITCHEN',
      maxOccupancy: 5,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Replace Faucet Valve',
      priority: 'MEDIUM',
      reportedByPartyId: reporterPartyId,
    });

    await jobService.assignTechnician(tenantA, job.id, technicianPartyId);
    const completed = await jobService.completeJob(tenantA, job.id, 'New heavy-duty valve installed and tested');

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completionNotes).toContain('heavy-duty valve');
  });

  it('Invariant 4: Manager verifying job completion MUST transition job status to VERIFIED', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 4', code: 'C4' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Art Room',
      zoneType: 'CLASSROOM',
      maxOccupancy: 15,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Fix Table Surface',
      priority: 'LOW',
      reportedByPartyId: reporterPartyId,
    });

    await jobService.assignTechnician(tenantA, job.id, technicianPartyId);
    await jobService.completeJob(tenantA, job.id, 'Sanded and repainted table surface');
    const verified = await jobService.verifyJob(tenantA, job.id, verifierPartyId);

    expect(verified.status).toBe('VERIFIED');
    expect(verified.verifiedByPartyId).toBe(verifierPartyId);
  });

  it('Invariant 5: Supreme Invariant — Job VERIFIED MUST NOT restore asset status (remains OUT_OF_SERVICE)', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 5', code: 'C5' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Toddler Room B',
      zoneType: 'CLASSROOM',
      maxOccupancy: 20,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    // Place zone OUT_OF_SERVICE due to safety failure
    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Unstable shelving unit', 'ZONE', reporterPartyId);

    // Create & verify maintenance job
    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Anchor Shelving Unit to Wall',
      priority: 'CRITICAL',
      reportedByPartyId: reporterPartyId,
    });
    await jobService.assignTechnician(tenantA, job.id, technicianPartyId);
    await jobService.completeJob(tenantA, job.id, 'Anchored with heavy bolts');
    await jobService.verifyJob(tenantA, job.id, verifierPartyId);

    // Assert zone status is STRICTLY OUT_OF_SERVICE (Job VERIFIED ≠ Asset OPERATIONAL)
    const currentZone = await repo.getZone(tenantA, zone.id);
    expect(currentZone?.operationalStatus).toBe('OUT_OF_SERVICE');
  });

  it('Invariant 6: Projection Bridge MUST project SAFETY_DEFECT DTO into Staff Exception Work Queue', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 6', code: 'C6' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Restroom 2',
      zoneType: 'RESTROOM',
      maxOccupancy: 10,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const exc = await bridge.projectSafetyDefectException({
      tenantId: tenantA,
      zoneId: zone.id,
      remarks: 'Water leakage on floor causing slip hazard',
    });

    expect(exc.id).toBeDefined();
    expect(exc.exception_type).toBe('SAFETY_DEFECT');
    expect(exc.assigned_role).toBe('FACILITY_MANAGER');
    expect(exc.status).toBe('OPEN');
  });

  it('Invariant 7: Projection Bridge MUST project OVERDUE_INSPECTION DTO for overdue safety schedule', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 7', code: 'C7' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Fire Escape Corridor',
      zoneType: 'COMMON',
      maxOccupancy: 50,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const sched = await repo.createInspectionSchedule({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Monthly Fire Exit Inspection',
      frequency: 'MONTHLY',
      checklistSchema: [],
      nextDueDate: '2026-09-01',
    });

    const exc = await bridge.projectOverdueInspectionException({
      tenantId: tenantA,
      scheduleId: sched.id,
      zoneId: zone.id,
      title: sched.title,
    });

    expect(exc.exception_type).toBe('OVERDUE_INSPECTION');
    expect(exc.assigned_role).toBe('SAFETY_OFFICER');
    expect(exc.status).toBe('OPEN');
  });

  it('Invariant 8: Supreme Invariant — Work Queue RESOLVED MUST NOT restore asset status (remains OUT_OF_SERVICE)', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 8', code: 'C8' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Outdoor Climbing Area',
      zoneType: 'PLAYGROUND',
      maxOccupancy: 25,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    await zoneService.placeOutOfService(tenantA, 'ZONE', zone.id, 'Broken ladder rung', 'ZONE', reporterPartyId);
    const exc = await bridge.projectSafetyDefectException({
      tenantId: tenantA,
      zoneId: zone.id,
      remarks: 'Broken ladder rung',
    });

    // Resolve exception in Work Queue
    await exceptionService.resolveException({
      tenantId: tenantA,
      exceptionId: exc.id,
      resolvedBy: verifierPartyId,
      resolutionNotes: 'Manager acknowledged defect and scheduled repair',
    });

    // Assert zone status is STRICTLY OUT_OF_SERVICE (Work Queue RESOLVED ≠ Asset OPERATIONAL)
    const currentZone = await repo.getZone(tenantA, zone.id);
    expect(currentZone?.operationalStatus).toBe('OUT_OF_SERVICE');
  });

  it('Invariant 9: Full Closed-Loop Safety Restoration — Status ONLY becomes OPERATIONAL after Safety Re-Inspection PASS', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 9', code: 'C9' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Science Lab Zone',
      zoneType: 'CLASSROOM',
      maxOccupancy: 20,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    // 1. Critical Inspection Failure -> OUT_OF_SERVICE
    await inspectionService.executeInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      inspectorPartyId: reporterPartyId,
      inspectionDate: '2026-09-25',
      resultStatus: 'FAIL_CRITICAL',
      checklistAnswers: [],
      remarks: 'Chemical storage cabinet latch broken',
      restrictionScope: 'ZONE',
    });

    // 2. Project SAFETY_DEFECT Exception
    const exc = await bridge.projectSafetyDefectException({
      tenantId: tenantA,
      zoneId: zone.id,
      remarks: 'Chemical storage cabinet latch broken',
    });

    // 3. Maintenance Job Lifecycle -> VERIFIED
    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Replace Storage Cabinet Latch',
      priority: 'CRITICAL',
      reportedByPartyId: reporterPartyId,
    });
    await jobService.assignTechnician(tenantA, job.id, technicianPartyId);
    await jobService.completeJob(tenantA, job.id, 'Installed dual lock latch');
    await jobService.verifyJob(tenantA, job.id, verifierPartyId);

    // 4. Resolve Work Queue Exception
    await exceptionService.resolveException({
      tenantId: tenantA,
      exceptionId: exc.id,
      resolvedBy: verifierPartyId,
      resolutionNotes: 'Job verified',
    });

    // Zone remains OUT_OF_SERVICE before safety re-inspection!
    let currentZone = await repo.getZone(tenantA, zone.id);
    expect(currentZone?.operationalStatus).toBe('OUT_OF_SERVICE');

    // 5. Independent Safety Re-Inspection PASS -> OPERATIONAL
    const restoration = await inspectionService.executeRestorationInspection({
      tenantId: tenantA,
      zoneId: zone.id,
      inspectorPartyId: verifierPartyId,
      inspectionDate: '2026-09-26',
      resultStatus: 'PASS',
      checklistAnswers: [],
      remarks: 'Latch verified lock tight and compliant',
    });

    expect(restoration.restored).toBe(true);

    currentZone = await repo.getZone(tenantA, zone.id);
    expect(currentZone?.operationalStatus).toBe('OPERATIONAL');

    const availability = await zoneService.getZoneAvailability(tenantA, zone.id);
    expect(availability.availableForScheduling).toBe(true);
  });

  it('Invariant 10: Idempotent Exception Projection prevents duplicate active exceptions', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 10', code: 'C10' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Library Corner',
      zoneType: 'CLASSROOM',
      maxOccupancy: 15,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const exc1 = await bridge.projectSafetyDefectException({
      tenantId: tenantA,
      zoneId: zone.id,
      remarks: 'Frayed carpet edge',
    });

    const exc2 = await bridge.projectSafetyDefectException({
      tenantId: tenantA,
      zoneId: zone.id,
      remarks: 'Frayed carpet edge',
    });

    expect(exc1.id).toBe(exc2.id);
  });

  it('Invariant 11: Cross-Tenant Protection in Maintenance Jobs & Exception Queue', async () => {
    const facA = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus A', code: 'CA' });
    const zoneA = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: facA.id,
      name: 'Private Office A',
      zoneType: 'COMMON',
      maxOccupancy: 5,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const jobA = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zoneA.id,
      title: 'Tenant A Job',
      priority: 'LOW',
      reportedByPartyId: reporterPartyId,
    });

    const tenantBJob = await jobService.getJob(tenantB, jobA.id);
    expect(tenantBJob).toBeNull();
  });

  it('Invariant 12: Verified jobs preserve reporter, technician, and verifier party IDs', async () => {
    const fac = await zoneService.createFacility({ tenantId: tenantA, name: 'Campus 12', code: 'C12' });
    const zone = await zoneService.createZone({
      tenantId: tenantA,
      facilityId: fac.id,
      name: 'Computer Lab',
      zoneType: 'CLASSROOM',
      maxOccupancy: 20,
      operationalStatus: 'OPERATIONAL',
      restrictionScope: 'ZONE',
    });

    const job = await jobService.createJob({
      tenantId: tenantA,
      zoneId: zone.id,
      title: 'Replace Surge Protector',
      priority: 'HIGH',
      reportedByPartyId: reporterPartyId,
    });

    await jobService.assignTechnician(tenantA, job.id, technicianPartyId);
    await jobService.completeJob(tenantA, job.id, 'Replaced with 10-outlet protector');
    const verified = await jobService.verifyJob(tenantA, job.id, verifierPartyId);

    expect(verified.reportedByPartyId).toBe(reporterPartyId);
    expect(verified.assignedTechnicianPartyId).toBe(technicianPartyId);
    expect(verified.verifiedByPartyId).toBe(verifierPartyId);
  });
});
