// apps/mobile/src/lib/supabase.ts
// Supabase client for React Native with AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { ENV } from './env';

/**
 * Mobile Supabase client with AsyncStorage for session persistence
 * Different from web client which uses cookies/SSR
 */
const supabaseClient = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getMobileSupabase() {
  return supabaseClient;
}
