/**
 * AI COO Service — centralised thresholds & magic numbers.
 * Thay đổi ngưỡng phát hiện tại đây, toàn bộ service & autopilot cron cập nhật theo.
 */

export const AI_THRESHOLDS = {
  /** Số ca lệch GPS tối thiểu để đánh dấu KTV "bất thường GPS cao" */
  GPS_ANOMALY_HIGH: 2,

  /** Số ca đi trễ tối thiểu để đánh dấu KTV vào danh sách bất thường */
  LATE_SHIFTS_ANOMALY: 2,

  /** Số ca đi trễ để hiện cảnh báo "Trễ ca nhiều" trên badge status */
  LATE_SHIFTS_WARNING: 3,

  /** Mức khấu trừ vi phạm (VND) tối thiểu để đưa KTV vào danh sách cần chú ý */
  DEDUCTIONS_MIN_ALERT: 200_000,

  /** Ngưỡng chênh lệch sổ quỹ (%) để coi là MAJOR_DIFF — đồng bộ với get_reconciliation_report */
  RECON_MAJOR_DIFF_PERCENT: 1,
} as const;

export const AI_SALARY_RECON_THRESHOLDS = {
  /** Chênh lệch tuyệt đối (VND) dưới mức này → MATCH (bỏ qua lỗi làm tròn) */
  MATCH_ABS_VND: 5_000,

  /** Chênh lệch % dưới mức này → MATCH */
  MATCH_PERCENT: 1,

  /** Chênh lệch % từ đây trở lên → MAJOR_DIFF */
  MAJOR_DIFF_PERCENT: 5,
} as const;
