import { EsiTriageProtocol } from '../protocols/esi-triage.protocol';

describe('EsiTriageProtocol Unit Tests', () => {
  let protocol: EsiTriageProtocol;

  beforeEach(() => {
    protocol = new EsiTriageProtocol();
  });

  it('should evaluate ESI 1 when immediate life-saving intervention is required', () => {
    const result = protocol.evaluate({
      chiefComplaint: 'Cardiac arrest',
      requiresImmediateLifeSaving: true,
    });

    expect(result.acuityLevel).toBe(1);
    expect(result.acuityCategory).toBe('IMMEDIATE');
    expect(result.targetTimeMinutes).toBe(0);
  });

  it('should evaluate ESI 2 when patient is in high risk situation or severe distress', () => {
    const result = protocol.evaluate({
      chiefComplaint: 'Chest pain with radiation',
      isHighRiskSituation: true,
    });

    expect(result.acuityLevel).toBe(2);
    expect(result.acuityCategory).toBe('EMERGENT');
    expect(result.targetTimeMinutes).toBe(10);
  });

  it('should evaluate ESI 2 when vital signs are in danger zone (e.g. SpO2 < 90%)', () => {
    const result = protocol.evaluate({
      chiefComplaint: 'Shortness of breath',
      vitalSigns: { oxygenSaturation: 88, heartRate: 110 },
    });

    expect(result.acuityLevel).toBe(2);
    expect(result.acuityCategory).toBe('EMERGENT');
  });

  it('should evaluate ESI 3 when 2 or more resources are expected', () => {
    const result = protocol.evaluate({
      chiefComplaint: 'Abdominal pain',
      expectedResourceCount: 2,
    });

    expect(result.acuityLevel).toBe(3);
    expect(result.acuityCategory).toBe('URGENT');
    expect(result.targetTimeMinutes).toBe(30);
  });

  it('should evaluate ESI 4 when 1 resource is expected', () => {
    const result = protocol.evaluate({
      chiefComplaint: 'Ankle sprain',
      expectedResourceCount: 1,
    });

    expect(result.acuityLevel).toBe(4);
    expect(result.acuityCategory).toBe('LESS_URGENT');
    expect(result.targetTimeMinutes).toBe(60);
  });

  it('should evaluate ESI 5 when 0 resources are expected', () => {
    const result = protocol.evaluate({
      chiefComplaint: 'Medication refill request',
      expectedResourceCount: 0,
    });

    expect(result.acuityLevel).toBe(5);
    expect(result.acuityCategory).toBe('NON_URGENT');
    expect(result.targetTimeMinutes).toBe(120);
  });
});
