import type { Database } from '@/types/database.types';
import type { TransferOrderItem } from '@/services/inventory-transfer-actions';

export type ActiveInventoryTab = 'stock' | 'requests' | 'reconciliation' | 'sales';
export type StockFilter = 'all' | 'low' | 'ok';

export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];

export type InventoryLog = Pick<
  Database['public']['Tables']['inventory_logs']['Row'],
  'id' | 'change_amount' | 'reason' | 'notes' | 'created_at' | 'tenant_id'
> & {
  inventory_items: {
    name: string | null;
    unit: string | null;
  } | null;
};

export type NewInventoryItem = {
  name: string;
  sku: string;
  unit: string;
  stock_level: number;
  min_stock_level: number;
  price_per_unit: number;
  category: string;
};

export type ReconRow = {
  item_id: string;
  name: string;
  unit: string;
  price_per_unit: number;
  nhap: number;
  tieu_hao: number;
  expected: number;
  actual: number | '';
  notes: string;
};

export type RequestCartItem = TransferOrderItem;
