export interface Promotion {
  readonly id: string;
  readonly name: string;
  readonly type: 'early_bird' | 'vip' | 'bulk' | 'bank_discount' | 'campaign';
  readonly discountType: 'percentage' | 'fixed';
  readonly discountValue: number;
  readonly stackable: boolean;
}

export class PromotionStackAggregate {
  private constructor(private readonly promotions: Promotion[]) {
    // 1. Verify stack rules
    const nonStackableCount = promotions.filter(p => !p.stackable).length;
    if (nonStackableCount > 1) {
      throw new Error('Multiple non-stackable promotions cannot be combined');
    }
    if (nonStackableCount === 1 && promotions.length > 1) {
      // Find the non-stackable one
      const nonStackable = promotions.find(p => !p.stackable)!;
      throw new Error(`Promotion "${nonStackable.name}" is non-stackable and cannot be combined with other promotions`);
    }

    // 2. Ensure only one promotion per type is allowed to prevent duplicate stacking of same class
    const types = promotions.map(p => p.type);
    const uniqueTypes = new Set(types);
    if (uniqueTypes.size !== types.length) {
      throw new Error('Cannot stack multiple promotions of the same type');
    }
  }

  public static create(promotions: Promotion[]): PromotionStackAggregate {
    return new PromotionStackAggregate(promotions);
  }

  public getAppliedPromotions(): Promotion[] {
    return [...this.promotions];
  }

  /**
   * Calculates the total stacked discount amount based on base price
   */
  public calculateDiscount(basePrice: number): number {
    let totalDiscount = 0;
    let runningPrice = basePrice;

    // Apply fixed discounts first, then percentage discounts
    const fixedPromotions = this.promotions.filter(p => p.discountType === 'fixed');
    const percentagePromotions = this.promotions.filter(p => p.discountType === 'percentage');

    for (const promo of fixedPromotions) {
      totalDiscount += promo.discountValue;
      runningPrice = Math.max(0, runningPrice - promo.discountValue);
    }

    for (const promo of percentagePromotions) {
      const discount = (runningPrice * promo.discountValue) / 100;
      totalDiscount += discount;
      runningPrice = Math.max(0, runningPrice - discount);
    }

    return totalDiscount;
  }
}
