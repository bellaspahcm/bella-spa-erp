/**
 * Inventory Provider - Field Schema
 */

import { FieldSchema } from '../../field-schema.types';

export const INVENTORY_FIELDS: FieldSchema[] = [
  {
    key: 'product.currentStock',
    label: 'Mức tồn kho hiện tại',
    type: 'number',
    operators: ['less_than_or_equal', 'greater_than', 'equals'],
    defaultOperator: 'less_than_or_equal',
    group: 'Tồn kho',
    description: 'Số lượng sản phẩm thực tế đang còn trong kho',
    placeholder: 'ví dụ: 10',
  },
  {
    key: 'product.reorderPoint',
    label: 'Điểm đặt hàng lại',
    type: 'number',
    operators: ['less_than_or_equal', 'equals'],
    defaultOperator: 'less_than_or_equal',
    group: 'Tồn kho',
    description: 'Mức tồn kho tối thiểu để kích hoạt đề xuất nhập thêm hàng',
    placeholder: 'ví dụ: 20',
  },
  {
    key: 'product.expiryDays',
    label: 'Số ngày tới hạn sử dụng',
    type: 'number',
    operators: ['less_than_or_equal', 'greater_than'],
    defaultOperator: 'less_than_or_equal',
    group: 'Hạn sử dụng',
    description: 'Số ngày còn lại trước khi sản phẩm/mỹ phẩm hết hạn dùng',
    placeholder: 'ví dụ: 30',
  },
];
