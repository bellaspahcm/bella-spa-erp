// Shared accounting semantic configuration types. Plain module so client
// components can import definitions without crossing the server-action boundary.

export type AccountingSemanticKey = 'SERVICE_REVENUE' | 'REVENUE_DEDUCTION' | 'GOODS_REVENUE';

export interface AccountingSemanticDefinition {
  key: AccountingSemanticKey;
  label: string;
  description: string;
}

export interface AccountingSemanticAccountOption {
  code: string;
  name: string;
  type: string;
}

export interface AccountingSemanticMapping {
  id: string;
  semantic_key: AccountingSemanticKey;
  account_code: string;
  effective_from: string;
  effective_to: string | null;
  authority_version: string | null;
}

export interface AccountingSemanticConfigSnapshot {
  semantics: AccountingSemanticDefinition[];
  accountOptions: AccountingSemanticAccountOption[];
  mappings: AccountingSemanticMapping[];
}

export interface SaveAccountingSemanticMappingInput {
  semantic_key: AccountingSemanticKey;
  account_code: string;
  effective_from: string;
}

export type SaveAccountingSemanticMappingResult =
  | { success: true; data: AccountingSemanticMapping }
  | { success: false; error: string };

export const ACCOUNTING_SEMANTIC_DEFINITIONS: AccountingSemanticDefinition[] = [
  {
    key: 'SERVICE_REVENUE',
    label: 'Doanh thu dịch vụ',
    description: 'Doanh thu từ dịch vụ khám, điều trị, spa hoặc dịch vụ tương đương.',
  },
  {
    key: 'REVENUE_DEDUCTION',
    label: 'Giảm trừ doanh thu',
    description: 'Refund hoặc khoản giảm trừ doanh thu theo chính sách kế toán của doanh nghiệp.',
  },
  {
    key: 'GOODS_REVENUE',
    label: 'Doanh thu hàng hóa',
    description: 'Doanh thu từ bán sản phẩm, hàng hóa hoặc vật tư.',
  },
];
