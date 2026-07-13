/**
 * Discount Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const DISCOUNT_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_percentage_discount',
    label: 'Áp dụng giảm giá theo %',
    description: 'Áp dụng giảm giá theo tỷ lệ phần trăm',
    params: [
      {
        key: 'percentage',
        label: 'Tỷ lệ % giảm giá',
        type: 'number',
        required: true,
        validation: { min: 0, max: 100 },
        placeholder: 'ví dụ: 15',
        description: 'Tỷ lệ % giảm giá được khấu trừ (0-100)',
      },
      {
        key: 'reason',
        label: 'Lý do giảm giá',
        type: 'string',
        required: false,
        placeholder: 'ví dụ: Thành viên VIP',
        description: 'Lý do áp dụng giảm giá (để đối soát)',
      },
    ],
    group: 'Giảm giá',
  },
  {
    type: 'apply_fixed_discount',
    label: 'Áp dụng giảm giá số tiền cố định',
    description: 'Áp dụng giảm giá theo số tiền cố định',
    params: [
      {
        key: 'amount',
        label: 'Số tiền giảm giá (VND)',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 100000',
        validation: { min: 0 },
        description: 'Số tiền giảm giá cố định được khấu trừ',
      },
      {
        key: 'reason',
        label: 'Lý do giảm giá',
        type: 'string',
        required: false,
        placeholder: 'ví dụ: Khuyến mãi mua theo gói',
        description: 'Lý do áp dụng giảm giá (để đối soát)',
      },
    ],
    group: 'Giảm giá',
  },
  {
    type: 'apply_campaign_discount',
    label: 'Áp dụng giảm giá theo chiến dịch',
    description: 'Áp dụng giảm giá từ chiến dịch khuyến mãi đang hoạt động',
    params: [
      {
        key: 'campaignCode',
        label: 'Mã chiến dịch',
        type: 'string',
        required: true,
        placeholder: 'ví dụ: SUMMER2024',
        description: 'Mã chiến dịch khuyến mãi cần áp dụng',
      },
    ],
    group: 'Chiến dịch',
  },
];
