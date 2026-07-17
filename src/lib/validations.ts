import { z } from 'zod';

export const customerSchema = z.object({
  phone: z.string().min(10, 'Số điện thoại không hợp lệ'),
  name_mother: z.string().min(2, 'Tên mẹ không được để trống'),
  name_baby: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  dob_baby: z.string().optional(),
  dob_expected: z.string().optional(),
  package_name: z.string().optional(),
  deposit_amount: z.string().or(z.number()).optional(),
  gender_baby: z.string().optional(),
});

export const serviceItemSchema = z.object({
  serviceName: z.string().min(1, 'Tên dịch vụ không được để trống'),
  packageId: z.string().uuid('Package ID phải là UUID hợp lệ').optional(),
  quantity: z.coerce.number().int().min(1, 'Số lượng phải >= 1'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá phải >= 0'),
  ktvId: z.string().uuid('KTV ID phải là UUID hợp lệ').optional(),
  overrideType: z.enum(['fixed', 'percentage']).optional(),
  overrideValue: z.coerce.number().min(0).optional(),
  completedDate: z.string().optional(),
});

export const bookingSchema = z.object({
  customer_id: z.string().or(z.number()),
  package_id: z.string().optional(),
  package_name: z.string().optional(),
  // z.coerce.number() handles both string "12500000" and number 12500000
  full_price: z.coerce.number().min(0),
  deposit_amount: z.coerce.number().min(0),
  total_sessions: z.coerce.number().int().min(1).default(15),
  start_date: z.string().optional(),
  assigned_ktv_id: z.string().optional(),
  ktv_commission: z.coerce.number().optional(),
  discount_percent: z.coerce.number().min(0).max(100).optional(),
  preferred_time: z.string().optional(),
  serviceItems: z.array(serviceItemSchema).optional(),
  metadata: z.any().optional(),
});

export const productSaleSchema = z.object({
  ktvId: z.string().uuid('KTV ID phải là UUID hợp lệ'),
  customerId: z.string().uuid('Customer ID phải là UUID hợp lệ').optional(),
  productName: z.string().min(1, 'Tên sản phẩm không được để trống'),
  productCategory: z.string().optional(),
  productSku: z.string().optional(),
  quantity: z.coerce.number().positive('Số lượng phải > 0'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá phải >= 0'),
  totalSalesAmount: z.coerce.number().min(0, 'Tổng tiền phải >= 0'),
  overrideCommissionType: z.enum(['fixed', 'percentage']).optional(),
  overrideCommissionValue: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'zalo_pay', 'momo', 'card']),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bán phải có định dạng YYYY-MM-DD'),
  notes: z.string().optional(),
});
