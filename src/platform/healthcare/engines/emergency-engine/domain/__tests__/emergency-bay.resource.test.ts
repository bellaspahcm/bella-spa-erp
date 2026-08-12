import { EmergencyBay } from '../emergency-bay.resource';

describe('EmergencyBay Resource Aggregate Unit Tests', () => {
  it('should create an available EmergencyBay resource', () => {
    const bay = EmergencyBay.create({
      id: 'bay-001',
      tenantId: 'tenant-001',
      bayCode: 'ED-BAY-01',
      bayName: 'Emergency Bay 01 (Resuscitation)',
    });

    expect(bay.status).toBe('AVAILABLE');
    expect(bay.canAllocate()).toBe(true);
    expect(bay.version).toBe(1);
  });

  it('should allocate to encounter and increment version', () => {
    const bay = EmergencyBay.create({
      id: 'bay-002',
      tenantId: 'tenant-001',
      bayCode: 'ED-BAY-02',
      bayName: 'Emergency Bay 02',
    });

    bay.allocate('enc-101', 'patient-202');

    expect(bay.status).toBe('OCCUPIED');
    expect(bay.currentEncounterId).toBe('enc-101');
    expect(bay.currentPatientId).toBe('patient-202');
    expect(bay.version).toBe(2);
    expect(bay.canAllocate()).toBe(false);
  });

  it('should release occupied bay back to available', () => {
    const bay = EmergencyBay.create({
      id: 'bay-003',
      tenantId: 'tenant-001',
      bayCode: 'ED-BAY-03',
      bayName: 'Emergency Bay 03',
    });

    bay.allocate('enc-101', 'patient-202');
    bay.release();

    expect(bay.status).toBe('AVAILABLE');
    expect(bay.currentEncounterId).toBeNull();
    expect(bay.version).toBe(3);
    expect(bay.canAllocate()).toBe(true);
  });

  it('should prevent double allocation', () => {
    const bay = EmergencyBay.create({
      id: 'bay-004',
      tenantId: 'tenant-001',
      bayCode: 'ED-BAY-04',
      bayName: 'Emergency Bay 04',
    });

    bay.allocate('enc-101', 'patient-202');

    expect(() => {
      bay.allocate('enc-999', 'patient-999');
    }).toThrow('Cannot allocate EmergencyBay ED-BAY-04: current status is OCCUPIED');
  });
});
