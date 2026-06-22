// apps/mobile/src/lib/env.ts
// Adapter for EXPO_PUBLIC_* environment variables

import Constants from 'expo-constants';

/**
 * Read environment variables from Expo config
 * EXPO_PUBLIC_* variables are exposed to the app bundle
 */
function getEnvVar(key: string): string {
  const value = Constants.expoConfig?.extra?.[key] ?? process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const ENV = {
  SUPABASE_URL: getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
} as const;
