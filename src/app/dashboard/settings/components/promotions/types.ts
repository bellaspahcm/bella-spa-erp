import type { Database } from '@/types/database.types';

export type Promotion = Database['public']['Tables']['promotions']['Row'];

export interface PromotionFormState {
  title: string;
  description: string;
  discountCode: string;
  discountPercent: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_PROMOTION_FORM: PromotionFormState = {
  title: '',
  description: '',
  discountCode: '',
  discountPercent: '',
  startDate: '',
  endDate: '',
};
