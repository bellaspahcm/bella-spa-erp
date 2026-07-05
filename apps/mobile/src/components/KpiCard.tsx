/**
 * KpiCard - Display a single KPI metric
 * Used in dashboard to show stats like revenue, sessions count, etc.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

export function KpiCard({ label, value, icon, variant = 'default' }: KpiCardProps) {
  const backgroundColor = getBackgroundColor(variant);
  const textColor = getTextColor(variant);

  return (
    <View style={[styles.card, { backgroundColor }]}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function getBackgroundColor(variant: string): string {
  switch (variant) {
    case 'primary':
      return colors.primary;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    default:
      return colors.background;
  }
}

function getTextColor(variant: string): string {
  return variant === 'default' ? colors.text : colors.textWhite;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
  },
});
