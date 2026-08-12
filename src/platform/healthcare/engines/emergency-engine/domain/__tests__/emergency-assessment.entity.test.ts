import { EmergencyAssessment } from '../emergency-assessment.entity';

describe('EmergencyAssessment Aggregate Root Unit Tests', () => {
  it('should create an initial EmergencyAssessment', () => {
    const assessment = EmergencyAssessment.create({
      id: 'assess-001',
      tenantId: 'tenant-001',
      encounterId: 'enc-001',
      triageId: 'triage-001',
      primarySurvey: {
        airwayPatent: true,
        breathingAdequate: true,
        circulationPulsePresent: true,
        disabilityGcs: 15,
        exposureTemperature: 37.0,
      },
      secondarySurveyNote: 'Clear lungs bilateral, normotensive',
      vitals: {
        heartRate: 75,
        respiratoryRate: 16,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        oxygenSaturation: 98,
        temperatureCelsius: 37.0,
        recordedAt: new Date(),
      },
      assessedBy: 'doc-001',
    });

    expect(assessment.id).toBe('assess-001');
    expect(assessment.status).toBe('INITIAL_IN_PROGRESS');
    expect(assessment.reassessmentNotes.length).toBe(0);
  });

  it('should allow adding rapid reassessment notes', () => {
    const assessment = EmergencyAssessment.create({
      id: 'assess-002',
      tenantId: 'tenant-001',
      encounterId: 'enc-001',
      triageId: 'triage-001',
      primarySurvey: {
        airwayPatent: true,
        breathingAdequate: true,
        circulationPulsePresent: true,
        disabilityGcs: 15,
        exposureTemperature: 37.0,
      },
      secondarySurveyNote: 'Initial evaluation',
      vitals: {
        heartRate: 80,
        respiratoryRate: 18,
        bloodPressureSystolic: 125,
        bloodPressureDiastolic: 82,
        oxygenSaturation: 97,
        temperatureCelsius: 37.1,
        recordedAt: new Date(),
      },
      assessedBy: 'doc-001',
    });

    assessment.completeAssessment();
    expect(assessment.status).toBe('COMPLETED');

    assessment.addRapidReassessment({
      reassessmentId: 'reassess-001',
      clinicianId: 'doc-002',
      findingsNote: 'Patient reports pain improved after analgesia',
      conditionStatus: 'IMPROVED',
    });

    expect(assessment.status).toBe('REASSESSING');
    expect(assessment.reassessmentNotes.length).toBe(1);
    expect(assessment.reassessmentNotes[0].conditionStatus).toBe('IMPROVED');
  });
});
