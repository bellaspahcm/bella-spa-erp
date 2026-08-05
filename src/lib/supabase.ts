import { createServiceClient } from './supabase-service-client';

// Shared server-side Supabase client for capability-platform and other backend services
export const supabase = typeof window !== 'undefined' ? null as any : createServiceClient();
