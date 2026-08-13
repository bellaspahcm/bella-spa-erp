/**
 * BELLA LAND — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella Land product vertical.
 *
 * @module src/products/bella-land/manifest
 */

export interface ProductManifest {
  id: string;
  name: string;
  version: string;
  themeKey: string;
  capabilities: string[];
  workflows: string[];
  menus: Array<{ id: string; label: string; href: string; icon?: string }>;
}

export const bellaLandManifest: ProductManifest = {
  id: 'bella-land',
  name: 'Bella Land OS V2',
  version: '2.0.0',
  themeKey: 'premium-earth-gold',
  capabilities: [
    'property_inventory_query',
    'sales_reservation_command',
    'sales_contract_command',
    'commission_policy_command'
  ],
  workflows: [
    'property_sales_lifecycle'
  ],
  menus: [
    { id: 'inventory', label: 'Bảng Hàng Căn Hộ', href: '/dashboard/real-estate', icon: 'Building2' },
    { id: 'reservations', label: 'Đặt Cọc Giữ Chỗ', href: '/dashboard/real-estate/reservations', icon: 'Clock' },
    { id: 'contracts', label: 'Hợp Đồng Mua Bán', href: '/dashboard/real-estate/contracts', icon: 'FileText' },
    { id: 'commissions', label: 'Hoa Hồng Môi Giới', href: '/dashboard/real-estate/commissions', icon: 'DollarSign' }
  ]
};
