import { z } from 'zod';

export const customerSchema = z.object({
  phone: z.string().min(10, 'Số điện thoại không hợp lệ'),
  name_mother: z.string().min(2, 'Tên mẹ không được để trống'),
  name_baby: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  dob_baby: z.string().optional(),
  dob_expected: z.string().optional(),
});

export const bookingSchema = z.object({
  customer_id: z.string().or(z.number()),
  package_id: z.string().optional(),
  package_name: z.string().optional(),
  full_price: z.number().min(0),
  deposit_amount: z.number().min(0),
  total_sessions: z.number().int().min(1).default(21),
  start_date: z.string().optional(),
});
