import { describe, it, expect } from '@jest/globals';
import { LabOrder } from '../lab-order.entity';
import { TEST_DEFINITIONS } from '../test-definition';
import { randomUUID } from 'crypto';

describe('LabOrder Aggregate Root Invariant Tests', () => {
  const factoryProps = () => ({
    id: randomUUID(),
    tenantId: randomUUID(),
    encounterId: randomUUID(),
    clinicalOrderId: randomUUID(),
    patientId: randomUUID(),
    testCode: 'K',
    testName: 'Potassium',
    status: 'ORDERED' as const,
    safetyState: 'NORMAL' as const,
    version: 1,
  });

  it('should successfully progress through normal state transitions without skipping', () => {
    const order = LabOrder.create(factoryProps());
    expect(order.status).toBe('ORDERED');

    // collect
    order.collectSpecimen('Serum', 'Gold');
    expect(order.status).toBe('COLLECTED');
    expect(order.specimen?.sampleType).toBe('Serum');
    expect(order.specimen?.tubeColor).toBe('Gold');

    // receive
    order.receiveSpecimen();
    expect(order.status).toBe('RECEIVED');

    // process
    order.startProcessing();
    expect(order.status).toBe('PROCESSING');

    // result
    const kDef = TEST_DEFINITIONS['K'];
    order.recordResult('4.2', 'mEq/L', kDef);
    expect(order.status).toBe('RESULTED');
    expect(order.result?.value).toBe('4.2');
    expect(order.result?.isAbnormal).toBe(false);
    expect(order.result?.isPanicValue).toBe(false);

    // verify
    order.verify('tech-123');
    expect(order.status).toBe('VERIFIED');
    expect(order.safetyState).toBe('NORMAL');
    expect(order.version).toBe(6);
  });

  it('should prevent illegal state skips (Gate 1)', () => {
    const order = LabOrder.create(factoryProps());
    
    // Jump straight to receive
    expect(() => order.receiveSpecimen()).toThrow('Invalid state transition');
    
    // Jump straight to verify
    expect(() => order.verify('tech-123')).toThrow('Invalid state transition');
  });

  it('should prevent modifying verified results', () => {
    const order = LabOrder.create(factoryProps());
    order.collectSpecimen('Serum', 'Gold');
    order.receiveSpecimen();
    order.startProcessing();
    order.recordResult('4.2', 'mEq/L', TEST_DEFINITIONS['K']);
    order.verify('tech-123');

    // Re-verify should fail
    expect(() => order.verify('tech-456')).toThrow('Invalid state transition');
  });

  it('should trigger critical safety state and require explicit acknowledgment (Gate 2 & 3)', () => {
    const order = LabOrder.create(factoryProps());
    order.collectSpecimen('Serum', 'Gold');
    order.receiveSpecimen();
    order.startProcessing();

    // Record critical high Potassium value (Potassium > 6.0 is critical)
    order.recordResult('6.5', 'mEq/L', TEST_DEFINITIONS['K']);
    expect(order.result?.assessment).toBe('CRITICAL');
    expect(order.result?.isPanicValue).toBe(true);

    order.verify('tech-123');
    expect(order.status).toBe('VERIFIED');
    expect(order.safetyState).toBe('ESCALATION_REQUIRED');
    expect(order.escalationRequired).toBe(true);

    // Explicit acknowledgment clears escalation required
    order.acknowledgeCritical('doctor-999');
    expect(order.safetyState).toBe('ACKNOWLEDGED');
    expect(order.escalationRequired).toBe(false);
    expect(order.acknowledgedBy).toBe('doctor-999');
    expect(order.acknowledgedAt).toBeDefined();
  });

  it('should evaluate Glucose normal, abnormal, and critical ranges correctly', () => {
    const gluDef = TEST_DEFINITIONS['GLU']; // Normal: 70-100, Critical: <50 or >400

    // 1. Normal
    const orderNormal = LabOrder.create({ ...factoryProps(), testCode: 'GLU', testName: 'Glucose' });
    orderNormal.collectSpecimen('Plasma', 'Gray');
    orderNormal.receiveSpecimen();
    orderNormal.startProcessing();
    orderNormal.recordResult('85', 'mg/dL', gluDef);
    expect(orderNormal.result?.assessment).toBe('NORMAL');

    // 2. Abnormal (High but not critical)
    const orderAbnormal = LabOrder.create({ ...factoryProps(), testCode: 'GLU', testName: 'Glucose' });
    orderAbnormal.collectSpecimen('Plasma', 'Gray');
    orderAbnormal.receiveSpecimen();
    orderAbnormal.startProcessing();
    orderAbnormal.recordResult('120', 'mg/dL', gluDef);
    expect(orderAbnormal.result?.assessment).toBe('ABNORMAL');

    // 3. Critical (Low)
    const orderCritical = LabOrder.create({ ...factoryProps(), testCode: 'GLU', testName: 'Glucose' });
    orderCritical.collectSpecimen('Plasma', 'Gray');
    orderCritical.receiveSpecimen();
    orderCritical.startProcessing();
    orderCritical.recordResult('45', 'mg/dL', gluDef);
    expect(orderCritical.result?.assessment).toBe('CRITICAL');
  });
});
