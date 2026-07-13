/**
 * Commission Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const COMMISSION_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_session_commission',
    label: 'Áp dụng hoa hồng theo ca',
    description: 'Áp dụng định mức hoa hồng cho mỗi ca làm việc hoàn thành',
    params: [
      {
        key: 'rate',
        label: 'Định mức hoa hồng (VND/ca)',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 50000',
        validation: { min: 0 },
        description: 'Số tiền hoa hồng được nhận cho mỗi ca làm việc',
      },
    ],
    group: 'Hoa hồng',
  },
  {
    type: 'apply_sales_commission',
    label: 'Áp dụng hoa hồng doanh số',
    description: 'Áp dụng hoa hồng dựa trên doanh số bán sản phẩm/mỹ phẩm',
    params: [
      {
        key: 'percentage',
        label: 'Tỷ lệ % hoa hồng',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 10',
        validation: { min: 0, max: 100 },
        description: 'Tỷ lệ % hoa hồng được hưởng trên doanh số (0-100)',
      },
    ],
    group: 'Hoa hồng',
  },
];
