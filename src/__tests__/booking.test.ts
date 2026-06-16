import { resolveKtvCommission } from '../core/services/order/commission-actions';

describe('resolveKtvCommission', () => {
  it('should use ktv_commission if present directly on booking', async () => {
    const booking = {
      ktv_commission: 200000,
      packages: {
        ktv_commission: 180000
      }
    };
    
    expect(await resolveKtvCommission(booking)).toBe(200000);
  });

  it('should fallback to package commission if direct booking commission is missing', async () => {
    const booking = {
      packages: {
        ktv_commission: 180000
      }
    };
    
    expect(await resolveKtvCommission(booking)).toBe(180000);
  });

  it('should fallback to default (150000) if both direct and package commission are missing', async () => {
    const booking = {
      packages: {}
    };
    
    expect(await resolveKtvCommission(booking)).toBe(150000);
  });

  it('should handle undefined or null booking by falling back to default', async () => {
    expect(await resolveKtvCommission(null)).toBe(150000);
    expect(await resolveKtvCommission(undefined)).toBe(150000);
  });
});
