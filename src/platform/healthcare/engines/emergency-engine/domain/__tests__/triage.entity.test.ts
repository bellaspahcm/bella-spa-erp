import { Triage } from '../triage.entity';

describe('Triage Aggregate Root Unit Tests', () => {
  it('should create a valid Triage record and evaluate acuity', () => {
    const triage = Triage.create({
      id: 'triage-001',
      tenantId: 'tenant-001',
      patientId: 'patient-001',
      chiefComplaint: 'Severe shortness of breath',
      assessmentInput: {
        chiefComplaint: 'Severe shortness of breath',
        isHighRiskSituation: true,
      },
      evaluatedBy: 'nurse-001',
    });

    expect(triage.id).toBe('triage-001');
    expect(triage.status).toBe('COMPLETED');
    expect(triage.acuityResult?.acuityLevel).toBe(2);
    expect(triage.acuityResult?.acuityCategory).toBe('EMERGENT');
    expect(triage.reassessmentCount).toBe(0);
  });

  it('should support linking encounter after triage', () => {
    const triage = Triage.create({
      id: 'triage-002',
      tenantId: 'tenant-001',
      patientId: 'patient-001',
      chiefComplaint: 'Fever and cough',
      assessmentInput: { chiefComplaint: 'Fever and cough', expectedResourceCount: 1 },
      evaluatedBy: 'nurse-001',
    });

    expect(triage.encounterId).toBeNull();
    triage.linkEncounter('enc-123');
    expect(triage.encounterId).toBe('enc-123');
  });

  it('should handle reassessment and escalate status when acuity deteriorates', () => {
    const triage = Triage.create({
      id: 'triage-003',
      tenantId: 'tenant-001',
      patientId: 'patient-001',
      chiefComplaint: 'Abdominal discomfort',
      assessmentInput: { chiefComplaint: 'Abdominal discomfort', expectedResourceCount: 2 },
      evaluatedBy: 'nurse-001',
    });

    expect(triage.status).toBe('COMPLETED');
    expect(triage.acuityResult?.acuityLevel).toBe(3);

    // Patient deteriorates -> requires immediate life saving
    const newResult = triage.reassess(
      {
        chiefComplaint: 'Abdominal discomfort - unresponsive',
        requiresImmediateLifeSaving: true,
      },
      'nurse-002'
    );

    expect(newResult.acuityLevel).toBe(1);
    expect(triage.status).toBe('ESCALATED');
    expect(triage.reassessmentCount).toBe(1);
    expect(triage.evaluatedBy).toBe('nurse-002');
  });
});
