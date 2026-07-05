/**
 * Leave Approval Decision Engine Integration Tests
 * 
 * Validates end-to-end leave approval workflow with Decision Engine.
 * 
 * Test Scenarios:
 * 1. Approve: Sufficient balance, valid duration
 * 2. Reject: Insufficient balance
 * 3. Reject: Duration exceeds maximum
 * 4. Reject: Long leave without manager approval
 * 5. Reject: Blackout period (Tet, high season)
 * 6. Auto-approve: Sick leave ≤ 3 days
 * 7. Audit trail: All decisions logged correctly
 * 8. Replay: Time Machine works with leave decisions
 */

// Setup environment & mocks BEFORE imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

jest.mock('next/headers', () => ({ cookies: jest.fn() }), { virtual: true });

// Store mock data per test
let mockLeaveRequestData: any = null;
let mockEmployeeData: any = null;

// Create mock Supabase methods
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();

// Build the mock Supabase client
const mockSupabase = {
  from: mockFrom,
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: { id: 'approver-001' } },
      error: null,
    }),
  },
};

// Mock createClient to return the mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Now safe to import
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LeaveDecisionService } from '../leave-decision-service';
import type { LeaveApprovalInput } from '../leave-decision-service';

// Helper to setup mock chain
function setupMockChain(table: string) {
  const chain: any = {};
  
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.single = mockSingle.mockImplementation(async () => {
    if (table === 'leave_requests') {
      return { data: mockLeaveRequestData, error: null };
    } else if (table === 'users') {
      return { data: mockEmployeeData, error: null };
    }
    return { data: null, error: { message: 'Table not found' } };
  });
  chain.update = mockUpdate.mockReturnValue(chain);
  
  mockFrom.mockImplementation((t: string) => {
    if (t === table) return chain;
    return setupMockChain(t);
  });
  
  return chain;
}

describe('Leave Approval - Decision Engine Integration', () => {
  let service: LeaveDecisionService;

  beforeEach(() => {
    service = new LeaveDecisionService();
    jest.clearAllMocks();
    
    // Reset to default mock data
    mockLeaveRequestData = {
      id: 'req-001',
      employee_id: 'emp-123',
      leave_type: 'annual',
      start_date: '2026-07-15',
      end_date: '2026-07-19',
      days: 5,
      reason: 'Family vacation',
      status: 'pending',
      tenant_id: 'tenant-abc',
    };
    
    mockEmployeeData = {
      id: 'emp-123',
      full_name: 'Nguyễn Văn A',
      leave_balance: 12,
    };
    
    // Setup mock chain for both tables
    setupMockChain('leave_requests');
    setupMockChain('users');
  });

  it('should approve leave with sufficient balance', async () => {
    const input: LeaveApprovalInput = {
      requestId: 'req-001',
      approverId: 'approver-001',
      approverRole: 'manager',
      tenantId: 'tenant-abc',
    };

    const result = await service.evaluateLeaveApproval(input);

    expect(result.success).toBe(true);
    expect(result.approved).toBe(true);
    expect(result.reason).toContain('All approval criteria met');
    expect(result.metadata?.confidence).toBeGreaterThan(0.9);
    expect(result.decisionId).toBeDefined();
  });

  it('should reject leave with insufficient balance', async () => {
    // Override mock data for this test
    mockLeaveRequestData = {
      id: 'req-001',
      employee_id: 'emp-123',
      leave_type: 'annual',
      days: 5,
      start_date: '2026-07-15',
      tenant_id: 'tenant-abc',
    };
    
    mockEmployeeData = {
      id: 'emp-123',
      full_name: 'Nguyễn Văn A',
      leave_balance: 3, // Insufficient for 5-day request
    };

    const input: LeaveApprovalInput = {
      requestId: 'req-001',
      approverId: 'approver-001',
      approverRole: 'manager',
      tenantId: 'tenant-abc',
    };

    const result = await service.evaluateLeaveApproval(input);

    expect(result.success).toBe(true);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Insufficient leave balance');
    expect(result.metadata?.confidence).toBe(1.0);
  });

  it('should reject excessive duration (> 30 days)', async () => {
    mockLeaveRequestData = {
      id: 'req-002',
      employee_id: 'emp-123',
      leave_type: 'unpaid',
      days: 45, // Exceeds maximum
      start_date: '2026-08-01',
      tenant_id: 'tenant-abc',
    };
    
    mockEmployeeData = {
      id: 'emp-123',
      full_name: 'Test',
      leave_balance: 50,
    };

    const result = await service.evaluateLeaveApproval({
      requestId: 'req-002',
      approverId: 'approver-001',
      approverRole: 'manager',
      tenantId: 'tenant-abc',
    });

    expect(result.approved).toBe(false);
    expect(result.reason).toContain('exceeds maximum allowed');
  });

  it('should reject long leave (>5 days) without manager approval', async () => {
    mockLeaveRequestData = {
      id: 'req-003',
      employee_id: 'emp-123',
      leave_type: 'annual',
      days: 7, // > 5 days
      start_date: '2026-07-15',
      tenant_id: 'tenant-abc',
    };
    
    mockEmployeeData = {
      id: 'emp-123',
      full_name: 'Test',
      leave_balance: 15,
    };

    const result = await service.evaluateLeaveApproval({
      requestId: 'req-003',
      approverId: 'approver-001',
      approverRole: 'staff', // Not manager
      tenantId: 'tenant-abc',
    });

    expect(result.approved).toBe(false);
    expect(result.reason).toContain('require manager approval');
    expect(result.metadata?.requiresEscalation).toBe(true);
  });

  it('should reject during Tet blackout period', async () => {
    mockLeaveRequestData = {
      id: 'req-004',
      employee_id: 'emp-123',
      leave_type: 'annual',
      days: 3,
      start_date: '2026-01-25', // During Tet
      tenant_id: 'tenant-abc',
    };
    
    mockEmployeeData = {
      id: 'emp-123',
      full_name: 'Test',
      leave_balance: 15,
    };

    const result = await service.evaluateLeaveApproval({
      requestId: 'req-004',
      approverId: 'approver-001',
      approverRole: 'manager',
      tenantId: 'tenant-abc',
    });

    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Tet holiday period');
    expect(result.metadata?.blackoutPeriod).toBe('tet-2026');
  });

  it('should auto-approve sick leave ≤ 3 days', async () => {
    mockLeaveRequestData = {
      id: 'req-005',
      employee_id: 'emp-123',
      leave_type: 'sick',
      days: 2,
      start_date: '2026-07-15',
      tenant_id: 'tenant-abc',
    };
    
    mockEmployeeData = {
      id: 'emp-123',
      full_name: 'Test',
      leave_balance: 10,
    };

    const result = await service.evaluateLeaveApproval({
      requestId: 'req-005',
      approverId: 'approver-001',
      approverRole: 'staff',
      tenantId: 'tenant-abc',
    });

    expect(result.approved).toBe(true);
    expect(result.reason).toContain('Sick leave auto-approved');
    expect(result.metadata?.autoApproved).toBe(true);
    expect(result.metadata?.confidence).toBe(1.0);
  });
});
