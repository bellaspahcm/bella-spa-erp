import { parseDecimalInput, parseIntegerInput, parseMoneyInput } from '@/lib/utils';
import {
  normalizeOptionalBookingResourceType,
  type BookingResourceType,
} from '@/lib/business-rules/booking-resource';
import { TENANT_MODULE_KEYS, type TenantModuleKey } from '@/lib/business-rules/tenant-modules';

type NumericLike = number | string | null | undefined;

export type ServicePackageDetailsInput = string[] | string | null | undefined;
export type ServicePackageKind = 'single_service' | 'treatment_package' | 'retail_product' | 'consultation';

export type ServicePackageInput = {
  name?: string | null;
  price?: NumericLike;
  duration?: NumericLike;
  sessions?: NumericLike;
  total_sessions?: NumericLike;
  details?: ServicePackageDetailsInput;
  offer?: string | null;
  ktv_commission?: NumericLike;
  status?: string | null;
  tenant_id?: string | null;
  session_multiplier?: NumericLike;
  module_key?: string | null;
  service_kind?: string | null;
  service_category?: string | null;
  default_duration_minutes?: NumericLike;
  requires_resource?: boolean | null;
  default_resource_type?: string | null;
  before_after_required?: boolean | null;
  care_note_template?: string | null;
};

export type HqPackageTemplateRuleInput = ServicePackageInput & {
  id?: string | null;
  price_cap?: NumericLike;
  price_floor?: NumericLike;
  allowed_franchise_override?: boolean | null;
  is_hq_template?: boolean | null;
  template_id?: string | null;
};

export type ServicePackageRulePayload = {
  name: string;
  price: number;
  duration: string;
  total_sessions: number;
  details: string[];
  offer: string;
  ktv_commission: number;
  status: string;
  tenant_id?: string;
  session_multiplier?: number;
  module_key: TenantModuleKey;
  service_kind: ServicePackageKind;
  service_category: string | null;
  default_duration_minutes: number;
  requires_resource: boolean;
  default_resource_type: BookingResourceType | null;
  before_after_required: boolean;
  care_note_template: string | null;
};

export type HqPackageTemplateRulePayload = ServicePackageRulePayload & {
  is_hq_template?: boolean;
  template_id?: string | null;
  price_cap: number | null;
  price_floor: number | null;
  allowed_franchise_override: boolean;
};

export type ServicePackageRuleResult<T> =
  | { success: true; payload: T }
  | { success: false; error: string };

const DEFAULT_DURATION = '90 phút/buổi';
const DEFAULT_TOTAL_SESSIONS = 10;
const DEFAULT_KTV_COMMISSION = 150000;
const SERVICE_PACKAGE_KIND_KEYS: ServicePackageKind[] = [
  'single_service',
  'treatment_package',
  'retail_product',
  'consultation',
];

function normalizeText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizePackageDetails(details: ServicePackageDetailsInput) {
  if (Array.isArray(details)) {
    return details.map(detail => normalizeText(detail)).filter(Boolean);
  }

  if (typeof details === 'string') {
    return details.split(',').map(detail => detail.trim()).filter(Boolean);
  }

  return [];
}

export function normalizePackageMoney(value: NumericLike, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return Math.max(0, Math.round(fallback));
  }

  return parseMoneyInput(value);
}

export function normalizePackageSessionCount(value: NumericLike, fallback = DEFAULT_TOTAL_SESSIONS) {
  return parseIntegerInput(value, { min: 1, max: 999, fallback });
}

export function normalizePackageSessionMultiplier(value: NumericLike, fallback = 1) {
  return parseDecimalInput(value, { min: 0.01, max: 10, fallback });
}

export function normalizePackageModuleKey(value: string | null | undefined): TenantModuleKey {
  const normalized = value?.trim().toLowerCase();
  return TENANT_MODULE_KEYS.includes(normalized as TenantModuleKey)
    ? normalized as TenantModuleKey
    : 'babycare';
}

export function normalizeServicePackageKind(value: string | null | undefined): ServicePackageKind {
  const normalized = value?.trim().toLowerCase();
  return SERVICE_PACKAGE_KIND_KEYS.includes(normalized as ServicePackageKind)
    ? normalized as ServicePackageKind
    : 'treatment_package';
}

export function normalizeDefaultDurationMinutes(value: NumericLike, fallback = 90) {
  return parseIntegerInput(value, { min: 1, max: 1440, fallback });
}

function normalizeNullableText(value: unknown) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeNullableMoney(value: NumericLike) {
  const amount = normalizePackageMoney(value, 0);
  return amount > 0 ? amount : null;
}

export function validatePackagePriceBounds(input: {
  price_floor?: NumericLike;
  price_cap?: NumericLike;
}) {
  const priceFloor = normalizeNullableMoney(input.price_floor);
  const priceCap = normalizeNullableMoney(input.price_cap);

  if (priceFloor !== null && priceCap !== null && priceFloor > priceCap) {
    return {
      success: false as const,
      error: 'Giá sàn không được lớn hơn giá trần.',
      price_floor: priceFloor,
      price_cap: priceCap,
    };
  }

  return {
    success: true as const,
    price_floor: priceFloor,
    price_cap: priceCap,
  };
}

export function buildServicePackagePayload(input: ServicePackageInput): ServicePackageRulePayload {
  const payload: ServicePackageRulePayload = {
    name: normalizeText(input.name),
    price: normalizePackageMoney(input.price),
    duration: normalizeText(input.duration, DEFAULT_DURATION),
    total_sessions: normalizePackageSessionCount(input.total_sessions ?? input.sessions, DEFAULT_TOTAL_SESSIONS),
    details: normalizePackageDetails(input.details),
    offer: input.offer || '',
    ktv_commission: normalizePackageMoney(input.ktv_commission, DEFAULT_KTV_COMMISSION),
    status: normalizeText(input.status, 'active'),
    module_key: normalizePackageModuleKey(input.module_key),
    service_kind: normalizeServicePackageKind(input.service_kind),
    service_category: normalizeNullableText(input.service_category),
    default_duration_minutes: normalizeDefaultDurationMinutes(input.default_duration_minutes),
    requires_resource: input.requires_resource === true,
    default_resource_type: input.requires_resource === true
      ? normalizeOptionalBookingResourceType(input.default_resource_type) ?? 'bed'
      : normalizeOptionalBookingResourceType(input.default_resource_type),
    before_after_required: input.before_after_required === true,
    care_note_template: normalizeNullableText(input.care_note_template),
  };

  if (input.tenant_id) {
    payload.tenant_id = input.tenant_id;
  }
  if (input.session_multiplier !== undefined) {
    payload.session_multiplier = normalizePackageSessionMultiplier(input.session_multiplier);
  }
  if (input.module_key !== undefined) payload.module_key = normalizePackageModuleKey(input.module_key);
  if (input.service_kind !== undefined) payload.service_kind = normalizeServicePackageKind(input.service_kind);
  if (input.service_category !== undefined) payload.service_category = normalizeNullableText(input.service_category);
  if (input.default_duration_minutes !== undefined) {
    payload.default_duration_minutes = normalizeDefaultDurationMinutes(input.default_duration_minutes);
  }
  if (input.requires_resource !== undefined) payload.requires_resource = input.requires_resource === true;
  if (input.default_resource_type !== undefined) {
    payload.default_resource_type = normalizeOptionalBookingResourceType(input.default_resource_type);
  }
  if (input.before_after_required !== undefined) {
    payload.before_after_required = input.before_after_required === true;
  }
  if (input.care_note_template !== undefined) payload.care_note_template = normalizeNullableText(input.care_note_template);

  return payload;
}

export function buildServicePackageUpdatePayload(input: Partial<ServicePackageInput>) {
  const payload: Partial<ServicePackageRulePayload> = {};

  if (input.name !== undefined) payload.name = normalizeText(input.name);
  if (input.price !== undefined) payload.price = normalizePackageMoney(input.price);
  if (input.duration !== undefined) payload.duration = normalizeText(input.duration, DEFAULT_DURATION);
  if (input.total_sessions !== undefined || input.sessions !== undefined) {
    payload.total_sessions = normalizePackageSessionCount(input.total_sessions ?? input.sessions, DEFAULT_TOTAL_SESSIONS);
  }
  if (input.details !== undefined) payload.details = normalizePackageDetails(input.details);
  if (input.offer !== undefined) payload.offer = input.offer || '';
  if (input.ktv_commission !== undefined) {
    payload.ktv_commission = normalizePackageMoney(input.ktv_commission, DEFAULT_KTV_COMMISSION);
  }
  if (input.status !== undefined) payload.status = normalizeText(input.status, 'active');
  if (input.tenant_id !== undefined && input.tenant_id !== null) payload.tenant_id = input.tenant_id;
  if (input.session_multiplier !== undefined) {
    payload.session_multiplier = normalizePackageSessionMultiplier(input.session_multiplier);
  }

  return payload;
}

export function buildHqPackageTemplatePayload(
  input: HqPackageTemplateRuleInput,
  options: { tenantId?: string | null; isHqTemplate?: boolean } = {},
): ServicePackageRuleResult<HqPackageTemplateRulePayload> {
  const bounds = validatePackagePriceBounds(input);
  if (!bounds.success) {
    return { success: false, error: bounds.error };
  }

  const payload: HqPackageTemplateRulePayload = {
    ...buildServicePackagePayload({
      ...input,
      status: input.status || 'active',
    }),
    price_cap: bounds.price_cap,
    price_floor: bounds.price_floor,
    allowed_franchise_override: input.allowed_franchise_override !== false,
  };

  if (options.tenantId) payload.tenant_id = options.tenantId;
  if (options.isHqTemplate !== undefined) payload.is_hq_template = options.isHqTemplate;
  if (input.template_id !== undefined) payload.template_id = input.template_id;

  return { success: true, payload };
}

export function buildTemplateDistributionBasePayload(template: HqPackageTemplateRuleInput) {
  const bounds = validatePackagePriceBounds(template);
  const price_floor = bounds.success ? bounds.price_floor : null;
  const price_cap = bounds.success ? bounds.price_cap : null;
  const payload: Omit<HqPackageTemplateRulePayload, 'price'> = {
    name: normalizeText(template.name),
    duration: normalizeText(template.duration, DEFAULT_DURATION),
    total_sessions: normalizePackageSessionCount(template.total_sessions, DEFAULT_TOTAL_SESSIONS),
    details: normalizePackageDetails(template.details),
    offer: template.offer || '',
    ktv_commission: normalizePackageMoney(template.ktv_commission, DEFAULT_KTV_COMMISSION),
    status: 'active',
    module_key: normalizePackageModuleKey(template.module_key),
    service_kind: normalizeServicePackageKind(template.service_kind),
    service_category: normalizeNullableText(template.service_category),
    default_duration_minutes: normalizeDefaultDurationMinutes(template.default_duration_minutes),
    requires_resource: template.requires_resource === true,
    default_resource_type: template.requires_resource === true
      ? normalizeOptionalBookingResourceType(template.default_resource_type) ?? 'bed'
      : normalizeOptionalBookingResourceType(template.default_resource_type),
    before_after_required: template.before_after_required === true,
    care_note_template: normalizeNullableText(template.care_note_template),
    is_hq_template: false,
    template_id: template.id || null,
    price_cap,
    price_floor,
    allowed_franchise_override: template.allowed_franchise_override !== false,
  };

  if (template.session_multiplier !== undefined) {
    payload.session_multiplier = normalizePackageSessionMultiplier(template.session_multiplier);
  }

  return payload;
}

export function resolveDistributedPackagePrice(input: {
  template: HqPackageTemplateRuleInput;
  existingPrice?: NumericLike;
}) {
  const templatePrice = normalizePackageMoney(input.template.price);
  const bounds = validatePackagePriceBounds(input.template);
  const priceFloor = bounds.success ? bounds.price_floor : null;
  const priceCap = bounds.success ? bounds.price_cap : null;

  if (input.template.allowed_franchise_override === false) {
    return templatePrice;
  }

  const currentPrice = input.existingPrice === undefined
    ? templatePrice
    : normalizePackageMoney(input.existingPrice, templatePrice);

  if (priceFloor !== null && currentPrice < priceFloor) return priceFloor;
  if (priceCap !== null && currentPrice > priceCap) return priceCap;
  return currentPrice;
}

export function validateTenantPackagePriceOverride(input: {
  packageRow: HqPackageTemplateRuleInput;
  newPrice: NumericLike;
}) {
  const price = normalizePackageMoney(input.newPrice);
  if (price <= 0) {
    return { success: false as const, error: 'Giá bán lẻ phải lớn hơn 0.' };
  }

  const packageRow = input.packageRow;
  if (!packageRow.template_id) {
    return { success: true as const, price };
  }

  if (packageRow.allowed_franchise_override === false) {
    return {
      success: false as const,
      error: 'Gói dịch vụ chuẩn này được khóa giá cố định bởi HQ, không thể sửa đổi.',
    };
  }

  const bounds = validatePackagePriceBounds(packageRow);
  const priceFloor = bounds.success ? bounds.price_floor : null;
  const priceCap = bounds.success ? bounds.price_cap : null;

  if (priceFloor !== null && price < priceFloor) {
    return {
      success: false as const,
      error: `Giá bán lẻ không được thấp hơn giá sàn quy định (${priceFloor.toLocaleString('vi-VN')} VNĐ)`,
    };
  }

  if (priceCap !== null && price > priceCap) {
    return {
      success: false as const,
      error: `Giá bán lẻ không được vượt quá giá trần quy định (${priceCap.toLocaleString('vi-VN')} VNĐ)`,
    };
  }

  return { success: true as const, price };
}
