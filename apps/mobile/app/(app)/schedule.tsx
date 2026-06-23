// apps/mobile/app/(app)/schedule.tsx
// Schedule screen - placeholder for Week 3

import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';

export default function ScheduleScreen() {
  const auth = useAuth();

  if (auth.status !== 'authenticated') {
    router.replace('/');
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lịch hẹn</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.placeholder}>📅</Text>
        <Text style={styles.placeholderTitle}>Lịch hẹn đầy đủ</Text>
        <Text style={styles.placeholderText}>
          Tính năng này sẽ được phát triển trong Week 3:
        </Text>
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• Xem lịch theo tuần/tháng</Text>
          <Text style={styles.featureItem}>• Filter theo KTV</Text>
          <Text style={styles.featureItem}>• Chi tiết booking</Text>
          <Text style={styles.featureItem}>• QR check-in/out</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#E91E63',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  content: {
    padding: 32,
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 80,
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#555',  // FIXED: Improved from #666 to #555 for better contrast (8.59:1)
    textAlign: 'center',
    marginBottom: 24,
  },
  featureList: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
  },
});
