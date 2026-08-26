#!/usr/bin/env tsx
/**
 * Apply T1 RLS repair to production database
 * Adds missing RLS policies to hc_prescriptions and hc_appointments
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyRepair() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log('🔧 Applying T1 RLS repair...\n');
    
    const repairSQL = readFileSync(join(__dirname, 't1-repair-rls-policies.sql'), 'utf8');
    
    // Split SQL into individual statements (simple approach)
    const statements = repairSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const sql of statements) {
      if (sql.startsWith('SELECT')) {
        // Skip verification SELECT (will do manually)
        continue;
      }
      
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error(`❌ Error executing SQL:`, error.message);
        throw error;
      }
    }
    
    console.log('✅ Repair complete\n');
    
    // Verify policies created using pg_catalog
    const { data: verification, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          c.relname AS table_name,
          p.polname AS policy_name,
          CASE p.polcmd 
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
          END AS command
        FROM pg_policy p
        JOIN pg_class c ON p.polrelid = c.oid
        WHERE c.relname IN ('hc_prescriptions', 'hc_appointments')
        ORDER BY c.relname, p.polname
      `
    });
    
    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
    } else {
      console.log('📋 Verification:');
      for (const row of verification || []) {
        console.log(`  ${row.table_name}.${row.policy_name} [${row.command}]`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

applyRepair();
