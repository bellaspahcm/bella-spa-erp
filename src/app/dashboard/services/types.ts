import type { Database } from '@/types/database.types';

export type ServicePackage = Database['public']['Tables']['packages']['Row'];
export type ServicePackageInsert = Database['public']['Tables']['packages']['Insert'];
export type ServicePackageUpdate = Database['public']['Tables']['packages']['Update'];
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];

export type ServiceStatus = 'active' | 'inactive';
export type ServiceStatusFilter = 'all' | ServiceStatus;
export type ServiceModalMode = 'add' | 'edit';

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
};
