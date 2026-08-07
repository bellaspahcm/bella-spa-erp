/**
 * Event Bus Integration Tests
 * Test end-to-end event flows across engines
 * 
 * NOTE: These are conceptual tests. In production:
 * - wireBedToBilling would call BillingEngine.createCharge()
 * - wireMedicationToTimeline would call TimelineEngine.recordEvent()
 * - wireVitalsToAIAlerts would call AIEngine.analyzeVitals()
 */

import { eventBus } from '../event-bus.service';
import { MemoryEventBusAdapter } from '../memory-adapter';

describe('Event Bus Integration Tests', () => {
  let adapter: MemoryEventBusAdapter;

  beforeEach(() => {
    adapter = new MemoryEventBusAdapter();
    eventBus.setAdapter(adapter);
  });

  afterEach(() => {
    adapter.clear();
  });

  describe('Event Publishing', () => {
    it('should publish BedAllocated event successfully', async () => {
      await eventBus.publish({
        eventType: 'BedAllocated',
        tenantId: 'tenant-1',
        aggregateId: 'bed-1',
        aggregateType: 'Bed',
        payload: {
          bedId: 'bed-1',
          bedCode: 'A-101',
          bedType: 'standard',
          wardId: 'ward-1',
          patientId: 'patient-1',
          admissionId: 'admission-1',
          encounterId: 'encounter-1',
          allocatedAt: '2024-01-01T10:00:00Z',
          dailyRate: 150000,
        },
        userId: 'user-1',
      });

      const eventLog = adapter.getEventLog();
      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].eventType).toBe('BedAllocated');
      expect(eventLog[0].payload.bedId).toBe('bed-1');
      expect(eventLog[0].payload.patientId).toBe('patient-1');
    });

    it('should publish MedicationAdministered event successfully', async () => {
      await eventBus.publish({
        eventType: 'MedicationAdministered',
        tenantId: 'tenant-1',
        aggregateId: 'mar-1',
        aggregateType: 'MedicationAdministration',
        payload: {
          marId: 'mar-1',
          orderId: 'order-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          medicationName: 'Paracetamol',
          dose: '500mg',
          route: 'oral',
          administeredBy: 'nurse-1',
          administeredAt: '2024-01-01T10:00:00Z',
          notes: 'No adverse reactions',
        },
        userId: 'nurse-1',
      });

      const eventLog = adapter.getEventLog();
      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].eventType).toBe('MedicationAdministered');
      expect(eventLog[0].payload.medicationName).toBe('Paracetamol');
    });

    it('should publish VitalsRecorded event successfully', async () => {
      await eventBus.publish({
        eventType: 'VitalsRecorded',
        tenantId: 'tenant-1',
        aggregateId: 'vitals-1',
        aggregateType: 'VitalSigns',
        payload: {
          vitalsId: 'vitals-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          recordedBy: 'nurse-1',
          recordedAt: '2024-01-01T10:00:00Z',
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 75,
          temperature: 37.0,
          respiratoryRate: 16,
          oxygenSaturation: 98,
        },
        userId: 'nurse-1',
      });

      const eventLog = adapter.getEventLog();
      expect(eventLog).toHaveLength(1);
      expect(eventLog[0].eventType).toBe('VitalsRecorded');
      expect(eventLog[0].payload.bloodPressureSystolic).toBe(120);
    });
  });

  describe('Event Subscription', () => {
    it('should handle multiple subscribers to same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const unsub1 = eventBus.subscribe('BedAllocated', handler1);
      const unsub2 = eventBus.subscribe('BedAllocated', handler2);

      await eventBus.publish({
        eventType: 'BedAllocated',
        tenantId: 'tenant-1',
        aggregateId: 'bed-1',
        aggregateType: 'Bed',
        payload: {
          bedId: 'bed-1',
          bedCode: 'A-101',
          bedType: 'standard',
          wardId: 'ward-1',
          patientId: 'patient-1',
          admissionId: 'admission-1',
          encounterId: 'encounter-1',
          allocatedAt: '2024-01-01T10:00:00Z',
          dailyRate: 150000,
        },
        userId: 'user-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it('should unsubscribe correctly', async () => {
      const handler = jest.fn();
      const unsub = eventBus.subscribe('BedAllocated', handler);

      // Publish before unsubscribe
      await eventBus.publish({
        eventType: 'BedAllocated',
        tenantId: 'tenant-1',
        aggregateId: 'bed-1',
        aggregateType: 'Bed',
        payload: {
          bedId: 'bed-1',
          bedCode: 'A-101',
          bedType: 'standard',
          wardId: 'ward-1',
          patientId: 'patient-1',
          admissionId: 'admission-1',
          encounterId: 'encounter-1',
          allocatedAt: '2024-01-01T10:00:00Z',
          dailyRate: 150000,
        },
        userId: 'user-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub();

      // Publish after unsubscribe
      await eventBus.publish({
        eventType: 'BedAllocated',
        tenantId: 'tenant-1',
        aggregateId: 'bed-2',
        aggregateType: 'Bed',
        payload: {
          bedId: 'bed-2',
          bedCode: 'A-102',
          bedType: 'standard',
          wardId: 'ward-1',
          patientId: 'patient-2',
          admissionId: 'admission-2',
          encounterId: 'encounter-2',
          allocatedAt: '2024-01-01T11:00:00Z',
          dailyRate: 150000,
        },
        userId: 'user-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should still be 1 (not 2)
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass correct event data to subscribers', async () => {
      let receivedEvent: any = null;

      const unsub = eventBus.subscribe('VitalsRecorded', (event) => {
        receivedEvent = event;
      });

      const publishedEvent = {
        eventType: 'VitalsRecorded' as const,
        tenantId: 'tenant-1',
        aggregateId: 'vitals-1',
        aggregateType: 'VitalSigns' as const,
        payload: {
          vitalsId: 'vitals-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          recordedBy: 'nurse-1',
          recordedAt: '2024-01-01T10:00:00Z',
          bloodPressureSystolic: 210,
          bloodPressureDiastolic: 130,
          heartRate: 85,
          temperature: 37.0,
          respiratoryRate: 18,
          oxygenSaturation: 98,
        },
        userId: 'nurse-1',
      };

      await eventBus.publish(publishedEvent);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.eventType).toBe('VitalsRecorded');
      expect(receivedEvent.payload.bloodPressureSystolic).toBe(210);
      expect(receivedEvent.tenantId).toBe('tenant-1');

      unsub();
    });
  });

  describe('Memory Adapter', () => {
    it('should log all published events', async () => {
      await eventBus.publish({
        eventType: 'BedAllocated',
        tenantId: 'tenant-1',
        aggregateId: 'bed-1',
        aggregateType: 'Bed',
        payload: {
          bedId: 'bed-1',
          bedCode: 'A-101',
          bedType: 'standard',
          wardId: 'ward-1',
          patientId: 'patient-1',
          admissionId: 'admission-1',
          encounterId: 'encounter-1',
          allocatedAt: '2024-01-01T10:00:00Z',
          dailyRate: 150000,
        },
        userId: 'user-1',
      });

      await eventBus.publish({
        eventType: 'VitalsRecorded',
        tenantId: 'tenant-1',
        aggregateId: 'vitals-1',
        aggregateType: 'VitalSigns',
        payload: {
          vitalsId: 'vitals-1',
          patientId: 'patient-1',
          encounterId: 'encounter-1',
          recordedBy: 'nurse-1',
          recordedAt: '2024-01-01T10:00:00Z',
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 75,
        },
        userId: 'nurse-1',
      });

      const eventLog = adapter.getEventLog();
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].eventType).toBe('BedAllocated');
      expect(eventLog[1].eventType).toBe('VitalsRecorded');
    });

    it('should clear event log', () => {
      adapter.clear();
      expect(adapter.getEventLog()).toHaveLength(0);
    });
  });
});
