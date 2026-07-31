/**
 * Waitlist Service Layer
 * 
 * Business logic for waitlist management:
 * - Add customer to waitlist with priority calculation
 * - List waitlist entries with filters/pagination
 * - Process slot availability (auto-notify top customers)
 * - Expire old entries (cleanup cron job)
 * - Update positions when waitlist changes
 * - Convert waitlist entry to booking
 * - Manual notifications
 * 
 * Integration:
 * - Database: Supabase (waitlist_entries, waitlist_notification_logs)
 * - Decision Engine: WaitlistManagementProvider (priority calculation)
 * - Notification Service: notification-service.ts (Zalo/SMS/Email)
 * - Audit: audit_logs table
 * 
 * @module services/waitlist
 */

import { createClient } from '@/lib/supabase-server';
import { WaitlistManagementProvider } from '@/lib/decision-engine/providers/booking/waitlist-management-provider';
import { sendNotification } from '@/services/notifications/notification-service';
import type {
  WaitlistEntry,
  AddToWaitlistInput,
  AddToWaitlistOutput,
  WaitlistFilters,
  WaitlistListResponse,
  AvailableSlot,
  ProcessSlotResult,
  WaitlistStats,
  CustomerTier,
  NotificationChannel,
} from '@/types/waitlist';
import type {
  WaitlistManagementInput,
} from '@/lib/decision-engine/providers/booking/types';

/**
 * Add Customer to Waitlist
 * 
 * Flow:
 * 1. Validate input
 * 2. Check for duplicate active entry
 * 3. Fetch customer & package details
 * 4. Calculate priority score (via WaitlistManagementProvider)
 * 5. Calculate position in queue
 * 6. Insert into database
 * 7. Audit log
 * 8. Auto-notify if position <= 3
 * 
 * @param input - Waitlist entry details
 * @returns Success/failure with entry details
 */
export async function addToWaitlist(
  input: AddToWaitlistInput
): Promise<AddToWaitlistOutput> {
  const supabase = createClient();

  try {
    // 1. Validate input
    if (!input.tenant_id) throw new Error('tenant_id is required');
    if (!input.customer_id) throw new Error('customer_id is required');
    if (!input.package_id) throw new Error('package_id is required');
    if (!input.preferred_date) throw new Error('preferred_date is required');
    if (!input.preferred_start_time) throw new Error('preferred_start_time is required');
    if (input.booking_value < 0) throw new Error('booking_value must be >= 0');

    // 2. Check for duplicate active entry (same customer, service, date)
    const { data: existingEntries, error: checkError } = await supabase
      .from('waitlist_entries')
      .select('id, status')
      .eq('tenant_id', input.tenant_id)
      .eq('customer_id', input.customer_id)
      .eq('package_id', input.package_id)
      .eq('preferred_date', input.preferred_date)
      .in('status', ['active', 'notified', 'reserved']);

    if (checkError) {
      console.error('[waitlist-service] Error checking duplicate:', checkError);
      return {
        success: false,
        error: 'Database error while checking duplicate',
        error_code: 'DATABASE_ERROR',
      };
    }

    if (existingEntries && existingEntries.length > 0) {
      return {
        success: false,
        error: `Customer already in waitlist for this service on ${input.preferred_date}`,
        error_code: 'DUPLICATE_ENTRY',
      };
    }

    // 3. Fetch customer details (for name, tier)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name_mother, phone, status')
      .eq('id', input.customer_id)
      .single();

    if (customerError || !customer) {
      console.error('[waitlist-service] Error fetching customer:', customerError);
      return {
        success: false,
        error: 'Customer not found',
        error_code: 'VALIDATION_ERROR',
      };
    }

    // 4. Calculate customer waitlist tier based on status, bookings count and membership
    const { count: completedBookingsCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', input.customer_id)
      .eq('status', 'completed');

    const { data: membership } = await supabase
      .from('membership_records')
      .select('tier')
      .eq('customer_id', input.customer_id)
      .maybeSingle();

    let customerTier: 'vip' | 'loyal' | 'new' = 'new';
    const mTier = membership?.tier?.toLowerCase();
    
    if (mTier === 'vip' || mTier === 'gold' || mTier === 'platinum' || mTier === 'diamond') {
      customerTier = 'vip';
    } else if (mTier === 'silver' || mTier === 'loyal') {
      customerTier = 'loyal';
    } else {
      if (customer.status === 'vip') {
        customerTier = 'vip';
      } else if ((completedBookingsCount || 0) >= 5) {
        customerTier = 'loyal';
      }
    }

    // 5. Fetch package details (for name)
    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .select('id, name')
      .eq('id', input.package_id)
      .single();

    if (packageError || !packageData) {
      console.error('[waitlist-service] Error fetching package:', packageError);
      return {
        success: false,
        error: 'Service package not found',
        error_code: 'VALIDATION_ERROR',
      };
    }

    // 6. Fetch existing waitlist entries for this slot (for position calculation)
    const { data: existingWaitlist, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('tenant_id', input.tenant_id)
      .eq('package_id', input.package_id)
      .eq('preferred_date', input.preferred_date)
      .in('status', ['active', 'notified', 'reserved']);

    if (waitlistError) {
      console.error('[waitlist-service] Error fetching waitlist:', waitlistError);
      return {
        success: false,
        error: 'Database error while fetching waitlist',
        error_code: 'DATABASE_ERROR',
      };
    }

    // 7. Check capacity limit
    // Fetch from tenant config
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('contact_phone, metadata')
      .eq('id', input.tenant_id)
      .single();

    const tenantMetadata = tenantData?.metadata as Record<string, unknown> | null;
    const maxWaitlistSize = typeof tenantMetadata?.max_waitlist_size === 'number'
      ? tenantMetadata.max_waitlist_size
      : 10;

    if (existingWaitlist && existingWaitlist.length >= maxWaitlistSize) {
      return {
        success: false,
        error: `Waitlist is full (${existingWaitlist.length}/${maxWaitlistSize}). Try alternative time slots.`,
        error_code: 'CAPACITY_FULL',
      };
    }

    // 8. Calculate priority score using WaitlistManagementProvider
    const waitlistProvider = new WaitlistManagementProvider();
    const providerInput: WaitlistManagementInput = {
      tenantId: input.tenant_id,
      customer: {
        id: input.customer_id,
        name: customer.name_mother,
        tier: customerTier,
        email: '',
        phone: customer.phone,
        contactPreferences: {
          preferredChannel: 'sms', // Map Zalo/preferred to SMS for rule evaluation
          acceptsMarketing: true,
        },
      },
      booking: {
        serviceId: input.package_id,
        serviceName: packageData.name,
        serviceType: 'package',
        bookingValue: input.booking_value,
        preferredDate: input.preferred_date,
        preferredStartTime: input.preferred_start_time,
        durationMinutes: input.duration_minutes || 90,
        isFlexible: input.is_flexible || false,
      },
      existingWaitlist: (existingWaitlist || []).map((e) => ({
        id: e.id,
        tenantId: e.tenant_id,
        customerId: e.customer_id,
        customerName: e.customer_name,
        customerTier: (e.customer_tier as CustomerTier) || 'new',
        bookingRequestId: e.booking_request_id || '',
        serviceId: e.package_id,
        serviceName: e.package_name,
        bookingValue: e.booking_value,
        preferredDate: e.preferred_date,
        preferredStartTime: e.preferred_start_time,
        durationMinutes: e.duration_minutes,
        priorityScore: e.priority_score,
        position: e.position,
        waitMinutes: e.wait_minutes || 0,
        status: (e.status as WaitlistEntry['status']) || 'active',
        createdAt: e.created_at,
        expiresAt: e.expires_at,
        updatedAt: e.updated_at,
      })) as WaitlistManagementInput['existingWaitlist'],
      config: {
        enablePriorityRanking: true,
        enableAutoNotification: true,
        slotReservationMinutes: 30,
        waitlistExpiryHours: 24,
        maxWaitlistSize,
      },
    };

    const providerResult = await waitlistProvider.addToWaitlist(providerInput);

    if (!providerResult.success) {
      return {
        success: false,
        error: providerResult.reason,
        error_code: 'VALIDATION_ERROR',
      };
    }

    // 9. Fetch preferred KTV/resource names (if provided)
    let preferredKtvName: string | null = null;
    let preferredResourceName: string | null = null;

    if (input.preferred_ktv_id) {
      const { data: ktv } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', input.preferred_ktv_id)
        .single();
      preferredKtvName = ktv?.full_name || null;
    }

    if (input.preferred_resource_id) {
      const { data: resource } = await supabase
        .from('booking_resources')
        .select('name')
        .eq('id', input.preferred_resource_id)
        .single();
      preferredResourceName = resource?.name || null;
    }

    // 10. Prepare database insert
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const newEntry = {
      tenant_id: input.tenant_id,
      customer_id: input.customer_id,
      customer_name: customer.name_mother,
      customer_tier: customerTier,
      booking_id: input.booking_id || null,
      booking_request_id: providerResult.entry.bookingRequestId,
      package_id: input.package_id,
      package_name: packageData.name,
      booking_value: input.booking_value,
      preferred_date: input.preferred_date,
      preferred_start_time: input.preferred_start_time,
      duration_minutes: input.duration_minutes || 90,
      preferred_ktv_id: input.preferred_ktv_id || null,
      preferred_ktv_name: preferredKtvName,
      preferred_resource_id: input.preferred_resource_id || null,
      preferred_resource_name: preferredResourceName,
      is_flexible: input.is_flexible || false,
      priority_score: providerResult.entry.priorityScore,
      // TODO: Extract from provider result when available
      tier_score: customerTier === 'vip' ? 40 : customerTier === 'loyal' ? 25 : 10,
      value_score: Math.min(30, (input.booking_value / 10000000) * 30),
      wait_time_score: 0, // New entry
      flexibility_bonus: (input.is_flexible || false) ? 10 : 0,
      position: providerResult.entry.position,
      wait_minutes: 0,
      estimated_wait_minutes: providerResult.entry.estimatedWaitMinutes,
      status: providerResult.entry.status,
      expires_at: expiresAt.toISOString(),
      notification_channel: 'zalo', // Default
      notification_count: 0,
      notes: input.notes || null,
      created_by_user_id: input.created_by_user_id || null,
    };

    // 11. Insert into database
    const { data: insertedEntry, error: insertError } = await supabase
      .from('waitlist_entries')
      .insert(newEntry)
      .select()
      .single();

    if (insertError || !insertedEntry) {
      console.error('[waitlist-service] Error inserting entry:', insertError);
      return {
        success: false,
        error: 'Failed to add to waitlist',
        error_code: 'DATABASE_ERROR',
      };
    }

    // 12. Audit log
    // (Auto-logged by audit_log_trigger on waitlist_entries)

    // 13. Return success
    return {
      success: true,
      entry: insertedEntry as WaitlistEntry,
      position: providerResult.entry.position,
      estimated_wait_minutes: providerResult.entry.estimatedWaitMinutes,
    };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in addToWaitlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_code: 'DATABASE_ERROR',
    };
  }
}

/**
 * Get Waitlist Entries (with filters & pagination)
 * 
 * @param filters - Filter criteria
 * @returns Paginated list of waitlist entries
 */
export async function getWaitlistEntries(
  filters: WaitlistFilters
): Promise<WaitlistListResponse> {
  const supabase = createClient();

  try {
    // Build query
    let query = supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact' })
      .eq('tenant_id', filters.tenant_id);

    // Apply filters
    if (filters.package_id) {
      query = query.eq('package_id', filters.package_id);
    }

    if (filters.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.preferred_date) {
      query = query.eq('preferred_date', filters.preferred_date);
    }

    if (filters.date_from) {
      query = query.gte('preferred_date', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('preferred_date', filters.date_to);
    }

    if (filters.min_priority) {
      query = query.gte('priority_score', filters.min_priority);
    }

    if (filters.max_priority) {
      query = query.lte('priority_score', filters.max_priority);
    }

    // Sorting
    const sortBy = filters.sort_by || 'priority';
    const sortOrder = filters.sort_order || 'desc';

    if (sortBy === 'priority') {
      query = query.order('priority_score', { ascending: sortOrder === 'asc' });
      query = query.order('created_at', { ascending: true }); // Tie-breaker: older first
    } else if (sortBy === 'position') {
      query = query.order('position', { ascending: true });
    } else if (sortBy === 'created_at') {
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
    } else if (sortBy === 'wait_time') {
      query = query.order('wait_minutes', { ascending: sortOrder === 'asc' });
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('[waitlist-service] Error fetching waitlist:', error);
      return {
        entries: [],
        total: 0,
        page: 1,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      entries: (data as WaitlistEntry[]) || [],
      total,
      page,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in getWaitlistEntries:', error);
    return {
      entries: [],
      total: 0,
      page: 1,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    };
  }
}

/**
 * Get Single Waitlist Entry by ID
 * 
 * @param entryId - Waitlist entry UUID
 * @returns Waitlist entry or null
 */
export async function getWaitlistEntry(entryId: string): Promise<WaitlistEntry | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('id', entryId)
      .single();

    if (error || !data) {
      console.error('[waitlist-service] Error fetching entry:', error);
      return null;
    }

    return data as WaitlistEntry;
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in getWaitlistEntry:', error);
    return null;
  }
}

// TODO: Implement remaining 5 functions in next file chunk:
// - updateWaitlistEntry
// - removeFromWaitlist
// - processSlotAvailable
// - expireOldEntries
// - recalculatePositions

/**
 * Update Waitlist Entry
 * 
 * Allows updating:
 * - Status (active → notified → reserved → converted/cancelled/expired)
 * - Notes (internal_notes)
 * - Position (manual reordering)
 * 
 * @param entryId - Waitlist entry UUID
 * @param updates - Fields to update
 * @returns Success/failure
 */
export async function updateWaitlistEntry(
  entryId: string,
  updates: Partial<Pick<WaitlistEntry, 
    'status' | 
    'notes' | 
    'internal_notes' | 
    'position' | 
    'removed_by_user_id' | 
    'removal_reason'
  >>
): Promise<{ success: boolean; entry?: WaitlistEntry; error?: string }> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('waitlist_entries')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();

    if (error || !data) {
      console.error('[waitlist-service] Error updating entry:', error);
      return {
        success: false,
        error: 'Failed to update waitlist entry',
      };
    }

    return {
      success: true,
      entry: data as WaitlistEntry,
    };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in updateWaitlistEntry:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove from Waitlist
 * 
 * Sets status to 'cancelled' and records removal reason.
 * Does NOT delete row (keep for audit trail).
 * 
 * @param entryId - Waitlist entry UUID
 * @param reason - Removal reason
 * @param removedByUserId - User who removed (optional)
 * @returns Success/failure
 */
export async function removeFromWaitlist(
  entryId: string,
  reason: string,
  removedByUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('waitlist_entries')
      .update({
        status: 'cancelled',
        removal_reason: reason,
        removed_by_user_id: removedByUserId || null,
        removed_at: now,
      })
      .eq('id', entryId);

    if (error) {
      console.error('[waitlist-service] Error removing entry:', error);
      return {
        success: false,
        error: 'Failed to remove from waitlist',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in removeFromWaitlist:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process Slot Available
 * 
 * When a slot becomes available (cancellation, reschedule, new slot),
 * notify top-priority customers in waitlist.
 * 
 * Flow:
 * 1. Find active waitlist entries for this slot
 * 2. Sort by priority (highest first)
 * 3. Notify top 3 customers
 * 4. Update entry status to 'notified'
 * 5. Create notification logs
 * 
 * @param slot - Available slot details
 * @returns List of notified customers
 */
export async function processSlotAvailable(
  slot: AvailableSlot
): Promise<ProcessSlotResult> {
  const supabase = createClient();

  try {
    // 1. Find active waitlist entries for this slot
    const { data: entries, error: fetchError } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('tenant_id', slot.tenant_id)
      .eq('package_id', slot.package_id)
      .eq('preferred_date', slot.date)
      .in('status', ['active', 'notified'])
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10); // Process max 10 (top candidates)

    if (fetchError || !entries || entries.length === 0) {
      console.log('[waitlist-service] No active entries found for slot');
      return {
        slot,
        notified_customers: [],
        total_notified: 0,
      };
    }

    // 2. Calculate match score for each entry
    const entriesWithMatch = entries.map((entry) => {
      let matchScore = 0;

      // Exact date match
      if (entry.preferred_date === slot.date) {
        matchScore += 40;
      }

      // Time match (exact = +40, within 30 min = +20, within 60 min = +10)
      const entryTime = parseTime(entry.preferred_start_time);
      const slotTime = parseTime(slot.start_time);
      const timeDiff = Math.abs(entryTime - slotTime);

      if (timeDiff === 0) {
        matchScore += 40;
      } else if (timeDiff <= 30) {
        matchScore += 20;
      } else if (timeDiff <= 60) {
        matchScore += 10;
      }

      // KTV match (if specified)
      if (slot.ktv_id && entry.preferred_ktv_id === slot.ktv_id) {
        matchScore += 20;
      }

      return {
        entry: entry as WaitlistEntry,
        matchScore,
      };
    });

    // 3. Filter by minimum match score (50% = 50 points)
    const goodMatches = entriesWithMatch.filter((e) => e.matchScore >= 50);

    // 4. Notify top 3
    const toNotify = goodMatches.slice(0, 3);
    const notifiedCustomers: ProcessSlotResult['notified_customers'] = [];

    // Fetch tenant contact phone
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('contact_phone')
      .eq('id', slot.tenant_id)
      .single();
    const contactPhone = tenantData?.contact_phone || '1900xxxx';

    for (const { entry, matchScore } of toNotify) {
      // Determine notification channel (prefer Zalo for VIP)
      const channel: NotificationChannel = entry.customer_tier === 'vip' ? 'zalo' : 'sms';

      // Send notification via notification service
      const notificationResult = await sendNotification({
        entryId: entry.id,
        customerId: entry.customer_id,
        tenantId: entry.tenant_id,
        type: 'slot_available',
        preferredChannel: channel,
        data: {
          customerName: entry.customer_name,
          serviceName: entry.package_name,
          date: slot.date,
          time: slot.start_time,
          contactPhone,
        },
      });

      // Update entry status if notification sent successfully
      if (notificationResult.success) {
        const { error: updateError } = await supabase
          .from('waitlist_entries')
          .update({
            status: 'notified',
            notification_channel: channel,
            notified_at: new Date().toISOString(),
            notification_count: entry.notification_count + 1,
            last_notification_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error('[waitlist-service] Error updating entry status:', updateError);
          continue;
        }
      }

      notifiedCustomers.push({
        entry_id: entry.id,
        customer_id: entry.customer_id,
        customer_name: entry.customer_name,
        notification_sent: notificationResult.success,
        notification_channel: channel,
        match_score: matchScore,
      });
    }

    return {
      slot,
      notified_customers: notifiedCustomers,
      total_notified: notifiedCustomers.length,
    };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in processSlotAvailable:', error);
    return {
      slot,
      notified_customers: [],
      total_notified: 0,
    };
  }
}

/**
 * Expire Old Entries
 * 
 * Cleanup cron job: Find entries that exceeded expiry time
 * and mark as 'expired'.
 * 
 * Should run every hour.
 * 
 * @param tenantId - Tenant UUID
 * @returns Number of entries expired
 */
export async function expireOldEntries(tenantId: string): Promise<{ expired_count: number }> {
  const supabase = createClient();

  try {
    const now = new Date().toISOString();

    // Find expired entries (expires_at < now AND status IN (active, notified))
    const { data: expiredEntries, error: fetchError } = await supabase
      .from('waitlist_entries')
      .select('id, customer_id, customer_name, package_name')
      .eq('tenant_id', tenantId)
      .lt('expires_at', now)
      .in('status', ['active', 'notified']);

    if (fetchError || !expiredEntries || expiredEntries.length === 0) {
      return { expired_count: 0 };
    }

    // Update status to 'expired'
    const entryIds = expiredEntries.map((e) => e.id);

    const { error: updateError } = await supabase
      .from('waitlist_entries')
      .update({
        status: 'expired',
        removed_at: now,
        removal_reason: 'Automatic expiry (exceeded waitlist timeout)',
      })
      .in('id', entryIds);

    if (updateError) {
      console.error('[waitlist-service] Error updating expired entries:', updateError);
      return { expired_count: 0 };
    }

    // Fetch tenant contact phone
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('contact_phone')
      .eq('id', tenantId)
      .single();
    const contactPhone = tenantData?.contact_phone || '1900xxxx';

    // Send expiry notifications via notification service
    for (const entry of expiredEntries) {
      await sendNotification({
        entryId: entry.id,
        customerId: entry.customer_id,
        tenantId: tenantId,
        type: 'expired',
        data: {
          customerName: entry.customer_name,
          serviceName: entry.package_name,
          contactPhone,
        },
      });
    }

    console.log(`[waitlist-service] Expired ${expiredEntries.length} entries for tenant ${tenantId}`);

    return { expired_count: expiredEntries.length };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in expireOldEntries:', error);
    return { expired_count: 0 };
  }
}

/**
 * Recalculate Positions
 * 
 * Reorder waitlist entries by priority score after changes.
 * 
 * Called when:
 * - New entry added
 * - Entry removed
 * - Priority score changes
 * 
 * @param tenantId - Tenant UUID
 * @param packageId - Package UUID
 * @param preferredDate - Date (YYYY-MM-DD)
 * @returns Number of entries updated
 */
export async function recalculatePositions(
  tenantId: string,
  packageId: string,
  preferredDate: string
): Promise<{ updated_count: number }> {
  const supabase = createClient();

  try {
    // Fetch active entries sorted by priority
    const { data: entries, error: fetchError } = await supabase
      .from('waitlist_entries')
      .select('id, priority_score')
      .eq('tenant_id', tenantId)
      .eq('package_id', packageId)
      .eq('preferred_date', preferredDate)
      .in('status', ['active', 'notified', 'reserved'])
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true });

    if (fetchError || !entries || entries.length === 0) {
      return { updated_count: 0 };
    }

    // Update positions
    let updatedCount = 0;
    for (let i = 0; i < entries.length; i++) {
      const newPosition = i + 1;

      const { error: updateError } = await supabase
        .from('waitlist_entries')
        .update({ position: newPosition })
        .eq('id', entries[i].id);

      if (!updateError) {
        updatedCount++;
      }
    }

    console.log(`[waitlist-service] Recalculated ${updatedCount} positions`);

    return { updated_count: updatedCount };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in recalculatePositions:', error);
    return { updated_count: 0 };
  }
}

/**
 * Get Waitlist Statistics
 * 
 * Dashboard metrics:
 * - Total/active/notified/converted/expired counts
 * - Conversion rate (% notified → converted)
 * - Average wait time
 * - Top services by waitlist size
 * 
 * @param tenantId - Tenant UUID
 * @param period - Time period ('today', 'week', 'month')
 * @returns Waitlist statistics
 */
export async function getWaitlistStats(
  tenantId: string,
  period: 'today' | 'week' | 'month' = 'week'
): Promise<WaitlistStats> {
  const supabase = createClient();

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch entries in period
    const { data: entries, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (error || !entries) {
      console.error('[waitlist-service] Error fetching stats:', error);
      return {
        tenant_id: tenantId,
        period,
        total_entries: 0,
        active_entries: 0,
        notified_entries: 0,
        converted_entries: 0,
        expired_entries: 0,
        conversion_rate: 0,
        avg_wait_minutes: 0,
        avg_position: 0,
        top_services: [],
      };
    }

    // Calculate counts
    const totalEntries = entries.length;
    const activeEntries = entries.filter((e) => e.status === 'active').length;
    const notifiedEntries = entries.filter((e) => e.status === 'notified').length;
    const convertedEntries = entries.filter((e) => e.status === 'converted').length;
    const expiredEntries = entries.filter((e) => e.status === 'expired').length;

    // Conversion rate
    const totalNotified = entries.filter((e) => ['notified', 'converted', 'reserved'].includes(e.status)).length;
    const conversionRate = totalNotified > 0 ? (convertedEntries / totalNotified) * 100 : 0;

    // Average wait time
    const totalWaitMinutes = entries.reduce((sum, e) => sum + (e.wait_minutes ?? 0), 0);
    const avgWaitMinutes = totalEntries > 0 ? totalWaitMinutes / totalEntries : 0;

    // Average position
    const totalPosition = entries.reduce((sum, e) => sum + e.position, 0);
    const avgPosition = totalEntries > 0 ? totalPosition / totalEntries : 0;

    // Top services
    const serviceMap = new Map<string, { count: number; converted: number; name: string }>();

    for (const entry of entries) {
      const existing = serviceMap.get(entry.package_id);
      if (existing) {
        existing.count++;
        if (entry.status === 'converted') {
          existing.converted++;
        }
      } else {
        serviceMap.set(entry.package_id, {
          count: 1,
          converted: entry.status === 'converted' ? 1 : 0,
          name: entry.package_name,
        });
      }
    }

    const topServices = Array.from(serviceMap.entries())
      .map(([packageId, data]) => ({
        package_id: packageId,
        package_name: data.name,
        entry_count: data.count,
        conversion_rate: data.count > 0 ? (data.converted / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.entry_count - a.entry_count)
      .slice(0, 5); // Top 5

    return {
      tenant_id: tenantId,
      period,
      total_entries: totalEntries,
      active_entries: activeEntries,
      notified_entries: notifiedEntries,
      converted_entries: convertedEntries,
      expired_entries: expiredEntries,
      conversion_rate: conversionRate,
      avg_wait_minutes: avgWaitMinutes,
      avg_position: avgPosition,
      top_services: topServices,
    };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in getWaitlistStats:', error);
    return {
      tenant_id: tenantId,
      period,
      total_entries: 0,
      active_entries: 0,
      notified_entries: 0,
      converted_entries: 0,
      expired_entries: 0,
      conversion_rate: 0,
      avg_wait_minutes: 0,
      avg_position: 0,
      top_services: [],
    };
  }
}

/**
 * Convert Waitlist Entry to Booking
 * 
 * Flow:
 * 1. Fetch waitlist entry
 * 2. Fetch package details to get price and total sessions
 * 3. Create booking using createBooking server action
 * 4. Update waitlist entry status to 'converted'
 * 5. Recalculate queue positions
 * 
 * @param entryId - Waitlist entry UUID
 * @returns Success/failure and created booking
 */
export async function convertToBooking(
  entryId: string
): Promise<{ success: boolean; booking?: unknown; error?: string }> {
  const supabase = createClient();

  try {
    // 1. Fetch waitlist entry
    const entry = await getWaitlistEntry(entryId);
    if (!entry) {
      return { success: false, error: 'Không tìm thấy khách hàng trong danh sách chờ' };
    }

    if (entry.status === 'converted') {
      return { success: false, error: 'Khách hàng này đã được chuyển sang lịch hẹn trước đó' };
    }

    // 2. Fetch package details
    const { data: packageData, error: pkgError } = await supabase
      .from('packages')
      .select('price, total_sessions')
      .eq('id', entry.package_id)
      .single();

    if (pkgError) {
      console.error('[waitlist-service] Error fetching package:', pkgError);
      return { success: false, error: 'Lỗi khi tải thông tin gói dịch vụ: ' + pkgError.message };
    }

    if (!packageData) {
      return { success: false, error: 'Gói dịch vụ không tồn tại trong hệ thống' };
    }

    // 3. Create booking
    const { createBooking } = await import('@/core/services/order/create-booking-action');
    
    // Ensure preferred time is in HH:mm format
    const preferredTime = entry.preferred_start_time 
      ? entry.preferred_start_time.substring(0, 5) 
      : undefined;

    const bookingResult = await createBooking({
      customer_id: entry.customer_id,
      package_id: entry.package_id,
      package_name: entry.package_name,
      full_price: entry.booking_value || packageData.price || 0,
      deposit_amount: 0,
      total_sessions: packageData.total_sessions || 15,
      start_date: entry.preferred_date,
      assigned_ktv_id: entry.preferred_ktv_id || undefined,
      preferred_time: preferredTime,
      metadata: {
        waitlist_entry_id: entry.id,
      }
    });

    if ('error' in bookingResult) {
      return { success: false, error: bookingResult.error };
    }

    const booking = bookingResult.data;

    // 4. Update waitlist entry status to 'converted'
    const { error: updateError } = await supabase
      .from('waitlist_entries')
      .update({
        status: 'converted',
        converted_to_booking_id: booking.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', entryId);

    if (updateError) {
      console.error('[waitlist-service] Error updating converted status:', updateError);
      return { 
        success: false, 
        error: 'Tạo lịch hẹn thành công nhưng không thể cập nhật trạng thái hàng chờ: ' + updateError.message 
      };
    }

    // 5. Recalculate queue positions
    await recalculatePositions(entry.tenant_id, entry.package_id, entry.preferred_date);

    // 6. Audit log
    try {
      const { recordAuditLog } = await import('@/services/audit-actions');
      await recordAuditLog({
        action: 'UPDATE',
        table_name: 'waitlist_entries',
        record_id: entryId,
        new_data: { status: 'converted', converted_to_booking_id: booking.id },
      });
    } catch (auditErr) {
      console.error('[waitlist-service] Failed to record waitlist convert audit log:', auditErr);
    }

    return {
      success: true,
      booking,
    };
  } catch (error) {
    console.error('[waitlist-service] Unexpected error in convertToBooking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi hệ thống không xác định',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param timeStr - Time string (e.g., "14:30")
 * @returns Minutes since midnight
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
