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

// Mock dashboard-client-context
jest.mock('../dashboard-client-context', () => ({
  getCachedCurrentUser: jest.fn(),
  getCachedTenantSettings: jest.fn(),
}));

const mockGetCachedCurrentUser = dashboardContext.getCachedCurrentUser as jest.MockedFunction<typeof dashboardContext.getCachedCurrentUser>;
const mockGetCachedTenantSettings = dashboardContext.getCachedTenantSettings as jest.MockedFunction<typeof dashboardContext.getCachedTenantSettings>;

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
      mockGetCachedCurrentUser.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
      } as any);

      mockGetCachedTenantSettings.mockResolvedValue({
        id: 'tenant-haircut',
        product_key: 'bella_haircut',
        name: 'Haircut Test Tenant',
      } as any);

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
  });

  describe('Product Resolution Null Cases', () => {
    it('should set product=null when product_key is null', async () => {
      mockGetCachedCurrentUser.mockResolvedValue({
        id: 'user-2',
        role: 'USER',
      } as any);

      mockGetCachedTenantSettings.mockResolvedValue({
        id: 'tenant-unclassified',
        product_key: null,
        name: 'Unclassified Tenant',
      } as any);

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
      mockGetCachedCurrentUser.mockResolvedValue({
        id: 'user-3',
        role: 'USER',
      } as any);

      mockGetCachedTenantSettings.mockResolvedValue({
        id: 'tenant-legacy',
        name: 'Legacy Tenant',
        // product_key not present
      } as any);

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
      mockGetCachedCurrentUser.mockResolvedValue({
        id: 'user-4',
        role: 'USER',
      } as any);

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
      mockGetCachedCurrentUser.mockResolvedValue({
        id: 'user-5',
        role: 'ADMIN',
      } as any);

      mockGetCachedTenantSettings.mockResolvedValue({
        id: 'tenant-invalid',
        product_key: 'unknown_product',
        name: 'Invalid Product Tenant',
      } as any);

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
      let resolveUser: any;
      let resolveTenant: any;

      mockGetCachedCurrentUser.mockReturnValue(
        new Promise((resolve) => { resolveUser = resolve; })
      );

      mockGetCachedTenantSettings.mockReturnValue(
        new Promise((resolve) => { resolveTenant = resolve; })
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
      resolveUser({ id: 'user-6', role: 'USER' });
      resolveTenant({
        id: 'tenant-6',
        product_key: 'bella_haircut',
        name: 'Test',
      });

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
      mockGetCachedCurrentUser.mockResolvedValue({
        id: 'user-7',
        role: 'MANAGER',
      } as any);

      mockGetCachedTenantSettings.mockResolvedValue({
        id: 'tenant-7',
        product_key: null,
      } as any);

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
