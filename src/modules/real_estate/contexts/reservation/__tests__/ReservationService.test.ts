import { supabase } from '@/lib/supabase';
import { reservationService } from '../application/ReservationService';

const mockQueryBuilder = {
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
};

describe('ReservationService', () => {
  const tenantId = 'tenant-123';
  const productId = 'prod-456';
  const reservationId = 'res-789';

  let spyRpc: jest.SpyInstance;
  let spyFrom: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    spyRpc = jest.spyOn(supabase as any, 'rpc');
    spyFrom = jest.spyOn(supabase as any, 'from').mockReturnValue(mockQueryBuilder as any);
  });

  afterEach(() => {
    spyRpc.mockRestore();
    spyFrom.mockRestore();
  });

  describe('reserveProduct', () => {
    it('should invoke supabase reserve_product RPC and return success', async () => {
      spyRpc.mockResolvedValueOnce({
        data: { success: true, reservation_id: 'res-789', expires_at: '2026-08-01T16:00:00Z' },
        error: null,
      });

      const res = await reservationService.reserveProduct({
        tenantId,
        productId,
        durationMinutes: 15,
      });

      expect(spyRpc).toHaveBeenCalledWith('reserve_product', {
        p_tenant_id: tenantId,
        p_product_id: productId,
        p_user_id: null,
        p_customer_id: null,
        p_duration_minutes: 15,
      });

      expect(res.success).toBe(true);
      expect(res.reservationId).toBe('res-789');
    });

    it('should return error code if product is already locked/booked', async () => {
      spyRpc.mockResolvedValueOnce({
        data: { success: false, error: 'PRODUCT_NOT_AVAILABLE' },
        error: null,
      });

      const res = await reservationService.reserveProduct({
        tenantId,
        productId,
        durationMinutes: 15,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('PRODUCT_NOT_AVAILABLE');
    });

    it('should propagate database connection errors', async () => {
      spyRpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database server disconnected'),
      });

      await expect(
        reservationService.reserveProduct({ tenantId, productId, durationMinutes: 15 })
      ).rejects.toThrow('Database server disconnected');
    });
  });

  describe('releaseProduct', () => {
    it('should execute updates on both reservations and products tables', async () => {
      mockQueryBuilder.eq
        .mockReturnValueOnce(mockQueryBuilder) // first eq of reservations update
        .mockResolvedValueOnce({ error: null }) // second eq of reservations update
        .mockReturnValueOnce(mockQueryBuilder) // first eq of products update
        .mockResolvedValueOnce({ error: null }); // second eq of products update

      await expect(
        reservationService.releaseProduct(tenantId, productId, reservationId)
      ).resolves.not.toThrow();

      expect(spyFrom).toHaveBeenNthCalledWith(1, 're_reservations');
      expect(spyFrom).toHaveBeenNthCalledWith(2, 'real_estate_products');
    });

    it('should propagate errors if updates fail', async () => {
      mockQueryBuilder.eq
        .mockReturnValueOnce(mockQueryBuilder)
        .mockResolvedValueOnce({ error: new Error('Failed updating reservation') });

      await expect(
        reservationService.releaseProduct(tenantId, productId, reservationId)
      ).rejects.toThrow('Failed updating reservation');
    });
  });
});
