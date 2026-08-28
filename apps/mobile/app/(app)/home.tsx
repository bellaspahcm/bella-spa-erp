// apps/mobile/app/(app)/home.tsx
// Dashboard screen - KPI stats and today's sessions

import { router } from 'expo-router';
import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTenant } from '../../src/contexts/TenantContext';
import { useDashboardStats } from '../../src/hooks/useDashboardStats';
import { useTodaySessions } from '../../src/hooks/useTodaySessions';
import { DashboardErrorState } from '../../src/components/DashboardErrorState';
import { KpiCard } from '../../src/components/KpiCard';
import { RoleBadge } from '../../src/components/RoleBadge';
import { SessionCard } from '../../src/components/SessionCard';
import colors from '../../src/theme/colors';

// Inline utils (copied from @bella/shared for mobile-only build)
function isTechnicianRole(role: string): boolean {
  return role === 'ktv' || role === 'technician';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export default function HomeScreen() {
  const auth = useAuth();
  const tenant = useTenant();

  const user = auth.status === 'authenticated' ? auth.user : null;
  const tenantId = tenant.status === 'loaded' ? tenant.tenant.id : null;
  const tenantName = tenant.status === 'loaded' ? tenant.tenant.name : '';
  const isStale = tenant.status === 'loaded' && tenant.stale;

  const {
    sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    refresh,
  } = useTodaySessions({
    tenantId,
    userId: user?.id ?? '',
    role: user?.role ?? '',
  });

  const {
    kpi,
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardStats({
    tenantId,
    userId: user?.id ?? '',
    role: user?.role ?? '',
  });

  const isKtv = isTechnicianRole(user?.role ?? '');

  if (auth.status !== 'authenticated' || !user) {
    router.replace('/');
    return null;
  }

  // ── Tenant Error ────────────────────────────────────────────────────
  if (tenant.status === 'error') {
    return (
      <DashboardErrorState
        message={`Không tải được thông tin chi nhánh: ${tenant.error}`}
        onRetry={() => {
          router.replace('/home');
        }}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={sessionsLoading} onRefresh={refresh} />
      }
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Xin chào, {user.full_name || 'Bạn'}!</Text>
          <Text style={styles.tenantName}>
            {tenantName || 'Bella Spa'}
            {isStale && <Text style={styles.staleIndicator}> (cache)</Text>}
          </Text>
        </View>
        <RoleBadge role={user.role} />
      </View>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tổng quan hôm nay</Text>
        {statsLoading ? (
          <Text style={styles.loadingText}>Đang tải...</Text>
        ) : statsError ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorIcon}>⚠️</Text>
            <View style={styles.inlineErrorContent}>
              <Text style={styles.inlineErrorTitle}>
                Không thể tải thống kê
              </Text>
              <Text style={styles.inlineErrorMessage}>{statsError}</Text>
            </View>
          </View>
        ) : kpi?.type === 'admin' ? (
          <View style={styles.kpiRow}>
            <KpiCard
              label="Lịch hôm nay"
              value={kpi.data.todayBookings}
              icon="📅"
              variant="primary"
            />
            <KpiCard
              label="Đang phục vụ"
              value={kpi.data.activeNow}
              icon="⏳"
              variant="success"
            />
            <KpiCard
              label="Doanh thu"
              value={formatCurrency(kpi.data.todayRevenue)}
              icon="💰"
              variant="warning"
            />
          </View>
        ) : kpi?.type === 'technician' ? (
          <View style={styles.kpiRow}>
            <KpiCard
              label="Tổng ca"
              value={kpi.data.todayTotal}
              icon="📋"
              variant="primary"
            />
            <KpiCard
              label="Hoàn thành"
              value={kpi.data.completed}
              icon="✅"
              variant="success"
            />
            <KpiCard
              label="Còn lại"
              value={kpi.data.remaining}
              icon="⏰"
              variant="warning"
            />
          </View>
        ) : null}
      </View>

      {/* ── Today's Sessions ────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isKtv ? 'Lịch của tôi hôm nay' : 'Lịch hôm nay'}
        </Text>
        {sessionsLoading && sessions.length === 0 ? (
          <Text style={styles.loadingText}>Đang tải lịch...</Text>
        ) : sessionsError ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorIcon}>⚠️</Text>
            <View style={styles.inlineErrorContent}>
              <Text style={styles.inlineErrorTitle}>
                Không thể tải danh sách ca
              </Text>
              <Text style={styles.inlineErrorMessage}>{sessionsError}</Text>
            </View>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có lịch nào hôm nay</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              showKtvName={!isKtv}
            />
          ))
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Kéo xuống để làm mới • Bella ERP Mobile v1.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 24,
    paddingTop: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textWhite,
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 16,
    color: colors.textWhite,
    opacity: 0.9,
  },
  staleIndicator: {
    fontSize: 12,
    opacity: 0.7,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  loadingText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.errorLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
  },
  inlineErrorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  inlineErrorContent: {
    flex: 1,
  },
  inlineErrorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.errorText,
    marginBottom: 4,
  },
  inlineErrorMessage: {
    fontSize: 12,
    color: colors.errorText,
    lineHeight: 18,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
