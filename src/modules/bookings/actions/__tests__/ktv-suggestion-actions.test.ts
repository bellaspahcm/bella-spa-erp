/**
 * KTV Suggestion Actions Tests
 *
 * Tests for admin-facing Decision Engine suggestion actions:
 * - getKtvSuggestions()
 * - applyKtvSuggestion()
 */

const mockCreateClient = jest.fn();
const mockAutoAssignKtv = jest.fn();

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

// Mock booking decision service
jest.mock('@/services/booking-decision.service', () => ({
  autoAssignKtv: (...args: unknown[]) => mockAutoAssignKtv(...args),
}));

import { getKtvSuggestions, applyKtvSuggestion } from '../ktv-suggestion-actions';

describe('KTV AI Suggestion Actions', () => {
  let mockSupabase: any;
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }),
      },
    };

    mockCreateClient.mockReturnValue(mockSupabase);
  });

  describe('getKtvSuggestions()', () => {
    it('should return suggestions from the Decision Engine successfully', async () => {
      // Mock booking lookup
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'booking-123',
          tenant_id: 'tenant-001',
          customer_id: 'customer-456',
          assigned_ktv_id: null,
          packages: {
            name: 'Combo Mẹ & Bé Hạnh Phúc',
            module_key: 'babycare',
            default_duration_minutes: 90,
          },
        },
        error: null,
      });

      // Mock customer tier lookup
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          loyalty_points: 1200,
          metadata: { status: 'vip' },
        },
        error: null,
      });

      // Mock Decision Engine results
      mockAutoAssignKtv.mockResolvedValue({
        assignedKtvId: 'ktv-optimal',
        assignedKtvName: 'KTV Optimal',
        confidence: 0.95,
        reason: 'Assigned to KTV Optimal (score: 95/100): Excellent ratings',
        executionTime: 12.4,
        alternatives: [
          {
            ktvId: 'ktv-runnerup',
            ktvName: 'KTV Runner Up',
            score: 85,
            reason: 'Assigned to KTV Runner Up (score: 85/100): High availability',
          },
        ],
      });

      const result = await getKtvSuggestions({
        bookingId: 'booking-123',
        tenantId: 'tenant-001',
        requestedDate: '2026-07-15',
        requestedStartTime: '14:00',
        durationMinutes: 90,
      });

      expect(result.success).toBe(true);
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].isRecommended).toBe(true);
      expect(result.suggestions[0].score).toBe(100); // hardcoded for winner wrapper in actions
      expect(result.suggestions[1].isRecommended).toBe(false);
      expect(result.suggestions[1].score).toBe(85);
      expect(result.evaluationMetadata?.executionTimeMs).toBe(12.4);
    });

    it('should return error if booking is not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: new Error('Not found'),
      });

      const result = await getKtvSuggestions({
        bookingId: 'booking-invalid',
        tenantId: 'tenant-001',
        requestedDate: '2026-07-15',
        requestedStartTime: '14:00',
        durationMinutes: 90,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Không tìm thấy booking');
    });
  });

  describe('applyKtvSuggestion()', () => {
    it('should update assigned_ktv_id successfully', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'booking-123', tenant_id: 'tenant-001', status: 'active' },
        error: null,
      });

      mockQueryBuilder.update.mockReturnThis();
      mockQueryBuilder.eq.mockReturnThis();
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: null });

      const result = await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-001');

      expect(result.success).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ assigned_ktv_id: 'ktv-selected' });
    });

    it('should fail if booking does not exist under tenant', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Booking not found'),
      });

      const result = await applyKtvSuggestion('booking-123', 'ktv-selected', 'tenant-different');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking không tồn tại hoặc không thuộc chi nhánh này');
    });
  });
});
