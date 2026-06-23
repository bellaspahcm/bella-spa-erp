/**
 * RoleBadge - Display user role with appropriate styling
 * Uses shared package role helpers for consistency
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isAdminRole, isTechnicianRole, isManagerOrAbove } from '@bella/shared';

interface RoleBadgeProps {
  role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const { label, color, backgroundColor } = getRoleStyle(role);

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

function getRoleStyle(role: string): {
  label: string;
  color: string;
  backgroundColor: string;
} {
  if (isAdminRole(role)) {
    return {
      label: '👑 Quản trị',
      color: '#FFF',
      backgroundColor: '#E91E63', // Pink
    };
  }

  if (isTechnicianRole(role)) {
    return {
      label: '💆 Kỹ thuật viên',
      color: '#FFF',
      backgroundColor: '#2196F3', // Blue
    };
  }

  if (isManagerOrAbove(role)) {
    return {
      label: '📊 Quản lý',
      color: '#FFF',
      backgroundColor: '#FF9800', // Orange
    };
  }

  // Default for other roles
  return {
    label: normalizeRoleLabel(role),
    color: '#666',
    backgroundColor: '#F5F5F5', // Light gray
  };
}

function normalizeRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    accountant: '💰 Kế toán',
    hr: '👥 Nhân sự',
    admin_staff: '📋 Hành chính',
    staff: '👤 Nhân viên',
  };
  return labels[role.toLowerCase()] || role;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
