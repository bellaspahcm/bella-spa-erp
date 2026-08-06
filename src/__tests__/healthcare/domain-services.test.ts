import { TimelineProjectionService } from '@/modules/bella-healthcare/contexts/shared/ReadModelRepository';
import { EncounterSaga } from '@/modules/bella-healthcare/contexts/shared/EncounterSaga';
import { aiRegistry } from '@/modules/bella-healthcare/contexts/shared/AiEngineRegistry';
import { DomainEvent } from '@/modules/bella-healthcare/contexts/shared/domain-models';

describe('Bella Healthcare Platform — Bounded Context Domain Services', () => {
  
  // 1. Test Safety Engine (Allergy & Drug Contraindications)
  describe('SafetyEngine', () => {
    it('should trigger blocker warning when penicillin allergy patient is prescribed amoxicillin', () => {
      const result = aiRegistry.safety.evaluatePrescriptionSafety(['penicillin'], ['J01CA04']); // J01CA04 is Amoxicillin
      expect(result.triggered).toBe(true);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers[0]).toContain('Penicillin');
    });

    it('should allow prescription when no matching allergies exist', () => {
      const result = aiRegistry.safety.evaluatePrescriptionSafety(['aspirin'], ['J01CA04']);
      expect(result.triggered).toBe(false);
      expect(result.blockers.length).toBe(0);
    });
  });

  // 2. Test Prediction Engine (Capacity & Utilization Forecast)
  describe('PredictionEngine', () => {
    it('should forecast higher occupancy and raise critical warning if capacity exceeds 90%', () => {
      const result = aiRegistry.prediction.forecastUtilization(85);
      expect(result.forecastedOccupancy).toBe(100);
      expect(result.bottleneckRisk).toBe('critical');
      expect(result.warningText).toBeDefined();
    });

    it('should show low risk for low utilization', () => {
      const result = aiRegistry.prediction.forecastUtilization(20);
      expect(result.forecastedOccupancy).toBe(24);
      expect(result.bottleneckRisk).toBe('low');
      expect(result.warningText).toBeUndefined();
    });
  });

  // 3. Test Timeline Projection Service
  describe('TimelineProjectionService', () => {
    it('should derive chronological timeline steps from raw Domain Event streams', () => {
      const mockEvents: DomainEvent[] = [
        {
          metadata: {
            eventId: 'evt-101',
            aggregateId: 'pat-01',
            aggregateType: 'Encounter',
            eventName: 'Encounter.Patient.Arrived.v1',
            tenantId: 'test-tenant',
            correlationId: 'corr-001',
            schemaVersion: 'v1',
            occurredAt: '2026-08-06T09:28:00Z',
            userId: 'receptionist-1'
          },
          payload: {}
        },
        {
          metadata: {
            eventId: 'evt-102',
            aggregateId: 'pat-01',
            aggregateType: 'Encounter',
            eventName: 'Pharmacy.Prescription.Created.v1',
            tenantId: 'test-tenant',
            correlationId: 'corr-001',
            schemaVersion: 'v1',
            occurredAt: '2026-08-06T09:48:00Z'
          },
          payload: {}
        }
      ];

      const steps = TimelineProjectionService.projectTimeline(mockEvents);
      
      expect(steps.length).toBe(3); // Initial schedule step + 2 projected events
      expect(steps[1].title).toBe('Check-in Tiếp đón');
      expect(steps[1].isBottleneck).toBe(true);
      expect(steps[2].title).toBe('Kê đơn & Chẩn đoán');
    });
  });

  // 4. Test Encounter Saga & Transactional Outbox
  describe('EncounterSaga & Transactional Outbox', () => {
    it('should capture processed domain events and stage them in outbox', async () => {
      const saga = EncounterSaga.getInstance();
      const initialOutboxLength = saga.getOutbox().length;

      const testEvent: DomainEvent = {
        metadata: {
          eventId: 'evt-saga-test',
          aggregateId: 'enc-test-1',
          aggregateType: 'Encounter',
          eventName: 'Scheduling.Appointment.Created.v1',
          tenantId: 'test-tenant',
          correlationId: 'corr-saga-01',
          schemaVersion: 'v1',
          occurredAt: new Date().toISOString()
        },
        payload: { patientId: 'pat-01' }
      };

      await saga.handleEvent(testEvent);
      
      const updatedOutbox = saga.getOutbox();
      expect(updatedOutbox.length).toBe(initialOutboxLength + 1);
      expect(updatedOutbox[updatedOutbox.length - 1].event.metadata.eventId).toBe('evt-saga-test');
    });
  });
});
