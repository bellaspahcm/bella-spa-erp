// apps/mobile/app/_layout.tsx
// Root layout with AuthProvider and TenantProvider
// TEMP: Sentry disabled for build debugging

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
// import * as Sentry from '@sentry/react-native';
import { AuthProvider } from '../src/contexts/AuthContext';
import { TenantProvider } from '../src/contexts/TenantContext';
// import { initSentry } from '../src/lib/sentry';
// import { SentryErrorFallback } from '../src/components/SentryErrorBoundary';

// Initialize Sentry BEFORE rendering any components
// This ensures all crashes are captured from app start
// TEMP: Disabled for build debugging
// initSentry();

export default function RootLayout() {
  return (
    // <Sentry.ErrorBoundary fallback={SentryErrorFallback} showDialog={false}>
      <AuthProvider>
        <TenantProvider>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </TenantProvider>
      </AuthProvider>
    // </Sentry.ErrorBoundary>
  );
}
