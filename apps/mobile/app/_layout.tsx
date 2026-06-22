// apps/mobile/app/_layout.tsx
// Root layout with AuthProvider

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AuthProvider } from '../src/contexts/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AuthProvider>
  );
}
