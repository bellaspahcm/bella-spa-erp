/**
 * Tests for GPS Geocoding and Customer Geolocation Capture
 */

// Bypass Next.js server-only check
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();

// Mock query builder helper that returns promises properly for Supabase chaining
class MockQueryBuilder {
  private resultPromise: Promise<any>;

  constructor(data: any = null, error: any = null) {
    this.resultPromise = Promise.resolve({ data, error });
  }

  select(...args: any[]) { mockSelect(...args); return this; }
  insert(...args: any[]) { mockInsert(...args); return this; }
  update(...args: any[]) { mockUpdate(...args); return this; }
  delete(...args: any[]) { mockDelete(...args); return this; }
  eq(...args: any[]) { mockEq(...args); return this; }
  order(...args: any[]) { mockOrder(...args); return this; }
  single(...args: any[]) { mockSingle(...args); return this; }
  maybeSingle(...args: any[]) { mockMaybeSingle(...args); return this; }

  then(onfulfilled: any, onrejected?: any) {
    return this.resultPromise.then(onfulfilled, onrejected);
  }
}

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

// Mock lib/supabase-server
jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock user-actions getCurrentUser
const mockGetCurrentUser = jest.fn();
jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock revalidate helper
jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));

const mockRecordAuditLog = jest.fn();
jest.mock('../services/audit-actions', () => ({
  recordAuditLog: (...args: any[]) => mockRecordAuditLog(...args),
}));

import { geocodeAddress, createCustomer, updateCustomer } from '../services/customer-actions';
import { startSession, completeKTVSession } from '../services/ktv-actions';

describe('GPS Geocoding & Customer Geolocation Capture Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockRecordAuditLog.mockResolvedValue({ success: true });
  });

  describe('geocodeAddress', () => {
    it('returns coordinates when Nominatim search succeeds', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ lat: '10.762622', lon: '106.660172' }]),
      });

      const coords = await geocodeAddress('123 Nguyen Tri Phuong, Q10, HCM');
      expect(coords).toEqual({ latitude: 10.762622, longitude: 106.660172 });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('https://nominatim.openstreetmap.org/search');
    });

    it('returns null when Nominatim search returns no results', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const coords = await geocodeAddress('NonExistentAddress12345');
      expect(coords).toBeNull();
    });

    it('returns null and logs warning when Nominatim returns non-ok status', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      });
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const coords = await geocodeAddress('123 Nguyen Tri Phuong');
      expect(coords).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('createCustomer & updateCustomer geocoding', () => {
    const mockAdminUser = { id: 'admin-1', role: 'admin', tenant_id: 'tenant-1' };

    it('createCustomer calls geocodeAddress when address is provided and lat/lon are missing', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ lat: '10.762622', lon: '106.660172' }]),
      });

      mockSupabaseClient.from.mockImplementation(() => new MockQueryBuilder([{ id: 'cust-1' }], null));

      const customerData = { name: 'Customer A', address: '123 Nguyen Tri Phuong' };
      const result = await createCustomer(customerData);

      expect(result).toEqual({ data: { id: 'cust-1' }, error: null, warning: null });
      expect(mockInsert).toHaveBeenCalledWith([
        {
          name: 'Customer A',
          address: '123 Nguyen Tri Phuong',
          tenant_id: 'tenant-1',
          latitude: 10.762622,
          longitude: 106.660172,
        },
      ]);
    });

    it('createCustomer does not call geocodeAddress if lat/lon are explicitly provided', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      const mockFetch = global.fetch as jest.Mock;
      mockSupabaseClient.from.mockImplementation(() => new MockQueryBuilder({ id: 'cust-1' }, null));

      const customerData = {
        name: 'Customer A',
        address: '123 Nguyen Tri Phuong',
        latitude: 10.123,
        longitude: 106.123,
      };
      await createCustomer(customerData);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalledWith([
        {
          name: 'Customer A',
          address: '123 Nguyen Tri Phuong',
          tenant_id: 'tenant-1',
          latitude: 10.123,
          longitude: 106.123,
        },
      ]);
    });

    it('createCustomer rolls back inserted customer when audit logging fails', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockRecordAuditLog.mockRejectedValue(new Error('Audit write failed'));
      mockSupabaseClient.from.mockImplementation(() => new MockQueryBuilder([{ id: 'cust-1' }], null));

      const result = await createCustomer({ name: 'Customer A' });

      expect(result).toEqual({ data: null, error: 'Audit write failed', warning: null });
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'cust-1');
    });

    it('updateCustomer calls geocodeAddress when address is changed and lat/lon are missing', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ lat: '10.999', lon: '106.999' }]),
      });

      // Mock sequence:
      // 1. Fetching old customer
      // 2. Updating customer
      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'customers') {
          // Check calls to determine if it is the select (first query) or update
          return new MockQueryBuilder({ id: 'cust-1', address: 'Old Address', latitude: 10.0, longitude: 106.0 }, null);
        }
        return new MockQueryBuilder(null, null);
      });

      const customerData = { address: 'New Address' };
      await updateCustomer('cust-1', customerData);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        address: 'New Address',
        latitude: 10.999,
        longitude: 106.999,
      });
    });

    it('updateCustomer does not call geocodeAddress if address is not changed', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      const mockFetch = global.fetch as jest.Mock;

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'customers') {
          return new MockQueryBuilder({ id: 'cust-1', address: 'Old Address', latitude: 10.0, longitude: 106.0 }, null);
        }
        return new MockQueryBuilder(null, null);
      });

      const customerData = { name: 'New Name' };
      await updateCustomer('cust-1', customerData);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'New Name',
      });
    });
  });

  describe('startSession GPS coordinate capture', () => {
    const mockKtvUser = { id: 'ktv-1', role: 'ktv', tenant_id: 'tenant-1' };

    it('automatically assigns coordinates to customer when customer GPS coordinates are missing', async () => {
      mockGetCurrentUser.mockResolvedValue(mockKtvUser);

      // We need to mock:
      // 1. Select session details, bookings and customer latitude/longitude
      // 2. Update booking (completed_sessions etc)
      // 3. Update customer table with coordinates (GPS Capture)
      const mockSessionData = {
        booking_id: 'booking-1',
        session_number: 1,
        bookings: {
          customer_id: 'cust-123',
          total_sessions: 10,
          completed_sessions: 0,
          status: 'scheduled',
          customers: {
            latitude: null,
            longitude: null,
          },
        },
      };

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'session_logs') {
          return new MockQueryBuilder(mockSessionData, null);
        }
        if (table === 'bookings') {
          return new MockQueryBuilder({}, null);
        }
        if (table === 'customers') {
          return new MockQueryBuilder({}, null);
        }
        return new MockQueryBuilder(null, null);
      });

      const result = await startSession('session-1', 10.5, 106.5);

      expect(result.success).toBe(true);

      // Verify customer coordinates update
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('customers');
      expect(mockUpdate).toHaveBeenCalledWith({
        latitude: 10.5,
        longitude: 106.5,
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'cust-123');
    });

    it('does not overwrite customer coordinates if they are already present', async () => {
      mockGetCurrentUser.mockResolvedValue(mockKtvUser);

      const mockSessionData = {
        booking_id: 'booking-1',
        session_number: 1,
        bookings: {
          customer_id: 'cust-123',
          total_sessions: 10,
          completed_sessions: 0,
          status: 'scheduled',
          customers: {
            latitude: 10.762,
            longitude: 106.66,
          },
        },
      };

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'session_logs') {
          return new MockQueryBuilder(mockSessionData, null);
        }
        if (table === 'bookings') {
          return new MockQueryBuilder({}, null);
        }
        return new MockQueryBuilder(null, null);
      });

      const result = await startSession('session-1', 10.5, 106.5);

      expect(result.success).toBe(true);

      // Verify update on customers table was NOT called
      expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('customers');
      expect(mockUpdate).not.toHaveBeenCalledWith({
        latitude: 10.5,
        longitude: 106.5,
      });
    });
  });

  describe('completeKTVSession GPS coordinate capture', () => {
    const mockKtvUser = { id: 'ktv-1', role: 'ktv', tenant_id: 'tenant-1' };

    it('saves checkout coordinates in session_logs when coordinates are provided', async () => {
      mockGetCurrentUser.mockResolvedValue(mockKtvUser);

      const mockSessionData = {
        booking_id: 'booking-1',
        start_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        bookings: {
          package_id: 'pkg-1',
          packages: {
            duration: '60 phút',
          },
        },
      };

      mockSupabaseClient.from.mockImplementation((table) => {
        if (table === 'session_logs') {
          return new MockQueryBuilder(mockSessionData, null);
        }
        if (table === 'bookings') {
          return new MockQueryBuilder({ total_sessions: 10 }, null);
        }
        return new MockQueryBuilder(null, null);
      });

      const result = await completeKTVSession('session-1', 'Notes', 'Checkout Note', 10.77, 106.70);

      expect(result.success).toBe(true);

      // Verify session update payload includes checkout coordinates
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('session_logs');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
        notes: 'Notes',
        ktv_checkout_note: 'Checkout Note',
        checkout_lat: 10.77,
        checkout_lon: 106.70,
      }));
    });
  });
});
