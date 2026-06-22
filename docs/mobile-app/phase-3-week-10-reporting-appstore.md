# Bella ERP Mobile App — Phase 3 Tuần 10: Reporting, PDF Export & App Store Preparation
## Phiên bản v1.0

**Ngày tạo:** 2026-06-22
**Phase:** 3 — Production Readiness
**Tiền điều kiện:** Phase 3 (Tuần 9) DoD hoàn thành — Customer profile, care notes, session media upload.

---

## Tổng Quan & Mục Tiêu

Tuần 10 là tuần **Production Readiness** — đưa ứng dụng từ feature-complete sang deploy-ready:

```
Tất cả features (Tuần 1-9) hoàn thành
  ↓
Báo cáo PDF: KTV monthly report + Admin analytics
  ↓
EAS Build: production bundle iOS & Android
  ↓
App Store submission: TestFlight (iOS) + Play Store (Android)
  ↓
Production monitoring: Sentry + health check
```

**3 mảng chính:**

1. **KTV Monthly Report & PDF Export:**
   - KTV tự xem báo cáo tháng: buổi hoàn thành, hoa hồng, rating, badge đạt được
   - Admin xem báo cáo tổng hợp toàn bộ KTV trong tenant
   - Export PDF từ trong app (React Native PDF hoặc share HTML → Print)
   - Offline: cached báo cáo tháng trước (không cần net để xem lại)

2. **App Store Preparation:**
   - EAS Build configuration: iOS + Android production
   - Privacy manifest (iOS 17+)
   - App icon, splash screen finalization
   - Store listings: screenshots, description, metadata
   - Over-the-air (OTA) update via EAS Update

3. **Production Monitoring & Health:**
   - Sentry error tracking integration
   - Performance monitoring: slow RPC detection
   - Crash reporting dashboard
   - CI/CD pipeline: auto-build on main merge

---

## 1. Supabase Backend — Reporting RPCs

### [NEW] `20260816000000_mobile_reporting_rpcs.sql`

```sql
-- supabase/migrations/20260816000000_mobile_reporting_rpcs.sql

-- ============================================================
-- RPC 1: KTV Monthly Report (tự xem báo cáo tháng của mình)
-- Dữ liệu đầy đủ để render PDF/report trên mobile
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_my_monthly_report(
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_from_date DATE;
    v_to_date DATE;
    v_result JSONB;
    -- Bayesian constants (nhất quán với leaderboard)
    c_prior CONSTANT NUMERIC := 4.5;
    c_min_reviews CONSTANT INTEGER := 10;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_ktv_id;

    v_from_date := make_date(p_year, p_month, 1);
    v_to_date   := (v_from_date + INTERVAL '1 month - 1 day')::DATE;

    SELECT jsonb_build_object(

        'period', jsonb_build_object(
            'year', p_year,
            'month', p_month,
            'from_date', v_from_date,
            'to_date', v_to_date,
            'label', TO_CHAR(v_from_date, 'Month YYYY')
        ),

        'ktv', (
            SELECT jsonb_build_object(
                'id', u.id,
                'full_name', u.full_name,
                'role', u.role,
                'tenant_name', t.name
            )
            FROM public.users u
            LEFT JOIN public.tenants t ON t.id = u.tenant_id
            WHERE u.id = v_ktv_id
        ),

        -- ── Sessions ──
        'sessions', jsonb_build_object(
            'total_completed', (
                SELECT COUNT(*) FROM public.session_logs
                WHERE completed_by_ktv_id = v_ktv_id
                  AND tenant_id = v_tenant_id
                  AND status = 'completed'
                  AND completed_date BETWEEN v_from_date AND v_to_date
            ),
            'checkins_on_time', (
                -- Checkin trong vòng 15 phút so với scheduled_time
                SELECT COUNT(*) FROM public.session_logs
                WHERE completed_by_ktv_id = v_ktv_id
                  AND tenant_id = v_tenant_id
                  AND status = 'completed'
                  AND completed_date BETWEEN v_from_date AND v_to_date
                  AND (checked_in_at - scheduled_at) <= INTERVAL '15 minutes'
            ),
            'by_day', (
                -- Breakdown theo ngày trong tháng
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object('date', completed_date, 'count', cnt)
                    ORDER BY completed_date
                ), '[]'::jsonb)
                FROM (
                    SELECT completed_date, COUNT(*) AS cnt
                    FROM public.session_logs
                    WHERE completed_by_ktv_id = v_ktv_id
                      AND tenant_id = v_tenant_id
                      AND status = 'completed'
                      AND completed_date BETWEEN v_from_date AND v_to_date
                    GROUP BY completed_date
                ) daily
            )
        ),

        -- ── Hoa hồng ──
        'commission', jsonb_build_object(
            'total_earned', (
                SELECT ROUND(COALESCE(SUM(
                    (b.full_price * (1 - b.discount_percent / 100.0) / GREATEST(b.total_sessions, 1))
                    * (b.ktv_commission / 100.0)
                ), 0)::NUMERIC, 0)
                FROM public.session_logs sl
                JOIN public.bookings b ON sl.booking_id = b.id AND b.tenant_id = v_tenant_id
                WHERE sl.completed_by_ktv_id = v_ktv_id
                  AND sl.tenant_id = v_tenant_id
                  AND sl.status = 'completed'
                  AND sl.completed_date BETWEEN v_from_date AND v_to_date
            ),
            'definition', 'Hoa hồng = Giá gói × (1 - Chiết khấu) ÷ Tổng buổi × % Hoa hồng KTV'
        ),

        -- ── Reviews ──
        'reviews', (
            SELECT jsonb_build_object(
                'total_received', COUNT(sr.id),
                'average_raw', ROUND(AVG(sr.rating)::NUMERIC, 2),
                'bayesian_score', CASE WHEN COUNT(sr.id) >= c_min_reviews THEN
                    ROUND(
                        ((c_prior * c_min_reviews) + SUM(sr.rating))
                        / (c_min_reviews + COUNT(sr.id))::NUMERIC, 3
                    )
                ELSE NULL END,
                'distribution', jsonb_build_object(
                    '5_star', COUNT(*) FILTER (WHERE sr.rating = 5),
                    '4_star', COUNT(*) FILTER (WHERE sr.rating = 4),
                    '3_star', COUNT(*) FILTER (WHERE sr.rating = 3),
                    '2_star', COUNT(*) FILTER (WHERE sr.rating = 2),
                    '1_star', COUNT(*) FILTER (WHERE sr.rating = 1)
                ),
                'comments', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'rating', sr2.rating,
                            'comment', sr2.customer_comment,
                            'date', sr2.created_at::DATE
                        ) ORDER BY sr2.created_at DESC
                    ), '[]'::jsonb)
                    FROM public.session_reviews sr2
                    JOIN public.session_logs sl2 ON sr2.session_log_id = sl2.id
                    WHERE sr2.ktv_id = v_ktv_id
                      AND sr2.tenant_id = v_tenant_id
                      AND sr2.status = 'approved'
                      AND sl2.completed_date BETWEEN v_from_date AND v_to_date
                      AND sr2.customer_comment IS NOT NULL
                    LIMIT 5
                )
            )
            FROM public.session_reviews sr
            JOIN public.session_logs sl ON sr.session_log_id = sl.id
            WHERE sr.ktv_id = v_ktv_id
              AND sr.tenant_id = v_tenant_id
              AND sr.status = 'approved'
              AND sl.completed_date BETWEEN v_from_date AND v_to_date
        ),

        -- ── Achievements trong tháng ──
        'achievements_earned', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'badge_type', a.badge_type,
                    'badge_label', a.badge_label,
                    'badge_icon', a.badge_icon,
                    'awarded_at', a.awarded_at
                ) ORDER BY a.awarded_at DESC
            ), '[]'::jsonb)
            FROM public.ktv_achievements a
            WHERE a.ktv_id = v_ktv_id
              AND a.tenant_id = v_tenant_id
              AND (
                  (a.badge_scope = 'lifetime' AND a.awarded_at::DATE BETWEEN v_from_date AND v_to_date)
                  OR (a.badge_scope = 'period' AND a.reference_period = TO_CHAR(v_from_date, 'YYYY-MM'))
              )
        ),

        -- ── Renewal requests trong tháng ──
        'renewals', jsonb_build_object(
            'submitted', (
                SELECT COUNT(*) FROM public.package_renewal_requests
                WHERE requested_by_ktv_id = v_ktv_id
                  AND tenant_id = v_tenant_id
                  AND created_at::DATE BETWEEN v_from_date AND v_to_date
            ),
            'approved', (
                SELECT COUNT(*) FROM public.package_renewal_requests
                WHERE requested_by_ktv_id = v_ktv_id
                  AND tenant_id = v_tenant_id
                  AND status = 'approved'
                  AND updated_at::DATE BETWEEN v_from_date AND v_to_date
            )
        )

    ) INTO v_result;

    RETURN COALESCE(v_result, jsonb_build_object('error', 'UNKNOWN'));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_my_monthly_report(INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- RPC 2: Admin — Tổng hợp báo cáo toàn bộ KTV trong tháng
-- Chỉ admin/hr được gọi
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_get_tenant_monthly_report(
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    p_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_caller_role TEXT;
    v_from_date DATE;
    v_to_date DATE;
    v_result JSONB;
BEGIN
    SELECT tenant_id, role INTO v_tenant_id, v_caller_role
    FROM public.users WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('admin', 'super_admin', 'hr') THEN
        RETURN jsonb_build_object('error', 'UNAUTHORIZED');
    END IF;

    v_from_date := make_date(p_year, p_month, 1);
    v_to_date   := (v_from_date + INTERVAL '1 month - 1 day')::DATE;

    SELECT jsonb_build_object(
        'period', jsonb_build_object('year', p_year, 'month', p_month,
            'label', TO_CHAR(v_from_date, 'Month YYYY')),

        'summary', jsonb_build_object(
            'total_sessions', (
                SELECT COUNT(*) FROM public.session_logs
                WHERE tenant_id = v_tenant_id AND status = 'completed'
                  AND completed_date BETWEEN v_from_date AND v_to_date
            ),
            'total_commission_paid', (
                SELECT ROUND(COALESCE(SUM(
                    (b.full_price * (1 - b.discount_percent/100.0) / GREATEST(b.total_sessions,1))
                    * (b.ktv_commission/100.0)
                ), 0)::NUMERIC, 0)
                FROM public.session_logs sl
                JOIN public.bookings b ON sl.booking_id = b.id AND b.tenant_id = v_tenant_id
                WHERE sl.tenant_id = v_tenant_id AND sl.status = 'completed'
                  AND sl.completed_date BETWEEN v_from_date AND v_to_date
            ),
            'active_ktv_count', (
                SELECT COUNT(DISTINCT completed_by_ktv_id) FROM public.session_logs
                WHERE tenant_id = v_tenant_id AND status = 'completed'
                  AND completed_date BETWEEN v_from_date AND v_to_date
            ),
            'tenant_avg_rating', (
                SELECT ROUND(AVG(sr.rating)::NUMERIC, 2)
                FROM public.session_reviews sr
                JOIN public.session_logs sl ON sr.session_log_id = sl.id
                WHERE sl.tenant_id = v_tenant_id
                  AND sl.completed_date BETWEEN v_from_date AND v_to_date
                  AND sr.status = 'approved'
            )
        ),

        'ktv_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'ktv_id', u.id,
                    'ktv_name', u.full_name,
                    'sessions', COUNT(sl.id),
                    'commission', ROUND(COALESCE(SUM(
                        (b.full_price * (1 - b.discount_percent/100.0) / GREATEST(b.total_sessions,1))
                        * (b.ktv_commission/100.0)
                    ), 0)::NUMERIC, 0),
                    'avg_rating', ROUND(AVG(sr.rating)::NUMERIC, 2),
                    'review_count', COUNT(sr.id)
                ) ORDER BY COUNT(sl.id) DESC
            ), '[]'::jsonb)
            FROM public.users u
            LEFT JOIN public.session_logs sl
                ON sl.completed_by_ktv_id = u.id
               AND sl.tenant_id = v_tenant_id
               AND sl.status = 'completed'
               AND sl.completed_date BETWEEN v_from_date AND v_to_date
            LEFT JOIN public.bookings b ON sl.booking_id = b.id AND b.tenant_id = v_tenant_id
            LEFT JOIN public.session_reviews sr
                ON sr.ktv_id = u.id
               AND sr.status = 'approved'
               AND sr.tenant_id = v_tenant_id
               AND EXISTS (
                   SELECT 1 FROM public.session_logs sl2
                   WHERE sl2.id = sr.session_log_id
                     AND sl2.completed_date BETWEEN v_from_date AND v_to_date
               )
            WHERE u.tenant_id = v_tenant_id AND u.role = 'ktv'
            GROUP BY u.id, u.full_name
        )

    ) INTO v_result;

    RETURN COALESCE(v_result, jsonb_build_object('error', 'UNKNOWN'));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_admin_get_tenant_monthly_report(INTEGER, INTEGER) TO authenticated;
```

---

## 2. Mobile App — Report Service & PDF Generation

### [NEW] `apps/mobile/src/services/reporting/monthlyReport.ts`

```typescript
// apps/mobile/src/services/reporting/monthlyReport.ts
import { getMobileSupabase } from '../../lib/supabase';
import { LocalCacheService } from '../../lib/localCache';

export interface MonthlyReport {
  period: { year: number; month: number; from_date: string; to_date: string; label: string };
  ktv: { id: string; full_name: string; tenant_name: string };
  sessions: {
    total_completed: number;
    checkins_on_time: number;
    by_day: { date: string; count: number }[];
  };
  commission: { total_earned: number; definition: string };
  reviews: {
    total_received: number;
    average_raw: number | null;
    bayesian_score: number | null;
    distribution: Record<string, number>;
    comments: { rating: number; comment: string; date: string }[];
  };
  achievements_earned: { badge_type: string; badge_label: string; badge_icon: string; awarded_at: string }[];
  renewals: { submitted: number; approved: number };
}

// TTL: báo cáo tháng hiện tại = 30 phút (thay đổi theo session)
// Báo cáo tháng trước = 24 giờ (không thay đổi nữa)
const TTL_CURRENT_MONTH = 30 * 60 * 1000;
const TTL_PAST_MONTH = 24 * 60 * 60 * 1000;

function isCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month;
}

const reportCacheKey = (year: number, month: number) =>
  `monthly_report_${year}_${String(month).padStart(2, '0')}`;

export async function fetchMyMonthlyReport(
  year: number,
  month: number,
  options: { forceRefresh?: boolean } = {}
): Promise<MonthlyReport | { error: string }> {
  const key = reportCacheKey(year, month);
  const ttl = isCurrentMonth(year, month) ? TTL_CURRENT_MONTH : TTL_PAST_MONTH;

  if (!options.forceRefresh) {
    const cached = await LocalCacheService.get<MonthlyReport>(key);
    if (cached) return cached;
  }

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_my_monthly_report', {
    p_year: year,
    p_month: month,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(key, data, ttl);
  return data as MonthlyReport;
}

/** Tạo HTML string từ report data để share/print (thay thế PDF library) */
export function generateReportHTML(report: MonthlyReport): string {
  const { period, ktv, sessions, commission, reviews, achievements_earned, renewals } = report;

  const starBars = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.distribution[`${star}_star`] ?? 0;
    const pct = reviews.total_received > 0
      ? Math.round((count / reviews.total_received) * 100) : 0;
    return `<tr>
      <td style="width:40px;text-align:right;padding-right:8px;">${'⭐'.repeat(star)}</td>
      <td style="width:120px;">
        <div style="background:#E5E7EB;height:8px;border-radius:4px;overflow:hidden;">
          <div style="width:${pct}%;background:#10B981;height:100%;"></div>
        </div>
      </td>
      <td style="padding-left:8px;font-size:12px;color:#6B7280;">${count} (${pct}%)</td>
    </tr>`;
  }).join('');

  const badgeHtml = achievements_earned.map(a =>
    `<span style="display:inline-block;background:#FEF3C7;border:1px solid #FDE68A;
     border-radius:20px;padding:4px 12px;margin:4px;font-size:13px;">
     ${a.badge_icon} ${a.badge_label}</span>`
  ).join('');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; color: #111827; background: #F9FAFB; }
    .header { background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 4px 0 0; opacity: 0.85; font-size: 14px; }
    .card { background: white; border-radius: 10px; padding: 16px; margin-bottom: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .card h2 { font-size: 15px; color: #374151; margin: 0 0 12px; }
    .stat-row { display: flex; gap: 12px; }
    .stat { flex: 1; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 800; color: #6366F1; }
    .stat-label { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
    .commission-value { font-size: 32px; font-weight: 900; color: #10B981; }
    table { width: 100%; border-collapse: collapse; }
    .comment { background: #F9FAFB; border-left: 3px solid #6366F1; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 6px 6px 0; font-size: 13px; color: #4B5563; }
    .footer { text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Báo Cáo Tháng ${period.month}/${period.year}</h1>
    <p>${ktv.full_name} · ${ktv.tenant_name}</p>
    <p style="font-size:12px;opacity:0.7;">${period.from_date} → ${period.to_date}</p>
  </div>

  <div class="card">
    <h2>📅 Buổi Dịch Vụ</h2>
    <div class="stat-row">
      <div class="stat">
        <div class="stat-value">${sessions.total_completed}</div>
        <div class="stat-label">Buổi hoàn thành</div>
      </div>
      <div class="stat">
        <div class="stat-value">${sessions.checkins_on_time}</div>
        <div class="stat-label">Check-in đúng giờ</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>💰 Hoa Hồng</h2>
    <div class="commission-value">${commission.total_earned.toLocaleString('vi-VN')} đ</div>
    <p style="font-size:11px;color:#9CA3AF;margin-top:8px;">${commission.definition}</p>
  </div>

  <div class="card">
    <h2>⭐ Đánh Giá (${reviews.total_received} reviews)</h2>
    <div class="stat-row" style="margin-bottom:12px;">
      <div class="stat">
        <div class="stat-value">${reviews.average_raw?.toFixed(1) ?? '—'}</div>
        <div class="stat-label">Rating trung bình</div>
      </div>
      <div class="stat">
        <div class="stat-value">${reviews.bayesian_score?.toFixed(2) ?? '—'}</div>
        <div class="stat-label">Bayesian score</div>
      </div>
    </div>
    <table>${starBars}</table>
    ${reviews.comments.length > 0 ? '<h3 style="font-size:13px;color:#374151;margin:12px 0 8px;">Nhận xét từ khách:</h3>' : ''}
    ${reviews.comments.map(c =>
      `<div class="comment">
        <strong>${'⭐'.repeat(c.rating)}</strong> — ${c.comment}
        <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">${c.date}</div>
      </div>`
    ).join('')}
  </div>

  ${achievements_earned.length > 0 ? `
  <div class="card">
    <h2>🏆 Thành Tích Đạt Được</h2>
    ${badgeHtml}
  </div>` : ''}

  <div class="card">
    <h2>🔄 Gia Hạn Gói</h2>
    <div class="stat-row">
      <div class="stat">
        <div class="stat-value">${renewals.submitted}</div>
        <div class="stat-label">Đề xuất gia hạn</div>
      </div>
      <div class="stat">
        <div class="stat-value" style="color:#10B981;">${renewals.approved}</div>
        <div class="stat-label">Được duyệt</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Bella ERP · Báo cáo tự động · ${new Date().toLocaleDateString('vi-VN')}
  </div>
</body>
</html>`;
}
```

---

## 3. Mobile App — Report Screen

### [NEW] `apps/mobile/src/app/(app)/report.tsx`

```typescript
// apps/mobile/src/app/(app)/report.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, StyleSheet, Share, ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchMyMonthlyReport, generateReportHTML } from '../../services/reporting/monthlyReport';
import type { MonthlyReport } from '../../services/reporting/monthlyReport';

export default function ReportScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'pdf_preview'>('cards');

  const loadReport = useCallback(async (forceRefresh = false) => {
    setError(null);
    const res = await fetchMyMonthlyReport(year, month, { forceRefresh });
    if ('error' in res) setError(res.error);
    else setReport(res);
  }, [year, month]);

  useEffect(() => {
    setLoading(true);
    loadReport().finally(() => setLoading(false));
  }, [loadReport]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReport(true);
    setRefreshing(false);
  }, [loadReport]);

  const handleShare = useCallback(async () => {
    if (!report) return;
    const html = generateReportHTML(report);
    await Share.share({
      title: `Báo cáo ${report.period.label} — ${report.ktv.full_name}`,
      message: html,
    });
  }, [report]);

  // Navigate month
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const monthName = new Date(year, month - 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthName}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* View mode toggle */}
      {report && (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'cards' && styles.toggleBtnActive]}
            onPress={() => setViewMode('cards')}
          >
            <Text style={[styles.toggleBtnText, viewMode === 'cards' && styles.toggleBtnTextActive]}>
              📋 Dạng thẻ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'pdf_preview' && styles.toggleBtnActive]}
            onPress={() => setViewMode('pdf_preview')}
          >
            <Text style={[styles.toggleBtnText, viewMode === 'pdf_preview' && styles.toggleBtnTextActive]}>
              📄 Xem PDF
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>⬆ Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366F1" />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Card view */}
      {!loading && report && viewMode === 'cards' && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16 }}
        >
          {/* Sessions Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Buổi Dịch Vụ</Text>
            <View style={styles.statRow}>
              <StatBox value={report.sessions.total_completed} label="Hoàn thành" color="#6366F1" />
              <StatBox value={report.sessions.checkins_on_time} label="Đúng giờ" color="#10B981" />
            </View>
          </View>

          {/* Commission Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💰 Hoa Hồng</Text>
            <Text style={styles.commissionValue}>
              {report.commission.total_earned.toLocaleString('vi-VN')} đ
            </Text>
          </View>

          {/* Reviews Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⭐ Đánh Giá ({report.reviews.total_received})</Text>
            <View style={styles.statRow}>
              <StatBox
                value={report.reviews.average_raw?.toFixed(1) ?? '—'}
                label="Rating TB"
                color="#F59E0B"
              />
              <StatBox
                value={report.reviews.bayesian_score?.toFixed(2) ?? '—'}
                label="Bayesian"
                color="#6366F1"
              />
            </View>
            {/* Distribution bars */}
            {[5, 4, 3, 2, 1].map(star => {
              const count = report.reviews.distribution[`${star}_star`] ?? 0;
              const pct = report.reviews.total_received > 0
                ? (count / report.reviews.total_received) * 100 : 0;
              return (
                <View key={star} style={styles.starRow}>
                  <Text style={styles.starLabel}>{'⭐'.repeat(star)}</Text>
                  <View style={styles.starBar}>
                    <View style={[styles.starBarFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.starCount}>{count}</Text>
                </View>
              );
            })}
          </View>

          {/* Achievements Card */}
          {report.achievements_earned.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 Thành Tích Tháng Này</Text>
              <View style={styles.badgeRow}>
                {report.achievements_earned.map(a => (
                  <View key={a.badge_type} style={styles.badgeItem}>
                    <Text style={styles.badgeIcon}>{a.badge_icon}</Text>
                    <Text style={styles.badgeLabel}>{a.badge_label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Renewals Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔄 Gia Hạn Gói</Text>
            <View style={styles.statRow}>
              <StatBox value={report.renewals.submitted} label="Đề xuất" color="#6366F1" />
              <StatBox value={report.renewals.approved} label="Được duyệt" color="#10B981" />
            </View>
          </View>
        </ScrollView>
      )}

      {/* PDF preview mode */}
      {!loading && report && viewMode === 'pdf_preview' && (
        <WebView
          source={{ html: generateReportHTML(report) }}
          style={{ flex: 1 }}
          originWhitelist={['*']}
        />
      )}
    </View>
  );
}

function StatBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  navBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontSize: 24, color: '#6366F1', fontWeight: '700' },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  toggleRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#EEF2FF' },
  toggleBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  toggleBtnTextActive: { color: '#6366F1', fontWeight: '700' },
  shareBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#6366F1', justifyContent: 'center' },
  shareBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  statRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  statValue: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  commissionValue: { fontSize: 32, fontWeight: '900', color: '#10B981' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  starLabel: { width: 60, fontSize: 12 },
  starBar: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  starBarFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  starCount: { width: 24, fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 8,
    padding: 8, minWidth: 60 },
  badgeIcon: { fontSize: 22 },
  badgeLabel: { fontSize: 10, color: '#92400E', fontWeight: '600', textAlign: 'center', marginTop: 2 },
  errorText: { color: '#EF4444', textAlign: 'center', margin: 20 },
});
```

---

## 4. App Store Preparation

### [NEW] `apps/mobile/eas.json` (Production Build Config)

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "env": {
        "APP_VARIANT": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "env": {
        "APP_VARIANT": "preview",
        "SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_ANON_KEY": "..."
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "buildConfiguration": "Release",
        "image": "latest"
      },
      "android": {
        "buildType": "app-bundle",
        "image": "latest"
      },
      "env": {
        "APP_VARIANT": "production",
        "SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_ANON_KEY": "..."
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "dev@bellaspa.vn",
        "ascAppId": "XXXXXXXXXX",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### [NEW] `apps/mobile/app.json` — Production Fields

```json
{
  "expo": {
    "name": "Bella KTV",
    "slug": "bella-ktv-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#6366F1"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "vn.bellaspa.ktv",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Chụp ảnh trước/sau buổi dịch vụ và ảnh tham khảo cho khách hàng",
        "NSPhotoLibraryUsageDescription": "Chọn ảnh từ thư viện để đính kèm vào ghi chú",
        "NSPhotoLibraryAddUsageDescription": "Lưu ảnh dịch vụ vào thư viện của bạn"
      },
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          }
        ]
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#6366F1"
      },
      "package": "vn.bellaspa.ktv",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    "plugins": [
      "expo-router",
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#6366F1",
        "sounds": ["./assets/notification-sound.wav"]
      }],
      ["expo-image-picker", {
        "photosPermission": "Cho phép Bella KTV truy cập ảnh để đính kèm vào ghi chú dịch vụ.",
        "cameraPermission": "Cho phép Bella KTV chụp ảnh trước/sau buổi dịch vụ."
      }]
    ],
    "updates": {
      "url": "https://u.expo.dev/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0
    },
    "runtimeVersion": "1.0.0"
  }
}
```

---

## 5. Production Monitoring — Sentry Integration

### [NEW] `apps/mobile/src/lib/monitoring.ts`

```typescript
// apps/mobile/src/lib/monitoring.ts
import * as Sentry from '@sentry/react-native';

const isDev = process.env.APP_VARIANT === 'development';

export function initMonitoring() {
  if (isDev) return; // Không gửi Sentry trong dev

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.APP_VARIANT ?? 'production',
    tracesSampleRate: 0.1,       // 10% performance traces
    profilesSampleRate: 0.05,    // 5% profiling
    enableNative: true,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
  });
}

/** Đặt context user sau khi login */
export function setMonitoringUser(userId: string, tenantId: string, role: string) {
  if (isDev) return;
  Sentry.setUser({ id: userId });
  Sentry.setTag('tenant_id', tenantId);
  Sentry.setTag('role', role);
}

/** Track RPC performance (phát hiện slow RPCs) */
export function trackRPCCall(rpcName: string, startTime: number) {
  if (isDev) return;
  const duration = Date.now() - startTime;
  Sentry.addBreadcrumb({
    category: 'rpc',
    message: rpcName,
    data: { duration_ms: duration },
    level: duration > 3000 ? 'warning' : 'info',
  });

  if (duration > 5000) {
    Sentry.captureMessage(`Slow RPC: ${rpcName} took ${duration}ms`, 'warning');
  }
}

/** Capture lỗi có context đầy đủ */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (isDev) {
    console.error('[captureError]', error, context);
    return;
  }
  Sentry.withScope(scope => {
    if (context) scope.setContext('extra', context);
    Sentry.captureException(error);
  });
}
```

---

## 6. CI/CD — GitHub Actions

### [NEW] `.github/workflows/mobile-eas-build.yml`

```yaml
# .github/workflows/mobile-eas-build.yml
name: Mobile EAS Build & Deploy

on:
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'
  workflow_dispatch:
    inputs:
      profile:
        description: 'Build profile'
        required: true
        default: 'preview'
        type: choice
        options: [preview, production]

jobs:
  typecheck:
    name: TypeScript Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx tsc --noEmit
        working-directory: apps/mobile

  eas-build:
    name: EAS Build (${{ github.event.inputs.profile || 'preview' }})
    runs-on: ubuntu-latest
    needs: typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - name: EAS Build
        working-directory: apps/mobile
        run: |
          eas build \
            --platform all \
            --profile ${{ github.event.inputs.profile || 'preview' }} \
            --non-interactive \
            --no-wait
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}

  eas-update:
    name: EAS Update (OTA)
    runs-on: ubuntu-latest
    needs: typecheck
    if: github.ref == 'refs/heads/main' && !contains(github.event.head_commit.message, '[skip-ota]')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - name: EAS Update (OTA hot push)
        working-directory: apps/mobile
        run: eas update --branch production --message "${{ github.event.head_commit.message }}"
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## Thứ Tự Thực Thi

```
── Supabase Backend ──────────────────────────────────────────────────────
Bước 1   Apply migration 20260816000000_mobile_reporting_rpcs.sql
          → rpc_mobile_get_my_monthly_report
          → rpc_admin_get_tenant_monthly_report

── Mobile App ────────────────────────────────────────────────────────────
Bước 2   Cài dependencies:
          npx expo install react-native-webview @sentry/react-native

Bước 3   Tạo apps/mobile/src/services/reporting/monthlyReport.ts
Bước 4   Tạo apps/mobile/src/app/(app)/report.tsx (card view + PDF preview)
Bước 5   Cập nhật navigation tabs: thêm icon "Báo cáo"

── App Store Preparation ─────────────────────────────────────────────────
Bước 6   Finalize assets: icon.png (1024×1024), splash.png, adaptive-icon.png
Bước 7   Cập nhật app.json với production config + privacy manifest
Bước 8   Tạo eas.json với 3 profiles: development / preview / production
Bước 9   Chạy EAS Build preview (internal distribution):
          eas build --platform all --profile preview

── Monitoring ────────────────────────────────────────────────────────────
Bước 10  Tạo Sentry project → lấy DSN
Bước 11  Tạo apps/mobile/src/lib/monitoring.ts
Bước 12  Gọi initMonitoring() trong _layout.tsx
Bước 13  Gọi setMonitoringUser() sau khi login thành công
Bước 14  Wrap RPCs với trackRPCCall() cho các RPC quan trọng

── CI/CD ─────────────────────────────────────────────────────────────────
Bước 15  Tạo .github/workflows/mobile-eas-build.yml
Bước 16  Add secrets: EXPO_TOKEN, EXPO_PUBLIC_SENTRY_DSN
Bước 17  Push lên main → verify CI xanh
```

---

## App Store Checklist

### iOS (TestFlight → App Store)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Apple Developer Program | [ ] | $99/năm |
| Bundle Identifier | [ ] | `vn.bellaspa.ktv` |
| Privacy Manifest | [ ] | `NSPrivacyAccessedAPITypes` cho UserDefaults |
| App Privacy Label | [ ] | Camera, Photos, Usage Data |
| Splash Screen | [ ] | 1242×2208px (6.5"), 1242×2208px (5.5") |
| App Icon | [ ] | 1024×1024px, không có alpha |
| Screenshots | [ ] | Cần 3-5 screenshot cho 6.7" và 6.5" |
| Age Rating | [ ] | 4+ (không có content nhạy cảm) |
| EAS Build production | [ ] | `eas build --platform ios --profile production` |
| TestFlight beta test | [ ] | 1 tuần internal test trước submit |

### Android (Internal Track → Production)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Google Play Developer | [ ] | $25 one-time |
| Package Name | [ ] | `vn.bellaspa.ktv` |
| Signing Key | [ ] | EAS tự quản lý hoặc upload custom keystore |
| Privacy Policy URL | [ ] | Cần có trang web riêng |
| App Bundle (AAB) | [ ] | `eas build --platform android --profile production` |
| Store listing | [ ] | Mô tả, ảnh chụp màn hình, icon |
| Content Rating | [ ] | IARC questionnaire |
| Data Safety section | [ ] | Khai báo Camera, Storage access |

---

## Verification Plan

### Report

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | KTV xem báo cáo tháng hiện tại | Hiển thị đúng sessions, commission, reviews |
| 2 | KTV xem báo cáo tháng trước | Cache 24h, không gọi DB lại |
| 3 | Switch sang "Xem PDF" | WebView hiển thị HTML report đúng |
| 4 | Share report | Share sheet mở với HTML content |
| 5 | Admin gọi `rpc_admin_get_tenant_monthly_report` với KTV JWT | `UNAUTHORIZED` |
| 6 | Admin gọi đúng → xem KTV breakdown | Tất cả KTV trong tenant, không lẫn tenant khác |

### EAS Build & OTA

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | `eas build --profile preview` | Build xanh, APK/IPA download được |
| 2 | Cài APK/IPA trên thiết bị thật | App khởi động, login được, RPC hoạt động |
| 3 | Push commit lên main | CI/CD trigger EAS Update OTA tự động |
| 4 | Mở app sau OTA update | App hiển thị version mới mà không cần install lại |
| 5 | Camera permission bị từ chối | App không crash, hiển thị thông báo hướng dẫn bật lại |

### Monitoring

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Gọi RPC mất > 5 giây | Sentry capture message "Slow RPC: ..." |
| 2 | Throw error trong service | Sentry capture exception với user context |
| 3 | App crash | Sentry crash report có stack trace đầy đủ |

---

## Danh Sách File Checklist

| File | Trạng thái | Ghi chú |
|---|---|---|
| `supabase/migrations/20260816000000_mobile_reporting_rpcs.sql` | **NEW** | Monthly report RPCs |
| `apps/mobile/src/services/reporting/monthlyReport.ts` | **NEW** | Fetch + cache + HTML generator |
| `apps/mobile/src/app/(app)/report.tsx` | **NEW** | Card view + PDF preview + Share |
| `apps/mobile/src/lib/monitoring.ts` | **NEW** | Sentry init + RPC tracking |
| `apps/mobile/eas.json` | **NEW** | dev/preview/production build profiles |
| `apps/mobile/app.json` | **MODIFY** | Thêm privacy manifest, OTA config, permissions |
| `.github/workflows/mobile-eas-build.yml` | **NEW** | CI/CD auto build + OTA |
| `apps/mobile/assets/icon.png` | **MODIFY** | Final 1024×1024 icon |
| `apps/mobile/assets/splash.png` | **MODIFY** | Final splash screen |

---

## Ghi Chú Kiến Trúc

### Tại sao HTML → WebView thay vì PDF library?

```
PDF libraries (react-native-pdf, react-native-html-to-pdf):
→ Nặng, khó setup, thường có native issues
→ Cần binary native module → EAS build phức tạp hơn
→ Không cần thiết cho báo cáo đơn giản

HTML → WebView → Share:
→ Không cần thêm library
→ HTML/CSS đầy đủ khả năng styling
→ iOS Share Sheet → "In" → PDF tự động (native print dialog)
→ Android → Share → Gmail/Drive export PDF
```

### Tại sao OTA Update quan trọng cho ERP?

```
Kịch bản thực tế:
  Bug trong production → Admin báo cáo
  Build lại App Store → Review 1-3 ngày → User mới nhận được

Với EAS Update OTA:
  Fix bug → push commit → EAS Update → User nhận trong vòng 15 phút
  Không cần review lại (chỉ cho JS bundle changes, không phải native)
  → Critical bugs được fix nhanh chóng
```

### Production Environment vs Preview

```
Development (local):
  Supabase: local/staging
  Sentry: disabled
  Mock data cho testing

Preview (TestFlight internal):
  Supabase: staging environment
  Sentry: enabled, environment=preview
  Internal testers: team + stakeholders

Production (App Store):
  Supabase: production (Supabase Pro)
  Sentry: enabled, environment=production
  OTA: enabled, branch=production
  Row Level Security: enforced tất cả tables
```

---

## Định Nghĩa Hoàn Thành (DoD) — Tuần 10

**Báo Cáo:**
- [ ] **Monthly report:** Hiển thị đúng sessions, commission (derived), rating, achievements.
- [ ] **PDF preview:** WebView render HTML report đẹp, không bị cắt.
- [ ] **Share:** Share Sheet mở đúng; iOS có thể "In" → PDF.
- [ ] **Cache:** Báo cáo tháng trước cache 24h; tháng hiện tại 30 phút.
- [ ] **Admin report:** Cross-tenant check — Admin tenant A không thấy KTV tenant B.

**App Store:**
- [ ] **EAS Build preview:** Build thành công cho cả iOS và Android.
- [ ] **Cài đặt thật:** APK/IPA cài được trên thiết bị thật, không crash khi khởi động.
- [ ] **Privacy Manifest:** iOS Privacy manifest file hợp lệ (không bị reject bởi App Store).
- [ ] **Permissions:** Camera, Photos permission flow đúng iOS/Android.
- [ ] **Icons & Splash:** Icon 1024×1024 không có alpha; splash không bị stretched.

**Monitoring:**
- [ ] **Sentry init:** `initMonitoring()` chạy trước khi user interact.
- [ ] **User context:** Sau login, `setMonitoringUser()` set đúng userId + tenantId.
- [ ] **Slow RPC:** RPC > 5s → Sentry warning tự động.
- [ ] **Crash capture:** Unhandled exception → Sentry capture với stack trace.

**CI/CD:**
- [ ] **CI typecheck:** TypeScript check pass trên GitHub Actions.
- [ ] **OTA push:** Push commit lên main → EAS Update trigger tự động.
- [ ] **Secrets:** `EXPO_TOKEN`, `EXPO_PUBLIC_SENTRY_DSN` set đúng trong GitHub Secrets.

---

## Tổng Kết Phase 3 (Tuần 9-10)

| Hạng mục | Tuần 9 | Tuần 10 |
|---|---|---|
| **Mục tiêu chính** | Customer Intelligence | Production Readiness |
| **Tables mới** | `session_media`, `customer_care_notes` | — |
| **RPCs mới** | 4 (profile, media, care note) | 2 (monthly report, admin report) |
| **Services mới** | `sessionMedia.ts`, `customerProfile.ts` | `monthlyReport.ts`, `monitoring.ts` |
| **Màn hình mới** | Customer Profile (3-tab) | Report (card + PDF) |
| **Infrastructure** | Supabase Storage bucket | EAS Build, Sentry, CI/CD |
| **Dependencies mới** | `expo-image-picker`, `expo-image-manipulator` | `react-native-webview`, `@sentry/react-native` |
