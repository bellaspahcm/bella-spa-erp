#!/usr/bin/env node
/**
 * Wrapper to run cleanup-cleaning-demo-v2.mjs with dotenv
 * 
 * Usage:
 *   node scripts/run-cleanup-cleaning-v2-dotenv.js          (dry-run)
 *   node scripts/run-cleanup-cleaning-v2-dotenv.js --confirm (actually delete)
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

// Check if using SERVICE_ROLE_KEY or ANON_KEY
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✓ Using SUPABASE_SERVICE_ROLE_KEY as auth key');
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
} else if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('✓ Using NEXT_PUBLIC_SUPABASE_ANON_KEY as auth key');
} else {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

console.log('✓ Environment variables loaded');

// Run cleanup script
console.log('🚀 Starting cleanup script...\n');

const scriptPath = resolve(__dirname, 'cleanup-cleaning-demo-v2.mjs');
const args = process.argv.slice(2); // Pass through --confirm flag if present

const child = spawn('node', [scriptPath, ...args], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Cleanup script completed');
  } else {
    console.error(`\n❌ Cleanup script failed with code ${code}`);
  }
  process.exit(code);
});
