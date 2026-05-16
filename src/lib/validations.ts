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
  discount_percent: z.coerce.number().optional(),
  preferred_time: z.string().optional(),
});
