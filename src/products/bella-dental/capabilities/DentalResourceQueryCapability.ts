import type { ResourceQueryCapability } from '@/modules/bella-healthcare-kernel/capabilities/query-capability';
import type { HealthcareResourceDTO } from '@/modules/bella-healthcare-kernel/domain/types';

export class DentalResourceQueryCapability implements ResourceQueryCapability {
  readonly id = 'dental_resource_query';
  readonly version = '1.0.0';
  readonly capabilityType = 'query' as const;

  async getResources(_tenantId: string): Promise<readonly HealthcareResourceDTO[]> {
    // Pure DTO returning: Dental Chairs
    return [
      { id: 'den-chair-01', code: 'G01', name: 'Ghế Nha Khoa 01 (Khám & Tẩy trắng)', resourceType: 'chair', status: 'available', department: 'Nha khoa Tổng quát' },
      { id: 'den-chair-02', code: 'G02', name: 'Ghế Nha Khoa 02 (Chỉnh nha & Invisalign)', resourceType: 'chair', status: 'occupied', department: 'Chỉnh nha' },
      { id: 'den-chair-03', code: 'G03', name: 'Ghế Phẫu Thuật Implant (Vô trùng VIP)', resourceType: 'chair', status: 'available', department: 'Cấy ghép Implant' },
    ];
  }

  async getResourceById(_tenantId: string, resourceId: string): Promise<HealthcareResourceDTO | undefined> {
    const resources = await this.getResources(_tenantId);
    return resources.find(r => r.id === resourceId);
  }
}
