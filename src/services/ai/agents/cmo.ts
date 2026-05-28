import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';

interface ReviewWithJoins {
  id: string;
  rating: number | null;
  note: string | null;
  created_at: string | null;
  status: string | null;
  reviewer: { name_mother: string | null } | { name_mother: string | null }[] | null;
  ktv: { full_name: string | null } | { full_name: string | null }[] | null;
}

function pickName(x: ReviewWithJoins['reviewer']): string | null {
  if (!x) return null;
  if (Array.isArray(x)) return x[0]?.name_mother ?? null;
  return x.name_mother ?? null;
}

function pickKtv(x: ReviewWithJoins['ktv']): string | null {
  if (!x) return null;
  if (Array.isArray(x)) return x[0]?.full_name ?? null;
  return x.full_name ?? null;
}

export async function runCMOAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date,
  firstDayOfMonth: string
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Định tuyến tới: CMO Agent");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (bookingsError) {
    console.error("[CMO Agent] Lỗi khi truy vấn bookings:", bookingsError);
    throw bookingsError;
  }

  const { data: newCustomersThisMonth, error: newCustError } = await supabase
    .from("customers")
    .select("id, name_mother, phone, name_baby, loyalty_points, status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", firstDayOfMonth)
    .order("created_at", { ascending: false });

  if (newCustError) {
    console.error("[CMO Agent] Lỗi khi truy vấn customers (new this month):", newCustError);
    throw newCustError;
  }

  const { count: totalCustomers, error: totalCustError } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (totalCustError) {
    console.error("[CMO Agent] Lỗi khi đếm tổng số customers:", totalCustError);
    throw totalCustError;
  }

  const { data: topLoyalCustomers, error: loyalError } = await supabase
    .from("customers")
    .select("id, name_mother, phone, loyalty_points")
    .eq("tenant_id", tenantId)
    .order("loyalty_points", { ascending: false, nullsFirst: false })
    .limit(5);

  if (loyalError) {
    console.error("[CMO Agent] Lỗi khi truy vấn top loyal customers:", loyalError);
    throw loyalError;
  }

  const bookingsSummary = {
    total: bookings?.length || 0,
    inquiry: bookings?.filter(b => b.status === "inquiry").length || 0,
    deposit_pending: bookings?.filter(b => b.status === "deposit_pending").length || 0,
    booked: bookings?.filter(b => b.status === "booked").length || 0,
    in_progress: bookings?.filter(b => b.status === "in_progress").length || 0,
    completed: bookings?.filter(b => b.status === "completed").length || 0,
    cancelled: bookings?.filter(b => b.status === "cancelled").length || 0,
  };

  const { data: reviews, error: reviewsError } = await supabase
    .from("session_reviews")
    .select(`
      id,
      rating,
      note,
      created_at,
      status,
      reviewer:customers!session_reviews_reviewer_id_fkey(name_mother),
      ktv:users!session_reviews_ktv_id_fkey(full_name)
    `)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (reviewsError) {
    console.error("[CMO Agent] Lỗi khi truy vấn session_reviews:", reviewsError);
    throw reviewsError;
  }

  const typedReviews = (reviews ?? []) as unknown as ReviewWithJoins[];
  const ratings = typedReviews.map(r => Number(r.rating || 0)).filter(r => r > 0);
  const avgRating = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 5.0;
  const badReviews = typedReviews.filter(r => Number(r.rating || 0) < 4);

  const newCustCount = (newCustomersThisMonth || []).length;
  const summaryText = `Đã hoàn tất phân tích CSKH. Tổng số khách hàng hiện có của chi nhánh: ${totalCustomers || 0} người, trong đó tháng này ghi nhận ${newCustCount} khách hàng mới. Điểm CSAT trung bình đạt ${avgRating}/5 sao dựa trên ${ratings.length} đánh giá. Ghi nhận ${badReviews.length} phản hồi tiêu cực (< 4 sao) cần xử lý khẩn cấp. Phễu đặt lịch ghi nhận ${bookingsSummary.total} giao dịch mới trong 30 ngày.`;

  return {
    agent: "CMO (Trưởng phòng Chăm sóc khách hàng & Marketing)",
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: summaryText,
    data: {
      customers_total: totalCustomers || 0,
      customers_new_this_month_count: newCustCount,
      customers_new_this_month: newCustomersThisMonth || [],
      top_loyal_customers: topLoyalCustomers || [],
      bookings_summary: bookingsSummary,
      csat: avgRating,
      total_reviews: typedReviews.length,
      recent_reviews: typedReviews,
      bad_reviews: badReviews
    },
    anomalies: badReviews.map((r) => ({
      type: "negative_feedback",
      customer_name: pickName(r.reviewer) || "Khách hàng ẩn danh",
      ktv_name: pickKtv(r.ktv) || "Chưa phân công",
      rating: r.rating,
      note: r.note,
      message: `Khách hàng ${pickName(r.reviewer) || "ẩn danh"} đánh giá KTV ${pickKtv(r.ktv) || "ẩn danh"} mức ${r.rating} sao. Ý kiến: "${r.note || 'Không có bình luận'}"`
    })),
    draftProposals: badReviews.map((r) => ({
      type: "customer_apology",
      recipient: pickName(r.reviewer) || "Khách hàng",
      reason: `Phản hồi tiêu cực ${r.rating} sao về ca trị liệu thực hiện bởi KTV ${pickKtv(r.ktv) || "ẩn danh"}.`,
      draftMessage: `[Chăm sóc khách hàng Bella Spa] Kính gửi chị ${pickName(r.reviewer) || "Khách hàng"}, bộ phận CSKH Bella Spa vô cùng xin lỗi vì trải nghiệm chưa trọn vẹn của chị trong buổi chăm sóc vừa qua (đánh giá ${r.rating} sao). Chúng em đã ghi nhận phản hồi của chị về KTV ${pickKtv(r.ktv) || "ẩn danh"} và cam kết chấn chỉnh dịch vụ. Bella Spa xin phép gửi tặng chị voucher giảm giá 15% cho buổi trị liệu tiếp theo và rất mong nhận được sự thông cảm từ chị.`
    }))
  };
}
