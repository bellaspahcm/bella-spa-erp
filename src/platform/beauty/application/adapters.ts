import type { IServiceCatalog, IWaitlistEngine, Service } from '../../contracts/v1';
import type { AddToWaitlistInput, AddToWaitlistOutput } from '../../contracts/v1/waitlist-engine.contract';
import type { ResourceAllocationRecord, ResourceCapacityWindow, TenantScoped, TimeInterval } from '../contracts';
import type { ResourceAvailabilityPort } from './ports';

export interface BeautyServiceDefinition {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  requiredResourceType: string | null;
  requiredWorkers: number;
  status: string | null;
}

export class ServiceCatalogAdapter {
  public constructor(private readonly catalog: IServiceCatalog) {}

  public async getBookableService(
    tenantId: string,
    serviceId: string,
    branchId: string,
  ): Promise<BeautyServiceDefinition | null> {
    const service = await this.catalog.getService(serviceId, tenantId);
    if (!service || service.status === 'archived' || service.status === 'inactive') return null;
    const availability = await this.catalog.getServiceAvailabilityByBranches(serviceId, tenantId);
    const branch = availability.find((entry) => entry.branch_id === branchId);
    if (branch && !branch.is_available) return null;
    return this.toDefinition(service);
  }

  private toDefinition(service: Service): BeautyServiceDefinition {
    return {
      id: service.id,
      tenantId: service.tenant_id,
      name: service.name,
      durationMinutes: service.default_duration_minutes,
      requiredResourceType: service.default_resource_type,
      requiredWorkers: service.required_workers ?? 1,
      status: service.status,
    };
  }
}

export interface BeautyWaitlistRequest {
  tenantId: string;
  customerId: string;
  serviceId: string;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime?: string;
  bookingValue: number;
  notes?: string;
}

export class WaitlistAdapter {
  public constructor(private readonly waitlist: IWaitlistEngine) {}

  public add(request: BeautyWaitlistRequest): Promise<AddToWaitlistOutput> {
    const input: AddToWaitlistInput = {
      tenant_id: request.tenantId,
      customer_id: request.customerId,
      package_id: request.serviceId,
      preferred_date: request.preferredDate,
      preferred_start_time: request.preferredStartTime,
      preferred_end_time: request.preferredEndTime,
      booking_value: request.bookingValue,
      notes: request.notes,
    };
    return this.waitlist.addToWaitlist(input);
  }
}

export interface WorkforceAvailabilityRequest extends TenantScoped {
  professionalId: string;
  interval: TimeInterval;
}

export interface WorkforceAvailabilitySource {
  isAvailable(request: WorkforceAvailabilityRequest): Promise<boolean>;
}

export class WorkforceAvailabilityAdapter {
  public constructor(private readonly source: WorkforceAvailabilitySource) {}

  public isAvailable(request: WorkforceAvailabilityRequest): Promise<boolean> {
    return this.source.isAvailable(request);
  }
}

export class ResourceAvailabilityAdapter implements ResourceAvailabilityPort {
  public constructor(private readonly source: ResourceAvailabilityPort) {}

  public getWindow(scope: TenantScoped & { resourceId: string; interval: ResourceAllocationRecord['interval'] }): Promise<ResourceCapacityWindow> {
    return this.source.getWindow(scope);
  }
}
