/**
 * BELLA AUTOMOVE — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella AutoMove product (automotive service & repair).
 *
 * @module src/products/bella-automove/manifest
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

export const bellaAutomoveManifest: ProductManifest = {
  id: 'bella-automove',
  name: 'Bella AutoMove',
  version: '1.0.0',
  themeKey: 'automotive-tech-blue',
  capabilities: [
    'vehicle_management',
    'service_appointments',
    'repair_orders',
    'parts_inventory',
    'invoice_generation'
  ],
  workflows: [
    'vehicle_service_lifecycle',
    'repair_order_workflow'
  ],
  menus: [
    { id: 'dashboard', label: 'Dashboard', href: '/dashboard/automove', icon: 'Home' },
    { id: 'vehicles', label: 'Vehicles', href: '/dashboard/automove/vehicles', icon: 'Car' },
    { id: 'appointments', label: 'Appointments', href: '/dashboard/automove/appointments', icon: 'Calendar' },
    { id: 'repair-orders', label: 'Repair Orders', href: '/dashboard/automove/repair-orders', icon: 'Wrench' },
    { id: 'invoices', label: 'Invoices', href: '/dashboard/automove/invoices', icon: 'Receipt' }
  ]
};
