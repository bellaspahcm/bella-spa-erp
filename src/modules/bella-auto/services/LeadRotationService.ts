/**
 * LeadRotationService
 *
 * Tự động điều phối phân bổ cơ hội bán hàng (Lead) cho TVBH (Sales Agents).
 * Hỗ trợ thuật toán Round Robin (Xoay vòng) và Smart Allocation (dựa trên Conversion Rate).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentPerformance {
  agentId: string;
  totalAssigned: number;
  totalWon: number;
  conversionRate: number;
}

export const LeadRotationService = {
  /**
   * Phân bổ xoay vòng (Round Robin) đơn giản dựa trên hàng đợi lịch sử phân bổ của các Agent.
   */
  async rotateLeadRoundRobin(
    supabase: SupabaseClient,
    tenantId: string,
    leadId: string,
    agentIds: string[]
  ): Promise<string> {
    if (agentIds.length === 0) {
      throw new Error('LeadRotationService: Danh sách Agent rỗng, không thể phân bổ.');
    }

    // 1. Tìm Agent nhận Lead lâu nhất trước đây (hoặc chưa bao giờ nhận)
    const { data: lastLeads, error: queryErr } = await supabase
      .from('auto_leads')
      .select('assigned_sales_agent_id, assigned_at')
      .eq('tenant_id', tenantId)
      .in('assigned_sales_agent_id', agentIds)
      .order('assigned_at', { ascending: false });

    if (queryErr) {
      throw new Error(`LeadRotationService: Lỗi tìm lịch sử phân bổ. ${queryErr.message}`);
    }

    // Lọc ra các agent chưa từng nhận lead nào
    const assignedAgentIds = lastLeads?.map(l => l.assigned_sales_agent_id) ?? [];
    const unassignedAgents = agentIds.filter(id => !assignedAgentIds.includes(id));

    let targetAgentId = '';
    if (unassignedAgents.length > 0) {
      targetAgentId = unassignedAgents[0]; // Ưu tiên các agent chưa nhận lead nào
    } else {
      // Chọn agent có thời điểm nhận lead cũ nhất
      const oldestAssignment = [...(lastLeads ?? [])].reverse()[0];
      targetAgentId = oldestAssignment.assigned_sales_agent_id;
    }

    // 2. Thực hiện cập nhật lead
    const { error: updateErr } = await supabase
      .from('auto_leads')
      .update({
        assigned_sales_agent_id: targetAgentId,
        assigned_at:             new Date().toISOString(),
        status:                  'contacted',
        updated_at:              new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      throw new Error(`LeadRotationService: Lỗi phân bổ Lead. ${updateErr.message}`);
    }

    return targetAgentId;
  },

  /**
   * Phân bổ Lead thông minh (Smart Allocation) dựa trên Tỷ Lệ Chuyển Đổi (Conversion Rate) thắng đơn.
   * Ưu tiên Agent có hiệu suất cao hơn.
   */
  async rotateLeadByPerformance(
    supabase: SupabaseClient,
    tenantId: string,
    leadId: string,
    agentIds: string[]
  ): Promise<string> {
    if (agentIds.length === 0) {
      throw new Error('LeadRotationService: Danh sách Agent rỗng.');
    }

    // 1. Phân tích hiệu suất của từng Agent gần đây
    const performances: AgentPerformance[] = [];

    for (const agentId of agentIds) {
      const { data: leads, error } = await supabase
        .from('auto_leads')
        .select('status')
        .eq('tenant_id', tenantId)
        .eq('assigned_sales_agent_id', agentId);

      if (error) continue;

      const totalAssigned = leads?.length ?? 0;
      const totalWon = leads?.filter(l => l.status === 'won').length ?? 0;
      const conversionRate = totalAssigned > 0 ? totalWon / totalAssigned : 0;

      performances.push({ agentId, totalAssigned, totalWon, conversionRate });
    }

    // 2. Sắp xếp Agent theo tỷ lệ conversion rate giảm dần, nếu bằng nhau thì ưu tiên người nhận ít lead hơn
    performances.sort((a, b) => {
      if (b.conversionRate !== a.conversionRate) {
        return b.conversionRate - a.conversionRate;
      }
      return a.totalAssigned - b.totalAssigned;
    });

    const bestAgentId = performances[0].agentId;

    // 3. Phân bổ lead cho agent tốt nhất
    const { error: updateErr } = await supabase
      .from('auto_leads')
      .update({
        assigned_sales_agent_id: bestAgentId,
        assigned_at:             new Date().toISOString(),
        status:                  'contacted',
        updated_at:              new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      throw new Error(`LeadRotationService: Lỗi phân bổ Lead theo hiệu suất. ${updateErr.message}`);
    }

    return bestAgentId;
  }
};
