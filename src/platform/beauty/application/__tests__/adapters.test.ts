import type { IServiceCatalog, IWaitlistEngine, Service, ServiceBranchAvailability } from '../../../contracts/v1';
import { ServiceCatalogAdapter, WaitlistAdapter } from '../adapters';

const service: Service = {
  id: 'service-1', tenant_id: 'tenant-1', name: 'Cut', description: null, module_key: 'haircut',
  service_kind: 'single', service_category: 'cut', price: 100, full_price: 100, price_floor: null, price_cap: null,
  duration: null, default_duration_minutes: 30, estimated_duration: null, total_sessions: 1, session_multiplier: null,
  requires_resource: true, default_resource_type: 'CUTTING_STATION', required_workers: 1, before_after_required: false,
  care_note_template: null, ktv_commission: 10, details: null, offer: null, is_hq_template: false, template_id: null,
  allowed_franchise_override: true, status: 'active', metadata: null, created_at: '2026-09-16T00:00:00.000Z', updated_at: null,
};

describe('Beauty OS H8 adapters', () => {
  it('maps only bookable catalog facts and rejects an unavailable branch', async () => {
    const catalog = {
      getService: async () => service,
      getServiceAvailabilityByBranches: async (): Promise<ServiceBranchAvailability[]> => [{ service_id: service.id, branch_id: 'branch-1', tenant_id: 'tenant-1', is_available: false, unavailable_reason: 'maintenance', created_at: '', updated_at: '' }],
    } as Pick<IServiceCatalog, 'getService' | 'getServiceAvailabilityByBranches'>;
    const adapter = new ServiceCatalogAdapter(catalog as IServiceCatalog);
    await expect(adapter.getBookableService('tenant-1', 'service-1', 'branch-1')).resolves.toBeNull();
  });

  it('passes waitlist requests through the public contract with tenant scope', async () => {
    let receivedTenant = '';
    const waitlist = {
      addToWaitlist: async (input: Parameters<IWaitlistEngine['addToWaitlist']>[0]) => { receivedTenant = input.tenant_id; return { success: true }; },
    } as Pick<IWaitlistEngine, 'addToWaitlist'>;
    await new WaitlistAdapter(waitlist as IWaitlistEngine).add({ tenantId: 'tenant-1', customerId: 'customer-1', serviceId: 'service-1', preferredDate: '2026-09-16', preferredStartTime: '10:00', bookingValue: 100 });
    expect(receivedTenant).toBe('tenant-1');
  });
});
