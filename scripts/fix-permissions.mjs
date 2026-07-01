#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

console.log('🔧 Fixing permissions for Marketing Intelligence...\n');

const grants = [
  'GRANT SELECT ON mv_campaign_performance TO anon;',
  'GRANT SELECT ON mv_campaign_performance TO authenticated;',
  'GRANT SELECT ON mv_channel_performance TO anon;',
  'GRANT SELECT ON mv_channel_performance TO authenticated;',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON external_ads_data TO anon;',
  'GRANT SELECT, INSERT, UPDATE, DELETE ON marketing_campaigns TO anon;',
  'GRANT EXECUTE ON FUNCTION has_external_mapping TO anon;',
  'GRANT EXECUTE ON FUNCTION get_external_campaign_id TO anon;',
];

for (const grant of grants) {
  try {
    await client.query(grant);
    console.log('✓', grant);
  } catch (err) {
    console.log('✗', grant, '-', err.message);
  }
}

console.log('\n✅ Permissions fixed!');

await client.end();
