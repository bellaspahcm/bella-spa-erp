import { Policy, PolicyResult } from '@/platform/policy-engine/policy';
import { PromotionStackAggregate } from './PromotionStackAggregate';

export interface PricingPolicyContext {
  readonly basePrice: number;
  readonly floorPrice: number;
  readonly promotionStack: PromotionStackAggregate;
}

export class PricingPolicy implements Policy<PricingPolicyContext> {
  readonly name = 'Pricing Policy Limit Validator';
  readonly code = 'RE_PRICING_POLICY';

  public isSatisfiedBy(context: PricingPolicyContext): PolicyResult {
    const totalDiscount = context.promotionStack.calculateDiscount(context.basePrice);
    const finalPrice = context.basePrice - totalDiscount;

    if (finalPrice < context.floorPrice) {
      return {
        satisfied: false,
        violations: [
          {
            code: 'PRICE_BELOW_FLOOR_LIMIT',
            message: `Final calculated price (${finalPrice.toLocaleString()} VND) is below the minimum allowed floor price (${context.floorPrice.toLocaleString()} VND).`,
            field: 'finalPrice',
          },
        ],
      };
    }

    return { satisfied: true, violations: [] };
  }
}
