/**
 * Unit tests for SpaModuleAdapter
 * 
 * @module SpaModuleAdapter.test
 */

import { describe, it, expect } from '@jest/globals';
import { SpaModuleAdapter, spaModuleAdapter } from './SpaModuleAdapter';
import type { CoreServiceCatalogItem, CoreBookingOrder, TenantContext } from '@/core/types';

describe('SpaModuleAdapter', () => {
  describe('Module Identity', () => {
    it('should have correct moduleId', () => {
      expect(spaModuleAdapter.moduleId).toBe('spa');
    });

    it('should have correct moduleName', () => {
      expect(spaModuleAdapter.moduleName).toBe('Bella Spa & Babycare');
    });
  });

  describe('transformServiceItem', () => {
    it('should transform CoreServiceCatalogItem to SpaPackage', () => {
      const coreItem: CoreServiceCatalogItem = {
        id: 'pkg-test-1',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        name: 'Combo Mẹ & Bé VIP Toàn Diện',
        description: 'Premium spa package with 20 sessions',
        basePrice: 15000000,
        currency: 'VND',
        status: 'active',
        metadata: {
          total_sessions: 20,
          session_multiplier: 2.0,
          category: 'vip',
          duration_minutes: 90,
        },
      };

      const spaPackage = spaModuleAdapter.transformServiceItem(coreItem);

      expect(spaPackage.id).toBe('pkg-test-1');
      expect(spaPackage.name).toBe('Combo Mẹ & Bé VIP Toàn Diện');
      expect(spaPackage.basePrice).toBe(15000000);
      expect(spaPackage.totalSessions).toBe(20);
      expect(spaPackage.sessionMultiplier).toBe(2.0);
      expect(spaPackage.category).toBe('vip');
      expect(spaPackage.durationMinutes).toBe(90);
    });

    it('should use default values when metadata fields are missing', () => {
      const coreItem: CoreServiceCatalogItem = {
        id: 'pkg-test-2',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        name: 'Basic Package',
        basePrice: 5000000,
        currency: 'VND',
        status: 'active',
        metadata: {},
      };

      const spaPackage = spaModuleAdapter.transformServiceItem(coreItem);

      expect(spaPackage.totalSessions).toBe(0);
      expect(spaPackage.sessionMultiplier).toBe(1.0);
      expect(spaPackage.category).toBe('basic');
      expect(spaPackage.durationMinutes).toBe(60);
    });

    it('should handle premium category', () => {
      const coreItem: CoreServiceCatalogItem = {
        id: 'pkg-test-3',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        name: 'Premium Package',
        basePrice: 10000000,
        currency: 'VND',
        status: 'active',
        metadata: {
          total_sessions: 15,
          session_multiplier: 1.5,
          category: 'premium',
          duration_minutes: 75,
        },
      };

      const spaPackage = spaModuleAdapter.transformServiceItem(coreItem);

      expect(spaPackage.category).toBe('premium');
      expect(spaPackage.sessionMultiplier).toBe(1.5);
    });
  });

  describe('transformBookingOrder', () => {
    it('should transform CoreBookingOrder to SpaBooking', () => {
      const coreOrder: CoreBookingOrder = {
        id: 'booking-test-1',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        customerId: 'customer-1',
        serviceItemId: 'pkg-1',
        status: 'in_progress',
        scheduledStartTime: '2025-06-01T09:00:00Z',
        scheduledEndTime: '2025-12-01T09:00:00Z',
        totalAmount: 15000000,
        paidAmount: 5000000,
        metadata: {
          sessions_completed: 5,
          sessions_total: 20,
          assigned_ktv_id: 'ktv-123',
          package_category: 'vip',
        },
      };

      const spaBooking = spaModuleAdapter.transformBookingOrder(coreOrder);

      expect(spaBooking.id).toBe('booking-test-1');
      expect(spaBooking.customerId).toBe('customer-1');
      expect(spaBooking.status).toBe('in_progress');
      expect(spaBooking.sessionsCompleted).toBe(5);
      expect(spaBooking.sessionsTotal).toBe(20);
      expect(spaBooking.assignedKtvId).toBe('ktv-123');
      expect(spaBooking.packageCategory).toBe('vip');
    });

    it('should use default values when metadata fields are missing', () => {
      const coreOrder: CoreBookingOrder = {
        id: 'booking-test-2',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        customerId: 'customer-2',
        serviceItemId: 'pkg-2',
        status: 'confirmed',
        scheduledStartTime: '2025-06-01T09:00:00Z',
        totalAmount: 5000000,
        paidAmount: 5000000,
        metadata: {},
      };

      const spaBooking = spaModuleAdapter.transformBookingOrder(coreOrder);

      expect(spaBooking.sessionsCompleted).toBe(0);
      expect(spaBooking.sessionsTotal).toBe(0);
      expect(spaBooking.assignedKtvId).toBeNull();
      expect(spaBooking.packageCategory).toBe('');
    });

    it('should handle partially filled metadata', () => {
      const coreOrder: CoreBookingOrder = {
        id: 'booking-test-3',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        customerId: 'customer-3',
        serviceItemId: 'pkg-3',
        status: 'completed',
        scheduledStartTime: '2025-06-01T09:00:00Z',
        totalAmount: 10000000,
        paidAmount: 10000000,
        metadata: {
          sessions_completed: 15,
          sessions_total: 15,
          // assigned_ktv_id missing
          package_category: 'premium',
        },
      };

      const spaBooking = spaModuleAdapter.transformBookingOrder(coreOrder);

      expect(spaBooking.sessionsCompleted).toBe(15);
      expect(spaBooking.sessionsTotal).toBe(15);
      expect(spaBooking.assignedKtvId).toBeNull();
      expect(spaBooking.packageCategory).toBe('premium');
    });
  });

  describe('calculatePricing', () => {
    const mockContext: TenantContext = {
      tenantId: 'tenant-1',
      tenantName: 'Test Tenant',
      enabledModules: ['spa'],
      subscriptionPlan: 'free',
      featureFlags: {},
      settings: {},
    };

    it('should multiply base price by booking sessions for retail/single-session packages (total_sessions = 1)', async () => {
      const singleSessionItem: CoreServiceCatalogItem = {
        id: 'pkg-retail-1',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        name: 'Single Session',
        basePrice: 150000,
        currency: 'VND',
        status: 'active',
        metadata: {
          total_sessions: 1, // Retail package has 1 session
          booking_total_sessions: 10, // Booking requested 10 sessions
        },
      };

      const price = await spaModuleAdapter.calculatePricing(singleSessionItem, mockContext);
      expect(price).toBe(1500000); // 150000 * 10
    });

    it('should NOT multiply base price if the package is a multi-session combo package (total_sessions > 1)', async () => {
      const multiSessionItem: CoreServiceCatalogItem = {
        id: 'pkg-combo-1',
        tenantId: 'tenant-1',
        moduleId: 'spa',
        name: 'Combo 30 Sessions',
        basePrice: 6000000,
        currency: 'VND',
        status: 'active',
        metadata: {
          total_sessions: 30, // Combo package has 30 sessions
          booking_total_sessions: 30,
        },
      };

      const price = await spaModuleAdapter.calculatePricing(multiSessionItem, mockContext);
      expect(price).toBe(6000000); // Should remain 6000000 (not multiplied)
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(spaModuleAdapter).toBeInstanceOf(SpaModuleAdapter);
    });

    it('should have the same instance across imports', () => {
      const adapter1 = spaModuleAdapter;
      const adapter2 = spaModuleAdapter;
      expect(adapter1).toBe(adapter2);
    });
  });
});
