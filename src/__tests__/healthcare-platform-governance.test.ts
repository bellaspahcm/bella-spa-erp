import { 
  CLINICAL_CAPABILITY_MANIFEST, 
  LABORATORY_CAPABILITY_MANIFEST, 
  BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST 
} from '@/lib/capabilities/healthcare-manifest';
import { 
  HEALTHCARE_EVENT_CATALOG, 
  createHealthcareEvent 
} from '@/lib/events/healthcare-events';

describe('BELLA HEALTHCARE PLATFORM — ARCHITECTURE GOVERNANCE TESTS', () => {

  describe('Rule #1: Product Manifest & Capability Manifests Contract', () => {
    it('should have correct Product Manifest for Bella Medical Clinic', () => {
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.productId).toBe('medical_clinic');
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.enabledCapabilities).toContain('clinical');
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.enabledCapabilities).toContain('laboratory');
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.enabledCapabilities).toContain('imaging');
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.enabledCapabilities).toContain('pharmacy');
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.enabledCapabilities).toContain('billing');
      expect(BELLA_MEDICAL_CLINIC_PRODUCT_MANIFEST.enabledCapabilities).toContain('insurance');
    });

    it('should have valid Semantic Versioning in Clinical Capability Manifest', () => {
      expect(CLINICAL_CAPABILITY_MANIFEST.schemaVersion).toBe('1.0');
      expect(CLINICAL_CAPABILITY_MANIFEST.capabilityVersion).toBeDefined();
      expect(CLINICAL_CAPABILITY_MANIFEST.status).toBe('production');
      expect(CLINICAL_CAPABILITY_MANIFEST.requires).toContain('patient');
      expect(CLINICAL_CAPABILITY_MANIFEST.requires).toContain('practitioner');
    });

    it('should have valid Semantic Versioning in Laboratory Capability Manifest', () => {
      expect(LABORATORY_CAPABILITY_MANIFEST.capability).toBe('laboratory');
      expect(LABORATORY_CAPABILITY_MANIFEST.requires).toContain('clinical_orders');
    });
  });

  describe('Rule #3 & ADR-008: Event Contract Registry', () => {
    it('should register standard domain event names', () => {
      expect(HEALTHCARE_EVENT_CATALOG.ENCOUNTER_STARTED).toBe('EncounterStarted.v1');
      expect(HEALTHCARE_EVENT_CATALOG.ENCOUNTER_COMPLETED).toBe('EncounterCompleted.v1');
      expect(HEALTHCARE_EVENT_CATALOG.CLINICAL_ORDER_CREATED).toBe('ClinicalOrderCreated.v1');
      expect(HEALTHCARE_EVENT_CATALOG.LAB_RESULT_VERIFIED).toBe('LabResultVerified.v1');
      expect(HEALTHCARE_EVENT_CATALOG.PRESCRIPTION_ISSUED).toBe('PrescriptionIssued.v1');
    });

    it('should create valid structured Domain Events with producer metadata', () => {
      const payload = {
        encounterId: 'enc_123',
        patientId: 'pat_456',
        customerId: 'cust_789',
        practitionerId: 'doc_001',
        facilityId: 'fac_001',
        priority: 'routine',
        startedAt: new Date().toISOString(),
      };

      const event = createHealthcareEvent(
        HEALTHCARE_EVENT_CATALOG.ENCOUNTER_STARTED,
        'v1',
        'tenant_demo',
        'clinical',
        payload
      );

      expect(event.eventId).toBeDefined();
      expect(event.eventName).toBe('EncounterStarted.v1');
      expect(event.tenantId).toBe('tenant_demo');
      expect(event.producerCapability).toBe('clinical');
      expect(event.payload.encounterId).toBe('enc_123');
    });
  });

});
