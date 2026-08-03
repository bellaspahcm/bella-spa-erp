/**
 * JourneySLAMonitorService
 *
 * Tự động giám sát thời gian lưu trú (SLA) của từng khách hàng tại mỗi Giai đoạn.
 * Phát hiện tắc nghẽn (at_risk / breached) và ghi nhận Touchpoint tương tác đa kênh.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TouchpointInput {
  tenantId: string;
  customerId: string;
  channel: 'call' | 'email' | 'zalo' | 'showroom_visit' | 'test_drive' | 'website_event';
  direction?: 'inbound' | 'outbound';
  title: string;
  content?: string;
  staffId?: string;
  metadata?: Record<string, any>;
}

export const JourneySLAMonitorService = {
  /**
   * Quét và cập nhật trạng thái SLA của toàn bộ hành trình đang hoạt động của tenant.
   * Thường được chạy định kỳ hoặc khi mở dashboard.
   */
  async scanAndUpdateSLA(
    supabase: SupabaseClient,
    tenantId: string
  ): Promise<{ processed: number; atRisk: number; breached: number }> {
    const { data: journeys, error: fetchErr } = await supabase
      .from('auto_customer_journeys')
      .select('id, entered_stage_at, sla_deadline, sla_status')
      .eq('tenant_id', tenantId);

    if (fetchErr) {
      throw new Error(`JourneySLAMonitorService.scanAndUpdateSLA: ${fetchErr.message}`);
    }

    let processed = 0;
    let atRisk = 0;
    let breached = 0;

    const now = new Date();

    for (const j of journeys ?? []) {
      const deadline = new Date(j.sla_deadline);
      const enteredAt = new Date(j.entered_stage_at);
      let nextStatus = 'on_time';

      if (now.getTime() > deadline.getTime()) {
        nextStatus = 'breached';
        breached++;
      } else {
        // Hạn chót ở stage này còn dưới 25% thời hạn SLA ban đầu
        const totalDuration = deadline.getTime() - enteredAt.getTime();
        const remaining = deadline.getTime() - now.getTime();
        if (remaining < totalDuration * 0.25) {
          nextStatus = 'at_risk';
          atRisk++;
        }
      }

      processed++;

      // Chỉ cập nhật nếu trạng thái SLA bị thay đổi để tối ưu hóa DB
      if (j.sla_status !== nextStatus) {
        await supabase
          .from('auto_customer_journeys')
          .update({
            sla_status: nextStatus,
            updated_at: now.toISOString(),
          })
          .eq('id', j.id);
      }
    }

    return { processed, atRisk, breached };
  },

  /**
   * Ghi nhận touchpoint tương tác tự động/thủ công đa kênh (Phase 3.5).
   */
  async recordTouchpoint(
    supabase: SupabaseClient,
    input: TouchpointInput
  ): Promise<string> {
    const { data, error } = await supabase
      .from('auto_touchpoints')
      .insert({
        tenant_id:     input.tenantId,
        customer_id:   input.customerId,
        channel:       input.channel,
        direction:     input.direction ?? 'inbound',
        title:         input.title,
        content:       input.content ?? null,
        staff_id:      input.staffId ?? null,
        metadata:      input.metadata ?? {},
        interacted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`JourneySLAMonitorService.recordTouchpoint: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Lấy danh sách Touchpoint của một khách hàng.
   */
  async getTouchpoints(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string
  ) {
    const { data, error } = await supabase
      .from('auto_touchpoints')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('interacted_at', { ascending: false });

    if (error) throw new Error(`JourneySLAMonitorService.getTouchpoints: ${error.message}`);
    return data ?? [];
  }
};
