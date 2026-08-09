import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';
import { RealEstateExecutiveSkill } from '@/modules/real_estate/contexts/shared/ai-skills';

interface RealEstateAnomaly {
  type: string;
  project_name: string;
  available_count: number;
  ratio: number;
  message: string;
}

interface RealEstateDraftProposal {
  type: string;
  recipient: string;
  reason: string;
  draftMessage: string;
}

export async function runRealEstateAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Routing to: Real Estate Sub-Agent");

  // 1. Query projects
  const { data: projects, error: projectsError } = await supabase
    .from("real_estate_projects")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (projectsError) {
    console.error("[Real Estate Agent] Error fetching real_estate_projects:", projectsError);
    throw projectsError;
  }

  // 2. Query products
  const { data: products, error: productsError } = await supabase
    .from("real_estate_products")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("product_code");

  if (productsError) {
    console.error("[Real Estate Agent] Error fetching real_estate_products:", productsError);
    throw productsError;
  }

  const items = products || [];
  const projList = projects || [];

  const availableCount = items.filter(p => p.status === 'available').length;
  const bookedCount = items.filter(p => p.status === 'booked').length;
  const depositedCount = items.filter(p => p.status === 'deposited').length;
  const signedCount = items.filter(p => p.status === 'contracted').length;
  const handoverCount = items.filter(p => p.status === 'handed_over').length;

  const totalValue = items.reduce((sum, item) => sum + Number(item.unit_price || 0), 0);
  const soldValue = items
    .filter(p => ['deposited', 'contracted', 'handed_over'].includes(p.status))
    .reduce((sum, item) => sum + Number(item.unit_price || 0), 0);

  // Identify anomalies
  const anomalies: RealEstateAnomaly[] = [];
  const draftProposals: RealEstateDraftProposal[] = [];

  // Check if any block is almost sold out
  projList.forEach(proj => {
    const projProducts = items.filter(p => p.project_id === proj.id);
    if (projProducts.length > 0) {
      const projAvailable = projProducts.filter(p => p.status === 'available').length;
      const ratio = projAvailable / projProducts.length;
      if (ratio < 0.15 && projAvailable > 0) {
        anomalies.push({
          type: "low_inventory_alert",
          project_name: proj.name,
          available_count: projAvailable,
          ratio: Math.round(ratio * 100),
          message: `Dự án "${proj.name}" chỉ còn lại ${projAvailable} sản phẩm trống (${Math.round(ratio * 100)}% bảng hàng), sắp hết hàng.`
        });
        draftProposals.push({
          type: "real_estate_release_next_block",
          recipient: "Ban Giám Đốc Kinh Doanh BĐS",
          reason: `Dự án ${proj.name} có tỷ lệ sản phẩm trống chạm ngưỡng cảnh báo ${Math.round(ratio * 100)}%.`,
          draftMessage: `[Đề xuất mở bán phân khu/block mới] Kính gửi Ban Giám đốc, dự án "${proj.name}" hiện đã bán/giữ chỗ ${projProducts.length - projAvailable}/${projProducts.length} căn hộ. Tỷ lệ trống còn lại chỉ ${Math.round(ratio * 100)}% (${projAvailable} căn). Đề xuất thẩm định pháp lý và chuẩn bị mở bán Block tiếp theo để duy trì nhịp độ giao dịch.`
        });
      }
    }
  });

  const summaryText = `Đã hoàn tất phân tích bảng hàng Bất động sản. Ghi nhận ${projList.length} dự án đang quản lý. Tổng số sản phẩm trên bảng hàng: ${items.length} căn hộ/đất nền. Trạng thái: ${availableCount} trống, ${bookedCount} giữ chỗ, ${depositedCount} đặt cọc, ${signedCount} ký HĐMB. Tổng giá trị bảng hàng: ${(totalValue / 1e9).toFixed(2)} tỷ VNĐ. Đã giao dịch: ${(soldValue / 1e9).toFixed(2)} tỷ VNĐ. Ghi nhận ${anomalies.length} cảnh báo vận hành.`;

  const portfolioData = {
    projects_count: projList.length,
    projects: projList.map(p => ({ id: p.id, name: p.name, status: p.status })),
    total_products: items.length,
    available_count: availableCount,
    booked_count: bookedCount,
    deposited_count: depositedCount,
    signed_count: signedCount,
    handover_count: handoverCount,
    total_portfolio_value_billions: (totalValue / 1e9).toFixed(2),
    sold_portfolio_value_billions: (soldValue / 1e9).toFixed(2),
  };

  // Run RealEstateExecutiveSkill for strategic AI recommendations
  const skillOutput = await RealEstateExecutiveSkill.run(
    { tenantId, userId: 'system', locale: 'vi' },
    { intent: 'tổng quan bất động sản', data: portfolioData }
  );

  return {
    agent: "Real Estate Executive AI Specialist",
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: skillOutput.summary || summaryText,
    data: portfolioData,
    anomalies,
    draftProposals,
    // Expose skill recommendations for Gemini to incorporate
    aiSummaryData: {
      ...portfolioData,
      ai_skill_recommendations: skillOutput.recommendations ?? [],
      ai_skill_summary: skillOutput.summary,
    },
  };
}

