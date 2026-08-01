export interface PremiumCoefficients {
  readonly directionMultipliers: Record<string, number>; // e.g., { 'East': 1.02, 'West': 0.98 }
  readonly viewMultipliers: Record<string, number>;      // e.g., { 'Pool': 1.05, 'City': 1.02 }
  readonly floorPremiumRate: number;                     // e.g., 0.005 per floor above ground floor
}

export class PriceCalculator {
  constructor(private readonly coefficients: PremiumCoefficients) {}

  /**
   * Calculate adjusted base price based on view, direction, and floor level coefficients
   */
  public calculateAdjustedPrice(params: {
    readonly basePrice: number;
    readonly direction: string;
    readonly view: string;
    readonly floorNumber: number;
  }): number {
    let adjusted = params.basePrice;

    // Apply Direction multiplier
    const dirKey = params.direction.trim();
    if (this.coefficients.directionMultipliers[dirKey]) {
      adjusted *= this.coefficients.directionMultipliers[dirKey];
    }

    // Apply View multiplier
    const viewKey = params.view.trim();
    if (this.coefficients.viewMultipliers[viewKey]) {
      adjusted *= this.coefficients.viewMultipliers[viewKey];
    }

    // Apply Floor premium rate: premium = base * (floorNumber * rate)
    if (params.floorNumber > 1) {
      const floorPremium = params.basePrice * ((params.floorNumber - 1) * this.coefficients.floorPremiumRate);
      adjusted += floorPremium;
    }

    return Math.round(adjusted);
  }
}
