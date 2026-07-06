import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { SubAgentResponse } from '../types';
import { AI_THRESHOLDS } from '@/config/ai-constants';
import { calculateKtvSalarySheet } from '@/modules/hr-salary/actions/base-salary-actions';

interface AttendanceKpiItem {
  ktv_id: string;
  ktv_name: string;
  total_shifts: number | null;
  late_count: number | null;
  present_count: number | null;
  absent_count: number | null;
  gps_anomaly_count: number | null;
}

interface SalarySheetItem {
  ktv_id: string;
  base_salary: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  kpi_bonus: number | null;
  deductions: number | null;
  advances: number | null;
  total_salary: number | null;
}

export async function runCHROAgent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  activeDate: Date,
  formattedDate: string
): Promise<SubAgentResponse> {
  console.log("[AI COO Service] Định tuyến tới: CHRO Agent");

  const { data: attendanceKpis, error: rpcError } = await supabase.rpc("get_ai_attendance_kpis", {
    p_month_year: formattedDate
  });

  if (rpcError) {
    console.error("[CHRO Agent] Lỗi khi gọi RPC get_ai_attendance_kpis:", rpcError);
    throw rpcError;
  }

  let salarySheet;
  try {
    salarySheet = await calculateKtvSalarySheet(tenantId, formattedDate);
  } catch (salaryError) {
    console.error("[CHRO Agent] Lỗi khi gọi calculateKtvSalarySheet:", salaryError);
    throw salaryError;
  }

  const kpiItems = (attendanceKpis || []) as unknown as AttendanceKpiItem[];
  const salaryItems = (salarySheet || []) as unknown as SalarySheetItem[];

  const kpiSummary = kpiItems.map((item) => {
    const total = Number(item.total_shifts || 0);
    const late = Number(item.late_count || 0);
    const present = Number(item.present_count || 0);
    const gpsAnomaly = Number(item.gps_anomaly_count || 0);

    const totalAttended = present + late;
    const totalShifts = total > 0 ? total : (totalAttended + Number(item.absent_count || 0));

    let onTimeRateVal = 100;
    if (totalShifts > 0) {
      onTimeRateVal = (present / totalShifts) * 100;
    }
    const sInfo = salaryItems.find((s) => s.ktv_id === item.ktv_id);

    return {
      name: item.ktv_name,
      shifts: total,
      present,
      late,
      absent: item.absent_count,
      gpsAnomaly,
      onTimeRate: `${onTimeRateVal.toFixed(1)}%`,
      baseSalary: sInfo ? Number(sInfo.base_salary) : 0,
      sessionBonus: sInfo ? Number(sInfo.session_bonus) : 0,
      ratingBonus: sInfo ? Number(sInfo.rating_bonus) : 0,
      kpiBonus: sInfo ? Number(sInfo.kpi_bonus) : 0,
      deductions: sInfo ? Number(sInfo.deductions) : 0,
      advances: sInfo ? Number(sInfo.advances) : 0,
      totalSalary: sInfo ? Number(sInfo.total_salary) : 0,
      status: gpsAnomaly > AI_THRESHOLDS.GPS_ANOMALY_HIGH
        ? "🔴 Bất thường GPS cao"
        : late > AI_THRESHOLDS.LATE_SHIFTS_WARNING
          ? "🟡 Trễ ca nhiều"
          : "🟢 Tốt"
    };
  });

  const anomalies = kpiSummary.filter((k) =>
    k.gpsAnomaly > 0 ||
    k.late > AI_THRESHOLDS.LATE_SHIFTS_ANOMALY ||
    k.deductions > AI_THRESHOLDS.DEDUCTIONS_MIN_ALERT
  );

  return {
    agent: "CHRO (Trưởng phòng Nhân sự - Tiền lương)",
    period: `Tháng ${activeDate.getMonth() + 1}/${activeDate.getFullYear()}`,
    summary: `Đã hoàn tất phân tích ${kpiSummary.length} hồ sơ KTV của chi nhánh. Phát hiện ${anomalies.length} trường hợp cần lưu ý kỷ luật lao động hoặc có khấu trừ vi phạm lớn.`,
    data: kpiSummary,
    anomalies,
    draftProposals: anomalies.map((a) => ({
      type: "attendance_warning",
      recipient: a.name,
      reason: `${a.late > 0 ? `Đi muộn ${a.late} ca. ` : ''}${a.gpsAnomaly > 0 ? `Lệch định vị GPS ${a.gpsAnomaly} ca dịch vụ. ` : ''}${a.deductions > 0 ? `Bị phạt vi phạm ${a.deductions.toLocaleString('vi-VN')}đ.` : ''}`,
      draftMessage: `[Thông báo hệ thống] Kính gửi KTV ${a.name}, bộ phận nhân sự Bella Spa phát hiện bạn có ${a.late > 0 ? `${a.late} ca đi muộn` : ''}${a.gpsAnomaly > 0 ? ` và ${a.gpsAnomaly} ca lệch định vị GPS` : ''} trong kỳ tính công này. Số tiền phạt vi phạm dự kiến là ${a.deductions.toLocaleString('vi-VN')}đ. Vui lòng gửi giải trình phản hồi trong vòng 24h.`
    }))
  };
}
