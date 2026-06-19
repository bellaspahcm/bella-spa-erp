import { parsePercentInput } from '@/lib/utils';

export type PromotionStatusInput = 'active' | 'paused' | string | null | undefined;

export type PromotionRuleInput = {
  title: string | null | undefined;
  description: string | null | undefined;
  image_url?: string | null;
  discount_code?: string | null;
  discount_percent?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
};

export type VoucherPromotionInput = {
  code: string | null | undefined;
  target: string | null | undefined;
  discount: number | string | null | undefined;
  status?: PromotionStatusInput;
};

export type PromotionRulePayload = {
  title: string;
  description: string;
  image_url: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export type PromotionRuleResult<T> =
  | { success: true; payload: T }
  | { success: false; error: string };

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

export function normalizePromotionCode(value: string | null | undefined) {
  const normalized = normalizeText(value).toUpperCase().replace(/\s+/g, '');
  return normalized || null;
}

export function normalizePromotionDiscountPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parsePercentInput(value);
  return Math.min(Math.max(parsed, 0), 100);
}

export function normalizePromotionDate(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized || null;
}

export function validatePromotionDateRange(input: {
  startDate?: string | null;
  endDate?: string | null;
}) {
  const startDate = normalizePromotionDate(input.startDate);
  const endDate = normalizePromotionDate(input.endDate);

  if (startDate && endDate && startDate > endDate) {
    return { success: false as const, error: 'Ngay bat dau khong duoc sau ngay ket thuc.' };
  }

  return {
    success: true as const,
    startDate,
    endDate,
  };
}

export function buildPromotionPayload(input: PromotionRuleInput): PromotionRuleResult<PromotionRulePayload> {
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);

  if (!title || !description) {
    return { success: false, error: 'Tieu de va mo ta la bat buoc.' };
  }

  const dateRange = validatePromotionDateRange({
    startDate: input.start_date,
    endDate: input.end_date,
  });

  if (!dateRange.success) {
    return { success: false, error: dateRange.error };
  }

  return {
    success: true,
    payload: {
      title,
      description,
      image_url: normalizeText(input.image_url) || null,
      discount_code: normalizePromotionCode(input.discount_code),
      discount_percent: normalizePromotionDiscountPercent(input.discount_percent),
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
      is_active: input.is_active !== undefined ? input.is_active : true,
    },
  };
}

export function buildVoucherPromotionPayload(
  input: VoucherPromotionInput
): PromotionRuleResult<PromotionRulePayload> {
  const code = normalizePromotionCode(input.code);
  const target = normalizeText(input.target);

  if (!code) {
    return { success: false, error: 'Ma voucher la bat buoc.' };
  }

  if (!target) {
    return { success: false, error: 'Mo ta doi tuong voucher la bat buoc.' };
  }

  return buildPromotionPayload({
    title: code,
    description: target,
    discount_code: code,
    discount_percent: input.discount,
    is_active: input.status !== 'paused',
  });
}
