/**
 * Spec tests for Portal Chat Actions (getPortalChatMessages, sendPortalChatMessage, markPortalMessagesAsRead)
 * Validates security boundaries (share_token), Zero Silent Database Failures, and proper payload assertions.
 */

// Bypass Next.js server-only check
jest.mock('server-only', () => ({}), { virtual: true });

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
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
  eq(...args: any[]) { mockEq(...args); return this; }
  order(...args: any[]) { mockOrder(...args); return this; }
  single(...args: any[]) { mockSingle(...args); return this; }
  maybeSingle(...args: any[]) { mockMaybeSingle(...args); return this; }

  // Custom then-able implementation to resolve the promise chain
  then(onfulfilled: any, onrejected?: any) {
    return this.resultPromise.then(onfulfilled, onrejected);
  }
}

// Mock client
const mockSupabaseClient = {
  from: jest.fn(),
};

// Mock @supabase/supabase-js library
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

import { 
  getPortalChatMessages, 
  sendPortalChatMessage, 
  markPortalMessagesAsRead 
} from '../services/portal-chat-actions';

describe('Portal Chat Actions System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock environment variables
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-url.supabase.co';

    // Default mock setup: table 'bookings' returns a valid customer_id and tenant_id
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
      }
      return new MockQueryBuilder([], null);
    });
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  describe('Token Validation & Security Boundary', () => {
    it('fails when token is empty or missing', async () => {
      const result = await getPortalChatMessages('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Mã liên kết (token) không được để trống.');
    });

    it('fails when share token does not exist in the database', async () => {
      // Simulate booking not found
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder(null, null); // returns no booking
        }
        return new MockQueryBuilder([], null);
      });

      const result = await getPortalChatMessages('invalid-token');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Liên kết không hợp lệ hoặc đã hết hạn.');
    });

    it('propagates database error during token verification (Zero Silent Database Failures)', async () => {
      // Simulate database crash on bookings table
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder(null, { message: 'Database connection failed' });
        }
        return new MockQueryBuilder([], null);
      });

      const result = await getPortalChatMessages('some-token');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Lỗi kết nối cơ sở dữ liệu khi xác thực token: Database connection failed');
    });
  });

  describe('getPortalChatMessages', () => {
    it('successfully retrieves messages ordered chronologically', async () => {
      const mockMessages = [
        { id: '1', message: 'Hello', sender_type: 'customer', created_at: '2026-05-28T00:00:00Z' },
        { id: '2', message: 'Hi there', sender_type: 'staff', created_at: '2026-05-28T00:01:00Z' },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
        }
        if (table === 'chat_messages') {
          return new MockQueryBuilder(mockMessages, null);
        }
        return new MockQueryBuilder([], null);
      });

      const result = await getPortalChatMessages('valid-token');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMessages);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chat_messages');
      expect(mockEq).toHaveBeenCalledWith('customer_id', 'cust-123');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('propagates errors when fetching messages fails (Zero Silent Database Failures)', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
        }
        if (table === 'chat_messages') {
          return new MockQueryBuilder(null, { message: 'Query timeout' });
        }
        return new MockQueryBuilder([], null);
      });

      const result = await getPortalChatMessages('valid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query timeout');
    });
  });

  describe('sendPortalChatMessage', () => {
    it('fails if message content is blank', async () => {
      const result = await sendPortalChatMessage('valid-token', '   ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Nội dung tin nhắn không được để trống.');
    });

    it('successfully inserts message with correct customer and tenant ids', async () => {
      const mockInsertedMsg = {
        id: 'msg-999',
        customer_id: 'cust-123',
        tenant_id: 'tenant-456',
        message: 'Hello Spa!',
        sender_type: 'customer',
        sender_id: null,
        is_read: false,
        created_at: new Date().toISOString()
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
        }
        if (table === 'chat_messages') {
          return new MockQueryBuilder(mockInsertedMsg, null);
        }
        return new MockQueryBuilder([], null);
      });

      const result = await sendPortalChatMessage('valid-token', 'Hello Spa!');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInsertedMsg);

      // Verify the correct payload was inserted (Rule 2: Mandatory Side-Effect Assertions)
      expect(mockInsert).toHaveBeenCalledWith({
        customer_id: 'cust-123',
        tenant_id: 'tenant-456',
        message: 'Hello Spa!',
        sender_type: 'customer',
        sender_id: null,
        is_read: false
      });
    });

    it('propagates database error when insertion fails (Zero Silent Database Failures)', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
        }
        if (table === 'chat_messages') {
          return new MockQueryBuilder(null, { message: 'Unique constraint violation on chat_messages' });
        }
        return new MockQueryBuilder([], null);
      });

      const result = await sendPortalChatMessage('valid-token', 'Hello!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unique constraint violation on chat_messages');
    });
  });

  describe('markPortalMessagesAsRead', () => {
    it('successfully updates staff messages for this customer to read', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
        }
        if (table === 'chat_messages') {
          return new MockQueryBuilder([], null);
        }
        return new MockQueryBuilder([], null);
      });

      const result = await markPortalMessagesAsRead('valid-token');

      expect(result.success).toBe(true);
      
      // Verify correct side-effect updates are asserted (Rule 2)
      expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
      expect(mockEq).toHaveBeenCalledWith('customer_id', 'cust-123');
      expect(mockEq).toHaveBeenCalledWith('tenant_id', 'tenant-456');
      expect(mockEq).toHaveBeenCalledWith('sender_type', 'staff');
      expect(mockEq).toHaveBeenCalledWith('is_read', false);
    });

    it('propagates database error when update fails (Zero Silent Database Failures)', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'bookings') {
          return new MockQueryBuilder({ customer_id: 'cust-123', tenant_id: 'tenant-456' });
        }
        if (table === 'chat_messages') {
          return new MockQueryBuilder(null, { message: 'Database write error' });
        }
        return new MockQueryBuilder([], null);
      });

      const result = await markPortalMessagesAsRead('valid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database write error');
    });
  });
});
