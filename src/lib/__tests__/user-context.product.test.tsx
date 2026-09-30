/**
 * UserProvider Product Resolution Tests
 * 
 * @jest-environment jsdom
 * 
 * @remarks
 * Tests P5.5 Runtime Integration:
 * - UserProvider extends with product field
 * - product_key=bella_haircut → resolves Bella Haircut
 * - product_key=null → product=null
 * - unknown product_key → product=null (graceful)
 * - existing UserProvider behavior unchanged
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from '../user-context';
import * as dashboardContext from '../dashboard-client-context';
import { productRegistry } from '@/platform/registry/product-registry';
import type { Database, Json } from '@/types/database.types';

// Mock dashboard-client-context
jest.mock('../dashboard-client-context', () => ({
  getCachedCurrentUser: jest.fn(),
  getCachedTenantSettings: jest.fn(),
}));

const mockGetCachedCurrentUser = dashboardContext.getCachedCurrentUser as jest.MockedFunction<typeof dashboardContext.getCachedCurrentUser>;
const mockGetCachedTenantSettings = dashboardContext.getCachedTenantSettings as jest.MockedFunction<typeof dashboardContext.getCachedTenantSettings>;
type CurrentUserResult = Awaited<ReturnType<typeof dashboardContext.getCachedCurrentUser>>;
type TenantSettingsResult = Awaited<ReturnType<typeof dashboardContext.getCachedTenantSettings>>;
type CurrentUserFixture = NonNullable<CurrentUserResult>;
type TenantSettingsFixture = NonNullable<TenantSettingsResult>;
type TenantRow = Database['public']['Tables']['tenants']['Row'];

function createUserFixture(overrides: Partial<CurrentUserFixture> & Pick<CurrentUserFixture, 'id' | 'role'>): CurrentUserFixture {
  return {
    email: `${overrides.id}@example.test`,
    full_name: null,
    tenant_id: null,
    ...overrides,
  };
}

function createTenantFixture(overrides: Partial<TenantRow> & Pick<TenantRow, 'id'>): TenantSettingsFixture {
  return {
    accounting_mode: null,
    address: null,
    brand_theme: {} as Json,
    commission_config: null,
    contact_name: null,
    contact_phone: null,
    created_at: null,
    email: null,
    enabled_modules: {} as Json,
    franchise_agreement_date: null,
    gps_threshold_m: null,
    id: overrides.id,
    internal_clearing_rate: null,
    logo_url: null,
    metadata: null,
    name: 'Test Tenant',
    parent_tenant_id: null,
    product_key: null,
    qr_account_name: null,
    qr_account_number: null,
    qr_bank_code: null,
    role_permissions: null,
    royalty_fixed_amount: null,
    royalty_rate: null,
    royalty_type: null,
    salary_config: null,
    sms_allotment_used: null,
    status: null,
    subscription_expires_at: null,
    subscription_tier: null,
    tenant_lat: null,
    tenant_lon: null,
    updated_at: null,
    zalo_access_token: null,
    zalo_app_id: null,
    zalo_auto_scan: null,
    zalo_oa_id: null,
    zalo_refresh_token: null,
    zalo_secret_key: null,
    zalo_template_birthday_id: null,
    zalo_template_reminder_id: null,
    zalo_token_expires_at: null,
    ...overrides,
  };
}

// Test component to access context
function TestConsumer() {
  const { user, userRole, tenantSettings, product, isLoading } = useUser();
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user?.id ?? 'null'}</div>
      <div data-testid="role">{userRole ?? 'null'}</div>
      <div data-testid="tenant">{tenantSettings?.id ?? 'null'}</div>
      <div data-testid="product">{product?.productKey ?? 'null'}</div>
      <div data-testid="product-display">{product?.displayName ?? 'null'}</div>
    </div>
  );
}

describe('UserProvider Product Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Product Resolution Success', () => {
    it('should resolve product when product_key=bella_haircut', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-1',
        role: 'ADMIN',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(createTenantFixture({
        id: 'tenant-haircut',
        product_key: 'bella_haircut',
        name: 'Haircut Test Tenant',
      }));

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Wait for data load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Product should be resolved
      expect(screen.getByTestId('product')).toHaveTextContent('bella_haircut');
      expect(screen.getByTestId('product-display')).toHaveTextContent('Bella Haircut Shop');

      // Existing behavior unchanged
      expect(screen.getByTestId('user')).toHaveTextContent('user-1');
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
      expect(screen.getByTestId('tenant')).toHaveTextContent('tenant-haircut');
    });

    it('should resolve product when product_key=bella_babycare (B3.1 UI Identity Proof)', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-babycare',
        role: 'ADMIN',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(createTenantFixture({
        id: '0e66365b-42b0-420e-acca-f7d7692e125e',
        product_key: 'bella_babycare',
        name: 'Bella Spa Headquarter',
      }));

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // CRITICAL: Product should resolve to "Bella Mommy Baby Care"
      expect(screen.getByTestId('product')).toHaveTextContent('bella_babycare');
      expect(screen.getByTestId('product-display')).toHaveTextContent('Bella Mommy Baby Care');

      // Existing behavior unchanged
      expect(screen.getByTestId('user')).toHaveTextContent('user-babycare');
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
      expect(screen.getByTestId('tenant')).toHaveTextContent('0e66365b-42b0-420e-acca-f7d7692e125e');
    });
  });

  describe('Product Resolution Null Cases', () => {
    it('should set product=null when product_key is null', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-2',
        role: 'USER',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(createTenantFixture({
        id: 'tenant-unclassified',
        product_key: null,
        name: 'Unclassified Tenant',
      }));

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Product should be null
      expect(screen.getByTestId('product')).toHaveTextContent('null');
      expect(screen.getByTestId('product-display')).toHaveTextContent('null');

      // Existing behavior unchanged
      expect(screen.getByTestId('user')).toHaveTextContent('user-2');
      expect(screen.getByTestId('role')).toHaveTextContent('user');
      expect(screen.getByTestId('tenant')).toHaveTextContent('tenant-unclassified');
    });

    it('should set product=null when product_key is undefined', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-3',
        role: 'USER',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(createTenantFixture({
        id: 'tenant-legacy',
        name: 'Legacy Tenant',
      }));

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Product should be null
      expect(screen.getByTestId('product')).toHaveTextContent('null');
    });

    it('should set product=null when tenantSettings is null', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-4',
        role: 'USER',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(null);

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Product should be null
      expect(screen.getByTestId('product')).toHaveTextContent('null');
      expect(screen.getByTestId('tenant')).toHaveTextContent('null');
    });
  });

  describe('Unknown Product Key Handling', () => {
    it('should set product=null when product_key is unknown (graceful)', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-5',
        role: 'ADMIN',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(createTenantFixture({
        id: 'tenant-invalid',
        product_key: 'unknown_product',
        name: 'Invalid Product Tenant',
      }));

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Product should be null (tryResolve returns undefined)
      expect(screen.getByTestId('product')).toHaveTextContent('null');

      // Existing behavior unchanged (tenant still loaded)
      expect(screen.getByTestId('tenant')).toHaveTextContent('tenant-invalid');
    });
  });

  describe('Loading States', () => {
    it('should maintain correct loading states', async () => {
      let resolveUser: ((value: CurrentUserResult) => void) | undefined;
      let resolveTenant: ((value: TenantSettingsResult) => void) | undefined;

      mockGetCachedCurrentUser.mockReturnValue(
        new Promise<CurrentUserResult>((resolve) => { resolveUser = resolve; })
      );

      mockGetCachedTenantSettings.mockReturnValue(
        new Promise<TenantSettingsResult>((resolve) => { resolveTenant = resolve; })
      );

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      // isLoading=true initially
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('product')).toHaveTextContent('null');

      // Resolve data
      resolveUser!(createUserFixture({ id: 'user-6', role: 'USER' }));
      resolveTenant!(createTenantFixture({
        id: 'tenant-6',
        product_key: 'bella_haircut',
        name: 'Test',
      }));

      // Wait for loading complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // isLoading=false + product resolved
      expect(screen.getByTestId('product')).toHaveTextContent('bella_haircut');
    });
  });

  describe('Existing UserProvider Behavior', () => {
    it('should preserve user and userRole loading', async () => {
      mockGetCachedCurrentUser.mockResolvedValue(createUserFixture({
        id: 'user-7',
        role: 'MANAGER',
      }));

      mockGetCachedTenantSettings.mockResolvedValue(createTenantFixture({
        id: 'tenant-7',
        product_key: null,
      }));

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      expect(screen.getByTestId('user')).toHaveTextContent('user-7');
      expect(screen.getByTestId('role')).toHaveTextContent('manager');
    });

    it('should handle user loading errors gracefully', async () => {
      mockGetCachedCurrentUser.mockRejectedValue(new Error('Auth failed'));
      mockGetCachedTenantSettings.mockResolvedValue(null);

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      // Should log error but not crash
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[UserProvider] Error loading user context data:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
