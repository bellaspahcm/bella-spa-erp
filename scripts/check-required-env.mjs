#!/usr/bin/env node

/**
 * Check Required Environment Variables
 * 
 * Validates that all required environment variables are set before build.
 * Prevents deployment with missing configuration.
 * 
 * Exit codes:
 * - 0: All required variables are set
 * - 1: One or more required variables are missing
 * 
 * Usage:
 *   node scripts/check-required-env.mjs
 *   npm run env:check
 */

const requiredEnvVars = [
  // Supabase (client-side - must have NEXT_PUBLIC_ prefix)
  'NEXT_PUBLIC_SUPABASE_URL',
  // One of these must be set:
  // 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  // 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const optionalButRecommended = [
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENTRY_AUTH_TOKEN',
];

console.log('🔍 Checking required environment variables...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${envVar}: Set`);
  }
}

// Special check: At least one of the Supabase keys must be set
const hasSupabaseKey = 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!hasSupabaseKey) {
  console.error('❌ Missing Supabase key: Set either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  hasErrors = true;
} else {
  const keyName = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
    ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' 
    : 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
  console.log(`✅ ${keyName}: Set`);
}

// Check optional but recommended variables
console.log('\n📋 Optional but recommended variables:');
for (const envVar of optionalButRecommended) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  ${envVar}: Not set (optional)`);
    hasWarnings = true;
  } else {
    console.log(`✅ ${envVar}: Set`);
  }
}

console.log('');

if (hasErrors) {
  console.error('❌ Environment validation failed. Please set missing variables.\n');
  console.error('For local development: Copy .env.example to .env.local and fill in values');
  console.error('For Vercel deployment: Set variables in Project Settings → Environment Variables\n');
  process.exit(1);
}

if (hasWarnings) {
  console.warn('⚠️  Some optional variables are not set. Application may have limited functionality.\n');
}

console.log('✅ All required environment variables are set\n');
process.exit(0);
