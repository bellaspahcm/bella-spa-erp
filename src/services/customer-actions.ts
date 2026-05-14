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
    const { getCurrentUser } = await import('./user-actions');
    const currentUser = await getCurrentUser();

    let query = supabase
      .from('customers')
      .select('*, bookings(*)')
      .order('created_at', { ascending: false });

    // If KTV, only show customers where they have an assigned booking
    if (currentUser?.role === 'ktv') {
      // We use a subquery approach via filter if possible, or just fetch all and filter in JS
      // In Supabase JS, we can use .filter with a specific join or just check in JS
      // To keep it simple and correct, we'll fetch then filter
    }

    const { data, error } = await query;

    let filteredData = data;
    if (currentUser?.role === 'ktv' && data) {
      filteredData = data.filter((c: any) => 
        c.bookings?.some((b: any) => b.assigned_ktv_id === currentUser.id)
      );
    }

    if (error || !filteredData || filteredData.length === 0) {
      if (error) console.error('Error fetching customers:', error);
      // Return stable mock data with consistent structure
      let filteredMock = MOCK_CUSTOMERS;
      if (currentUser?.role === 'ktv') {
        // In demo mode, show a subset for KTV
        filteredMock = MOCK_CUSTOMERS.slice(0, 3);
      }

      return filteredMock.map(c => ({
        ...c,
        id: c.id.toString(), // Ensure ID is string
        status: c.status || 'active',
        package_name: c.package_name || 'Chưa đăng ký',
        start_date: ensure2026(c.dob_baby || c.dob_expected || '2026-01-01')
      }));
    }

    return filteredData.map((c: any) => {
      const latestBooking = c.bookings && c.bookings.length > 0 ? c.bookings[0] : null;
      const isFullyPaid = latestBooking && latestBooking.deposit_amount >= latestBooking.full_price;
      
      return {
        ...c,
        id: c.id.toString(),
        dob_baby: ensure2026(c.dob_baby),
        dob_expected: ensure2026(c.dob_expected),
        status: latestBooking ? (
          latestBooking.status === 'deposit_pending' ? 'deposit' : 
          isFullyPaid ? 'paid' : 'active'
        ) : 'lead',
        deposit_amount: latestBooking?.deposit_amount ? `${latestBooking.deposit_amount.toLocaleString()}đ` : null,
        full_price: latestBooking?.full_price || 0,
        is_fully_paid: isFullyPaid,
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
  
  const { getCurrentUser } = await import('./user-actions');
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

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
  let customerData: any = null;
  let customerError: any = null;
  let columnWarning = '';

  // Try to create with gender_baby
  const firstAttempt = await supabase
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
        tenant_id: tenantId,
      } as any,
    ])
    .select()
    .single();

  customerData = firstAttempt.data;
  customerError = firstAttempt.error;

  // Fallback: if gender_baby column is missing, try creating without it
  if (customerError && (customerError.message?.includes('column "gender_baby"') || customerError.code === '42703')) {
    console.warn('gender_baby column missing, retrying without it...');
    const fallbackResult = await supabase
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
          tenant_id: tenantId,
        } as any,
      ])
      .select()
      .single();
    
    customerData = fallbackResult.data;
    customerError = fallbackResult.error;
    
    if (!customerError) {
      columnWarning = 'Lưu thành công hồ sơ mẹ nhưng KHÔNG THỂ LƯU Giới tính bé vì Database thiếu cột này. Vui lòng chạy SQL Migration.';
    }
  }

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
      customer_id: customerData.id,
      package_id: packageId,
      package_name: formData.package_name || 'Gói liệu trình',
      full_price: fullPrice,
      deposit_amount: deposit,
      total_sessions: serviceDetails?.sessions || 21,
      start_date: validatedData.dob_expected || new Date().toISOString().split('T')[0],
    });
    
    if (bookingResult && bookingResult.error) {
      return { error: `Đã lưu khách hàng nhưng lỗi lưu gói: ${bookingResult.error}`, warning: columnWarning };
    }
  }

  await safeRevalidatePath('/dashboard/customers');
  return { data: customerData, warning: columnWarning };
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

    // Hardening: Verify session counts match session_logs truth if booking exists
    if (latestBooking) {
      const { count, error: countError } = await supabase
        .from('session_logs')
        .select('*', { count: 'exact', head: true })
        .eq('booking_id', latestBooking.id)
        .eq('status', 'completed');

      if (!countError && count !== null && count !== latestBooking.completed_sessions) {
        console.log(`Syncing completed_sessions for customer booking ${latestBooking.id}: ${latestBooking.completed_sessions} -> ${count}`);
        await supabase
          .from('bookings')
          .update({ completed_sessions: count })
          .eq('id', latestBooking.id);
        latestBooking.completed_sessions = count;
      }
    }

    const isFullyPaid = latestBooking && (latestBooking.deposit_amount || 0) >= (latestBooking.full_price || 0);
    
    return {
      ...customer,
      dob_baby: ensure2026(customer.dob_baby),
      dob_expected: ensure2026(customer.dob_expected),
      status: latestBooking?.status || 'lead',
      is_fully_paid: isFullyPaid,
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
  let customerData: any = null;
  let customerError: any = null;
  let columnWarning = '';

  // Try to update with gender_baby
  const updateAttempt = await supabase
    .from('customers')
    .update({
      phone: validatedData.phone,
      name_mother: validatedData.name_mother,
      name_baby: validatedData.name_baby || null,
      address: validatedData.address || null,
      notes: validatedData.notes || null,
      dob_baby: validatedData.dob_baby || null,
      dob_expected: validatedData.dob_expected || null,
      gender_baby: validatedData.gender_baby || 'unknown',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  customerData = updateAttempt.data;
  customerError = updateAttempt.error;

  // Fallback: if gender_baby column is missing, try updating without it
  if (customerError && (customerError.message?.includes('column "gender_baby"') || customerError.code === '42703')) {
    console.warn('gender_baby column missing, retrying without it...');
    const fallbackUpdate = await supabase
      .from('customers')
      .update({
        phone: validatedData.phone,
        name_mother: validatedData.name_mother,
        name_baby: validatedData.name_baby || null,
        address: validatedData.address || null,
        notes: validatedData.notes || null,
        dob_baby: validatedData.dob_baby || null,
        dob_expected: validatedData.dob_expected || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    customerData = fallbackUpdate.data;
    customerError = fallbackUpdate.error;

    if (!customerError) {
      columnWarning = 'Cập nhật thành công nhưng KHÔNG THỂ LƯU Giới tính bé vì Database thiếu cột này. Vui lòng chạy SQL Migration.';
    }
  }

  if (customerError) {
    console.error('Error updating customer:', customerError);
    return { error: customerError.message };
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
        return { error: `Cập nhật gói thất bại: ${bookingResult.error}`, warning: columnWarning };
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
        return { error: `Tạo gói mới thất bại: ${bookingResult.error}`, warning: columnWarning };
      }
    }
  }

  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${id}`);
  return { data: customerData, warning: columnWarning };
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

/**
 * CUSTOMER PORTAL ACTIONS
 */

export async function getCustomerPortalData() {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('./user-actions');
  const user = await getCurrentUser();
  
  if (user.role !== 'customer' && user.role !== 'admin') {
    return { error: 'Unauthorized access to customer portal.' };
  }

  // Find the customer record associated with this user
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, name_mother, phone')
    .or(`auth_user_id.eq.${user.id},phone.eq.${user.phone || '0000000000'}`)
    .maybeSingle();

  if (customerError) {
    console.error('Error fetching customer profile:', customerError);
    return { error: 'Could not load customer profile.' };
  }

  if (!customer) {
    // Return mock for demo if no DB record matches
    return {
      activeBooking: {
        id: 'mock-b1',
        package_name: 'Mẹ Bầu Toàn Diện (Demo)',
        total_sessions: 15,
        completed_sessions: 2,
        start_date: '2026-05-10',
        next_session: '2026-05-16 09:00',
      },
      sessions: [
        { id: 's1', number: 1, date: '2026-05-10', ktv: 'Nguyễn Thị Hoa', status: 'completed', rating: 5 },
        { id: 's2', number: 2, date: '2026-05-13', ktv: 'Nguyễn Thị Hoa', status: 'completed', rating: null },
        { id: 's3', number: 3, date: '2026-05-16', ktv: 'Đang sắp xếp', status: 'scheduled', rating: null },
      ]
    };
  }

  // Fetch real data
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, session_logs(*, session_reviews(*))')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const activeBooking = bookings?.[0];
  
  if (!activeBooking) return { message: 'No active treatment packages found.' };

  const sessions = (activeBooking.session_logs || [])
    .sort((a: any, b: any) => a.session_number - b.session_number)
    .map((s: any) => ({
      id: s.id,
      number: s.session_number,
      date: s.completed_date || s.assigned_date || '---',
      ktv: s.completed_by_ktv_id ? 'Đã hoàn thành' : 'Chờ thực hiện',
      status: s.status,
      rating: s.session_reviews?.[0]?.rating || null
    }));

  return {
    activeBooking: {
      id: activeBooking.id,
      package_name: activeBooking.package_name || 'Liệu trình của bạn',
      total_sessions: activeBooking.total_sessions || 15,
      completed_sessions: activeBooking.completed_sessions || 0,
      start_date: activeBooking.start_date,
      next_session: '---', 
    },
    sessions
  };
}

export async function submitSessionRating(sessionId: string, rating: number, comment: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = (await createClient()) as any;
  const { getCurrentUser } = await import('./user-actions');
  const user = await getCurrentUser();

  // 1. Update or Insert review
  const { error } = await supabase
    .from('session_reviews')
    .upsert({
      session_log_id: sessionId,
      reviewer_id: user.id,
      rating: rating,
      note: comment,
      status: 'approved',
      tenant_id: user.tenant_id
    } as any, { onConflict: 'session_log_id' });

  if (error) {
    console.error('Error submitting rating:', error);
    return { error: error.message };
  }

  await safeRevalidatePath('/dashboard/customer');
  return { success: true };
}
