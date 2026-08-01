import { PriceListAggregate, PriceItem } from '../domain/PriceListAggregate';
import { PromotionStackAggregate, Promotion } from '../domain/PromotionStackAggregate';
import { PricingPolicy } from '../domain/PricingPolicy';
import { PriceCalculator, PremiumCoefficients } from '../domain/PriceCalculator';

describe('Pricing Bounded Context', () => {
  const tenantId = 'tenant-abc';
  const projectId = 'project-xyz';

  describe('PriceListAggregate', () => {
    const items = new Map<string, PriceItem>([
      ['prod-1', { productId: 'prod-1', basePrice: 1000000, pricePerM2: 20000, floorPrice: 900000, maxDiscountRate: 10 }],
    ]);

    it('should create PriceListAggregate with draft status', () => {
      const priceList = PriceListAggregate.create({
        tenantId,
        projectId,
        name: 'Launch Price List v1',
        version: 1,
        effectiveFrom: new Date(),
        status: 'draft',
        items,
      });

      expect(priceList.status).toBe('draft');
      expect(priceList.version).toBe(1);
    });

    it('should execute approval state transitions', () => {
      const priceList = PriceListAggregate.create({
        tenantId,
        projectId,
        name: 'Launch Price List v1',
        version: 1,
        effectiveFrom: new Date(),
        status: 'draft',
        items,
      });

      priceList.submitForApproval();
      expect(priceList.status).toBe('pending_approval');

      priceList.approve('admin-1');
      expect(priceList.status).toBe('published');

      priceList.rollback();
      expect(priceList.status).toBe('rolled_back');
    });

    it('should fail invalid state transitions', () => {
      const priceList = PriceListAggregate.create({
        tenantId,
        projectId,
        name: 'Launch Price List v1',
        version: 1,
        effectiveFrom: new Date(),
        status: 'draft',
        items,
      });

      expect(() => priceList.approve('admin-1')).toThrow(
        'Cannot approve price list from status "draft"'
      );
    });
  });

  describe('PromotionStackAggregate', () => {
    const earlyBird: Promotion = {
      id: 'promo-1',
      name: 'Early Bird discount',
      type: 'early_bird',
      discountType: 'percentage',
      discountValue: 5,
      stackable: true,
    };

    const vip: Promotion = {
      id: 'promo-2',
      name: 'VIP Member discount',
      type: 'vip',
      discountType: 'fixed',
      discountValue: 100000000, // 100M
      stackable: true,
    };

    const bulk: Promotion = {
      id: 'promo-3',
      name: 'Bulk discount non-stackable',
      type: 'bulk',
      discountType: 'percentage',
      discountValue: 10,
      stackable: false,
    };

    it('should calculate stacked discounts in correct order (fixed then percentage)', () => {
      const stack = PromotionStackAggregate.create([earlyBird, vip]);
      // base price: 3,000,000,000 (3B)
      // fixed discount: -100,000,000 -> 2,900,000,000
      // percentage discount: 5% of 2.9B -> 145,000,000
      // Total expected discount: 245,000,000
      const discount = stack.calculateDiscount(3000000000);
      expect(discount).toBe(245000000);
    });

    it('should reject combining multiple non-stackable promotions', () => {
      const bulk2: Promotion = {
        id: 'promo-4',
        name: 'Bulk discount 2 non-stackable',
        type: 'bulk',
        discountType: 'percentage',
        discountValue: 8,
        stackable: false,
      };

      expect(() => {
        PromotionStackAggregate.create([bulk, bulk2]);
      }).toThrow('Multiple non-stackable promotions cannot be combined');
    });

    it('should reject stacking promotions of the same type', () => {
      const earlyBird2: Promotion = {
        id: 'promo-5',
        name: 'Early Bird discount 2',
        type: 'early_bird',
        discountType: 'percentage',
        discountValue: 3,
        stackable: true,
      };

      expect(() => {
        PromotionStackAggregate.create([earlyBird, earlyBird2]);
      }).toThrow('Cannot stack multiple promotions of the same type');
    });
  });

  describe('PricingPolicy', () => {
    const policy = new PricingPolicy();

    const earlyBird: Promotion = {
      id: 'promo-1',
      name: 'Early Bird 5%',
      type: 'early_bird',
      discountType: 'percentage',
      discountValue: 5,
      stackable: true,
    };

    const bankDiscount: Promotion = {
      id: 'promo-2',
      name: 'Bank promotion 10%',
      type: 'bank_discount',
      discountType: 'percentage',
      discountValue: 10,
      stackable: true,
    };

    it('should satisfy policy if discount does not violate floor price threshold', () => {
      const stack = PromotionStackAggregate.create([earlyBird]);
      // Base: 1,000,000,000. Floor: 900,000,000.
      // Discount: 50,000,000. Final: 950,000,000 (>= 900M)
      const res = policy.isSatisfiedBy({
        basePrice: 1000000000,
        floorPrice: 900000000,
        promotionStack: stack,
      });

      expect(res.satisfied).toBe(true);
    });

    it('should fail policy if final price falls below floor price threshold', () => {
      const stack = PromotionStackAggregate.create([earlyBird, bankDiscount]);
      // Base: 1,000,000,000. Floor: 900,000,000.
      // Discount: 5% (50M) -> 950M. Then 10% of 950M (95M) -> Total: 145M
      // Final: 855,000,000 (< 900M)
      const res = policy.isSatisfiedBy({
        basePrice: 1000000000,
        floorPrice: 900000000,
        promotionStack: stack,
      });

      expect(res.satisfied).toBe(false);
      expect(res.violations[0].code).toBe('PRICE_BELOW_FLOOR_LIMIT');
    });
  });

  describe('PriceCalculator Coefficients', () => {
    const coeffs: PremiumCoefficients = {
      directionMultipliers: { East: 1.02, West: 0.98 },
      viewMultipliers: { Pool: 1.05, City: 1.02 },
      floorPremiumRate: 0.005,
    };
    const calculator = new PriceCalculator(coeffs);

    it('should calculate price with East direction, Pool view, and floor level premium', () => {
      // Base: 2,000,000,000 (2B)
      // Direction multiplier (East): 1.02 -> 2.04B
      // View multiplier (Pool): 1.05 -> 2.142B
      // Floor premium: (15 - 1) * 0.005 = 0.07 (7%) of 2B -> 140M
      // Expected total: 2.142B + 140M = 2,282,000,000
      const price = calculator.calculateAdjustedPrice({
        basePrice: 2000000000,
        direction: 'East',
        view: 'Pool',
        floorNumber: 15,
      });

      expect(price).toBe(2282000000);
    });
  });
});
