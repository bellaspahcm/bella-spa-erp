/**
 * Booking Provider - Action Schema
 * 
 * Defines all available actions for booking decision rules.
 */

import { ActionSchema } from '../../action-schema.types';

export const BOOKING_ACTIONS: ActionSchema[] = [
  {
    type: 'approve',
    label: 'Tự động duyệt lịch hẹn',
    description: 'Tự động phê duyệt lịch đặt mà không cần duyệt thủ công',
    params: [
      {
        key: 'message',
        label: 'Thông điệp phê duyệt',
        type: 'string',
        required: false,
        placeholder: 'ví dụ: Khách VIP - tự động duyệt',
        description: 'Ghi chú thêm cho lịch sử hệ thống (không bắt buộc)',
      },
    ],
    group: 'Duyệt lịch hẹn',
  },
  {
    type: 'reject',
    label: 'Tự động từ chối lịch hẹn',
    description: 'Tự động từ chối lịch đặt này',
    params: [
      {
        key: 'reason',
        label: 'Lý do từ chối',
        type: 'string',
        required: true,
        placeholder: 'ví dụ: Không còn KTV trống',
        description: 'Lý do từ chối (bắt buộc)',
      },
    ],
    group: 'Duyệt lịch hẹn',
  },
  {
    type: 'requiresDeposit',
    label: 'Yêu cầu đặt cọc trước',
    description: 'Đánh dấu lịch đặt này là cần phải thanh toán đặt cọc trước',
    params: [
      {
        key: 'depositAmount',
        label: 'Số tiền đặt cọc (VND)',
        type: 'number',
        required: false,
        placeholder: 'ví dụ: 500000',
        description: 'Số tiền đặt cọc cố định (không bắt buộc nếu dùng tỷ lệ %)',
      },
      {
        key: 'depositPercentage',
        label: 'Tỷ lệ % đặt cọc',
        type: 'number',
        required: false,
        placeholder: 'ví dụ: 30',
        validation: { min: 0, max: 100 },
        description: 'Tỷ lệ % đặt cọc trên tổng hóa đơn (0-100)',
      },
    ],
    group: 'Thanh toán',
  },
  {
    type: 'set_priority',
    label: 'Thiết lập độ ưu tiên',
    description: 'Gán mức độ ưu tiên xử lý cho lịch đặt',
    params: [
      {
        key: 'priority',
        label: 'Điểm ưu tiên',
        type: 'number',
        required: true,
        defaultValue: 100,
        validation: { min: 0, max: 1000 },
        description: 'Điểm càng cao thì độ ưu tiên càng lớn (0-1000)',
        placeholder: 'ví dụ: 500',
      },
    ],
    group: 'Xử lý lịch hẹn',
  },
  {
    type: 'assign_ktv',
    label: 'Chỉ định cấp bậc KTV',
    description: 'Yêu cầu chỉ định một cấp bậc kỹ thuật viên cụ thể thực hiện',
    params: [
      {
        key: 'ktvLevel',
        label: 'Cấp bậc KTV',
        type: 'enum',
        required: true,
        enumValues: [
          { value: 'senior', label: 'KTV lâu năm (Senior)' },
          { value: 'intermediate', label: 'KTV trung cấp' },
          { value: 'junior', label: 'KTV sơ cấp (Junior)' },
        ],
        description: 'Cấp bậc tay nghề của kỹ thuật viên sẽ thực hiện',
      },
    ],
    group: 'Phân bổ nhân sự',
  },
  {
    type: 'add_to_waitlist',
    label: 'Thêm vào hàng chờ',
    description: 'Xếp lịch đặt vào danh sách chờ nếu không có KTV khả dụng',
    params: [
      {
        key: 'notifyCustomer',
        label: 'Thông báo cho khách hàng',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Gửi thông báo tự động cho khách khi vào hàng chờ',
      },
    ],
    group: 'Xử lý lịch hẹn',
  },
];
