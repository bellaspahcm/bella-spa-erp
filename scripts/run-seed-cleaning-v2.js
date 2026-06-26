#!/usr/bin/env node
/**
 * Wrapper to load .env.local before running seed-cleaning-demo-v2.mjs
 */

const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
      process.env[key] = value;
    }
  });
  console.log('✓ Loaded .env.local');
} else {
  console.error('❌ .env.local not found');
  process.exit(1);
}

// Check required env vars
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK' : 'MISSING');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'OK' : 'MISSING');
  process.exit(1);
}

// Now run the actual seed script
console.log('🚀 Starting seed script...\n');

// Use child_process to run the .mjs file
const { execSync } = require('child_process');
const scriptPath = path.join(__dirname, 'seed-cleaning-demo-v2.mjs');

try {
  execSync(`node "${scriptPath}"`, {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('❌ Seed script failed:', error.message);
  process.exit(1);
}
