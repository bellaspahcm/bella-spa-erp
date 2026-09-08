/**
 * BELLA RETAIL STORE - PRODUCT MANIFEST
 * 
 * Reference Product #1 for Retail OS Discovery
 * Purpose: Store/POS workflows for retail operations
 * 
 * G1: Definition & Boundary
 * - Product: Bella Retail Store (POS/Store Management)
 * - Industry: Retail
 * - Kernel: None (uses Retail Foundation schema directly via Platform)
 * - Scope: 5 workflows (Product Catalog, Customer Purchase, Sale Complete, Inventory Movement, Restock)
 */

import type { ProductManifest } from '@/core/plugins/manifest';

export const retailStoreProductManifest: ProductManifest = {
  id: 'bella-retail-store',
  name: 'Bella Retail Store',
  version: '1.0.0',
  apiVersion: 'v2',
  schemaVersion: 'v1.0',
  eventVersion: 'v1',
  minimumKernelVersion: '1.0.0',
  supportedHostVersion: '1.0.0',
  dependencies: [], // Direct Platform usage, no Kernel dependencies yet
  permissions: [
    'retail.products.manage',
    'retail.customers.manage',
    'retail.sales.create',
    'retail.sales.complete',
    'retail.inventory.manage'
  ],
  featureFlags: {
    enable_loyalty_program: true,
    enable_discount_management: true,
    enable_inventory_tracking: true,
  },
};
