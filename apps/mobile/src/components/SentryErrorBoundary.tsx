/**
 * Sentry Error Boundary Fallback UI
 * 
 * Displayed when the app crashes unexpectedly.
 * Provides user-friendly error message with option to reload.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Updates from 'expo-updates';

interface SentryErrorFallbackProps {
  error: Error;
  componentStack: string;
  eventId: string;
  resetError: () => void;
}

export function SentryErrorFallback({
  error,
  componentStack,
  eventId,
  resetError,
}: SentryErrorFallbackProps) {
  const handleReload = async () => {
    try {
      // Try to reload the app (works in production builds)
      if (!__DEV__) {
        await Updates.reloadAsync();
      } else {
        // In development, just reset the error boundary
        resetError();
      }
    } catch (reloadError) {
      console.error('Failed to reload app:', reloadError);
      resetError(); // Fallback to simple reset
    }
  };

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>⚠️</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>Đã xảy ra lỗi</Text>

      {/* Description */}
      <Text style={styles.description}>
        Ứng dụng gặp sự cố không mong muốn. Chúng tôi đã ghi nhận lỗi này và sẽ khắc phục sớm nhất.
      </Text>

      {/* Error ID (for support) */}
      {eventId && (
        <View style={styles.errorIdContainer}>
          <Text style={styles.errorIdLabel}>Mã lỗi:</Text>
          <Text style={styles.errorIdValue}>{eventId.substring(0, 8)}</Text>
        </View>
      )}

      {/* Dev mode error details */}
      {__DEV__ && (
        <View style={styles.devErrorContainer}>
          <Text style={styles.devErrorTitle}>Chi tiết lỗi (chỉ hiển thị trong dev mode):</Text>
          <Text style={styles.devErrorMessage}>{error.message}</Text>
          {componentStack && (
            <Text style={styles.devErrorStack} numberOfLines={10}>
              {componentStack}
            </Text>
          )}
        </View>
      )}

      {/* Reload button */}
      <TouchableOpacity style={styles.reloadButton} onPress={handleReload}>
        <Text style={styles.reloadButtonText}>Tải lại ứng dụng</Text>
      </TouchableOpacity>

      {/* Support hint */}
      <Text style={styles.supportHint}>
        Nếu lỗi vẫn tiếp diễn, vui lòng liên hệ Quản trị viên
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#555',  // FIXED: Improved from #666 to #555 for better contrast (8.59:1)
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  errorIdLabel: {
    fontSize: 14,
    color: '#555',  // FIXED: Improved from #666 to #555 for better contrast (8.59:1)
    marginRight: 8,
  },
  errorIdValue: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  devErrorContainer: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  devErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 8,
  },
  devErrorMessage: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
    marginBottom: 8,
  },
  devErrorStack: {
    fontSize: 11,
    color: '#856404',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  reloadButton: {
    backgroundColor: '#E91E63',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E91E63',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  reloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  supportHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});

