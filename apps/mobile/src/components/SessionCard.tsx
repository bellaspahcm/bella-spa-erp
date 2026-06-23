/**
 * SessionCard - Display a session with customer info, time, status
 * Used in today's sessions list
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TodaySession } from '../services/dashboard/fetchTodaySessions';

interface SessionCardProps {
  session: TodaySession;
  showKtvName?: boolean;
}

export function SessionCard({ session, showKtvName = true }: SessionCardProps) {
  const statusColor = getStatusColor(session.status);
  const statusLabel = getStatusLabel(session.status);

  return (
    <View style={styles.card}>
      {/* Header: Time and Status */}
      <View style={styles.header}>
        <Text style={styles.time}>
          {session.assignedTime || 'Chưa xếp giờ'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.body}>
        <Text style={styles.customerName}>{session.customerName}</Text>
        {session.babyName && (
          <Text style={styles.babyName}>Con: {session.babyName}</Text>
        )}
        {session.packageName && (
          <Text style={styles.packageName}>📦 {session.packageName}</Text>
        )}
      </View>

      {/* Footer: Progress and KTV */}
      <View style={styles.footer}>
        <Text style={styles.progress}>
          {session.completedSessions}/{session.totalSessions} ca
        </Text>
        {showKtvName && session.ktvName && (
          <Text style={styles.ktvName}>👤 {session.ktvName}</Text>
        )}
      </View>
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'in_progress':
      return '#4CAF50'; // Green
    case 'pending':
      return '#FF9800'; // Orange
    case 'scheduled':
      return '#2196F3'; // Blue
    default:
      return '#9E9E9E'; // Gray
  }
}

function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'in_progress':
      return 'Đang phục vụ';
    case 'pending':
      return 'Chờ bắt đầu';
    case 'scheduled':
      return 'Đã xếp lịch';
    default:
      return status;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  babyName: {
    fontSize: 14,
    color: '#555',  // FIXED: Improved from #666 to #555 for better contrast
    marginBottom: 4,
  },
  packageName: {
    fontSize: 14,
    color: '#E91E63',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  progress: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ktvName: {
    fontSize: 14,
    color: '#666',
  },
});
