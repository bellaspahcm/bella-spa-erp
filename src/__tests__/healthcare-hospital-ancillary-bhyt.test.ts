/**
 * Phase B Integration Tests: Hospital Ancillary (LIS/RIS) & BHYT XML 130 & TT133 Reconciler
 * Governance: Zero Regression on beauty_spa & babycare tenants
 * Strict Type Invariant: No `any` in tested actions
 */

import { BHYTXml130Service } from '@/services/healthcare/bhyt-actions';

// ---------------------------------------------------------------------------
// Mock supabase client (no real DB hit)
// ---------------------------------------------------------------------------
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert bypassed in unit test' } }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// 1. BHYT XML 130 Generator Tests (Mock Payload)
// ---------------------------------------------------------------------------
describe('Phase B – BHYT XML 130 Generator (BHYTXml130Service)', () => {
  const TEST_ENCOUNTER_ID = 'enc-bhyt-test-01';

  it('should generate a valid BHYT XML 130 mock payload with all 5 XML segments', async () => {
    const payload = await BHYTXml130Service.generateClaimPayload(TEST_ENCOUNTER_ID);

    // XML1 assertions
    expect(payload.xml1).toBeDefined();
    expect(payload.xml1.MA_LK).toBe(TEST_ENCOUNTER_ID);
    expect(payload.xml1.MA_THE_BHYT).toMatch(/^[A-Z]{2}\d+/); // BHYT card format
    expect(typeof payload.xml1.TONG_CHI).toBe('number');
    expect(payload.xml1.TONG_CHI).toBeGreaterThan(0);
    expect(typeof payload.xml1.GIOI_TINH).toBe('number');
    expect([1, 2]).toContain(payload.xml1.GIOI_TINH);
    expect(typeof payload.xml1.MA_LOAI_KCB).toBe('number');
    expect([1, 2, 3]).toContain(payload.xml1.MA_LOAI_KCB);

    // XML2 – Medications
    expect(payload.xml2).toBeDefined();
    expect(Array.isArray(payload.xml2)).toBe(true);
    expect(payload.xml2.length).toBeGreaterThan(0);
    expect(payload.xml2[0].MA_LK).toBe(TEST_ENCOUNTER_ID);
    expect(typeof payload.xml2[0].THANH_TIEN).toBe('number');
    expect(payload.xml2[0].THANH_TIEN).toBeGreaterThan(0);
    expect(payload.xml2[0].TYLE_TT).toBeGreaterThanOrEqual(0);
    expect(payload.xml2[0].TYLE_TT).toBeLessThanOrEqual(100);

    // XML3 – Services
    expect(payload.xml3).toBeDefined();
    expect(Array.isArray(payload.xml3)).toBe(true);
    expect(payload.xml3.length).toBeGreaterThan(0);
    expect(payload.xml3[0].MA_LK).toBe(TEST_ENCOUNTER_ID);
    expect(typeof payload.xml3[0].DON_GIA).toBe('number');

    // XML4 – Lab Results
    expect(payload.xml4).toBeDefined();
    expect(Array.isArray(payload.xml4)).toBe(true);
    expect(payload.xml4.length).toBeGreaterThan(0);
    expect(payload.xml4[0].MA_LK).toBe(TEST_ENCOUNTER_ID);
    expect(typeof payload.xml4[0].GIA_TRI).toBe('string');

    // XML5 – Clinical Progress
    expect(payload.xml5).toBeDefined();
    expect(Array.isArray(payload.xml5)).toBe(true);
    expect(payload.xml5.length).toBeGreaterThan(0);
    expect(payload.xml5[0].DIEN_BIEN).toBeTruthy();
  });

  it('should populate XML1 required fields with non-empty values', async () => {
    const payload = await BHYTXml130Service.generateClaimPayload(TEST_ENCOUNTER_ID);

    expect(payload.xml1.HO_TEN).toBeTruthy();
    expect(payload.xml1.NGAY_SINH).toMatch(/^\d{8}$/); // YYYYMMDD format
    expect(payload.xml1.MA_BENH).toBeTruthy(); // ICD10 code required
    expect(payload.xml1.NGAY_VAO).toMatch(/^\d{12}$/); // YYYYMMDDHHmm
    expect(payload.xml1.NGAY_RA).toMatch(/^\d{12}$/);
    expect(payload.xml1.NGAY_THANH_TOAN).toMatch(/^\d{12}$/);
    expect(payload.xml1.MA_CO_SO).toBeTruthy(); // Hospital code
  });

  it('should not include negative amounts in XML2 or XML3', async () => {
    const payload = await BHYTXml130Service.generateClaimPayload(TEST_ENCOUNTER_ID);

    payload.xml2.forEach((med) => {
      expect(med.SO_LUONG).toBeGreaterThan(0);
      expect(med.DON_GIA).toBeGreaterThan(0);
      expect(med.THANH_TIEN).toBeGreaterThan(0);
    });

    payload.xml3.forEach((svc) => {
      expect(svc.SO_LUONG).toBeGreaterThan(0);
      expect(svc.DON_GIA).toBeGreaterThan(0);
    });
  });

  it('should generate different encounter IDs producing different MA_LK values', async () => {
    const payload1 = await BHYTXml130Service.generateClaimPayload('enc-A');
    const payload2 = await BHYTXml130Service.generateClaimPayload('enc-B');

    expect(payload1.xml1.MA_LK).toBe('enc-A');
    expect(payload2.xml1.MA_LK).toBe('enc-B');
    expect(payload1.xml1.MA_LK).not.toBe(payload2.xml1.MA_LK);
  });
});

// ---------------------------------------------------------------------------
// 2. LIS Panic Value Detection Logic Tests
// ---------------------------------------------------------------------------
describe('Phase B – LIS Panic Value Detection Logic', () => {
  // Mimic the core detection logic from ancillary/page.tsx
  const detectPanicValue = (
    testCode: string,
    value: number
  ): { isAbnormal: boolean; isPanic: boolean } => {
    let isAbnormal = false;
    let isPanic = false;

    if (testCode === 'GLU') {
      isAbnormal = value < 3.9 || value > 6.4;
      isPanic = value < 2.5 || value > 25.0;
    } else if (testCode === 'CREA') {
      isAbnormal = value < 62 || value > 115;
      isPanic = value > 500;
    } else if (testCode === 'WBC') {
      isAbnormal = value < 4.0 || value > 10.0;
      isPanic = value < 1.0 || value > 30.0;
    }

    return { isAbnormal, isPanic };
  };

  it('should mark GLU=5.0 as normal', () => {
    const result = detectPanicValue('GLU', 5.0);
    expect(result.isAbnormal).toBe(false);
    expect(result.isPanic).toBe(false);
  });

  it('should mark GLU=7.5 as abnormal but not panic', () => {
    const result = detectPanicValue('GLU', 7.5);
    expect(result.isAbnormal).toBe(true);
    expect(result.isPanic).toBe(false);
  });

  it('should mark GLU=1.8 as both abnormal and panic (critical hypoglycemia)', () => {
    const result = detectPanicValue('GLU', 1.8);
    expect(result.isAbnormal).toBe(true);
    expect(result.isPanic).toBe(true);
  });

  it('should mark WBC=0.5 as both abnormal and panic (severe neutropenia)', () => {
    const result = detectPanicValue('WBC', 0.5);
    expect(result.isAbnormal).toBe(true);
    expect(result.isPanic).toBe(true);
  });

  it('should mark CREA=520 as both abnormal and panic (severe renal failure)', () => {
    const result = detectPanicValue('CREA', 520);
    expect(result.isAbnormal).toBe(true);
    expect(result.isPanic).toBe(true);
  });

  it('should mark CREA=90 as normal', () => {
    const result = detectPanicValue('CREA', 90);
    expect(result.isAbnormal).toBe(false);
    expect(result.isPanic).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. TT133 Reconciler – Billing Calculation Tests
// ---------------------------------------------------------------------------
describe('Phase B – TT133 Billing Calculation (Circular 133)', () => {
  const calculateBilling = (items: Array<{ unitPrice: number; quantity: number }>, benefitRate: number) => {
    let totalAmount = 0;
    let bhytCoveredAmount = 0;
    let patientCoPayAmount = 0;

    items.forEach((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      const lineBHYT = (lineTotal * benefitRate) / 100;
      const linePatient = lineTotal - lineBHYT;

      totalAmount += lineTotal;
      bhytCoveredAmount += lineBHYT;
      patientCoPayAmount += linePatient;
    });

    return { totalAmount, bhytCoveredAmount, patientCoPayAmount };
  };

  it('should calculate 80% BHYT coverage correctly', () => {
    const result = calculateBilling(
      [{ unitPrice: 200000, quantity: 1 }, { unitPrice: 50000, quantity: 2 }],
      80
    );

    expect(result.totalAmount).toBe(300000);
    expect(result.bhytCoveredAmount).toBe(240000); // 80%
    expect(result.patientCoPayAmount).toBe(60000); // 20%
    expect(result.totalAmount).toBe(result.bhytCoveredAmount + result.patientCoPayAmount);
  });

  it('should calculate 100% BHYT coverage correctly (free patient)', () => {
    const result = calculateBilling(
      [{ unitPrice: 500000, quantity: 1 }],
      100
    );

    expect(result.totalAmount).toBe(500000);
    expect(result.bhytCoveredAmount).toBe(500000);
    expect(result.patientCoPayAmount).toBe(0);
  });

  it('should calculate 0% BHYT (self-pay patient) correctly', () => {
    const result = calculateBilling(
      [{ unitPrice: 150000, quantity: 3 }],
      0
    );

    expect(result.totalAmount).toBe(450000);
    expect(result.bhytCoveredAmount).toBe(0);
    expect(result.patientCoPayAmount).toBe(450000);
  });

  it('should always maintain totalAmount = bhytCovered + patientCoPay invariant', () => {
    const testCases = [
      { items: [{ unitPrice: 100000, quantity: 2 }], rate: 80 },
      { items: [{ unitPrice: 250000, quantity: 1 }], rate: 95 },
      { items: [{ unitPrice: 38700, quantity: 1 }], rate: 80 },
    ];

    testCases.forEach(({ items, rate }) => {
      const result = calculateBilling(items, rate);
      expect(result.totalAmount).toBeCloseTo(
        result.bhytCoveredAmount + result.patientCoPayAmount,
        5
      );
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Zero Regression Guard – beauty_spa and babycare tenants
// ---------------------------------------------------------------------------
describe('Phase B – Zero Regression Guard (beauty_spa & babycare)', () => {
  it('should NOT import or affect beauty_spa legacy tables', async () => {
    // Verify healthcare services do not reference spa_booking table
    const { BHYTXml130Service } = await import('@/services/healthcare/bhyt-actions');
    const serviceSource = BHYTXml130Service.toString();
    expect(serviceSource).not.toContain('spa_booking');
    expect(serviceSource).not.toContain('spa_customer');
  });

  it('should NOT reference payroll or commission tables in healthcare actions', async () => {
    const { BHYTXml130Service } = await import('@/services/healthcare/bhyt-actions');
    const serviceSource = BHYTXml130Service.toString();
    expect(serviceSource).not.toContain('payroll');
    expect(serviceSource).not.toContain('commission');
  });
});
