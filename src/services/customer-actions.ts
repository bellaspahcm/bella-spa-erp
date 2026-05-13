'use server';

import { MOCK_CUSTOMERS, MOCK_BOOKINGS, MOCK_SESSIONS, MOCK_SERVICES } from '@/constants/mock-data';
import { ensure2026 } from '@/lib/utils';
import { safeRevalidatePath } from '@/lib/revalidate';

/**
 * Helper to resolve package name from booking data
 * This maintains data integrity even if explicit package_name is missing
 */
function resolvePackageName(booking: any): string {
  if (booking?.package_name) return booking.package_name;
  
  const price = Number(booking?.full_price);
  const matchedService = MOCK_SERVICES.find(s => {
    const sPrice = parseInt(s.price.replace(/[^\d]/g, ''));
    return sPrice === price;
  });

  return matchedService?.name || 'Chưa đăng ký';
}

export async function getCustomers() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*, bookings(*)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.error('Error fetching customers:', error);
      // Return stable mock data with consistent structure
      return MOCK_CUSTOMERS.map(c => ({
        ...c,
        id: c.id.toString(), // Ensure ID is string
        status: c.status || 'active',
        package_name: c.package_name || 'Chưa đăng ký',
        start_date: ensure2026(c.dob_baby || c.dob_expected || '2026-01-01')
      }));
    }

    return data.map((c: any) => {
      const latestBooking = c.bookings && c.bookings.length > 0 ? c.bookings[0] : null;
      return {
        ...c,
        id: c.id.toString(),
        dob_baby: ensure2026(c.dob_baby),
        dob_expected: ensure2026(c.dob_expected),
        status: latestBooking ? (latestBooking.status === 'deposit_pending' ? 'deposit' : 'active') : 'lead',
        deposit_amount: latestBooking?.deposit_amount ? `${latestBooking.deposit_amount.toLocaleString()}đ` : null,
        package_name: resolvePackageName(latestBooking),
        start_date: ensure2026(latestBooking?.start_date || c.dob_expected)
      };
    });
  } catch (err) {
    console.error('Critical error in getCustomers:', err);
    return MOCK_CUSTOMERS; // Absolute fallback
  }
}

import { customerSchema } from '@/lib/validations';

export async function createCustomer(formData: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // 0. Validate with Zod
  const validatedFields = customerSchema.safeParse(formData);
  
  if (!validatedFields.success) {
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;

  // 0.5 Check for duplicate phone
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', validatedData.phone)
    .single();

  if (existingCustomer) {
    return { error: 'Số điện thoại này đã tồn tại trong hệ thống. Vui lòng kiểm tra lại hoặc tìm kiếm trong danh sách khách cũ.' };
  }

  // 1. Create Customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert([
      {
        phone: validatedData.phone,
        name_mother: validatedData.name_mother,
        name_baby: validatedData.name_baby || null,
        address: validatedData.address,
        notes: validatedData.notes || null,
        dob_baby: validatedData.dob_baby || null,
        dob_expected: validatedData.dob_expected || null,
        gender_baby: validatedData.gender_baby || 'unknown',
      } as any,
    ])
    .select()
    .single();

  if (customerError) {
    console.error('Error creating customer:', customerError);
    return { error: customerError.message };
  }

  // 2. If deposit or package provided, create a booking via the unified createBooking action
  if (formData.deposit_amount || formData.package_name) {
    const deposit = parseInt(formData.deposit_amount?.toString().replace(/[^\d]/g, '') || '0');
    
    // Find service details from MOCK_SERVICES for data integrity
    const serviceDetails = MOCK_SERVICES.find(s => s.name === formData.package_name);
    const fullPrice = serviceDetails ? parseInt(serviceDetails.price.replace(/[^\d]/g, '')) : 0;
    const packageId = serviceDetails?.id || null;

    const { createBooking } = await import('./booking-actions');
    
    const bookingResult = await createBooking({
      customer_id: customer.id,
      package_id: packageId,
      package_name: formData.package_name || 'Gói liệu trình',
      full_price: fullPrice,
      deposit_amount: deposit,
      total_sessions: serviceDetails?.sessions || 21,
      start_date: validatedData.dob_expected || new Date().toISOString().split('T')[0],
    });
    
    if (bookingResult && bookingResult.error) {
      return { error: `Đã lưu khách hàng nhưng lỗi lưu gói: ${bookingResult.error}` };
    }
  }

  await safeRevalidatePath('/dashboard/customers');
  return { data: customer };
}

export async function getCustomerById(id: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  try {
    // 1. Fetch Customer first
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (customerError || !customer) {
      if (customerError) console.error('Error fetching customer from DB:', customerError);
      return getMockCustomerFallback(id);
    }

    // 2. Fetch Bookings separately to avoid join errors - sort by created_at to get latest
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*, session_logs(*), assigned_ktv:users!bookings_assigned_ktv_id_fkey(full_name)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('Error fetching bookings from DB:', bookingsError);
    }

    // Map database structure to UI structure
    const latestBooking = bookings && bookings.length > 0 ? bookings[0] : null;
    
    return {
      ...customer,
      dob_baby: ensure2026(customer.dob_baby),
      dob_expected: ensure2026(customer.dob_expected),
      status: latestBooking?.status || 'lead',
      deposit_amount: latestBooking?.deposit_amount ? `${latestBooking.deposit_amount.toLocaleString()}đ` : null,
      package_name: resolvePackageName(latestBooking),
      start_date: ensure2026(latestBooking?.start_date || customer.dob_expected),
      bookings: bookings || [], // Include bookings array for UI access
      sessions: (latestBooking?.session_logs || [])
        .sort((a: any, b: any) => (a.session_number || 0) - (b.session_number || 0))
        .map((s: any) => ({
          ...s,
          assigned_date: ensure2026(s.assigned_date),
          completed_date: ensure2026(s.completed_date),
          date: ensure2026(s.date) // Some components use .date
        }))
    };
  } catch (err) {
    console.error('Exception in getCustomerById:', err);
    return getMockCustomerFallback(id);
  }
}

function getMockCustomerFallback(id: string) {
  const mockCustomer = MOCK_CUSTOMERS.find(c => String(c.id) === String(id));
  if (mockCustomer) {
    const mockBooking = MOCK_BOOKINGS.find(b => String(b.customer_id) === String(id));
    const mockSessions = MOCK_SESSIONS.filter(s => String(s.booking_id) === String(mockBooking?.id));
    
    return {
      ...mockCustomer,
      dob_baby: ensure2026(mockCustomer.dob_baby),
      dob_expected: ensure2026(mockCustomer.dob_expected),
      status: mockCustomer.status || 'active',
      deposit_amount: mockCustomer.deposit_amount || '0đ',
      package_name: mockCustomer.package_name || 'Gói VIP',
      sessions: mockSessions.map(s => ({ ...s, date: ensure2026(s.date) })) || []
    };
  }
  return null;
}

export async function updateCustomer(id: string, formData: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  // 1. Validate with Zod
  const validatedFields = customerSchema.partial().safeParse(formData);
  
  if (!validatedFields.success) {
    const errorMessages = Object.values(validatedFields.error.flatten().fieldErrors).flat().join(', ');
    return { error: `Dữ liệu không hợp lệ: ${errorMessages}`, details: validatedFields.error.flatten().fieldErrors };
  }

  const validatedData = validatedFields.data;

  // 2. Update Customer
  const { data, error } = await supabase
    .from('customers')
    .update({
      phone: validatedData.phone,
      name_mother: validatedData.name_mother,
      name_baby: validatedData.name_baby,
      address: validatedData.address,
      notes: validatedData.notes,
      dob_baby: validatedData.dob_baby,
      dob_expected: validatedData.dob_expected,
      gender_baby: validatedData.gender_baby,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating customer:', error);
    return { error: error.message };
  }

  // 3. Update related booking if deposit or package provided
  if (formData.deposit_amount || formData.package_name) {
    const deposit = parseInt(formData.deposit_amount?.toString().replace(/[^\d]/g, '') || '0');
    
    // Find service details from MOCK_SERVICES for data integrity
    const serviceDetails = MOCK_SERVICES.find(s => s.name === formData.package_name);
    const fullPrice = serviceDetails ? parseInt(serviceDetails.price.replace(/[^\d]/g, '')) : 0;
    const packageId = serviceDetails?.id || null;

    // Find the latest booking to update
    const { data: latestBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    const { createBooking, updateBooking } = await import('./booking-actions');
    
    if (latestBookings && latestBookings.length > 0) {
      // Update existing booking
      const bookingResult = await updateBooking(latestBookings[0].id, {
        package_id: packageId,
        package_name: formData.package_name,
        full_price: fullPrice,
        deposit_amount: deposit,
      });
      if (bookingResult && bookingResult.error) {
        console.error('Failed to update booking:', bookingResult.error);
        return { error: `Cập nhật gói thất bại: ${bookingResult.error}` };
      }
    } else {
      // Create new booking if none exists
      const bookingResult = await createBooking({
        customer_id: id,
        package_id: packageId,
        package_name: formData.package_name || 'Gói liệu trình',
        full_price: fullPrice,
        deposit_amount: deposit,
        total_sessions: serviceDetails?.sessions || 21,
        start_date: validatedData.dob_expected || new Date().toISOString().split('T')[0],
      });
      if (bookingResult && bookingResult.error) {
        console.error('Failed to create booking:', bookingResult.error);
        return { error: `Tạo gói mới thất bại: ${bookingResult.error}` };
      }
    }
  }

  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${id}`);
  return { data };
}

export async function deleteCustomer(id: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting customer:', error);
    return { error: error.message };
  }

  await safeRevalidatePath('/dashboard/customers');
  return { success: true };
}
