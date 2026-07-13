/**
 * Inventory Provider - Action Schema
 */

import { ActionSchema } from '../../action-schema.types';

export const INVENTORY_ACTIONS: ActionSchema[] = [
  {
    type: 'trigger_reorder',
    label: 'Kích hoạt đặt thêm hàng',
    description: 'Tự động tạo phiếu đề xuất nhập kho để bổ sung hàng hóa',
    params: [
      {
        key: 'quantity',
        label: 'Số lượng đặt mua',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 100',
        validation: { min: 1 },
        description: 'Số lượng sản phẩm đề xuất đặt mua thêm',
      },
    ],
    group: 'Nhập hàng',
  },
  {
    type: 'apply_discount',
    label: 'Áp dụng giảm giá cận hạn dùng',
    description: 'Áp dụng chính sách giảm giá khuyến mãi cho sản phẩm sắp hết hạn',
    params: [
      {
        key: 'percentage',
        label: 'Tỷ lệ % giảm giá',
        type: 'number',
        required: true,
        placeholder: 'ví dụ: 30',
        validation: { min: 0, max: 100 },
        description: 'Tỷ lệ % giảm giá được áp dụng (0-100)',
      },
    ],
    group: 'Hạn sử dụng',
  },
];
