/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';

import { createClient as createBrowserClient } from '@/lib/supabase-client';
import { useLandingPackages, useLandingPromotions } from '@/components/features/landing/useLandingData';

jest.mock('@/lib/supabase-client', () => ({
  createClient: jest.fn(),
}));

const mockCreateBrowserClient = jest.mocked(createBrowserClient);

function mockSupabaseOrderResult(result: unknown) {
  const order = jest.fn().mockResolvedValue(result);
  const or = jest.fn(() => ({ order }));
  const eq = jest.fn(() => ({ or, order }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));

  mockCreateBrowserClient.mockReturnValue({ from } as ReturnType<typeof createBrowserClient>);

  return { eq, from, or, order, select };
}

describe('landing data hooks', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('uses fallback package data when the packages query fails', async () => {
    mockSupabaseOrderResult({ data: null, error: { message: 'packages unavailable' } });

    const { result } = renderHook(() => useLandingPackages());

    await waitFor(() => expect(result.current.dataStatus).toBe('fallback'));

    expect(result.current.dataError).toBe('packages unavailable');
    expect(result.current.categories).toBeNull();
    expect(result.current.serviceOptions.length).toBeGreaterThan(0);
  });

  it('uses fallback package data when no active packages are returned', async () => {
    mockSupabaseOrderResult({ data: [], error: null });

    const { result } = renderHook(() => useLandingPackages());

    await waitFor(() => expect(result.current.dataStatus).toBe('fallback'));

    expect(result.current.dataError).toBe('No active packages returned from database.');
    expect(result.current.categories).toBeNull();
    expect(result.current.serviceOptions.length).toBeGreaterThan(0);
  });

  it('loads package categories and service options when active packages exist', async () => {
    const query = mockSupabaseOrderResult({
      data: [
        {
          id: 'pkg-1',
          name: 'Gói Bầu Thư Giãn Bella',
          price: 450000,
          full_price: null,
          duration: '75 phút',
          description: 'Chăm sóc mẹ bầu',
          details: ['Massage body'],
          offer: 'Phổ biến',
          total_sessions: 1,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useLandingPackages());

    await waitFor(() => expect(result.current.categories?.bau.packages[0]?.name).toBe('Gói Bầu Thư Giãn Bella'));

    expect(query.or).toHaveBeenCalledWith('module_key.is.null,module_key.eq.babycare');
    expect(result.current.dataStatus).toBe('loaded');
    expect(result.current.dataError).toBeNull();
    expect(result.current.serviceOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Gói Bầu Thư Giãn Bella (450.000đ)',
          value: 'Gói Bầu Thư Giãn Bella',
        }),
      ]),
    );
  });

  it('uses fallback promotions data when the promotions query fails', async () => {
    mockSupabaseOrderResult({ data: null, error: { message: 'promotions unavailable' } });

    const { result } = renderHook(() => useLandingPromotions());

    await waitFor(() => expect(result.current.dataStatus).toBe('fallback'));

    expect(result.current.dataError).toBe('promotions unavailable');
    expect(result.current.promotions).toEqual([]);
  });
});
