/**
 * Test script to verify auto_vehicles table query
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  console.log('🔍 Testing auto_vehicles query...\n');

  try {
    // Test 1: Simple select count
    console.log('Test 1: Count records in auto_vehicles');
    const { data: countData, error: countError, count } = await supabase
      .from('auto_vehicles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError);
    } else {
      console.log(`✅ Total records: ${count}`);
    }

    // Test 2: Select with tenant_id (Bella Auto test tenant)
    console.log('\nTest 2: Query with tenant_id filter');
    const testTenantId = '60b2af9f-e8c3-4b42-9f58-8e5a1d7c3f2e'; // From your previous query
    
    const { data, error } = await supabase
      .from('auto_vehicles')
      .select('*')
      .eq('tenant_id', testTenantId)
      .limit(10);

    if (error) {
      console.error('❌ Query failed:', JSON.stringify(error, null, 2));
      console.error('\nError details:');
      console.error('  Code:', error.code);
      console.error('  Message:', error.message);
      console.error('  Details:', error.details);
      console.error('  Hint:', error.hint);
    } else {
      console.log(`✅ Query successful! Found ${data?.length || 0} records`);
      if (data && data.length > 0) {
        console.log('\nSample record:');
        console.log(JSON.stringify(data[0], null, 2));
      }
    }

    // Test 3: Check if table exists
    console.log('\nTest 3: Verify table structure');
    const { data: schemaData, error: schemaError } = await supabase
      .from('auto_vehicles')
      .select('id')
      .limit(1);

    if (schemaError) {
      if (schemaError.code === '42P01') {
        console.error('❌ Table "auto_vehicles" does not exist!');
      } else {
        console.error('❌ Schema check failed:', schemaError.message);
      }
    } else {
      console.log('✅ Table exists and is accessible');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testQuery();
