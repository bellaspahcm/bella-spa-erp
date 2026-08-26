#!/usr/bin/env tsx
/**
 * Check RLS policies in production database
 * Purpose: Verify tenant isolation patterns before T1 repair
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function checkPolicies() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_EXECUTOR_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DATABASE_CA_CERT ? require('fs').readFileSync(process.env.DATABASE_CA_CERT, 'utf8') : undefined,
    },
  });

  try {
    const result = await pool.query(`
      SELECT 
        c.relname AS tablename,
        p.polname AS policyname,
        p.polcmd AS command,
        pg_get_expr(p.polqual, p.polrelid) AS using_clause,
        pg_get_expr(p.polwithcheck, p.polrelid) AS check_clause
      FROM pg_policy p
      JOIN pg_class c ON p.polrelid = c.oid
      WHERE c.relname IN ('hc_encounters', 'hc_prescriptions', 'hc_appointments', 'edu_enrollments')
      ORDER BY c.relname, p.polname
    `);

    console.log('=== RLS Policies in Production ===\n');
    
    for (const row of result.rows) {
      console.log(`Table: ${row.tablename}`);
      console.log(`  Policy: ${row.policyname}`);
      console.log(`  Command: ${row.command}`);
      console.log(`  USING: ${row.using_clause || 'NULL'}`);
      console.log(`  CHECK: ${row.check_clause || 'NULL'}`);
      console.log('');
    }

    console.log(`\nTotal policies found: ${result.rows.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPolicies();
