/**
 * Payroll Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const PAYROLL_ACTIONS: ActionSchema[] = [
  {
    type: 'apply_kpi_bonus',
    label: 'Áp dụng thưởng KPI',
    description: 'Áp dụng khoản tiền thưởng KPI dựa trên hiệu suất làm việc',
    params: [
      {
        key: 'amount',
        label: 'Số tiền thưởng (VND)',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 1000000',
        validation: { min: 0 },
        description: 'Mức tiền thưởng KPI',
      },
      {
        key: 'reason',
        label: 'Lý do thưởng',
        type: 'string',
        required: true,
        placeholder: 'ví dụ: Vượt chỉ tiêu số ca làm việc',
        description: 'Chi tiết lý do khen thưởng KPI',
      },
    ],
    group: 'Thưởng',
  },
  {
    type: 'apply_deduction',
    label: 'Áp dụng khoản khấu trừ (phạt)',
    description: 'Khấu trừ trực tiếp vào lương do vi phạm nội quy/chấm công',
    params: [
      {
        key: 'amount',
        label: 'Số tiền khấu trừ (VND)',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 200000',
        validation: { min: 0 },
        description: 'Số tiền phạt khấu trừ',
      },
      {
        key: 'reason',
        label: 'Lý do khấu trừ',
        type: 'enum',
        required: true,
        enumValues: [
          { value: 'late_arrival', label: 'Đi muộn / Về sớm' },
          { value: 'absent_unnotified', label: 'Nghỉ làm không phép' },
          { value: 'policy_violation', label: 'Vi phạm quy chế nghiệp vụ' },
        ],
        description: 'Lý do áp dụng phạt khấu trừ',
      },
    ],
    group: 'Khấu trừ',
  },
  {
    type: 'apply_rating_bonus',
    label: 'Áp dụng thưởng sao đánh giá',
    description: 'Thưởng thêm dựa trên điểm số đánh giá sao của khách hàng',
    params: [
      {
        key: 'amount',
        label: 'Số tiền thưởng (VND)',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 500000',
        validation: { min: 0 },
        description: 'Số tiền thưởng đánh giá sao tích lũy',
      },
    ],
    group: 'Thưởng',
  },
];
