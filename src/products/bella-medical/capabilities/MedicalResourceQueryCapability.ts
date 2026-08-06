import type { ResourceQueryCapability } from '@/modules/bella-healthcare-kernel/capabilities/query-capability';
import type { HealthcareResourceDTO } from '@/modules/bella-healthcare-kernel/domain/types';

export class MedicalResourceQueryCapability implements ResourceQueryCapability {
  readonly id = 'medical_resource_query';
  readonly version = '1.0.0';
  readonly capabilityType = 'query' as const;

  async getResources(_tenantId: string): Promise<readonly HealthcareResourceDTO[]> {
    // Pure DTO returning: Medical Examination Rooms
    return [
      { id: 'med-room-101', code: 'P101', name: 'Phòng Khám Nội 1', resourceType: 'room', status: 'available', capacity: 1, department: 'Nội khoa' },
      { id: 'med-room-102', code: 'P102', name: 'Phòng Khám Nội 2', resourceType: 'room', status: 'occupied', capacity: 1, department: 'Nội khoa' },
      { id: 'med-room-201', code: 'P201', name: 'Phòng Khám Nhi', resourceType: 'room', status: 'available', capacity: 1, department: 'Nhi khoa' },
    ];
  }

  async getResourceById(_tenantId: string, resourceId: string): Promise<HealthcareResourceDTO | undefined> {
    const resources = await this.getResources(_tenantId);
    return resources.find(r => r.id === resourceId);
  }
}
