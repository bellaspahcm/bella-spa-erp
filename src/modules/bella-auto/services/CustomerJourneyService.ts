/**
 * CustomerJourneyService
 *
 * Quản lý hành trình khách hàng (Journey Engine) qua 22 giai đoạn.
 * Điều phối việc khởi tạo hành trình, chuyển đổi giai đoạn và tính toán SLA thời gian.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface TransitionJourneyInput {
  tenantId: string;
  customerId: string;
  toStageCode: string;
  changedByUserId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export const CustomerJourneyService = {
  /**
   * Khởi tạo hành trình cho một khách hàng mới.
   */
  async startJourney(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string,
    stageCode: string = 'lead_new'
  ): Promise<{ journeyId: string; stageId: string }> {
    
    // 1. Tìm stage định nghĩa theo code
    const { data: stage, error: stageErr } = await supabase
      .from('auto_journey_stages')
      .select('id, sla_hours')
      .eq('tenant_id', tenantId)
      .eq('code', stageCode)
      .single();

    if (stageErr || !stage) {
      throw new Error(`CustomerJourneyService.startJourney: Không tìm thấy định nghĩa giai đoạn code "${stageCode}".`);
    }

    const enteredAt = new Date();
    const slaDeadline = new Date(enteredAt.getTime() + (stage.sla_hours || 24) * 60 * 60 * 1000);

    // 2. Tạo bản ghi hành trình
    const { data: journey, error: journeyErr } = await supabase
      .from('auto_customer_journeys')
      .upsert({
        tenant_id:        tenantId,
        customer_id:      customerId,
        current_stage_id: stage.id,
        entered_stage_at: enteredAt.toISOString(),
        sla_deadline:     slaDeadline.toISOString(),
        sla_status:       'on_time',
        updated_at:       enteredAt.toISOString(),
      }, {
        onConflict: 'tenant_id,customer_id'
      })
      .select('id')
      .single();

    if (journeyErr || !journey) {
      throw new Error(`CustomerJourneyService.startJourney: Lỗi khởi tạo hành trình. ${journeyErr?.message ?? ''}`);
    }

    // 3. Ghi event đầu tiên
    await supabase
      .from('auto_journey_events')
      .insert({
        tenant_id:          tenantId,
        journey_id:         journey.id,
        to_stage_id:        stage.id,
        reason:             'Khởi tạo hành trình khách hàng',
        metadata:           { stageCode },
      });

    return { journeyId: journey.id, stageId: stage.id };
  },

  /**
   * Chuyển đổi giai đoạn hành trình của khách hàng.
   */
  async transitionStage(
    supabase: SupabaseClient,
    input: TransitionJourneyInput
  ): Promise<{ success: boolean; journeyId: string; fromStageCode?: string; toStageCode: string }> {
    const { tenantId, customerId, toStageCode, changedByUserId, reason, metadata } = input;

    // 1. Lấy thông tin hành trình hiện tại của khách hàng
    type JourneyWithStage = {
      id: string;
      entered_stage_at: string;
      current_stage_id: string;
      auto_journey_stages: { code: string; name: string } | null;
    };

    const { data: journey, error: fetchErr } = await supabase
      .from('auto_customer_journeys')
      .select(`
        id, 
        entered_stage_at,
        current_stage_id,
        auto_journey_stages!current_stage_id(code, name)
      `)
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .single()
      .returns<JourneyWithStage>();

    if (fetchErr || !journey) {
      throw new Error(`CustomerJourneyService.transitionStage: Khách hàng chưa được khởi tạo hành trình.`);
    }

    const currentStage = journey.auto_journey_stages;
    const fromStageCode = currentStage?.code;
    const fromStageId = journey.current_stage_id;

    if (fromStageCode === toStageCode) {
      return { success: true, journeyId: journey.id, fromStageCode, toStageCode };
    }

    // 2. Tìm thông tin stage đích
    const { data: targetStage, error: targetErr } = await supabase
      .from('auto_journey_stages')
      .select('id, name, sla_hours')
      .eq('tenant_id', tenantId)
      .eq('code', toStageCode)
      .single();

    if (targetErr || !targetStage) {
      throw new Error(`CustomerJourneyService.transitionStage: Không tìm thấy stage đích code "${toStageCode}".`);
    }

    // 3. Tính toán thời gian lưu trú ở stage cũ (duration_hours)
    const now = new Date();
    const enteredAt = new Date(journey.entered_stage_at);
    const diffMs = now.getTime() - enteredAt.getTime();
    const durationHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

    const slaDeadline = new Date(now.getTime() + (targetStage.sla_hours || 24) * 60 * 60 * 1000);

    // 4. Cập nhật hành trình lên stage mới
    const { error: updateErr } = await supabase
      .from('auto_customer_journeys')
      .update({
        current_stage_id: targetStage.id,
        entered_stage_at: now.toISOString(),
        sla_deadline:     slaDeadline.toISOString(),
        sla_status:       'on_time',
        updated_at:       now.toISOString(),
      })
      .eq('id', journey.id)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      throw new Error(`CustomerJourneyService.transitionStage: Lỗi cập nhật stage. ${updateErr.message}`);
    }

    // 5. Ghi log sự kiện di chuyển
    const { error: eventErr } = await supabase
      .from('auto_journey_events')
      .insert({
        tenant_id:          tenantId,
        journey_id:         journey.id,
        from_stage_id:      fromStageId,
        to_stage_id:        targetStage.id,
        changed_by_user_id: changedByUserId ?? null,
        duration_hours:     durationHours,
        reason:             reason ?? `Chuyển từ ${currentStage?.name} sang ${targetStage.name}`,
        metadata:           metadata ?? {},
      });

    if (eventErr) {
      throw new Error(`CustomerJourneyService.transitionStage: Lỗi lưu event log. ${eventErr.message}`);
    }

    return {
      success: true,
      journeyId: journey.id,
      fromStageCode,
      toStageCode,
    };
  },

  /**
   * Đọc toàn bộ timeline hành trình của một khách hàng (CEO View).
   */
  async getJourneyTimeline(
    supabase: SupabaseClient,
    tenantId: string,
    customerId: string
  ) {
    const { data: journey, error: journeyErr } = await supabase
      .from('auto_customer_journeys')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (journeyErr || !journey) return [];

    const { data: events, error: eventsErr } = await supabase
      .from('auto_journey_events')
      .select(`
        id, duration_hours, reason, created_at,
        from_stage:from_stage_id(name, code),
        to_stage:to_stage_id(name, code)
      `)
      .eq('tenant_id', tenantId)
      .eq('journey_id', journey.id)
      .order('created_at', { ascending: true });

    if (eventsErr) throw new Error(`CustomerJourneyService.getJourneyTimeline: ${eventsErr.message}`);
    return events ?? [];
  }
};
