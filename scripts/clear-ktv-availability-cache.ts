/**
 * Clear KTV Availability Cache
 * 
 * Run this after deploying fixes to /api/bookings/check-ktv-availability
 * to force immediate cache refresh for all users.
 * 
 * Usage:
 *   npx tsx scripts/clear-ktv-availability-cache.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env as fallback
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearKtvAvailabilityCache() {
  console.log('🔧 Clearing KTV Availability Cache...\n');
  
  console.log('ENV check:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.log("  Supabase service credential configured:", SUPABASE_SERVICE_KEY ? "yes" : "no");
  console.log('  REDIS_URL:', REDIS_URL);
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const redis = new Redis(REDIS_URL);

  // Get all tenants
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name');

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`);
  }

  if (!tenants || tenants.length === 0) {
    console.log('⚠️  No tenants found');
    return;
  }

  console.log(`Found ${tenants.length} tenant(s)\n`);

  // For each tenant, scan and delete all ktv:availability:* keys
  let totalDeleted = 0;

  for (const tenant of tenants) {
    console.log(`Processing tenant: ${tenant.name} (${tenant.id})`);
    
    const pattern = `ktv:availability:*:${tenant.id}:*`;
    console.log(`  Pattern: ${pattern}`);

    try {
      // Scan for matching keys
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100'
        );
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length === 0) {
        console.log(`  ✓ No cache entries found\n`);
        continue;
      }

      // Delete all keys
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      totalDeleted += keys.length;
      console.log(`  ✓ Deleted ${keys.length} cache entries\n`);
    } catch (err) {
      console.error(`  ✗ Error: ${err}\n`);
    }
  }

  await redis.quit();
  console.log(`✅ Done! Total cache entries deleted: ${totalDeleted}`);
}

clearKtvAvailabilityCache()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
