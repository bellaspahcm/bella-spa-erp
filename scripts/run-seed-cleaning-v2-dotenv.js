#!/usr/bin/env node
/**
 * Wrapper to load .env.local using dotenv package
 */

require('dotenv').config({ path: '.env.local' });

// Check required env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING');
  console.error('   SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'OK' : 'MISSING');
  process.exit(1);
}

// Set the key for the seed script (it looks for NEXT_PUBLIC_SUPABASE_ANON_KEY)
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('✓ Using SUPABASE_SERVICE_ROLE_KEY as auth key');
}

console.log('✓ Environment variables loaded');
console.log('🚀 Starting seed script...\n');

// Run the .mjs file
const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'seed-cleaning-demo-v2.mjs');

try {
  execSync(`node "${scriptPath}"`, {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('❌ Seed script failed');
  process.exit(1);
}
