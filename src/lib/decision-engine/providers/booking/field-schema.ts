/**
 * Booking Provider - Field Schema
 * 
 * Defines all available fields for booking decision rules.
 */

import { FieldSchema } from '../../field-schema.types';

export const BOOKING_FIELDS: FieldSchema[] = [
  // Customer Fields
  {
    key: 'customer.tier',
    label: 'Hạng thành viên',
    type: 'enum',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'VIP', label: 'VIP' },
      { value: 'Loyal', label: 'Khách hàng thân thiết' },
      { value: 'New', label: 'Khách hàng mới' },
    ],
    group: 'Khách hàng',
    description: 'Hạng thành viên của khách hàng',
  },
  {
    key: 'customer.totalBookings',
    label: 'Tổng số lượt đặt lịch',
    type: 'number',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Khách hàng',
    description: 'Tổng số lần đặt lịch của khách hàng này',
    placeholder: 'ví dụ: 10',
  },
  {
    key: 'customer.lifetimeValue',
    label: 'Tổng chi tiêu tích lũy (VND)',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Khách hàng',
    description: 'Tổng số tiền tích lũy khách hàng đã chi tiêu',
    placeholder: 'ví dụ: 10000000',
  },
  
  // Booking Fields
  {
    key: 'booking.serviceCount',
    label: 'Số lượng dịch vụ',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Lịch hẹn',
    description: 'Số lượng dịch vụ được đặt trong lịch hẹn này',
    placeholder: 'ví dụ: 3',
  },
  {
    key: 'booking.totalAmount',
    label: 'Tổng tiền tạm tính (VND)',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Lịch hẹn',
    description: 'Tổng giá trị hóa đơn tạm tính của lịch hẹn',
    placeholder: 'ví dụ: 2000000',
  },
  {
    key: 'booking.scheduledDate',
    label: 'Thời gian hẹn',
    type: 'datetime',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than_or_equal',
    group: 'Lịch hẹn',
    description: 'Ngày và giờ dự kiến của lịch hẹn',
  },
  {
    key: 'booking.status',
    label: 'Trạng thái lịch hẹn',
    type: 'enum',
    operators: ['equals', 'not_equals', 'in', 'not_in'],
    defaultOperator: 'equals',
    enumValues: [
      { value: 'pending', label: 'Chờ xử lý' },
      { value: 'confirmed', label: 'Đã xác nhận' },
      { value: 'in_progress', label: 'Đang thực hiện' },
      { value: 'completed', label: 'Đã hoàn thành' },
      { value: 'cancelled', label: 'Đã hủy' },
    ],
    group: 'Lịch hẹn',
    description: 'Trạng thái hiện tại của lịch hẹn',
  },
  
  // KTV Fields
  {
    key: 'ktv.availableCount',
    label: 'Số KTV đang rảnh',
    type: 'number',
    operators: ['equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    defaultOperator: 'greater_than',
    group: 'Kỹ thuật viên',
    description: 'Số lượng KTV khả dụng trong khung giờ được chọn',
    placeholder: 'ví dụ: 5',
  },
  {
    key: 'ktv.seniorCount',
    label: 'Số KTV lâu năm đang rảnh',
    type: 'number',
    operators: ['greater_than', 'greater_than_or_equal'],
    defaultOperator: 'greater_than',
    group: 'Kỹ thuật viên',
    description: 'Số lượng KTV cấp lâu năm (Senior) khả dụng',
    placeholder: 'ví dụ: 2',
  },
];
