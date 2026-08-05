import type { Database } from '@/types/database.types';

export type ServicePackage = Database['public']['Tables']['packages']['Row'];
export type ServicePackageInsert = Database['public']['Tables']['packages']['Insert'];
export type ServicePackageUpdate = Database['public']['Tables']['packages']['Update'];
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];
export type BookingResource = Database['public']['Tables']['booking_resources']['Row'];

export type ServiceStatus = 'active' | 'inactive';
export type ServiceStatusFilter = 'all' | ServiceStatus;
export type ServiceModalMode = 'add' | 'edit';
export type ServiceModuleKey = 'babycare' | 'beauty_spa' | 'industrial_cleaning' | 'real_estate' | 'bella_healthcare';
export type ServiceModuleFilter = 'all' | ServiceModuleKey;
export type ServiceKind = 'single_service' | 'treatment_package' | 'retail_product' | 'consultation';
export type ResourceType = 'bed' | 'room' | 'machine' | 'chair' | 'other';
export type ResourceStatus = 'available' | 'in_use' | 'maintenance' | 'inactive';

export type MaterialRow = {
  item_id: string;
  quantity_per_session: number | '';
  name?: string;
  unit?: string;
};

export type ServiceFormState = {
  name: string;
  price: string;
  duration: string;
  sessions: string;
  offer: string;
  details: string;
  ktvCommission: string;
  status: ServiceStatus;
  moduleKey: ServiceModuleKey;
  serviceKind: ServiceKind;
  serviceCategory: string;
  defaultDurationMinutes: string;
  requiresResource: boolean;
  defaultResourceType: ResourceType;
  beforeAfterRequired: boolean;
  careNoteTemplate: string;
};

export type BookingResourceFormState = {
  id: string | null;
  name: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  capacity: string;
  locationNote: string;
};
