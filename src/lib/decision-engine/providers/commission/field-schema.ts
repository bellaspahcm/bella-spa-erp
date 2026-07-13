/**
 * Commission Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const COMMISSION_FIELDS: FieldSchema[] = [
  {
    key: 'session.count',
    label: 'Số lượng ca làm việc (ca quy đổi)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'equals'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Hiệu suất KTV',
    description: 'Số lượng ca dịch vụ hoàn thành đã được quy đổi theo hệ số',
    placeholder: 'ví dụ: 50',
  },
  {
    key: 'session.avgRating',
    label: 'Điểm đánh giá trung bình ca',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Hiệu suất KTV',
    description: 'Điểm số sao đánh giá trung bình từ khách hàng (1-5 sao)',
    placeholder: 'ví dụ: 4.5',
    validation: { min: 1, max: 5 },
  },
  {
    key: 'sales.totalAmount',
    label: 'Doanh số bán sản phẩm (VND)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Doanh số bán hàng',
    description: 'Tổng doanh thu bán sản phẩm/mỹ phẩm của KTV',
    placeholder: 'ví dụ: 5000000',
  },
];
