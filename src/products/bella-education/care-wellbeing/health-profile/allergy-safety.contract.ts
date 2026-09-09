export interface ICheckMealSafetyCommand {
  tenantId: string;
  studentId: string;
  mealItemId: string;
}

export interface IAllergyExposureResult {
  isSafe: boolean;
  blockReason?: string;
  conflictingAllergens?: string[];
}

export interface IAllergySafetyContract {
  /**
   * Evaluates if a specific meal is safe for a child based on their active allergy profile
   * and the meal's ingredients mapping to canonical allergens.
   *
   * 1. Looks up the child's active allergies (`edu_child_allergies`) -> `allergen_id`.
   * 2. Looks up the meal's ingredients (`edu_meal_item_ingredients`) -> `ingredient_id`.
   * 3. Looks up the allergens for those ingredients (`edu_ingredient_allergens`) -> `allergen_id`.
   * 4. Intersects child's allergens with meal's allergens.
   *
   * @throws ALLERGY_EXPOSURE_RISK If an intersection is found (HARD BLOCK).
   * @returns IAllergyExposureResult if safe, or throws.
   */
  checkMealSafety(command: ICheckMealSafetyCommand): Promise<IAllergyExposureResult>;
}
