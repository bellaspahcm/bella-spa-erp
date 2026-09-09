import { SupabaseClient } from "@supabase/supabase-js";
import {
  IAllergyExposureResult,
  IAllergySafetyContract,
  ICheckMealSafetyCommand,
} from "./allergy-safety.contract";

export class AllergySafetyService implements IAllergySafetyContract {
  constructor(private readonly supabase: SupabaseClient) {}

  async checkMealSafety(command: ICheckMealSafetyCommand): Promise<IAllergyExposureResult> {
    // 1. Get child's active allergies
    const { data: childAllergies, error: childErr } = await this.supabase
      .from("edu_child_allergies")
      .select("allergen_id, edu_allergens(name)")
      .eq("tenant_id", command.tenantId)
      .eq("student_id", command.studentId)
      .eq("status", "ACTIVE");

    if (childErr) {
      throw new Error(`Failed to fetch child allergies: ${childErr.message}`);
    }

    if (!childAllergies || childAllergies.length === 0) {
      return { isSafe: true };
    }

    const childAllergenIds = new Set(childAllergies.map((ca) => ca.allergen_id));

    // 2. Get meal's ingredients and their corresponding allergens
    // meal_items -> meal_item_ingredients -> ingredients -> ingredient_allergens -> allergens
    const { data: mealAllergens, error: mealErr } = await this.supabase
      .from("edu_meal_item_ingredients")
      .select(`
        ingredient_id,
        edu_food_ingredients (
          edu_ingredient_allergens (
            allergen_id,
            edu_allergens (name)
          )
        )
      `)
      .eq("tenant_id", command.tenantId)
      .eq("meal_item_id", command.mealItemId);

    if (mealErr) {
      throw new Error(`Failed to fetch meal ingredients: ${mealErr.message}`);
    }

    // 3. Extract all unique allergen IDs from the meal
    const conflictingAllergens: string[] = [];
    
    for (const item of mealAllergens || []) {
      const foodIngredient = Array.isArray(item.edu_food_ingredients) 
        ? item.edu_food_ingredients[0] 
        : item.edu_food_ingredients;

      if (!foodIngredient) continue;

      const ingredientAllergens = Array.isArray(foodIngredient.edu_ingredient_allergens) 
        ? foodIngredient.edu_ingredient_allergens 
        : [foodIngredient.edu_ingredient_allergens].filter(Boolean);
        
      for (const ia of ingredientAllergens) {
        if (!ia) continue;
        if (childAllergenIds.has(ia.allergen_id)) {
          // Found a conflict!
          const allergenName = (ia as any).edu_allergens?.name || "Unknown Allergen";
          if (!conflictingAllergens.includes(allergenName)) {
            conflictingAllergens.push(allergenName);
          }
        }
      }
    }

    // 4. Evaluate Safety
    if (conflictingAllergens.length > 0) {
      throw new Error(
        `ALLERGY_EXPOSURE_RISK: Meal contains ingredients conflicting with child's active allergies: ${conflictingAllergens.join(", ")}`
      );
    }

    return { isSafe: true };
  }
}
