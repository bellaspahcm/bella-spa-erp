/**
 * Test Fixtures for Waitlist Feature
 * 
 * Provides consistent mock data for unit and integration tests.
 * All data follows Vietnamese naming conventions and Bella ERP structure.
 */

import type {
  WaitlistEntry,
  AddToWaitlistInput,
  AvailableSlot,
  WaitlistNotificationLog,
} from '@/types/waitlist';

/**
 * Mock Tenant
 */
export const mockTenant = {
  id: 'tenant-bella-spa',
  name: 'Bella Spa',
  subdomain: 'bella',
};

/**
 * Mock Customers
 */
export const mockCustomers = {
  vip: {
    id: 'customer-vip-001',
    name_mother: 'Nguyễn Thị Hương',
    phone: '0901234567',
    email: 'huong.nguyen@example.com',
    tier: 'vip' as const,
  },
  loyal: {
    id: 'customer-loyal-001',
    name_mother: 'Trần Thị Lan',
    phone: '0912345678',
    email: 'lan.tran@example.com',
    tier: 'loyal' as const,
  },
  new: {
    id: 'customer-new-001',
    name_mother: 'Lê Thị Mai',
    phone: '0923456789',
    email: 'mai.le@example.com',
    tier: 'new' as const,
  },
};

/**
 * Mock Packages
 */
export const mockPackages = {
  basic: {
    id: 'package-basic',
    name: 'Combo Mẹ & Bé Tiết Kiệm',
    price: 3000000,
    duration_minutes: 90,
  },
  premium: {
    id: 'package-premium',
    name: 'Combo Mẹ & Bé Hạnh Phúc',
    price: 5000000,
    duration_minutes: 120,
  },
  vip: {
    id: 'package-vip',
    name: 'Combo Mẹ & Bé VIP Toàn Diện',
    price: 8000000,
    duration_minutes: 150,
  },
};

/**
 * Mock KTVs
 */
export const mockKtvs = {
  senior: {
    id: 'ktv-senior-001',
    full_name: 'Phạm Thị Hoa',
    level: 'senior',
  },
  junior: {
    id: 'ktv-junior-001',
    full_name: 'Võ Thị Ngọc',
    level: 'junior',
  },
};

/**
 * Mock Waitlist Entries
 */
export const mockWaitlistEntries: Partial<WaitlistEntry>[] = [
  {
    id: 'entry-001',
    tenant_id: mockTenant.id,
    customer_id: mockCustomers.vip.id,
    customer_name: mockCustomers.vip.name_mother,
    customer_tier: 'vip',
    package_id: mockPackages.vip.id,
    package_name: mockPackages.vip.name,
    booking_value: 8000000,
    preferred_date: '2026-07-15',
    preferred_start_time: '09:00',
    duration_minutes: 150,
    preferred_ktv_id: mockKtvs.senior.id,
    preferred_ktv_name: mockKtvs.senior.full_name,
    is_flexible: false,
    priority_score: 90,
    tier_score: 40,
    value_score: 24,
    wait_time_score: 16,
    flexibility_bonus: 0,
    position: 1,
    wait_minutes: 120,
    estimated_wait_minutes: 240,
    status: 'active',
    notification_channel: 'zalo',
    notification_count: 0,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    expires_at: '2026-07-10T10:00:00Z',
  },
  {
    id: 'entry-002',
    tenant_id: mockTenant.id,
    customer_id: mockCustomers.loyal.id,
    customer_name: mockCustomers.loyal.name_mother,
    customer_tier: 'loyal',
    package_id: mockPackages.premium.id,
    package_name: mockPackages.premium.name,
    booking_value: 5000000,
    preferred_date: '2026-07-15',
    preferred_start_time: '09:30',
    duration_minutes: 120,
    is_flexible: true,
    priority_score: 75,
    tier_score: 25,
    value_score: 15,
    wait_time_score: 20,
    flexibility_bonus: 10,
    position: 2,
    wait_minutes: 90,
    estimated_wait_minutes: 180,
    status: 'active',
    notification_channel: 'sms',
    notification_count: 0,
    created_at: '2026-07-09T10:30:00Z',
    updated_at: '2026-07-09T10:30:00Z',
    expires_at: '2026-07-10T10:30:00Z',
  },
  {
    id: 'entry-003',
    tenant_id: mockTenant.id,
    customer_id: mockCustomers.new.id,
    customer_name: mockCustomers.new.name_mother,
    customer_tier: 'new',
    package_id: mockPackages.basic.id,
    package_name: mockPackages.basic.name,
    booking_value: 3000000,
    preferred_date: '2026-07-15',
    preferred_start_time: '10:00',
    duration_minutes: 90,
    is_flexible: false,
    priority_score: 55,
    tier_score: 10,
    value_score: 9,
    wait_time_score: 26,
    flexibility_bonus: 0,
    position: 3,
    wait_minutes: 60,
    estimated_wait_minutes: 120,
    status: 'active',
    notification_channel: 'email',
    notification_count: 0,
    created_at: '2026-07-09T11:00:00Z',
    updated_at: '2026-07-09T11:00:00Z',
    expires_at: '2026-07-10T11:00:00Z',
  },
];

/**
 * Mock Add to Waitlist Input
 */
export const mockAddToWaitlistInput: AddToWaitlistInput = {
  tenant_id: mockTenant.id,
  customer_id: mockCustomers.vip.id,
  package_id: mockPackages.vip.id,
  booking_value: 8000000,
  preferred_date: '2026-07-15',
  preferred_start_time: '09:00',
  duration_minutes: 150,
  preferred_ktv_id: mockKtvs.senior.id,
  is_flexible: false,
  notes: 'VIP customer, priority booking',
  created_by_user_id: 'user-admin-001',
};

/**
 * Mock Available Slot
 */
export const mockAvailableSlot: AvailableSlot = {
  tenant_id: mockTenant.id,
  package_id: mockPackages.vip.id,
  date: '2026-07-15',
  start_time: '09:00',
  end_time: '11:30',
  ktv_id: mockKtvs.senior.id,
  resource_id: 'resource-room-001',
};

/**
 * Mock Notification Logs
 */
export const mockNotificationLogs: Partial<WaitlistNotificationLog>[] = [
  {
    id: 'log-001',
    tenant_id: mockTenant.id,
    waitlist_entry_id: 'entry-001',
    customer_id: mockCustomers.vip.id,
    notification_type: 'slot_available',
    channel: 'zalo',
    status: 'sent',
    message_content: 'Chào Nguyễn Thị Hương! Có suất Combo Mẹ & Bé VIP Toàn Diện trống vào 15/07/2026 lúc 09:00. Vui lòng phản hồi trong 30 phút.',
    message_template_id: 'slot_available_zalo',
    sent_at: '2026-07-09T12:00:00Z',
    retry_count: 0,
    max_retries: 3,
    metadata: {
      messageId: 'zalo-msg-12345',
      provider: 'MockProvider',
    },
    created_at: '2026-07-09T12:00:00Z',
  },
  {
    id: 'log-002',
    tenant_id: mockTenant.id,
    waitlist_entry_id: 'entry-002',
    customer_id: mockCustomers.loyal.id,
    notification_type: 'position_updated',
    channel: 'sms',
    status: 'failed',
    message_content: 'Xin chào Trần Thị Lan! Vị trí của bạn đã được cập nhật lên #1 trong danh sách chờ.',
    message_template_id: 'position_updated_sms',
    failed_at: '2026-07-09T13:00:00Z',
    error_message: 'Invalid phone number',
    error_code: 'INVALID_PHONE',
    retry_count: 1,
    max_retries: 3,
    next_retry_at: '2026-07-09T13:05:00Z',
    metadata: {
      provider: 'MockProvider',
    },
    created_at: '2026-07-09T13:00:00Z',
  },
];

/**
 * Mock Decision Engine Provider Result
 */
export const mockProviderResult = {
  success: true,
  entry: {
    id: 'entry-temp',
    tenantId: mockTenant.id,
    customerId: mockCustomers.vip.id,
    customerName: mockCustomers.vip.name_mother,
    customerTier: 'vip' as const,
    bookingRequestId: 'booking-req-001',
    serviceId: mockPackages.vip.id,
    serviceName: mockPackages.vip.name,
    bookingValue: 8000000,
    preferredDate: '2026-07-15',
    preferredStartTime: '09:00',
    durationMinutes: 150,
    priorityScore: 90,
    position: 1,
    waitMinutes: 0,
    estimatedWaitMinutes: 240,
    status: 'active' as const,
    createdAt: '2026-07-09T10:00:00Z',
    expiresAt: '2026-07-10T10:00:00Z',
    updatedAt: '2026-07-09T10:00:00Z',
  },
  reason: 'Entry added successfully',
};

/**
 * Helper: Create a custom waitlist entry
 */
export function createMockWaitlistEntry(
  overrides: Partial<WaitlistEntry> = {}
): Partial<WaitlistEntry> {
  return {
    ...mockWaitlistEntries[0],
    ...overrides,
  };
}

/**
 * Helper: Create expired entry
 */
export function createExpiredEntry(): Partial<WaitlistEntry> {
  return createMockWaitlistEntry({
    id: 'entry-expired-001',
    status: 'active',
    expires_at: '2026-07-08T10:00:00Z', // Yesterday
  });
}

/**
 * Helper: Create notified entry
 */
export function createNotifiedEntry(): Partial<WaitlistEntry> {
  return createMockWaitlistEntry({
    id: 'entry-notified-001',
    status: 'notified',
    notified_at: '2026-07-09T12:00:00Z',
    notification_count: 1,
    last_notification_at: '2026-07-09T12:00:00Z',
  });
}
