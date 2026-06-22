// apps/mobile/app/index.tsx
// Root route - redirect based on auth state

import { Redirect } from 'expo-router';
import React from 'react';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const auth = useAuth();

  // Both 'loading' and 'loading-profile' show loading screen
  if (auth.status === 'loading' || auth.status === 'loading-profile') {
    return <LoadingScreen />;
  }

  if (auth.status === 'authenticated') {
    return <Redirect href="/(app)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
