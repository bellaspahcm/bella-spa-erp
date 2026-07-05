// apps/mobile/app/(app)/profile.tsx
// Profile screen - user info and settings

import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTenant } from '../../src/contexts/TenantContext';
import { RoleBadge } from '../../src/components/RoleBadge';
import { testSentry } from '../../src/lib/sentry';
import colors from '../../src/theme/colors';

export default function ProfileScreen() {
  const auth = useAuth();
  const tenant = useTenant();

  if (auth.status !== 'authenticated') {
    router.replace('/');
    return null;
  }

  const { user, signOut } = auth;
  const tenantName = tenant.status === 'loaded' ? tenant.tenant.name : '';

  const handleSignOut = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const handleTestSentry = () => {
    Alert.alert(
      'Test Sentry',
      'Sentry sẽ ghi nhận một lỗi test. Kiểm tra dashboard sau 1-2 phút.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Test',
          onPress: () => {
            testSentry();
            Alert.alert('✅', 'Đã gửi test error đến Sentry. Kiểm tra dashboard.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cá nhân</Text>
      </View>

      {user.isSuspended && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Tenant của bạn đã bị tạm ngưng
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Profile Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin tài khoản</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{user.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Họ tên:</Text>
            <Text style={styles.value}>{user.full_name || 'Chưa cập nhật'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Vai trò:</Text>
            <View>
              <RoleBadge role={user.role} />
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Chi nhánh:</Text>
            <Text style={styles.value}>{tenantName || 'Đang tải...'}</Text>
          </View>
        </View>

        {/* Settings Card (Placeholder) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cài đặt</Text>
          <Text style={styles.placeholderText}>
            Các tùy chọn cài đặt sẽ được thêm trong các phiên bản sau:
          </Text>
          <View style={styles.featureList}>
            <Text style={styles.featureItem}>• Thông báo đẩy</Text>
            <Text style={styles.featureItem}>• Ngôn ngữ</Text>
            <Text style={styles.featureItem}>• Chế độ tối</Text>
            <Text style={styles.featureItem}>• Đổi mật khẩu</Text>
          </View>
        </View>

        {/* Debug Info (Dev Only) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin kỹ thuật</Text>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>User ID:</Text>
            <Text style={styles.debugValue}>{user.id}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Tenant ID:</Text>
            <Text style={styles.debugValue}>{user.tenant_id || 'N/A'}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Platform:</Text>
            <Text style={styles.debugValue}>{Platform.OS}</Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Version:</Text>
            <Text style={styles.debugValue}>1.0.0 (Week 2)</Text>
          </View>

          {/* Sentry Test Button (Dev Mode Only) */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.testSentryButton}
              onPress={handleTestSentry}
            >
              <Text style={styles.testSentryButtonText}>
                🧪 Test Sentry Integration
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Bella ERP Mobile • Phase 1 Week 2
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textWhite,
  },
  content: {
    padding: 16,
  },
  warningBox: {
    backgroundColor: colors.warningLight,
    margin: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFECB5',
  },
  warningText: {
    color: colors.warningText,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: colors.text,
  },
  infoRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  featureList: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
  },
  featureItem: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  debugLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  debugValue: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  signOutButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  signOutButtonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  testSentryButton: {
    backgroundColor: '#9C27B0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  testSentryButtonText: {
    color: colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 32,
  },
});
