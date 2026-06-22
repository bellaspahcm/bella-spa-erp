// apps/mobile/src/lib/env.ts
// Adapter for EXPO_PUBLIC_* environment variables with validation

import Constants from 'expo-constants';

/**
 * Read environment variables from Expo config
 * EXPO_PUBLIC_* variables are exposed to the app bundle
 * 
 * Validates required environment variables on app startup
 * Throws error if missing to prevent runtime issues
 */
function getEnvVar(key: string): string {
  const value = Constants.expoConfig?.extra?.[key] ?? process.env[key];
  if (!value) {
    throw new Error(
      `❌ Missing required environment variable: ${key}\n\n` +
      `Please create apps/mobile/.env file with:\n` +
      `${key}=your-value-here\n\n` +
      `See apps/mobile/.env.example for template.`
    );
  }
  return value;
}

/**
 * Validate environment variable format
 */
function validateSupabaseUrl(url: string): void {
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    throw new Error(
      `❌ Invalid EXPO_PUBLIC_SUPABASE_URL format: ${url}\n` +
      `Must start with https:// (or http://localhost for local dev)`
    );
  }
  if (!url.includes('.supabase.co') && !url.includes('localhost')) {
    console.warn(
      `⚠️ EXPO_PUBLIC_SUPABASE_URL doesn't look like a Supabase URL: ${url}\n` +
      `Expected format: https://your-project.supabase.co`
    );
  }
}

function validateSupabaseAnonKey(key: string): void {
  // Supabase anon keys are JWT tokens (should be long)
  if (key.length < 100) {
    throw new Error(
      `❌ Invalid EXPO_PUBLIC_SUPABASE_ANON_KEY: too short (${key.length} chars)\n` +
      `Supabase anon keys are typically 200+ characters.\n` +
      `Make sure you copied the full key from Supabase dashboard.`
    );
  }
  if (key === 'your-anon-key-here') {
    throw new Error(
      `❌ Please replace placeholder in .env file:\n` +
      `EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here\n\n` +
      `Get your anon key from: https://app.supabase.com/project/YOUR_PROJECT/settings/api`
    );
  }
}

// Read and validate environment variables
const SUPABASE_URL = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Validate format
validateSupabaseUrl(SUPABASE_URL);
validateSupabaseAnonKey(SUPABASE_ANON_KEY);

// Log success (development only)
if (__DEV__) {
  console.log('✅ Environment variables loaded successfully');
  console.log(`📍 Supabase URL: ${SUPABASE_URL.substring(0, 30)}...`);
  console.log(`🔑 Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
}

export const ENV = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} as const;
