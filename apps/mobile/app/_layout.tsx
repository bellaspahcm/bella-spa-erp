// apps/mobile/app/_layout.tsx
// Root layout with AuthProvider and TenantProvider

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AuthProvider } from '../src/contexts/AuthContext';
import { TenantProvider } from '../src/contexts/TenantContext';

export default function RootLayout() {
  return (
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
  );
}
