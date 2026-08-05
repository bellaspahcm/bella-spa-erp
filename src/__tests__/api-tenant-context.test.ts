/**
 * Unit tests for /api/tenant/context endpoint
 * 
 * Tests tenant context API route that provides tenant configuration
 * to the TenantContextProvider on app startup.
 */

import { GET } from '@/app/api/tenant/context/route';
import { NextRequest } from 'next/server';

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
  headers: jest.fn(async () => ({
    get: jest.fn(),
  })),
}));

// Mock Supabase client
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockGetUser = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe('GET /api/tenant/context', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockUserProfile = {
    tenant_id: 'tenant-123',
  };

  const mockTenant = {
    id: 'tenant-123',
    name: 'Test Spa',
    enabled_modules: ['spa', 'babycare'],
    subscription_tier: 'professional',
    role_permissions: {
      feature_flags: {
        ai_salary_reconciliation: true,
        inventory_transfer: false,
      },
    },
    brand_theme: {
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#FF5733',
    },
    logo_url: 'https://example.com/logo.png',
    salary_config: {
      base_salary: 5000000,
    },
    qr_bank_code: 'VCB',
    qr_account_number: '1234567890',
    qr_account_name: 'Test Spa',
    contact_phone: '0123456789',
    email: 'contact@testspa.com',
    address: '123 Test Street',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock chain
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('returns 403 when user has no tenant assigned', async () => {
    // First call for user profile - returns user with no tenant
    mockSingle.mockResolvedValueOnce({
      data: { tenant_id: null },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('no tenant assigned');
  });

  it('returns 500 when user profile fetch fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to fetch user profile');
  });

  it('returns 500 when tenant fetch fails', async () => {
    // First call for user profile - success
    mockSingle.mockResolvedValueOnce({
      data: mockUserProfile,
      error: null,
    });

    // Second call for tenant - fails
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to fetch tenant configuration');
  });

  it('returns 404 when tenant is not found', async () => {
    // First call for user profile - success
    mockSingle.mockResolvedValueOnce({
      data: mockUserProfile,
      error: null,
    });

    // Second call for tenant - not found
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Tenant configuration not found');
  });

  it('returns properly formatted TenantContext when successful', async () => {
    // First call for user profile
    mockSingle.mockResolvedValueOnce({
      data: mockUserProfile,
      error: null,
    });

    // Second call for tenant
    mockSingle.mockResolvedValueOnce({
      data: mockTenant,
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify TenantContext structure
    expect(data).toMatchObject({
      tenantId: 'tenant-123',
      tenantName: 'Test Spa',
      enabledModules: ['spa', 'babycare'],
      subscriptionPlan: 'professional',
      featureFlags: {
        ai_salary_reconciliation: true,
        inventory_transfer: false,
      },
      settings: expect.objectContaining({
        currency: 'VND',
        timezone: 'Asia/Ho_Chi_Minh',
        locale: 'vi-VN',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF5733',
        companyName: 'Test Spa',
      }),
    });

    // Verify settings include additional config
    expect(data.settings.salaryConfig).toBeDefined();
    expect(data.settings.qrPayment).toMatchObject({
      bankCode: 'VCB',
      accountNumber: '1234567890',
      accountName: 'Test Spa',
    });
    expect(data.settings.contact).toMatchObject({
      phone: '0123456789',
      email: 'contact@testspa.com',
      address: '123 Test Street',
    });
  });

  it('uses default values when tenant has minimal configuration', async () => {
    const minimalTenant = {
      id: 'tenant-456',
      name: 'Minimal Spa',
      enabled_modules: null,
      subscription_tier: null,
      role_permissions: null,
      brand_theme: null,
      logo_url: null,
      salary_config: null,
      qr_bank_code: null,
      qr_account_number: null,
      qr_account_name: null,
      contact_phone: null,
      email: null,
      address: null,
    };

    // First call for user profile
    mockSingle.mockResolvedValueOnce({
      data: mockUserProfile,
      error: null,
    });

    // Second call for tenant
    mockSingle.mockResolvedValueOnce({
      data: minimalTenant,
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify defaults are applied
    expect(data.enabledModules).toEqual(['spa']); // Default module
    expect(data.subscriptionPlan).toBe('basic'); // Default plan
    expect(data.featureFlags).toEqual({}); // Empty flags
    expect(data.settings).toMatchObject({
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      locale: 'vi-VN',
      companyName: 'Minimal Spa',
    });
  });

  it('sets cache headers on successful response', async () => {
    // First call for user profile
    mockSingle.mockResolvedValueOnce({
      data: mockUserProfile,
      error: null,
    });

    // Second call for tenant
    mockSingle.mockResolvedValueOnce({
      data: mockTenant,
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/tenant/context');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
  });
});
