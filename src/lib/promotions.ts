import type { Database } from '@/types/database.types';

export type Promotion = Database['public']['Tables']['promotions']['Row'];

export function isPromotionActiveOnDate(promotion: Promotion, date: string) {
  const startValid = !promotion.start_date || promotion.start_date <= date;
  const endValid = !promotion.end_date || promotion.end_date >= date;

  return Boolean(promotion.is_active && startValid && endValid);
}

export function filterActivePromotions(promotions: Promotion[], date: string) {
  return promotions.filter((promotion) => isPromotionActiveOnDate(promotion, date));
}
