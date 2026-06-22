// apps/mobile/app/(app)/home.tsx
// Home screen - show user profile from database

import { isAdminRole } from '@bella/shared';
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

export default function HomeScreen() {
  const auth = useAuth();

  if (auth.status !== 'authenticated') {
    router.replace('/');
    return null;
  }

  const { user, signOut } = auth;

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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Chào mừng!</Text>

        {user.isSuspended && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Tenant của bạn đã bị tạm ngưng
            </Text>
          </View>
        )}

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
            <View style={styles.roleContainer}>
              <Text style={styles.value}>{user.role}</Text>
              {isAdminRole(user.role) && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Quản trị</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>ID:</Text>
            <Text style={[styles.value, styles.valueSmall]}>{user.id}</Text>
          </View>

          {user.tenant_id && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Tenant ID:</Text>
              <Text style={[styles.value, styles.valueSmall]}>{user.tenant_id}</Text>
            </View>
          )}
        </View>

        <Text style={styles.note}>
          ✅ Role được lấy từ bảng <Text style={styles.noteCode}>users</Text> trong
          database (không dùng user_metadata)
        </Text>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Bella ERP Mobile v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#0066cc',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffecb5',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333333',
  },
  infoRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  note: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 24,
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  noteCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    color: '#0066cc',
  },
  signOutButton: {
    backgroundColor: '#ff3333',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  signOutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999999',
  },
});
