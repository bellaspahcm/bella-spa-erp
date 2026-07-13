/**
 * Payroll Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const PAYROLL_FIELDS: FieldSchema[] = [
  {
    key: 'ktv.totalSessions',
    label: 'Tổng số ca làm việc (ca quy đổi)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'equals', 'greater_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Hiệu suất KTV',
    description: 'Tổng số ca dịch vụ hoàn thành đã nhân với hệ số gói',
    placeholder: 'ví dụ: 100',
  },
  {
    key: 'ktv.avgRating',
    label: 'Điểm đánh giá trung bình',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'equals'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Hiệu suất KTV',
    description: 'Điểm số sao đánh giá trung bình từ khách hàng (1-5 sao)',
    placeholder: 'ví dụ: 4.5',
    validation: { min: 1, max: 5 },
  },
  {
    key: 'ktv.violationCount',
    label: 'Số lần vi phạm quy chế',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal'],
    defaultOperator: 'equals',
    group: 'Chấm công & Điểm danh',
    description: 'Số lần vi phạm nội quy nội bộ hoặc quy trình dịch vụ',
    placeholder: 'ví dụ: 0',
  },
  {
    key: 'ktv.lateCount',
    label: 'Số lần đi muộn',
    type: 'number',
    operators: ['greater_than_or_equal', 'equals', 'greater_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Chấm công & Điểm danh',
    description: 'Số lần đi làm muộn hoặc về sớm trong chu kỳ tính lương',
    placeholder: 'ví dụ: 2',
  },
  {
    key: 'period.month',
    label: 'Tháng tính lương',
    type: 'number',
    operators: ['equals'],
    defaultOperator: 'equals',
    group: 'Kỳ tính lương',
    description: 'Tháng của chu kỳ quyết toán lương (1-12)',
    placeholder: 'ví dụ: 7',
    validation: { min: 1, max: 12 },
  },
];
