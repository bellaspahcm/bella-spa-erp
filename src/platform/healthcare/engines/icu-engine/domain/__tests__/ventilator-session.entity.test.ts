/**
 * VentilatorSession Entity & Safety Barrier Tier 1 Unit Test
 * 
 * Constitution Compliance:
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Safety Validation: Verifies safety policy boundaries and hard-blocks
 * 
 * @module platform/healthcare/engines/icu-engine/domain/__tests__
 */

import { VentilatorSession, VentilatorSafetyViolationError } from '../ventilator-session.entity';

describe('VentilatorSession — Tier 1 Safety Barrier Unit Tests', () => {
  const ICU_STAY_ID = 'icu-stay-test-101';

  it('should create valid ventilator session when settings within safety limits', () => {
    const session = VentilatorSession.create({
      id: 'vent-001',
      icuStayId: ICU_STAY_ID,
      mode: 'AC',
      settings: {
        fio2: 50,
        peep: 8,
        tidalVolume: 450,
        respiratoryRate: 16,
        pressureSupport: 10,
      },
    });

    expect(session.id).toBe('vent-001');
    expect(session.status).toBe('ACTIVE');
    expect(session.settings.fio2).toBe(50);
  });

  it('should HARD BLOCK ventilator session creation if FiO2 exceeds safety maximum (>100%)', () => {
    expect(() => {
      VentilatorSession.create({
        id: 'vent-002',
        icuStayId: ICU_STAY_ID,
        mode: 'SIMV',
        settings: {
          fio2: 120, // Exceeds 100%
          peep: 10,
          tidalVolume: 500,
          respiratoryRate: 18,
          pressureSupport: 12,
        },
      });
    }).toThrow(VentilatorSafetyViolationError);
  });

  it('should HARD BLOCK ventilator session creation if PEEP exceeds safety limit (>25)', () => {
    expect(() => {
      VentilatorSession.create({
        id: 'vent-003',
        icuStayId: ICU_STAY_ID,
        mode: 'CPAP',
        settings: {
          fio2: 60,
          peep: 35, // Exceeds max 25
          tidalVolume: 400,
          respiratoryRate: 14,
          pressureSupport: 5,
        },
      });
    }).toThrow(VentilatorSafetyViolationError);
  });

  it('should allow updating settings to valid values', () => {
    const session = VentilatorSession.create({
      id: 'vent-004',
      icuStayId: ICU_STAY_ID,
      mode: 'AC',
      settings: { fio2: 40, peep: 5, tidalVolume: 420, respiratoryRate: 14, pressureSupport: 8 },
    });

    session.updateSettings({ fio2: 45, peep: 6, tidalVolume: 440, respiratoryRate: 14, pressureSupport: 8 });
    expect(session.settings.fio2).toBe(45);
  });

  it('should discontinue ventilator session and record end time', () => {
    const session = VentilatorSession.create({
      id: 'vent-005',
      icuStayId: ICU_STAY_ID,
      mode: 'PSV',
      settings: { fio2: 30, peep: 5, tidalVolume: 380, respiratoryRate: 12, pressureSupport: 5 },
    });

    session.discontinue();
    expect(session.status).toBe('DISCONTINUED');
    expect(session.endedAt).toBeDefined();
  });
});
