/**
 * Discount Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const DISCOUNT_FIELDS: FieldSchema[] = [
  {
    key: 'customer.membershipTier',
    label: 'Hạng thành viên',
    type: 'enum',
    operators: ['equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'VIP', label: 'VIP (Giảm 15%)' },
      { value: 'Loyal', label: 'Thân thiết (Giảm 10%)' },
      { value: 'New', label: 'Khách hàng mới (Giảm 5%)' },
    ],
    group: 'Khách hàng',
    description: 'Hạng thành viên của khách hàng để áp dụng giảm giá',
  },
  {
    key: 'order.totalAmount',
    label: 'Tổng tiền đơn hàng (VND)',
    type: 'number',
    operators: ['greater_than_or_equal', 'less_than', 'greater_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Đơn hàng',
    description: 'Tổng giá trị đơn hàng trước khi áp dụng giảm giá',
    placeholder: 'ví dụ: 1000000',
  },
  {
    key: 'order.itemCount',
    label: 'Số lượng sản phẩm/dịch vụ',
    type: 'number',
    operators: ['greater_than_or_equal', 'equals', 'greater_than'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Đơn hàng',
    description: 'Tổng số lượng sản phẩm hoặc dịch vụ trong đơn hàng',
    placeholder: 'ví dụ: 3',
  },
  {
    key: 'campaign.code',
    label: 'Mã chiến dịch',
    type: 'string',
    operators: ['equals', 'in'],
    defaultOperator: 'equals',
    group: 'Chiến dịch',
    description: 'Mã chiến dịch khuyến mãi đang áp dụng',
    placeholder: 'ví dụ: SUMMER2024',
  },
  {
    key: 'campaign.isActive',
    label: 'Chiến dịch đang chạy',
    type: 'boolean',
    operators: ['equals'],
    defaultOperator: 'equals',
    group: 'Chiến dịch',
    description: 'Trạng thái chiến dịch có đang hoạt động hay không',
  },
];
