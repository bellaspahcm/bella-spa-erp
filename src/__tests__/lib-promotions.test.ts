/**
 * Unit tests for promotion utility functions.
 * Tests date-based promotion filtering and activation logic.
 */

import { isPromotionActiveOnDate, filterActivePromotions } from '@/lib/promotions';
import type { Database } from '@/types/database.types';

type Promotion = Database['public']['Tables']['promotions']['Row'];

const createPromotion = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: 'promo-1',
  title: 'Mother Day',
  description: 'Discount services',
  image_url: null,
  discount_code: 'MOTHER10',
  discount_percent: 10,
  start_date: '2026-05-01',
  end_date: '2026-05-31',
  is_active: true,
  tenant_id: 'tenant-123',
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
  ...overrides,
});

describe('lib/promotions: isPromotionActiveOnDate', () => {
  it('returns true when is_active=true and date is within range', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2026-05-15')).toBe(true);
  });

  it('returns true when date equals start_date', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2026-05-01')).toBe(true);
  });

  it('returns true when date equals end_date', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2026-05-31')).toBe(true);
  });

  it('returns false when is_active=false', () => {
    const promo = createPromotion({
      is_active: false,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2026-05-15')).toBe(false);
  });

  it('returns false when date is before start_date', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2026-04-30')).toBe(false);
  });

  it('returns false when date is after end_date', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2026-06-01')).toBe(false);
  });

  it('returns true when start_date is null (no start constraint)', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: null,
      end_date: '2026-05-31',
    });

    expect(isPromotionActiveOnDate(promo, '2025-12-01')).toBe(true);
  });

  it('returns true when end_date is null (no end constraint)', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: '2026-05-01',
      end_date: null,
    });

    expect(isPromotionActiveOnDate(promo, '2027-01-01')).toBe(true);
  });

  it('returns true when both start_date and end_date are null', () => {
    const promo = createPromotion({
      is_active: true,
      start_date: null,
      end_date: null,
    });

    expect(isPromotionActiveOnDate(promo, '2026-05-15')).toBe(true);
  });

  it('returns false when both dates null but is_active=false', () => {
    const promo = createPromotion({
      is_active: false,
      start_date: null,
      end_date: null,
    });

    expect(isPromotionActiveOnDate(promo, '2026-05-15')).toBe(false);
  });
});

describe('lib/promotions: filterActivePromotions', () => {
  it('returns only active promotions for given date', () => {
    const promos: Promotion[] = [
      createPromotion({ id: 'promo-1', is_active: true, start_date: '2026-05-01', end_date: '2026-05-31' }),
      createPromotion({ id: 'promo-2', is_active: false, start_date: '2026-05-01', end_date: '2026-05-31' }),
      createPromotion({ id: 'promo-3', is_active: true, start_date: '2026-06-01', end_date: '2026-06-30' }),
    ];

    const result = filterActivePromotions(promos, '2026-05-15');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('promo-1');
  });

  it('returns empty array when no promotions match', () => {
    const promos: Promotion[] = [
      createPromotion({ id: 'promo-1', is_active: true, start_date: '2026-06-01', end_date: '2026-06-30' }),
    ];

    const result = filterActivePromotions(promos, '2026-05-15');

    expect(result).toEqual([]);
  });

  it('returns multiple active promotions when they all match', () => {
    const promos: Promotion[] = [
      createPromotion({ id: 'promo-1', is_active: true, start_date: '2026-05-01', end_date: '2026-05-31' }),
      createPromotion({ id: 'promo-2', is_active: true, start_date: '2026-05-01', end_date: '2026-06-30' }),
      createPromotion({ id: 'promo-3', is_active: true, start_date: null, end_date: null }),
    ];

    const result = filterActivePromotions(promos, '2026-05-15');

    expect(result).toHaveLength(3);
  });

  it('returns empty array for empty input', () => {
    const result = filterActivePromotions([], '2026-05-15');

    expect(result).toEqual([]);
  });
});
