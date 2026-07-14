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

interface SessionLogWithJoins {
  id: string;
  booking_id: string | null;
  session_number: number | null;
  assigned_date: string | null;
  assigned_time: string | null;
  completed_date: string | null;
  status: string | null;
  notes: string | null;
  completed_by_ktv: { full_name: string | null } | { full_name: string | null }[] | null;
  booking: {
    package_name: string | null;
    total_sessions: number | null;
    completed_sessions: number | null;
    customer: { name_mother: string | null } | { name_mother: string | null }[] | null;
  } | { package_name: string | null; total_sessions: number | null; completed_sessions: number | null; customer: { name_mother: string | null } | { name_mother: string | null }[] | null; }[] | null;
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

function pickKtvFromSession(x: SessionLogWithJoins['completed_by_ktv']): string | null {
  if (!x) return null;
  if (Array.isArray(x)) return x[0]?.full_name ?? null;
  return x.full_name ?? null;
}

function pickBooking(x: SessionLogWithJoins['booking']): {
  package_name: string | null;
  total_sessions: number | null;
  completed_sessions: number | null;
  customer_name: string | null;
} {
  const b = Array.isArray(x) ? x[0] : x;
  if (!b) return { package_name: null, total_sessions: null, completed_sessions: null, customer_name: null };
  const c = b.customer;
  const customer_name = Array.isArray(c) ? (c[0]?.name_mother ?? null) : (c?.name_mother ?? null);
  return {
    package_name: b.package_name,
    total_sessions: b.total_sessions,
    completed_sessions: b.completed_sessions,
    customer_name
  };
}

export async function runCMOAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date,
  firstDayOfMonth: string
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Định tuyến tới: CMO Agent");

  // Mở rộng lên 180 ngày (6 tháng) vì khách hàng spa thường dùng liệu trình kéo dài nhiều tháng
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Ngày hôm nay (giờ Việt Nam UTC+7)
  const todayUTC7 = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const todayStr = todayUTC7.toISOString().split('T')[0]; // YYYY-MM-DD

  // ── 1. Bookings ──────────────────────────────────────────────────────────────
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, status, created_at, total_sessions, completed_sessions, package_name, customer_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", sixMonthsAgo.toISOString());

  if (bookingsError) {
    console.error("[CMO Agent] Lỗi khi truy vấn bookings:", bookingsError);
    throw bookingsError;
  }

  // ── 2. Session logs hôm nay ───────────────────────────────────────────────
  const { data: todaySessions, error: todaySessionsError } = await supabase
    .from("session_logs")
    .select(`
      id,
      booking_id,
      session_number,
      assigned_date,
      assigned_time,
      completed_date,
      status,
      notes,
      completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey(full_name),
      booking:bookings!session_logs_booking_id_fkey(
        package_name,
        total_sessions,
        completed_sessions,
        customer:customers!bookings_customer_id_fkey(name_mother)
      )
    `)
    .eq("tenant_id", tenantId)
    .eq("assigned_date", todayStr);

  if (todaySessionsError) {
    console.error("[CMO Agent] Lỗi khi truy vấn session_logs hôm nay:", todaySessionsError);
    throw todaySessionsError;
  }

  // ── 3. Session logs gần đây (7 ngày) để xem tiến độ liệu trình ──────────
  const sevenDaysAgo = new Date(todayUTC7);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const { data: recentSessions, error: recentSessionsError } = await supabase
    .from("session_logs")
    .select(`
      id,
      booking_id,
      session_number,
      assigned_date,
      assigned_time,
      completed_date,
      status,
      notes,
      completed_by_ktv:users!session_logs_completed_by_ktv_id_fkey(full_name),
      booking:bookings!session_logs_booking_id_fkey(
        package_name,
        total_sessions,
        completed_sessions,
        customer:customers!bookings_customer_id_fkey(name_mother)
      )
    `)
    .eq("tenant_id", tenantId)
    .gte("assigned_date", sevenDaysAgoStr)
    .order("assigned_date", { ascending: false })
    .limit(50);

  if (recentSessionsError) {
    console.error("[CMO Agent] Lỗi khi truy vấn recent session_logs:", recentSessionsError);
    throw recentSessionsError;
  }

  // ── 4. Khách hàng mới tháng này ───────────────────────────────────────────
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

  // ── 5. Tổng khách hàng ────────────────────────────────────────────────────
  const { count: totalCustomers, error: totalCustError } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (totalCustError) {
    console.error("[CMO Agent] Lỗi khi đếm tổng số customers:", totalCustError);
    throw totalCustError;
  }

  // ── 6. Top khách hàng thân thiết ─────────────────────────────────────────
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

  // ── 7. Đánh giá session (chỉ lấy approved) ────────────────────────────────
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
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (reviewsError) {
    console.error("[CMO Agent] Lỗi khi truy vấn session_reviews:", reviewsError);
    throw reviewsError;
  }

  // ── Tính toán tóm tắt ─────────────────────────────────────────────────────
  const bookingsSummary = {
    total: bookings?.length || 0,
    inquiry: bookings?.filter(b => b.status === "inquiry").length || 0,
    deposit_pending: bookings?.filter(b => b.status === "deposit_pending").length || 0,
    booked: bookings?.filter(b => b.status === "booked").length || 0,
    in_progress: bookings?.filter(b => b.status === "in_progress").length || 0,
    completed: bookings?.filter(b => b.status === "completed").length || 0,
    cancelled: bookings?.filter(b => b.status === "cancelled").length || 0,
  };

  const typedReviews = (reviews ?? []) as unknown as ReviewWithJoins[];
  const ratings = typedReviews.map(r => Number(r.rating || 0)).filter(r => r > 0);
  const avgRating = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 0;
  const badReviews = typedReviews.filter(r => Number(r.rating || 0) < 4);

  // Xử lý session hôm nay
  const typedTodaySessions = (todaySessions ?? []) as unknown as SessionLogWithJoins[];
  const todaySessionsSummary = typedTodaySessions.map(s => {
    const bk = pickBooking(s.booking);
    return {
      session_id: s.id,
      customer_name: bk.customer_name || "Khách hàng",
      package_name: bk.package_name || "Gói dịch vụ",
      session_number: s.session_number,
      total_sessions: bk.total_sessions,
      completed_sessions: bk.completed_sessions,
      progress: `Buổi ${s.session_number}/${bk.total_sessions || '?'} (Đã hoàn thành ${bk.completed_sessions || 0}/${bk.total_sessions || '?'} buổi)`,
      assigned_time: s.assigned_time,
      status: s.status,
      is_completed_today: s.status === "completed",
      completed_by_ktv: pickKtvFromSession(s.completed_by_ktv) || "Chưa phân công",
      notes: s.notes || null
    };
  });

  // Xử lý recent sessions
  const typedRecentSessions = (recentSessions ?? []) as unknown as SessionLogWithJoins[];
  const recentSessionsSummary = typedRecentSessions.map(s => {
    const bk = pickBooking(s.booking);
    return {
      session_id: s.id,
      customer_name: bk.customer_name || "Khách hàng",
      package_name: bk.package_name || "Gói dịch vụ",
      session_number: s.session_number,
      total_sessions: bk.total_sessions,
      completed_sessions: bk.completed_sessions,
      progress: `Buổi ${s.session_number}/${bk.total_sessions || '?'}`,
      assigned_date: s.assigned_date,
      assigned_time: s.assigned_time,
      status: s.status,
      completed_by_ktv: pickKtvFromSession(s.completed_by_ktv) || null,
    };
  });

  const todayCompletedCount = typedTodaySessions.filter(s => s.status === "completed").length;
  const todayScheduledCount = typedTodaySessions.filter(s => s.status === "scheduled" || s.status === "in_progress").length;

  const newCustCount = (newCustomersThisMonth || []).length;
  const summaryText = `Đã hoàn tất phân tích CSKH ngày ${todayStr}. ` +
    `Hôm nay có ${typedTodaySessions.length} ca được lên lịch: ${todayCompletedCount} ca đã hoàn thành, ${todayScheduledCount} ca đang chờ/đang thực hiện. ` +
    `Tổng số khách hàng: ${totalCustomers || 0} người, tháng này ghi nhận ${newCustCount} khách hàng mới. ` +
    `Điểm CSAT trung bình đạt ${avgRating}/5 sao dựa trên ${ratings.length} đánh giá đã duyệt. ` +
    `Ghi nhận ${badReviews.length} phản hồi tiêu cực (< 4 sao) cần xử lý. ` +
    `Phễu đặt lịch ghi nhận ${bookingsSummary.total} giao dịch trong 6 tháng gần nhất.`;

  return {
    agent: "CMO (Trưởng phòng Chăm sóc khách hàng & Marketing)",
    period: `Ngày ${todayStr} - Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: summaryText,
    data: {
      report_date: todayStr,
      customers_total: totalCustomers || 0,
      customers_new_this_month_count: newCustCount,
      customers_new_this_month: newCustomersThisMonth || [],
      top_loyal_customers: topLoyalCustomers || [],
      bookings_summary: bookingsSummary,
      bookings_detail: bookings?.map(b => ({
        id: b.id,
        status: b.status,
        package_name: b.package_name,
        completed_sessions: b.completed_sessions || 0,
        total_sessions: b.total_sessions || 0,
        progress: `${b.completed_sessions || 0}/${b.total_sessions || 0} buổi`,
        created_at: b.created_at
      })) || [],
      // Dữ liệu ca hôm nay (quan trọng nhất)
      today_sessions: {
        date: todayStr,
        total: typedTodaySessions.length,
        completed: todayCompletedCount,
        pending: todayScheduledCount,
        sessions: todaySessionsSummary
      },
      // Dữ liệu ca 7 ngày gần đây để theo dõi tiến độ liệu trình
      recent_sessions_7days: recentSessionsSummary,
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
